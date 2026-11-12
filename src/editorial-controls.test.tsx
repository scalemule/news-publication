// @vitest-environment jsdom
import React from 'react';
import {afterEach,beforeEach,it,expect,vi} from 'vitest';
import {render,screen,fireEvent,cleanup,waitFor,within} from '@testing-library/react';
import {EditorialControls} from './editorial-controls';
beforeEach(()=>{HTMLDialogElement.prototype.showModal=function(){this.setAttribute('open','');};HTMLDialogElement.prototype.close=function(){this.removeAttribute('open');};});
afterEach(()=>{cleanup();vi.unstubAllGlobals();});
function setup(blocked=false){
 const story={generation:8,current_revision_id:'r1',editorial_approved_revision_id:null,published_revision_id:null,status:'SOURCE_REVIEWING',review_policy:'SUBJECT_APPROVAL_PLUS_EDITOR',revisions:[{id:'r1',number:3,document:{title:'Ready story',content_markdown:'News'}}],readiness:{approval_blockers:blocked?[{code:'subject_approval',message:'A named subject reviewer is required'}]:[],release_blockers:[{code:'editorial_approval',message:'Approve the current revision'}]}};
 const calls:any[]=[];
 const fetcher=vi.fn(async(url:any,options:any)=>{
  calls.push([url,options]);
  if(options?.method==='POST')return Response.json({data:{generation:10,current_revision_id:'r1',editorial_approved_revision_id:'r1',published_revision_id:'r1',status:'PUBLISHED',readiness:{approval_blockers:[],release_blockers:[]}}});
  return Response.json({data:String(url).endsWith('/access')?{role:'owner',actions:['read','approve','publish']}:story});
 });
 vi.stubGlobal('fetch',fetcher);vi.stubGlobal('confirm',vi.fn(()=>true));
 render(<EditorialControls base='/api/newsroom' post='article'/>);
 return calls;
}
it('uses one atomic human publication request and the committed generation without reloading access/history',async()=>{
 const calls=setup();const button=await screen.findByText('Approve and publish');fireEvent.click(button);
 const dialog=await screen.findByRole('dialog',{name:'Publish this article?'});
 expect(calls.filter(c=>c[1].method==='POST')).toHaveLength(0);
 fireEvent.click(within(dialog).getByRole('button',{name:'Approve and publish'}));
 await screen.findByText('Published');
 expect(calls.filter(c=>c[1].method==='GET')).toHaveLength(2);
 const commands=calls.filter(c=>c[1].method==='POST').map(c=>JSON.parse(c[1].body));
 expect(commands).toEqual([{expected_generation:8,action:'APPROVE_AND_RELEASE',sensitivity_review:null}]);
});
it('shows subject blockers before the editor clicks and does not silently change policy',async()=>{
 const calls=setup(true);await screen.findByText('A named subject reviewer is required');
 expect((screen.getByText('Approve and publish') as HTMLButtonElement).disabled).toBe(true);
 await waitFor(()=>expect(calls).toHaveLength(2));
 expect(calls.some(c=>c[1].method==='POST')).toBe(false);
});

it('explains the move to manual publication and leaves policy unchanged when cancelled',async()=>{
 const calls=setup(true);await screen.findByText('A named subject reviewer is required');
 fireEvent.change(screen.getByLabelText('Review policy'),{target:{value:'FACT_CHECK'}});
 fireEvent.click(screen.getByText('Save review policy'));
 const dialog=await screen.findByRole('dialog',{name:'Change review policy?'});
 expect(within(dialog).getByText(/Automatic publication will be turned off/)).toBeTruthy();
 fireEvent.click(within(dialog).getByRole('button',{name:'Cancel'}));
 expect(screen.queryByRole('dialog')).toBeNull();
 expect(window.confirm).not.toHaveBeenCalled();
 expect(calls.some(c=>c[1].method==='POST')).toBe(false);
});

it('saves the exact selected policy only after the named confirmation',async()=>{
 const calls=setup(true);await screen.findByText('A named subject reviewer is required');
 fireEvent.change(screen.getByLabelText('Review policy'),{target:{value:'CONTRIBUTOR_REVIEW'}});
 fireEvent.click(screen.getByText('Save review policy'));
 const dialog=screen.getByRole('dialog',{name:'Change review policy?'});
 expect(within(dialog).getByText('Contributor feedback — publisher decides')).toBeTruthy();
 expect(calls.some(c=>c[1].method==='POST')).toBe(false);
 fireEvent.click(within(dialog).getByRole('button',{name:'Save review policy'}));
 await waitFor(()=>expect(calls.filter(c=>c[1].method==='POST')).toHaveLength(1));
 expect(JSON.parse(calls.find(c=>c[1].method==='POST')[1].body)).toEqual({expected_generation:8,action:'CONFIGURE_POLICY',sensitivity_review:null,policy:'CONTRIBUTOR_REVIEW',auto_publish:false,scheduled_at:null});
 expect(window.confirm).not.toHaveBeenCalled();
});

it('shows request failure in the page and never retries a conflicting publication',async()=>{
 const calls=setup();fireEvent.click(await screen.findByText('Approve and publish'));
 const fetcher=vi.mocked(fetch),previous=fetcher.getMockImplementation()!;
 fetcher.mockImplementation(async(url,options)=>options?.method==='POST'?Response.json({error:{message:'The article changed. Reload the current revision.'}},{status:409}):previous(url,options));
 fireEvent.click(within(screen.getByRole('dialog')).getByRole('button',{name:'Approve and publish'}));
 expect(await screen.findByRole('alert')).toHaveProperty('textContent','The article changed. Reload the current revision.');
 expect(fetcher.mock.calls.filter(c=>c[1]?.method==='POST')).toHaveLength(1);
 expect(screen.queryByRole('dialog')).toBeNull();
});
