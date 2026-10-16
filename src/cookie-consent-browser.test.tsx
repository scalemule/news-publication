// @vitest-environment jsdom
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { CookieConsentBanner } from "./cookie-consent-banner";
import {
  checkUrlConsentBridge,
  clearCookieConsent,
  getCookieConsent,
  isCategoryAllowed,
  setCookieConsent,
  COOKIE_CONSENT_KEY,
} from "./cookies";

beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ok: true }) }),
  );
  clearCookieConsent();
  window.history.replaceState(null, "", "/");
  Object.defineProperty(navigator, "globalPrivacyControl", {
    configurable: true,
    value: false,
  });
});
afterEach(() => {
  cleanup();
  clearCookieConsent();
  vi.unstubAllGlobals();
});
describe("explicit privacy choices", () => {
  it("does not interrupt US readers: first-party measurement is implied with notice", () => {
    render(<CookieConsentBanner countryCode="US" />);
    expect(screen.queryByText("Your privacy choices")).toBeNull();
    expect(getCookieConsent()).toBeNull();
    expect(isCategoryAllowed("performance", "US")).toBe(true);
    expect(isCategoryAllowed("advertising", "US")).toBe(false);
  });
  it("asks EU readers first and preserves reject as an equal action", async () => {
    render(<CookieConsentBanner countryCode="DE" />);
    expect(screen.getByText("Your privacy choices")).toBeTruthy();
    expect(isCategoryAllowed("performance", "DE")).toBe(false);
    await act(async () =>
      fireEvent.click(screen.getByRole("button", { name: "Reject" })),
    );
    expect(isCategoryAllowed("performance", "DE")).toBe(false);
    expect(isCategoryAllowed("performance", "US")).toBe(false);
    expect(screen.queryByText("Your privacy choices")).toBeNull();
  });
  it("never grants optional consent from an unsigned URL", () => {
    window.history.replaceState(null, "", "/?sm_consent=1");
    expect(checkUrlConsentBridge()).toBe(false);
    expect(getCookieConsent()).toBeNull();
    render(<CookieConsentBanner countryCode="DE" />);
    expect(screen.getByText("Your privacy choices")).toBeTruthy();
  });
  it("sees another tab withdrawing previously cached acceptance", () => {
    setCookieConsent({ performance: true, advertising: true });
    expect(isCategoryAllowed("performance")).toBe(true);
    document.cookie =
      COOKIE_CONSENT_KEY +
      "=" +
      encodeURIComponent(
        JSON.stringify({
          version: 1,
          timestamp: new Date().toISOString(),
          preferences: {
            essential: true,
            performance: false,
            functional: false,
            advertising: false,
          },
        }),
      ) +
      "; Path=/";
    window.dispatchEvent(
      new StorageEvent("storage", { key: COOKIE_CONSENT_KEY }),
    );
    expect(isCategoryAllowed("performance")).toBe(false);
  });
  it("honors GPC and does not show an unnecessary opt-in banner", () => {
    Object.defineProperty(navigator, "globalPrivacyControl", {
      configurable: true,
      value: true,
    });
    render(<CookieConsentBanner countryCode="DE" />);
    expect(isCategoryAllowed("performance", "US")).toBe(false);
    expect(screen.queryByText("Your privacy choices")).toBeNull();
  });
});
