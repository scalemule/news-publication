"use client";

import React, { useEffect, useState } from "react";
import {
  acceptAllCookies,
  rejectOptionalCookies,
  hasConsented,
  recordConsentToCompliance,
  COOKIE_CONSENT_EVENT,
  isGpcActive,
  DEFAULT_CONSENT_HUB_URL,
} from "./cookies";

export interface CookieConsentBannerProps {
  /** Title displayed in banner. Default: "Help Us Improve Our Website with Cookies" */
  title?: string;
  /** Description text displayed in banner */
  text?: string;
  /** URL to the detailed cookie settings page. Default: "/cookies" */
  settingsUrl?: string;
  /** Custom class name on outermost wrapper */
  className?: string;
  /** Optional publication identifier or slug for compliance reporting */
  publicationSlug?: string;
  /** Compliance recording endpoint. Default: "/api/compliance/consent" */
  complianceEndpoint?: string;
  /** Explicit ISO 3166-1 alpha-2 country code (e.g. from server headers or GeoIP) */
  countryCode?: string | null;
  /** Force display of banner regardless of visitor geography */
  forceShow?: boolean;
  /** URL of the central network consent iframe bridge. Default: "https://bayareachronicle.com/consent-bridge.html" */
  consentHubUrl?: string;
}

export function CookieConsentBanner({
  title = "Your privacy choices",
  text,
  settingsUrl = "/cookies",
  className = "",
  publicationSlug,
  complianceEndpoint = "/api/compliance/consent",
  countryCode,
  forceShow = false,
  consentHubUrl = DEFAULT_CONSENT_HUB_URL,
}: CookieConsentBannerProps) {
  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    setMounted(true);
    // Analytics requires an explicit choice everywhere. Geography must not hide
    // the only way to make that choice. An unsigned URL or a binary network hub
    // response cannot grant category-level permission on this publication.
    const url = new URL(window.location.href);
    if (url.searchParams.has("sm_consent")) {
      if (url.searchParams.get("sm_consent") === "0" && !hasConsented())
        rejectOptionalCookies({ hubUrl: consentHubUrl });
      url.searchParams.delete("sm_consent");
      window.history.replaceState(window.history.state, "", url);
    }
    setVisible(!hasConsented() && !isGpcActive());
  }, [countryCode, forceShow, consentHubUrl]);

  useEffect(() => {
    const onConsentChange = () => {
      setVisible(!hasConsented() && !isGpcActive());
    };
    window.addEventListener(COOKIE_CONSENT_EVENT, onConsentChange);
    return () =>
      window.removeEventListener(COOKIE_CONSENT_EVENT, onConsentChange);
  }, []);

  if (!mounted || !visible) return null;

  const handleAccept = () => {
    const record = acceptAllCookies({ hubUrl: consentHubUrl });
    setVisible(false);
    void recordConsentToCompliance(record, {
      endpoint: complianceEndpoint,
      publicationSlug,
    });
  };

  const handleReject = () => {
    const record = rejectOptionalCookies({ hubUrl: consentHubUrl });
    setVisible(false);
    void recordConsentToCompliance(record, {
      endpoint: complianceEndpoint,
      publicationSlug,
    });
  };

  const defaultText = (
    <>
      With your permission, we measure reading activity and sponsor
      acknowledgments. You can read the publication with optional cookies turned
      off. View{" "}
      <a href={settingsUrl} className="sm-cookie-banner-link">
        Cookie Settings
      </a>{" "}
      for details.
    </>
  );

  return (
    <aside
      className={`sm-cookie-banner-wrapper ${className}`}
      role="region"
      aria-label="Cookie consent"
    >
      <div className="sm-cookie-banner-card">
        <div className="sm-cookie-banner-content">
          <h2 className="sm-cookie-banner-title">{title}</h2>
          <p className="sm-cookie-banner-text">
            {text ? (
              <>
                {text}{" "}
                <a href={settingsUrl} className="sm-cookie-banner-link">
                  Cookie Settings
                </a>
              </>
            ) : (
              defaultText
            )}
          </p>
        </div>
        <div className="sm-cookie-banner-actions">
          <button
            type="button"
            className="sm-cookie-btn sm-cookie-btn-primary"
            onClick={handleAccept}
          >
            Accept
          </button>
          <button
            type="button"
            className="sm-cookie-btn sm-cookie-btn-secondary"
            onClick={handleReject}
          >
            Reject
          </button>
        </div>
      </div>
    </aside>
  );
}
