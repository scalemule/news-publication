"use client";

import React, { useEffect, useState } from "react";
import {
  acceptAllCookies,
  rejectOptionalCookies,
  hasConsented,
  recordConsentToCompliance,
  COOKIE_CONSENT_EVENT,
  isGeoConsentRequired,
  checkUrlConsentBridge,
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
}

export function CookieConsentBanner({
  title = "Help Us Improve Our Website with Cookies",
  text,
  settingsUrl = "/cookies",
  className = "",
  publicationSlug,
  complianceEndpoint = "/api/compliance/consent",
  countryCode,
  forceShow = false,
}: CookieConsentBannerProps) {
  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    setMounted(true);

    // 1. Process any cross-domain network consent signal in the URL (?sm_consent=1|0)
    if (checkUrlConsentBridge()) {
      setVisible(false);
      return;
    }

    // 2. Only display if user hasn't already made a recorded choice
    if (hasConsented()) {
      setVisible(false);
      return;
    }

    // 3. Geo-Location requirement: only show if visitor is in EU/EEA/UK jurisdiction
    // (US/California readers operate on CCPA opt-out via footer, no popup required)
    if (!forceShow && !isGeoConsentRequired(countryCode)) {
      setVisible(false);
      return;
    }

    // Small timeout for smooth entrance animation after page load
    const timer = window.setTimeout(() => setVisible(true), 300);
    return () => window.clearTimeout(timer);
  }, [countryCode, forceShow]);

  useEffect(() => {
    const onConsentChange = () => {
      if (hasConsented()) {
        setVisible(false);
      }
    };
    window.addEventListener(COOKIE_CONSENT_EVENT, onConsentChange);
    return () => window.removeEventListener(COOKIE_CONSENT_EVENT, onConsentChange);
  }, []);

  if (!mounted || !visible) return null;

  const handleAccept = () => {
    const record = acceptAllCookies();
    setVisible(false);
    void recordConsentToCompliance(record, {
      endpoint: complianceEndpoint,
      publicationSlug,
    });
  };

  const handleReject = () => {
    const record = rejectOptionalCookies();
    setVisible(false);
    void recordConsentToCompliance(record, {
      endpoint: complianceEndpoint,
      publicationSlug,
    });
  };

  const defaultText = (
    <>
      We use cookies and device data to analyze performance, support local sponsors,
      and remember your reading preferences across our news network. View{" "}
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
