import { sectionDefinition, sectionPath } from "./editorial";

/**
 * Shared network navigation.
 *
 * One configuration drives the primary row, the More menu and the hamburger
 * directory on every Bay Area News Network paper. The defaults below ship in
 * this package; day-to-day changes (labels, order, enabling Autos, a featured
 * seasonal destination) are `NavigationConfig` overrides stored in each
 * paper's site record and picked up at request time — no release required.
 */

/** Editorial sections, community products and marketplaces stay distinct in config even where readers see one row. */
export type NavigationKind = "editorial" | "product" | "marketplace" | "publication";

export type NavigationGroup = "news-knowledge" | "local-life" | "marketplace" | "publication";

export const NAVIGATION_GROUPS: { id: NavigationGroup; label: string }[] = [
  { id: "news-knowledge", label: "News & knowledge" },
  { id: "local-life", label: "Local life" },
  { id: "marketplace", label: "Marketplace" },
  { id: "publication", label: "Publication" },
];

export type NavigationDestination = {
  /** Stable identifier; overrides and additions merge by id. */
  id: string;
  label: string;
  href: string;
  kind: NavigationKind;
  /** More-menu column; destinations without a group never render in More. */
  group?: NavigationGroup;
  /** Reading order inside the primary row and inside each More group. */
  order: number;
  /** Responsive weight: when the row runs out of width, lower priority collapses into More first. */
  priority?: number;
  /** Renders in the primary editorial row. */
  primary?: boolean;
  /** Renders in its group inside the More menu. */
  more?: boolean;
  /** Hidden everywhere until enabled (default true). */
  enabled?: boolean;
  /** Publication feature flag that must be on (e.g. "jobs", "chat", "smile", "classifieds"). */
  feature?: string;
  /** Canonical section name: shown only when the publication configures or publishes the section. */
  section?: string;
  /** Restricts the destination to the listed publication slugs. */
  publications?: string[];
};

/** Record-stored delta applied over the shipped defaults. Unknown ids with a label and href are additions. */
export type NavigationOverride = { id: string } & Partial<Omit<NavigationDestination, "id">>;

export type FeaturedDestination = {
  label: string;
  href: string;
  /** ISO instants limiting when the promotion shows. */
  from?: string;
  until?: string;
};

/** Stored in the site record under `render.navigation`. Everything is optional: absent fields keep defaults. */
export type NavigationConfig = {
  version?: 1;
  destinations?: NavigationOverride[];
  /** Overrides the seasonal featured slot; `null` suppresses it entirely. */
  featured?: FeaturedDestination | null;
};

function editorial(id: string, section: string, overrides: Partial<NavigationDestination> = {}): NavigationDestination {
  return {
    id, section, kind: "editorial",
    label: sectionDefinition(section).label,
    href: sectionPath(section),
    order: 0, priority: 0, ...overrides,
  };
}

/**
 * The network-wide default navigation. Primary order and collapse priority
 * follow the 2026 information architecture: editorial sections first, then
 * the community products. "Front page" is the masthead's job, so it is not a
 * destination. Autos ships disabled; enabling it is a record override.
 */
export const NETWORK_NAVIGATION: NavigationDestination[] = [
  // Primary editorial row. "News" is the Civic life desk; the section slug and story classifications are unchanged.
  editorial("news", "Civic life", { label: "News", order: 10, priority: 100, primary: true }),
  editorial("community", "Community", { order: 20, priority: 90, primary: true }),
  editorial("food-drink", "Food & places", { order: 30, priority: 85, primary: true }),
  editorial("things-to-do", "Events", { order: 40, priority: 80, primary: true }),
  editorial("health", "Health", { order: 50, priority: 75, primary: true }),
  editorial("real-estate", "Real Estate", { order: 60, priority: 70, primary: true }),
  { id: "autos", label: "Autos", href: "/autos", kind: "marketplace", group: "marketplace", order: 65, priority: 65, primary: true, more: true, enabled: false },
  editorial("business", "Local businesses", { order: 70, priority: 60, primary: true }),
  { id: "meet", label: "Meet", href: "/meet", kind: "product", order: 80, priority: 50, primary: true, feature: "chat" },
  { id: "jokes", label: "Jokes", href: "/smile", kind: "product", order: 90, priority: 40, primary: true, feature: "smile" },

  // More — News & knowledge.
  editorial("ai-technology", "AI & Technology", { label: "AI & technology", group: "news-knowledge", order: 10, more: true }),
  editorial("schools", "Schools", { label: "Schools & education", group: "news-knowledge", order: 20, more: true }),
  editorial("civic-life", "Civic life", { group: "news-knowledge", order: 30, more: true }),
  editorial("environment", "Environment", { group: "news-knowledge", order: 40, more: true }),
  editorial("transportation", "Transportation", { group: "news-knowledge", order: 50, more: true }),

  // More — Local life.
  { id: "pets", label: "Pets", href: "/pets", kind: "product", group: "local-life", order: 10, more: true },
  { id: "celebrations", label: "Celebrations", href: "/sections/celebrations", kind: "product", group: "local-life", order: 20, more: true, enabled: false },
  { id: "community-maps", label: "Community maps", href: "/community-maps", kind: "product", group: "local-life", order: 30, more: true },
  { id: "town-chat", label: "Town chat", href: "/chat", kind: "product", group: "local-life", order: 40, more: true, feature: "chat" },
  { id: "neighborhood-guides", label: "Neighborhood guides", href: "/guides", kind: "product", group: "local-life", order: 50, more: true, enabled: false },
  { id: "poll", label: "Poll", href: "/polls", kind: "product", group: "local-life", order: 60, more: true, publications: ["walnutcreektimes"] },

  // More — Marketplace.
  { id: "jobs", label: "Jobs", href: "/jobs", kind: "marketplace", group: "marketplace", order: 10, more: true, feature: "jobs" },
  { id: "classifieds", label: "Classifieds", href: "/classifieds", kind: "marketplace", group: "marketplace", order: 20, more: true, feature: "classifieds" },
  { id: "local-services", label: "Local services", href: "/services", kind: "marketplace", group: "marketplace", order: 40, more: true, enabled: false },

  // More — Publication.
  { id: "latest", label: "Latest", href: "/news", kind: "publication", group: "publication", order: 10, more: true },
  { id: "this-week", label: "This week", href: "/this-week", kind: "publication", group: "publication", order: 20, more: true },
  { id: "newsletter", label: "Newsletter", href: "/newsletter", kind: "publication", group: "publication", order: 30, more: true },
  { id: "about", label: "About", href: "/about", kind: "publication", group: "publication", order: 40, more: true },
  { id: "advertise", label: "Advertise", href: "/advertise", kind: "publication", group: "publication", order: 50, more: true },
  { id: "contact", label: "Contact", href: "/contact", kind: "publication", group: "publication", order: 60, more: true },
];

export type NavigationLink = {
  id: string;
  label: string;
  href: string;
  kind: NavigationKind;
  priority: number;
};

export type NavigationGroupLinks = {
  id: NavigationGroup;
  label: string;
  links: NavigationLink[];
};

export type ResolvedNavigation = {
  /** Editorial row in reading order; collapse into More by ascending priority. */
  primary: NavigationLink[];
  /** More-menu columns in canonical group order; empty groups are dropped. */
  groups: NavigationGroupLinks[];
  /** Active featured promotion from config, if any. `null` means "configured off". */
  featured?: { label: string; href: string } | null;
};

export type NavigationContext = {
  /** This paper's slug. */
  publication: string;
  /** Sections the publication configures (profile taxonomy). */
  sections?: string[];
  /** Sections observed in the live feed; they satisfy a section gate too. */
  discovered?: string[];
  /** Publication feature flags. */
  featureEnabled?: (feature: string) => boolean;
  /** Record-stored overrides. Invalid entries are ignored, never fatal. */
  config?: NavigationConfig | null;
  now?: Date;
};

const MAX_LABEL = 60;

/** Only same-site destinations: an absolute path without protocol or host tricks. */
function safeHref(href: unknown): string | null {
  if (typeof href !== "string") return null;
  const value = href.trim();
  if (!value.startsWith("/") || value.startsWith("//") || /[\s\\]/.test(value)) return null;
  return value;
}

function safeLabel(label: unknown): string | null {
  if (typeof label !== "string") return null;
  const value = label.trim();
  return value && value.length <= MAX_LABEL ? value : null;
}

const GROUP_IDS = new Set(NAVIGATION_GROUPS.map(group => group.id));
const KINDS = new Set<NavigationKind>(["editorial", "product", "marketplace", "publication"]);

/** Apply record overrides defensively: the record is data, never trusted markup or routing. */
export function applyNavigationConfig(
  defaults: NavigationDestination[],
  config: NavigationConfig | null | undefined,
): NavigationDestination[] {
  const merged = new Map(defaults.map(destination => [destination.id, { ...destination }]));
  for (const override of config?.destinations ?? []) {
    if (!override || typeof override.id !== "string" || !override.id) continue;
    const current = merged.get(override.id);
    const label = safeLabel(override.label);
    const href = safeHref(override.href);
    if (!current && !(label && href)) continue; // An addition needs a usable label and href.
    const next: NavigationDestination = current ? { ...current } : {
      id: override.id, label: label as string, href: href as string,
      kind: "product", order: 1000, priority: 0,
    };
    if (label) next.label = label;
    if (href) next.href = href;
    if (typeof override.order === "number" && Number.isFinite(override.order)) next.order = override.order;
    if (typeof override.priority === "number" && Number.isFinite(override.priority)) next.priority = override.priority;
    if (typeof override.enabled === "boolean") next.enabled = override.enabled;
    if (typeof override.primary === "boolean") next.primary = override.primary;
    if (typeof override.more === "boolean") next.more = override.more;
    if (override.group && GROUP_IDS.has(override.group)) next.group = override.group;
    if (override.kind && KINDS.has(override.kind)) next.kind = override.kind;
    if (typeof override.section === "string") next.section = override.section;
    if (typeof override.feature === "string") next.feature = override.feature;
    if (Array.isArray(override.publications)) next.publications = override.publications.filter(slug => typeof slug === "string");
    merged.set(next.id, next);
  }
  return Array.from(merged.values());
}

function activeFeatured(config: NavigationConfig | null | undefined, now: Date): ResolvedNavigation["featured"] {
  if (config?.featured === null) return null;
  const featured = config?.featured;
  if (!featured) return undefined;
  const label = safeLabel(featured.label);
  const href = safeHref(featured.href);
  if (!label || !href) return undefined;
  const time = now.getTime();
  if (featured.from && time < Date.parse(featured.from)) return undefined;
  if (featured.until && time >= Date.parse(featured.until)) return undefined;
  return { label, href };
}

/** The one place that decides what every reader-facing menu shows. */
export function resolveNavigation(context: NavigationContext): ResolvedNavigation {
  const now = context.now ?? new Date();
  const sections = new Set([...(context.sections ?? []), ...(context.discovered ?? [])]);
  const featureEnabled = context.featureEnabled ?? (() => false);
  const destinations = applyNavigationConfig(NETWORK_NAVIGATION, context.config);

  const visible = destinations.filter(destination => {
    if (destination.enabled === false) return false;
    if (destination.feature && !featureEnabled(destination.feature)) return false;
    if (destination.section && !sections.has(destination.section)) return false;
    if (destination.publications && !destination.publications.includes(context.publication)) return false;
    return true;
  });

  const link = (destination: NavigationDestination): NavigationLink => ({
    id: destination.id, label: destination.label, href: destination.href,
    kind: destination.kind, priority: destination.priority ?? 0,
  });

  const byOrder = (left: NavigationDestination, right: NavigationDestination) =>
    left.order - right.order || left.label.localeCompare(right.label);

  const primary = visible.filter(destination => destination.primary).sort(byOrder).map(link);

  // A section alive in the feed but absent from the configuration still deserves a
  // reachable destination; it joins News & knowledge instead of stretching the row.
  const covered = new Set(destinations.map(destination => destination.section).filter(Boolean));
  const stray = [...new Set(context.discovered ?? [])]
    .filter(name => name !== "Local news" && !covered.has(name))
    .sort((left, right) => left.localeCompare(right))
    .map((name): NavigationLink => {
      const definition = sectionDefinition(name);
      return { id: definition.id, label: definition.label, href: sectionPath(name), kind: "editorial", priority: 0 };
    });

  const groups = NAVIGATION_GROUPS.map(group => ({
    ...group,
    links: [
      ...visible.filter(destination => destination.more && destination.group === group.id).sort(byOrder).map(link),
      ...(group.id === "news-knowledge" ? stray : []),
    ],
  })).filter(group => group.links.length > 0);

  return { primary, groups, featured: activeFeatured(context.config, now) };
}
