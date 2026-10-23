import type { ArticleDocument } from "./article-workflow-client";
import { headlineProblems } from "./headline";
export type ArticleEditPatch = Partial<
  Pick<
    ArticleDocument,
    | "title"
    | "headline"
    | "fly_title"
    | "subtitle"
    | "seo_title"
    | "content_markdown"
    | "excerpt"
    | "section"
    | "community"
    | "format"
    | "layout"
    | "cards"
    | "citations"
    | "tag_ids"
  >
>;
export type ArticleEditCheckpoint = {
  version: 1;
  identity: string;
  articleId: string;
  stage: string;
  expectedGeneration?: number;
  document?: ArticleDocument;
  revisionId?: string;
  savedGeneration?: number;
  unchanged?: boolean;
  sourceIdentity?: {
    slug: string;
    published_at: string | null;
    canonical_url: string | null;
  };
};
export type ArticleEditInput = {
  articleId: string;
  operationKey: string;
  patch: ArticleEditPatch;
  expectedGeneration?: number;
  /** Explicit legacy onboarding only. Existing policies are never changed. */
  enableReviewPolicy?:
    | "NONE"
    | "FACT_CHECK"
    | "CONTRIBUTOR_REVIEW"
    | "SUBJECT_APPROVAL_REQUIRED"
    | "SUBJECT_APPROVAL_PLUS_EDITOR";
  /** Execute RELEASE under the caller's grants. Does not issue APPROVE. */
  release?: boolean;
  checkpoint?: ArticleEditCheckpoint;
  saveCheckpoint: (checkpoint: ArticleEditCheckpoint) => Promise<void>;
  timeoutMs?: number;
};
export class ArticleEditOperationError extends Error {
  constructor(
    public code: string,
    public stage: string,
    message: string,
    public status?: number,
    public revisionId?: string,
  ) {
    super(message);
    this.name = "ArticleEditOperationError";
  }
}
type Transport = {
  publicationId: string;
  request: <T = any>(
    path: string,
    method?: string,
    body?: unknown,
    extra?: HeadersInit,
    signal?: AbortSignal,
  ) => Promise<T>;
};
const canonical = (v: any): any =>
  Array.isArray(v)
    ? v.map(canonical)
    : v && typeof v === "object"
      ? Object.fromEntries(
          Object.keys(v)
            .sort()
            .map((k) => [k, canonical(v[k])]),
        )
      : v;
const equal = (a: unknown, b: unknown) =>
  JSON.stringify(canonical(a)) === JSON.stringify(canonical(b));
// Rust serializes UUID media identities in hyphenated lowercase form. Older
// immutable records may contain compact UUIDs. Compare only these typed identity
// fields semantically; prose, captions, ordering and all other fields stay exact.
const uuidIdentity = (value: unknown) => {
  if (typeof value !== "string" || !/^(?:[0-9a-f]{32}|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i.test(value)) return value;
  return value.replaceAll("-", "").toLowerCase();
};
const comparableDocument = (document: any) => document && typeof document === "object"
  ? { ...document, ...(Array.isArray(document.media) ? { media: document.media.map((media: any) => ({
      ...media, contribution_id: uuidIdentity(media.contribution_id), file_id: uuidIdentity(media.file_id),
    })) } : {}) }
  : document;
const documentsEqual = (a: unknown, b: unknown) => equal(comparableDocument(a), comparableDocument(b));
const digest = async (v: unknown) =>
  [
    ...new Uint8Array(
      await crypto.subtle.digest(
        "SHA-256",
        new TextEncoder().encode(JSON.stringify(canonical(v))),
      ),
    ),
  ]
    .map((v) => v.toString(16).padStart(2, "0"))
    .join("");
const patchKeys = new Set([
  "title",
  "headline",
  "fly_title",
  "subtitle",
  "seo_title",
  "content_markdown",
  "excerpt",
  "section",
  "community",
  "format",
  "layout",
  "cards",
  "citations",
  "tag_ids",
]);
function validate(input: ArticleEditInput) {
  if (
    !input.operationKey ||
    !/^[\w.:-]{1,128}$/u.test(input.operationKey) ||
    !input.articleId ||
    !input.patch ||
    typeof input.patch !== "object" ||
    Array.isArray(input.patch) ||
    !Object.keys(input.patch).length
  )
    throw Error(
      "Supply an article, stable operation key and nonempty editorial patch",
    );
  for (const [key, value] of Object.entries(input.patch)) {
    if (!patchKeys.has(key)) throw Error("Unsupported edit field: " + key);
    if (key === "tag_ids") {
      if (!Array.isArray(value) || value.length > 32 || new Set(value).size !== value.length || value.some(id => typeof id !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu.test(id) || /^0{8}-0{4}-0{4}-0{4}-0{12}$/u.test(id)))
        throw Error("tag_ids must contain at most 32 distinct, nonempty UUIDs");
    } else if (["cards", "citations"].includes(key)) {
      if (!Array.isArray(value)) throw Error(key + " must be an array");
    } else if (key === "layout") {
      if (
        !value ||
        typeof value !== "object" ||
        typeof (value as any).id !== "string" ||
        !Number.isInteger((value as any).version)
      )
        throw Error("Select an existing versioned layout");
    } else if (typeof value !== "string")
      throw Error(key + " must be a string");
  }
  const problems = headlineProblems(input.patch);
  if (problems.length) throw Error(problems.join("; "));
  if (
    input.expectedGeneration !== undefined &&
    (!Number.isSafeInteger(input.expectedGeneration) ||
      input.expectedGeneration < 1)
  )
    throw Error("Expected generation must be positive");
  if (
    input.enableReviewPolicy &&
    ![
      "NONE",
      "FACT_CHECK",
      "CONTRIBUTOR_REVIEW",
      "SUBJECT_APPROVAL_REQUIRED",
      "SUBJECT_APPROVAL_PLUS_EDITOR",
    ].includes(input.enableReviewPolicy)
  )
    throw Error("Select an explicit supported review policy");
  if (new TextEncoder().encode(JSON.stringify(input.patch)).length > 128 * 1024)
    throw Error("Editorial patch exceeds 128 KiB");
}
/** Bounded, checkpointed revision save using the existing Blog workflow and release gates. */
export async function runArticleEdit(t: Transport, input: ArticleEditInput) {
  validate(input);
  const started = performance.now();
  let stage = "preflight";
  const timeout = input.timeoutMs ?? 10000;
  if (!Number.isFinite(timeout) || timeout < 100 || timeout > 120000)
    throw Error("Edit deadline must be between 100 and 120000 milliseconds");
  const signal = AbortSignal.timeout(timeout);
  const request = <T = any>(
    path: string,
    method?: string,
    body?: unknown,
    extra?: HeadersInit,
  ) => t.request<T>(path, method, body, extra, signal);
  const identity = await digest([
    t.publicationId,
    input.articleId,
    input.operationKey,
    input.patch,
    input.expectedGeneration ?? null,
    input.enableReviewPolicy ?? null,
  ]);
  if (
    input.checkpoint &&
    (input.checkpoint.version !== 1 ||
      input.checkpoint.identity !== identity ||
      input.checkpoint.articleId !== input.articleId)
  )
    throw new ArticleEditOperationError(
      "OPERATION_CONFLICT",
      "validation",
      "This checkpoint belongs to different input; reuse its original patch and operation key",
    );
  let state: ArticleEditCheckpoint = input.checkpoint
    ? structuredClone(input.checkpoint)
    : { version: 1, identity, articleId: input.articleId, stage };
  const save = async (next: string) => {
    stage = next;
    state.stage = next;
    await input.saveCheckpoint(structuredClone(state));
  };
  const article = "/articles/" + encodeURIComponent(input.articleId);
  const currentRevision = (record: any) =>
    record.revisions?.find((v: any) => v.id === record.current_revision_id);
  const identityOf = (post: any) => ({
    slug: post.slug,
    published_at: post.published_at ?? null,
    canonical_url: post.canonical_url ?? null,
  });
  // First publication assigns a date/canonical URL; existing identities stay fixed.
  const identityMatches = (post: any) =>
    !state.sourceIdentity ||
    (state.sourceIdentity.slug === post.slug &&
      (state.sourceIdentity.published_at === null ||
        state.sourceIdentity.published_at === (post.published_at ?? null)) &&
      (state.sourceIdentity.canonical_url === null ||
        state.sourceIdentity.canonical_url === (post.canonical_url ?? null)));
  const result = (record: any, status: string) => ({
    article_id: input.articleId,
    revision_id: state.revisionId ?? record.current_revision_id,
    generation: record.generation,
    state: status,
    editorial_status: record.status,
    elapsed_ms: Math.round(performance.now() - started),
  });
  try {
    const [options, source, initial] = await Promise.all([
      request(
        "/article-workflow/options?article_id=" +
          encodeURIComponent(input.articleId),
      ),
      request(article + "/document"),
      request(article + "/collaboration").catch((error) => {
        if (
          error.status === 404 &&
          error.message === "Story collaboration is not enabled"
        )
          return null;
        throw error;
      }),
    ]);
    const headlineKeys = ["headline", "fly_title", "seo_title"].filter((key) => key in input.patch);
    if (headlineKeys.length && options.capabilities?.headline_set !== true)
      throw new ArticleEditOperationError(
        "CAPABILITY_UNAVAILABLE",
        "preflight",
        `The server must expose headline_set before editing ${headlineKeys.join(", ")}; no article was changed`,
      );
    if (
      options.workflow_version !== 1 ||
      options.capabilities?.versioned_editorial_fields !== true
    )
      throw new ArticleEditOperationError(
        "CAPABILITY_UNAVAILABLE",
        stage,
        "The server must expose versioned_editorial_fields before this edit; no article was changed",
      );
    if (input.patch.tag_ids !== undefined && options.capabilities?.versioned_editorial_tags !== true)
      throw new ArticleEditOperationError("CAPABILITY_UNAVAILABLE", stage, "The server must expose versioned_editorial_tags before changing tags; no article was changed");
    if (!identityMatches(source))
      throw new ArticleEditOperationError(
        "ARTICLE_IDENTITY_CHANGED",
        stage,
        "Article URL, publication date or canonical identity changed; inspect before continuing",
      );
    state.sourceIdentity ??= identityOf(source);
    let record = initial;
    if (!record) {
      if (!input.enableReviewPolicy)
        throw new ArticleEditOperationError(
          "ENROLLMENT_REQUIRED",
          stage,
          "Legacy article: choose an explicit review policy for versioned editorial onboarding; no content was changed",
        );
      if (source.status === "scheduled")
        throw new ArticleEditOperationError(
          "SCHEDULED_ARTICLE",
          stage,
          "Onboarding cancels an old schedule; handle this scheduled article explicitly",
        );
      await save("enroll");
      await request(article + "/collaboration/enable", "POST", {
        review_policy: input.enableReviewPolicy,
      });
      record = await request(article + "/collaboration");
    }
    if (state.revisionId) {
      if (record.current_revision_id !== state.revisionId)
        throw new ArticleEditOperationError(
          "ARTICLE_CHANGED",
          stage,
          "Another revision is current; this operation cannot release or overwrite it",
          409,
          state.revisionId,
        );
      const selected = currentRevision(record);
      if (!selected || !documentsEqual(selected.document, state.document))
        throw new ArticleEditOperationError(
          "VERIFICATION_CONFLICT",
          stage,
          "The saved revision differs from this operation",
          409,
          state.revisionId,
        );
    } else {
      if (!state.document) {
        if (
          input.expectedGeneration !== undefined &&
          record.generation !== input.expectedGeneration
        )
          throw new ArticleEditOperationError(
            "ARTICLE_CHANGED",
            stage,
            "The article generation changed; reload before applying this patch",
            409,
          );
        const selected = currentRevision(record);
        if (
          !selected?.complete_snapshot &&
          selected?.complete_snapshot !== undefined
        )
          throw new ArticleEditOperationError(
            "INCOMPLETE_REVISION",
            stage,
            "Inspect this historical revision before editing",
          );
        if (!selected?.document)
          throw Error("Current immutable article document is missing");
        const effective = { ...selected.document };
        for (const key of ["cards", "citations"])
          if (
            effective[key] === undefined &&
            selected.editorial_metadata?.[key] !== undefined
          )
            effective[key] = selected.editorial_metadata[key];
        if (
          effective.excerpt === undefined &&
          source.excerpt !== null &&
          source.excerpt !== undefined
        )
          effective.excerpt = source.excerpt;
        const changed = Object.entries(input.patch).some(
          ([key, value]) => !equal(effective[key], value),
        );
        if (!changed) {
          state.document = selected.document;
          state.revisionId = record.current_revision_id;
          state.savedGeneration = record.generation;
          state.unchanged = true;
          await save("verify");
          if (!input.release) return result(record, "unchanged");
        } else {
          const document = { ...selected.document, ...input.patch };
          if (
            document.excerpt === undefined &&
            source.excerpt !== null &&
            source.excerpt !== undefined
          )
            document.excerpt = source.excerpt;
          state.document = document;
          state.expectedGeneration = record.generation;
          await save("save");
        }
      }
      if (!state.revisionId) {
        const saved = await request(
          "/article-workflow",
          "POST",
          {
            operation: "save",
            article_id: input.articleId,
            expected_generation: state.expectedGeneration,
            document: state.document,
            reason: state.sourceIdentity?.published_at
              ? "POST_PUBLICATION_CORRECTION"
              : "EDITOR_EDIT",
          },
          { "Idempotency-Key": input.operationKey },
        );
        state.revisionId = saved.revision_id;
        state.savedGeneration = saved.generation;
        await save("verify");
        record = await request(article + "/collaboration");
        if (
          record.current_revision_id !== state.revisionId ||
          !documentsEqual(currentRevision(record)?.document, state.document)
        )
          throw new ArticleEditOperationError(
            "ARTICLE_CHANGED",
            stage,
            "A different revision is current; no release was attempted",
            409,
            state.revisionId,
          );
      }
    }
    if (record.published_revision_id === state.revisionId) {
      await save("published");
      return result(record, "already_published");
    }
    if (!input.release) {
      await save("saved");
      return result(record, state.unchanged ? "unchanged" : "saved_for_review");
    }
    await save("release");
    try {
      await request(article + "/collaboration", "POST", {
        action: "RELEASE",
        expected_generation: record.generation,
        scheduled_at: null,
      });
    } catch (error) {
      const checked = await request(article + "/collaboration");
      if (
        checked.published_revision_id === state.revisionId &&
        checked.current_revision_id === state.revisionId
      ) {
        record = checked;
      } else throw error;
    }
    record = await request(article + "/collaboration");
    if (
      record.current_revision_id !== state.revisionId ||
      record.published_revision_id !== state.revisionId
    )
      throw new ArticleEditOperationError(
        "VERIFICATION_CONFLICT",
        stage,
        "This exact revision has not been confirmed published",
        409,
        state.revisionId,
      );
    const after = await request(article + "/document");
    if (!identityMatches(after))
      throw new ArticleEditOperationError(
        "ARTICLE_IDENTITY_CHANGED",
        stage,
        "The release changed a permanent article identity",
        409,
        state.revisionId,
      );
    for (const key of ["title", "headline", "fly_title", "seo_title", "subtitle", "content_markdown", "excerpt"])
      if (
        state.document?.[key as keyof ArticleDocument] !== undefined &&
        !equal(after[key] ?? "", state.document[key as keyof ArticleDocument])
      )
        throw new ArticleEditOperationError(
          "VERIFICATION_CONFLICT",
          stage,
          "Public article field differs after release: " + key,
          409,
          state.revisionId,
        );
    if (state.document?.tag_ids && !equal([...state.document.tag_ids].sort(), (after.tags ?? []).map((tag: { id: string }) => tag.id).sort()))
      throw new ArticleEditOperationError("VERIFICATION_CONFLICT", stage, "Published tags differ from the saved revision", 409, state.revisionId);
    const normalizedCards = state.document?.cards;
    if (
      normalizedCards &&
      after.metadata?.cards?.length !== normalizedCards.length
    )
      throw new ArticleEditOperationError(
        "VERIFICATION_CONFLICT",
        stage,
        "Public card count differs from the saved revision",
        409,
        state.revisionId,
      );
    await save("published");
    return result(record, "published");
  } catch (error) {
    if (error instanceof ArticleEditOperationError) throw error;
    const status = (error as any)?.status;
    const message =
      error instanceof Error ? error.message : "Article edit failed";
    const code = signal.aborted
      ? "DEADLINE_EXCEEDED"
      : status === 401 || status === 403
        ? "PERMISSION_DENIED"
        : status === 409 && stage === "release"
          ? "RELEASE_HELD"
          : status === 409
            ? "ARTICLE_CHANGED"
            : "STEP_FAILED";
    throw new ArticleEditOperationError(
      code,
      stage,
      signal.aborted
        ? "Edit reached its deadline; resume the same patch, operation key and checkpoint. Success was not asserted."
        : message,
      status,
      state.revisionId,
    );
  }
}
