import React, { type CSSProperties } from "react";
import { NETWORK_PARENT } from "./network";

export interface NetworkCopyrightNoticeProps {
  className?: string;
  style?: CSSProperties;
  publicationName?: string;
  showPublicationNotice?: boolean;
  targetBlank?: boolean;
  prefix?: string;
  showRightsReserved?: boolean;
}

/**
 * Reusable copyright and institutional network parent attribution notice for all ScaleMule news publications.
 * Links to the official Bay Area News Network institutional website.
 */
export function NetworkCopyrightNotice({
  className = "",
  style,
  publicationName,
  showPublicationNotice = false,
  targetBlank = true,
  prefix = "©",
  showRightsReserved = true,
}: NetworkCopyrightNoticeProps) {
  const currentYear = new Date().getFullYear();

  return (
    <div className={`sm-network-copyright ${className}`.trim()} style={style}>
      {showPublicationNotice && publicationName && (
        <p className="sm-network-publication-attribution">
          {publicationName} is a member publication of the{" "}
          <a
            href={NETWORK_PARENT.url}
            target={targetBlank ? "_blank" : undefined}
            rel={targetBlank ? "noopener noreferrer" : undefined}
            className="sm-network-parent-link"
          >
            {NETWORK_PARENT.name}
          </a>
          .
        </p>
      )}
      <p className="sm-network-legal">
        {prefix} {currentYear}{" "}
        <a
          href={NETWORK_PARENT.url}
          target={targetBlank ? "_blank" : undefined}
          rel={targetBlank ? "noopener noreferrer" : undefined}
          className="sm-network-parent-link"
        >
          {NETWORK_PARENT.name}
        </a>
        {showRightsReserved ? ". All rights reserved." : ""}
      </p>
    </div>
  );
}
