import { describe, expect, it, vi } from "vitest";
import { fetchAdPlan, getAdPlan, type AdScope } from "./ads-server";
import { createAdClickHandler, createAdReportHandler, reportIdempotencyKey } from "./ads-click-route";
import { base64url, signClickFallback, verifyClickFallback } from "./ads-signing";
import type { AdPlanRequest } from "./ads";

const scope: AdScope = {
  apiKey: "sm_test_key",
  gatewayUrl: "https://api.scalemule.com",
  publicationId: "0192f8a0-0000-7000-8000-000000000001",
  clientContext: {},
};
const request: AdPlanRequest = {
  property: {},
  page: { type: "article", path: "/news/x", section: "community", towns: ["Pleasanton"], sensitivity: "clear" },
  layout: { length_class: "standard", insertion_points: ["p6"], sidebar: true },
  placements: ["leaderboard", "article_inline"],
  reader: { tier: "cookieless" },
};
const DELIVERY = "0192f8a0-1234-7abc-8def-0123456789ab";
const FLIGHT = "0192f8a0-1234-7abc-8def-0123456789ac";
const CREATIVE = "0192f8a0-1234-7abc-8def-0123456789ad";
const DESTINATION = "https://mergeyard.com/?utm_source=paper&utm_medium=house";
const plan = {
  plan_id: "p1",
  policy_snapshot_at: "2026-10-29T00:00:00Z",
  deliveries: {
    leaderboard: {
      delivery_id: DELIVERY, flight_id: FLIGHT, creative_id: CREATIVE, revision: 1, format: "band",
      content: { advertiser: "A", headline: "H", description: "D", cta: "Go", logo: null, image: null },
      href: `/go/${DELIVERY}`, label: "advertisement", about: { advertiser: "A" },
      destination_url: DESTINATION, tier: "cookieless",
    },
  },
  empty: ["article_inline"],
};
const encoded = (text: string) => base64url(new TextEncoder().encode(text));
const ok = (body: unknown) => new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } });

describe("getAdPlan", () => {
  it("returns the plan and attaches the publication", async () => {
    const fetcher = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      const sent = JSON.parse(String(init?.body));
      expect(sent.property.publication_id).toBe(scope.publicationId);
      expect((init?.headers as Record<string, string>)["x-api-key"]).toBe("sm_test_key");
      return ok({ success: true, data: plan });
    });
    const result = await fetchAdPlan(scope, request, fetcher as unknown as typeof fetch);
    const delivery = result.deliveries.leaderboard!;
    expect(delivery.delivery_id).toBe(DELIVERY);
    const s = await signClickFallback(scope.apiKey, DELIVERY, DESTINATION);
    expect(delivery.href).toBe(`/go/${DELIVERY}?to=${encoded(DESTINATION)}&s=${s}`);
    expect(JSON.stringify(result)).not.toContain("destination_url");
    expect(JSON.stringify(result)).not.toContain('"tier"');
    expect(fetcher).toHaveBeenCalledWith("https://api.scalemule.com/v1/ads/plan", expect.objectContaining({ method: "POST", cache: "no-store" }));
  });
  it("is empty on a 500, on malformed JSON, on a timeout and on a thrown error", async () => {
    const empty = { plan_id: "", policy_snapshot_at: "", deliveries: {}, empty: [] };
    expect(await fetchAdPlan(scope, request, (async () => new Response("x", { status: 500 })) as typeof fetch)).toEqual(empty);
    expect(await fetchAdPlan(scope, request, (async () => ok({ data: { nope: 1 } })) as typeof fetch)).toEqual(empty);
    expect(await fetchAdPlan(scope, request, (async () => { throw new Error("boom"); }) as typeof fetch)).toEqual(empty);
    const slow = (async (_u: unknown, init?: RequestInit) =>
      new Promise<Response>((_, reject) => init?.signal?.addEventListener("abort", () => reject(new Error("aborted"))))) as typeof fetch;
    const started = Date.now();
    expect(await fetchAdPlan(scope, request, slow)).toEqual(empty);
    expect(Date.now() - started).toBeLessThan(1000);
  });
  it("refuses insecure gateways and missing keys without calling out", async () => {
    const fetcher = vi.fn();
    expect(await fetchAdPlan({ ...scope, gatewayUrl: "http://evil.example" }, request, fetcher)).toEqual({ plan_id: "", policy_snapshot_at: "", deliveries: {}, empty: [] });
    expect(await fetchAdPlan({ ...scope, apiKey: "" }, request, fetcher)).toEqual({ plan_id: "", policy_snapshot_at: "", deliveries: {}, empty: [] });
    expect(fetcher).not.toHaveBeenCalled();
  });
  it("drops an invalid delivery into empty and refuses a non-https destination", async () => {
    const bad = { ...plan, deliveries: { ...plan.deliveries, sidebar: { ...plan.deliveries.leaderboard, delivery_id: "nope" }, footer: { ...plan.deliveries.leaderboard, destination_url: "http://plain.example" } } };
    const result = await fetchAdPlan(scope, request, (async () => ok({ data: bad })) as typeof fetch);
    expect(Object.keys(result.deliveries)).toEqual(["leaderboard"]);
    expect(result.empty.sort()).toEqual(["article_inline", "footer", "sidebar"]);
  });
  it("getAdPlan never throws", async () => {
    const result = await getAdPlan(scope, request, (async () => { throw new Error("x"); }) as typeof fetch);
    expect(result.deliveries).toEqual({});
  });
});

describe("click route", () => {
  const resolve = async () => scope;
  const signedUrl = async (dest = DESTINATION, sig?: string) =>
    `https://paper.example/go/${DELIVERY}?to=${encoded(dest)}&s=${sig ?? (await signClickFallback(scope.apiKey, DELIVERY, dest))}`;
  it("asks the service with the click-time tier and redirects to the signed location", async () => {
    const fetcher = vi.fn(async (_u: unknown, init?: RequestInit) => {
      expect(JSON.parse(String(init?.body))).toEqual({ delivery_id: DELIVERY, tier: "cookieless" });
      return ok({ data: { location: "https://attribution.example/r/tok?d=ctx" } });
    });
    const handler = createAdClickHandler({ resolve, fetch: fetcher as unknown as typeof fetch });
    const res = await handler(new Request(await signedUrl(), { headers: { dnt: "1" } }), DELIVERY);
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe("https://attribution.example/r/tok?d=ctx");
    expect(res.headers.get("cache-control")).toBe("private, no-store");
  });
  it("falls back to the signed destination when the service fails, times out or answers badly", async () => {
    for (const fetcher of [
      async () => new Response("", { status: 503 }),
      async () => { throw new Error("network"); },
      async (_u: unknown, init?: RequestInit) => new Promise<Response>((_, reject) => init?.signal?.addEventListener("abort", () => reject(new Error("aborted")))),
      async () => ok({ data: { location: "http://plain.example" } }),
      async () => ok({ data: {} }),
    ]) {
      const handler = createAdClickHandler({ resolve, fetch: fetcher as typeof fetch });
      const res = await handler(new Request(await signedUrl(), { headers: { referer: "https://paper.example/news/story" } }), DELIVERY);
      expect(res.status).toBe(302);
      expect(res.headers.get("location")).toBe(DESTINATION);
    }
  });
  it("sends a tampered, missing or non-https fallback to / and never to the referrer", async () => {
    const failing = createAdClickHandler({ resolve, fetch: (async () => new Response("", { status: 503 })) as typeof fetch });
    const headers = { referer: "https://paper.example/news/story" };
    const tampered = await signedUrl(DESTINATION, (await signClickFallback(scope.apiKey, DELIVERY, DESTINATION)).replace(/^./, (c) => (c === "A" ? "B" : "A")));
    expect((await failing(new Request(tampered, { headers }), DELIVERY)).headers.get("location")).toBe("/");
    const swapped = `https://paper.example/go/${DELIVERY}?to=${encoded("https://evil.example/")}&s=${await signClickFallback(scope.apiKey, DELIVERY, DESTINATION)}`;
    expect((await failing(new Request(swapped, { headers }), DELIVERY)).headers.get("location")).toBe("/");
    const otherDelivery = `https://paper.example/go/${DELIVERY}?to=${encoded(DESTINATION)}&s=${await signClickFallback(scope.apiKey, "0192f8a0-1234-7abc-8def-0123456789ff", DESTINATION)}`;
    expect((await failing(new Request(otherDelivery, { headers }), DELIVERY)).headers.get("location")).toBe("/");
    const http = await signedUrl("http://plain.example/");
    expect((await failing(new Request(http, { headers }), DELIVERY)).headers.get("location")).toBe("/");
    const creds = await signedUrl("https://user:pw@mergeyard.com/");
    expect((await failing(new Request(creds, { headers }), DELIVERY)).headers.get("location")).toBe("/");
    expect((await failing(new Request(`https://paper.example/go/${DELIVERY}`, { headers }), DELIVERY)).headers.get("location")).toBe("/");
    expect((await failing(new Request("https://paper.example/go/nope", { headers }), "nope")).headers.get("location")).toBe("/");
    expect(await verifyClickFallback("k", DELIVERY, "%%%", "x")).toBeNull();
  });
  it("derives a different key per property", async () => {
    expect(await signClickFallback("key-a", DELIVERY, DESTINATION)).not.toBe(await signClickFallback("key-b", DELIVERY, DESTINATION));
  });
});

describe("report route", () => {
  const resolve = async () => scope;
  const form = (body: Record<string, string>, extra: Record<string, string> = {}) =>
    new Request("https://paper.example/api/ads/report", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded", ...extra },
      body: new URLSearchParams(body).toString(),
    });
  it("acknowledges only an accepted report, with an idempotency key, and sends the reader back", async () => {
    const fetcher = vi.fn(async (_u: unknown, init?: RequestInit) => {
      const headers = init?.headers as Record<string, string>;
      const sent = JSON.parse(String(init?.body));
      expect(headers["idempotency-key"]).toBe(await reportIdempotencyKey(DELIVERY, sent.reason, 1_700_000_040_000));
      return ok({ data: { ok: true } });
    });
    const MINUTE = 1_700_000_040_000; // minute-aligned
    const handler = createAdReportHandler({ resolve, fetch: fetcher as unknown as typeof fetch, now: () => MINUTE });
    const res = await handler(form({ delivery_id: DELIVERY, reason: "misleading" }, { referer: "https://paper.example/news/story" }));
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe("/news/story#ad-reported");
    expect(JSON.parse(String((fetcher.mock.calls[0] as unknown[])[1] && ((fetcher.mock.calls[0] as unknown[])[1] as RequestInit).body))).toEqual({ delivery_id: DELIVERY, reason: "misleading", note: "" });
    const plain = await handler(form({ delivery_id: DELIVERY, reason: "other", note: "x" }));
    expect(plain.status).toBe(200);
    expect(await plain.text()).toContain("Your report was received");
    expect(await reportIdempotencyKey(DELIVERY, "misleading", MINUTE)).toBe(await reportIdempotencyKey(DELIVERY, "misleading", MINUTE + 59_000));
    expect(await reportIdempotencyKey(DELIVERY, "misleading", MINUTE)).not.toBe(await reportIdempotencyKey(DELIVERY, "misleading", MINUTE + 60_000));
  });
  it("tells the reader when the service refused, failed or timed out, never ok", async () => {
    const slow = (async (_u: unknown, init?: RequestInit) => new Promise<Response>((_, reject) => init?.signal?.addEventListener("abort", () => reject(new Error("aborted"))))) as typeof fetch;
    for (const fetcher of [
      (async () => new Response("", { status: 400 })) as typeof fetch,
      (async () => new Response("", { status: 429 })) as typeof fetch,
      (async () => new Response("", { status: 503 })) as typeof fetch,
      (async () => { throw new Error("network"); }) as typeof fetch,
      slow,
    ]) {
      const handler = createAdReportHandler({ resolve, fetch: fetcher });
      const back = await handler(form({ delivery_id: DELIVERY, reason: "other" }, { referer: "https://paper.example/news/story?x=1" }));
      expect(back.status).toBe(303);
      expect(back.headers.get("location")).toBe("/news/story?x=1&report=failed");
      const plain = await handler(form({ delivery_id: DELIVERY, reason: "other" }));
      expect(plain.status).toBe(503);
      expect(await plain.text()).toContain("We couldn't send your report");
      const json = await handler(new Request("https://paper.example/api/ads/report", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ delivery_id: DELIVERY, reason: "other" }) }));
      expect(json.status).toBe(503);
      expect(await json.json()).toEqual({ ok: false });
    }
  }, 20000);
  it("rejects bad input and rate-limits per IP", async () => {
    let t = 0;
    const handler = createAdReportHandler({ resolve, fetch: (async () => ok({})) as typeof fetch, limit: 2, now: () => t });
    expect((await handler(form({ delivery_id: "nope", reason: "other" }))).status).toBe(400);
    expect((await handler(form({ delivery_id: DELIVERY, reason: "spam" }))).status).toBe(400);
    expect((await handler(new Request("https://paper.example/api/ads/report"))).status).toBe(405);
    const ip = { "x-forwarded-for": "203.0.113.9" };
    expect((await handler(form({ delivery_id: DELIVERY, reason: "other" }, ip))).status).toBe(200);
    expect((await handler(form({ delivery_id: DELIVERY, reason: "other" }, ip))).status).toBe(200);
    expect((await handler(form({ delivery_id: DELIVERY, reason: "other" }, ip))).status).toBe(429);
    t = 61000;
    expect((await handler(form({ delivery_id: DELIVERY, reason: "other" }, ip))).status).toBe(200);
  });
});
