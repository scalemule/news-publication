/**
 * The property's own click and report routes (ADR sections 7.5.2, 10.1, 11).
 *
 * `/go/{delivery_id}`: re-evaluates consent at click time, asks `scalemule-ads`
 * for the signed redirect location, and answers 302. The DOM therefore carries
 * only `/go/{id}`; copying a link copies nothing trackable.
 *
 * `/api/ads/report`: "Report this ad", a plain HTML form that works without
 * JavaScript, proxied to `POST /v1/ads/reports` with a small per-IP limit.
 */
import { buildClientContextHeaders } from "@scalemule/sdk";
import { AD_REPORT_REASONS, UUID_V7, type AdReportReason } from "./ads";
import { measurementTier } from "./ads-tier";
import { adGateway, adPrivateHeaders, type AdScope } from "./ads-server";

export const AD_CLICK_TIMEOUT_MS = 2000;

function redirect(location: string, status = 302): Response {
  return new Response(null, {
    status,
    headers: { ...adPrivateHeaders, location },
  });
}

/**
 * Where to send a reader when the click cannot be resolved. The route does
 * not know the creative's destination (it is never on the page), so the only
 * honest fallback is back to the page they were reading, else the front page.
 * Deviation from ADR section 11 wording ("302s straight to the creative's
 * destination"), recorded in the PR for confirmation.
 */
export function clickFallback(request: Request): string {
  const referer = request.headers.get("referer");
  if (referer) {
    try {
      const from = new URL(referer);
      const self = new URL(request.url);
      if (from.origin === self.origin) return from.pathname + from.search;
    } catch {
      /* fall through */
    }
  }
  return "/";
}

export function createAdClickHandler(options: {
  resolve(request: Request): Promise<AdScope>;
  fetch?: typeof fetch;
}) {
  const fetcher = options.fetch || fetch;
  return async function handler(request: Request, deliveryId: string): Promise<Response> {
    if (!UUID_V7.test(deliveryId)) return redirect(clickFallback(request));
    try {
      const scope = await options.resolve(request);
      const gateway = adGateway(scope);
      if (!gateway) return redirect(clickFallback(request));
      const response = await fetcher(gateway + "/v1/ads/clicks", {
        method: "POST",
        headers: {
          ...buildClientContextHeaders(scope.clientContext),
          "x-api-key": scope.apiKey,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          delivery_id: deliveryId.toLowerCase(),
          tier: measurementTier(request.headers),
        }),
        cache: "no-store",
        redirect: "error",
        signal: AbortSignal.timeout(AD_CLICK_TIMEOUT_MS),
      });
      if (!response.ok) return redirect(clickFallback(request));
      const json = await response.json();
      const location = json?.data?.location ?? json?.location;
      if (typeof location !== "string" || !/^https:\/\//i.test(location))
        return redirect(clickFallback(request));
      return redirect(location);
    } catch {
      return redirect(clickFallback(request));
    }
  };
}

const REASONS = new Set<string>(AD_REPORT_REASONS.map(([key]) => key));

function thankYou(): Response {
  return new Response(
    `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Thank you</title></head><body style="font-family:system-ui,sans-serif;max-width:40rem;margin:4rem auto;padding:0 1rem"><h1>Thank you</h1><p>Your report was received. An editor reviews every report.</p><p><a href="/">Back to the front page</a></p></body></html>`,
    { status: 200, headers: { ...adPrivateHeaders, "content-type": "text/html; charset=utf-8" } },
  );
}

function clientIp(request: Request): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown"
  );
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
    try {
      if (type.includes("application/json")) {
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
    note = Array.from(note).slice(0, 500).join("");
    try {
      const scope = await options.resolve(request);
      const gateway = adGateway(scope);
      if (gateway) {
        await fetcher(gateway + "/v1/ads/reports", {
          method: "POST",
          headers: {
            ...buildClientContextHeaders(scope.clientContext),
            "x-api-key": scope.apiKey,
            "content-type": "application/json",
          },
          body: JSON.stringify({ delivery_id: delivery.toLowerCase(), reason: reason as AdReportReason, note }),
          cache: "no-store",
          redirect: "error",
          signal: AbortSignal.timeout(AD_CLICK_TIMEOUT_MS),
        });
      }
    } catch {
      /* the reader still gets an acknowledgment; the service logs its own failures */
    }
    const back = request.headers.get("referer");
    if (back && !type.includes("application/json")) {
      try {
        const from = new URL(back);
        if (from.origin === new URL(request.url).origin)
          return redirect(from.pathname + from.search + "#ad-reported", 303);
      } catch {
        /* fall through */
      }
    }
    return type.includes("application/json")
      ? Response.json({ ok: true }, { headers: adPrivateHeaders })
      : thankYou();
  };
}
