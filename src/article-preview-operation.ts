export type PreviewReviewer = {
 label:string; permissions:string[]; history_mode:'LATEST'|'PREVIOUS'|'SELECTED';
 shared_revision_ids?:string[]; questions?:unknown[]; allow_contributors?:boolean;
 required_approval?:boolean; verification_email?:string|null; expires_at?:string|null;
};
export type ArticlePreviewCheckpoint = {
 version:1; publicationId:string; articleId:string; reviewer:string;
 stage:'ready'|'invitation_pending'|'issued'|'share_pending';
 revisionId?:string; sessionId?:string; url?:string;
};
export type ArticlePreviewInput = {
 articleId:string; reviewer:PreviewReviewer; checkpoint?:ArticlePreviewCheckpoint;
 saveCheckpoint:(state:ArticlePreviewCheckpoint)=>Promise<void>; timeoutMs?:number;
};
type Transport={publicationId:string;request:<T=any>(path:string,method?:string,body?:unknown,extra?:HeadersInit,signal?:AbortSignal)=>Promise<T>;fetch:typeof fetch};
/** Issue once, or advance the same invitation. Capability URLs belong only in a private checkpoint. */
export async function runArticlePreview(t:Transport,input:ArticlePreviewInput){
 const started=performance.now(),timeout=input.timeoutMs??10000;
 if(!Number.isFinite(timeout)||timeout<100||timeout>120000)throw Error('Preview deadline must be between 100 and 120000 milliseconds');
 const signal=AbortSignal.timeout(timeout);
 const r=input.reviewer;
 if(!r.label?.trim()||!r.permissions?.includes('VIEW_DRAFT')||!['LATEST','PREVIOUS','SELECTED'].includes(r.history_mode))throw Error('Specify the reviewer label, VIEW_DRAFT permission and history mode');
 const reviewer=JSON.stringify(Object.fromEntries(Object.entries(r).sort(([a],[b])=>a.localeCompare(b))));
 let state:ArticlePreviewCheckpoint=input.checkpoint?structuredClone(input.checkpoint):{version:1,publicationId:t.publicationId,articleId:input.articleId,reviewer,stage:'ready'};
 if(state.version!==1||state.publicationId!==t.publicationId||state.articleId!==input.articleId||state.reviewer!==reviewer)throw Error('Preview checkpoint input changed; preserve the original reviewer and article');
 const save=async()=>input.saveCheckpoint(structuredClone(state));
 const path=`/articles/${encodeURIComponent(input.articleId)}/collaboration`;
 const current=await t.request<any>(path,'GET',undefined,undefined,signal);
 if(state.stage==='invitation_pending')throw Error('Invitation acknowledgement is uncertain. Inspect the recorded article sessions; do not create another invitation or rotate its key.');
 if(state.sessionId){
  const session=current.sessions?.find((s:any)=>s.id===state.sessionId);
  if(!session||session.revoked_at||(session.expires_at&&Date.parse(session.expires_at)<=Date.now()))throw Error('The saved invitation is unavailable; inspect its expiry and revocation in the newsroom');
  if(!state.url)throw Error('The issued private URL is missing from its checkpoint; do not reconstruct its secret');
  // Lost SHARE_REVISION responses can be reconciled from the authoritative session.
  if(state.stage==='share_pending'&&session.revision_id!==state.revisionId)throw Error('Share acknowledgement is uncertain; inspect the current session before retrying');
  if(state.stage==='share_pending'&&state.revisionId!==current.current_revision_id)throw Error('Another revision became current while sharing; review the new draft before sharing it');
  if(session.revision_id!==current.current_revision_id){
   state.revisionId=current.current_revision_id;state.stage='share_pending';await save();
   await t.request(path,'POST',{action:'SHARE_REVISION',expected_generation:current.generation,session_id:state.sessionId,revision_id:state.revisionId},undefined,signal);
  }
  state.stage='issued';state.revisionId=current.current_revision_id;await save();
 }else{
  const origin=new URL(current.review_origin);
  if(origin.protocol!=='https:'||origin.username||origin.password||origin.origin!==current.review_origin.replace(/\/$/,''))throw Error('Publication has no verified HTTPS review origin');
  const response=await t.fetch(new URL('/api/news/review-capabilities',origin),{credentials:'omit',redirect:'error',cache:'no-store',signal});
  if(!response.ok)throw Error('Publication review capabilities are unavailable');
  const capabilities=await response.json();
  if(capabilities.publication_id!==t.publicationId||capabilities.review_contract<2||capabilities.stable_article_urls!==true||capabilities.readable_article_urls!==true)throw Error('Publication does not confirm readable permanent preview URLs');
  // Persist before the non-idempotent mutation. A crash never triggers blind re-invitation.
  state.revisionId=current.current_revision_id;state.stage='invitation_pending';await save();
  const issued=await t.request<any>(path,'POST',{...r,action:'INVITE',stable_article_url:true,expected_generation:current.generation,revision_id:state.revisionId},undefined,signal);
  if(typeof issued.session_id!=='string'||typeof issued.url!=='string')throw Error('Invitation receipt is incomplete; inspect the existing sessions');
  const url=new URL(issued.url);
  if(url.origin!==origin.origin||!url.pathname.startsWith('/news/')||url.searchParams.get('review')!==issued.session_id)throw Error('Invitation receipt does not match the publication');
  state.sessionId=issued.session_id;state.url=issued.url;state.stage='issued';await save();
 }
 return {state:'preview_ready',article_id:input.articleId,revision_id:state.revisionId,session_id:state.sessionId,url:state.url,readiness:current.readiness??null,elapsed_ms:Math.round(performance.now()-started)};
}
