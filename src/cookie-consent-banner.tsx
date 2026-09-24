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
  queryNetworkConsentHub,
  setNetworkConsentHub,
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
  title = "Help Us Improve Our Website with Cookies",
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

    // 1. Process any cross-domain network consent signal in the URL (?sm_consent=1|0)
    if (checkUrlConsentBridge()) {
      setVisible(false);
      return;
    }

    // 2. Only display if user hasn't already made a recorded choice locally
    if (hasConsented()) {
      setVisible(false);
      return;
    }

    // 3. Geo-Location requirement:
    // If visitor is in California/US, prior consent is not legally required (CCPA opt-out model)
    if (!forceShow && !isGeoConsentRequired(countryCode)) {
      setVisible(false);
      // Silently sync with the network hub in the background without prompting the reader
      void queryNetworkConsentHub(consentHubUrl, 1200).then((networkStatus) => {
        if (networkStatus === "accepted") {
          acceptAllCookies();
        } else if (networkStatus === "rejected") {
          rejectOptionalCookies();
        }
      });
      return;
    }

    // 4. Visitors in EU/EEA/UK (where prior opt-in is legally required):
    // First query the cross-domain network hub via hidden iframe to check if user already consented on another network paper
    let cancelled = false;
    void queryNetworkConsentHub(consentHubUrl, 1000).then((networkStatus) => {
      if (cancelled) return;
      if (networkStatus === "accepted") {
        acceptAllCookies();
        setVisible(false);
      } else if (networkStatus === "rejected") {
        rejectOptionalCookies();
        setVisible(false);
      } else {
        // No network consent found, and visitor is in GDPR jurisdiction -> show banner
        setVisible(true);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [countryCode, forceShow, consentHubUrl]);

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
    setNetworkConsentHub("accepted", consentHubUrl);
  };

  const handleReject = () => {
    const record = rejectOptionalCookies();
    setVisible(false);
    void recordConsentToCompliance(record, {
      endpoint: complianceEndpoint,
      publicationSlug,
    });
    setNetworkConsentHub("rejected", consentHubUrl);
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
