import { describe, expect, it } from "vitest";
import { composeLocalBriefing, type BriefingCandidate, type LocalBriefingOptions } from "./briefing";

const now = Date.parse("2026-10-13T12:00:00Z");
const scope: LocalBriefingOptions = {
  sm_application_id: "reader-app", publication_id: "publication", coverage_area_ids: ["area"], now,
};

// Unit-test inputs only; the runtime never supplies fallback news or generated facts.
function record(key: string, overrides: Partial<BriefingCandidate> = {}): BriefingCandidate {
  return {
    sm_application_id: scope.sm_application_id,
    publication_id: scope.publication_id,
    canonical_key: `news:${key}`, revision: 1,
    article: {
      id: key, slug: key, title: key, excerpt: "An approved excerpt.",
      cover_image_url: null, published_at: "2026-10-13T10:00:00Z", updated_at: "2026-10-13T10:00:00Z",
      reading_time_minutes: 1, no_index: false, section: "Community", author_name: "Original newsroom",
      canonical_url: `https://publication.example/news/${key}`,
    },
    publication_status: "published", visibility: "public", editorial_approval: "approved", lifecycle: "current",
    geography_ids: ["area"], topic_ids: [], entity_ids: [], issue_ids: [], section: "around_you",
    civic_importance: "routine", practical_value: false, discovery_value: false,
    relevant_until: "2026-10-14T12:00:00Z", verification: "unverified",
    last_verified_at: null, review_due_at: null, sources: [],
    ...overrides,
  };
}

function verified(key: string): BriefingCandidate {
  return record(key, {
    verification: "officially_confirmed", last_verified_at: "2026-10-13T11:00:00Z",
    review_due_at: "2026-10-14T11:00:00Z",
    sources: [{ id: "source", url: "https://source.example/evidence", title: "Source document", publisher: "Source organization" }],
  });
}

const keys = (input: BriefingCandidate[], options = scope) => composeLocalBriefing(input, options).items.map(item => item.canonical_key);

describe("local briefing eligibility and trust", () => {
  it("produces no filler for an empty or sparse inventory", () => {
    expect(composeLocalBriefing([], scope).items).toEqual([]);
    const result = composeLocalBriefing([record("one")], scope);
    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toMatchObject({ verification: "unverified", freshness: "unknown", sources: [] });
    expect(result.personalized).toBe(false);
  });

  it.each([
    { sm_application_id: "other-app" }, { publication_id: "other-publication" },
    { geography_ids: ["outside-coverage"] }, { publication_status: "draft" },
    { visibility: "private" }, { editorial_approval: "pending" },
    { lifecycle: "withdrawn" }, { lifecycle: "superseded" },
    { revision: 0 }, { canonical_key: " " }, { relevant_until: "2026-10-13T12:00:00Z" },
  ] satisfies Partial<BriefingCandidate>[])("excludes ineligible input %j", overrides => {
    expect(keys([record("one", overrides)])).toEqual([]);
  });

  it("does not use a preference as a grant to another area or tenant", () => {
    const options = { ...scope, preferences: { community_ids: ["outside-coverage"] } };
    expect(keys([record("one", { geography_ids: ["outside-coverage"] })], options)).toEqual([]);
  });

  it("requires evidence and verification/review timestamps for confirmed labels", () => {
    const candidate = verified("confirmed");
    expect(composeLocalBriefing([candidate], scope).items[0]).toMatchObject({ verification: "officially_confirmed", freshness: "current" });
    for (const overrides of [
      { sources: [] }, { last_verified_at: null }, { review_due_at: null },
      { last_verified_at: "2026-10-13T13:00:00Z" }, { review_due_at: "2026-10-13T11:30:00Z" },
      { sources: [{ ...candidate.sources[0], url: "javascript:alert(1)" }] },
      { sources: [{ ...candidate.sources[0], url: "https://user:secret@source.example/" }] },
    ]) expect(keys([{ ...candidate, ...overrides }])).toEqual([]);
  });

  it("preserves disputed and submitted labels without promoting them", () => {
    const result = composeLocalBriefing([
      record("disputed", { verification: "disputed" }), record("submitted", { verification: "community_submitted" }),
    ], scope);
    expect(result.items.map(item => item.verification)).toEqual(["disputed", "community_submitted"]);
  });

  it.each(["invalid", "2026-10-13T10:00:00", "2026-02-30T10:00:00Z", "2026-10-13T24:00:00Z", "2026-10-13T13:00:00Z"])("rejects invalid or future publication time %s", value => {
    const candidate = record("one");
    candidate.article.published_at = value;
    expect(keys([candidate])).toEqual([]);
  });

  it("handles absolute timezone offsets and never refreshes verification from article updates", () => {
    const candidate = verified("one");
    candidate.article.published_at = "2026-10-13T05:00:00-07:00";
    candidate.article.updated_at = "2026-10-13T12:00:00Z";
    const result = composeLocalBriefing([candidate], scope).items[0];
    expect(result.last_verified_at).toBe(candidate.last_verified_at);
    expect(result.article).not.toHaveProperty("updated_at");
  });

  it("rejects stale reviews and expired relevance independently", () => {
    expect(keys([record("one", { review_due_at: "2026-10-13T12:00:00Z" })])).toEqual([]);
    expect(keys([{ ...verified("one"), relevant_until: "2026-10-12T12:00:00Z" }])).toEqual([]);
  });

  it("returns only explicit public fields and preserves source attribution", () => {
    const candidate = verified("one");
    Object.assign(candidate.article, { metadata: { reporter_notes: "private" } });
    Object.assign(candidate.sources[0], { artifact_url: "https://private.example/evidence" });
    const result = composeLocalBriefing([candidate], scope).items[0];
    expect(result.article.author_name).toBe("Original newsroom");
    expect(result.sources[0].publisher).toBe("Source organization");
    expect(JSON.stringify(result)).not.toContain("private");
    expect(result).not.toHaveProperty("sm_application_id");
  });
});

describe("corrections and duplicate reporting", () => {
  it("keeps the latest revision and makes a withdrawal win in either input order", () => {
    const old = record("one");
    const withdrawn = record("one", { revision: 2, lifecycle: "withdrawn" });
    expect(keys([old, withdrawn])).toEqual([]);
    expect(keys([withdrawn, old])).toEqual([]);
    expect(keys([old, { ...withdrawn, lifecycle: "current", relevant_until: "2026-10-12T00:00:00Z" }])).toEqual([]);
    expect(composeLocalBriefing([old, { ...old, revision: 2 }], scope).items[0].revision).toBe(2);
  });

  it("fails closed when same-revision copies include a tombstone", () => {
    expect(keys([record("one"), record("one", { lifecycle: "withdrawn" })])).toEqual([]);
  });

  it("does not resolve conflicting same-revision trust or wording by input order", () => {
    const first = record("one");
    const conflict = record("one", { verification: "disputed" });
    expect(keys([first, conflict])).toEqual([]);
    expect(keys([conflict, first])).toEqual([]);
    const wording = record("one");
    wording.article.excerpt = "A different approved excerpt.";
    expect(keys([first, wording])).toEqual([]);
  });

  it("does not let another tenant's tombstone hide this publication's record", () => {
    expect(keys([record("one"), record("one", { revision: 2, sm_application_id: "other", lifecycle: "withdrawn" })])).toEqual(["news:one"]);
  });

  it("deduplicates canonical developments, repeated article IDs and canonical URLs", () => {
    const first = record("one");
    const sameUrl = record("other");
    sameUrl.article.canonical_url = first.article.canonical_url;
    expect(keys([first, { ...first }, { ...first, canonical_key: "news:alias" }, sameUrl])).toHaveLength(1);
  });

  it("retains distinct developments in the same issue", () => {
    expect(keys([record("one", { issue_ids: ["issue"] }), record("two", { issue_ids: ["issue"] })])).toHaveLength(2);
  });
});

describe("transparent relevance without civic blind spots", () => {
  it("puts important civic coverage ahead of all preference matches", () => {
    const discovery = record("discovery", { topic_ids: ["food"], entity_ids: ["organization"], practical_value: true, discovery_value: true });
    const result = composeLocalBriefing([
      discovery, record("civic", { civic_importance: "important" }), record("civic-two", { civic_importance: "important" }),
    ], { ...scope, limit: 1, preferences: { topic_ids: ["food"], entity_ids: ["organization"] } });
    expect(result.items[0].canonical_key).toBe("news:civic");
    expect(result.items[0].reasons).toContain("important_civic_information");
    expect(result.remaining_important_count).toBe(1);
  });

  it("explains multiple explicit preferences and keeps editorial meaning intact", () => {
    const candidate = record("one", {
      topic_ids: ["topic"], entity_ids: ["organization"], issue_ids: ["issue"],
      practical_value: true, discovery_value: true, why_it_matters: "An editorial explanation.",
    });
    const before = JSON.stringify(candidate);
    const result = composeLocalBriefing([candidate], { ...scope, preferences: {
      community_ids: ["area"], topic_ids: ["topic"], entity_ids: ["organization"], issue_ids: ["issue"],
    } });
    expect(result.items[0].reasons).toEqual([
      "selected_community", "practical_value", "following_entity", "following_issue", "selected_topic", "recent_reporting", "local_discovery",
    ]);
    expect(result.items[0].why_it_matters).toBe(candidate.why_it_matters);
    expect(result.items[0].section).toBe("following");
    expect(JSON.stringify(candidate)).toBe(before);
  });

  it("provides the same non-personalized result when preferences are disabled", () => {
    const candidates = [record("a"), record("b", { topic_ids: ["topic"] })];
    const preferences = { topic_ids: ["topic"] };
    expect(keys(candidates, { ...scope, preferences })).toEqual(["news:b", "news:a"]);
    expect(composeLocalBriefing(candidates, { ...scope, preferences, personalized: false })).toEqual(composeLocalBriefing(candidates, scope));
    expect(keys([...candidates].reverse(), scope)).toEqual(keys(candidates, scope));
  });

  it("does not turn an absent editorial explanation into invented significance", () => {
    expect(composeLocalBriefing([record("one")], scope).items[0].why_it_matters).toBeUndefined();
  });

  it("keeps later qualifications and corrections in the approved excerpt", () => {
    const candidate = record("one");
    candidate.article.excerpt = "The original notice announced a closure. The agency has since withdrawn that notice.";
    expect(composeLocalBriefing([candidate], scope).items[0].summary).toBe(candidate.article.excerpt);
    candidate.article.excerpt += " Additional context".repeat(20) + ".";
    expect(keys([candidate])).toEqual([]);
  });

  it.each(["An existing sentence.", "Местна общност.", "社區消息。", "Community 🌳 and café."])("preserves approved Unicode text: %s", excerpt => {
    const candidate = record("one");
    candidate.article.excerpt = excerpt;
    expect(composeLocalBriefing([candidate], scope).items[0].summary).toBe(excerpt);
  });

  it("omits incomplete/overlong summaries rather than slicing a fact or emoji", () => {
    const candidate = record("one");
    candidate.article.excerpt = "A".repeat(279) + "🌳.";
    expect(keys([candidate])).toEqual([]);
    candidate.article.excerpt = "Incomplete excerpt";
    expect(keys([candidate])).toEqual([]);
  });

  it.each([0, -1, 13, 1.5, NaN, Infinity])("rejects invalid maximum %s", limit => {
    expect(() => composeLocalBriefing([], { ...scope, limit })).toThrow(RangeError);
  });
});
