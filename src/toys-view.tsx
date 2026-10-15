import React from "react";
import {
  TOY_AGE_RANGES,
  TOY_BRAND,
  TOY_CATEGORIES,
  TOY_CONDITIONS,
  TOY_EXCLUSIONS,
  TOY_HOW_IT_WORKS,
  TOY_SAFETY,
  TOY_STATUS_LABELS,
  hoursSummary,
  safeToyLink,
  toyOptionLabel,
  type ToyCommunity,
  type ToyListing,
  type ToyLocation,
} from "./toys";

/** ToyRound wordmark: a ring with a block passing around it. Original vector, no photograph. */
export function ToyRoundMark({ size = 40 }: { size?: number }) {
  return (
    <svg className="toy-mark" width={size} height={size} viewBox="0 0 64 64" aria-hidden="true" focusable="false">
      <circle cx="32" cy="32" r="24" fill="none" stroke="var(--toy-logo-ring, #1f2a44)" strokeWidth="7" />
      <circle cx="32" cy="32" r="24" fill="none" stroke="var(--toy-logo-arc, #ffb703)" strokeWidth="7" strokeDasharray="52 200" strokeLinecap="round" transform="rotate(-70 32 32)" />
      <rect x="40" y="6" width="16" height="16" rx="4" fill="var(--toy-logo-block, #ef6351)" transform="rotate(14 48 14)" />
      <circle cx="32" cy="32" r="8" fill="var(--toy-logo-core, #2a9d8f)" />
    </svg>
  );
}
export function ToyWordmark({ size = 34, href = "/" }: { size?: number; href?: string }) {
  return (
    <a className="toy-brand" href={safeToyLink(href) || "/"}>
      <ToyRoundMark size={size} />
      <span>
        Toy<em>Round</em>
      </span>
    </a>
  );
}
type ListingProps = {
  listing: ToyListing;
  href: string;
  mediaUrl: (listing: string, media: string) => string;
  large?: boolean;
};
export function ToyPhoto({ listing, mediaUrl, large = false, index = 0 }: Omit<ListingProps, "href"> & { index?: number }) {
  const photo = listing.media[index];
  const src = photo && safeToyLink(mediaUrl(listing.id, photo.id));
  if (!src)
    return (
      <div className="toy-photo-empty" aria-hidden="true">
        <ToyRoundMark size={48} />
      </div>
    );
  const separator = src.includes("?") ? "&" : "?";
  return (
    <figure className="toy-photo">
      <picture>
        <source type="image/webp" srcSet={`${src}${separator}width=640&format=webp 640w, ${src}${separator}width=1280&format=webp 1280w`} sizes={large ? "(max-width: 700px) 100vw, 60vw" : "(max-width: 700px) 100vw, 30vw"} />
        <img src={`${src}${separator}width=${large ? 1280 : 640}&format=jpeg`} alt={photo.caption || listing.content.title} width={large ? 1200 : 640} height={large ? 900 : 480} loading={large ? "eager" : "lazy"} />
      </picture>
    </figure>
  );
}
export function ToyBadges({ listing }: { listing: ToyListing }) {
  return (
    <p className="toy-badges">
      <span className={`toy-badge toy-badge-${listing.exchange_type}`}>{listing.exchange_type === "swap" ? "Swap" : "Free"}</span>
      <span className="toy-badge">{toyOptionLabel(TOY_AGE_RANGES, listing.age_range)}</span>
      <span className="toy-badge">{toyOptionLabel(TOY_CONDITIONS, listing.condition)}</span>
      {listing.status === "reserved" && <span className="toy-badge toy-badge-reserved">Reserved</span>}
    </p>
  );
}
export function ToyListingCard(props: ListingProps) {
  const href = safeToyLink(props.href);
  const { listing } = props;
  return (
    <article className={`toy-card${listing.status === "reserved" ? " toy-card-reserved" : ""}`}>
      <ToyPhoto {...props} />
      <div className="toy-card-copy">
        <ToyBadges listing={listing} />
        <h3>{href ? <a href={href}>{listing.content.title}</a> : listing.content.title}</h3>
        <p className="toy-context">
          {toyOptionLabel(TOY_CATEGORIES, listing.category)}
          {listing.community ? ` · ${listing.community}` : ""}
        </p>
        {listing.content.completeness === "missing_parts" && <p className="toy-note">Missing parts disclosed</p>}
      </div>
    </article>
  );
}
export function ToyLocationCard({ location }: { location: ToyLocation }) {
  const map = safeToyLink(location.map_url);
  const source = safeToyLink(location.source_url);
  const kind = location.kind === "official_exchange_zone" ? "Official exchange zone" : location.kind === "participating_business" ? "Participating business" : "Public meeting place";
  return (
    <article className="toy-location">
      <p className="toy-context">{kind}</p>
      <h3>{location.name}</h3>
      <p>{location.address}</p>
      <p className="toy-note">Hours: {hoursSummary(location.hours) || "See source"}</p>
      {location.restrictions && <p className="toy-note">{location.restrictions}</p>}
      {Object.entries(location.verified_facts).map(([key, fact]) => (
        <p className="toy-note" key={key}>
          <strong>{key}:</strong> {fact.text}
          {fact.source_url && safeToyLink(fact.source_url) && (
            <>
              {" "}
              <a href={safeToyLink(fact.source_url)} rel="noopener noreferrer">
                source
              </a>
            </>
          )}
        </p>
      ))}
      {location.hosting_partnership && <p className="toy-note">Hosting partner: {location.partnership_note}</p>}
      <p className="toy-location-links">
        {map && (
          <a href={map} rel="noopener noreferrer">
            Map
          </a>
        )}
        {source && (
          <a href={source} rel="noopener noreferrer">
            Source
          </a>
        )}
        {location.last_checked_on && <small>Last checked {location.last_checked_on}</small>}
      </p>
    </article>
  );
}
export function ToyHowItWorks() {
  return (
    <section className="toy-how" aria-labelledby="toy-how-title">
      <h2 id="toy-how-title">How it works</h2>
      <ol>
        {TOY_HOW_IT_WORKS.map((step, index) => (
          <li key={step.title}>
            <span className="toy-step-number" aria-hidden="true">
              {index + 1}
            </span>
            <strong>{step.title}</strong>
            <p>{step.detail}</p>
          </li>
        ))}
      </ol>
      <p className="toy-safety">{TOY_SAFETY.summary}</p>
    </section>
  );
}
export function ToyRulesContent() {
  return (
    <div className="toy-rules">
      <section>
        <h2>Community rules</h2>
        <ul>
          <li>Adults only. Posting and requesting need an 18+ statement plus a verified email and phone. Browsing is open to everyone.</li>
          <li>Free giveaways and direct swaps only. No sales, payments, deposits, shipping or delivery fees — ever.</li>
          <li>Real photos of the actual toy, with wear, damage and missing pieces disclosed.</li>
          <li>Exchanges happen at listed public places, during the day, with both neighbors confirming the time. No home or porch pickups.</li>
          <li>Keep coordination inside ToyRound. Use report and block if anything feels off.</li>
          <li>Editors review every listing before it appears, and may decline, edit or remove listings and suspend accounts.</li>
        </ul>
      </section>
      <section>
        <h2>Prohibited items</h2>
        <p>ToyRound is for ordinary toys, puzzles, games and play sets. These are not accepted:</p>
        <ul>
          {TOY_EXCLUSIONS.map((item) => (
            <li key={item.key}>{item.label}</li>
          ))}
        </ul>
        <p>
          Before listing, search the{" "}
          <a href="https://www.cpsc.gov/Recalls" rel="noopener noreferrer">
            CPSC recall database
          </a>{" "}
          for the brand and model. {TOY_SAFETY.recall}
        </p>
      </section>
      <section>
        <h2>Privacy and safety</h2>
        <ul>
          <li>Public profiles show a first name or chosen display name, community, join month and participant-confirmed completed exchanges. Nothing else.</li>
          <li>Legal names, phone numbers, email addresses and home addresses are never shown. ToyRound does not collect identity documents.</li>
          <li>Location data and other metadata are removed from uploaded photos.</li>
          <li>{TOY_SAFETY.children}</li>
          <li>{TOY_SAFETY.verification}</li>
          <li>Conversations, appointments and drafts are private to the two neighbors involved. Reported conversations may be reviewed by editors as moderation evidence.</li>
          <li>You can delete your ToyRound account from your account page. Listings are withdrawn, open exchanges are cancelled, and your profile is anonymized. Reports and blocks are retained under the platform's moderation retention policy.</li>
          <li>{TOY_SAFETY.summary}</li>
        </ul>
      </section>
    </div>
  );
}
export type ToysSectionProps = {
  communities: ToyCommunity[];
  community?: ToyCommunity;
  listings: ToyListing[];
  basePath?: string;
  mediaUrl: ListingProps["mediaUrl"];
  listingBasePath?: string;
  browsePath?: string;
  submitUrl?: string;
  accountUrl?: string;
  locationsUrl?: string;
  rulesUrl?: string;
  regionLabel?: string;
  nextUrl?: string;
  unavailable?: boolean;
  submissionsOpen?: boolean;
  locationCount?: number;
  filters?: Record<string, string | undefined>;
  embedded?: boolean;
  signedIn?: boolean;
};
/** The shared exchange surface, used by toyround.com and by every publication's /toys. */
export function ToysSection({
  communities,
  community,
  listings,
  basePath = "/toys",
  mediaUrl,
  listingBasePath,
  browsePath,
  submitUrl,
  accountUrl,
  locationsUrl,
  rulesUrl,
  regionLabel,
  nextUrl,
  unavailable,
  submissionsOpen = true,
  locationCount,
  filters = {},
  embedded = false,
  signedIn = false,
}: ToysSectionProps) {
  const link = (id: string) => `${listingBasePath || basePath}/${encodeURIComponent(id)}`;
  const location = community?.name || regionLabel || "the Bay Area";
  const browse = browsePath || basePath;
  const query = new URLSearchParams(Object.entries(filters).filter((e): e is [string, string] => typeof e[1] === "string" && e[1] !== ""));
  if (community) query.set("community", community.slug);
  const find = browse + (query.size ? "?" + query : "");
  return (
    <div className={`toy${embedded ? " toy-embedded" : ""}`}>
      <header className="toy-masthead">
        <ToyWordmark href={embedded ? basePath : "/"} />
        <p className="toy-tagline">{TOY_BRAND.tagline}</p>
        <nav className="toy-masthead-links" aria-label="ToyRound">
          {rulesUrl && <a href={safeToyLink(rulesUrl)}>Rules & safety</a>}
          {locationsUrl && <a href={safeToyLink(locationsUrl)}>Where to meet</a>}
          {accountUrl && <a href={safeToyLink(accountUrl)}>{signedIn ? "My toys" : "Sign in"}</a>}
        </nav>
      </header>
      {unavailable ? (
        <div role="status" className="toy-empty">
          <h1>ToyRound is taking a short break.</h1>
          <p>We can't load the exchange right now. Please try again shortly.</p>
        </div>
      ) : (
        <>
          <section className="toy-hero" aria-labelledby="toy-hero-title">
            <div className="toy-hero-copy">
              <p className="toy-eyebrow">Free giveaways and swaps in {location}</p>
              <h1 id="toy-hero-title">
                Pass along
                <br />
                the play.
              </h1>
              <p className="toy-hero-detail">Outgrown toys find new homes with neighbors. No money changes hands, and exchanges happen at public places during the day.</p>
              <div className="toy-hero-actions">
                <a className="toy-button" href={find}>
                  Find a toy
                </a>
                {submitUrl && (
                  <a className="toy-button toy-button-secondary" href={safeToyLink(submitUrl)}>
                    Give or swap a toy
                  </a>
                )}
              </div>
              {!submissionsOpen && <p className="toy-note">New listings are paused while our review team gets ready. Browsing stays open.</p>}
            </div>
            <div className="toy-hero-art" aria-hidden="true">
              <ToyRoundMark size={180} />
            </div>
          </section>
          <section className="toy-community" aria-label="Choose your community">
            <form action={browse} method="get" className="toy-filters">
              <label>
                Community
                <select name="community" defaultValue={community?.slug || ""}>
                  <option value="">All communities</option>
                  {communities.map((c) => (
                    <option key={c.id} value={c.slug}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Category
                <select name="category" defaultValue={filters.category || ""}>
                  <option value="">Any category</option>
                  {TOY_CATEGORIES.map((c) => (
                    <option key={c.key} value={c.key}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Age guidance
                <select name="age_range" defaultValue={filters.age_range || ""}>
                  <option value="">Any age</option>
                  {TOY_AGE_RANGES.map((c) => (
                    <option key={c.key} value={c.key}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Condition
                <select name="condition" defaultValue={filters.condition || ""}>
                  <option value="">Any condition</option>
                  {TOY_CONDITIONS.map((c) => (
                    <option key={c.key} value={c.key}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Type
                <select name="exchange_type" defaultValue={filters.exchange_type || ""}>
                  <option value="">Free or swap</option>
                  <option value="giveaway">Free giveaways</option>
                  <option value="swap">Swaps</option>
                </select>
              </label>
              <label>
                Availability
                <select name="availability" defaultValue={filters.availability || ""}>
                  <option value="">Include reserved</option>
                  <option value="available">Available now</option>
                </select>
              </label>
              <label>
                Search
                <input name="q" maxLength={80} defaultValue={filters.q || ""} placeholder="Train set, puzzle, Brio…" />
              </label>
              <button type="submit">Show toys</button>
            </form>
            {locationCount === 0 && community && (
              <p className="toy-note toy-location-warning">
                No checked meeting places are listed for {community.name} yet, so exchanges can't be arranged there until one is added. You can still browse, list, and{" "}
                {locationsUrl ? <a href={safeToyLink(locationsUrl)}>suggest a public meeting place</a> : "suggest a public meeting place"}.
              </p>
            )}
          </section>
          <section className="toy-section" aria-labelledby="toy-listings-title">
            <div className="toy-section-heading">
              <h2 id="toy-listings-title">{community ? `Toys in ${community.name}` : "Toys across the network"}</h2>
              <p>Every listing is reviewed by a local editor before it appears.</p>
            </div>
            {listings.length ? (
              <div className="toy-grid">
                {listings.map((listing) => (
                  <ToyListingCard key={listing.id} listing={listing} href={link(listing.id)} mediaUrl={mediaUrl} />
                ))}
              </div>
            ) : (
              <div className="toy-board-invitation">
                <ToyRoundMark size={56} />
                <div>
                  <h3>Be the first to pass along the play in {location}.</h3>
                  <p>No approved listings match yet. When neighbors list toys here, they'll appear after review.</p>
                </div>
                {submitUrl && (
                  <a className="toy-text-link" href={safeToyLink(submitUrl)}>
                    List a toy
                  </a>
                )}
              </div>
            )}
            {nextUrl && (
              <a className="toy-button toy-button-secondary" href={safeToyLink(nextUrl)}>
                More toys
              </a>
            )}
          </section>
          <ToyHowItWorks />
        </>
      )}
      <footer className="toy-footer">
        <div>
          <ToyWordmark size={28} href={embedded ? TOY_BRAND.origin : "/"} />
          <p>{TOY_BRAND.tagline}</p>
        </div>
        <p>
          {embedded ? (
            <>
              <a href={TOY_BRAND.origin}>{TOY_BRAND.poweredBy}</a>
              <br />
            </>
          ) : null}
          A community toy exchange by <a href={TOY_BRAND.networkUrl}>Bay Area News Network</a>.
        </p>
        <p className="toy-footer-links">
          {rulesUrl && <a href={safeToyLink(rulesUrl)}>Rules, prohibited items, privacy & safety</a>}
          {locationsUrl && <a href={safeToyLink(locationsUrl)}>Meeting places</a>}
        </p>
      </footer>
    </div>
  );
}
export function toyStatusLabel(status: string) {
  return TOY_STATUS_LABELS[status] || status;
}
