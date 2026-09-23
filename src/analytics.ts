import type { NewsPublication } from "./types";

/** Bounded event contract from Walnut Creek Times. Never accept raw form or chat text. */
export const ANALYTICS_VERSION = 1;
export const ANALYTICS_COOKIE = "napsite_analytics_v1";
export const SESSION_IDLE_MS = 30 * 60 * 1000;
export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type Definition = { category: "navigation" | "engagement" | "content" | "conversion" | "system"; source: "browser" | "server" };
const browser = (category: Definition["category"]): Definition => ({ category, source: "browser" });
const server = (): Definition => ({ category: "conversion", source: "server" });

export const EVENTS: Record<string, Definition> = {
  page_viewed: browser("navigation"),
  page_engaged: browser("engagement"),
  article_read_completed: browser("content"),
  article_shared: browser("engagement"),
  promotion_viewed: browser("content"),
  promotion_clicked: browser("engagement"),
  newsletter_signup_started: browser("engagement"),
  newsletter_subscription_confirmed: server(),
  web_vital_recorded: browser("system"),
  scroll_depth_reached: browser("content"),
  navigation_clicked: browser("navigation"),
  cta_clicked: browser("engagement"),
  contact_link_clicked: browser("engagement"),
  outbound_link_clicked: browser("engagement"),
  pricing_plan_selected: browser("engagement"),
  comparison_used: browser("engagement"),
  mobile_menu_opened: browser("navigation"),
  form_started: browser("engagement"),
  form_submitted: browser("engagement"),
  form_failed: browser("system"),
  referral_landed: browser("engagement"),
  coupon_applied: browser("engagement"),
  visitor_session_created: browser("system"),
  contact_submitted: server(),
};

export const UTM_FIELDS = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"] as const;
export type Attribution = Partial<Record<(typeof UTM_FIELDS)[number], string>> & {
  referrer?: string;
  landing_page?: string;
  referral_code?: string;
};

const PUBLIC_PATHS = new Set([
  "/", "/news", "/this-week", "/newsletter", "/advertise", "/pricing", "/contact",
  "/book", "/preview", "/about", "/coverage", "/story-tip", "/corrections",
  "/how-it-works", "/privacy", "/smile", "/subscribe", "/jobs", "/jobs/post", "/classifieds", "/classifieds/post",
]);

export function shortText(value: unknown, max = 100): string | undefined {
  if (typeof value !== "string") return undefined;
  const text = value.trim();
  if (!text || /[@\r\n\u0000-\u001f]/.test(text)) return undefined;
  return Array.from(text).slice(0, max).join("");
}

/** Query strings, fragments, credentials and private paths never reach analytics. */
export function publicUrl(value: unknown, originOnly = false): string | undefined {
  if (typeof value !== "string") return undefined;
  try {
    const url = new URL(value);
    if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) return undefined;
    if (originOnly) return url.origin;
    const path = PUBLIC_PATHS.has(url.pathname)
      ? url.pathname
      : /^\/sections\/[^/]+$/.test(url.pathname)
        ? "/news/section"
        : /^\/news\/[^/]+$/.test(url.pathname) && url.pathname !== "/news/unsubscribe"
          ? "/news/article"
          : /^\/smile\/[^/]+$/.test(url.pathname)
            ? "/smile"
            : /^\/jobs\/[^/]+$/.test(url.pathname)
              ? "/jobs/opening"
              : /^\/classifieds\/[^/]+$/.test(url.pathname)
                ? "/classifieds/listing"
                : "/other";
    return url.origin + path;
  } catch {
    return undefined;
  }
}

export function attribution(url: string, referrer = "", publication?: Pick<NewsPublication, "referrals">): Attribution {
  const parsed = new URL(url);
  const result: Attribution = { landing_page: publicUrl(url) };
  const referringOrigin = publicUrl(referrer, true);
  if (referringOrigin && new URL(referringOrigin).hostname.replace(/^www\./, "") !== parsed.hostname.replace(/^www\./, "")) {
    result.referrer = referringOrigin;
  }
  for (const key of UTM_FIELDS) {
    const value = shortText(parsed.searchParams.get(key));
    if (value) result[key] = value;
  }
  if (!result.utm_source && ["gclid", "gbraid", "wbraid"].some(key => parsed.searchParams.has(key))) {
    result.utm_source = "google";
    result.utm_medium ??= "cpc";
  }
  if (!result.utm_source && parsed.searchParams.has("fbclid")) {
    result.utm_source = "facebook";
    result.utm_medium ??= "social";
  }
  if (publication?.referrals.enabled) {
    const code = shortText(parsed.searchParams.get(publication.referrals.queryParam), 64);
    if (code && /^[a-zA-Z0-9_-]+$/.test(code)) result.referral_code = code;
  }
  return result;
}
