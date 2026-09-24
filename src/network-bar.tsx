"use client";
import { useId, useRef, useState, type CSSProperties } from "react";
import { listedPublications } from "./network";
import { decorateNetworkUrl } from "./cookies";

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
  const id = useId();
  const button = useRef<HTMLButtonElement>(null);

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
