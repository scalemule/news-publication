import { describe, expect, it, vi } from "vitest";
import { fetchAdPlan, getAdPlan, type AdScope } from "./ads-server";
import { clickFallback, createAdClickHandler, createAdReportHandler } from "./ads-click-route";
import type { AdPlanRequest } from "./ads";

const scope: AdScope = {
  apiKey: "sm_test_key",
  gatewayUrl: "https://api.scalemule.com",
  publicationId: "0192f8a0-0000-7000-8000-000000000001",
  clientContext: {},
};
const request: AdPlanRequest = {
  property: {},
  page: { type: "article", path: "/news/x", section: "community", towns: ["Pleasanton"], sensitive: false },
  layout: { length_class: "standard", insertion_points: ["p6"], sidebar: true },
  placements: ["leaderboard", "article_inline"],
  reader: { tier: "cookieless" },
};
const DELIVERY = "0192f8a0-1234-7abc-8def-0123456789ab";
const plan = {
  plan_id: "p1",
  policy_snapshot_at: "2026-10-29T00:00:00Z",
  deliveries: {
    leaderboard: {
      delivery_id: DELIVERY, flight_id: "f", creative_id: "c", revision: 1, format: "band",
      content: { advertiser: "A", headline: "H", description: "D", cta: "Go" },
      href: `/go/${DELIVERY}`, label: "advertisement", about: { advertiser: "A" },
    },
  },
  empty: ["article_inline"],
};
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
    expect(result.deliveries.leaderboard?.delivery_id).toBe(DELIVERY);
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
  it("getAdPlan never throws", async () => {
    const result = await getAdPlan(scope, request, (async () => { throw new Error("x"); }) as typeof fetch);
    expect(result.deliveries).toEqual({});
  });
});

describe("click route", () => {
  const resolve = async () => scope;
  it("asks the service with the click-time tier and redirects", async () => {
    const fetcher = vi.fn(async (_u: unknown, init?: RequestInit) => {
      expect(JSON.parse(String(init?.body))).toEqual({ delivery_id: DELIVERY, tier: "cookieless" });
      return ok({ data: { location: "https://attribution.example/r/tok?d=ctx" } });
    });
    const handler = createAdClickHandler({ resolve, fetch: fetcher as unknown as typeof fetch });
    const res = await handler(new Request("https://paper.example/go/" + DELIVERY, { headers: { dnt: "1" } }), DELIVERY);
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe("https://attribution.example/r/tok?d=ctx");
    expect(res.headers.get("cache-control")).toBe("private, no-store");
  });
  it("falls back to the referring page on failure, bad ids or non-https locations", async () => {
    const failing = createAdClickHandler({ resolve, fetch: (async () => new Response("", { status: 503 })) as typeof fetch });
    const req = new Request("https://paper.example/go/" + DELIVERY, { headers: { referer: "https://paper.example/news/story?x=1" } });
    expect((await failing(req, DELIVERY)).headers.get("location")).toBe("/news/story?x=1");
    const foreign = new Request("https://paper.example/go/" + DELIVERY, { headers: { referer: "https://other.example/x" } });
    expect((await failing(foreign, DELIVERY)).headers.get("location")).toBe("/");
    const bad = await failing(new Request("https://paper.example/go/nope"), "nope");
    expect(bad.headers.get("location")).toBe("/");
    const http = createAdClickHandler({ resolve, fetch: (async () => ok({ data: { location: "http://plain.example" } })) as typeof fetch });
    expect((await http(req, DELIVERY)).headers.get("location")).toBe("/news/story?x=1");
    expect(clickFallback(new Request("https://paper.example/go/x"))).toBe("/");
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
  it("proxies a valid report and sends the reader back", async () => {
    const fetcher = vi.fn(async () => ok({ data: { ok: true } }));
    const handler = createAdReportHandler({ resolve, fetch: fetcher as unknown as typeof fetch });
    const res = await handler(form({ delivery_id: DELIVERY, reason: "misleading" }, { referer: "https://paper.example/news/story" }));
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe("/news/story#ad-reported");
    expect(JSON.parse(String((fetcher.mock.calls[0] as unknown[])[1] && ((fetcher.mock.calls[0] as unknown[])[1] as RequestInit).body))).toEqual({ delivery_id: DELIVERY, reason: "misleading", note: "" });
    const plain = await handler(form({ delivery_id: DELIVERY, reason: "other", note: "x" }));
    expect(plain.status).toBe(200);
    expect(plain.headers.get("content-type")).toContain("text/html");
  });
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
