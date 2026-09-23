/** Public identity and behavior for one local news site. */
export type NewsLayoutId = "broadsheet" | (string & {});

export const FEATURE_NAMES = [
  "smile",
  "comments",
  "chat",
  "jobs",
  "classifieds",
  "referrals",
  "coupons",
] as const;

export type FeatureName = (typeof FEATURE_NAMES)[number];
export type FeatureFlags = Partial<Record<FeatureName, boolean>>;

export type PublicationTheme = {
  accent: string;
  ink: string;
  paper: string;
  sponsor: string;
};

export type CouponOffer = {
  code: string;
  label: string;
  /** Percent off the plan price, 0–100. */
  percentOff?: number;
  amountOffCents?: number;
  months?: number;
  planSlug?: string;
};

export type ReferralSettings = {
  enabled: boolean;
  /** Query parameter read on the landing URL. Default `ref`. */
  queryParam: string;
};

export type CouponSettings = {
  enabled: boolean;
  offers: CouponOffer[];
  /** Site-owned matcher. Used only when coupons are enabled. */
  resolve?: (code: string, offers: CouponOffer[]) => CouponOffer | null;
};

/** Named mounts a paper renders itself. The package records them; it does not render UI. */
export type PublicationModules = {
  home?: string[];
  articleEnd?: string[];
};

export type PublicationInput = {
  slug: string;
  name: string;
  masthead: string[];
  region: string;
  regionLabel: string;
  towns: string[];
  nearbyTowns?: string[];
  sections?: string[];
  description: string;
  tagline?: string;
  briefTitle?: string;
  parent?: boolean;
  /** Default presentation. Crawlers always receive this layout. */
  layout?: NewsLayoutId;
  /** Layouts a reader may choose. The default is always included. */
  layouts?: NewsLayoutId[];
  features?: FeatureFlags;
  theme?: Partial<PublicationTheme>;
  referrals?: Partial<ReferralSettings>;
  coupons?: Partial<Omit<CouponSettings, "enabled">> & { enabled?: boolean };
  modules?: PublicationModules;
  /** Extra tag rule owned by the paper, such as Walnut Creek neighborhood keywords. */
  matchTag?: (article: NewsItem, tag: string) => boolean;
};

export type NewsPublication = {
  slug: string;
  name: string;
  masthead: string[];
  region: string;
  regionLabel: string;
  towns: string[];
  nearbyTowns: string[];
  sections: string[];
  description: string;
  tagline: string;
  briefTitle: string;
  parent: boolean;
  layout: NewsLayoutId;
  layouts: NewsLayoutId[];
  features: Record<FeatureName, boolean>;
  theme: PublicationTheme;
  referrals: ReferralSettings;
  coupons: CouponSettings;
  modules: PublicationModules;
  matchTag?: (article: NewsItem, tag: string) => boolean;
};

export type TagRef = { id?: string; name: string; slug: string };
export type CategoryRef = { id?: string; name: string; slug: string };

/** Feed row shape used by Walnut Creek Times. */
export type NewsItem = {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  cover_image_url: string | null;
  published_at: string;
  updated_at: string;
  reading_time_minutes: number;
  no_index: boolean;
  section: string | null;
  author_name: string | null;
  canonical_url?: string | null;
  tags?: TagRef[];
  categories?: CategoryRef[];
};

export type NewsFeed = {
  items: NewsItem[];
  next_cursor: string | null;
  publication: { name: string };
};

export type CoverImageMetadata = {
  alt?: string;
  focal_point?: { x: number; y: number };
  ai_generated?: boolean;
  label?: string;
  caption?: string;
  attribution?: string;
  credit?: string;
};

export type ArticleCitation = { url: string; title?: string; publisher?: string };

export type NewsArticle = NewsItem & {
  content_html: string;
  subtitle?: string;
  seo_title?: string;
  seo_description?: string;
  og_image_url?: string;
  audio?: { url?: string; duration_ms?: number | null };
  metadata?: {
    cover_image?: CoverImageMetadata;
    citations?: ArticleCitation[];
    resources?: {
      kind: string;
      url: string;
      caption: string;
      attribution: string;
      ai_generated: boolean;
    }[];
  };
};

export type StoryDisplay = { display_title?: string; deck?: string; brief?: string; towns?: string[] };
export type NearbyUpdate = { slug: string; title: string; summary: string; town: string; starts: string; ends?: string };
export type HomepageSelection = {
  lead_slug?: string;
  secondary_slugs?: string[];
  brief_slugs?: string[];
  /** ISO timestamp: pinned ordering expires, never silently becomes permanent. */
  pinned_until?: string;
  stories?: Record<string, StoryDisplay>;
  nearby?: NearbyUpdate[];
};
export type EditorialSection = { name: string; label: string; id: string; items: NewsItem[] };
