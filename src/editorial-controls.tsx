'use client';
import React, {useCallback,useEffect,useState} from 'react';

type Access={role:string|null;actions:string[];account?:{email?:string|null;name?:string|null}|null};
type Blocker={code:string;message:string};
type Readiness={approval_blockers:Blocker[];release_blockers:Blocker[]};
type Story={generation:number;current_revision_id:string;editorial_approved_revision_id:string|null;published_revision_id:string|null;status:string;review_policy:string;blocked_reason:string|null;permalink_path?:string;review_origin?:string;readiness?:Readiness;revisions:{id:string;number:number;document:{title:string;content_markdown:string}}[];sessions?:{id:string;label:string;required_approval:boolean;email_verified:boolean;revision_id:string;revoked_at:string|null}[]};
export type EditorialControlsProps={base:string;post:string;previewRevision?:string;showDocument?:boolean;newsroomUrl?:string};
async function request(base:string,path:string,body?:unknown){
 const r=await fetch(`${base}/${path}`,{method:body===undefined?'GET':'POST',credentials:'same-origin',cache:'no-store',headers:body===undefined?{}:{'content-type':'application/json'},body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(15000)});
 const data=await r.json();if(!r.ok||data.success===false)throw Object.assign(new Error(typeof data.error==='string'?data.error:data.error?.message||`Request failed (${r.status})`),{status:r.status});return data.data??data;
}
const policies=[['FACT_CHECK','Source feedback — publisher decides'],['CONTRIBUTOR_REVIEW','Contributor feedback — publisher decides'],['SUBJECT_APPROVAL_REQUIRED','Required subject consent'],['SUBJECT_APPROVAL_PLUS_EDITOR','Required subject consent and editor approval']];
/** Shared by publication previews and the network admin; the server remains the authority. */
export function EditorialControls({base,post,previewRevision,showDocument=false,newsroomUrl='/newsroom'}:EditorialControlsProps){
 const [access,setAccess]=useState<Access|null>(null),[record,setRecord]=useState<Story|null>(null),[error,setError]=useState(''),[notice,setNotice]=useState(''),[busy,setBusy]=useState(false),[policy,setPolicy]=useState('');
 const read=useCallback(async()=>{
  const [a,r]=await Promise.allSettled([request(base,'access'),request(base,`articles/${post}/collaboration`)]);
  if(a.status==='rejected')throw a.reason;
  if(!a.value.actions.includes('read'))return {access:a.value as Access,record:null};
  if(r.status==='rejected')throw r.reason;
  return {access:a.value as Access,record:r.value as Story};
 },[base,post]);
 const reload=useCallback(async()=>{const next=await read();setAccess(next.access);setRecord(next.record);setPolicy(next.record?.review_policy||'');},[read]);
 useEffect(()=>{let active=true;void read().then(next=>{if(active){setAccess(next.access);setRecord(next.record);setPolicy(next.record?.review_policy||'');}}).catch(e=>{if(active&&e.status!==401)setError(e.message);});return()=>{active=false;};},[read]);
 if(!access)return error?<aside className="newsroom newsroom-editor"><p role="alert">{error}</p><a href={newsroomUrl}>Check publication access</a></aside>:null;
 if(!access.actions.includes('read'))return <aside className="newsroom newsroom-editor"><p>Your account has no staff role for this publication.</p><a href={newsroomUrl}>Check publication access</a></aside>;
 if(!record)return <aside className="newsroom newsroom-editor"><p role="status">Loading editorial state…</p></aside>;
 const current=record.revisions.find(r=>r.id===record.current_revision_id),stale=!!previewRevision&&previewRevision!==record.current_revision_id,approved=record.editorial_approved_revision_id===record.current_revision_id,published=record.published_revision_id===record.current_revision_id;
 const approvalBlocks=record.readiness?.approval_blockers||[],releaseBlocks=record.readiness?.release_blockers||[];
 const blockers=[...new Map([...approvalBlocks,...releaseBlocks].map(b=>[b.code+':'+b.message,b])).values()];
 const nonApprovalBlocks=releaseBlocks.filter(b=>b.code!=='editorial_approval');
 async function command(action:string,extra:object={}){
  if(!record)return;
  if(['RELEASE','APPROVE_AND_RELEASE'].includes(action)&&!window.confirm(`Publish “${current?.document.title}” revision ${current?.number}?`))return;
  if(action==='CONFIGURE_POLICY'&&!window.confirm(`Change this article’s review policy to “${policies.find(p=>p[0]===policy)?.[1]}”? Existing reviewer feedback is retained. Automatic publication will be turned off; you will publish manually. This does not publish the article.`))return;
  setBusy(true);setError('');setNotice('');const started=performance.now();
  try{
   const result=await request(base,`articles/${post}/collaboration`,{expected_generation:record.generation,action,sensitivity_review:null,...extra,...(action==='RELEASE'?{scheduled_at:null}:{})});
   // The response is the committed generation, including all release transitions.
   // Older servers fall back to a fresh read; a timeout is always reconciled.
   if(action!=='DESIGNATE_APPROVER'&&Number.isSafeInteger(result.generation)&&result.current_revision_id===record.current_revision_id&&result.readiness){setRecord({...record,...result});setPolicy(result.review_policy||record.review_policy);}else await reload();
   setNotice((action==='APPROVE'?'Editorial approval recorded.':action==='CONFIGURE_POLICY'?'Review policy updated.':result.status==='PUBLISHED'?'Revision published.':'Action saved.')+` (${((performance.now()-started)/1000).toFixed(1)} seconds)`);
  }catch(e){setError((e as Error).message);await reload().catch(()=>{});}finally{setBusy(false);}
 }
 const publicUrl=record.permalink_path&&record.review_origin?new URL(record.permalink_path,record.review_origin).href:null;
 return <aside className="newsroom newsroom-editor" aria-label="Editorial controls">
  <h2>{published?'Published':'Editorial review'}</h2>
  <p>{access.account?.email?`Signed in as ${access.account.email} · `:''}{access.role} · Revision {current?.number} · {record.status.toLowerCase().replaceAll('_',' ')}</p>
  {showDocument&&<><h3>{current?.document.title}</h3><pre>{current?.document.content_markdown}</pre></>}
  {stale&&<p role="alert">This preview shows an older revision. Review the current draft in the newsroom before approving.</p>}
  {!published&&blockers.length>0&&<section aria-label="Publication requirements"><h3>Before publication</h3><ul>{blockers.map(b=><li key={b.code+b.message}>{b.message}</li>)}</ul></section>}
  {record.blocked_reason&&<p role="alert">{record.blocked_reason}</p>}
  {error&&<p role="alert" className="newsroom-error">{error}</p>}{notice&&<p role="status">{notice}</p>}
  {published&&publicUrl&&<a href={publicUrl}>View published article</a>}
  {!published&&<div>
   {access.actions.includes('publish')&&record.readiness&&!approved&&<button disabled={busy||stale||approvalBlocks.length>0||nonApprovalBlocks.length>0} onClick={()=>void command('APPROVE_AND_RELEASE')}>Approve and publish</button>}
   {access.actions.includes('approve')&&<button disabled={busy||stale||approved||approvalBlocks.length>0} onClick={()=>void command('APPROVE')}>{approved?'Editorial approval recorded':'Approve for publication'}</button>}
   {access.actions.includes('publish')&&<button disabled={busy||stale||!approved||releaseBlocks.length>0} onClick={()=>void command('RELEASE')}>Publish approved revision</button>}
  </div>}
  {access.actions.includes('publish')&&!published&&<details><summary>Review policy and reviewers</summary>
   <p>Ordinary reporting can request feedback while the publisher makes the final decision. Select required subject consent when the story requires that consent.</p>
   <label>Review policy<select value={policy} disabled={busy} onChange={e=>setPolicy(e.target.value)}>{!policies.some(p=>p[0]===policy)&&<option value={policy}>{policy.toLowerCase().replaceAll('_',' ')}</option>}{policies.map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></label>
   <button disabled={busy||policy===record.review_policy} onClick={()=>void command('CONFIGURE_POLICY',{policy,auto_publish:false,scheduled_at:null})}>Save review policy</button>
   <ul>{record.sessions?.filter(s=>!s.revoked_at).map(s=><li key={s.id}>{s.label} — {s.required_approval?'required approval':'feedback'}; {s.revision_id===record.current_revision_id?'current revision':'older revision'}{s.email_verified&&!s.required_approval&&s.revision_id===record.current_revision_id&&<button disabled={busy} onClick={()=>{if(window.confirm(`Require ${s.label} to approve this exact revision?`))void command('DESIGNATE_APPROVER',{session_id:s.id});}}>Require this reviewer’s approval</button>}</li>)}</ul>
  </details>}
  <button disabled={busy} onClick={()=>void reload().catch(e=>setError(e.message))}>Reload state</button><a href={newsroomUrl}>Open newsroom</a>
 </aside>;
}
