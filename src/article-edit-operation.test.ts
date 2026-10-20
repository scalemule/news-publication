import { describe, it, expect, vi } from "vitest";
import {
  PublicationArticleClient,
  type ArticleEditCheckpoint,
  type ArticleEditInput,
} from "./article-workflow-client";

function fixture() {
  const original = {
    title: "Local reporting",
    subtitle: "Original dek",
    content_markdown: "Verified reporting. София 李 📰",
    section: "Business",
    community: "San Ramon",
    format: "news",
    layout: { id: "standard", version: 1 },
    media: [
      {
        kind: "image",
        contribution_id: "contribution",
        file_id: "real-file",
        position: "hero",
        caption: "Existing caption",
        credit: "Existing credit",
        alt: "Actual venue",
      },
    ],
  };
  let record: any = {
    current_revision_id: "r1",
    published_revision_id: "r1",
    generation: 4,
    status: "PUBLISHED",
    review_policy: "FACT_CHECK",
    revisions: [
      {
        id: "r1",
        complete_snapshot: true,
        document: original,
        editorial_metadata: {},
      },
    ],
  };
  let source: any = {
    id: "article",
    slug: "permanent-slug",
    published_at: "2026-10-19T12:00:00Z",
    canonical_url: "https://paper.example.org/news/permanent-slug",
    excerpt: "Keep this excerpt",
    ...original,
    metadata: {},
    status: "published",
  };
  let checkpoint: ArticleEditCheckpoint | undefined;
  let enabled = true,
    capability = true,
    hold = false,
    lostSave = false,
    lostRelease = false,
    deny = false;
  let saves = 0,
    releases = 0,
    enrolls = 0;
  const receipts = new Map<string, { request: unknown; response: unknown }>();
  const reply = (data: any, status = 200) =>
    new Response(
      JSON.stringify(
        status === 200
          ? { success: true, data }
          : { success: false, error: { message: data } },
      ),
      { status, headers: { "content-type": "application/json" } },
    );
  const transport = vi.fn(async (raw: any, init?: RequestInit) => {
    const path = new URL(String(raw)).pathname;
    if (init?.signal?.aborted) throw init.signal.reason;
    if (deny) return reply("Permission denied", 403);
    if (path.endsWith("/options"))
      return reply({
        workflow_version: 1,
        capabilities: { versioned_editorial_fields: capability },
      });
    if (path.endsWith("/document")) return reply(source);
    if (path.endsWith("/enable")) {
      enrolls++;
      enabled = true;
      return reply({ post_id: "article" });
    }
    if (path.endsWith("/article-workflow")) {
      const body = JSON.parse(String(init?.body)),
        key = new Headers(init?.headers).get("idempotency-key")!;
      const old = receipts.get(key);
      if (old) {
        expect(body).toEqual(old.request);
        return reply(old.response);
      }
      if (body.expected_generation !== record.generation)
        return reply("Article changed", 409);
      saves++;
      record = {
        ...record,
        current_revision_id: "r" + (saves + 1),
        generation: record.generation + 1,
        status: "CORRECTION_PENDING",
        revisions: [
          {
            id: "r" + (saves + 1),
            complete_snapshot: true,
            document: body.document,
            editorial_metadata: {
              cards: body.document.cards,
              citations: body.document.citations,
            },
          },
          ...record.revisions,
        ],
      };
      const result = {
        revision_id: record.current_revision_id,
        generation: record.generation,
      };
      receipts.set(key, { request: body, response: result });
      if (lostSave) {
        lostSave = false;
        throw new TypeError("Lost save acknowledgement");
      }
      return reply(result);
    }
    if (path.endsWith("/collaboration")) {
      if (!enabled) return reply("Story collaboration is not enabled", 404);
      if (init?.method === "POST") {
        const body = JSON.parse(String(init.body));
        expect(body.action).toBe("RELEASE");
        expect(body.expected_generation).toBe(record.generation);
        if (hold) return reply("Approve the exact current revision first", 409);
        releases++;
        record.published_revision_id = record.current_revision_id;
        record.status = "PUBLISHED";
        record.generation++;
        const doc = record.revisions[0].document;
        source = {
          ...source,
          ...doc,
          published_at: source.published_at ?? "2026-10-20T16:00:00Z",
          canonical_url:
            source.canonical_url ??
            "https://paper.example.org/news/permanent-slug",
          metadata: {
            ...source.metadata,
            cards: doc.cards,
            citations: doc.citations,
          },
        };
        if (lostRelease) {
          lostRelease = false;
          throw new TypeError("Lost release acknowledgement");
        }
        return reply({});
      }
      return reply(record);
    }
    throw Error("Unexpected endpoint " + path);
  });
  const client = new PublicationArticleClient({
    apiUrl: "https://api.example.org",
    publicationId: "publication",
    apiKey: "normal-project-key",
    accessToken: "member-jwt",
    fetch: transport as typeof fetch,
  });
  const input = (): ArticleEditInput => ({
    articleId: "article",
    operationKey: "correction-v1",
    patch: {
      subtitle: "Corrected dek София 李 📰",
      cards: [
        { id: "event", card_type: "EVENT", title: "Boots to Business" },
        { id: "venue", card_type: "PLACE", title: "Actual conference center" },
      ],
      citations: [
        { url: "https://example.org/source", title: "Official source" },
      ],
    },
    checkpoint,
    saveCheckpoint: async (v) => {
      checkpoint = structuredClone(v);
    },
  });
  return {
    client,
    input,
    original,
    transport,
    get checkpoint() {
      return checkpoint;
    },
    get record() {
      return record;
    },
    get source() {
      return source;
    },
    get counts() {
      return { saves, releases, enrolls };
    },
    legacy: () => {
      enabled = false;
    },
    missingCapability: () => {
      capability = false;
    },
    hold: () => {
      hold = true;
    },
    clearHold: () => {
      hold = false;
    },
    lostSave: () => {
      lostSave = true;
    },
    lostRelease: () => {
      lostRelease = true;
    },
    deny: () => {
      deny = true;
    },
    concurrentEdit: () => {
      record = {
        ...record,
        current_revision_id: "someone-elses-revision",
        generation: record.generation + 1,
      };
    },
  };
}

describe("repeatable versioned article editing", () => {
  it("saves prose, cards and citations together without publishing or changing unrelated media", async () => {
    const f = fixture();
    const result = await f.client.editArticle(f.input());
    expect(result.state).toBe("saved_for_review");
    expect(f.counts).toEqual({ saves: 1, releases: 0, enrolls: 0 });
    expect(f.record.revisions[0].document).toMatchObject({
      ...f.original,
      subtitle: "Corrected dek София 李 📰",
      excerpt: "Keep this excerpt",
    });
    expect(f.record.revisions[0].document.cards).toHaveLength(2);
    expect(f.source.subtitle).toBe("Original dek");
  });
  it("explicit release and completed replay retain one revision and one release", async () => {
    const f = fixture();
    expect(
      (await f.client.editArticle({ ...f.input(), release: true })).state,
    ).toBe("published");
    expect(
      (await f.client.editArticle({ ...f.input(), release: true })).state,
    ).toBe("already_published");
    expect(f.counts).toEqual({ saves: 1, releases: 1, enrolls: 0 });
    expect(f.source.slug).toBe("permanent-slug");
    expect(f.source.published_at).toBe("2026-10-19T12:00:00Z");
  });
  it("retains a saved revision at a review hold and resumes after real external approval", async () => {
    const f = fixture();
    f.hold();
    await expect(
      f.client.editArticle({ ...f.input(), release: true }),
    ).rejects.toMatchObject({ code: "RELEASE_HELD", revisionId: "r2" });
    expect(f.counts.releases).toBe(0);
    f.clearHold();
    await f.client.editArticle({ ...f.input(), release: true });
    expect(f.counts.saves).toBe(1);
    expect(
      f.transport.mock.calls.every(
        ([, init]) => !String(init?.body).includes('"action":"APPROVE"'),
      ),
    ).toBe(true);
  });
  it("allows a draft's first publication identity and then replays without a second save/release", async () => {
    const f = fixture();
    f.source.published_at = null;
    f.source.canonical_url = null;
    f.source.status = "draft";
    f.record.published_revision_id = null;
    expect(
      (await f.client.editArticle({ ...f.input(), release: true })).state,
    ).toBe("published");
    expect(
      (await f.client.editArticle({ ...f.input(), release: true })).state,
    ).toBe("already_published");
    expect(f.counts).toEqual({ saves: 1, releases: 1, enrolls: 0 });
  });
  it("stops if an established publication date changes after a saved correction", async () => {
    const f = fixture();
    await f.client.editArticle(f.input());
    f.source.published_at = "2026-10-20T16:00:00Z";
    await expect(
      f.client.editArticle({ ...f.input(), release: true }),
    ).rejects.toMatchObject({ code: "ARTICLE_IDENTITY_CHANGED" });
    expect(f.counts.releases).toBe(0);
  });
  it("stops stale generations and subsequent edits without overwriting", async () => {
    const f = fixture();
    await expect(
      f.client.editArticle({ ...f.input(), expectedGeneration: 3 }),
    ).rejects.toMatchObject({ code: "ARTICLE_CHANGED" });
    expect(f.counts.saves).toBe(0);
    await f.client.editArticle(f.input());
    f.concurrentEdit();
    await expect(
      f.client.editArticle({ ...f.input(), release: true }),
    ).rejects.toMatchObject({ code: "ARTICLE_CHANGED" });
    expect(f.counts.releases).toBe(0);
  });
  it("requires explicit legacy policy, then uses the normal enrollment and immutable save", async () => {
    const f = fixture();
    f.legacy();
    await expect(f.client.editArticle(f.input())).rejects.toMatchObject({
      code: "ENROLLMENT_REQUIRED",
    });
    expect(f.counts.enrolls).toBe(0);
    await f.client.editArticle({
      ...f.input(),
      enableReviewPolicy: "FACT_CHECK",
    });
    expect(f.counts).toEqual({ saves: 1, enrolls: 1, releases: 0 });
  });
  it("requires deployed field support before any enrollment or mutation", async () => {
    const f = fixture();
    f.legacy();
    f.missingCapability();
    await expect(
      f.client.editArticle({ ...f.input(), enableReviewPolicy: "FACT_CHECK" }),
    ).rejects.toMatchObject({ code: "CAPABILITY_UNAVAILABLE" });
    expect(f.counts).toEqual({ saves: 0, releases: 0, enrolls: 0 });
  });
  it("reconciles a lost save acknowledgement using its original payload and idempotency key", async () => {
    const f = fixture();
    f.lostSave();
    await expect(f.client.editArticle(f.input())).rejects.toMatchObject({
      code: "STEP_FAILED",
    });
    expect(f.checkpoint?.document).toBeDefined();
    await f.client.editArticle(f.input());
    expect(f.counts.saves).toBe(1);
  });
  it("reconciles an acknowledged-by-server release without publishing twice", async () => {
    const f = fixture();
    f.lostRelease();
    expect(
      (await f.client.editArticle({ ...f.input(), release: true })).state,
    ).toBe("published");
    expect(f.counts.releases).toBe(1);
  });
  it("rejects changed operation input and unsupported fields before mutation", async () => {
    const f = fixture();
    await f.client.editArticle(f.input());
    await expect(
      f.client.editArticle({ ...f.input(), patch: { title: "Different" } }),
    ).rejects.toMatchObject({ code: "OPERATION_CONFLICT" });
    const fresh = fixture();
    await expect(
      fresh.client.editArticle({
        ...fresh.input(),
        patch: { metadata: { secret: "no" } } as any,
      }),
    ).rejects.toThrow("Unsupported edit field");
    expect(fresh.transport).not.toHaveBeenCalled();
  });
  it("does not add a revision for no-op edits and persists their identity for replay", async () => {
    const f = fixture();
    expect(
      (
        await f.client.editArticle({
          ...f.input(),
          patch: { title: "Local reporting" },
        })
      ).state,
    ).toBe("unchanged");
    expect(f.counts.saves).toBe(0);
    f.concurrentEdit();
    await expect(
      f.client.editArticle({
        ...f.input(),
        patch: { title: "Local reporting" },
      }),
    ).rejects.toMatchObject({ code: "ARTICLE_CHANGED" });
  });
  it("reports permission errors directly", async () => {
    const f = fixture();
    f.deny();
    await expect(f.client.editArticle(f.input())).rejects.toMatchObject({
      code: "PERMISSION_DENIED",
      status: 403,
    });
    expect(f.counts.saves).toBe(0);
  });
  it("can clear cards with an explicit empty array while retaining the source excerpt", async () => {
    const f = fixture();
    await f.client.editArticle({
      ...f.input(),
      patch: { cards: [] },
      release: true,
    });
    expect(f.source.metadata.cards).toEqual([]);
    expect(f.source.excerpt).toBe("Keep this excerpt");
  });
});
