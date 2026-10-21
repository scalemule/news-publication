import { resolveSection, storyDate, storyTowns } from "./editorial";
import type { NewsItem, NewsPublication } from "./types";

export const ARTICLE_CONVERSION_EXPERIMENT = "article_conversion_module";
export type ArticleConversionVariant = "control" | "treatment";

export type CommunityInvitationCategory =
  | "celebrations"
  | "local_businesses"
  | "education"
  | "neighborhood_news"
  | "community_events"
  | "community";

export interface ContextualCommunityInvitation {
  category: CommunityInvitationCategory;
  eyebrow: string;
  heading: string;
  subprompt: string;
  description: string;
  ctaLabel: string;
  relatedHeading: string;
}

const CELEBRATION_PATTERN =
  /\b(celebrat(?:e|ion|ions|ing)|wedding|weddings|baby|babies|newborn|quarter[- ]?finals?|milestone|milestones|anniversar(?:y|ies)|graduat(?:e|es|ion|ions)|honor(?:s|ed|ing)?|award(?:s|ed)?|champion|champions|hero(?:es)?|little warrior|birthday)\b/iu;

const SPONSORED_MARKER_PATTERN =
  /\b(sponsored|paid post|partner content|advertorial|promoted|brand studio)\b/iu;

/**
 * Resolves the `article_conversion_module` experiment variant consistently.
 * Supports query-parameter preview overrides (`?conversion=treatment` or `?conversion=control`)
 * before falling back to the assigned ScaleMule flag variant (`"control"` default).
 */
export function resolveArticleConversionVariant(
  assignedVariant?: string | null,
  queryOverride?: string | null,
): ArticleConversionVariant {
  const candidate = (queryOverride ?? assignedVariant ?? "").trim().toLowerCase();
  if (candidate === "treatment" || candidate === "inline" || candidate === "b") {
    return "treatment";
  }
  return "control";
}

/**
 * Infers the reader-facing community invitation category from a story's section,
 * tags, categories, headline, and excerpt.
 */
export function classifyStoryInvitationCategory(
  story: Pick<NewsItem, "title" | "excerpt" | "section" | "tags" | "categories">,
): CommunityInvitationCategory {
  const combinedText = [
    story.title,
    story.excerpt ?? "",
    story.section ?? "",
    ...(story.tags ?? []).map(t => t.name),
    ...(story.categories ?? []).map(c => c.name),
  ].join(" ");

  if (CELEBRATION_PATTERN.test(combinedText)) {
    return "celebrations";
  }

  const section = resolveSection(story as NewsItem);
  switch (section) {
    case "Local businesses":
      return "local_businesses";
    case "Schools":
      return "education";
    case "Events":
      return "community_events";
    case "Civic life":
    case "Real Estate":
    case "Health":
      return "neighborhood_news";
    default:
      return "community";
  }
}

/**
 * Builds a publication-aware, category-tailored invitation that connects the reader's
 * reason for visiting a specific article to staying connected with the local community.
 */
export interface CommunityInvitationPublicationContext {
  name: string;
  regionLabel: string;
  coverageText?: string;
  towns?: string[];
}

export function contextualCommunityInvitation(
  story: Pick<NewsItem, "title" | "excerpt" | "section" | "tags" | "categories">,
  publication: CommunityInvitationPublicationContext,
): ContextualCommunityInvitation {
  const category = classifyStoryInvitationCategory(story);
  const region = publication.regionLabel.trim() || publication.name.trim();
  const coverage =
    publication.coverageText?.trim() ||
    (publication.towns && publication.towns.length > 0 ? publication.towns.slice(0, 3).join(", ") : region);

  switch (category) {
    case "celebrations":
      return {
        category,
        eyebrow: `${region} Community`,
        heading: `Stay connected to ${region}`,
        subprompt: "Discover more people and milestones worth celebrating.",
        description: `${region} is full of stories worth celebrating. Discover the people, places, events, and milestones shaping ${coverage}.`,
        ctaLabel: "Subscribe",
        relatedHeading: `More stories from ${region}`,
      };
    case "local_businesses":
      return {
        category,
        eyebrow: `${region} Local Businesses`,
        heading: `Stay connected to ${region}`,
        subprompt: "Meet the entrepreneurs building your community.",
        description: `Discover the founders, independent shops, places, and events shaping ${coverage}.`,
        ctaLabel: "Subscribe",
        relatedHeading: `More local stories in ${region}`,
      };
    case "education":
      return {
        category,
        eyebrow: `${region} Schools & Youth`,
        heading: `Stay connected to ${region}`,
        subprompt: "Follow achievements from local students and schools.",
        description: `Discover the students, educators, neighborhood milestones, and events shaping ${coverage}.`,
        ctaLabel: "Subscribe",
        relatedHeading: `More stories from ${region}`,
      };
    case "community_events":
      return {
        category,
        eyebrow: `${region} Events & Gatherings`,
        heading: `Stay connected to ${region}`,
        subprompt: "Find something happening near you this weekend.",
        description: `Discover the people, places, weekend gatherings, and local stories shaping ${coverage}.`,
        ctaLabel: "Subscribe",
        relatedHeading: `Happening around ${region}`,
      };
    case "neighborhood_news":
      return {
        category,
        eyebrow: `${region} Neighborhood Briefing`,
        heading: `Stay connected to ${region}`,
        subprompt: "Stay informed about changes affecting your neighborhood.",
        description: `Follow the civic decisions, neighborhood projects, people, and events shaping ${coverage}.`,
        ctaLabel: "Subscribe",
        relatedHeading: `More from ${region}`,
      };
    case "community":
    default:
      return {
        category: "community",
        eyebrow: `${region} Community`,
        heading: `Stay connected to ${region}`,
        subprompt: "Discover the people, places, and events shaping your community.",
        description: `Receive local reporting on the people, places, events, and stories shaping ${coverage}.`,
        ctaLabel: "Subscribe",
        relatedHeading: `More stories from ${region}`,
      };
  }
}

/**
 * Returns true if a story carries any sponsored, paid, or partner-content markers.
 * Editorial recommendation slots must never mix unlabeled sponsored items.
 */
export function isSponsoredStoryItem(item: NewsItem): boolean {
  const markers = [
    item.section ?? "",
    ...(item.tags ?? []).map(t => `${t.name} ${t.slug}`),
    ...(item.categories ?? []).map(c => `${c.name} ${c.slug}`),
  ].join(" ");
  return SPONSORED_MARKER_PATTERN.test(markers);
}

function normalizedCoverIdentity(item: NewsItem): string | null {
  const raw = item.cover_image_url?.trim();
  if (!raw) return null;
  if (item.visual_identity?.version === 1 && /^[a-f0-9]{64}$/u.test(item.visual_identity.key)) {
    return `pixels:${item.visual_identity.key}`;
  }
  try {
    const url = new URL(raw);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    url.hash = "";
    url.searchParams.sort();
    return `url:${url.toString()}`;
  } catch {
    return null;
  }
}

/**
 * Selects 2–3 relevant local editorial stories for the post-prose Community Conversion Module.
 *
 * Rules:
 * - Never includes the current story or duplicate story IDs/slugs.
 * - Never includes sponsored/paid items (`isSponsoredStoryItem`).
 * - Deduplicates cover images so recommended cards never repeat the current story's cover or each other's cover.
 * - Prioritizes stories with valid cover photographs, shared town/geographic relevance, and community/section affinity.
 */
export function selectRelevantLocalStories(
  currentStory: NewsItem,
  candidates: NewsItem[],
  publication: Pick<NewsPublication, "regionLabel" | "towns">,
  limit = 3,
): NewsItem[] {
  if (limit <= 0) return [];
  const currentSection = resolveSection(currentStory);
  const pubTowns = Array.isArray(publication.towns) ? publication.towns : [];
  const currentTowns = new Set(storyTowns(currentStory, pubTowns).map(t => t.toLowerCase()));
  const currentTags = new Set([
    ...(currentStory.tags ?? []).map(t => t.name.toLowerCase()),
    ...(currentStory.categories ?? []).map(c => c.name.toLowerCase()),
  ]);
  const primaryRegion = publication.regionLabel.trim().toLowerCase();

  const seenIds = new Set<string>([currentStory.id]);
  const seenSlugs = new Set<string>([currentStory.slug]);
  const usedCovers = new Set<string>();
  const currentCover = normalizedCoverIdentity(currentStory);
  if (currentCover) usedCovers.add(currentCover);

  const scored = candidates
    .filter(item => {
      if (!item?.id || !item?.slug) return false;
      if (seenIds.has(item.id) || seenSlugs.has(item.slug)) return false;
      if (isSponsoredStoryItem(item)) return false;
      return true;
    })
    .map(item => {
      let score = 0;
      const cover = normalizedCoverIdentity(item);
      if (cover) score += 40; // Strongly prefer stories with photographs for the visual discovery grid

      const itemTowns = storyTowns(item, pubTowns).map(t => t.toLowerCase());
      if (itemTowns.some(t => currentTowns.has(t))) {
        score += 25;
      } else if (primaryRegion && `${item.title} ${item.excerpt ?? ""}`.toLowerCase().includes(primaryRegion)) {
        score += 18;
      }

      const section = resolveSection(item);
      if (section === currentSection) {
        score += 20;
      } else if (["Community", "Events", "Schools", "Local businesses", "Food & places"].includes(section)) {
        score += 12;
      }

      const itemTags = [
        ...(item.tags ?? []).map(t => t.name.toLowerCase()),
        ...(item.categories ?? []).map(c => c.name.toLowerCase()),
      ];
      const sharedTags = itemTags.filter(t => currentTags.has(t)).length;
      score += Math.min(sharedTags * 8, 16);

      if (CELEBRATION_PATTERN.test(`${item.title} ${item.excerpt ?? ""}`)) {
        score += 6;
      }

      const parsedTime = Date.parse(item.published_at);
      const publishedMs = Number.isFinite(parsedTime) ? parsedTime : 0;
      return { item: { ...item, section }, cover, score, publishedMs };
    })
    .sort((a, b) => b.score - a.score || b.publishedMs - a.publishedMs);

  const selected: NewsItem[] = [];
  for (const entry of scored) {
    if (selected.length >= limit) break;
    if (seenIds.has(entry.item.id) || seenSlugs.has(entry.item.slug)) continue;
    if (entry.cover && usedCovers.has(entry.cover)) continue;
    seenIds.add(entry.item.id);
    seenSlugs.add(entry.item.slug);
    if (entry.cover) usedCovers.add(entry.cover);
    selected.push(entry.item);
  }

  return selected;
}
