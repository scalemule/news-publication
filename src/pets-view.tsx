import React from "react";
import { PawBayIllustration } from "./pets-art";
import {
  adoptionAvailability,
  PET_SAFETY,
  safePetLink,
  type PetCommunity,
  type PetResource,
} from "./pets";
import { type PublicAcknowledgment } from "./sponsorships";
import { SponsorAcknowledgment as ExistingSponsorAcknowledgment } from "./sponsorship-view";

/** Publisher-supplied Bay Area Paw mark; paths preserved from logo icon v1. */
export function PawMark({ size = 40 }: { size?: number }) {
  return (
    <svg
      className="paw-mark"
      width={size}
      height={size}
      viewBox="0 0 573.94 529"
      aria-hidden="true"
      focusable="false"
    >
      <path
        fill="var(--paw-logo-ink, #12314e)"
        d="M438.14,116.61c-13.43,29.67-37.83,43.23-70.22,41.59-26.22-1.33-47.57-18.07-53.85-44.04-8.61-35.6,4.38-73.47,32.54-97.01,23.86-19.95,59.01-24.71,80.86-2.33,25.28,25.88,24.83,70.53,10.67,101.8Z"
      />
      <path
        fill="var(--paw-logo-ink, #12314e)"
        d="M261.38,102.84c-3.42,34.87-26.95,55.34-62.34,55.6-47.55.35-70.66-41.61-72.41-84-.76-18.36,2.81-36.21,13.1-51.28C150.96,6.71,169.05-1.66,189.1.47c15.88,1.68,30.04,9.02,41.83,20.13,22.37,21.08,33.45,51.63,30.44,82.24Z"
      />
      <path
        fill="var(--paw-logo-ink, #12314e)"
        d="M74.37,233.2c-19.12,5.92-38.02,1.03-52.01-12.56C5.9,204.65-2.02,181.66.44,158.79s20.8-41.47,44.56-43.32c26.77-2.08,52.81,11.67,64.67,35.72,6.55,13.29,8.8,27.71,4.77,41.93-5.48,19.31-20.59,34.04-40.07,40.07Z"
      />
      <path
        fill="var(--paw-logo-ink, #12314e)"
        d="M554.12,217.92c-16.28,18.05-40.96,22.44-62.24,12.42-28.24-13.29-41.83-43.6-30.18-73.55,11.84-30.44,45.43-47.9,77.46-39.5,16.05,4.2,27.59,16.88,32.19,32.77,6.91,23.87-.39,49.18-17.23,67.85Z"
      />
      <path
        fill="var(--paw-logo-ink, #12314e)"
        d="M254.75,276.06c-11.16,1.17-18.16-5.23-31.29,5.65-2.03,1.68-3.74,3.55-6.45,4.65.19-7.18,3.13-13.83,8.89-18.06,9.64-7.09,24.35-3.41,28.86,7.76Z"
      />
      <path
        fill="var(--paw-logo-ink, #12314e)"
        d="M393.76,388.44c14.25.78,43.73,21.57,44.48,36.86-13.73-13.65-28.07-25.42-44.48-36.86Z"
      />
      <path
        fill="var(--paw-logo-ink, #12314e)"
        d="M389.2,362.82c-13.07-10.75-14.56-12.34-32.27-9.64,2.18-7.74,11.87-11.56,19.39-9.51,7.9,2.16,14.35,10.44,12.88,19.15Z"
      />
      <path
        fill="var(--paw-logo-ink, #12314e)"
        d="M395.67,379.62c12.45-2.44,45.72,6.18,48.71,20.68-15.95-9.19-31.31-15.01-48.71-20.68Z"
      />
      <path
        fill="var(--paw-logo-ink, #12314e)"
        d="M225.21,368.12c8.14-14.26,21.23-23.67,36.61-26.8l24.13-4.91c24.77-5.03,49.74-30.01,43.64-57.5-1.23-5.52-5.96-8.44-11.59-8.97-10.59-1.01-21.06-1.48-31.46-3.17-10.47-1.7-17.76-7.16-22.72-16.52-13.11-24.7-34.21-38.21-62.98-35.89-32.35,2.61-60.19,20.02-78.69,46.19-8.86,12.53-17.29,24.45-24.06,38.06-9.19,18.49,6.19,33.68,20.29,44.38,11.81,8.96,15.39,17.42,23.42,14.26,17.13-6.74,23.74-36.34,24.85-52.55l1.91-27.97c.45-6.63,1.48-12.94,5.66-18.84,10.07,43.41,17.92,81.63-15.36,116.38-18.45,19.26-30.63,43.84-21.53,70.61,1.81,5.31,4.18,9.89,5.44,15.71-49.05-41.25-82.59-100.28-68.34-165.81,2.75-12.63,7.16-23.65,13.2-34.96,14.89-27.92,36.14-51.76,63.26-68.22,29.85-18.12,65.65-21.17,97.88-7.93,14.6,6,26.59,15.11,38.32,26.09,7.66-6.63,14.7-12.8,23.27-18.11,27.44-17,60.05-20.76,90.86-10.43,18.28,6.12,34.08,16.52,48,29.84,32.73,31.32,55.61,73.73,53.14,120.37-1.9,35.78-15.78,69.68-39.3,97.5,2.83-33.15-1.57-57.13-20.69-83.05-1.39-19.67-2.57-38.89-16.51-55.64-10.36,9-17.24,20.04-25.23,30.79-17.93-6.9-37.08-3.27-49.82,11.18-15.8,17.9-32.66-7.14-33.3,15.72-4.67,5.19-8.68,9.51-9.33,16.8-1.08,12.18,3.59,23.69,13.76,30.79l12.21,8.52c12.5,8.72,16.99,23.63,13.91,38.67-2.35,11.43-8.1,21.24-15.29,30.53-8.3,10.65-17.82,19.82-28.28,28.44-10.27,8.46-18.67,17.43-28.71,27.3,6.77-55.37-37.54-71.57-53.11-115.32-5.31-14.91-5.64-31.2,2.56-45.56ZM310.95,414.5c.66-6.02-.23-11.99-4.42-16.09-3.63-3.56-9.46-5.66-15.26-4.62-7.74,1.39-13.23,6.73-18.29,13.26-7.08-12.24-20.28-17.67-30.59-9.89-4.5,3.4-6.97,9.12-6.98,15.36-.05,19.1,21.83,36.81,35.58,48.75,14.15-12.18,36.74-27.53,39.96-46.76Z"
      />
      <path
        fill="var(--paw-logo-heart, #ef7152)"
        d="M310.95,414.5c-3.22,19.23-25.81,34.58-39.96,46.76-13.75-11.93-35.63-29.65-35.58-48.75.02-6.24,2.48-11.96,6.98-15.36,10.31-7.78,23.51-2.35,30.59,9.89,5.06-6.53,10.54-11.86,18.29-13.26,5.8-1.04,11.63,1.06,15.26,4.62,4.19,4.1,5.08,10.07,4.42,16.09Z"
      />
    </svg>
  );
}
/** Original vector artwork, not a photograph or a submitted community pet. */
export function PawNeighborhoodIllustration() {
  return <PawBayIllustration />;
}

type ResourceProps = {
  resource: PetResource;
  community: string;
  href: string;
  mediaUrl: (resource: string, media: string) => string;
};
function Photo({
  resource,
  mediaUrl,
  large = false,
}: Pick<ResourceProps, "resource" | "mediaUrl"> & { large?: boolean }) {
  const photo = resource.media.find((m) => m.status === "PUBLISHED");
  const src = photo && safePetLink(mediaUrl(resource.id, photo.id));
  if (!src)
    return (
      <div className="paw-photo-empty">
        <PawMark size={64} />
        <span>A story from your community</span>
      </div>
    );
  const separator = src.includes("?") ? "&" : "?";
  return (
    <figure className="paw-photo">
      <picture>
        <source
          type="image/webp"
          srcSet={`${src}${separator}width=640&format=webp 640w, ${src}${separator}width=1280&format=webp 1280w`}
          sizes={
            large
              ? "(max-width: 700px) 100vw, 65vw"
              : "(max-width: 700px) 100vw, 33vw"
          }
        />
        <img
          src={`${src}${separator}width=1280&format=jpeg`}
          srcSet={`${src}${separator}width=640&format=jpeg 640w, ${src}${separator}width=1280&format=jpeg 1280w`}
          sizes={
            large
              ? "(max-width: 700px) 100vw, 65vw"
              : "(max-width: 700px) 100vw, 33vw"
          }
          alt={photo.caption || resource.content.name}
          width={large ? 1200 : 640}
          height={large ? 900 : 480}
          loading={large ? "eager" : "lazy"}
        />
      </picture>
      {photo.attribution && (
        <figcaption>Photograph: {photo.attribution}</figcaption>
      )}
    </figure>
  );
}
function ResourceCard(
  props: ResourceProps & { label: string; memorial?: boolean },
) {
  const href = safePetLink(props.href);
  return (
    <article className={`paw-resource${props.memorial ? " paw-memorial" : ""}`}>
      <Photo {...props} />
      <div className="paw-resource-copy">
        <p className="paw-context">
          {props.label} · {props.community}
        </p>
        <h3>
          {href ? (
            <a href={href}>{props.resource.content.name}</a>
          ) : (
            props.resource.content.name
          )}
        </h3>
        <p>{props.resource.content.story}</p>
        {props.resource.content.attribution && (
          <p className="paw-credit">
            Shared by {props.resource.content.attribution}
          </p>
        )}
      </div>
    </article>
  );
}
export function PetProfileCard(props: ResourceProps) {
  return <ResourceCard {...props} label="Meet a neighbor" />;
}
export function PetCelebrationCard(props: ResourceProps) {
  return (
    <ResourceCard
      {...props}
      memorial={props.resource.content.category === "memorial"}
      label={
        props.resource.content.category === "memorial"
          ? "In loving memory"
          : "A little joy worth sharing"
      }
    />
  );
}
export function LostPetNotice(props: ResourceProps) {
  return (
    <div className="paw-notice">
      <ResourceCard
        {...props}
        label={
          props.resource.reunited_at
            ? "Reported reunited"
            : props.resource.kind === "found"
              ? "Found pet"
              : "Lost pet"
        }
      />
      <p className="paw-safety">{PET_SAFETY.recovery}</p>
    </div>
  );
}
export function AdoptionListingCard(props: ResourceProps) {
  const source = props.resource.content.source;
  const url = source && safePetLink(source.official_url);
  return (
    <div>
      <ResourceCard {...props} label="Adoption discovery" />
      {source && (
        <p className="paw-source">
          {adoptionAvailability(source) === "confirmed"
            ? "Availability recently confirmed."
            : "Check current availability with the organization."}{" "}
          {url && (
            <a href={url} rel="noopener noreferrer">
              Visit {source.organization}
            </a>
          )}
          {source.verified_at && (
            <small>
              Source checked{" "}
              {new Date(source.verified_at).toLocaleDateString("en-US", {
                timeZone: "America/Los_Angeles",
              })}
            </small>
          )}
        </p>
      )}
    </div>
  );
}
export function PetEventCard(props: ResourceProps) {
  const event = props.resource.content.event,
    source = props.resource.content.source;
  return (
    <div>
      <ResourceCard {...props} label="Pet community event" />
      {event && (
        <p className="paw-source">
          <time dateTime={event.starts_at}>
            {new Date(event.starts_at).toLocaleString("en-US", {
              timeZone: "America/Los_Angeles",
              dateStyle: "medium",
              timeStyle: "short",
            })}
          </time>{" "}
          · Pacific time
          <br />
          {event.cost_verified && event.cost === "free"
            ? "Verified free event"
            : event.cost_verified && event.cost === "paid"
              ? "Paid event — check official pricing"
              : "Check the official organization for cost"}
        </p>
      )}
      {source && (
        <p>
          <a href={safePetLink(source.official_url)} rel="noopener noreferrer">
            Official details from {source.organization}
          </a>
        </p>
      )}
    </div>
  );
}
export function PawOfTheWeekCard(
  props: ResourceProps & { pageHeading?: boolean },
) {
  const href = safePetLink(props.href);
  const Heading = props.pageHeading ? "h1" : "h2";
  return (
    <article className="paw-spotlight">
      <Photo {...props} large />
      <div className="paw-spotlight-copy">
        <p className="paw-context">{props.community}’s Paw of the Week</p>
        <Heading>Meet {props.resource.content.name}.</Heading>
        <p>{props.resource.content.story}</p>
        {href && (
          <a className="paw-button" href={href}>
            Read the story
          </a>
        )}
        <p className="paw-credit">
          Chosen by our editors. Always free to submit.
        </p>
      </div>
    </article>
  );
}
/** Uses a resolved Community Maps feature; supported facts remain in the directory. */
export function PetFriendlyPlaceCard({
  name,
  description,
  href,
  verified,
  verifiedAt,
}: {
  name: string;
  description: string;
  href: string;
  verified: boolean;
  verifiedAt?: string;
}) {
  const url = safePetLink(href);
  return (
    <article className="paw-place">
      <p className="paw-context">
        {verified
          ? "Verified directory information"
          : "Community suggestion — not verified"}
      </p>
      <h3>{url ? <a href={url}>{name}</a> : name}</h3>
      <p>{description}</p>
      {verifiedAt && <small>Last checked {verifiedAt}</small>}
    </article>
  );
}
/** The caller must supply the existing sponsorship service's public projection. */
export function SponsorAcknowledgment({
  acknowledgment,
  now = Date.now(),
}: {
  acknowledgment: PublicAcknowledgment;
  now?: number;
}) {
  const start = Date.parse(acknowledgment.starts_at),
    end = Date.parse(acknowledgment.ends_at);
  if (!(start <= now && now < end)) return null;
  return (
    <div className="paw-sponsor">
      <ExistingSponsorAcknowledgment
        creative={acknowledgment.creative}
        acknowledgment={acknowledgment}
        label="Sponsored"
      />
      <small>
        Paid community sponsorship. Sponsorship does not influence editorial
        selections and is not an endorsement.
      </small>
    </div>
  );
}
export type PetsSectionProps = {
  name?: string;
  tagline?: string;
  community?: PetCommunity;
  communities: PetCommunity[];
  resources: PetResource[];
  spotlight?: PetResource;
  acknowledgments?: PublicAcknowledgment[];
  basePath?: string;
  mediaUrl: ResourceProps["mediaUrl"];
  contributeUrl?: string;
  placesUrl?: string;
  walksUrl?: string;
  nextUrl?: string;
  unavailable?: boolean;
  regionLabel?: string;
  resourceBasePath?: string;
  browseBasePath?: string;
  eventsUrl?: string;
  accountUrl?: string;
};
export function PetsSection({
  name = "Bay Area Paw",
  tagline = "Happier pets. Closer communities.",
  community,
  communities,
  resources,
  spotlight,
  acknowledgments = [],
  basePath = "/pets",
  mediaUrl,
  contributeUrl,
  placesUrl,
  walksUrl,
  nextUrl,
  unavailable,
  regionLabel,
  resourceBasePath,
  browseBasePath = "/browse",
  eventsUrl,
  accountUrl,
}: PetsSectionProps) {
  const location = community?.name || regionLabel || "the Bay Area";
  const link = (id: string) =>
    `${resourceBasePath || basePath}/${encodeURIComponent(id)}`;
  const local = (id: string) =>
    communities.find((c) => c.id === id)?.name || "Our community";
  const communityQuery = community
    ? "?community=" + encodeURIComponent(community.slug)
    : "";
  const photoBoard = resources.filter(
    (r) => r.kind === "photo" || r.kind === "profile",
  );
  const celebrations = resources.filter((r) => r.kind === "celebration");
  const notices = resources.filter((r) => ["lost", "found"].includes(r.kind));
  const adoptions = resources.filter((r) => r.kind === "adoption");
  return (
    <div className="paw paw-home">
      <header className="paw-masthead">
        <a href={basePath || "/"} className="paw-brand">
          <PawMark />
          <span>{name}</span>
        </a>
        <p>{tagline}</p>
        {accountUrl && <a href={safePetLink(accountUrl)}>My pets</a>}
        {contributeUrl && (
          <a className="paw-button" href={safePetLink(contributeUrl)}>
            Share your pet
          </a>
        )}
      </header>
      <details className="paw-mobile-nav">
        <summary>
          Explore Bay Area Paw <span aria-hidden="true">＋</span>
        </summary>
        <nav aria-label="Mobile pet community">
          <a href="#neighbors">Our pets</a>
          <a href="#lost-found">Lost &amp; found</a>
          {walksUrl && <a href={safePetLink(walksUrl)}>Paw Walks</a>}
          {placesUrl && <a href={safePetLink(placesUrl)}>Paw Places</a>}
          <a href="#adoption">Adoption</a>
          <a href="#celebrations">Celebrations</a>
          {eventsUrl && <a href={safePetLink(eventsUrl)}>Events</a>}
        </nav>
      </details>
      <nav className="paw-nav" aria-label="Pet community">
        <a href="#neighbors">Our pets</a>
        <a href="#lost-found">Lost & found</a>
        {walksUrl && <a href={safePetLink(walksUrl)}>Paw Walks</a>}
        {placesUrl && <a href={safePetLink(placesUrl)}>Paw Places</a>}
        <a href="#adoption">Adoption</a>
        <a href="#celebrations">Celebrations</a>
        {eventsUrl && <a href={safePetLink(eventsUrl)}>Events</a>}
      </nav>
      <div className="paw-community">
        <p>
          <span className="paw-location-dot" aria-hidden="true" /> Your pet
          community in {location}.
        </p>
        <form action={basePath || "/"} method="get">
          <label htmlFor="paw-community">Your community</label>
          <select
            id="paw-community"
            name="community"
            defaultValue={community?.slug || ""}
          >
            <option value="">All communities</option>
            {communities.map((c) => (
              <option key={c.id} value={c.slug}>
                {c.name}
              </option>
            ))}
          </select>
          <button type="submit">Explore</button>
        </form>
      </div>
      {unavailable ? (
        <div role="status" className="paw-empty">
          <h1>Your community is on its way.</h1>
          <p>
            We can’t load the pet community right now. Please try again shortly.
          </p>
        </div>
      ) : spotlight ? (
        <section id="paw-week" aria-label="Paw of the Week">
          <PawOfTheWeekCard
            pageHeading
            resource={spotlight}
            community={local(spotlight.area_id)}
            href={link(spotlight.id)}
            mediaUrl={mediaUrl}
          />
        </section>
      ) : (
        <section className="paw-welcome" aria-labelledby="paw-welcome-title">
          <div className="paw-welcome-copy">
            <h1 id="paw-welcome-title">
              Life’s better
              <br />
              together.
            </h1>
            <p>
              For the love of pets.
              <br />
              For the places we call home.
            </p>
            <p className="paw-welcome-detail">
              Share their story, find your next favorite walk, and make a little
              more room for community.
            </p>
            <div className="paw-hero-actions">
              {contributeUrl && (
                <a className="paw-button" href={safePetLink(contributeUrl)}>
                  Share your pet
                </a>
              )}
              <a className="paw-text-link" href="#paw-week">
                Meet Paw of the Week
              </a>
            </div>
          </div>
          <figure className="paw-cover-photo">
            <div
              role="img"
              aria-label="A white Labrador retriever resting on a sunlit lawn"
            />
            <figcaption>Cover photograph by Boyko Mihaylov</figcaption>
          </figure>
        </section>
      )}
      {!unavailable && (
        <nav className="paw-shortcuts" aria-label="Useful pet resources">
          <a
            href={safePetLink(browseBasePath + "/lost_found" + communityQuery)}
          >
            <span>Lost a pet?</span>
            <strong>Let’s help them home</strong>
            <span aria-hidden="true">↗</span>
          </a>
          {walksUrl && (
            <a href={safePetLink(walksUrl)}>
              <span>A little fresh air</span>
              <strong>Find a Paw Walk</strong>
              <span aria-hidden="true">↗</span>
            </a>
          )}
          {placesUrl && (
            <a href={safePetLink(placesUrl)}>
              <span>Out with your companion</span>
              <strong>Explore Paw Places</strong>
              <span aria-hidden="true">↗</span>
            </a>
          )}
        </nav>
      )}
      {!unavailable && !spotlight && (
        <section
          className="paw-week-invitation"
          id="paw-week"
          aria-labelledby="paw-week-title"
        >
          <div className="paw-week-cover" aria-hidden="true">
            <PawMark size={100} />
            <span>
              A very
              <br />
              good week.
            </span>
            <small>
              A little local recognition.
              <br />A whole lot of love.
            </small>
          </div>
          <div>
            <p className="paw-context">Paw of the Week</p>
            <h2 id="paw-week-title">
              Big personality.
              <br />
              Local legend.
            </h2>
            <p>
              The couch companion. The trail buddy. The tiny character with a
              very big personality. We’d love to meet yours.
            </p>
            {contributeUrl && (
              <a className="paw-button" href={safePetLink(contributeUrl)}>
                Introduce your pet
              </a>
            )}
            <small>Always free. Selected with care by local editors.</small>
          </div>
        </section>
      )}
      {!unavailable && (
        <>
          <section id="neighbors" className="paw-section">
            <div className="paw-section-heading">
              <h2>Friends around the corner</h2>
              <p>Small moments. Very good company.</p>
            </div>
            {photoBoard.length ? (
              <div className="paw-gallery">
                {photoBoard.map((r) => (
                  <PetProfileCard
                    key={r.id}
                    resource={r}
                    community={local(r.area_id)}
                    href={link(r.id)}
                    mediaUrl={mediaUrl}
                  />
                ))}
              </div>
            ) : (
              <div className="paw-board-invitation">
                <PawMark size={56} />
                <div>
                  <h3>There’s a place for your pet here.</h3>
                  <p>
                    The photo board is ready for its first neighbors. A favorite
                    photograph, a few words, and a new familiar face.
                  </p>
                </div>
                {contributeUrl && (
                  <a
                    className="paw-text-link"
                    href={safePetLink(contributeUrl)}
                  >
                    Share a photograph
                  </a>
                )}
              </div>
            )}
            <a
              href={safePetLink(browseBasePath + "/neighbors" + communityQuery)}
            >
              Browse all community pets
            </a>
          </section>
          <section id="lost-found" className="paw-section paw-recovery">
            <div className="paw-section-heading">
              <h2>Let’s help them get home.</h2>
              <p>Lost & found is always free.</p>
            </div>
            {notices.length ? (
              <div className="paw-gallery">
                {notices.map((r) => (
                  <LostPetNotice
                    key={r.id}
                    resource={r}
                    community={local(r.area_id)}
                    href={link(r.id)}
                    mediaUrl={mediaUrl}
                  />
                ))}
              </div>
            ) : (
              <p>No current, reviewed notices in this community.</p>
            )}
            <p className="paw-safety">{PET_SAFETY.recovery}</p>
            <a
              href={safePetLink(
                browseBasePath + "/lost_found" + communityQuery,
              )}
            >
              Open the lost &amp; found board
            </a>
          </section>
          <div className="paw-discover-pair">
            <section id="celebrations" className="paw-section">
              <div className="paw-section-heading">
                <h2>A life full of little milestones</h2>
                <p>
                  Birthdays, adoption days, new beginnings and fond memories.
                </p>
              </div>
              {celebrations.length ? (
                <div className="paw-gallery">
                  {celebrations.map((r) => (
                    <PetCelebrationCard
                      key={r.id}
                      resource={r}
                      community={local(r.area_id)}
                      href={link(r.id)}
                      mediaUrl={mediaUrl}
                    />
                  ))}
                </div>
              ) : (
                <p className="paw-empty">
                  Celebrate someone who makes your days brighter. Every story is
                  reviewed with care.
                </p>
              )}
              <a
                href={safePetLink(
                  browseBasePath + "/celebration" + communityQuery,
                )}
              >
                More pet celebrations
              </a>
            </section>
            <section id="adoption" className="paw-section">
              <div className="paw-section-heading">
                <h2>A new chapter starts with hello.</h2>
                <p>
                  Discover animals through local shelters and rescue
                  organizations.
                </p>
              </div>
              {adoptions.length ? (
                <div className="paw-gallery">
                  {adoptions.map((r) => (
                    <AdoptionListingCard
                      key={r.id}
                      resource={r}
                      community={local(r.area_id)}
                      href={link(r.id)}
                      mediaUrl={mediaUrl}
                    />
                  ))}
                </div>
              ) : (
                <p className="paw-empty">
                  Our editors are gathering official shelter and rescue
                  listings. Check directly with your local organization for
                  current availability.
                </p>
              )}
              <p className="paw-safety">{PET_SAFETY.adoption}</p>
              <a
                href={safePetLink(
                  browseBasePath + "/adoption" + communityQuery,
                )}
              >
                Explore adoption listings
              </a>
            </section>
          </div>
          {nextUrl && (
            <a className="paw-button" href={safePetLink(nextUrl)}>
              More community pets
            </a>
          )}
        </>
      )}
      {acknowledgments.length > 0 && (
        <section aria-label="Community support">
          <p>
            Bay Area Paw is made possible with support from our community
            partners.
          </p>
          {acknowledgments.map((item) => (
            <SponsorAcknowledgment
              key={item.campaign_id + item.placement_id}
              acknowledgment={item}
            />
          ))}
        </section>
      )}
      <footer className="paw-footer">
        <div>
          <a className="paw-brand" href={basePath || "/"}>
            <PawMark size={40} />
            {name}
          </a>
          <p>{tagline}</p>
        </div>
        <p>
          A community project from{" "}
          <a href="https://bayareanewsnetwork.com">Bay Area News Network</a>.
          <br />
          Made for the places we call home.
        </p>
        <a href="#paw-community" className="paw-text-link">
          Find your community
        </a>
      </footer>
    </div>
  );
}
