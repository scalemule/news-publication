import type { EditorialSection, HomepageSelection, NewsItem, NewsPublication } from "./types";

const labels: Record<string, string> = {
  "Local businesses": "Business",
  "Events": "Things to do",
  "Food & places": "Food & drink",
};

/**
 * Canonical reader-facing order for editorial sections across the network.
 * Names not listed here sort after these, alphabetically. "Schools" and
 * "Opinion" are reserved so future sections slot in without a release.
 */
export const EDITORIAL_SECTION_ORDER = [
  "Civic life",
  "Community",
  "Local businesses",
  "Real Estate",
  "Food & places",
  "Events",
  "Health",
  "Schools",
  "Opinion",
] as const;

/** Canonical alias mappings to keep section URLs and labels unified across publications. */
const SECTION_ALIASES: Record<string, string> = {
  "Business": "Local businesses",
  "Government": "Civic life",
  "Arts & Culture": "Community",
  "Food & drink": "Food & places",
  "Things to do": "Events",
  "Sports": "Community",
  "Education": "Schools",
  "Public Safety": "Civic life",
  "Transit": "Civic life",
  "Environment": "Civic life",
  "Recreation": "Community",
};

/**
 * Resolves a story's canonical editorial section.
 * Preserves explicitly assigned sections (normalizing known aliases).
 * If unassigned, intelligently infers section desk from tags, categories, or keywords
 * so stories are never lost to unrendered buckets.
 */
export function resolveSection(item: NewsItem): string {
  const explicit = item.section?.trim();
  if (explicit && explicit !== "Local news") {
    return SECTION_ALIASES[explicit] ?? explicit;
  }

  const descriptors = [
    ...(item.tags ?? []).map(t => t.name.toLowerCase()),
    ...(item.categories ?? []).map(c => c.name.toLowerCase()),
  ];

  for (const desc of descriptors) {
    if (/\b(health|wellness|medical|hospital|clinic|doctor|pharmacy|veterinar|pet care|animal welfare|vaccin)\b/i.test(desc)) return "Health";
    if (/\b(real estate|housing|home|homes|mortgage|tenant|tenants|apartment|apartments|property|bmr)\b/i.test(desc)) return "Real Estate";
    if (/\b(civic|government|council|election|ballot|measure|transit|traffic|police|fire|firefighter|wildfire|safety|policy|supervisor)\b/i.test(desc)) return "Civic life";
    if (/\b(business|retail|commerce|commercial|downtown|store|shop|merchants?|chamber of commerce)\b/i.test(desc)) return "Local businesses";
    if (/\b(event|events|festival|festivals|fair|fairs|concert|concerts|music|workshop|workshops|things to do|exhibition|performance)\b/i.test(desc)) return "Events";
    if (/\b(school|schools|education|student|students|teacher|teachers|campus|college|university)\b/i.test(desc)) return "Schools";
    if (/\b(food|dining|restaurant|restaurants|wine|winery|brewery|bakery|cafe|coffee|cuisine|chef)\b/i.test(desc)) return "Food & places";
    if (/\b(community|volunteer|volunteers|library|libraries|neighborhood|nonprofit|charity|youth|senior|seniors)\b/i.test(desc)) return "Community";
  }

  const text = `${item.title} ${item.excerpt ?? ""}`;
  if (/\b(health|hospitals?|clinics?|medical|doctors?|pharmac(?:y|ies)|wellness|veterinar(?:y|ian)|pet care|animal welfare|vaccinat(?:ion|ions)|patients?)\b/iu.test(text)) return "Health";
  if (/\b(real estate|homeownership|mortgage|housing|tenants?|apartments?|below-market rate|home sales?|condos?)\b/iu.test(text)) return "Real Estate";
  if (/\b(city council|planning commission|board of supervisors|ballot|measure [a-z0-9]|election|transit|traffic|police|firefighter|wildfire|evacuation|pedestrian safety|city manager|public works)\b/iu.test(text)) return "Civic life";
  if (/\b(storefront|retail|downtown business|chamber of commerce|opens? doors?|boutique|merchants?|shoppers?|commercial space)\b/iu.test(text)) return "Local businesses";
  if (/\b(festival|parade|fair|concert|workshop|exhibition|showcase|celebration|weigh-off|halloween|trunk-or-treat)\b/iu.test(text)) return "Events";
  if (/\b(schools?|students?|teachers?|campuses?|classrooms?|high school|elementary|school district)\b/iu.test(text)) return "Schools";
  if (/\b(restaurants?|cafes?|baker(?:y|ies)|winer(?:y|ies)|brewer(?:y|ies)|dining|chefs?|menus?)\b/iu.test(text)) return "Food & places";

  return "Community";
}

/** Sorts sections into the canonical order, dropping the implicit "Local news" bucket. */
export function orderedSections<T extends { name: string }>(sections: T[], order: readonly string[] = EDITORIAL_SECTION_ORDER): T[] {
  return sections.filter(section => section.name !== "Local news").slice().sort((left, right) => {
    const leftRank = order.indexOf(left.name);
    const rightRank = order.indexOf(right.name);
    const leftOrder = leftRank === -1 ? order.length : leftRank;
    const rightOrder = rightRank === -1 ? order.length : rightRank;
    return leftOrder - rightOrder || left.name.localeCompare(right.name);
  });
}

export function sectionId(name: string): string {
  return "section-" + name.normalize("NFKD").replace(/\p{Mark}/gu, "").toLowerCase().replace(/[^\p{Letter}\p{Number}]+/gu, "-").replace(/^-|-$/g, "");
}

export function sectionPath(name: string): string {
  return name === "Local news" ? "/news" : "/sections/" + encodeURIComponent(sectionId(name).replace(/^section-/, ""));
}

export function sectionDefinition(name: string): EditorialSection {
  return { name, label: labels[name] ?? name, id: sectionId(name), items: [] };
}

export function editorialSections(items: NewsItem[]): EditorialSection[] {
  const groups = new Map<string, NewsItem[]>();
  for (const item of items) {
    const name = resolveSection(item);
    groups.set(name, [...(groups.get(name) ?? []), { ...item, section: name }]);
  }
  return Array.from(groups, ([name, articles]) => ({ ...sectionDefinition(name), items: articles }));
}

/** Stable public identity from Blog, with a conservative legacy URL fallback. */
function coverIdentity(item: NewsItem): string | null {
  if (!item.cover_image_url?.trim()) return null;
  const identity = item.visual_identity;
  if (identity?.version === 1 && /^[a-f0-9]{64}$/u.test(identity.key)) return `pixels:${identity.key}`;
  try {
    const url = new URL(item.cover_image_url.trim());
    if (url.protocol !== "https:" || url.username || url.password) return null;
    if (url.hostname === "cdn-public.scalemule.com") {
      const match = url.pathname.match(/^\/([a-f0-9-]{36})\/anonymous\/photos\/([a-f0-9-]{36})\//iu);
      if (match) return `photo:${match[1].toLowerCase()}:${match[2].toLowerCase()}`;
    }
    if (["api.scalemule.com", "gw.scalemule.com"].includes(url.hostname)) {
      const match = url.pathname.match(/^\/v1\/photos\/public\/([a-f0-9-]{36})(?:\/|$)/iu);
      if (match) return `photo-public:${match[1].toLowerCase()}`;
    }
    url.hash = "";
    url.searchParams.sort();
    return `url:${url.toString()}`;
  } catch { return null; }
}

/** Published inventory only. All image-bearing slots share one allocation. */
export function composeEdition(items: NewsItem[], selection: HomepageSelection = {}, now = Date.now()) {
  const seen = new Set<string>();
  let inventory = items.slice(0, 200).filter(item => {
    if (!item.id || !item.slug || seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
  const pins = !selection.pinned_until || Date.parse(selection.pinned_until) > now ? selection : {};
  // Publication is not photo readiness. A held or unfinished cover must not
  // occupy an image-required placement, including a pinned lead.
  const selectedLead = inventory.find(item => item.slug === pins.lead_slug && coverIdentity(item))
    ?? inventory.find(item => coverIdentity(item));
  const rest = inventory.filter(item => item !== selectedLead);
  const requested = new Set(pins.secondary_slugs ?? []);
  const ordered = [
    ...(pins.secondary_slugs ?? []).flatMap(slug => rest.find(item => item.slug === slug) ?? []),
    ...rest.filter(item => !requested.has(item.slug)),
  ];
  const originalOrder = Array.from(new Map(ordered.map(item => [item.id, item])).values());
  const seenImages = new Set<string>();
  const display = new Map<string, NewsItem>();
  for (const item of [selectedLead, ...originalOrder]) {
    if (!item) continue;
    const key = coverIdentity(item);
    if (key && seenImages.has(key)) {
      display.set(item.id, { ...item, cover_image_url: null });
    } else {
      display.set(item.id, item);
      if (key) seenImages.add(key);
    }
  }
  inventory = inventory.map(item => display.get(item.id)!);
  const lead = selectedLead ? display.get(selectedLead.id) : undefined;
  let remaining = rest.map(item => display.get(item.id)!);
  const uniqueOrdered = originalOrder.map(item => display.get(item.id)!);
  const secondary = uniqueOrdered.filter(item => coverIdentity(item)).slice(0, 3);
  const secondaryIds = new Set(secondary.map(item => item.id));
  remaining = remaining.filter(item => !secondaryIds.has(item.id));
  const eligible = remaining.filter(item => {
    const age = now - Date.parse(item.published_at);
    return item.excerpt?.trim() && age >= 0 && age <= 7 * 86400000;
  });
  const selected = (pins.brief_slugs ?? []).flatMap(slug => eligible.find(item => item.slug === slug) ?? []);
  const candidates = [...selected, ...editorialSections(eligible).map(group => group.items[0]), ...eligible];
  const briefIds = new Set<string>();
  const briefs = candidates.filter(item => {
    if (!item || briefIds.has(item.id) || briefIds.size >= 4) return false;
    briefIds.add(item.id);
    return true;
  });
  const compact = [...briefs, ...remaining.filter(item => !briefIds.has(item.id))]
    .filter(item => coverIdentity(item)).slice(0, 4);
  const compactIds = new Set(compact.map(item => item.id));
  const sections = editorialSections(remaining.filter(item => !compactIds.has(item.id) && coverIdentity(item)));
  // Keep unresolved articles observable and available in the normal inventory.
  // This is placement eligibility, never an assertion that their art was repaired.
  const pendingImages = inventory.filter(item => !coverIdentity(item));
  return { lead, secondary, briefs, compact, sections, pendingImages, navigation: editorialSections(inventory) };
}

/** The paper's override, else the article's short headline, else its long title (see `headlineSet`). */
export function displayHeadline(article: NewsItem, selection: HomepageSelection = {}): string {
  return selection.stories?.[article.slug]?.display_title?.trim() || article.headline?.trim() || article.title;
}

/** A complete existing sentence, not a cut-off or generated summary. */
export function briefSummary(article: NewsItem, selection: HomepageSelection = {}): string {
  const chosen = selection.stories?.[article.slug]?.brief?.trim();
  if (chosen) return chosen;
  const excerpt = article.excerpt?.trim();
  if (!excerpt) return "";
  const first = [...new Intl.Segmenter("en", { granularity: "sentence" }).segment(excerpt)][0]?.segment.trim() ?? "";
  return Array.from(first).length <= 280 && /[.!?。！？][”’"']?$/u.test(first) ? first : "";
}

export function normalizedText(value: string): string {
  return value.normalize("NFKD").replace(/\p{Mark}/gu, "").toLowerCase();
}

export function townSlug(town: string): string {
  return sectionId(town).replace(/^section-/, "");
}

export function storyTowns(article: NewsItem, towns: string[], selection: HomepageSelection = {}): string[] {
  const explicit = selection.stories?.[article.slug]?.towns;
  if (explicit) return towns.filter(town => explicit.includes(town));
  const words = ` ${normalizedText(`${article.title} ${article.excerpt ?? ""}`).replace(/[^\p{Letter}\p{Number}]+/gu, " ")} `;
  return towns.filter(town => words.includes(` ${normalizedText(town).replace(/[^\p{Letter}\p{Number}]+/gu, " ")} `));
}

function tagSlug(value: string): string {
  return value.normalize("NFKD").replace(/\p{Mark}/gu, "").toLowerCase().replace(/[^\p{Letter}\p{Number}]+/gu, "-").replace(/^-|-$/g, "");
}

export function matchesStoryTag(article: NewsItem, tag: string): boolean {
  if (!tag) return true;
  const target = tagSlug(tag);
  if ((article.tags ?? []).some(item => tagSlug(item.slug) === target || tagSlug(item.name) === target)) return true;
  const normalized = normalizedText(`${article.title} ${article.excerpt ?? ""} ${article.section ?? ""}`);
  return normalized.includes(target.replace(/-/g, " ")) || normalized.includes(target);
}

export function filterNews(
  items: NewsItem[],
  filters: { q?: string; town?: string; section?: string; tag?: string },
  publication: Pick<NewsPublication, "towns" | "matchTag">,
  selection: HomepageSelection = {},
): NewsItem[] {
  const terms = normalizedText(filters.q ?? "").split(/\s+/u).filter(Boolean);
  const matchTag = publication.matchTag ?? matchesStoryTag;
  return items.filter(item =>
    (!filters.section || sectionId(item.section || "Local news") === `section-${filters.section}`)
    && (!filters.town || storyTowns(item, publication.towns, selection).some(town => townSlug(town) === filters.town))
    && (!filters.tag || matchTag(item, filters.tag))
    && terms.every(term => normalizedText(`${item.title} ${item.excerpt ?? ""} ${item.section ?? ""}`).includes(term)));
}

export function validCalendarDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().startsWith(value);
}

export function activeNearby(selection: HomepageSelection = {}, now = Date.now()) {
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Los_Angeles", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
  const lastDay = new Date(Date.parse(today) + 6 * 86400000).toISOString().slice(0, 10);
  return (selection.nearby ?? []).filter(update => validCalendarDate(update.starts)
    && validCalendarDate(update.ends ?? update.starts)
    && (update.ends ?? update.starts) >= update.starts
    && update.starts <= lastDay
    && (update.ends ?? update.starts) >= today)
    .sort((a, b) => a.starts.localeCompare(b.starts))
    .slice(0, 24);
}

export function nearbyUpdates(items: NewsItem[], selection: HomepageSelection = {}, now = Date.now()) {
  const published = new Map(items.map(item => [item.slug, item]));
  return activeNearby(selection, now).filter(update => published.has(update.slug))
    .map(update => ({ ...update, article: published.get(update.slug)! }));
}

/** Display-only shortening. Cuts on character boundaries, never on bytes. */
export function shortDeck(value: string | null | undefined, limit = 160): string {
  const text = value?.trim().replace(/\s+/gu, " ") ?? "";
  const characters = Array.from(text);
  if (characters.length <= limit) return text;
  let sentences = "";
  for (const { segment } of new Intl.Segmenter("en", { granularity: "sentence" }).segment(text)) {
    if (Array.from(sentences + segment.trimEnd()).length > limit) break;
    sentences += segment;
  }
  if (sentences.trim()) return sentences.trim();
  const opening = characters.slice(0, limit).join("");
  const space = opening.lastIndexOf(" ");
  return (space > opening.length / 2 ? opening.slice(0, space) : opening).trimEnd() + "…";
}

export function storyDate(value: string): string | null {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? null
    : date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "America/Los_Angeles" });
}
