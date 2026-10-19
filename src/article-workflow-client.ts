import type { ArticleFormat } from "./article-presentation";
export type ArticleDocument = {
  title: string;
  subtitle?: string;
  content_markdown: string;
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
  caption: string;
  credit: string;
  alt: string;
  creator: string;
  who_is_pictured: string;
  when_taken: string;
  where_taken: string;
  rights_confirmed: boolean;
  private_preview_only?: boolean;
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
    return this.request<{
      workflow_version: number;
      formats: string[];
      layouts: unknown[];
      capabilities: { managed_private_asset_upload: boolean };
    }>(
      `/article-workflow/options${articleId ? `?article_id=${encodeURIComponent(articleId)}` : ""}`,
    );
  }
  get(articleId: string) {
    return this.request<Record>(
      `/articles/${encodeURIComponent(articleId)}/collaboration`,
    );
  }
  processing(articleId: string) {
    return this.request<{
      narration: { status: string; error_code?: string };
      visual: { status: string };
    }>(`/articles/${encodeURIComponent(articleId)}/processing`);
  }
  retryProcessing(
    articleId: string,
    expectedVersion: number,
    assetSourceFileId?: string,
  ) {
    return this.request(
      `/articles/${encodeURIComponent(articleId)}/processing`,
      "POST",
      {
        expected_version: expectedVersion,
        asset_source_file_id: assetSourceFileId,
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
  /** One agent operation over existing owners. Stops at conflicts/unknown upload acknowledgement;
   * replay the same operation key to inspect/reuse staged contributions before another transfer.
   * Editorial approval and release are always separate explicit operations. */
  async submitArticle(input: {
    operationKey: string;
    authorProfileId: string;
    document: ArticleDocument;
    reviewPolicy?: string;
    assets?: {
      file: Blob;
      filename: string;
      metadata: AssetMetadata;
      position: ArticleMedia["position"];
    }[];
    approveMedia?: boolean;
  }) {
    if (input.document.media?.length)
      throw new Error(
        "Pass file assets separately when creating an article package",
      );
    const capabilities = await this.options();
    if (capabilities.workflow_version !== 1)
      throw new Error("Unsupported article workflow version");
    if (
      input.assets?.length &&
      !capabilities.capabilities.managed_private_asset_upload
    )
      throw new Error("Managed article upload is not deployed");
    const created = await this.create(
      input.operationKey,
      input.authorProfileId,
      input.document,
      input.reviewPolicy,
    );
    try {
      const selected: ArticleMedia[] = [];
      for (const asset of input.assets ?? []) {
        let current = await this.get(created.article_id);
        const digest = Array.from(
          new Uint8Array(
            await crypto.subtle.digest(
              "SHA-256",
              await asset.file.arrayBuffer(),
            ),
          ),
        )
          .map((v) => v.toString(16).padStart(2, "0"))
          .join("");
        const existing = current.contributions.find(
          (c) =>
            c.kind === "MEDIA" &&
            c.state !== "REJECTED" &&
            c.state !== "WITHDRAWN" &&
            c.payload.sha256 === digest &&
            Object.entries(asset.metadata).every(
              ([k, v]) => c.payload[k as keyof AssetMetadata] === v,
            ),
        );
        const staged = existing?.payload.file_id
          ? { contribution_id: existing.id, file_id: existing.payload.file_id }
          : await this.upload(
              created.article_id,
              current.generation,
              asset.file,
              asset.filename,
              asset.metadata,
            );
        // Typed Photo registration and its versioned rendition policy use the
        // same normal caller authorization; no direct S3 or invented Photo ID.
        await this.registerPhoto(staged.file_id);
        if (input.approveMedia) {
          if (
            !asset.metadata.rights_confirmed ||
            asset.metadata.private_preview_only
          )
            throw new Error("Publication requires confirmed image rights");
          if (existing?.state !== "APPROVED") {
            current = await this.get(created.article_id);
            await this.command(created.article_id, current.generation, {
              action: "RESOLVE",
              contribution_id: staged.contribution_id,
              state: "APPROVED",
            });
          }
          selected.push({
            kind: "image",
            contribution_id: staged.contribution_id,
            file_id: staged.file_id,
            caption: asset.metadata.caption,
            credit: asset.metadata.credit,
            alt: asset.metadata.alt,
            position: asset.position,
          });
        }
      }
      if (selected.length) {
        const current = await this.get(created.article_id);
        const document = { ...input.document, media: selected };
        const saved = current.revisions.find(
          (r) => r.id === current.current_revision_id,
        )?.document;
        // Let the server perform semantic no-op detection and optimistic concurrency.
        if (!saved) throw new Error("Current immutable revision is missing");
        if (sameDocument(saved, document))
          return {
            ...created,
            revision_id: current.current_revision_id,
            generation: current.generation,
            editorial_status: current.status,
            replayed: true,
          };
        if (
          !sameDocument(
            { ...saved, media: [] },
            { ...input.document, media: [] },
          ) ||
          saved.media?.length
        )
          throw new ArticleWorkflowError(
            "The article was edited after this package began; load its current revision before changing it",
            409,
            created.article_id,
          );
        return await this.save(
          `${input.operationKey}:assets`,
          created.article_id,
          current.generation,
          document,
          "MEDIA_UPDATE",
        );
      }
      return created;
    } catch (error) {
      if (error instanceof ArticleWorkflowError) {
        error.articleId = created.article_id;
        throw error;
      }
      throw new ArticleWorkflowError(
        error instanceof Error ? error.message : "Article package interrupted",
        0,
        created.article_id,
      );
    }
  }
}

function sameDocument(a: ArticleDocument, b: ArticleDocument): boolean {
  const canonical = (d: ArticleDocument) => [
    d.title,
    d.subtitle || "",
    d.content_markdown,
    d.section,
    d.community || "",
    d.format || null,
    d.layout ? [d.layout.id, d.layout.version] : null,
    (d.media || []).map((m) => [
      m.kind || "image",
      m.contribution_id,
      m.file_id,
      m.caption,
      m.credit,
      m.alt,
      m.position,
    ]),
  ];
  return JSON.stringify(canonical(a)) === JSON.stringify(canonical(b));
}
