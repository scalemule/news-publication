import type { EditorialSection, HomepageSelection, NewsItem, NewsPublication } from "./types";

const labels: Record<string, string> = {
  "Local businesses": "Local business",
  "Food & places": "Food & drink",
};

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
    const name = item.section?.trim() || "Local news";
    groups.set(name, [...(groups.get(name) ?? []), item]);
  }
  return Array.from(groups, ([name, articles]) => ({ ...sectionDefinition(name), items: articles }));
}

/** Published inventory only. Selection never duplicates or fabricates a story. */
export function composeEdition(items: NewsItem[], selection: HomepageSelection = {}, now = Date.now()) {
  const seen = new Set<string>();
  const inventory = items.filter(item => {
    if (!item.id || !item.slug || seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
  const pins = !selection.pinned_until || Date.parse(selection.pinned_until) > now ? selection : {};
  const lead = inventory.find(item => item.slug === pins.lead_slug) ?? inventory[0];
  const remaining = inventory.filter(item => item !== lead);
  const requested = new Set(pins.secondary_slugs ?? []);
  const ordered = [
    ...(pins.secondary_slugs ?? []).flatMap(slug => remaining.find(item => item.slug === slug) ?? []),
    ...remaining.filter(item => !requested.has(item.slug)),
  ];
  const secondary = Array.from(new Map(ordered.map(item => [item.id, item])).values()).slice(0, 3);
  for (const item of secondary) remaining.splice(remaining.indexOf(item), 1);
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
  const compact = [...briefs, ...remaining.filter(item => !briefIds.has(item.id))].slice(0, 4);
  const compactIds = new Set(compact.map(item => item.id));
  const sections = editorialSections(remaining.filter(item => !compactIds.has(item.id)));
  return { lead, secondary, briefs, compact, sections, navigation: editorialSections(inventory) };
}

export function displayHeadline(article: NewsItem, selection: HomepageSelection = {}): string {
  return selection.stories?.[article.slug]?.display_title?.trim() || article.title;
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
