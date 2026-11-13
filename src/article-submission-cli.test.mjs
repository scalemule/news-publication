import {describe, it, expect, vi} from 'vitest';
import {mkdtemp, readFile, rm, stat} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {submitWithCheckpoint, waitForSubmission, snapshotMatchesRevision} from '../bin/submission-state.mjs';
import {articleEditHtmlMatches} from '../src/article-edit-verification';
import {articlePhotoHtmlMatches} from '../src/article-photo-verification';

const doc = {title:'София 東京 📰', content_markdown:'Local reporting.', cards:[], citations:[], tag_ids:[]};
const complete = () => ({submission_id:'submission', article_id:'article', revision_id:'revision',
  status:'published', public_ready:true, next_action:'verify_rendered_public_page',
  permalink_path:'/news/local-reporting', progress:{intent:'publish',assets:{}}, error_code:null});
function fixture() {
  let elapsed=0;
  const receipt=complete();
  const current={published_revision_id:'revision', review_origin:'https://paper.example', revisions:[{id:'revision',document:doc}]};
  const snapshot={author:{slug:'greg'}, article:{...doc,id:'article',status:'published', content_html:'<p>Local reporting.</p>',
    cover_image_url:'https://cdn.example/hero.webp',og_image_url:'https://cdn.example/social.webp', metadata:{cards:[],citations:[]}, tags:[]}};
  const html='<h1>София 東京 📰</h1><p>Local reporting.</p><a href="/authors/greg">Greg</a><img src="https://cdn.example/hero.webp"><meta property="og:image" content="https://cdn.example/social.webp">';
  const client={submission:vi.fn(async()=>structuredClone(receipt)),get:vi.fn(async()=>structuredClone(current)),publicArticle:vi.fn(async()=>structuredClone(snapshot))};
  const options={remaining:()=>{if(elapsed>=3000)throw Error('Operation deadline reached');return 3000-elapsed;},
    sleep:async ms=>{elapsed+=ms;},fetcher:vi.fn(async()=>new Response(html)),
    editMatches:articleEditHtmlMatches,photoMatches:articlePhotoHtmlMatches,save:vi.fn(async()=>{})};
  return {receipt,current,snapshot,html,client,options,run:initial=>waitForSubmission(client,initial??receipt,options)};
}

describe('one bounded submission',()=>{
  it('waits through processing and verifies prose, cards, author link and images at the permanent URL',async()=>{
    const f=fixture();const result=await f.run({...f.receipt,status:'queued',public_ready:false,next_action:'poll_submission'});
    expect(result).toMatchObject({state:'published_and_verified',url:'https://paper.example/news/local-reporting',public_page_verified:true});
    expect(f.client.submission).toHaveBeenCalledTimes(2);
    expect(result.request_timings.map(t=>t.stage)).toEqual(['processing','revision','public_snapshot','public_page','confirm_revision']);
    const request=f.options.fetcher.mock.calls[0];expect(request[1]).not.toHaveProperty('headers');expect(request[1].redirect).toBe('error');
  });
  it.each(['held','awaiting_review'])('returns %s immediately without polling or changing review policy',async status=>{
    const f=fixture();const result=await f.run({...f.receipt,status,public_ready:false,error_code:'approval_required'});
    expect(result.state).toBe(status);expect(result.error_code).toBe('approval_required');expect(f.client.submission).not.toHaveBeenCalled();
  });
  it('does not count an HTTP 200 or a false public_ready receipt as verified',async()=>{
    const f=fixture();f.receipt.public_ready=false;f.receipt.next_action='poll_submission';
    const result=await f.run();expect(result.state).toBe('published_verification_pending');expect(result.public_page_verified).toBeUndefined();
    expect(f.options.fetcher).not.toHaveBeenCalled();expect(f.client.submission).toHaveBeenCalledTimes(2);
  });
  it('stops when a newer revision supersedes the submitted article',async()=>{
    const f=fixture();f.receipt.superseded=true;
    expect((await f.run()).state).toBe('superseded');expect(f.client.get).not.toHaveBeenCalled();
  });
  it('continues the same job when history contains a retired image and selected media finishes',async()=>{
    const f=fixture();
    const pending={...f.receipt,public_ready:false,processing:{assets:[{source_file_id:'old-photo',status:'retired'},{source_file_id:'selected-photo',status:'pending'}]}};
    expect(await f.run(pending)).toMatchObject({state:'published_and_verified',public_ready:true});
    expect(f.client.submission).toHaveBeenCalledTimes(2);
  });
  it('requires the snapshot to match the receipt revision even if the old page matches the old snapshot',async()=>{
    const f=fixture();f.snapshot.article.content_markdown='Older text.';
    expect((await f.run()).state).toBe('published_verification_pending');expect(f.options.fetcher).not.toHaveBeenCalled();
  });
  it.each(['prose','image','author'])('does not declare success with stale or missing rendered %s',async field=>{
    const f=fixture();const stale={prose:f.html.replace('Local reporting.','Old article.'),image:f.html.replace('<img ', '<span '),author:f.html.replace('<a href="/authors/greg">Greg</a>','<script>{"author":"/authors/greg"}</script>')};
    f.options.fetcher.mockImplementation(async()=>new Response(stale[field]));
    const result=await f.run();expect(result.state).toBe('published_verification_pending');expect(result.public_page_verified).toBeUndefined();
  });
  it('closes the page-read race with a final revision check',async()=>{
    const f=fixture();f.client.submission.mockResolvedValueOnce({...f.receipt,superseded:true});
    const result=await f.run();expect(result.state).toBe('superseded');expect(result.public_page_verified).toBeUndefined();
  });
  it('preserves the receipt if public verification loses its connection',async()=>{
    const f=fixture();f.options.fetcher.mockRejectedValueOnce(Error('Connection lost'));
    expect(await f.run()).toMatchObject({submission_id:'submission',state:'published_verification_pending',stage:'public_page',reason:'Connection lost'});
  });
  it('distinguishes a prepared private draft from a published article',async()=>{
    const f=fixture();const result=await f.run({...f.receipt,status:'complete',public_ready:false,progress:{intent:'review'}});
    expect(result.state).toBe('prepared');expect(result.public_page_verified).toBeUndefined();expect(f.client.get).not.toHaveBeenCalled();
  });
  it('checks card facts, citations and tags in the stored revision',()=>{
    const f=fixture();expect(snapshotMatchesRevision(f.snapshot,f.current,f.receipt)).toBe(true);
    f.snapshot.article.metadata.cards=[{title:'Extra card',facts:[]}];
    expect(snapshotMatchesRevision(f.snapshot,f.current,f.receipt)).toBe(false);
  });
  it('preserves existing source citations when the versioned document did not replace them',()=>{
    const f=fixture();f.current.revisions[0].document={...doc,citations:undefined};
    f.snapshot.article.metadata.citations=[{title:'County source',url:'https://county.example'}];
    expect(snapshotMatchesRevision(f.snapshot,f.current,f.receipt)).toBe(true);
    f.current.revisions[0].document.citations=[];
    expect(snapshotMatchesRevision(f.snapshot,f.current,f.receipt)).toBe(false);
  });
  it('checks the bounded public citation projection without exposing private records',()=>{
    const f=fixture();const links=Array.from({length:7},(_,i)=>({title:'東京 📰 '+i,url:'https://county.example/'+i,publisher:'County'}));
    f.current.revisions[0].document={...doc,citations:[{title:'Private',url:'https://county.example/private',reader_visible:false},{title:'Signed',url:'https://county.example/file?X-Amz-Signature=private'},...links]};
    f.snapshot.article.metadata.citations=links.slice(0,5).map(({title,url})=>({title,url}));
    expect(snapshotMatchesRevision(f.snapshot,f.current,f.receipt)).toBe(true);
    f.snapshot.article.metadata.citations[0].url='https://other.example';
    expect(snapshotMatchesRevision(f.snapshot,f.current,f.receipt)).toBe(false);
  });
});

describe('submission checkpoint',()=>{
  it('fails preflight before POST/checkpoint and does not revalidate an accepted receipt',async()=>{
    const dir=await mkdtemp(join(tmpdir(),'article-preflight-'));
    try {
      const values={publication:'paper','operation-key':'preflight',state:join(dir,'state.json')};
      const client={submit:vi.fn(async()=>complete()),submission:vi.fn(async()=>complete())};
      await expect(submitWithCheckpoint(client,values,{article:doc},[],()=>5000,()=>['Invalid headline','Invalid reason'])).rejects.toThrow('Invalid headline; Invalid reason');
      expect(client.submit).not.toHaveBeenCalled();
      await expect(stat(values.state)).rejects.toMatchObject({code:'ENOENT'});
      await submitWithCheckpoint(client,values,{article:doc},[],()=>5000,()=>[]);
      const check=vi.fn(()=>['New validation rule']);
      await submitWithCheckpoint(client,values,{article:doc},[],()=>5000,check);
      expect(check).not.toHaveBeenCalled();expect(client.submit).toHaveBeenCalledTimes(1);expect(client.submission).toHaveBeenCalledTimes(1);
    } finally {await rm(dir,{recursive:true,force:true});}
  });
  it('saves before POST, retries uncertain intake with the same key, then resumes with GET only',async()=>{
    const dir=await mkdtemp(join(tmpdir(),'article-submission-'));
    try{
      const values={publication:'paper','operation-key':'same-operation',state:join(dir,'state.json')};
      const manifest={article:{operation:'create',author_profile_id:'author',document:doc},intent:'publish'};
      const client={submit:vi.fn(async()=>{
        expect(JSON.parse(await readFile(values.state,'utf8')).fingerprint).toBeTruthy();
        throw Error('Acknowledgement lost');
      }),submission:vi.fn(async()=>complete())};
      await expect(submitWithCheckpoint(client,values,manifest,[],()=>5000)).rejects.toMatchObject({checkpointFile:values.state});
      client.submit.mockResolvedValueOnce(complete());
      const first=await submitWithCheckpoint(client,values,manifest,[],()=>5000);
      const next=await submitWithCheckpoint(client,values,manifest,[],()=>5000);
      expect(next.receipt.submission_id).toBe(first.receipt.submission_id);
      expect(client.submit).toHaveBeenCalledTimes(2);expect(client.submission).toHaveBeenCalledTimes(1);
      expect(client.submit.mock.calls.map(c=>c[1])).toEqual(['same-operation','same-operation']);
      expect((await stat(values.state)).mode & 0o777).toBe(0o600);
      await expect(submitWithCheckpoint(client,values,{...manifest,intent:'review'},[],()=>5000)).rejects.toThrow('input changed');
      expect(client.submit).toHaveBeenCalledTimes(2);
    }finally{await rm(dir,{recursive:true,force:true});}
  });
  it('binds the checkpoint to actual file bytes rather than only the filename',async()=>{
    const dir=await mkdtemp(join(tmpdir(),'article-submission-'));
    try{
      const values={publication:'paper','operation-key':'same-operation',state:join(dir,'state.json')};
      const client={submit:vi.fn(async()=>complete()),submission:vi.fn()};
      const asset=bytes=>[{slot:'hero',filename:'same.jpg',file:new Blob([bytes])}];
      await submitWithCheckpoint(client,values,{article:doc},asset('first'),()=>5000);
      await expect(submitWithCheckpoint(client,values,{article:doc},asset('changed'),()=>5000)).rejects.toThrow('input changed');
      expect(client.submit).toHaveBeenCalledTimes(1);expect(client.submission).not.toHaveBeenCalled();
    }finally{await rm(dir,{recursive:true,force:true});}
  });
});
