/**
 * Server-only: one ad plan per page request (ADR section 6.1 and 11).
 *
 * Never import this from a client component: it carries the property's API
 * key. The plan request is answered by `scalemule-ads` through the gateway;
 * any failure, including the 150 ms timeout, yields an empty plan so an ad
 * outage can never slow or break a page.
 */
import { cache } from "react";
import { buildClientContextHeaders, type ClientContext } from "@scalemule/sdk";
import { emptyAdPlan, normalizeAdPlan, type AdDelivery, type AdPlan, type AdPlanRequest } from "./ads";
import { base64url, signClickFallback } from "./ads-signing";

export type AdScope = {
  apiKey: string;
  gatewayUrl: string;
  publicationId?: string;
  clientContext: ClientContext;
};

export const AD_PLAN_TIMEOUT_MS = 150;

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
  if (!gateway) return emptyAdPlan();
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
    if (!response.ok) return emptyAdPlan();
    const json = await response.json();
    return await sealAdPlan(scope.apiKey, normalizeAdPlan(json?.data ?? json));
  } catch {
    return emptyAdPlan();
  }
}

const encoder = new TextEncoder();

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
    const { destination_url, tier: _tier, ...rest } = delivery;
    let href = `/go/${rest.delivery_id}`;
    if (destination_url) {
      let ok = false;
      try {
        const url = new URL(destination_url);
        ok = url.protocol === "https:" && !url.username && !url.password;
      } catch {
        ok = false;
      }
      if (!ok) {
        empty.add(placement);
        continue;
      }
      const s = await signClickFallback(apiKey, rest.delivery_id, destination_url);
      href += `?to=${base64url(encoder.encode(destination_url))}&s=${s}`;
    }
    const sealed: AdDelivery = { ...rest, href };
    deliveries[placement] = sealed;
  }
  return { plan_id: wire.plan_id, policy_snapshot_at: wire.policy_snapshot_at, deliveries, empty: [...empty] };
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
