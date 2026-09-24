import { describe, it, expect, beforeEach } from "vitest";
import {
  COOKIE_CATEGORIES,
  DEFAULT_PREFERENCES_ACCEPTED,
  DEFAULT_PREFERENCES_REJECTED,
  getCookieConsent,
  setCookieConsent,
  hasConsented,
  isCategoryAllowed,
  clearCookieConsent,
  acceptAllCookies,
  rejectOptionalCookies,
} from "./cookies";

describe("Cookie Consent State & Disclosures", () => {
  beforeEach(() => {
    clearCookieConsent();
  });

  it("contains all 4 required cookie categories with detailed disclosures", () => {
    const ids = COOKIE_CATEGORIES.map(c => c.id);
    expect(ids).toEqual(["essential", "performance", "functional", "advertising"]);

    const essential = COOKIE_CATEGORIES.find(c => c.id === "essential");
    expect(essential?.required).toBe(true);
    expect(essential?.cookies.length).toBeGreaterThan(0);

    const performance = COOKIE_CATEGORIES.find(c => c.id === "performance");
    expect(performance?.required).toBe(false);
    expect(performance?.cookies.some(c => c.name === "napsite_visitor_v1")).toBe(true);
  });

  it("essential category is always allowed even before explicit consent", () => {
    expect(hasConsented()).toBe(false);
    expect(isCategoryAllowed("essential")).toBe(true);
    expect(isCategoryAllowed("performance")).toBe(false);
  });

  it("acceptAllCookies enables all categories and saves record", () => {
    const record = acceptAllCookies();
    expect(record.version).toBe(1);
    expect(record.source).toBe("banner_accept");
    expect(record.preferences).toEqual(DEFAULT_PREFERENCES_ACCEPTED);

    expect(hasConsented()).toBe(true);
    expect(isCategoryAllowed("essential")).toBe(true);
    expect(isCategoryAllowed("performance")).toBe(true);
    expect(isCategoryAllowed("functional")).toBe(true);
    expect(isCategoryAllowed("advertising")).toBe(true);
  });

  it("rejectOptionalCookies leaves only essential cookies enabled", () => {
    const record = rejectOptionalCookies();
    expect(record.source).toBe("banner_reject");
    expect(record.preferences).toEqual(DEFAULT_PREFERENCES_REJECTED);

    expect(hasConsented()).toBe(true);
    expect(isCategoryAllowed("essential")).toBe(true);
    expect(isCategoryAllowed("performance")).toBe(false);
    expect(isCategoryAllowed("functional")).toBe(false);
    expect(isCategoryAllowed("advertising")).toBe(false);
  });

  it("custom preferences can selectively allow functional while rejecting advertising", () => {
    setCookieConsent({ performance: true, functional: true, advertising: false }, "settings_save");

    expect(isCategoryAllowed("essential")).toBe(true);
    expect(isCategoryAllowed("performance")).toBe(true);
    expect(isCategoryAllowed("functional")).toBe(true);
    expect(isCategoryAllowed("advertising")).toBe(false);

    const saved = getCookieConsent();
    expect(saved?.source).toBe("settings_save");
  });
});
