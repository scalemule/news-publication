/**
 * The property's own click and report routes (ADR sections 7.5.2, 10.1, 11).
 *
 * `/go/{delivery_id}`: re-evaluates consent at click time, asks `scalemule-ads`
 * for the signed redirect location, and answers 302. If the service cannot
 * answer, the route falls back to the destination the property itself signed
 * into the link at render time (`?to=` + `?s=`, see ./ads-signing.ts); a bad
 * or missing signature goes to `/`. It never redirects to a referrer.
 *
 * `/api/ads/report`: "Report this ad", a plain HTML form that works without
 * JavaScript, proxied to `POST /v1/ads/reports`. The reader is told the
 * report was received only when the service accepted it.
 */
import { buildClientContextHeaders } from "@scalemule/sdk";
import { AD_REPORT_REASONS, UUID_V7, type AdReportReason } from "./ads";
import { measurementTier } from "./ads-tier";
import { adGateway, adPrivateHeaders, type AdScope } from "./ads-server";
import { verifyClickFallback } from "./ads-signing";

export const AD_CLICK_TIMEOUT_MS = 2000;

function redirect(location: string, status = 302): Response {
  return new Response(null, {
    status,
    headers: { ...adPrivateHeaders, location },
  });
}

async function fallback(request: Request, scope: AdScope | null, deliveryId: string): Promise<Response> {
  if (!scope) return redirect("/");
  const url = new URL(request.url);
  const destination = await verifyClickFallback(scope.apiKey, deliveryId, url.searchParams.get("to"), url.searchParams.get("s"));
  return redirect(destination ?? "/");
}

export function createAdClickHandler(options: {
  resolve(request: Request): Promise<AdScope>;
  fetch?: typeof fetch;
}) {
  const fetcher = options.fetch || fetch;
  return async function handler(request: Request, deliveryId: string): Promise<Response> {
    if (!UUID_V7.test(deliveryId)) return redirect("/");
    const id = deliveryId.toLowerCase();
    let scope: AdScope | null = null;
    try {
      scope = await options.resolve(request);
      const gateway = adGateway(scope);
      if (!gateway) return fallback(request, scope, id);
      const response = await fetcher(gateway + "/v1/ads/clicks", {
        method: "POST",
        headers: {
          ...buildClientContextHeaders(scope.clientContext),
          "x-api-key": scope.apiKey,
          "content-type": "application/json",
        },
        body: JSON.stringify({ delivery_id: id, tier: measurementTier(request.headers) }),
        cache: "no-store",
        redirect: "error",
        signal: AbortSignal.timeout(AD_CLICK_TIMEOUT_MS),
      });
      if (!response.ok) return fallback(request, scope, id);
      const json = await response.json();
      const location = json?.data?.location ?? json?.location;
      if (typeof location !== "string" || !/^https:\/\//i.test(location)) return fallback(request, scope, id);
      return redirect(location);
    } catch {
      return fallback(request, scope, id);
    }
  };
}

const REASONS = new Set<string>(AD_REPORT_REASONS.map(([key]) => key));

function page(title: string, body: string, status: number): Response {
  return new Response(
    `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${title}</title></head><body style="font-family:system-ui,sans-serif;max-width:40rem;margin:4rem auto;padding:0 1rem"><h1>${title}</h1><p>${body}</p><p><a href="/">Back to the front page</a></p></body></html>`,
    { status, headers: { ...adPrivateHeaders, "content-type": "text/html; charset=utf-8" } },
  );
}

function clientIp(request: Request): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown"
  );
}

async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

/** Same delivery, reason and minute → same key, so a retried form post is one report. */
export async function reportIdempotencyKey(deliveryId: string, reason: string, now = Date.now()): Promise<string> {
  return sha256Hex(`${deliveryId}\n${reason}\n${Math.floor(now / 60000)}`);
}

export function createAdReportHandler(options: {
  resolve(request: Request): Promise<AdScope>;
  fetch?: typeof fetch;
  /** Reports per IP per minute. */
  limit?: number;
  now?: () => number;
}) {
  const fetcher = options.fetch || fetch;
  const limit = options.limit ?? 10;
  const now = options.now ?? Date.now;
  const window: Map<string, number[]> = new Map();
  return async function handler(request: Request): Promise<Response> {
    if (request.method !== "POST")
      return new Response(null, { status: 405, headers: adPrivateHeaders });
    const ip = clientIp(request);
    const t = now();
    const hits = (window.get(ip) ?? []).filter((at) => t - at < 60000);
    if (hits.length >= limit)
      return new Response(null, { status: 429, headers: adPrivateHeaders });
    hits.push(t);
    window.set(ip, hits);
    if (window.size > 10000) window.clear();

    let delivery = "",
      reason = "",
      note = "";
    const type = request.headers.get("content-type") || "";
    const json = type.includes("application/json");
    try {
      if (json) {
        const body = await request.json();
        delivery = String(body?.delivery_id ?? "");
        reason = String(body?.reason ?? "");
        note = String(body?.note ?? "");
      } else {
        const form = await request.formData();
        delivery = String(form.get("delivery_id") ?? "");
        reason = String(form.get("reason") ?? "");
        note = String(form.get("note") ?? "");
      }
    } catch {
      return new Response(null, { status: 400, headers: adPrivateHeaders });
    }
    if (!UUID_V7.test(delivery) || !REASONS.has(reason))
      return new Response(null, { status: 400, headers: adPrivateHeaders });
    delivery = delivery.toLowerCase();
    note = Array.from(note).slice(0, 500).join("");

    let accepted = false;
    try {
      const scope = await options.resolve(request);
      const gateway = adGateway(scope);
      if (gateway) {
        const response = await fetcher(gateway + "/v1/ads/reports", {
          method: "POST",
          headers: {
            ...buildClientContextHeaders(scope.clientContext),
            "x-api-key": scope.apiKey,
            "content-type": "application/json",
            "idempotency-key": await reportIdempotencyKey(delivery, reason, t),
          },
          body: JSON.stringify({ delivery_id: delivery, reason: reason as AdReportReason, note }),
          cache: "no-store",
          redirect: "error",
          signal: AbortSignal.timeout(AD_CLICK_TIMEOUT_MS),
        });
        accepted = response.ok;
      }
    } catch {
      accepted = false;
    }

    const back = request.headers.get("referer");
    let backPath: string | null = null;
    if (back && !json) {
      try {
        const from = new URL(back);
        if (from.origin === new URL(request.url).origin) backPath = from.pathname + from.search;
      } catch {
        backPath = null;
      }
    }
    if (!accepted) {
      if (json) return Response.json({ ok: false }, { status: 503, headers: adPrivateHeaders });
      if (backPath) return redirect(`${backPath}${backPath.includes("?") ? "&" : "?"}report=failed`, 303);
      return page("We couldn't send your report", "Please try again in a moment.", 503);
    }
    if (json) return Response.json({ ok: true }, { headers: adPrivateHeaders });
    if (backPath) return redirect(`${backPath}#ad-reported`, 303);
    return page("Thank you", "Your report was received. An editor reviews every report.", 200);
  };
}
