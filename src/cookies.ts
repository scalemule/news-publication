export type CookieCategory = "essential" | "performance" | "functional" | "advertising";

export interface CookiePreferences {
  /** Strictly necessary cookies required for core site operation and security. Always true. */
  essential: true;
  /** Analytics and performance measurement to improve community coverage and site speed. */
  performance: boolean;
  /** Personalization features such as narration audio speed, text sizing, and town filters. */
  functional: boolean;
  /** Local sponsorship delivery and partner campaign frequency capping. */
  advertising: boolean;
}

export interface CookieConsentRecord {
  version: 1;
  preferences: CookiePreferences;
  timestamp: string;
  anonymous_id?: string;
  source: "banner_accept" | "banner_reject" | "settings_save";
}

export interface CookieDisclosure {
  name: string;
  provider: string;
  purpose: string;
  duration: string;
  type: "HTTP Cookie" | "Local Storage" | "Session Storage";
}

export interface CookieCategoryDefinition {
  id: CookieCategory;
  title: string;
  shortDescription: string;
  fullDescription: string;
  required: boolean;
  cookies: CookieDisclosure[];
}

export const COOKIE_CONSENT_KEY = "sm_cookie_consent_v1";
export const COOKIE_CONSENT_BACKUP_KEY = "napsite_cookie_consent_v1";
export const COOKIE_CONSENT_EVENT = "scalemule-cookie-consent-change";
export const COOKIE_CONSENT_MAX_AGE_SECONDS = 365 * 24 * 60 * 60; // 1 year

export const DEFAULT_PREFERENCES_REJECTED: CookiePreferences = {
  essential: true,
  performance: false,
  functional: false,
  advertising: false,
};

export const DEFAULT_PREFERENCES_ACCEPTED: CookiePreferences = {
  essential: true,
  performance: true,
  functional: true,
  advertising: true,
};

export const COOKIE_CATEGORIES: CookieCategoryDefinition[] = [
  {
    id: "essential",
    title: "Strictly Necessary Cookies",
    shortDescription: "Essential for site security, navigation, and privacy preference management.",
    fullDescription:
      "These cookies are necessary for the website to function properly and securely. They enable core features such as load balancing, CSRF protection, secure session tokens, and remembering your cookie consent choice. Because the site cannot function without them, they cannot be turned off.",
    required: true,
    cookies: [
      {
        name: "sm_cookie_consent_v1",
        provider: "First-Party (ScaleMule)",
        purpose: "Stores your verified cookie privacy and category consent choices.",
        duration: "1 year",
        type: "HTTP Cookie",
      },
      {
        name: "napsite_session_v1",
        provider: "First-Party",
        purpose: "Maintains session continuity, security tokens, and server routing.",
        duration: "30 minutes (idle)",
        type: "Session Storage",
      },
      {
        name: "napsite_preview",
        provider: "First-Party",
        purpose: "Verifies preview access permissions when viewing unpublished newsroom editions.",
        duration: "14 days",
        type: "HTTP Cookie",
      },
    ],
  },
  {
    id: "performance",
    title: "Performance & Analytics Cookies",
    shortDescription: "Help us measure reader engagement, story completion, and site reliability.",
    fullDescription:
      "These cookies collect anonymous information about how visitors navigate our news publication. They allow us to count article reads, understand scroll depth and reading completion, and identify broken links or slow-loading assets so we can keep our community reporting responsive and fast. All metrics are aggregated and never contain personal information.",
    required: false,
    cookies: [
      {
        name: "napsite_visitor_v1",
        provider: "First-Party",
        purpose: "A randomized anonymous UUIDv7 to count distinct readers without tracking personal identity.",
        duration: "1 year",
        type: "Local Storage",
      },
      {
        name: "napsite_analytics_v1",
        provider: "First-Party",
        purpose: "Connects reading completion and web vitals to the anonymous session.",
        duration: "30 minutes",
        type: "HTTP Cookie",
      },
    ],
  },
  {
    id: "functional",
    title: "Functional & Personalization Cookies",
    shortDescription: "Remember your reading preferences, text size, and narration audio settings.",
    fullDescription:
      "These cookies enable enhanced convenience features designed for readers. They remember your custom text sizing, keep your preferred audio narration playback speed (e.g., 1.0x vs 1.25x), and preserve your local town filters across the front page so you always see news closest to your neighborhood.",
    required: false,
    cookies: [
      {
        name: "reader_text_size",
        provider: "First-Party",
        purpose: "Remembers your preferred reading font size across articles.",
        duration: "1 year",
        type: "Local Storage",
      },
      {
        name: "audio_narration_speed",
        provider: "First-Party",
        purpose: "Stores your preferred audio player playback rate (e.g. 1.0x, 1.25x).",
        duration: "1 year",
        type: "Local Storage",
      },
    ],
  },
  {
    id: "advertising",
    title: "Advertising & Local Sponsorship Cookies",
    shortDescription: "Support local business sponsors by capping repetition and measuring notices.",
    fullDescription:
      "Our journalism is supported by local business sponsors and community partners. These cookies ensure you do not see the same sponsor banner repeatedly (frequency capping) and help local merchants measure whether their announcement reached their community. They never track your activity across unrelated third-party websites or build external advertising profiles.",
    required: false,
    cookies: [
      {
        name: "napsite_sponsor_cap",
        provider: "First-Party",
        purpose: "Prevents repetitive display of identical local business announcements.",
        duration: "7 days",
        type: "Local Storage",
      },
      {
        name: "local_sponsor_ref",
        provider: "First-Party",
        purpose: "Attributes community inquiries directly to the sponsoring local merchant.",
        duration: "30 days",
        type: "Local Storage",
      },
    ],
  },
];

let memoryConsent: CookieConsentRecord | null = null;

function readCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(new RegExp("(?:^|; )" + name.replace(/([.$?*|{}()[\]\\/+^])/g, "\\$1") + "=([^;]*)"));
  return match ? decodeURIComponent(match[1]) : null;
}

function writeCookie(name: string, value: string, maxAgeSeconds: number): void {
  if (typeof document === "undefined") return;
  const secure = typeof location !== "undefined" && location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${name}=${encodeURIComponent(value)}; Path=/; Max-Age=${maxAgeSeconds}; SameSite=Lax${secure}`;
}

/**
 * Retrieve the current cookie consent record.
 * Checks HTTP cookie first, then localStorage fallback, then in-memory state.
 */
export function getCookieConsent(): CookieConsentRecord | null {
  if (typeof window === "undefined") return memoryConsent;
  try {
    const raw = readCookie(COOKIE_CONSENT_KEY) || readCookie(COOKIE_CONSENT_BACKUP_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as CookieConsentRecord;
      if (parsed && parsed.version === 1 && parsed.preferences) {
        memoryConsent = parsed;
        return parsed;
      }
    }
    const stored = window.localStorage?.getItem(COOKIE_CONSENT_KEY);
    if (stored) {
      const parsed = JSON.parse(stored) as CookieConsentRecord;
      if (parsed && parsed.version === 1 && parsed.preferences) {
        memoryConsent = parsed;
        return parsed;
      }
    }
  } catch {
    // Malformed storage is ignored
  }
  return memoryConsent;
}

/**
 * Check if the user has already provided an explicit consent decision.
 */
export function hasConsented(): boolean {
  return getCookieConsent() !== null;
}

/**
 * Check if a specific cookie category is currently permitted.
 * Essential is always permitted.
 */
export function isCategoryAllowed(category: CookieCategory): boolean {
  if (category === "essential") return true;
  const consent = getCookieConsent();
  if (!consent) {
    // Check Global Privacy Control or DNT before explicit consent
    if (typeof navigator !== "undefined") {
      const nav = navigator as Navigator & { globalPrivacyControl?: boolean };
      if (nav.globalPrivacyControl || nav.doNotTrack === "1") {
        return false;
      }
    }
    return false;
  }
  return Boolean(consent.preferences[category]);
}

/**
 * Record cookie consent choices.
 * Updates both HTTP cookies, localStorage, and fires a window event.
 */
export function setCookieConsent(
  preferences: Partial<CookiePreferences>,
  source: CookieConsentRecord["source"] = "settings_save",
): CookieConsentRecord {
  const mergedPreferences: CookiePreferences = {
    essential: true,
    performance: Boolean(preferences.performance),
    functional: Boolean(preferences.functional),
    advertising: Boolean(preferences.advertising),
  };

  let anonymous_id: string | undefined;
  if (typeof window !== "undefined") {
    try {
      anonymous_id = window.localStorage?.getItem("napsite_visitor_v1") || undefined;
    } catch {
      // ignore
    }
  }

  const record: CookieConsentRecord = {
    version: 1,
    preferences: mergedPreferences,
    timestamp: new Date().toISOString(),
    anonymous_id,
    source,
  };

  memoryConsent = record;
  const serialized = JSON.stringify(record);
  writeCookie(COOKIE_CONSENT_KEY, serialized, COOKIE_CONSENT_MAX_AGE_SECONDS);
  writeCookie(COOKIE_CONSENT_BACKUP_KEY, serialized, COOKIE_CONSENT_MAX_AGE_SECONDS);

  if (typeof window !== "undefined") {
    try {
      window.localStorage?.setItem(COOKIE_CONSENT_KEY, serialized);
    } catch {
      // LocalStorage might be disabled or full
    }
    // Notify in-process listeners
    window.dispatchEvent(new CustomEvent(COOKIE_CONSENT_EVENT, { detail: record }));
  }

  return record;
}

/**
 * Accepts all cookies (essential, performance, functional, advertising).
 */
export function acceptAllCookies(): CookieConsentRecord {
  return setCookieConsent(DEFAULT_PREFERENCES_ACCEPTED, "banner_accept");
}

/**
 * Rejects all optional cookies (preserves essential cookies only).
 */
export function rejectOptionalCookies(): CookieConsentRecord {
  return setCookieConsent(DEFAULT_PREFERENCES_REJECTED, "banner_reject");
}

/**
 * Clear consent record (used when resetting choices).
 */
export function clearCookieConsent(): void {
  memoryConsent = null;
  if (typeof document !== "undefined") {
    document.cookie = `${COOKIE_CONSENT_KEY}=; Path=/; Max-Age=0; SameSite=Lax`;
    document.cookie = `${COOKIE_CONSENT_BACKUP_KEY}=; Path=/; Max-Age=0; SameSite=Lax`;
  }
  if (typeof window !== "undefined") {
    try {
      window.localStorage?.removeItem(COOKIE_CONSENT_KEY);
    } catch {
      // ignore
    }
    window.dispatchEvent(new CustomEvent(COOKIE_CONSENT_EVENT, { detail: null }));
  }
}

/**
 * Forward the user consent choice to ScaleMule compliance service.
 * Respects customer security boundary: uses relative /api/compliance/consent proxy or client endpoint.
 */
export async function recordConsentToCompliance(
  record: CookieConsentRecord,
  options?: {
    endpoint?: string;
    publicationSlug?: string;
  },
): Promise<void> {
  if (typeof window === "undefined") return;
  const endpoint = options?.endpoint || "/api/compliance/consent";
  try {
    const payload = {
      consent_type: "cookie_policy",
      granted: record.preferences.performance || record.preferences.advertising,
      preferences: record.preferences,
      source: record.source,
      anonymous_id: record.anonymous_id,
      timestamp: record.timestamp,
      url: window.location.href,
      user_agent: window.navigator.userAgent,
    };

    if (typeof navigator.sendBeacon === "function") {
      navigator.sendBeacon(endpoint, new Blob([JSON.stringify(payload)], { type: "application/json" }));
    } else {
      await fetch(endpoint, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
        keepalive: true,
      });
    }
  } catch {
    // Non-blocking: failure to reach compliance API must never break reader experience
  }
}
