export type ThemeMode = "light" | "dark" | "system";
export type EffectiveTheme = "light" | "dark";

export const THEME_COOKIE = "news_publication_theme";
export const THEME_STORAGE_KEY = "news_publication_theme";
export const THEME_EVENT = "news_publication_theme_change";
export const THEME_MAX_AGE_SECONDS = 365 * 24 * 60 * 60; // 1 year

let memoryTheme: ThemeMode = "system";

/**
 * Returns the current system color scheme preference.
 */
export function getSystemTheme(): EffectiveTheme {
  if (typeof window === "undefined" || !window.matchMedia) return "light";
  try {
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  } catch {
    return "light";
  }
}

/**
 * Resolves the effective "light" or "dark" appearance from a chosen mode.
 */
export function resolveEffectiveTheme(mode: ThemeMode): EffectiveTheme {
  if (mode === "system") return getSystemTheme();
  return mode;
}

/**
 * Reads stored theme mode from localStorage, falling back to cookie, memory, then "system".
 */
export function getStoredTheme(): ThemeMode {
  if (typeof window === "undefined") return memoryTheme;
  try {
    const stored = window.localStorage?.getItem?.(THEME_STORAGE_KEY);
    if (stored === "light" || stored === "dark" || stored === "system") {
      memoryTheme = stored;
      return stored;
    }
  } catch {
    // LocalStorage access restricted
  }
  if (typeof document !== "undefined" && document.cookie) {
    try {
      const match = document.cookie.match(new RegExp(`(?:^|; )${THEME_COOKIE}=([^;]*)`));
      if (match) {
        const decoded = decodeURIComponent(match[1]);
        if (decoded === "light" || decoded === "dark" || decoded === "system") {
          memoryTheme = decoded;
          return decoded;
        }
      }
    } catch {
      // Cookie parsing error
    }
  }
  return memoryTheme;
}

/**
 * Applies the given theme mode to documentElement attribute and publication elements.
 */
export function applyTheme(mode: ThemeMode): void {
  if (typeof document === "undefined") return;
  try {
    document.documentElement.setAttribute("data-theme", mode);
    const elements = document.querySelectorAll(".publication");
    elements.forEach(el => el.setAttribute("data-theme", mode));
  } catch {
    // DOM not ready or read-only
  }
}

const memoryListeners = new Set<() => void>();

/**
 * Persists the reader's theme mode in memory, localStorage, and cookie,
 * applies the attribute, and broadcasts an event for other components and browser tabs.
 */
export function setTheme(mode: ThemeMode): void {
  memoryTheme = mode;
  if (typeof window !== "undefined") {
    try {
      window.localStorage?.setItem?.(THEME_STORAGE_KEY, mode);
    } catch {
      // Storage write failed
    }
    if (typeof document !== "undefined") {
      try {
        document.cookie = `${THEME_COOKIE}=${encodeURIComponent(mode)}; path=/; max-age=${THEME_MAX_AGE_SECONDS}; SameSite=Lax`;
      } catch {
        // Cookie write failed
      }
    }
    applyTheme(mode);
    const effective = resolveEffectiveTheme(mode);
    try {
      window.dispatchEvent(
        new CustomEvent(THEME_EVENT, {
          detail: { mode, effective },
        })
      );
    } catch {
      // CustomEvent failed
    }
  }
  memoryListeners.forEach(listener => {
    try {
      listener();
    } catch {
      // Listener error
    }
  });
}

/**
 * Resets stored theme to "system" and cleans cookies/storage.
 */
export function clearTheme(): void {
  memoryTheme = "system";
  if (typeof document !== "undefined") {
    try {
      document.cookie = `${THEME_COOKIE}=; path=/; max-age=0; SameSite=Lax`;
      document.documentElement.removeAttribute("data-theme");
    } catch {}
  }
  if (typeof window !== "undefined") {
    try {
      window.localStorage?.removeItem?.(THEME_STORAGE_KEY);
    } catch {}
  }
  memoryListeners.forEach(listener => {
    try {
      listener();
    } catch {}
  });
}

/**
 * Subscribes to theme changes across in-memory calls, storage events, custom events, and system media queries.
 */
export function subscribeTheme(listener: () => void): () => void {
  memoryListeners.add(listener);

  if (typeof window === "undefined") {
    return () => {
      memoryListeners.delete(listener);
    };
  }

  const onStorage = (e: StorageEvent) => {
    if (e.key === THEME_STORAGE_KEY) {
      applyTheme(getStoredTheme());
      listener();
    }
  };

  const onCustom = () => {
    listener();
  };

  window.addEventListener("storage", onStorage);
  window.addEventListener(THEME_EVENT, onCustom);

  let mediaQuery: MediaQueryList | undefined;
  let onMediaChange: (() => void) | undefined;

  if (window.matchMedia) {
    try {
      mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
      onMediaChange = () => {
        if (getStoredTheme() === "system") {
          applyTheme("system");
          listener();
        }
      };
      if (mediaQuery.addEventListener) {
        mediaQuery.addEventListener("change", onMediaChange);
      } else if (mediaQuery.addListener) {
        mediaQuery.addListener(onMediaChange);
      }
    } catch {}
  }

  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(THEME_EVENT, onCustom);
    if (mediaQuery && onMediaChange) {
      if (mediaQuery.removeEventListener) {
        mediaQuery.removeEventListener("change", onMediaChange);
      } else if (mediaQuery.removeListener) {
        mediaQuery.removeListener(onMediaChange);
      }
    }
  };
}

/**
 * Inline JavaScript to inject into <head> to synchronously set data-theme before
 * any DOM renders, eliminating any Flash of Unstyled Content (FOUC).
 */
export function themeInitScript(): string {
  return `(function(){try{var k='${THEME_STORAGE_KEY}',m=localStorage.getItem(k);if(!m){var c=document.cookie.match(/(?:^|; )news_publication_theme=([^;]*)/);m=c?decodeURIComponent(c[1]):'system';}if(m==='light'||m==='dark'||m==='system'){document.documentElement.setAttribute('data-theme',m);}}catch(e){}})();`;
}
