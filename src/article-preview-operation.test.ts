import {describe,it,expect,vi} from 'vitest';
import {runArticlePreview,type ArticlePreviewCheckpoint} from './article-preview-operation';
const reviewer={label:'Source',permissions:['VIEW_DRAFT','COMMENT'],history_mode:'LATEST' as const};
function fixture(){
 let checkpoint:ArticlePreviewCheckpoint|undefined;
 const current:any={current_revision_id:'r1',generation:3,review_origin:'https://paper.test',permalink_path:'/news/readable-story',sessions:[],readiness:{release_blockers:[]}};
 const request=vi.fn(async(_path:string,method?:string,body?:any)=>{
  if(method==='GET')return structuredClone(current);
  if(body.action==='INVITE'){current.sessions.push({id:'session',revision_id:'r1'});return {session_id:'session',url:'https://paper.test/news/readable-story?review=session&key=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'};}
  if(body.action==='SHARE_REVISION'){current.sessions[0].revision_id=body.revision_id;return {generation:5};}
  throw Error('Unexpected mutation');
 });
 const fetcher=vi.fn(async()=>Response.json({publication_id:'pub',review_contract:2,stable_article_urls:true,readable_article_urls:true,permanent_preview_urls:true}));
 const input=()=>({articleId:'article',reviewer,checkpoint,saveCheckpoint:async(v:ArticlePreviewCheckpoint)=>{checkpoint=structuredClone(v);}});
 return {current,request,fetcher,input,get checkpoint(){return checkpoint;},run:()=>runArticlePreview({publicationId:'pub',request:request as any,fetch:fetcher as any},input())};
}
describe('preview operation',()=>{
 it('does not share a different revision while finishing a prepared submission',async()=>{
  const f=fixture();
  await expect(runArticlePreview({publicationId:'pub',request:f.request as any,fetch:f.fetcher as any},{...f.input(),expectedRevisionId:'older'})).rejects.toThrow('Another revision');
  expect(f.request.mock.calls.filter(c=>c[1]==='POST')).toHaveLength(0);
 });
 it('issues once and updates the existing link without replacing its secret or permissions',async()=>{
  const f=fixture();const first=await f.run();expect(first.state).toBe('preview_ready');expect(first.readiness).toBeNull();
  expect(f.checkpoint?.stage).toBe('issued');expect((await f.run()).url).toBe(first.url);
  f.current.current_revision_id='r2';f.current.generation=4;expect((await f.run()).url).toBe(first.url);
  const commands=f.request.mock.calls.filter(c=>c[1]==='POST').map(c=>c[2]);
  expect(commands.map(c=>c.action)).toEqual(['INVITE','SHARE_REVISION']);
  expect(commands[1]).toMatchObject({expected_generation:4,revision_id:'r2',session_id:'session'});
 });
 it.each(['INVITE','SHARE_REVISION'])('reports committed readiness after %s without an extra history read',async(action)=>{
  const f=fixture();if(action==='SHARE_REVISION'){await f.run();f.current.current_revision_id='r2';}
  f.current.readiness={approval_blockers:[{code:'subject_approval',message:'Previous gate'}]};
  const committed={approval_blockers:[{code:'subject_approval',message:'Named reviewer has not approved'}]};
  f.request.mockClear();f.request.mockImplementationOnce(async()=>structuredClone(f.current)).mockImplementationOnce(async()=>({generation:5,readiness:committed,session_id:'session',url:'https://paper.test/news/readable-story?review=session&key=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'}));
  const result=await f.run();expect(result.readiness).toEqual(committed);expect(f.request.mock.calls.filter(c=>c[1]==='GET')).toHaveLength(1);
 });
 it('never retries an invitation whose response was lost',async()=>{
  const f=fixture();f.request.mockImplementationOnce(async()=>structuredClone(f.current)).mockImplementationOnce(async()=>{throw Error('Connection lost');});
  await expect(f.run()).rejects.toThrow('Connection lost');expect(f.checkpoint?.stage).toBe('invitation_pending');
  await expect(f.run()).rejects.toThrow('acknowledgement is uncertain');
  expect(f.request.mock.calls.filter(c=>c[1]==='POST')).toHaveLength(1);
 });
 it('checks the actual publication runtime before creating any invitation',async()=>{
  const f=fixture();f.fetcher.mockResolvedValueOnce(Response.json({publication_id:'another',review_contract:2,stable_article_urls:true,readable_article_urls:true,permanent_preview_urls:true}));
  await expect(f.run()).rejects.toThrow('does not confirm');expect(f.request.mock.calls.filter(c=>c[1]==='POST')).toHaveLength(0);
 });
 it('refuses changed reviewer input and revoked links without creating replacements',async()=>{
  const f=fixture();await f.run();f.current.sessions[0].revoked_at='now';await expect(f.run()).rejects.toThrow('unavailable');
  expect(f.request.mock.calls.filter(c=>c[1]==='POST')).toHaveLength(1);
 });
 it.each(['query','fragment'])('resumes a legacy %s checkpoint at the authoritative permanent path without creating an invitation',async(kind)=>{
  const f=fixture();await f.run();const saved=f.checkpoint!;
  saved.url=kind==='query'?`https://paper.test/news/a/article?review=session&key=${'a'.repeat(64)}&workspace=review`:`https://paper.test/review/session?workspace=review#${'a'.repeat(64)}`;
  f.request.mockClear();const result=await f.run();const url=new URL(result.url!);
  expect(url.pathname).toBe('/news/readable-story');expect(url.searchParams.get('review')).toBe('session');
  expect(url.searchParams.get('key')).toBe('a'.repeat(64));expect(url.searchParams.get('workspace')).toBe('review');expect(url.hash).toBe('');
  expect(f.request.mock.calls.filter(c=>c[1]==='POST')).toHaveLength(0);expect(f.checkpoint?.url).toBe(result.url);
 });
 it('rejects a noncanonical invitation receipt instead of returning it as ready',async()=>{
  const f=fixture();f.request.mockImplementationOnce(async()=>structuredClone(f.current)).mockImplementationOnce(async()=>({session_id:'session',url:`https://paper.test/news/a/article?review=session&key=${'a'.repeat(64)}`}));
  await expect(f.run()).rejects.toThrow('does not match');expect(f.checkpoint?.stage).toBe('invitation_pending');
 });

});
