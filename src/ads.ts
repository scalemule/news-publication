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

export type AdCreativeContent = {
  advertiser: string;
  headline: string;
  description: string;
  cta: string;
  logo?: AdImage | null;
  image?: AdImage | null;
  /** `credit_line` only. */
  link_label?: string;
};

/** What an advertiser submits; `destination_url` never reaches a page. */
export type AdCreativeDraft = AdCreativeContent & { destination_url?: string };

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
  about: { advertiser: string; policy_path?: string };
  insertion_point?: string;
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

export type AdPlan = {
  status: AdPlanStatus;
  plan_id: string;
  policy_snapshot_at: string;
  deliveries: Partial<Record<AdPlacementKey, AdDelivery>>;
  empty: AdPlacementKey[];
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
  cta: 20,
  link_label: 40,
} as const;

export const AD_LABELS: Record<AdLabelKey, string> = {
  advertisement: "Advertisement",
  sponsored: "Sponsored",
};

export const AD_ABOUT_SENTENCE =
  "Selected for this page's section and area, not for you.";

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
const TIERS = new Set<string>(["cookieless", "performance", "advertising"]);
const FORMATS = new Set<string>(AD_FORMAT_KEYS);
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
  const c = d.content as Record<string, unknown> | undefined;
  if (!c || typeof c !== "object") return null;
  if (!isString(c.advertiser) || !isString(c.headline) || !isString(c.description) || !isString(c.cta)) return null;
  if (c.link_label !== undefined && !isString(c.link_label)) return null;
  const logo = image(c.logo);
  const picture = image(c.image);
  if (logo === undefined && c.logo !== undefined) return null;
  if (picture === undefined && c.image !== undefined) return null;
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
  const out: AdWireDelivery = {
    delivery_id: d.delivery_id.toLowerCase(),
    flight_id: d.flight_id.toLowerCase(),
    creative_id: d.creative_id.toLowerCase(),
    revision: d.revision,
    format: d.format as AdFormatKey,
    content,
    href: d.href,
    label: d.label as AdLabelKey,
    about: isString(about.policy_path)
      ? { advertiser: about.advertiser, policy_path: about.policy_path }
      : { advertiser: about.advertiser },
  };
  if (isString(d.insertion_point)) out.insertion_point = d.insertion_point;
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
  return { status: "ok", plan_id: plan.plan_id, policy_snapshot_at: plan.policy_snapshot_at, deliveries, empty: [...empty] };
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
