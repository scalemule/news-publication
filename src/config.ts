import { FEATURE_NAMES, type FeatureName, type NewsPublication, type PublicationInput, type PublicationTheme } from "./types";

/** Walnut Creek Times broadsheet colors. A paper overrides only what it changes. */
export const BROADSHEET_THEME: PublicationTheme = {
  accent: "#bb171d",
  ink: "#171917",
  paper: "#ffffff",
  sponsor: "#173d32",
};

const DISABLED_FEATURES: Record<FeatureName, boolean> = {
  smile: false,
  comments: false,
  chat: false,
  jobs: false,
  classifieds: false,
  referrals: false,
  coupons: false,
};

export function featureEnabled(publication: NewsPublication, feature: FeatureName): boolean {
  return publication.features[feature] === true;
}

/**
 * Build a paper from the Walnut Creek Times defaults.
 * Identity, towns, and feature flags are the only required differences.
 */
export function definePublication(input: PublicationInput): NewsPublication {
  if (!input.slug.trim() || !input.name.trim()) throw new Error("A publication needs a slug and a name");
  if (!input.towns.length) throw new Error("A publication needs at least one covered town");
  const layout = input.layout ?? "broadsheet";
  const layouts = [...new Set([layout, ...(input.layouts ?? ["broadsheet"])])];
  const referralsEnabled = input.features?.referrals === true || input.referrals?.enabled === true;
  const couponsEnabled = input.features?.coupons === true || input.coupons?.enabled === true;
  const features = { ...DISABLED_FEATURES, ...input.features, referrals: referralsEnabled, coupons: couponsEnabled };
  for (const name of FEATURE_NAMES) features[name] = features[name] === true;
  return {
    slug: input.slug,
    name: input.name,
    masthead: input.masthead.length ? input.masthead : [input.name],
    region: input.region,
    regionLabel: input.regionLabel,
    towns: input.towns,
    nearbyTowns: input.nearbyTowns ?? [],
    sections: input.sections ?? [],
    description: input.description,
    tagline: input.tagline ?? "Local stories. Close to home.",
    briefTitle: input.briefTitle ?? `${input.regionLabel} in Brief`,
    parent: input.parent === true,
    layout,
    layouts,
    features,
    theme: { ...BROADSHEET_THEME, ...input.theme },
    referrals: { queryParam: input.referrals?.queryParam?.trim() || "ref", enabled: referralsEnabled },
    coupons: { enabled: couponsEnabled, offers: input.coupons?.offers ?? [], resolve: input.coupons?.resolve },
    modules: input.modules ?? {},
    matchTag: input.matchTag,
  };
}

/** Cookie a reader layout preference is stored in. Absent cookie means the paper default. */
export const LAYOUT_COOKIE = "news_publication_layout";

/**
 * Crawlers and readers with no cookie get `publication.layout`.
 * A cookie is honored only when that paper listed the layout.
 */
export function resolveLayout(publication: NewsPublication, cookieValue?: string | null): string {
  const requested = cookieValue?.trim();
  if (requested && publication.layouts.includes(requested)) return requested;
  return publication.layout;
}
