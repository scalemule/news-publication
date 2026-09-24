"use client";

import React, { useEffect, useState } from "react";
import {
  acceptAllCookies,
  rejectOptionalCookies,
  hasConsented,
  recordConsentToCompliance,
  COOKIE_CONSENT_EVENT,
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
}

export function CookieConsentBanner({
  title = "Help Us Improve Our Website with Cookies",
  text,
  settingsUrl = "/cookies",
  className = "",
  publicationSlug,
  complianceEndpoint = "/api/compliance/consent",
}: CookieConsentBannerProps) {
  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    setMounted(true);
    // Only display if user hasn't already made a recorded choice
    if (!hasConsented()) {
      // Small timeout for smooth entrance animation after page load
      const timer = window.setTimeout(() => setVisible(true), 300);
      return () => window.clearTimeout(timer);
    }

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
      We use cookies and process data from your device to analyze website performance,
      personalize ad content, and improve your experience. Your consent includes data
      transfers outside of the country you’re located. View{" "}
      <a href={settingsUrl} className="sm-cookie-banner-link">
        Cookie Settings
      </a>{" "}
      for more information.
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
