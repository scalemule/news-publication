import { describe, expect, it } from "vitest";
import {
  AD_COPY_LIMITS,
  adInsertionPoints,
  emptyAdPlan,
  isAdPlan,
  lengthClass,
  validateCreativeContent,
  type AdCreativeDraft,
  adSensitivity,
} from "./ads";
import { measurementTier } from "./ads-tier";
import { measurementConsent } from "./measurement-consent";

const good: AdCreativeDraft = {
  advertiser: "MergeYard",
  headline: "Support that lives inside Zendesk",
  description: "Shared inboxes, SLAs and reporting for teams who answer customers all day.",
  cta: "See MergeYard",
  logo: { url: "https://cdn.example.com/mergeyard.png", width: 128, height: 128 },
  destination_url: "https://mergeyard.com/?utm_source=paper",
};

describe("creative validation", () => {
  it("accepts a complete band creative", () => {
    expect(validateCreativeContent(good, "band")).toEqual({ ok: true, errors: [] });
  });
  it("enforces the copy limits in code points, not bytes", () => {
    const cyrillic = "Я".repeat(AD_COPY_LIMITS.headline);
    expect(validateCreativeContent({ ...good, headline: cyrillic }, "band").ok).toBe(true);
    const emoji = "🙂".repeat(AD_COPY_LIMITS.headline + 1);
    const result = validateCreativeContent({ ...good, headline: emoji }, "band");
    expect(result.errors.map((e) => e.code)).toEqual(["too_long"]);
    const cta = validateCreativeContent({ ...good, cta: "x".repeat(21) }, "band");
    expect(cta.errors[0]).toMatchObject({ field: "cta", code: "too_long" });
    const desc = validateCreativeContent({ ...good, description: "д".repeat(121) }, "band");
    expect(desc.errors[0]).toMatchObject({ field: "description", code: "too_long" });
  });
  it("rejects markup, non-HTTPS destinations and missing logos", () => {
    expect(validateCreativeContent({ ...good, headline: "<b>Hi</b>" }, "band").errors[0].code).toBe("markup");
    for (const url of ["http://mergeyard.com", "javascript:alert(1)", "https://u:p@mergeyard.com", "not a url"]) {
      expect(validateCreativeContent({ ...good, destination_url: url }, "band").errors.map((e) => e.code)).toContain("scheme");
    }
    expect(validateCreativeContent({ ...good, logo: null }, "band").errors[0]).toMatchObject({ field: "logo", code: "required" });
  });
  it("applies per-format image rules", () => {
    const square = { url: "https://cdn.example.com/a.jpg", width: 600, height: 600 };
    const wide = { url: "https://cdn.example.com/b.jpg", width: 900, height: 600 };
    expect(validateCreativeContent({ ...good, image: square }, "band").ok).toBe(true);
    expect(validateCreativeContent({ ...good, image: wide }, "band").errors[0].code).toBe("ratio");
    expect(validateCreativeContent({ ...good, image: wide }, "inline_card").ok).toBe(true);
    expect(validateCreativeContent({ ...good, image: square }, "partner_footer").errors[0].code).toBe("ratio");
    expect(validateCreativeContent(good, "showcase").errors[0].code).toBe("image_required");
    expect(validateCreativeContent({ ...good, image: { url: "https://cdn.example.com/s.png", width: 1280, height: 900 } }, "showcase").ok).toBe(true);
  });
  it("credit lines need only an advertiser and a link label", () => {
    expect(validateCreativeContent({ advertiser: "NapSite", headline: "", description: "", cta: "", link_label: "Built on napsite.com" }, "credit_line").ok).toBe(true);
    expect(validateCreativeContent({ advertiser: "NapSite", headline: "", description: "", cta: "", link_label: "x".repeat(41) }, "credit_line").errors[0]).toMatchObject({ field: "link_label", code: "too_long" });
  });
});

describe("length class and insertion points", () => {
  it("classifies short, standard and long pages", () => {
    expect(lengthClass(599, 12)).toBe("short");
    expect(lengthClass(900, 7)).toBe("short");
    expect(lengthClass(900, 12)).toBe("standard");
    expect(lengthClass(1400, 20)).toBe("long");
  });
  it("offers no inline anchor on short pages", () => {
    expect(adInsertionPoints(7)).toEqual([]);
    expect(adInsertionPoints(20, { lengthClass: "short" })).toEqual([]);
  });
  it("starts after paragraph 4, keeps two paragraphs after, and spaces by a screen", () => {
    expect(adInsertionPoints(12)).toEqual(["p4", "p10"]);
    expect(adInsertionPoints(8)).toEqual(["p4"]);
  });
  it("never sits beside a photo or pull quote", () => {
    expect(adInsertionPoints(12, { hasPhotoAt: [4] })).toEqual(["p6"]);
    expect(adInsertionPoints(12, { hasPullQuoteAt: [5] })).toEqual(["p7"]);
    expect(adInsertionPoints(12, { hasPhotoAt: [3] })).toEqual(["p5"]);
  });
});

describe("plan shape", () => {
  it("empty plan is a valid plan with status ok", () => {
    expect(emptyAdPlan().status).toBe("ok");
    expect(isAdPlan(emptyAdPlan())).toBe(true);
    expect(isAdPlan(null)).toBe(false);
    expect(isAdPlan({ plan_id: "x" })).toBe(false);
  });
});

function cookie(preferences: Record<string, unknown>, timestamp = new Date().toISOString()) {
  return `sm_cookie_consent_v1=${encodeURIComponent(JSON.stringify({ version: 1, timestamp, preferences }))}`;
}
const headers = (map: Record<string, string>) => ({ get: (k: string) => map[k.toLowerCase()] ?? null });
const all = { essential: true, functional: true, performance: true, advertising: true };

describe("measurement tier", () => {
  it("is cookieless without a record, with DNT or GPC, or without performance", () => {
    expect(measurementTier(headers({}))).toBe("cookieless");
    expect(measurementTier(headers({ cookie: cookie(all), dnt: "1" }))).toBe("cookieless");
    expect(measurementTier(headers({ cookie: cookie(all), "sec-gpc": "1" }))).toBe("cookieless");
    expect(measurementTier(headers({ cookie: cookie({ ...all, performance: false }) }))).toBe("cookieless");
  });
  it("distinguishes performance from advertising", () => {
    expect(measurementTier(headers({ cookie: cookie({ ...all, advertising: false }) }))).toBe("performance");
    expect(measurementTier(headers({ cookie: cookie(all) }))).toBe("advertising");
  });
  it("treats malformed, stale or future records as cookieless", () => {
    expect(measurementTier(headers({ cookie: "sm_cookie_consent_v1=%7Bnot-json" }))).toBe("cookieless");
    expect(measurementTier(headers({ cookie: cookie({ ...all, advertising: "yes" }) }))).toBe("cookieless");
    expect(measurementTier(headers({ cookie: cookie(all, "2020-01-01T00:00:00Z") }))).toBe("cookieless");
    expect(measurementTier(headers({ cookie: cookie(all, new Date(Date.now() + 3600000).toISOString()) }))).toBe("cookieless");
    const malformedPrimary = `sm_cookie_consent_v1=garbage; napsite_cookie_consent_v1=${cookie(all).split("=")[1]}`;
    expect(measurementTier(headers({ cookie: malformedPrimary }))).toBe("cookieless");
  });
  it("keeps measurementConsent behaviour unchanged", () => {
    expect(measurementConsent(headers({ cookie: cookie(all) }), true)).toBe(true);
    expect(measurementConsent(headers({ cookie: cookie({ ...all, advertising: false }) }), true)).toBe(false);
    expect(measurementConsent(headers({ cookie: cookie({ ...all, advertising: false }) }))).toBe(true);
    expect(measurementConsent(headers({ cookie: cookie({ ...all, performance: false }) }))).toBe(false);
  });
});

describe("adSensitivity", () => {
  it("is unknown when the platform field is absent or malformed", () => {
    expect(adSensitivity(undefined)).toBe("unknown");
    expect(adSensitivity({})).toBe("unknown");
    expect(adSensitivity({ content_safety: null })).toBe("unknown");
    expect(adSensitivity({ content_safety: { classification: "maybe" } })).toBe("unknown");
  });
  it("passes the platform classification through", () => {
    expect(adSensitivity({ content_safety: { classification: "clear", reviewed: false } })).toBe("clear");
    expect(adSensitivity({ content_safety: { classification: "sensitive", reviewed: true, rules: ["topic-death-fatality"] } })).toBe("sensitive");
  });
});
