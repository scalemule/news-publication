"use client";
import { useEffect, useId, useRef, useState, type CSSProperties } from "react";
import { listedPublications } from "./network";
import {
  decorateNetworkUrl,
  setupNetworkConsentDelegation,
  COOKIE_CONSENT_EVENT,
} from "./cookies";

export interface LocalNetworkBarProps {
  currentSlug: string;
  className?: string;
  style?: CSSProperties;
}

/**
 * Global navigation bar for the Bay Area Local News network.
 * Links across independent publication origins, transferring consent tokens automatically.
 */
export function LocalNetworkBar({ currentSlug, className = "", style }: LocalNetworkBarProps) {
  const [open, setOpen] = useState(false);
  const [, setConsentVersion] = useState(0);
  const id = useId();
  const button = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    setupNetworkConsentDelegation();
    const handleConsent = () => setConsentVersion((v) => v + 1);
    window.addEventListener(COOKIE_CONSENT_EVENT, handleConsent);
    return () => window.removeEventListener(COOKIE_CONSENT_EVENT, handleConsent);
  }, []);

  const prepareLink = (e: React.MouseEvent<HTMLAnchorElement>, pubUrl: string) => {
    e.currentTarget.href = decorateNetworkUrl(pubUrl + "/");
  };

  return (
    <nav
      className={`sm-network-bar ${className}`.trim()}
      style={style}
      aria-label="Local publication network"
      onKeyDown={(e) => {
        if (e.key === "Escape" && open) {
          setOpen(false);
          button.current?.focus();
        }
      }}
    >
      <div className="sm-network-inner">
        <span className="sm-network-label">Our local sites</span>
        <button
          className="sm-network-selector"
          ref={button}
          aria-expanded={open}
          aria-controls={id}
          onClick={() => setOpen(!open)}
          type="button"
        >
          Our local sites <span aria-hidden="true">{open ? "−" : "+"}</span>
        </button>
        <ul id={id} className={`sm-network-sites ${open ? "sm-network-expanded" : ""}`} aria-label="All local publications">
          {listedPublications.map((publication) => {
            const isCurrent = publication.slug === currentSlug;
            const targetUrl = isCurrent ? publication.url + "/" : decorateNetworkUrl(publication.url + "/");
            return (
              <li key={publication.slug}>
                <a
                  href={targetUrl}
                  aria-current={isCurrent ? "true" : undefined}
                  onMouseDown={(e) => !isCurrent && prepareLink(e, publication.url)}
                  onClick={(e) => !isCurrent && prepareLink(e, publication.url)}
                >
                  {publication.name}
                </a>
              </li>
            );
          })}
        </ul>
      </div>
    </nav>
  );
}
