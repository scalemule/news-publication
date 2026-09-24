import {
  acceptAllCookies,
  rejectOptionalCookies,
  setCookieConsent,
  getCookieConsent,
  clearCookieConsent,
  hasConsented,
  isCategoryAllowed,
  isGeoConsentRequired,
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
  isGeoConsentRequired,
  checkUrlConsentBridge,
  decorateNetworkUrl,
  queryNetworkConsentHub,
  setNetworkConsentHub,
  getLegalAcceptance,
  recordLegalAcceptance,
  isLegalAcceptanceCurrent,
  clearLegalAcceptance,
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
