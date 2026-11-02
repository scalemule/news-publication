/**
 * ScaleMule Ads: the page-plan contract and format catalog shared by every
 * ScaleMule-hosted property (ADR-2026-10-29-scalemule-ads, sections 5 and 6).
 *
 * Nothing here touches the network or the DOM. The property's server asks
 * `scalemule-ads` for one plan per page request (./ads-server.ts) and renders
 * each delivery with `<AdSlot>` (./ad-slot.tsx). Creatives are structured
 * content, never third-party markup, so every unit is rendered by the
 * publication's own typography inside a fixed, reserved box.
 */

export type AdFormatKey =
  | "band"
  | "column"
  | "inline_card"
  | "partner_footer"
  | "credit_line"
  | "showcase";

export const AD_FORMAT_KEYS: readonly AdFormatKey[] = [
  "band",
  "column",
  "inline_card",
  "partner_footer",
  "credit_line",
  "showcase",
];

/** Placement keys are defined per property; these are the paper defaults. */
export type AdPlacementKey =
  | "leaderboard"
  | "article_inline"
  | "sidebar"
  | "partner_footer"
  | "masthead_credit"
  | (string & {});

export type AdPageType = "front" | "section" | "article" | "utility";
/** From the content-safety classification, never the template; unknown fails closed. */
export type AdSensitivity = "clear" | "sensitive" | "unknown";
export type AdLengthClass = "short" | "standard" | "long";
export type AdMeasurementTier = "cookieless" | "performance" | "advertising";
export type AdLabelKey = "advertisement" | "sponsored";

export type AdPlanRequest = {
  property: { publication_id?: string };
  page: {
    type: AdPageType;
    path: string;
    section?: string;
    towns?: string[];
    topics?: string[];
    sensitivity: AdSensitivity;
    content_id?: string;
  };
  layout: {
    length_class: AdLengthClass;
    /** Eligible inline anchors already filtered by the template (`adInsertionPoints`). */
    insertion_points: string[];
    sidebar: boolean;
  };
  placements: AdPlacementKey[];
  reader: { tier: AdMeasurementTier };
  /** Forwarded from `?sm_ad_preview=`; a signed token that forces one creative revision. */
  preview_token?: string;
};

export type AdImage = {
  url: string;
  width: number;
  height: number;
  alt?: string;
};

/**
 * How a creative is drawn. `typographic` (default): the brand kit, wordmark and
 * copy on the brand surface. `photo`: a brand photograph fills the unit and the
 * copy sits beside it or on a scrim. `artwork`: finished art per format at the
 * exact box, nothing drawn over it; falls back to `photo`, then `typographic`,
 * for a format without art.
 */
export type AdCreativeMode = "typographic" | "photo" | "artwork";

export type AdArtworkKey =
  | "band"
  | "band_mobile"
  | "column"
  | "inline_card"
  | "inline_card_mobile"
  | "partner_footer"
  | "partner_footer_mobile";

/** Exact boxes for finished art; `inline_card_mobile` is any 3:2 image. */
export const AD_ARTWORK_BOXES: Record<AdArtworkKey, { width: number; height: number } | { ratio: number }> = {
  band: { width: 1200, height: 280 },
  band_mobile: { width: 360, height: 360 },
  column: { width: 300, height: 520 },
  inline_card: { width: 680, height: 350 },
  inline_card_mobile: { ratio: 1.5 },
  partner_footer: { width: 1200, height: 240 },
  partner_footer_mobile: { width: 360, height: 300 },
};
export const AD_ARTWORK_KEYS = Object.keys(AD_ARTWORK_BOXES) as AdArtworkKey[];

export type AdArtwork = Partial<Record<AdArtworkKey, AdImage>>;

export type AdCreativeContent = {
  advertiser: string;
  headline: string;
  description: string;
  cta: string;
  logo?: AdImage | null;
  image?: AdImage | null;
  /** `credit_line` only. */
  link_label?: string;
  mode?: AdCreativeMode;
  /** `photo` mode: a wide photograph (about 1200×420) for band and partner_footer. */
  image_wide?: AdImage | null;
  /** `photo` mode: a tall photograph (about 300×400) for column. */
  image_tall?: AdImage | null;
  /** `photo` mode: where the photograph's subject is, 0–1 from the top-left; drives object-position. */
  focal?: { x: number; y: number } | null;
  /** `artwork` mode: finished art per format at the exact box (AD_ARTWORK_BOXES). */
  artwork?: AdArtwork | null;
  /** `artwork` mode: draw a 44 px CTA strip under the art when `cta` is set. */
  artwork_cta?: boolean;
};

/** What an advertiser submits; `destination_url` never reaches a page. */
export type AdCreativeDraft = AdCreativeContent & { destination_url?: string };

/** `#rrggbb`, lowercase. */
export type AdHex = string;

export type AdBrandFooter = { surface: AdHex; ink: AdHex; ink_muted: AdHex };

export type AdBrandSecondary = {
  label: string;
  /** Wire only: the advertiser's https URL. `sealAdPlan` replaces it with `href`. */
  url?: string;
  /** Page only: the property's own `/go/{id}?to=…&s=…&direct=1` link. */
  href?: string;
};

/**
 * The advertiser's brand kit (ADR section 5, revision 9): every unit is drawn
 * in the advertiser's own surface, ink and accent, with a typographic wordmark
 * in the paper's display serif, an eyebrow above it, a context line beneath it
 * and an optional secondary link. Colors are plain hex so the unit never depends
 * on the publication's tokens or on modern color functions.
 */
export type AdBrand = {
  surface: AdHex;
  ink: AdHex;
  ink_muted: AdHex;
  accent: AdHex;
  on_accent: AdHex;
  /** Light variant for `partner_footer`; computed from `surface` when absent. */
  footer?: AdBrandFooter | null;
  /** Text wordmark; `mark` (for example ".") is drawn in `accent` after the text. */
  wordmark?: { text: string; mark?: string } | null;
  /** Above the wordmark, for example "Our website partner". */
  eyebrow?: string | null;
  /** Beneath the wordmark, already resolved by the service ("Lazy Tensor is built on napsite.com"). */
  context?: string | null;
  secondary?: AdBrandSecondary | null;
};

export const AD_BRAND_LIMITS = {
  wordmark: 24,
  mark: 2,
  eyebrow: 40,
  context: 80,
  secondary_label: 32,
} as const;

/** The NapSite palette: what a unit uses when the delivery carries no brand. */
export const DEFAULT_AD_BRAND: AdBrand = {
  surface: "#173d32",
  ink: "#ffffff",
  ink_muted: "#d6e5dd",
  accent: "#f1d8a7",
  on_accent: "#173d32",
};

export const AD_FOOTER_SURFACE = "#edf1ed";

export type AdAdvertiserKind = "house" | "direct" | "agency";

export type AdDelivery = {
  delivery_id: string;
  flight_id: string;
  creative_id: string;
  revision: number;
  format: AdFormatKey;
  content: AdCreativeContent;
  /** Always the property's own click route; the DOM never carries a destination. */
  href: string;
  label: AdLabelKey;
  about: {
    advertiser: string;
    policy_path?: string;
    kind?: AdAdvertiserKind;
    disclosure?: string;
  };
  insertion_point?: string;
  /** The advertiser's brand kit; absent means the default (NapSite) palette. */
  brand?: AdBrand;
};

/**
 * What the service emits (contracts/ad-plan.schema.json). `destination_url`
 * and `tier` are server-to-server only: `getAdPlan` signs the fallback href
 * from them and strips them before the plan reaches a page.
 */
export type AdWireDelivery = AdDelivery & {
  destination_url?: string;
  tier?: AdMeasurementTier;
};

/** "ok" is a real answer (possibly with no deliveries); "unavailable" means the service could not be asked. */
export type AdPlanStatus = "ok" | "unavailable";

export type AdPlanReason = "policy_stale" | "sensitive" | "blocked" | "no_inventory" | "preview";

export type AdPlan = {
  status: AdPlanStatus;
  plan_id: string;
  policy_snapshot_at: string;
  deliveries: Partial<Record<AdPlacementKey, AdDelivery>>;
  empty: AdPlacementKey[];
  /** Why the service returned no (or forced) deliveries; informational. */
  reason?: AdPlanReason;
  /** The flight that won page exclusivity, or null. */
  page_sponsor?: string | null;
  /** A preview token forced the creative; not counted anywhere. */
  preview?: boolean;
};

export type AdBox = { width: number; height?: number; minHeight?: number };
export type AdFormatSpec = {
  key: AdFormatKey;
  desktop: AdBox | "text";
  mobile: AdBox | "text" | "collapses_to_band";
  image: "none" | "optional_1_1" | "optional_3_2" | "required_1280_900";
  logo: boolean;
  theme: "paper" | "light";
};

/** Section 5 of the ADR. Boxes are reserved so nothing shifts after paint. */
export const AD_FORMATS: Record<AdFormatKey, AdFormatSpec> = {
  band: {
    key: "band",
    desktop: { width: 1200, height: 280 },
    mobile: { width: 360, minHeight: 320 },
    image: "optional_1_1",
    logo: true,
    theme: "paper",
  },
  column: {
    key: "column",
    desktop: { width: 300, height: 520 },
    mobile: "collapses_to_band",
    image: "optional_1_1",
    logo: true,
    theme: "paper",
  },
  inline_card: {
    key: "inline_card",
    desktop: { width: 680, minHeight: 320 },
    mobile: { width: 360, minHeight: 360 },
    image: "optional_3_2",
    logo: true,
    theme: "paper",
  },
  partner_footer: {
    key: "partner_footer",
    desktop: { width: 1200, height: 240 },
    mobile: { width: 360, minHeight: 300 },
    image: "none",
    logo: true,
    theme: "light",
  },
  credit_line: {
    key: "credit_line",
    desktop: "text",
    mobile: "text",
    image: "none",
    logo: false,
    theme: "paper",
  },
  showcase: {
    key: "showcase",
    desktop: { width: 1200, height: 390 },
    mobile: { width: 360, minHeight: 560 },
    image: "required_1280_900",
    logo: true,
    theme: "paper",
  },
};

/** Hard limits, counted in Unicode code points. */
export const AD_COPY_LIMITS = {
  advertiser: 60,
  headline: 60,
  description: 120,
  cta: 28,
  link_label: 40,
} as const;

export const AD_LABELS: Record<AdLabelKey, string> = {
  advertisement: "Advertisement",
  sponsored: "Sponsored",
};

export const AD_ABOUT_SENTENCE =
  "Selected for this page's section and area, not for you.";

export const AD_EDITORIAL_INDEPENDENCE_SENTENCE =
  "Advertising and editorial content are managed separately. This placement does not represent an editorial endorsement.";

export const AD_REPORT_REASONS = [
  ["inappropriate", "Inappropriate or offensive"],
  ["misleading", "Misleading or false"],
  ["broken", "Broken or wrong destination"],
  ["irrelevant", "Not relevant to this page"],
  ["other", "Something else"],
] as const;
export type AdReportReason = (typeof AD_REPORT_REASONS)[number][0];

export const UUID_V7 =
  /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type AdValidationError = {
  field: string;
  code: "required" | "too_long" | "markup" | "scheme" | "ratio" | "image_required";
  message: string;
};
export type AdValidation = { ok: boolean; errors: AdValidationError[] };

const length = (value: string) => Array.from(value).length;
const MARKUP = /[<>]/;

function text(
  errors: AdValidationError[],
  field: keyof typeof AD_COPY_LIMITS,
  value: unknown,
  required: boolean,
) {
  const str = typeof value === "string" ? value.trim() : "";
  if (!str) {
    if (required)
      errors.push({ field, code: "required", message: `${field} is required.` });
    return;
  }
  if (MARKUP.test(str))
    errors.push({ field, code: "markup", message: `${field} cannot contain markup.` });
  const max = AD_COPY_LIMITS[field];
  if (length(str) > max)
    errors.push({ field, code: "too_long", message: `${field} is limited to ${max} characters.` });
}

function ratio(image: AdImage | null | undefined): number | null {
  if (!image || !(image.width > 0) || !(image.height > 0)) return null;
  return image.width / image.height;
}

/** Approval-time rules from section 5. Serving reads only approved revisions. */
export function validateCreativeContent(
  content: AdCreativeDraft,
  format: AdFormatKey,
): AdValidation {
  const errors: AdValidationError[] = [];
  const spec = AD_FORMATS[format];
  if (!spec) {
    return { ok: false, errors: [{ field: "format", code: "required", message: "Unknown format." }] };
  }
  text(errors, "advertiser", content.advertiser, true);
  if (format === "credit_line") {
    text(errors, "link_label", content.link_label, true);
  } else {
    text(errors, "headline", content.headline, true);
    text(errors, "description", content.description, true);
    text(errors, "cta", content.cta, true);
    text(errors, "link_label", content.link_label, false);
  }
  if (content.destination_url !== undefined) {
    const url = String(content.destination_url).trim();
    let ok = false;
    try {
      const parsed = new URL(url);
      ok = parsed.protocol === "https:" && !parsed.username && !parsed.password;
    } catch {
      ok = false;
    }
    if (!ok)
      errors.push({ field: "destination_url", code: "scheme", message: "Destination must be an HTTPS URL without credentials." });
  }
  if (spec.logo && !content.logo?.url)
    errors.push({ field: "logo", code: "required", message: "A logo is required for this format." });
  if (content.logo?.alt && MARKUP.test(content.logo.alt))
    errors.push({ field: "logo", code: "markup", message: "Logo alt text cannot contain markup." });
  const r = ratio(content.image);
  if (spec.image === "none" && content.image?.url)
    errors.push({ field: "image", code: "ratio", message: "This format does not take an image." });
  if (spec.image === "required_1280_900" && !content.image?.url)
    errors.push({ field: "image", code: "image_required", message: "A 1280×900 screenshot is required." });
  if (content.image?.url && r !== null) {
    const want =
      spec.image === "optional_1_1" ? 1 : spec.image === "optional_3_2" ? 1.5 : spec.image === "required_1280_900" ? 1280 / 900 : null;
    if (want !== null && Math.abs(r - want) > 0.02)
      errors.push({ field: "image", code: "ratio", message: `Image must be cropped to ${spec.image.replace("optional_", "").replace("required_", "").replace("_", ":")}.` });
    if (content.image.alt && MARKUP.test(content.image.alt))
      errors.push({ field: "image", code: "markup", message: "Image alt text cannot contain markup." });
  }
  return { ok: errors.length === 0, errors };
}

/**
 * Authoritative article sensitivity for ad decisions (ADR §6.2 step 2). Only the
 * platform classification counts; a missing or malformed field is `unknown`, and the
 * service treats unknown article pages as sensitive (no deliveries). Never derive this
 * from tags, sections or template heuristics.
 */
export function adSensitivity(
  article: { content_safety?: unknown } | null | undefined,
): AdSensitivity {
  const value = article?.content_safety as { classification?: unknown } | null | undefined;
  if (!value || typeof value !== "object") return "unknown";
  return value.classification === "sensitive"
    ? "sensitive"
    : value.classification === "clear"
      ? "clear"
      : "unknown";
}

export function emptyAdPlan(): AdPlan {
  return { status: "ok", plan_id: "", policy_snapshot_at: "", deliveries: {}, empty: [] };
}

/** The plan a page gets when the service could not be asked (timeout, error, bad envelope). */
export function unavailableAdPlan(): AdPlan {
  return { ...emptyAdPlan(), status: "unavailable" };
}

const LABELS = new Set<string>(["advertisement", "sponsored"]);
const ADVERTISER_KINDS = new Set<string>(["house", "direct", "agency"]);
const REASONS = new Set<string>(["policy_stale", "sensitive", "blocked", "no_inventory", "preview"]);
const TIERS = new Set<string>(["cookieless", "performance", "advertising"]);
const FORMATS = new Set<string>(AD_FORMAT_KEYS);
const MODES = new Set<string>(["typographic", "photo", "artwork"]);
const isUnit = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v) && v >= 0 && v <= 1;

/** True when `art` is exactly the box for `key` (or the 3:2 ratio for the mobile card). */
export function artworkFits(key: AdArtworkKey, art: AdImage): boolean {
  const box = AD_ARTWORK_BOXES[key];
  if ("ratio" in box) return art.height > 0 && Math.abs(art.width / art.height - box.ratio) <= 0.02;
  return art.width === box.width && art.height === box.height;
}
const isString = (v: unknown): v is string => typeof v === "string";
const isUuid7 = (v: unknown): v is string => isString(v) && UUID_V7.test(v);
const isCount = (v: unknown): v is number => typeof v === "number" && Number.isInteger(v) && v > 0;

function image(value: unknown): AdImage | null | undefined {
  if (value === null || value === undefined) return value;
  if (!value || typeof value !== "object") return undefined;
  const v = value as Record<string, unknown>;
  if (!isString(v.url) || !/^https:\/\//i.test(v.url) || !isCount(v.width) || !isCount(v.height)) return undefined;
  if (v.alt !== undefined && !isString(v.alt)) return undefined;
  const out: AdImage = { url: v.url, width: v.width, height: v.height };
  if (isString(v.alt)) out.alt = v.alt;
  return out;
}

export const AD_HEX = /^#[0-9a-f]{6}$/;
const isHex = (v: unknown): v is AdHex => isString(v) && AD_HEX.test(v);

function shortLine(value: unknown, max: number): string | null | undefined {
  if (value === null || value === undefined) return value;
  if (!isString(value)) return undefined;
  const str = value.trim();
  if (!str || MARKUP.test(str) || Array.from(str).length > max) return undefined;
  return str;
}

/** Mixes two hex colors (`t` toward `b`) and returns plain hex; no CSS color functions on the page. */
export function mixHex(a: AdHex, b: AdHex, t: number): AdHex {
  const ch = (hex: string, i: number) => parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16);
  const out = [0, 1, 2].map((i) => Math.round(ch(a, i) + (ch(b, i) - ch(a, i)) * t));
  return "#" + out.map((n) => Math.max(0, Math.min(255, n)).toString(16).padStart(2, "0")).join("");
}

/** The light footer palette for a brand: light field, the brand surface as ink. */
export function footerPalette(brand: AdBrand): AdBrandFooter {
  if (brand.footer) return brand.footer;
  return { surface: AD_FOOTER_SURFACE, ink: brand.surface, ink_muted: mixHex(brand.surface, AD_FOOTER_SURFACE, 0.35) };
}

function validateAdSecondary(value: unknown): AdBrandSecondary | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const sec = value as Record<string, unknown>;
  const label = shortLine(sec.label, AD_BRAND_LIMITS.secondary_label);
  if (!label) return null;
  const secondary: AdBrandSecondary = { label };
  if (isString(sec.url) && /^https:\/\//i.test(sec.url)) secondary.url = sec.url;
  if (isString(sec.href) && sec.href.startsWith("/go/")) secondary.href = sec.href;
  return secondary.url || secondary.href ? secondary : null;
}

/** A structurally valid brand kit, or null when anything about it is wrong. */
export function validateAdBrand(value: unknown): AdBrand | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const b = value as Record<string, unknown>;
  if (!isHex(b.surface) || !isHex(b.ink) || !isHex(b.ink_muted) || !isHex(b.accent) || !isHex(b.on_accent)) return null;
  const out: AdBrand = { surface: b.surface, ink: b.ink, ink_muted: b.ink_muted, accent: b.accent, on_accent: b.on_accent };
  if (b.footer !== undefined && b.footer !== null) {
    const f = b.footer as Record<string, unknown>;
    if (!f || typeof f !== "object" || !isHex(f.surface) || !isHex(f.ink) || !isHex(f.ink_muted)) return null;
    out.footer = { surface: f.surface, ink: f.ink, ink_muted: f.ink_muted };
  }
  if (b.wordmark !== undefined && b.wordmark !== null) {
    const w = b.wordmark as Record<string, unknown>;
    if (!w || typeof w !== "object") return null;
    const text = shortLine(w.text, AD_BRAND_LIMITS.wordmark);
    if (!text) return null;
    const mark = w.mark === undefined ? undefined : shortLine(w.mark, AD_BRAND_LIMITS.mark);
    if (mark === undefined && w.mark !== undefined) return null;
    out.wordmark = mark ? { text, mark } : { text };
  }
  const eyebrow = shortLine(b.eyebrow, AD_BRAND_LIMITS.eyebrow);
  if (eyebrow === undefined && b.eyebrow !== undefined) return null;
  if (eyebrow) out.eyebrow = eyebrow;
  const context = shortLine(b.context, AD_BRAND_LIMITS.context);
  if (context === undefined && b.context !== undefined) return null;
  if (context) out.context = context;
  // An unusable secondary link is dropped on its own; the rest of the kit is kept.
  const secondary = validateAdSecondary(b.secondary);
  if (secondary) out.secondary = secondary;
  return out;
}

/** A structurally valid delivery (wire shape), or null. Never throws. */
export function validateAdDelivery(value: unknown): AdWireDelivery | null {
  if (!value || typeof value !== "object") return null;
  const d = value as Record<string, unknown>;
  if (!isUuid7(d.delivery_id) || !isUuid7(d.flight_id) || !isUuid7(d.creative_id)) return null;
  if (!isCount(d.revision)) return null;
  if (!isString(d.format) || !FORMATS.has(d.format)) return null;
  if (!isString(d.href) || !d.href.startsWith("/")) return null;
  if (!isString(d.label) || !LABELS.has(d.label)) return null;
  const about = d.about as Record<string, unknown> | undefined;
  if (!about || typeof about !== "object" || !isString(about.advertiser)) return null;
  if (about.policy_path !== undefined && (!isString(about.policy_path) || !about.policy_path.startsWith("/"))) return null;
  if (about.kind !== undefined && (!isString(about.kind) || !ADVERTISER_KINDS.has(about.kind))) return null;
  const aboutDisclosure = shortLine(about.disclosure, 280);
  if (about.disclosure !== undefined && !aboutDisclosure) return null;
  const c = d.content as Record<string, unknown> | undefined;
  if (!c || typeof c !== "object") return null;
  if (!isString(c.advertiser) || !isString(c.headline) || !isString(c.description) || !isString(c.cta)) return null;
  if (c.link_label !== undefined && !isString(c.link_label)) return null;
  const logo = image(c.logo);
  const picture = image(c.image);
  if (logo === undefined && c.logo !== undefined) return null;
  if (picture === undefined && c.image !== undefined) return null;
  const wide = image(c.image_wide);
  const tall = image(c.image_tall);
  if (wide === undefined && c.image_wide !== undefined) return null;
  if (tall === undefined && c.image_tall !== undefined) return null;
  if (c.mode !== undefined && !(isString(c.mode) && MODES.has(c.mode))) return null;
  if (c.artwork_cta !== undefined && typeof c.artwork_cta !== "boolean") return null;
  let focal: { x: number; y: number } | null | undefined;
  if (c.focal !== undefined && c.focal !== null) {
    const f = c.focal as Record<string, unknown>;
    if (!f || typeof f !== "object" || !isUnit(f.x) || !isUnit(f.y)) return null;
    focal = { x: f.x, y: f.y };
  }
  // Finished art must match its format box exactly; a wrong size drops that entry only.
  let artwork: AdArtwork | null | undefined;
  if (c.artwork !== undefined && c.artwork !== null) {
    if (!c.artwork || typeof c.artwork !== "object" || Array.isArray(c.artwork)) return null;
    artwork = {};
    for (const key of AD_ARTWORK_KEYS) {
      const raw = (c.artwork as Record<string, unknown>)[key];
      if (raw === undefined || raw === null) continue;
      const art = image(raw);
      if (art && artworkFits(key, art)) artwork[key] = art;
    }
  }
  if (d.insertion_point !== undefined && !isString(d.insertion_point)) return null;
  if (d.destination_url !== undefined && !isString(d.destination_url)) return null;
  if (d.tier !== undefined && (!isString(d.tier) || !TIERS.has(d.tier))) return null;
  const content: AdCreativeContent = {
    advertiser: c.advertiser,
    headline: c.headline,
    description: c.description,
    cta: c.cta,
    logo: logo ?? null,
    image: picture ?? null,
  };
  if (isString(c.link_label)) content.link_label = c.link_label;
  if (isString(c.mode)) content.mode = c.mode as AdCreativeMode;
  if (wide) content.image_wide = wide;
  if (tall) content.image_tall = tall;
  if (focal) content.focal = focal;
  if (artwork && Object.keys(artwork).length) content.artwork = artwork;
  if (typeof c.artwork_cta === "boolean") content.artwork_cta = c.artwork_cta;
  const normalizedAbout: AdDelivery["about"] = { advertiser: about.advertiser };
  if (isString(about.policy_path)) normalizedAbout.policy_path = about.policy_path;
  if (isString(about.kind)) normalizedAbout.kind = about.kind as AdAdvertiserKind;
  if (aboutDisclosure) normalizedAbout.disclosure = aboutDisclosure;
  const out: AdWireDelivery = {
    delivery_id: d.delivery_id.toLowerCase(),
    flight_id: d.flight_id.toLowerCase(),
    creative_id: d.creative_id.toLowerCase(),
    revision: d.revision,
    format: d.format as AdFormatKey,
    content,
    href: d.href,
    label: d.label as AdLabelKey,
    about: normalizedAbout,
  };
  if (isString(d.insertion_point)) out.insertion_point = d.insertion_point;
  // A malformed brand kit falls back to the default palette; it never costs the delivery.
  if (d.brand !== undefined && d.brand !== null) {
    const brand = validateAdBrand(d.brand);
    if (brand) out.brand = brand;
  }
  if (isString(d.destination_url)) out.destination_url = d.destination_url;
  if (isString(d.tier)) out.tier = d.tier as AdMeasurementTier;
  return out;
}

/**
 * Deep-validates a service response. Invalid deliveries are dropped into
 * `empty`; an unusable envelope yields the empty plan. Never throws.
 */
export function normalizeAdPlan(value: unknown): AdPlan & { deliveries: Partial<Record<AdPlacementKey, AdWireDelivery>> } {
  if (!value || typeof value !== "object") return unavailableAdPlan();
  const plan = value as Record<string, unknown>;
  if (plan.status !== "ok") return unavailableAdPlan();
  if (!isString(plan.plan_id) || !isString(plan.policy_snapshot_at)) return unavailableAdPlan();
  if (!plan.deliveries || typeof plan.deliveries !== "object" || Array.isArray(plan.deliveries)) return unavailableAdPlan();
  const empty = new Set<string>(Array.isArray(plan.empty) ? plan.empty.filter(isString) : []);
  const deliveries: Partial<Record<AdPlacementKey, AdWireDelivery>> = {};
  for (const [placement, raw] of Object.entries(plan.deliveries as Record<string, unknown>)) {
    if (!/^[a-z0-9_]{1,40}$/.test(placement)) continue;
    const delivery = validateAdDelivery(raw);
    if (delivery) deliveries[placement] = delivery;
    else empty.add(placement);
  }
  const out: AdPlan & { deliveries: Partial<Record<AdPlacementKey, AdWireDelivery>> } = {
    status: "ok",
    plan_id: plan.plan_id,
    policy_snapshot_at: plan.policy_snapshot_at,
    deliveries,
    empty: [...empty],
  };
  if (isString(plan.reason) && REASONS.has(plan.reason)) out.reason = plan.reason as AdPlanReason;
  if (plan.page_sponsor === null || isUuid7(plan.page_sponsor)) out.page_sponsor = plan.page_sponsor === null ? null : (plan.page_sponsor as string).toLowerCase();
  if (typeof plan.preview === "boolean") out.preview = plan.preview;
  return out;
}

/** True when every delivery in `value` is structurally valid. */
export function isAdPlan(value: unknown): value is AdPlan {
  if (!value || typeof value !== "object") return false;
  const plan = value as Record<string, unknown>;
  if (plan.status !== "ok" || !isString(plan.plan_id) || !isString(plan.policy_snapshot_at) || !Array.isArray(plan.empty)) return false;
  if (!plan.deliveries || typeof plan.deliveries !== "object" || Array.isArray(plan.deliveries)) return false;
  return Object.values(plan.deliveries as Record<string, unknown>).every((d) => validateAdDelivery(d) !== null);
}

/** Section 5: short pages get no inline unit and at most one unit in total. */
export function lengthClass(wordCount: number, paragraphCount: number): AdLengthClass {
  if (!(wordCount >= 600) || !(paragraphCount >= 8)) return "short";
  return wordCount >= 1400 ? "long" : "standard";
}

export type InsertionOptions = {
  /** 1-based paragraph numbers immediately followed by a photo or embed. */
  hasPhotoAt?: number[];
  /** 1-based paragraph numbers immediately followed by a pull quote. */
  hasPullQuoteAt?: number[];
  lengthClass?: AdLengthClass;
  /** Minimum paragraphs between candidates (about one phone screen of text). */
  spacing?: number;
};

/**
 * Eligible inline anchors, as `p{n}` = "after paragraph n". Rules: never on a
 * short page; only after paragraph 4; at least two paragraphs of text after the
 * unit; never adjacent to a photo, embed or pull quote; one screen apart.
 */
export function adInsertionPoints(
  paragraphCount: number,
  options: InsertionOptions = {},
): string[] {
  if (options.lengthClass === "short" || !(paragraphCount >= 8)) return [];
  const blocked = new Set<number>();
  for (const n of [...(options.hasPhotoAt ?? []), ...(options.hasPullQuoteAt ?? [])]) {
    blocked.add(n);
    blocked.add(n + 1);
    blocked.add(n - 1);
  }
  const spacing = options.spacing ?? 6;
  const points: string[] = [];
  let last = -Infinity;
  for (let n = 4; n <= paragraphCount - 2; n++) {
    if (blocked.has(n) || n - last < spacing) continue;
    points.push(`p${n}`);
    last = n;
  }
  return points;
}
