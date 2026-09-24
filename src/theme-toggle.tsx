"use client";

import React, { useEffect, useState, useSyncExternalStore } from "react";
import {
  getStoredTheme,
  setTheme,
  subscribeTheme,
  type ThemeMode,
} from "./theme";

export interface ThemeToggleProps {
  /**
   * "compact": Micro-pill with icons only (ideal for header utility bar).
   * "inline": Broadsheet rectangular tabs with text and icons (ideal for article reading tools).
   * "segmented": Pill with icons and labels (ideal for account, settings, or footer).
   */
  variant?: "compact" | "inline" | "segmented";
  /** Optional extra class name applied to container */
  className?: string;
  /**
   * When true, displays a subtle, tasteful message when the user changes the theme:
   * "Theme saved on this browser. Create a free reader account to sync across devices."
   */
  showPromotion?: boolean;
  /** Link for reader account / sync. Default: "/account" */
  accountUrl?: string;
}

function SunIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
    </svg>
  );
}

function SystemIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect width="20" height="14" x="2" y="3" rx="2" />
      <line x1="8" x2="16" y1="21" y2="21" />
      <line x1="12" x2="12" y1="17" y2="21" />
    </svg>
  );
}

export function ThemeToggle({
  variant = "compact",
  className = "",
  showPromotion = false,
  accountUrl = "/account",
}: ThemeToggleProps) {
  const currentTheme = useSyncExternalStore(subscribeTheme, getStoredTheme, () => "system");
  const [mounted, setMounted] = useState(false);
  const [promoVisible, setPromoVisible] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleSelect = (mode: ThemeMode) => {
    setTheme(mode);
    if (showPromotion) {
      setPromoVisible(true);
    }
  };

  const active = mounted ? currentTheme : "system";

  return (
    <div className={`pub-theme-toggle-container ${className}`.trim()}>
      <div
        className="pub-theme-toggle"
        data-variant={variant}
        role="group"
        aria-label="Display theme selection"
      >
        <button
          type="button"
          onClick={() => handleSelect("light")}
          aria-pressed={active === "light"}
          data-active={active === "light"}
          title="Light theme (broadsheet day edition)"
          aria-label="Light theme"
        >
          <SunIcon />
          {variant !== "compact" && <span>Light</span>}
        </button>

        <button
          type="button"
          onClick={() => handleSelect("dark")}
          aria-pressed={active === "dark"}
          data-active={active === "dark"}
          title="Dark theme (broadsheet evening edition)"
          aria-label="Dark theme"
        >
          <MoonIcon />
          {variant !== "compact" && <span>Dark</span>}
        </button>

        <button
          type="button"
          onClick={() => handleSelect("system")}
          aria-pressed={active === "system"}
          data-active={active === "system"}
          title="System preference (matches device setting)"
          aria-label="System theme"
        >
          <SystemIcon />
          {variant !== "compact" && <span>System</span>}
        </button>
      </div>

      {promoVisible && (
        <div className="pub-theme-promo" role="status">
          <span>Theme saved for this browser. </span>
          <a href={accountUrl}>Create a free reader account</a>
          <span> to sync preferences across all your devices.</span>
          <button
            type="button"
            onClick={() => setPromoVisible(false)}
            aria-label="Dismiss note"
            style={{
              marginLeft: "8px",
              background: "none",
              border: "none",
              cursor: "pointer",
              color: "var(--pub-muted)",
              fontSize: "12px",
              padding: "0 4px",
            }}
          >
            ×
          </button>
        </div>
      )}
    </div>
  );
}
