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
  EU_EEA_UK_COUNTRIES,
  isGeoConsentRequired,
  checkUrlConsentBridge,
  decorateNetworkUrl,
  NETWORK_CONSENT_STORAGE_KEY,
  DEFAULT_CONSENT_HUB_URL,
  queryNetworkConsentHub,
  setNetworkConsentHub,
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

describe("Geo-Location Prior-Consent Requirements", () => {
  it("recognizes EU/EEA/UK member state country codes", () => {
    expect(EU_EEA_UK_COUNTRIES.has("FR")).toBe(true);
    expect(EU_EEA_UK_COUNTRIES.has("DE")).toBe(true);
    expect(EU_EEA_UK_COUNTRIES.has("GB")).toBe(true);
    expect(EU_EEA_UK_COUNTRIES.has("IE")).toBe(true);
    expect(EU_EEA_UK_COUNTRIES.has("IT")).toBe(true);

    // Non-EU jurisdictions
    expect(EU_EEA_UK_COUNTRIES.has("US")).toBe(false);
    expect(EU_EEA_UK_COUNTRIES.has("CA")).toBe(false);
    expect(EU_EEA_UK_COUNTRIES.has("AU")).toBe(false);
    expect(EU_EEA_UK_COUNTRIES.has("JP")).toBe(false);
  });

  it("isGeoConsentRequired returns true for EU/EEA/UK country codes and false for US", () => {
    expect(isGeoConsentRequired("FR")).toBe(true);
    expect(isGeoConsentRequired("de")).toBe(true); // Case-insensitive
    expect(isGeoConsentRequired("gb")).toBe(true);

    expect(isGeoConsentRequired("US")).toBe(false);
    expect(isGeoConsentRequired("us")).toBe(false);
    expect(isGeoConsentRequired("CA")).toBe(false);
    expect(isGeoConsentRequired("")).toBe(false);
    expect(isGeoConsentRequired(null)).toBe(false);
    expect(isGeoConsentRequired(undefined)).toBe(false);
  });
});

describe("Cross-Domain Network Consent Bridge", () => {
  beforeEach(() => {
    clearCookieConsent();
  });

  it("decorateNetworkUrl appends sm_consent=1 when consent is accepted", () => {
    acceptAllCookies();
    const target = "https://concordchronicle.com/";
    const decorated = decorateNetworkUrl(target);
    expect(decorated).toBe("https://concordchronicle.com/?sm_consent=1");
  });

  it("decorateNetworkUrl appends sm_consent=0 when optional cookies are rejected", () => {
    rejectOptionalCookies();
    const target = "https://concordchronicle.com/";
    const decorated = decorateNetworkUrl(target);
    expect(decorated).toBe("https://concordchronicle.com/?sm_consent=0");
  });

  it("decorateNetworkUrl leaves url untouched if no consent has been given", () => {
    const target = "https://concordchronicle.com/";
    const decorated = decorateNetworkUrl(target);
    expect(decorated).toBe("https://concordchronicle.com/");
  });

  it("queryNetworkConsentHub reads from localStorage directly when running on hub origin", async () => {
    const hubOrigin = new URL(DEFAULT_CONSENT_HUB_URL).origin;
    const store = new Map<string, string>();
    store.set(NETWORK_CONSENT_STORAGE_KEY, "accepted");

    (globalThis as any).window = {
      location: { origin: hubOrigin },
      localStorage: {
        getItem: (k: string) => store.get(k) ?? null,
        setItem: (k: string, v: string) => store.set(k, v),
        removeItem: (k: string) => store.delete(k),
      },
      removeEventListener: () => {},
      addEventListener: () => {},
    };

    const status = await queryNetworkConsentHub(DEFAULT_CONSENT_HUB_URL, 100);
    expect(status).toBe("accepted");

    store.delete(NETWORK_CONSENT_STORAGE_KEY);
    const emptyStatus = await queryNetworkConsentHub(DEFAULT_CONSENT_HUB_URL, 100);
    expect(emptyStatus).toBe(null);

    delete (globalThis as any).window;
  });

  it("setNetworkConsentHub writes to localStorage directly when running on hub origin", () => {
    const hubOrigin = new URL(DEFAULT_CONSENT_HUB_URL).origin;
    const store = new Map<string, string>();

    (globalThis as any).window = {
      location: { origin: hubOrigin },
      localStorage: {
        getItem: (k: string) => store.get(k) ?? null,
        setItem: (k: string, v: string) => store.set(k, v),
        removeItem: (k: string) => store.delete(k),
      },
      removeEventListener: () => {},
      addEventListener: () => {},
    };

    setNetworkConsentHub("rejected", DEFAULT_CONSENT_HUB_URL);
    expect(store.get(NETWORK_CONSENT_STORAGE_KEY)).toBe("rejected");

    setNetworkConsentHub(null, DEFAULT_CONSENT_HUB_URL);
    expect(store.get(NETWORK_CONSENT_STORAGE_KEY)).toBe(undefined);

    delete (globalThis as any).window;
  });
});

