/** Shelter listings as a paper or bayareapaw.com shows them. Server rendered;
 * the page loads the listings (see `petListings` in pets-server). */
import React from "react";
import { PawMark } from "./pets-view";
import {
  petListingDayText,
  petListingPhone,
  petListingPhoto,
  type PetListing,
} from "./pets-listings";

function possessive(name: string) {
  return /s$/i.test(name) ? `${name}’` : `${name}’s`;
}
/** Where a report was made, when the notice's address says so. */
function reportedOn(url?: string) {
  try {
    return url && /(^|\.)24petconnect\.com$/.test(new URL(url).hostname) ? " on 24PetConnect" : "";
  } catch {
    return "";
  }
}

export function PetListingCard({
  listing,
  now = new Date(),
  gateway,
}: {
  listing: PetListing;
  now?: Date;
  gateway?: string;
}) {
  const small = petListingPhoto(listing.photoId, 480, gateway);
  const large = petListingPhoto(listing.photoId, 960, gateway);
  const day = listing.day && petListingDayText(listing.day, now);
  const checked = `Checked ${petListingDayText(listing.checkedAt, now)}`;
  const shelter = listing.shelterName;
  const status =
    listing.kind === "adoption"
      ? "Looking for a home"
      : listing.custody === "shelter"
        ? "Found · at the shelter"
        : listing.custody === "finder"
          ? "Found by a neighbor"
          : "Lost";
  let line: string, action: string;
  if (listing.kind === "adoption") {
    line = `At ${shelter}. Pets are adopted every day: the shelter can say if ${listing.title} is still waiting.`;
    action = `See ${listing.title} at the shelter`;
  } else if (listing.custody === "shelter") {
    line = `${day ? `Came in ${day}. ` : ""}${shelter ? `Held at ${shelter}. ` : ""}Shelters hold strays for only a few days.`;
    action = "Open the shelter’s notice";
  } else {
    const where = listing.lastSeen ? ` near ${listing.lastSeen}` : "";
    line =
      `${listing.kind === "lost" ? "Lost" : "Found"}${day ? ` ${day}` : ""}${where}. ` +
      `Reported by ${listing.custody === "owner" ? "the pet’s owner" : "the person who found the animal"}${reportedOn(listing.url)}; not checked by us.`;
    action = "Open the notice";
  }
  return (
    <article className="paw-resource paw-listing">
      {small ? (
        <figure className="paw-photo">
          <img
            src={small}
            srcSet={`${small} 480w, ${large} 960w`}
            sizes="(max-width: 700px) 100vw, 33vw"
            alt={`${listing.title}, ${[listing.species, listing.facts].filter(Boolean).join(", ")}`}
            width={480}
            height={360}
            loading="lazy"
            decoding="async"
          />
        </figure>
      ) : (
        <div className="paw-photo-empty">
          <PawMark size={64} />
        </div>
      )}
      <div className="paw-resource-copy">
        <p className="paw-context">{[status, listing.areaName].filter(Boolean).join(" · ")}</p>
        <h3>
          {listing.url ? (
            <a href={listing.url} rel="noopener noreferrer">
              {listing.title}
            </a>
          ) : (
            listing.title
          )}
        </h3>
        <p>{[listing.species, listing.facts].filter(Boolean).join(" · ")}</p>
      </div>
      <p className="paw-source">
        {line} <small>{checked}.</small>
        {listing.url && (
          <a href={listing.url} rel="noopener noreferrer">
            {action}
          </a>
        )}
        {listing.shelterPhone && shelter && (
          <a href={`tel:${listing.shelterPhone}`}>
            Call {possessive(shelter)} line: {petListingPhone(listing.shelterPhone)}
          </a>
        )}
      </p>
    </article>
  );
}

/** One page of listings under a heading, or nothing when there are none. */
export function PetListingSection({
  listings,
  heading,
  intro,
  limit = 24,
  page = 1,
  pageHref,
  moreHref,
  moreLabel,
  now = new Date(),
  gateway,
}: {
  listings: readonly PetListing[];
  heading: string;
  intro?: string;
  limit?: number;
  page?: number;
  /** The address of another page of the same list (the browse pages). */
  pageHref?: (page: number) => string;
  /** Where the whole list is (the front of the pets section). */
  moreHref?: string;
  moreLabel?: string;
  now?: Date;
  gateway?: string;
}) {
  if (!listings.length) return null;
  const pages = Math.ceil(listings.length / limit);
  const current = Math.min(Math.max(1, Math.trunc(page) || 1), pages);
  const shown = listings.slice((current - 1) * limit, current * limit);
  return (
    <div className="paw-listings">
      <div className="paw-section-heading">
        <h2>{heading}</h2>
        {intro && <p>{intro}</p>}
      </div>
      <div className="paw-gallery">
        {shown.map((listing) => (
          <PetListingCard key={listing.id} listing={listing} now={now} gateway={gateway} />
        ))}
      </div>
      {pageHref && pages > 1 && (
        <nav className="paw-listing-pages" aria-label={`${heading}: pages`}>
          {current > 1 && (
            <a className="paw-button" href={pageHref(current - 1)} rel="prev">
              Previous
            </a>
          )}
          <span>
            Page {current} of {pages}
          </span>
          {current < pages && (
            <a className="paw-button" href={pageHref(current + 1)} rel="next">
              Next
            </a>
          )}
        </nav>
      )}
      {moreHref && listings.length > shown.length && (
        <a href={moreHref}>{moreLabel || `See all ${listings.length}`}</a>
      )}
    </div>
  );
}

export const PET_LISTING_TEXT = {
  lost_found: {
    heading: "At the shelters, and reported nearby",
    intro:
      "Animals that Bay Area shelters are holding for their owners, and pets reported lost or found. If you recognize one, open its notice or call the shelter today.",
  },
  adoption: {
    heading: "Waiting at Bay Area shelters",
    intro: "Each pet links to its own page at the shelter, where you can ask about meeting them.",
  },
} as const;
