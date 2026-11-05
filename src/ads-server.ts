/**
 * Server-only: one ad plan per page request (ADR section 6.1 and 11).
 *
 * Never import this from a client component: it carries the property's API
 * key. The plan request is answered by `scalemule-ads` through the gateway;
 * any failure, including the 150 ms timeout, yields a plan with
 * `status: "unavailable"` and no deliveries, so an ad outage can never slow
 * or break a page and is distinguishable from an intentional empty answer.
 */
import { cache } from "react";
import { buildClientContextHeaders, type ClientContext } from "@scalemule/sdk";
import { emptyAdPlan, normalizeAdPlan, unavailableAdPlan, type AdBrand, type AdDelivery, type AdPlan, type AdPlanRequest } from "./ads";
import { base64url, signClickFallback } from "./ads-signing";

export type AdScope = {
  apiKey: string;
  gatewayUrl: string;
  publicationId?: string;
  clientContext: ClientContext;
};

export const AD_PLAN_TIMEOUT_MS = 150;

const AUTOMATED_AD_UA_RE =
  /\b(bot|crawler|spider|slurp|bingpreview|mediapartners-google|adsbot-google|apis-google|googleother|google-inspectiontool|facebookexternalhit|meta-externalagent|bytespider|gptbot|oai-searchbot|chatgpt-user|claudebot|anthropic-ai|perplexitybot|ccbot|amazonbot|applebot|yandex|baiduspider|duckduckbot|semrushbot|ahrefsbot|mj12bot|dotbot|petalbot|awariobot|reflectionbot|dataforseo|barkrowler|blexbot|seekport|zoominfobot|censys|headlesschrome|phantomjs|playwright|puppeteer|lightpanda|selenium|webdriver|curl|wget|python-requests|python-urllib|aiohttp|httpx|go-http-client|java\/|okhttp|axios|node-fetch|undici|libwww-perl|scrapy)\b/i;

const FROZEN_SCRAPER_UA_SIGNATURES = [
  "Chrome/116.0.0.0",
  "Chrome/118.0.0.0",
  "Chrome/119.0.0.0",
  "Chrome/120.0.0.0",
  "Chrome/121.0.0.0",
  "Chrome/122.0.0.0",
  "Chrome/124 Safari/537.36",
  "Firefox/119.0",
  "Firefox/120.0",
  "Firefox/121.0",
  "CriOS/122.0.6261.89",
  "FxiOS/123.0",
  "CPU iPhone OS 16_0 like Mac OS X",
  "Nexus 5X Build/MMB29P",
  "CPU iPhone OS 13_2_3 like Mac OS X",
];

/**
 * Returns true when an SSR page or click request carries a known crawler,
 * scraper, headless automation, or frozen-UA scraper signature.
 *
 * When `userAgent` is undefined (e.g., server callers that do not pass a UA),
 * returns false so intentional internal/test calls are not blocked.
 */
export function looksAutomatedAdRequest(userAgent?: string | null): boolean {
  if (userAgent === undefined || userAgent === null) return false;
  const trimmed = userAgent.trim();
  if (trimmed.length === 0) return true;
  if (AUTOMATED_AD_UA_RE.test(trimmed)) return true;
  if (FROZEN_SCRAPER_UA_SIGNATURES.some((sig) => trimmed.includes(sig))) return true;
  if (trimmed.includes("X11; Linux x86_64") && trimmed.includes("Chrome/155.0.0.0")) return true;
  return false;
}

export const adPrivateHeaders = {
  "cache-control": "private, no-store",
  "x-robots-tag": "noindex, nofollow",
  "referrer-policy": "no-referrer",
  "x-content-type-options": "nosniff",
};

export function adGateway(scope: Pick<AdScope, "apiKey" | "gatewayUrl">): string | null {
  if (!scope.apiKey) return null;
  try {
    const url = new URL(scope.gatewayUrl);
    if (url.username || url.password) return null;
    if (
      url.protocol !== "https:" &&
      !(url.protocol === "http:" && ["localhost", "127.0.0.1"].includes(url.hostname))
    )
      return null;
    return url.origin;
  } catch {
    return null;
  }
}

/** Uncached fetch. Prefer `getAdPlan`, which dedupes within a React request. */
export async function fetchAdPlan(
  scope: AdScope,
  request: AdPlanRequest,
  fetcher: typeof fetch = fetch,
): Promise<AdPlan> {
  const gateway = adGateway(scope);
  if (!gateway) return unavailableAdPlan();
  if (!request.preview_token && looksAutomatedAdRequest(scope.clientContext?.userAgent)) {
    return { ...emptyAdPlan(), empty: [...request.placements], reason: "blocked" };
  }
  const body: AdPlanRequest = scope.publicationId
    ? { ...request, property: { ...request.property, publication_id: scope.publicationId } }
    : request;
  try {
    const response = await fetcher(gateway + "/v1/ads/plan", {
      method: "POST",
      headers: {
        ...buildClientContextHeaders(scope.clientContext),
        "x-api-key": scope.apiKey,
        "content-type": "application/json",
      },
      body: JSON.stringify(body),
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(AD_PLAN_TIMEOUT_MS),
    });
    if (!response.ok) return unavailableAdPlan();
    const json = await response.json();
    return await sealAdPlan(scope.apiKey, normalizeAdPlan(json?.data ?? json));
  } catch {
    return unavailableAdPlan();
  }
}

const encoder = new TextEncoder();

function httpsOnly(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password;
  } catch {
    return false;
  }
}

/**
 * The brand kit for the page: the secondary link's URL becomes a second,
 * separately signed `/go/{id}?to=…&s=…&direct=1` route and the raw URL is
 * removed; an unusable secondary is dropped, the rest of the kit kept.
 */
async function sealBrand(apiKey: string, deliveryId: string, brand: AdBrand | undefined): Promise<AdBrand | undefined> {
  if (!brand) return undefined;
  const { secondary, ...rest } = brand;
  if (!secondary) return { ...rest };
  if (!secondary.url || !httpsOnly(secondary.url)) return { ...rest };
  const s = await signClickFallback(apiKey, deliveryId, secondary.url);
  const href = `/go/${deliveryId}?to=${base64url(encoder.encode(secondary.url))}&s=${s}&direct=1`;
  return { ...rest, secondary: { label: secondary.label, href } };
}

/**
 * Turns the wire plan into the page plan: every delivery's href becomes the
 * property's `/go/{id}` route carrying the signed fallback destination, and
 * the server-to-server fields (`destination_url`, `tier`) are removed so
 * nothing but the signed, verified form ever reaches the page.
 */
export async function sealAdPlan(apiKey: string, wire: ReturnType<typeof normalizeAdPlan>): Promise<AdPlan> {
  const deliveries: AdPlan["deliveries"] = {};
  const empty = new Set(wire.empty);
  for (const [placement, delivery] of Object.entries(wire.deliveries)) {
    if (!delivery) continue;
    const { destination_url, tier: _tier, brand, ...rest } = delivery;
    let href = `/go/${rest.delivery_id}`;
    if (destination_url) {
      if (!httpsOnly(destination_url)) {
        empty.add(placement);
        continue;
      }
      const s = await signClickFallback(apiKey, rest.delivery_id, destination_url);
      href += `?to=${base64url(encoder.encode(destination_url))}&s=${s}`;
    }
    const sealedBrand = await sealBrand(apiKey, rest.delivery_id, brand);
    const sealed: AdDelivery = sealedBrand ? { ...rest, href, brand: sealedBrand } : { ...rest, href };
    deliveries[placement] = sealed;
  }
  const { deliveries: _wire, empty: _empty, ...rest } = wire;
  return { ...rest, deliveries, empty: [...empty] };
}

/** One Map per React request; outside a request React's cache is a pass-through. */
const registry = cache(() => new Map<string, Promise<AdPlan>>());

function planKey(scope: AdScope, request: AdPlanRequest): string {
  return JSON.stringify([scope.gatewayUrl, scope.publicationId ?? "", request]);
}

/**
 * The page's plan, fetched once per request and shared by the layout, the
 * page and every component that renders a slot. A second distinct request
 * shape in the same page render is a bug, so pass the same request object.
 */
export function getAdPlan(
  scope: AdScope,
  request: AdPlanRequest,
  fetcher: typeof fetch = fetch,
): Promise<AdPlan> {
  const map = registry();
  const key = planKey(scope, request);
  const existing = map.get(key);
  if (existing) return existing;
  const plan = fetchAdPlan(scope, request, fetcher);
  map.set(key, plan);
  return plan;
}
