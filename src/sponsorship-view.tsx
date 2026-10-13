import React from "react";
import {
  safeSponsorUrl,
  type Creative,
  type PublicAcknowledgment,
} from "./sponsorships";

export function SponsorAcknowledgment({
  creative,
  label = "Community Partner",
  preview = false,
  acknowledgment,
}: {
  creative: Creative;
  label?: "Community Partner" | "Sponsored";
  preview?: boolean;
  acknowledgment?: PublicAcknowledgment;
}) {
  const logo = safeSponsorUrl(creative.logo_url);
  const destination = safeSponsorUrl(creative.destination_url);
  return (
    <aside
      className="sm-sponsorship"
      aria-label={`${label}: ${creative.name}`}
      data-sponsorship={preview ? undefined : acknowledgment?.campaign_id}
      data-placement-id={preview ? undefined : acknowledgment?.placement_id}
      data-publication-id={preview ? undefined : acknowledgment?.publication_id}
      data-sponsor-id={preview ? undefined : acknowledgment?.sponsor_id}
    >
      <div className="sm-sponsorship-copy">
        <p className="sm-sponsorship-label">
          {label}
          {preview ? " · Illustrative preview" : ""}
        </p>
        <p className="sm-sponsorship-name">{creative.name}</p>
        {creative.description && (
          <p className="sm-sponsorship-description">{creative.description}</p>
        )}
        {destination && (
          <a
            href={destination}
            rel="sponsored noopener noreferrer"
            referrerPolicy="no-referrer"
            data-analytics-skip="true"
          >
            {creative.link_label || "Learn more"}
            <span className="sm-sponsorship-sr"> about {creative.name}</span>
          </a>
        )}
      </div>
      {logo && (
        <img
          src={logo}
          alt={`${creative.name} logo`}
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
          className="sm-sponsorship-logo"
        />
      )}
    </aside>
  );
}
