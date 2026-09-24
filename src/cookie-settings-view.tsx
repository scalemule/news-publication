"use client";

import React, { useEffect, useState } from "react";
import {
  COOKIE_CATEGORIES,
  DEFAULT_PREFERENCES_ACCEPTED,
  DEFAULT_PREFERENCES_REJECTED,
  getCookieConsent,
  setCookieConsent,
  recordConsentToCompliance,
  type CookieCategory,
  type CookiePreferences,
} from "./cookies";

export interface CookieSettingsViewProps {
  /** The publication display name (e.g., "San Ramon Times") */
  publicationName?: string;
  /** Publication region / coverage context (e.g., "San Ramon Valley, California") */
  region?: string;
  /** Compliance endpoint for recording consent. Default: "/api/compliance/consent" */
  complianceEndpoint?: string;
  /** Optional publication slug for metadata */
  publicationSlug?: string;
}

export function CookieSettingsView({
  publicationName = "This Publication",
  region,
  complianceEndpoint = "/api/compliance/consent",
  publicationSlug,
}: CookieSettingsViewProps) {
  const [preferences, setPreferences] = useState<CookiePreferences>(() => {
    const existing = getCookieConsent();
    return existing ? existing.preferences : { ...DEFAULT_PREFERENCES_ACCEPTED };
  });

  const [expandedCategories, setExpandedCategories] = useState<Record<CookieCategory, boolean>>({
    essential: false,
    performance: false,
    functional: false,
    advertising: false,
  });

  const [saveSuccess, setSaveSuccess] = useState(false);
  const [lastSavedTime, setLastSavedTime] = useState<string | null>(null);

  useEffect(() => {
    const existing = getCookieConsent();
    if (existing) {
      setPreferences(existing.preferences);
      setLastSavedTime(new Date(existing.timestamp).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }));
    }
  }, []);

  const handleToggle = (category: CookieCategory) => {
    if (category === "essential") return; // cannot be changed
    setPreferences(prev => ({
      ...prev,
      [category]: !prev[category],
    }));
    setSaveSuccess(false);
  };

  const toggleExpand = (category: CookieCategory) => {
    setExpandedCategories(prev => ({
      ...prev,
      [category]: !prev[category],
    }));
  };

  const handleSave = () => {
    const record = setCookieConsent(preferences, "settings_save");
    setSaveSuccess(true);
    setLastSavedTime(new Date(record.timestamp).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }));
    void recordConsentToCompliance(record, {
      endpoint: complianceEndpoint,
      publicationSlug,
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleAcceptAll = () => {
    setPreferences({ ...DEFAULT_PREFERENCES_ACCEPTED });
    const record = setCookieConsent(DEFAULT_PREFERENCES_ACCEPTED, "settings_save");
    setSaveSuccess(true);
    setLastSavedTime(new Date(record.timestamp).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }));
    void recordConsentToCompliance(record, {
      endpoint: complianceEndpoint,
      publicationSlug,
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleRejectAll = () => {
    setPreferences({ ...DEFAULT_PREFERENCES_REJECTED });
    const record = setCookieConsent(DEFAULT_PREFERENCES_REJECTED, "settings_save");
    setSaveSuccess(true);
    setLastSavedTime(new Date(record.timestamp).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }));
    void recordConsentToCompliance(record, {
      endpoint: complianceEndpoint,
      publicationSlug,
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <div className="sm-cookie-settings-container">
      <header className="sm-cookie-settings-header">
        <div className="sm-cookie-settings-eyebrow">{publicationName} · Legal & Privacy</div>
        <h1 className="sm-cookie-settings-title">Cookie Settings & Privacy Controls</h1>
        <p className="sm-cookie-settings-intro">
          We believe in transparent, neighborly community journalism. When you visit {publicationName}
          {region ? ` across ${region}` : ""}, we use cookies and process device data to ensure the website is
          secure, reliable, and easy to read. Review our cookie categories below, view detailed technical
          disclosures, and choose your preferences at any time.
        </p>
      </header>

      {saveSuccess && (
        <div className="sm-cookie-alert-success" role="status" aria-live="polite">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
            <path
              d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.707l-4.5 4.5a1 1 0 01-1.414 0l-2-2a1 1 0 011.414-1.414L8.5 10.586l3.793-3.793a1 1 0 011.414 1.414z"
              fill="currentColor"
            />
          </svg>
          <div>
            <strong>Preferences Saved.</strong> Your cookie choices have been updated
            {lastSavedTime ? ` (at ${lastSavedTime})` : ""} and will be remembered across all community editions.
          </div>
        </div>
      )}

      <div className="sm-cookie-global-actions">
        <button
          type="button"
          className="sm-cookie-btn sm-cookie-btn-secondary"
          onClick={handleRejectAll}
        >
          Reject Optional Cookies
        </button>
        <button
          type="button"
          className="sm-cookie-btn sm-cookie-btn-secondary"
          onClick={handleAcceptAll}
        >
          Accept All Cookies
        </button>
        <button
          type="button"
          className="sm-cookie-btn sm-cookie-btn-primary"
          onClick={handleSave}
        >
          Save Preferences
        </button>
      </div>

      <div className="sm-cookie-category-list">
        {COOKIE_CATEGORIES.map(category => {
          const isEssential = category.id === "essential";
          const isChecked = isEssential || preferences[category.id];
          const isExpanded = expandedCategories[category.id];

          return (
            <section
              key={category.id}
              className="sm-cookie-category-card"
              aria-labelledby={`cookie-cat-${category.id}`}
            >
              <div className="sm-cookie-category-top">
                <h2 id={`cookie-cat-${category.id}`} className="sm-cookie-category-heading">
                  {category.title}
                </h2>
                {isEssential ? (
                  <span className="sm-cookie-badge-required">Always Active</span>
                ) : (
                  <label
                    className="sm-cookie-switch-label"
                    htmlFor={`toggle-${category.id}`}
                    aria-label={`Toggle ${category.title}`}
                  >
                    <input
                      id={`toggle-${category.id}`}
                      type="checkbox"
                      className="sm-cookie-switch-input"
                      checked={isChecked}
                      onChange={() => handleToggle(category.id)}
                    />
                    <span className="sm-cookie-switch-slider" />
                  </label>
                )}
              </div>

              <p className="sm-cookie-category-desc">{category.fullDescription}</p>

              <div>
                <button
                  type="button"
                  className="sm-cookie-details-toggle"
                  onClick={() => toggleExpand(category.id)}
                  aria-expanded={isExpanded}
                >
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                    style={{
                      transform: isExpanded ? "rotate(90deg)" : "rotate(0deg)",
                      transition: "transform 0.2s ease",
                    }}
                    aria-hidden="true"
                  >
                    <path
                      fillRule="evenodd"
                      d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"
                      clipRule="evenodd"
                    />
                  </svg>
                  {isExpanded ? "Hide cookie disclosures" : `View ${category.cookies.length} cookie disclosures`}
                </button>

                {isExpanded && (
                  <div className="sm-cookie-table-wrapper">
                    <table className="sm-cookie-table">
                      <thead>
                        <tr>
                          <th>Cookie Name</th>
                          <th>Provider</th>
                          <th>Duration</th>
                          <th>Storage Type</th>
                          <th>Purpose</th>
                        </tr>
                      </thead>
                      <tbody>
                        {category.cookies.map(cookie => (
                          <tr key={cookie.name}>
                            <td>
                              <code className="sm-cookie-code">{cookie.name}</code>
                            </td>
                            <td>{cookie.provider}</td>
                            <td>{cookie.duration}</td>
                            <td>{cookie.type}</td>
                            <td>{cookie.purpose}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </section>
          );
        })}
      </div>

      <div className="sm-cookie-save-bar">
        <div className="sm-cookie-save-status">
          {lastSavedTime ? `Last saved: today at ${lastSavedTime}` : "No custom preferences saved yet."}
        </div>
        <div className="sm-cookie-save-buttons">
          <button
            type="button"
            className="sm-cookie-btn sm-cookie-btn-secondary"
            onClick={handleRejectAll}
          >
            Reject Optional
          </button>
          <button
            type="button"
            className="sm-cookie-btn sm-cookie-btn-secondary"
            onClick={handleAcceptAll}
          >
            Accept All
          </button>
          <button
            type="button"
            className="sm-cookie-btn sm-cookie-btn-primary"
            onClick={handleSave}
          >
            Save Preferences
          </button>
        </div>
      </div>
    </div>
  );
}
