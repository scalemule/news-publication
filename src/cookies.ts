import {
  acceptAllCookies,
  rejectOptionalCookies,
  setCookieConsent,
  getCookieConsent,
  clearCookieConsent,
  hasConsented,
  isCategoryAllowed,
  isGpcActive,
  isGeoConsentRequired,
  consentModel,
  impliedPreferences,
  effectivePreferences,
  checkUrlConsentBridge,
  decorateNetworkUrl,
  queryNetworkConsentHub,
  setNetworkConsentHub,
  recordConsentToCompliance as baseRecordConsentToCompliance,
  COOKIE_CONSENT_KEY,
  COOKIE_CONSENT_BACKUP_KEY,
  COOKIE_CONSENT_EVENT,
  COOKIE_CONSENT_MAX_AGE_SECONDS,
  DEFAULT_CONSENT_HUB_URL,
  NETWORK_CONSENT_STORAGE_KEY,
  DEFAULT_PREFERENCES_ACCEPTED,
  DEFAULT_PREFERENCES_REJECTED,
  EU_EEA_UK_COUNTRIES,
  getLegalAcceptance,
  recordLegalAcceptance,
  isLegalAcceptanceCurrent,
  clearLegalAcceptance,
} from "@scalemule/compliance";
import type {
  CookieCategory,
  CookieCategoryDefinition,
  CookieConsentRecord,
  CookieDisclosure,
  CookiePreferences,
  LegalAcceptanceRecord,
  LegalVersionConfig,
  ComplianceConfig,
} from "@scalemule/compliance";

export async function recordConsentToCompliance(
  record: CookieConsentRecord,
  options?: {
    endpoint?: string;
    applicationId?: string;
    publicationSlug?: string;
  }
): Promise<void> {
  return baseRecordConsentToCompliance(record, options);
}

import { isNetworkHostname } from "./network";

let delegationInstalled = false;

/**
 * Installs a global delegated click listener on `document` that automatically decorates
 * any outgoing link to any publication in the ScaleMule news network with the reader's
 * refusal of optional categories (?sm_consent=0).
 *
 * Acceptance remains local because a binary URL cannot preserve category choices.
 */
export function setupNetworkConsentDelegation(): void {
  if (typeof window === "undefined" || delegationInstalled) return;
  delegationInstalled = true;

  document.addEventListener(
    "click",
    (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      const anchor = target?.closest("a");
      if (!anchor || !anchor.href) return;

      try {
        const url = new URL(anchor.href, window.location.href);
        if (url.protocol !== "http:" && url.protocol !== "https:") return;

        if (isNetworkHostname(url.hostname)) {
          const consent = getCookieConsent();
          if (consent) {
            const decorated = decorateNetworkUrl(anchor.href);
            if (decorated !== anchor.href) {
              anchor.href = decorated;
            }
          }
        }
      } catch {
        // Ignore invalid URL
      }
    },
    { capture: true }
  );
}

export {
  COOKIE_CONSENT_KEY,
  COOKIE_CONSENT_BACKUP_KEY,
  COOKIE_CONSENT_EVENT,
  COOKIE_CONSENT_MAX_AGE_SECONDS,
  DEFAULT_CONSENT_HUB_URL,
  NETWORK_CONSENT_STORAGE_KEY,
  DEFAULT_PREFERENCES_ACCEPTED,
  DEFAULT_PREFERENCES_REJECTED,
  EU_EEA_UK_COUNTRIES,
  getCookieConsent,
  setCookieConsent,
  acceptAllCookies,
  rejectOptionalCookies,
  clearCookieConsent,
  hasConsented,
  isCategoryAllowed,
  isGpcActive,
  isGeoConsentRequired,
  consentModel,
  impliedPreferences,
  effectivePreferences,
  checkUrlConsentBridge,
  decorateNetworkUrl,
  queryNetworkConsentHub,
  setNetworkConsentHub,
  getLegalAcceptance,
  recordLegalAcceptance,
  isLegalAcceptanceCurrent,
  clearLegalAcceptance,
  isNetworkHostname,
};

export type {
  CookieCategory,
  CookieCategoryDefinition,
  CookieConsentRecord,
  CookieDisclosure,
  CookiePreferences,
  LegalAcceptanceRecord,
  LegalVersionConfig,
  ComplianceConfig,
};

/**
 * News-publication specific cookie category disclosures.
 * Defaults configured for ScaleMule community newsrooms and broadsheet publications.
 */
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
      "We always count page views and reading activity without cookies or any identifier stored on your device: the server derives a daily-rotating, non-reversible hash that cannot be linked back to you, and your IP address is truncated before it is stored. With these cookies turned on, first-party identifiers additionally let us recognise a return visit and measure sessions. In the United States and most other regions they are on by default and you can turn them off here; in the EU, EEA, UK and Switzerland they stay off until you accept them.",
    required: false,
    cookies: [
      {
        name: "napsite_session_v1",
        provider: "First-Party",
        purpose: "Groups consented reading measurements within a session.",
        duration: "30 minutes (idle)",
        type: "Session Storage",
      },

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
        name: "news_publication_theme",
        provider: "First-Party",
        purpose: "Remembers your reading theme preference (light, dark, or system).",
        duration: "1 year",
        type: "HTTP Cookie",
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
    shortDescription: "Measure clearly labeled community sponsorship views and link clicks.",
    fullDescription:
      "With your permission, we measure visible sponsor acknowledgments and link clicks. Repetition limits use temporary page-session memory. We do not use third-party advertising trackers or build behavioral advertising profiles.",
    required: false,
    cookies: [],
  },
];
