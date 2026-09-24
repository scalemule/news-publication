import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  THEME_COOKIE,
  THEME_STORAGE_KEY,
  getStoredTheme,
  setTheme,
  clearTheme,
  resolveEffectiveTheme,
  themeInitScript,
  subscribeTheme,
} from "./theme";

describe("News Publication Theme Management", () => {
  beforeEach(() => {
    clearTheme();
  });

  it("defaults to system when no preference is stored", () => {
    expect(getStoredTheme()).toBe("system");
  });

  it("stores and retrieves light and dark themes", () => {
    setTheme("dark");
    expect(getStoredTheme()).toBe("dark");

    setTheme("light");
    expect(getStoredTheme()).toBe("light");
  });

  it("sets a long-lived cookie for server-side persistence when document is available", () => {
    setTheme("dark");
    if (typeof document !== "undefined") {
      expect(document.cookie).toContain(`${THEME_COOKIE}=dark`);
    }

    setTheme("system");
    if (typeof document !== "undefined") {
      expect(document.cookie).toContain(`${THEME_COOKIE}=system`);
    }
  });

  it("resolves effective theme based on mode", () => {
    expect(resolveEffectiveTheme("light")).toBe("light");
    expect(resolveEffectiveTheme("dark")).toBe("dark");
    const system = resolveEffectiveTheme("system");
    expect(["light", "dark"]).toContain(system);
  });

  it("generates a valid non-empty head init script to prevent FOUC", () => {
    const script = themeInitScript();
    expect(script).toContain(THEME_STORAGE_KEY);
    expect(script).toContain(THEME_COOKIE);
    expect(script).toContain("document.documentElement.setAttribute('data-theme'");
  });

  it("notifies subscribers when theme changes", () => {
    const listener = vi.fn();
    const unsubscribe = subscribeTheme(listener);

    setTheme("dark");
    expect(listener).toHaveBeenCalled();

    unsubscribe();
  });
});
