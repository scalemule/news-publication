// @vitest-environment jsdom
import React from 'react';
import {afterEach,it,expect,vi} from 'vitest';
import {render,screen,fireEvent,cleanup,waitFor} from '@testing-library/react';
import {EditorialControls} from './editorial-controls';
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
