// @vitest-environment jsdom
import React from "react";
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import Ajv2020 from "ajv/dist/2020";
import schema from "../contracts/ad-plan.schema.json";
import valid from "../contracts/fixtures/ad-plan.valid.json";
import { isAdPlan, normalizeAdPlan, validateAdDelivery, type AdDelivery } from "./ads";
import { sealAdPlan } from "./ads-server";
import { AdUnit } from "./ad-slot";

const ajv = new Ajv2020({ allErrors: true, strict: true });
ajv.addFormat("date-time", /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/);
const validate = ajv.compile(schema);
const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v));

describe("contracts/ad-plan.schema.json", () => {
  it("accepts the shared fixture, and the SDK validator agrees", () => {
    expect(validate(valid), JSON.stringify(validate.errors)).toBe(true);
    expect(isAdPlan(valid)).toBe(true);
    const plan = normalizeAdPlan(valid);
    expect(Object.keys(plan.deliveries).sort()).toEqual(["article_inline", "leaderboard", "masthead_credit"]);
    expect(plan.empty.sort()).toEqual(["partner_footer", "sidebar"]);
  });
  it.each([
    ["service-shaped legacy field names", (p: typeof valid) => { const d = p.deliveries.leaderboard as unknown as Record<string, unknown>; d.content = { advertiser_name: "X", cta_label: "Go", logo_url: "https://x/y.png" }; }],
    ["non-v7 delivery id", (p: typeof valid) => { p.deliveries.leaderboard.delivery_id = "0192f8a0-1234-4abc-8def-0123456789ab"; }],
    ["unknown format", (p: typeof valid) => { (p.deliveries.leaderboard as { format: string }).format = "skyscraper"; }],
    ["http logo", (p: typeof valid) => { p.deliveries.leaderboard.content.logo!.url = "http://cdn/x.png"; }],
    ["fractional image width", (p: typeof valid) => { p.deliveries.article_inline.content.image!.width = 900.5; }],
    ["bad label", (p: typeof valid) => { (p.deliveries.leaderboard as { label: string }).label = "partner"; }],
    ["href not /go", (p: typeof valid) => { p.deliveries.leaderboard.href = "https://mergeyard.com"; }],
    ["bad tier", (p: typeof valid) => { (p.deliveries.leaderboard as { tier: string }).tier = "tracking"; }],
  ])("rejects %s in both the schema and the SDK, dropping the delivery into empty", (_name, mutate) => {
    const plan = clone(valid);
    mutate(plan);
    expect(validate(plan)).toBe(false);
    expect(isAdPlan(plan)).toBe(false);
    const normalized = normalizeAdPlan(plan);
    const broken = Object.keys(plan.deliveries).find((k) => !(k in normalized.deliveries));
    expect(broken).toBeDefined();
    expect(normalized.empty).toContain(broken);
    expect(Object.keys(normalized.deliveries)).toHaveLength(2);
  });
  it("never throws on garbage envelopes", () => {
    for (const junk of [null, 1, "x", [], {}, { plan_id: 1 }, { plan_id: "a", policy_snapshot_at: "b", deliveries: [] }, { plan_id: "a", policy_snapshot_at: "b", deliveries: { leaderboard: "nope" }, empty: "x" }]) {
      expect(() => normalizeAdPlan(junk)).not.toThrow();
      expect(() => isAdPlan(junk)).not.toThrow();
      expect(Object.keys(normalizeAdPlan(junk).deliveries)).toHaveLength(0);
    }
    expect(validateAdDelivery({ delivery_id: "x" })).toBeNull();
  });
  it("renders a sealed fixture through the production component without throwing, and never a service-shaped one", async () => {
    const sealed = await sealAdPlan("sm_test_key", normalizeAdPlan(valid));
    for (const [placement, delivery] of Object.entries(sealed.deliveries)) {
      const html = renderToStaticMarkup(<AdUnit delivery={delivery!} placement={placement} />);
      expect(html).toContain(`data-ad-delivery="${delivery!.delivery_id}"`);
      expect(html).not.toContain("mergeyard.com/?utm");
      expect(html).toContain(`href="/go/${delivery!.delivery_id}?to=`);
      expect((delivery as { destination_url?: string }).destination_url).toBeUndefined();
      expect((delivery as { tier?: string }).tier).toBeUndefined();
    }
    const legacy = { ...valid.deliveries.leaderboard, content: { advertiser_name: "X" } } as unknown as AdDelivery;
    expect(() => renderToStaticMarkup(<AdUnit delivery={legacy} placement="leaderboard" />)).not.toThrow();
    const noContent = { ...valid.deliveries.leaderboard, content: undefined } as unknown as AdDelivery;
    expect(renderToStaticMarkup(<AdUnit delivery={noContent} placement="leaderboard" />)).toBe("");
  });
});
