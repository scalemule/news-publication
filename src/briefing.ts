import { validCalendarDate } from "./editorial";
import { publicHttps } from "./seo";
import type { NewsItem } from "./types";

export const LOCAL_BRIEFING_POLICY_VERSION = "1";

export type BriefingVerification =
  | "unverified"
  | "community_submitted"
  | "officially_confirmed"
  | "independently_verified"
  | "disputed";

export type BriefingSection = "important" | "around_you" | "people" | "discover" | "participate" | "following";

/** Public evidence links only. Artifact URLs and private reporter notes do not belong here. */
export interface BriefingSource {
  id: string;
  url: string;
  title: string;
  publisher: string;
}

/** Explicit choices only; no inferred demographics, relationships or reading history. */
export interface BriefingPreferences {
  community_ids?: readonly string[];
  topic_ids?: readonly string[];
  entity_ids?: readonly string[];
  issue_ids?: readonly string[];
}

/**
 * A server-authorized projection, not a new canonical record or submission API.
 * Article-backed presentation only: BaseNews records need not have an article.
 * Eligibility here must never gate existing publication or community workflows.
 * The producer must resolve grants, evidence rights and geographic relationships.
 * Keep withdrawn/superseded revisions in the input to suppress older copies.
 */
export interface BriefingCandidate {
  sm_application_id: string;
  publication_id: string;
  /** Namespaced existing development/occurrence/reporting ID, never an issue-wide ID. */
  canonical_key: string;
  revision: number;
  article: NewsItem;
  publication_status: "published" | "draft";
  visibility: "public" | "private";
  editorial_approval: "approved" | "pending";
  lifecycle: "current" | "superseded" | "withdrawn";
  /** Resolved public area IDs, including applicable containing areas. No coordinates. */
  geography_ids: readonly string[];
  topic_ids: readonly string[];
  entity_ids: readonly string[];
  issue_ids: readonly string[];
  section: BriefingSection;
  /** Editorial assignments, never inferred from emotional language or click rates. */
  civic_importance: "routine" | "important";
  practical_value: boolean;
  discovery_value: boolean;
  why_it_matters?: string;
  /** Required editorial relevance expiry; article publication time is not event time. */
  relevant_until: string;
  verification: BriefingVerification;
  last_verified_at: string | null;
  review_due_at: string | null;
  sources: readonly BriefingSource[];
}

export type BriefingReason =
  | "important_civic_information"
  | "selected_community"
  | "publication_coverage"
  | "practical_value"
  | "following_entity"
  | "following_issue"
  | "selected_topic"
  | "recent_reporting"
  | "local_discovery";

export interface LocalBriefingOptions {
  sm_application_id: string;
  publication_id: string;
  coverage_area_ids: readonly string[];
  preferences?: BriefingPreferences;
  personalized?: boolean;
  /** Maximum, never a quota. Between 1 and 12, default 6. */
  limit?: number;
  now?: number;
}

export interface LocalBriefingItem {
  canonical_key: string;
  revision: number;
  article: Pick<NewsItem, "id" | "slug" | "title" | "published_at" | "author_name" | "canonical_url">;
  summary: string;
  section: BriefingSection;
  geography_ids: string[];
  why_it_matters?: string;
  reasons: BriefingReason[];
  relevance: {
    geographic: number;
    practical: number;
    relationship: number;
    interest: number;
    temporal: number;
    civic: number;
    discovery: number;
  };
  verification: BriefingVerification;
  freshness: "current" | "unknown";
  last_verified_at: string | null;
  review_due_at: string | null;
  relevant_until: string;
  sources: BriefingSource[];
}

export interface LocalBriefing {
  schema_version: 1;
  policy_version: typeof LOCAL_BRIEFING_POLICY_VERSION;
  publication_id: string;
  generated_at: string;
  personalized: boolean;
  items: LocalBriefingItem[];
  /** Consumers must keep a visible route to important coverage beyond the brief. */
  remaining_important_count: number;
}

const DAY = 86_400_000;
const verifications = new Set<BriefingVerification>([
  "unverified", "community_submitted", "officially_confirmed", "independently_verified", "disputed",
]);
const sections = new Set<BriefingSection>(["important", "around_you", "people", "discover", "participate", "following"]);
const overlaps = (a: readonly string[], b: readonly string[] = []) => a.some(id => id.trim() !== "" && b.includes(id));

/** Require an absolute timestamp: host-local parsing must not change eligibility. */
function timestamp(value: string): number {
  if (!/^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d{1,3})?(?:Z|[+-](?:[01]\d|2[0-3]):[0-5]\d)$/.test(value)
    || !validCalendarDate(value.slice(0, 10))) return NaN;
  return Date.parse(value);
}

function sourcesFor(candidate: BriefingCandidate): BriefingSource[] {
  const seen = new Set<string>();
  return candidate.sources.flatMap(source => {
    const url = publicHttps(source.url);
    if (!source.id.trim() || !source.publisher.trim() || !source.title.trim() || !url || seen.has(source.id)) return [];
    seen.add(source.id);
    // Deliberately project fields rather than spreading potentially private metadata.
    return [{ id: source.id, url, title: source.title, publisher: source.publisher }];
  });
}

function eligible(candidate: BriefingCandidate, coverage: readonly string[], now: number): boolean {
  if (candidate.publication_status !== "published" || candidate.visibility !== "public"
    || candidate.editorial_approval !== "approved" || candidate.lifecycle !== "current"
    || !candidate.article.id.trim() || !candidate.article.slug.trim() || !candidate.article.title.trim()
    || !verifications.has(candidate.verification) || !sections.has(candidate.section)
    || !overlaps(candidate.geography_ids, coverage)) return false;
  const published = timestamp(candidate.article.published_at);
  const expiry = timestamp(candidate.relevant_until);
  if (!Number.isFinite(published) || published > now || !Number.isFinite(expiry) || expiry <= now) return false;
  const verified = candidate.last_verified_at === null ? null : timestamp(candidate.last_verified_at);
  const review = candidate.review_due_at === null ? null : timestamp(candidate.review_due_at);
  if (verified !== null && (!Number.isFinite(verified) || verified > now)) return false;
  if (review !== null && (!Number.isFinite(review) || review <= now || (verified !== null && review <= verified))) return false;
  const confirmed = candidate.verification === "officially_confirmed" || candidate.verification === "independently_verified";
  return !confirmed || (verified !== null && review !== null && sourcesFor(candidate).length > 0);
}

/** Same canonical revision must have one approved projection, independent of input order. */
function projectionKey(candidate: BriefingCandidate): string {
  const article = candidate.article;
  return JSON.stringify([
    article.id, article.slug, article.title, article.excerpt, article.published_at,
    article.author_name, publicHttps(article.canonical_url),
    [...candidate.geography_ids].sort(), [...candidate.topic_ids].sort(),
    [...candidate.entity_ids].sort(), [...candidate.issue_ids].sort(),
    candidate.section, candidate.civic_importance, candidate.practical_value, candidate.discovery_value,
    candidate.why_it_matters, candidate.relevant_until, candidate.verification,
    candidate.last_verified_at, candidate.review_due_at,
    sourcesFor(candidate).sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
  ]);
}

/**
 * Opt-in, deterministic presentation of existing public records. This does not
 * authenticate callers, fetch evidence, verify claims, persist preferences or
 * publish anything. Never pass raw user submissions as authorized candidates.
 */
export function composeLocalBriefing(candidates: readonly BriefingCandidate[], options: LocalBriefingOptions): LocalBriefing {
  const now = options.now ?? Date.now();
  const limit = options.limit ?? 6;
  if (!options.sm_application_id.trim() || !options.publication_id.trim()
    || !Number.isFinite(now) || !Number.isFinite(new Date(now).getTime())
    || !Number.isInteger(limit) || limit < 1 || limit > 12) {
    throw new RangeError("A briefing requires application/publication scope, a valid time and a limit from 1 to 12");
  }
  const preferences: BriefingPreferences = options.personalized === false ? {} : options.preferences ?? {};
  const personalized = [preferences.community_ids, preferences.topic_ids, preferences.entity_ids, preferences.issue_ids]
    .some(ids => ids?.some(id => id.trim() !== ""));

  // Scope first, then reconcile revisions BEFORE filtering lifecycle/freshness.
  // Otherwise a withdrawal or a new ineligible revision can resurrect old facts.
  const newest = new Map<string, BriefingCandidate[]>();
  for (const candidate of candidates) {
    if (candidate.sm_application_id !== options.sm_application_id || candidate.publication_id !== options.publication_id
      || !candidate.canonical_key.trim() || !Number.isSafeInteger(candidate.revision) || candidate.revision < 1) continue;
    const group = newest.get(candidate.canonical_key);
    if (!group || candidate.revision > group[0].revision) newest.set(candidate.canonical_key, [candidate]);
    else if (candidate.revision === group[0].revision) group.push(candidate);
  }

  const ranked: { item: LocalBriefingItem; score: number; published: number; important: boolean }[] = [];
  for (const group of newest.values()) {
    // An ineligible same-revision projection fails closed, including tombstones.
    if (group.some(candidate => !eligible(candidate, options.coverage_area_ids, now))) continue;
    const candidate = group[0];
    if (group.length > 1 && group.some(copy => projectionKey(copy) !== projectionKey(candidate))) continue;
    // Preserve the whole approved excerpt: a later sentence may qualify or
    // correct the first. Ask the editorial adapter for shorter text if needed.
    const summary = candidate.article.excerpt?.trim() ?? "";
    if (!summary || Array.from(summary).length > 280 || !/[.!?。！？][”’"']?$/u.test(summary)) continue;
    const community = overlaps(candidate.geography_ids, preferences.community_ids);
    const entity = overlaps(candidate.entity_ids, preferences.entity_ids);
    const issue = overlaps(candidate.issue_ids, preferences.issue_ids);
    const topic = overlaps(candidate.topic_ids, preferences.topic_ids);
    const published = timestamp(candidate.article.published_at);
    const age = now - published;
    const important = candidate.civic_importance === "important";
    const relevance: LocalBriefingItem["relevance"] = {
      geographic: community ? 2 : 1,
      practical: candidate.practical_value ? 1 : 0,
      relationship: entity || issue ? 1 : 0,
      interest: topic ? 1 : 0,
      temporal: age < DAY ? 2 : age < 7 * DAY ? 1 : 0,
      civic: important ? 1 : 0,
      discovery: candidate.discovery_value ? 1 : 0,
    };
    const reasons: BriefingReason[] = [];
    if (important) reasons.push("important_civic_information");
    reasons.push(community ? "selected_community" : "publication_coverage");
    if (candidate.practical_value) reasons.push("practical_value");
    if (entity) reasons.push("following_entity");
    if (issue) reasons.push("following_issue");
    if (topic) reasons.push("selected_topic");
    if (relevance.temporal > 0) reasons.push("recent_reporting");
    if (candidate.discovery_value) reasons.push("local_discovery");
    const article = candidate.article;
    const item: LocalBriefingItem = {
      canonical_key: candidate.canonical_key,
      revision: candidate.revision,
      article: {
        id: article.id, slug: article.slug, title: article.title,
        published_at: article.published_at, author_name: article.author_name,
        canonical_url: publicHttps(article.canonical_url) ?? null,
      },
      summary,
      section: important ? "important" : entity || issue ? "following" : candidate.section,
      geography_ids: [...new Set(candidate.geography_ids)],
      why_it_matters: candidate.why_it_matters?.trim() || undefined,
      reasons,
      relevance,
      verification: candidate.verification,
      freshness: candidate.last_verified_at !== null && candidate.review_due_at !== null ? "current" : "unknown",
      last_verified_at: candidate.last_verified_at,
      review_due_at: candidate.review_due_at,
      relevant_until: candidate.relevant_until,
      sources: sourcesFor(candidate),
    };
    const score = 4 * relevance.geographic + 3 * relevance.practical + 3 * relevance.relationship
      + 2 * relevance.interest + relevance.temporal + relevance.discovery;
    ranked.push({ item, score, published, important });
  }
  ranked.sort((a, b) => Number(b.important) - Number(a.important) || b.score - a.score
    || b.published - a.published || (a.item.canonical_key < b.item.canonical_key ? -1 : a.item.canonical_key > b.item.canonical_key ? 1 : 0));
  const seenArticles = new Set<string>();
  const seenUrls = new Set<string>();
  const deduplicated = ranked.filter(({ item }) => {
    const url = item.article.canonical_url;
    if (seenArticles.has(item.article.id) || (url && seenUrls.has(url))) return false;
    seenArticles.add(item.article.id);
    if (url) seenUrls.add(url);
    return true;
  });
  return {
    schema_version: 1,
    policy_version: LOCAL_BRIEFING_POLICY_VERSION,
    publication_id: options.publication_id,
    generated_at: new Date(now).toISOString(),
    personalized,
    items: deduplicated.slice(0, limit).map(({ item }) => item),
    remaining_important_count: deduplicated.slice(limit).filter(({ important }) => important).length,
  };
}
