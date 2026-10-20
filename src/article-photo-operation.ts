import type { PublishedCoverReplacement } from "./article-workflow-client";

export type PhotoOperationCheckpoint = {
  version: 1; identity: string; stage: string; expectedVersion: number; articleHash: string;
  fileId?: string; sessionId?: string; completionToken?: string; etag?: string;
  completed?: boolean; registered?: boolean; payload?: any; attachedVersion?: number;
};
export type ArticlePhotoInput = Omit<PublishedCoverReplacement, "fileId" | "expectedVersion" | "socialRenditionKey"> & {
  operationKey: string; expectedVersion: number; file: Blob; filename: string;
  checkpoint?: PhotoOperationCheckpoint;
  /** Persist atomically before the next side effect. Contains private upload tokens. */
  saveCheckpoint: (state: PhotoOperationCheckpoint) => Promise<void>;
  timeoutMs?: number;
  onProgress?: (event: { stage: string; elapsed_ms: number; file_id?: string }) => void;
};
type Transport = {
  publicationId: string;
  request: <T = any>(path: string, method?: string, body?: any, headers?: HeadersInit, signal?: AbortSignal) => Promise<T>;
  fetch: typeof fetch; apiUrl: string;
};
export class ArticlePhotoOperationError extends Error {
  constructor(public code: string, public stage: string, message: string, public fileId?: string) { super(message); this.name = "ArticlePhotoOperationError"; }
}
const digest = async (value: BufferSource) => [...new Uint8Array(await crypto.subtle.digest("SHA-256", value))].map(v => v.toString(16).padStart(2, "0")).join("");
const hash = (value: unknown) => digest(new TextEncoder().encode(JSON.stringify(value)));
const canonical = (v: any): any => Array.isArray(v) ? v.map(canonical) : v && typeof v === "object" ? Object.fromEntries(Object.keys(v).sort().map(k=>[k,canonical(v[k])])) : v;
const stableArticle = (p: any) => [p.id,p.slug,p.title,p.subtitle,p.content_markdown,p.content_html,p.status,p.visibility,p.published_at,p.author_user_id,p.audio_file_id,
  Object.fromEntries(Object.entries(p.metadata ?? {}).filter(([k]) => !["cover_image","open_graph_image","visual_desk_receipt"].includes(k)).sort(([a],[b]) => a.localeCompare(b)))];
function photoType(bytes: Uint8Array): string {
  if (bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) return "image/jpeg";
  const ascii = (n: number, length: number) => String.fromCharCode(...bytes.subarray(n, n + length));
  const png = ascii(0, 8) === "\x89PNG\r\n\x1a\n";
  const webp = ascii(0, 4) === "RIFF" && ascii(8, 4) === "WEBP";
  if (!png && !webp) throw Error("Use a still JPEG, PNG or WebP photo; animations use the Video workflow");
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  for (let n = png ? 8 : 12, chunks = 0; n < bytes.length; chunks++) {
    if (chunks >= 10000 || n + 8 > bytes.length) throw Error("Invalid or truncated photo container");
    const kind = ascii(png ? n + 4 : n, 4);
    if (["acTL", "ANIM", "ANMF"].includes(kind)) throw Error("Animated photos require the Video workflow");
    const size = view.getUint32(png ? n : n + 4, webp);
    n += size + (png ? 12 : 8 + size % 2);
    if (n > bytes.length) throw Error("Truncated photo container");
    if (png && kind === "IEND") break;
  }
  return png ? "image/png" : "image/webp";
}
function immutableUrl(raw: unknown): raw is string {
  try { const u = new URL(String(raw)); return u.protocol === "https:" && !u.username && !u.password && !u.search && !u.hash; } catch { return false; }
}
const measured = (m: any, file: string) => m?.ready === true && m.file_id === file && immutableUrl(m.url) && Number.isInteger(m.width) && m.width > 0 && m.width <= 12000 && Number.isInteger(m.height) && m.height > 0 && m.height <= 12000;
const mediaMatches = (post: any, payload: any) => post.cover_image_url === payload.cover_image_url && post.og_image_url === payload.og_image_url && JSON.stringify(canonical(post.metadata?.cover_image)) === JSON.stringify(canonical(payload.cover_image)) && JSON.stringify(canonical(post.metadata?.open_graph_image)) === JSON.stringify(canonical(payload.open_graph_image));

/** One bounded, resumable local-file operation through normal Storage, Photo and Blog APIs. */
export async function runArticlePhoto(t: Transport, input: ArticlePhotoInput) {
  const started = performance.now();
  if (!input.operationKey || input.operationKey.length > 128 || !Number.isSafeInteger(input.expectedVersion) || input.expectedVersion < 1 || input.rightsConfirmed !== true || !input.alt?.trim() || typeof input.aiGenerated !== "boolean" || (input.aiGenerated && !input.label?.trim())) throw Error("Supply a stable operation key, current article version, confirmed rights, factual alt and explicit provenance");
  if (typeof input.caption !== "string" || typeof input.credit !== "string" || !(input.label === null || typeof input.label === "string")) throw Error("Supply explicit caption, credit and provenance label");
  const focal = input.focalPoint ?? {x:0.5,y:0.5};
  if (![focal.x,focal.y].every(v=>Number.isFinite(v) && v>=0 && v<=1)) throw Error("Focal point must be within the image");
  if (!input.file.size || input.file.size > 25 * 1024 * 1024) throw Error("A photo must be between 1 byte and 25 MiB");
  const bytes = new Uint8Array(await input.file.arrayBuffer()); const mime = photoType(bytes);
  const identity = await hash([t.publicationId,input.articleId,input.operationKey,await digest(bytes),input.expectedVersion,input.caption,input.credit,input.alt,input.rightsConfirmed,input.aiGenerated,input.label,input.focalPoint ?? {x:0.5,y:0.5}]);
  if (input.checkpoint && (input.checkpoint.version !== 1 || input.checkpoint.identity !== identity)) throw new ArticlePhotoOperationError("OPERATION_CONFLICT", "validation", "The saved operation belongs to different input; do not overwrite it");
  let state = input.checkpoint ? structuredClone(input.checkpoint) : undefined;
  let stage = "preflight";
  const deadline = AbortSignal.timeout(Math.min(Math.max(input.timeoutMs ?? 30_000, 100), 120_000));
  const request = <T = any>(path: string, method?: string, body?: any) => t.request<T>(path, method, body, undefined, deadline);
  const progress = async (next: string) => { stage = next; if (state) { state.stage = next; await input.saveCheckpoint(structuredClone(state)); } input.onProgress?.({stage,elapsed_ms:Math.round(performance.now()-started),file_id:state?.fileId}); };
  const sleep = () => new Promise<void>((resolve, reject) => {
    deadline.throwIfAborted(); const id = setTimeout(() => { deadline.removeEventListener("abort", abort); resolve(); }, 300);
    const abort = () => { clearTimeout(id); reject(deadline.reason); }; deadline.addEventListener("abort", abort, {once:true});
  });
  const postPath = `/articles/${encodeURIComponent(input.articleId)}/document`;
  try {
    const [post, options, collaboration] = await Promise.all([
      request(postPath), request(`/article-workflow/options?article_id=${encodeURIComponent(input.articleId)}`),
      request(`/articles/${encodeURIComponent(input.articleId)}/collaboration`).then(() => true).catch(error => { if (error.status === 404 && error.message === "Story collaboration is not enabled") return false; throw error; }),
    ]);
    if (post.status !== "published" || post.visibility !== "public" || options.workflow_version !== 1) throw new ArticlePhotoOperationError("ARTICLE_NOT_PUBLIC", stage, "Select a currently published public article");
    if (collaboration) throw new ArticlePhotoOperationError("REVISION_WORKFLOW_REQUIRED", stage, "This story requires an immutable media revision and editorial release; no upload or public mutation was made");
    if (state?.payload && mediaMatches(post, state.payload)) {
      if (await hash(stableArticle(post)) !== state.articleHash) throw new ArticlePhotoOperationError("ARTICLE_CHANGED", stage, "The photo is attached, but other article content changed; inspect before continuing", state.fileId);
      state.attachedVersion = post.version; await progress("verified");
      return {article_id:input.articleId,file_id:state.fileId,version:post.version,state:"already_applied",elapsed_ms:Math.round(performance.now()-started)};
    }
    if (post.version !== input.expectedVersion) throw new ArticlePhotoOperationError("ARTICLE_CHANGED", stage, "The article version changed; existing text and media were preserved", state?.fileId);
    const articleHash = await hash(stableArticle(post));
    if (state && state.articleHash !== articleHash) throw new ArticlePhotoOperationError("ARTICLE_CHANGED", stage, "The article changed while the operation was paused", state.fileId);
    state ??= {version:1,identity,stage,expectedVersion:input.expectedVersion,articleHash}; await progress("upload");
    if (!state.etag) {
      // Replays use the owning service's principal-bound active upload session.
      // Same part/file is safe to transfer again after a lost PUT acknowledgement.
      const filename = `article-${identity}.${mime === "image/jpeg" ? "jpg" : mime.split("/")[1]}`;
      const reservation = await request("/v1/storage/signed-url/multipart/start", "POST", {
        filename,content_type:mime,size_bytes:bytes.length,visibility:"anonymous_visible",chunk_size:25*1024*1024,client_upload_key:identity,
        metadata:{purpose:"article-photo",publication_id:t.publicationId,article_id:input.articleId,operation_hash:identity,caption:input.caption,credit:input.credit,alt:input.alt,rights_confirmed:true,ai_generated:input.aiGenerated,label:input.label},
      });
      if ((state.fileId && state.fileId !== reservation.file_id) || reservation.total_parts !== 1) throw new ArticlePhotoOperationError("UPLOAD_SESSION_CHANGED", stage, "The original upload session expired or changed; no duplicate attachment was attempted", state.fileId);
      state.fileId = reservation.file_id; state.sessionId = reservation.upload_session_id; state.completionToken = reservation.completion_token; await progress("upload");
      const info = await request(`/v1/storage/files/${state.fileId}/info`);
      if (info.filename !== filename) throw new ArticlePhotoOperationError("UPLOAD_IDENTITY_MISMATCH", stage, "The upload session does not match these source bytes", state.fileId);
      const part = reservation.part_urls?.find((p: any) => p.part_number === 1);
      const u = new URL(part?.url); if (u.protocol !== "https:" || u.username || u.password) throw Error("Invalid managed upload destination");
      const response = await t.fetch(u,{method:"PUT",body:input.file,redirect:"error",signal:deadline});
      const etag = response.headers.get("etag"); await response.body?.cancel();
      if (!response.ok || !etag) throw Error("Managed upload did not acknowledge its part; resume this operation");
      state.etag = etag; await progress("complete");
    }
    if (!state.completed) {
      await request("/v1/storage/signed-url/multipart/complete","POST",{file_id:state.fileId,upload_session_id:state.sessionId,completion_token:state.completionToken,parts:[{part_number:1,etag:state.etag}]});
      state.completed = true; delete state.completionToken; await progress("scan");
    }
    for (;;) {
      const status = await request(`/v1/storage/files/${state.fileId}/status`);
      if (["threat","quarantined","error"].includes(status.scan?.status)) throw new ArticlePhotoOperationError("SCAN_REJECTED", stage, "Storage did not clear this image; the previous cover remains", state.fileId);
      if (status.scan?.status === "clean" && status.urls?.cdn_url) break;
      await sleep();
    }
    await progress("photo");
    if (!state.registered) {
      await request("/v1/photos/register","POST",{file_id:state.fileId,content_kind:"article",publication_id:t.publicationId});
      state.registered = true; await progress("renditions");
    }
    const [source,policy] = await Promise.all([request(`/v1/photos/public/${state.fileId}/manifest?preset=hero`),request(`/v1/photos/policies/article/editor?publication_id=${encodeURIComponent(t.publicationId)}`)]);
    if (source.file_id !== state.fileId || !Number.isInteger(source.width) || source.width <= 0) throw Error("Photo source identity or measured dimensions are missing");
    const requirements = ["lead","thumbnail","social"].flatMap(role => {
      const specs = policy.roles?.[role]?.renditions;
      if (!Array.isArray(specs) || !specs.length) throw Error("Publication Photo policy is incomplete");
      return specs.filter((r: any) => r.fit !== "scaledown" || r.width <= source.width).map((spec: any) => ({role,spec}));
    });
    if (!requirements.length || requirements.length > 48) throw Error("Publication Photo policy exceeds operation limits");
    const outputs: {role:string;file_id:string;url:string;width:number;height:number;format:string}[] = [];
    const preparations = new Map<string,Promise<any>>();
    let next = 0;
    await Promise.all(Array.from({length:Math.min(4,requirements.length)},async () => {
      while (next < requirements.length) {
        const {role,spec:r} = requirements[next++];
        if (!Number.isInteger(r.width) || r.width < 1 || r.width > 12000 || !["cover","contain","scaledown"].includes(r.fit) || !["jpeg","webp","avif"].includes(r.format) || !Number.isInteger(r.quality) || r.quality < 1 || r.quality > 100 || (r.height != null && (!Number.isInteger(r.height) || r.height < 1 || r.height > 12000))) throw Error("Invalid publication Photo policy");
        const key = `w${r.width}_h${r.height ?? 0}_${r.fit}_q${r.quality}_${r.format}`;
        let preparation = preparations.get(key);
        if (!preparation) {
          preparation = (async()=>{
        const path = `/v1/photos/public/${state!.fileId}/manifest?rendition=${key}`;
        let receipt = await request(path);
        if (!measured(receipt,state!.fileId!)) {
          const q = new URLSearchParams({width:String(r.width),fit:r.fit,quality:String(r.quality),format:r.format}); if(r.height)q.set("height",String(r.height));
          const response = await t.fetch(new URL(t.apiUrl.replace(/\/$/,"")+`/v1/photos/public/${state!.fileId}/transform?${q}`),{method:"GET",redirect:"manual",signal:deadline});
          const ok = (response.ok && response.headers.get("content-type")?.startsWith("image/")) || [302,303,307,308].includes(response.status); await response.body?.cancel();
          if (!ok) throw Error("Photo could not prepare a required rendition");
          while (!measured(receipt,state!.fileId!)) { receipt = await request(path); if (!measured(receipt,state!.fileId!)) await sleep(); }
        }
        return receipt;
          })();
          preparations.set(key,preparation);
        }
        const receipt = await preparation;
        outputs.push({role,file_id:state!.fileId!,url:receipt.url,width:receipt.width,height:receipt.height,format:r.format});
      }
    }));
    const leads = outputs.filter(o=>o.role==="lead").sort((a,b)=>a.width-b.width || a.format.localeCompare(b.format));
    const master = [...leads].reverse().find(o=>o.format==="webp") ?? leads.at(-1);
    const social = outputs.find(o=>o.role==="social" && o.format==="jpeg") ?? outputs.find(o=>o.role==="social");
    if (!master || !social || leads.length > 20) throw Error("Photo policy has no usable lead or social output");
    state.payload = {expected_version:state.expectedVersion,cover_image_url:master.url,og_image_url:social.url,
      cover_image:{file_id:state.fileId,master_url:master.url,width:master.width,height:master.height,aspect_ratio:`${master.width}:${master.height}`,alt:input.alt,caption:input.caption,attribution:input.credit,ai_generated:input.aiGenerated,label:input.label,focal_point:input.focalPoint??{x:0.5,y:0.5},variants:leads.map(({url,width,height,format})=>({url,width,height,format}))},
      open_graph_image:{file_id:state.fileId,url:social.url,width:social.width,height:social.height,aspect_ratio:`${social.width}:${social.height}`}};
    await progress("attach");
    const result = await request(`/articles/${encodeURIComponent(input.articleId)}/media`,"PUT",state.payload);
    state.attachedVersion = result.version; await progress("verify");
    const after = await request(postPath);
    if (!mediaMatches(after,state.payload) || await hash(stableArticle(after)) !== state.articleHash) throw new ArticlePhotoOperationError("VERIFICATION_CONFLICT",stage,"The current article differs from this operation; inspect it before making another change",state.fileId);
    await progress("verified");
    return {article_id:input.articleId,file_id:state.fileId,version:after.version,state:"verified",elapsed_ms:Math.round(performance.now()-started)};
  } catch(error) {
    if (error instanceof ArticlePhotoOperationError) throw error;
    throw new ArticlePhotoOperationError(deadline.aborted ? "DEADLINE_EXCEEDED" : "STEP_FAILED",stage,deadline.aborted ? "Operation reached its time limit; resume the same operation and checkpoint. Success was not asserted." : error instanceof Error ? error.message : "Article photo operation failed",state?.fileId);
  }
}
