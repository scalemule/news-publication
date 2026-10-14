import React from "react";
import {
  adoptionAvailability,
  PET_SAFETY,
  safePetLink,
  type PetCommunity,
  type PetResource,
} from "./pets";
import { type PublicAcknowledgment } from "./sponsorships";
import { SponsorAcknowledgment as ExistingSponsorAcknowledgment } from "./sponsorship-view";

export function PawMark({ size = 36 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="currentColor"
      aria-hidden="true"
    >
      <ellipse
        cx="10"
        cy="19"
        rx="5.1"
        ry="6.5"
        transform="rotate(-25 10 19)"
      />
      <ellipse cx="20" cy="10" rx="5" ry="6.5" transform="rotate(-8 20 10)" />
      <ellipse cx="32" cy="12" rx="5" ry="6.5" transform="rotate(14 32 12)" />
      <ellipse cx="40" cy="23" rx="4.7" ry="6.2" transform="rotate(30 40 23)" />
      <path d="M11 35c0-5 7-16 13-16s14 11 14 16c0 6-6 9-11 6-2-1-4-1-6 0-5 3-10 0-10-6Z" />
    </svg>
  );
}
/** Original vector artwork; never presented as a photograph or a community pet. */
export function PawNeighborhoodIllustration() {
  return (
    <svg
      className="paw-neighborhood-art"
      viewBox="0 0 520 460"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M42 233C42 111 124 29 257 29c134 0 220 102 220 218v153H42V233Z"
        fill="var(--paw-art-sky)"
      />
      <circle cx="366" cy="112" r="44" fill="var(--paw-sun)" />
      <path
        d="M42 262c93-99 132-19 203-52 91-43 145-27 232 52v138H42V262Z"
        fill="var(--paw-art-hill)"
      />
      <path
        d="M42 331c89-59 161-27 216-3 81 36 145-47 219-21v93H42v-69Z"
        fill="var(--paw-art-ground)"
      />
      <path
        d="M310 239c34-18 68-21 103-14M311 249c34-18 68-21 103-14"
        stroke="var(--paw-art-line)"
        strokeWidth="2"
        strokeLinecap="round"
        opacity=".45"
      />
      <path
        d="M90 190v75m29-85v75m-44-46h61m-57 31c14-15 32-15 51-7"
        stroke="var(--paw-art-line)"
        strokeWidth="3"
        strokeLinecap="round"
        opacity=".45"
      />
      <path
        d="M167 341c-29-24-33-67-5-88 16-12 44-6 59 17l27 47c15 26 36 38 58 44H167v-20Z"
        fill="var(--paw-terracotta)"
      />
      <path
        d="M173 340c-17-9-39-15-54-31-14-16-13-27-11-38"
        stroke="var(--paw-terracotta)"
        strokeWidth="17"
        strokeLinecap="round"
      />
      <path
        d="M229 283c26-17 39-43 31-67-8-25-35-34-57-18-23 17-13 49 1 68"
        fill="var(--paw-terracotta)"
      />
      <path
        d="M251 224l34 5c14 2 13 23 0 28l-36 13"
        fill="var(--paw-terracotta)"
      />
      <path
        d="M206 203c-15 1-31 13-29 33 1 11 6 18 15 17 13-1 21-18 25-37"
        fill="var(--paw-art-line)"
      />
      <path
        d="M231 285l-10 67c-1 7 9 11 28 11M264 280l2 70c0 10 10 13 25 13"
        stroke="var(--paw-terracotta)"
        strokeWidth="19"
        strokeLinecap="round"
      />
      <path
        d="M215 273l38-7"
        stroke="var(--paw-art-line)"
        strokeWidth="9"
        strokeLinecap="round"
      />
      <circle cx="248" cy="223" r="3.5" fill="var(--paw-art-line)" />
      <path d="M283 229h9c1 8-3 13-9 13" fill="var(--paw-art-line)" />
      <path
        d="M292 348c-9-46 1-79 33-79 33 0 47 37 48 77l-1 17h-80v-15Z"
        fill="var(--paw-art-cat)"
      />
      <path d="M303 277l-6-43 26 20 23-22 2 48" fill="var(--paw-art-cat)" />
      <path
        d="M365 351c27-4 45-15 41-39-2-11-15-16-24-10"
        stroke="var(--paw-art-cat)"
        strokeWidth="12"
        strokeLinecap="round"
      />
      <path
        d="M316 277h3m17-2h3m-13 10 3 2-3 3m-21-5-15-3m16 9-17 2m54-10 16-5m-14 13 15 1"
        stroke="var(--paw-art-line)"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      <path
        d="M145 378h245"
        stroke="var(--paw-art-line)"
        strokeWidth="2"
        strokeLinecap="round"
        opacity=".3"
      />
      <circle cx="99" cy="365" r="16" fill="var(--paw-sun)" />
      <path
        d="M93 351c16 8 18 18 12 28"
        stroke="var(--paw-art-line)"
        strokeWidth="2"
      />
      <path
        d="M426 352v-43m0 22c-14-1-20-10-20-20 15 2 21 11 20 20m0-9c0-15 6-25 20-28 2 13-6 24-20 28"
        stroke="var(--paw-art-line)"
        strokeWidth="3"
        strokeLinecap="round"
      />
      <path
        d="m406 153 8-6 8 6m-234-33 8-6 8 6"
        stroke="var(--paw-art-line)"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
    </svg>
  );
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
export function PawOfTheWeekCard(props: ResourceProps) {
  const href = safePetLink(props.href);
  return (
    <article className="paw-spotlight">
      <Photo {...props} large />
      <div className="paw-spotlight-copy">
        <p className="paw-context">{props.community}’s Paw of the Week</p>
        <h2>Meet {props.resource.content.name}.</h2>
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
    <div className="paw">
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
        <p>A little closer to {location}.</p>
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
        <PawOfTheWeekCard
          resource={spotlight}
          community={local(spotlight.area_id)}
          href={link(spotlight.id)}
          mediaUrl={mediaUrl}
        />
      ) : (
        <section className="paw-welcome">
          <div>
            <p className="paw-eyebrow">Life is better together</p>
            <h1>
              Every pet.
              <br />
              <em>A local story.</em>
            </h1>
            <p>
              A place for familiar faces, happy reunions and the everyday joy of
              life with pets.
            </p>
            {contributeUrl && (
              <a className="paw-button" href={safePetLink(contributeUrl)}>
                Submit for Paw of the Week
              </a>
            )}
            <small>
              Free to enter. Thoughtfully selected by local editors.
            </small>
          </div>
          <div className="paw-illustration">
            <PawNeighborhoodIllustration />
            <p>Good neighbors. Great companions.</p>
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
              <p className="paw-empty">
                The photo board is ready for its first neighbors. Share a
                photograph and a few words about your pet.
              </p>
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
          <section id="celebrations" className="paw-section">
            <div className="paw-section-heading">
              <h2>A life full of little milestones</h2>
              <p>Birthdays, adoption days, new beginnings and fond memories.</p>
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
                Our editors are gathering official shelter and rescue listings.
                Check directly with your local organization for current
                availability.
              </p>
            )}
            <p className="paw-safety">{PET_SAFETY.adoption}</p>
            <a
              href={safePetLink(browseBasePath + "/adoption" + communityQuery)}
            >
              Explore adoption listings
            </a>
          </section>
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
        <PawMark size={24} />
        <p>
          A community project from Bay Area News Network.
          <br />
          {tagline}
        </p>
      </footer>
    </div>
  );
}
