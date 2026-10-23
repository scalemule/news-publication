export { articlePhotoHtmlMatches } from "./article-photo-verification";
export { articleEditHtmlMatches } from "./article-edit-verification";
import type { ArticleFormat, ArticleLayout } from "./article-presentation";
import { runArticlePhoto, type ArticlePhotoInput } from "./article-photo-operation";
import { runArticleEdit, type ArticleEditInput } from "./article-edit-operation";
export { ArticleEditOperationError, type ArticleEditInput, type ArticleEditCheckpoint, type ArticleEditPatch } from "./article-edit-operation";
export { ArticlePhotoOperationError, type ArticlePhotoInput, type PhotoOperationCheckpoint } from "./article-photo-operation";
export type ArticleDocument = {
  title: string;
  /** Short display headline (<= 120 characters, 70 recommended); see `headlineSet`. */
  headline?: string;
  /** Kicker above the headline (<= 40 characters). */
  fly_title?: string;
  /** The rubric (deck). */
  subtitle?: string;
  /** Search title for <title> and previews. */
  seo_title?: string;
  content_markdown: string;
  excerpt?: string;
  cards?: unknown[];
  citations?: unknown[];
  tag_ids?: string[];
  section: string;
  community?: string;
  format?: ArticleFormat;
  layout?: { id: string; version: number };
  media?: ArticleMedia[];
};
export type ArticleMedia = {
  kind?: "image" | "video";
  contribution_id: string;
  file_id: string;
  caption: string;
  credit: string;
  alt: string;
  position: "hero" | "inline" | "gallery" | "attachment";
};
export type AssetMetadata = {
  caption?: string;
  credit?: string;
  alt?: string;
  creator?: string;
  who_is_pictured?: string;
  when_taken?: string;
  where_taken?: string;
  rights_confirmed: boolean;
  private_preview_only?: boolean;
};
export type PublishedCoverReplacement = {
  articleId: string;
  expectedVersion: number;
  /** A real, already public Photo/Storage ID, never an invented ID or URL. */
  fileId: string;
  rightsConfirmed: boolean;
  caption: string;
  credit: string;
  alt: string;
  aiGenerated: boolean;
  label: string | null;
  focalPoint?: { x: number; y: number };
  /** Metadata lookup key only; no rendition URL or dimensions are inferred. */
  socialRenditionKey?: string;
};
type PublicPhotoManifest = {
  file_id: string;
  photo_id: string;
  ready: boolean;
  variant_metadata: { [key: string]: { url: string; width: number; height: number; format: string } };
};
type PublicRendition = {
  file_id: string;
  photo_id: string;
  ready: boolean;
  url?: string;
  width?: number;
  height?: number;
};
export type ArticleProcessing = {
  article_id: string;
  version: number;
  publication_status: string;
  narration: {
    status: string;
    attempts?: number | null;
    audio_id?: string | null;
    job_id?: string | null;
    profile_override_version?: number | null;
    work_priority?: number | null;
    error_code?: string | null;
    last_progress_at?: string | null;
  };
  visual: { status: string; provider: string; policy_governed: boolean };
  assets: {
    source_file_id: string;
    public_file_id: string;
    status: string;
    attempts: number;
    error_code?: string | null;
    last_progress_at: string;
  }[];
};
export type ArticleWorkflowOptions = {
  workflow_version: number;
  profile_version: number;
  formats: ArticleFormat[];
  layouts: {
    definition: ArticleLayout;
    visual_requirements: {
      hero_aspect: string;
      mobile_aspect: string;
      share_aspect: string;
    };
  }[];
  sections: string[];
  language: string;
  narration?: {
    provider: string;
    model: string;
    voice: string;
    required_before_publish: boolean;
  } | null;
  capabilities: {
    managed_private_asset_upload: boolean;
    inline_media_body?: boolean;
    automatic_public_narration?: boolean;
    prioritized_narration_processing?: boolean;
    content_first_editor_document?: boolean;
    versioned_editorial_fields?: boolean;
    versioned_editorial_tags?: boolean;
    managed_submission_version?: number | null;
    multipart_submission?: boolean;
  };
};
export type ArticleOperation = {
  article_id: string;
  revision_id: string;
  generation: number;
  editorial_status: string;
  permalink_path: string;
  replayed: boolean;
};
type Record = {
  post_id: string;
  current_revision_id: string;
  generation: number;
  status: string;
  revisions: { id: string; document: ArticleDocument }[];
  contributions: {
    id: string;
    kind: string;
    state: string;
    payload: Partial<AssetMetadata> & { file_id?: string; sha256?: string };
  }[];
};
export type ArticleSubmissionManifest = {
  article: { operation: "create"; author_profile_id: string; document: ArticleDocument; review_policy?: string; celebration_type?: string }
    | { operation: "save"; article_id: string; expected_generation: number; document: ArticleDocument; reason: string };
  intent?: "draft" | "review" | "publish";
  approve_media?: boolean;
  sensitivity_review?: { policy_version: string; rule_ids: string[]; reason: string };
  assets?: { slot: string; position: "hero" | "gallery" | "attachment"; metadata: AssetMetadata }[];
};
export type ArticleSubmissionReceipt = {
  submission_id: string; article_id: string | null; revision_id: string | null;
  status: "intake" | "queued" | "scanning" | "narrating" | "awaiting_review" | "held" | "complete" | "published";
  error_code: string | null; status_path: string; permalink_path: string | null;
  processing: ArticleProcessing | null;
  progress: { intent: string; assets: { [slot: string]: { state: string; contribution_id?: string; file_id?: string } } };
  accepted_is_not_published: true;
  public_ready: boolean;
  next_action: string;
};
export class ArticleWorkflowError extends Error {
  constructor(
    message: string,
    public status: number,
    public articleId?: string,
  ) {
    super(message);
    this.name = "ArticleWorkflowError";
  }
}
/** Server/CLI client. Credentials belong to the caller and are never embedded in a publication bundle. */
export class PublicationArticleClient {
  private base: string;
  constructor(
    private config: {
      apiUrl: string;
      publicationId: string;
      apiKey?: string;
      accessToken?: string;
      applicationId?: string;
      fetch?: typeof fetch;
    },
  ) {
    const url = new URL(config.apiUrl);
    if (
      url.protocol !== "https:" &&
      !["localhost", "127.0.0.1"].includes(url.hostname)
    )
      throw new Error("Use an HTTPS API endpoint");
    this.base =
      config.apiUrl.replace(/\/$/, "") +
      `/v1/blog/publications/${encodeURIComponent(config.publicationId)}`;
  }
  private async request<T>(
    path: string,
    method = "GET",
    body?: unknown,
    extra?: HeadersInit,
    signal?: AbortSignal,
  ): Promise<T> {
    const headers = new Headers(extra);
    headers.set("accept", "application/json");
    if (this.config.apiKey) headers.set("x-api-key", this.config.apiKey);
    if (this.config.accessToken)
      headers.set("authorization", `Bearer ${this.config.accessToken}`);
    const form = body instanceof FormData;
    if (body !== undefined && !form)
      headers.set("content-type", "application/json");
    const url = new URL(
      path.startsWith("/v1/")
        ? this.config.apiUrl.replace(/\/$/, "") + path
        : this.base + path,
    );
    if (this.config.applicationId)
      url.searchParams.set("application_id", this.config.applicationId);
    const response = await (this.config.fetch ?? fetch)(url, {
      method,
      headers,
      body:
        body === undefined
          ? undefined
          : form
            ? (body as FormData)
            : JSON.stringify(body),
      signal: signal ?? AbortSignal.timeout(form ? 90_000 : 30_000),
      cache: "no-store",
      redirect: "error",
    });
    const value = await response.json();
    if (!response.ok || value.success !== true || value.data == null)
      throw new ArticleWorkflowError(
        value.error?.message || `Article API returned ${response.status}`,
        response.status,
      );
    return value.data;
  }
  options(articleId?: string) {
    return this.request<ArticleWorkflowOptions>(
      `/article-workflow/options${articleId ? `?article_id=${encodeURIComponent(articleId)}` : ""}`,
    );
  }
  publicArticle(slug:string,signal?:AbortSignal){
    return this.request<any>('/article-content/'+encodeURIComponent(slug),undefined,undefined,undefined,signal);
  }
  /** Explicit approver-authorized onboarding for a legacy article; never called by get().
   * Existing schedules are cancelled by the server; public content remains unchanged.
   * Missing immutable media identities must be resolved through newsroom media controls.
   */
  enableCollaboration(
    articleId: string,
    reviewPolicy: "NONE" | "FACT_CHECK" | "CONTRIBUTOR_REVIEW" | "SUBJECT_APPROVAL_REQUIRED" | "SUBJECT_APPROVAL_PLUS_EDITOR",
  ) {
    return this.request<{ post_id: string; existing?: boolean; current_revision_id?: string }>(
      `/articles/${encodeURIComponent(articleId)}/collaboration/enable`,
      "POST",
      { review_policy: reviewPolicy },
    );
  }
  get(articleId: string) {
    return this.request<Record>(
      `/articles/${encodeURIComponent(articleId)}/collaboration`,
    );
  }
  processing(articleId: string, signal?: AbortSignal) {
    return this.request<ArticleProcessing>(
      `/articles/${encodeURIComponent(articleId)}/processing`, undefined, undefined, undefined, signal,
    );
  }
  uploadAndReplacePublishedCover(input: ArticlePhotoInput) {
    return runArticlePhoto({ publicationId:this.config.publicationId, apiUrl:this.config.apiUrl, fetch:this.config.fetch ?? fetch, request:this.request.bind(this) },input);
  }
  /** Save one exact revision; release is explicit and never manufactures approval. */
  editArticle(input: ArticleEditInput) {
    return runArticleEdit({publicationId:this.config.publicationId,request:this.request.bind(this)},input);
  }
  /** Replace a legacy publication cover using ready, measured public Photo renditions.
   * This never enrolls a story, publishes text, creates narration or retries a conflict.
   * Collaboration-managed stories retain their server-enforced immutable revision workflow.
   */
  async replacePublishedCover(input: PublishedCoverReplacement) {
    if (!Number.isSafeInteger(input.expectedVersion) || input.expectedVersion < 1)
      throw new Error("Use the current public-projection version from processing()");
    if (input.rightsConfirmed !== true || !input.alt.trim())
      throw new Error("Confirm publication rights and supply factual image alt text");
    if (input.aiGenerated && !input.label?.trim())
      throw new Error("Generated art requires its internal provenance label");
    const focal = input.focalPoint ?? { x: 0.5, y: 0.5 };
    if (![focal.x, focal.y].every(v => Number.isFinite(v) && v >= 0 && v <= 1))
      throw new Error("Focal point must be within the image");
    const photo = `/v1/photos/public/${encodeURIComponent(input.fileId)}/manifest`;
    const socialKey = input.socialRenditionKey ?? "w1200_h630_cover_q85_jpeg";
    const socialPath = `${photo}?rendition=${encodeURIComponent(socialKey)}`;
    const [current, hero, initialSocial] = await Promise.all([
      this.processing(input.articleId),
      this.request<PublicPhotoManifest>(`${photo}?preset=hero`),
      this.request<PublicRendition>(socialPath),
    ]);
    if (current.publication_status !== "published" || current.version !== input.expectedVersion)
      throw new ArticleWorkflowError("Article is not published or its version changed; reload before updating its cover", 409, input.articleId);
    let social = initialSocial;
    if (hero.ready && [hero.file_id, hero.photo_id].includes(input.fileId) && !social.ready && social.file_id === hero.file_id) {
      // Materialize through Photo's normal guarded public transform. Its measured
      // manifest, never this requested size or a guessed URL, authorizes attachment.
      const spec = /^w(\d+)_h(\d+)_(cover|contain|fill|scaledown)_q(\d+)_(jpeg|webp|avif)$/.exec(socialKey);
      if (spec && Number(spec[1]) > 0 && Number(spec[1]) <= 12000 && Number(spec[2]) > 0 && Number(spec[2]) <= 12000 && Number(spec[4]) > 0 && Number(spec[4]) <= 100) {
        const query = new URLSearchParams({ width: spec[1], height: spec[2], fit: spec[3], quality: spec[4], format: spec[5] });
        const url = new URL(this.config.apiUrl.replace(/\/$/, "") + `/v1/photos/public/${encodeURIComponent(input.fileId)}/transform?${query}`);
        const response = await (this.config.fetch ?? fetch)(url, { method: "GET", redirect: "manual", cache: "no-store", signal: AbortSignal.timeout(30_000) });
        const accepted = (response.ok && response.headers.get("content-type")?.startsWith("image/")) || [302, 303, 307, 308].includes(response.status);
        await response.body?.cancel();
        if (accepted) social = await this.request<PublicRendition>(socialPath);
      }
    }
    const dimension = (v: unknown): v is number => Number.isInteger(v) && Number(v) > 0 && Number(v) <= 12000;
    const publicUrl = (raw: string) => {
      try {
        const url = new URL(raw);
        return url.protocol === "https:" && !url.username && !url.password && !url.search && !url.hash;
      } catch { return false; }
    };
    const variants = Object.values(hero.variant_metadata ?? {});
    if (!hero.ready || !social.ready || !hero.file_id ||
        ![hero.file_id, hero.photo_id].includes(input.fileId) || social.file_id !== hero.file_id ||
        !variants.length || variants.length > 20 || variants.some(v =>
          !dimension(v.width) || !dimension(v.height) || !publicUrl(v.url) || !["jpeg", "webp", "avif"].includes(v.format)) ||
        !dimension(social.width) || !dimension(social.height) || !social.url || !publicUrl(social.url))
      throw new ArticleWorkflowError("Public Photo renditions are not ready with measured dimensions; inspect Photo processing, keep the existing cover and resume with the same asset", 409, input.articleId);
    // Choose a real rendition; never infer an object's address or crop dimensions.
    const ordered = [...variants].sort((a, b) => a.width - b.width);
    const master = [...ordered].reverse().find(v => v.width <= 1600) ?? ordered[0];
    return this.request<{ post_id: string; version: number; cover_image_url: string; og_image_url: string }>(
      `/articles/${encodeURIComponent(input.articleId)}/media`, "PUT", {
        expected_version: input.expectedVersion,
        cover_image_url: master.url,
        og_image_url: social.url,
        cover_image: {
          file_id: hero.file_id, master_url: master.url, width: master.width, height: master.height,
          aspect_ratio: `${master.width}:${master.height}`, alt: input.alt,
          caption: input.caption, attribution: input.credit, ai_generated: input.aiGenerated,
          label: input.label, focal_point: focal, variants,
        },
        open_graph_image: {
          file_id: hero.file_id, url: social.url, width: social.width, height: social.height,
          aspect_ratio: `${social.width}:${social.height}`,
        },
      },
    );
  }
  /** Existing private narration path for a saved revision and a before-publication audio policy. */
  narrateRevision(articleId: string, expectedGeneration: number) {
    return this.request<{
      status: string;
      audio_id?: string | null;
      job_id?: string | null;
    }>(
      `/articles/${encodeURIComponent(articleId)}/collaboration/narrate`,
      "POST",
      { expected_generation: expectedGeneration },
    );
  }
  /** Prioritize existing active Blog processing; never resets paid work or raises TTS limits. */
  expediteNarration(articleId: string, expectedVersion: number) {
    return this.request(
      `/articles/${encodeURIComponent(articleId)}/processing`,
      "POST", { expected_version: expectedVersion, expedite: true },
    );
  }
  retryProcessing(
    articleId: string,
    expectedVersion: number,
    assetSourceFileId?: string,
    narrationProfileVersion?: number,
  ) {
    return this.request(
      `/articles/${encodeURIComponent(articleId)}/processing`,
      "POST",
      {
        expected_version: expectedVersion,
        asset_source_file_id: assetSourceFileId,
        narration_profile_version: narrationProfileVersion,
      },
    );
  }
  create(
    key: string,
    authorProfileId: string,
    document: ArticleDocument,
    reviewPolicy = "SUBJECT_APPROVAL_PLUS_EDITOR",
  ) {
    return this.request<ArticleOperation>(
      "/article-workflow",
      "POST",
      {
        operation: "create",
        author_profile_id: authorProfileId,
        document,
        review_policy: reviewPolicy,
      },
      { "Idempotency-Key": key },
    );
  }
  save(
    key: string,
    articleId: string,
    generation: number,
    document: ArticleDocument,
    reason = "EDITOR_EDIT",
  ) {
    return this.request<ArticleOperation>(
      "/article-workflow",
      "POST",
      {
        operation: "save",
        article_id: articleId,
        expected_generation: generation,
        document,
        reason,
      },
      { "Idempotency-Key": key },
    );
  }
  command(articleId: string, generation: number, action: object) {
    return this.request(
      `/articles/${encodeURIComponent(articleId)}/collaboration`,
      "POST",
      { ...action, expected_generation: generation },
    );
  }
  registerPhoto(fileId: string) {
    return this.request<{ id?: string; status?: string }>(
      `/v1/photos/${this.config.applicationId ? "admin/register" : "register"}`,
      "POST",
      {
        file_id: fileId,
        content_kind: "article",
        publication_id: this.config.publicationId,
        ...(this.config.applicationId
          ? { application_id: this.config.applicationId }
          : {}),
      },
    );
  }
  upload(
    articleId: string,
    generation: number,
    file: Blob,
    filename: string,
    metadata: AssetMetadata,
  ) {
    const body = new FormData();
    body.set("metadata", JSON.stringify(metadata));
    body.set("file", file, filename);
    return this.request<{
      contribution_id: string;
      file_id: string;
      kind: "image";
      state: "OPEN";
    }>(`/articles/${encodeURIComponent(articleId)}/assets`, "POST", body, {
      "If-Match": String(generation),
    });
  }
  /** One server-owned submission. No client-side Photo/TTS orchestration and no
   * fallback to a different workflow. A 202 receipt is acceptance, not readiness.
   * Replay the identical manifest/files/key after an uncertain acknowledgement.
   */
  submit(manifest: ArticleSubmissionManifest, operationKey: string,
    files: { slot: string; file: Blob; filename: string }[] = [], signal?: AbortSignal) {
    if (!operationKey) throw new Error("A stable operation key is required");
    if(files.length>10 || files.some(f=>f.file.size<1||f.file.size>25*1024*1024) || files.reduce((n,f)=>n+f.file.size,0)>50*1024*1024) throw new Error("Supply up to ten photographs, at most 25 MiB each and 50 MiB total");
    const slots = new Set(files.map(f => f.slot));
    if (slots.size !== files.length || files.length !== (manifest.assets?.length ?? 0)
      || manifest.assets?.some(a => !slots.has(a.slot))) throw new Error("Supply one file for each declared asset slot");
    if (!files.length) return this.request<ArticleSubmissionReceipt>("/submissions", "POST", manifest, { "Idempotency-Key": operationKey }, signal);
    const form = new FormData(); form.append("manifest", JSON.stringify(manifest));
    for (const asset of files) form.append(asset.slot, asset.file, asset.filename);
    return this.request<ArticleSubmissionReceipt>("/submissions", "POST", form, { "Idempotency-Key": operationKey }, signal);
  }
  submission(submissionId: string, signal?: AbortSignal) {
    return this.request<ArticleSubmissionReceipt>("/submissions/"+encodeURIComponent(submissionId),"GET",undefined,undefined,signal);
  }
  submitArticle(input: {
    operationKey: string; authorProfileId: string; document: ArticleDocument;
    reviewPolicy?: string; intent?: "draft" | "review" | "publish";
    assets?: { file: Blob; filename: string; metadata: AssetMetadata; position: "hero" | "gallery" | "attachment" }[];
    approveMedia?: boolean;
  }) {
    if (input.document.media?.length) throw new Error("Pass file assets separately when creating an article package");
    // Slot names are stable for identical file order and survive an HTTP retry.
    const assets=(input.assets ?? []).map((a,i)=>({...a,slot:"asset_"+String.fromCharCode(97+i)}));
    return this.submit({ article:{ operation:"create",author_profile_id:input.authorProfileId,document:input.document,review_policy:input.reviewPolicy },
      intent:input.intent ?? "draft",approve_media:input.approveMedia,
      assets:assets.map(a=>({slot:a.slot,position:a.position,metadata:a.metadata})) },input.operationKey,assets);
  }
}
