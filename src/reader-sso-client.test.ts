import { describe, expect, it } from "vitest";
import {
  READER_SSO_ATTEMPT_WINDOW_MS,
  firstName,
  greetingText,
  greetingWord,
  localHour,
  silentSignInDecision,
  silentSignInUrl,
  type SilentSignInEnvironment,
} from "./reader-sso-client";

const CHROME = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36";
const NOW = Date.UTC(2026, 9, 19, 15, 0, 0);
const ready: SilentSignInEnvironment = {
  enabled: true, hasSession: false, suppressed: false, webdriver: false, userAgent: CHROME,
  pathname: "/news/story", search: "?utm_source=x", fieldFocused: false, prerendering: false,
  visibilityState: "visible", framed: false, lastAttemptAt: null, now: NOW,
};

describe("silent sign-in gating", () => {
  it("attempts exactly once from a clean public page", () => {
    expect(silentSignInDecision(ready)).toEqual({ attempt: true });
    expect(silentSignInUrl("/api/news/ledvery-start", "/news/story", "?utm_source=x")).toBe("/api/news/ledvery-start?mode=silent&next=%2Fnews%2Fstory%3Futm_source%3Dx");
  });
  it("skips every condition the ADR lists", () => {
    const cases: Array<[Partial<SilentSignInEnvironment>, string]> = [
      [{ enabled: false }, "disabled"],
      [{ hasSession: true }, "session"],
      [{ suppressed: true }, "suppressed"],
      [{ webdriver: true }, "webdriver"],
      [{ userAgent: "Mozilla/5.0 (compatible; Googlebot/2.1)" }, "bot"],
      [{ userAgent: "HeadlessChrome/130" }, "bot"],
      [{ userAgent: "" }, "bot"],
      [{ framed: true }, "framed"],
      [{ prerendering: true }, "hidden"],
      [{ visibilityState: "hidden" }, "hidden"],
      [{ pathname: "/account" }, "private"],
      [{ pathname: "/review/abc" }, "private"],
      [{ pathname: "/newsletter" }, "private"],
      [{ search: "?signin=retry" }, "flow"],
      [{ search: "?signed_out=1" }, "flow"],
      [{ fieldFocused: true }, "typing"],
      [{ lastAttemptAt: NOW - READER_SSO_ATTEMPT_WINDOW_MS + 1 }, "recent"],
    ];
    for (const [override, reason] of cases) expect(silentSignInDecision({ ...ready, ...override })).toEqual({ attempt: false, reason });
    expect(silentSignInDecision({ ...ready, lastAttemptAt: NOW - READER_SSO_ATTEMPT_WINDOW_MS })).toEqual({ attempt: true });
    expect(silentSignInDecision({ ...ready, pathname: "/accounts-payable", privatePaths: [/^\/private/] })).toEqual({ attempt: true });
  });
});

describe("greeting", () => {
  it("takes the first name Unicode-safely and caps it", () => {
    expect(firstName("Alice Иванова")).toBe("Alice");
    expect(firstName("  Мария   Петрова ")).toBe("Мария");
    expect(firstName("李雷")).toBe("李雷");
    expect(firstName("😀😀 Smile")).toBe("😀😀");
    expect(firstName("a".repeat(60))).toHaveLength(40);
    expect(firstName("\u0000\u0007")).toBe("");
    expect(firstName(null)).toBe("");
  });
  it("uses the reader's time zone and locale and falls back safely", () => {
    const now = new Date(NOW); // 15:00 UTC
    expect(localHour(now, "Europe/Sofia", "bg-BG")).toBe(18);
    expect(localHour(now, "America/Los_Angeles", "en-US")).toBe(8);
    expect(localHour(now, "Not/AZone", "xx-INVALID")).toBe(localHour(now));
    expect(greetingWord(5)).toBe("Good morning");
    expect(greetingWord(11)).toBe("Good morning");
    expect(greetingWord(12)).toBe("Good afternoon");
    expect(greetingWord(17)).toBe("Good afternoon");
    expect(greetingWord(18)).toBe("Good evening");
    expect(greetingWord(3)).toBe("Good evening");
  });
  it("composes a greeting or the neutral fallback, never an email", () => {
    const now = new Date(NOW);
    expect(greetingText({ full_name: "Alice Иванова", time_zone: "Europe/Sofia", locale: "bg-BG" }, now)).toBe("Good evening, Alice");
    expect(greetingText({ full_name: "Dana Lee", time_zone: "America/Los_Angeles" }, now)).toBe("Good morning, Dana");
    expect(greetingText({ full_name: "" }, now)).toBe("Welcome back");
    expect(greetingText({}, now, "Hello")).toBe("Hello");
  });
});
