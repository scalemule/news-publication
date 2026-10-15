/** Native server-rendered ToyRound pages. The host supplies its reader session and API key. */
import React from "react";
import { petReaderAuthenticated } from "./pets-plugin";
import { toyCollectionRequest, type ToyScope } from "./toys-server";
import {
  TOY_AGE_RANGES,
  TOY_BRAND,
  TOY_CATEGORIES,
  TOY_CONDITIONS,
  TOY_REQUEST_STATUS_LABELS,
  TOY_SAFETY,
  TOY_STATUS_LABELS,
  TOY_UUID,
  formatLocalStart,
  resolveToyCommunity,
  safeToyLink,
  toyOptionLabel,
  type OwnToyListing,
  type ToyCommunity,
  type ToyListing,
  type ToyLocation,
  type ToyMember,
  type ToyOwner,
  type ToyPolicy,
  type ToyRequest,
  type ToyThread,
} from "./toys";
import { ToyBadges, ToyListingCard, ToyLocationCard, ToyPhoto, ToyRulesContent, ToyWordmark } from "./toys-view";
import { ToyListingForm, ToyMemberSetup, ToyOwnerActions, ToySignIn } from "@scalemule/news-publication/toys-forms";
import { ToyAccountDelete, ToyExchangeThread, ToyListingActions, ToyLocationSuggestForm, ToyRequestPanel, ToySignOut } from "@scalemule/news-publication/toys-interactions";

export type ToyPluginPaths = {
  home: string;
  account: string;
  submit: string;
  listing: string;
  exchanges: string;
  locations: string;
  rules: string;
  profiles: string;
  api: string;
  auth: string;
  community: string;
};
export const publicationToyPaths: ToyPluginPaths = {
  home: "/toys",
  account: "/toys/account",
  submit: "/toys/submit",
  listing: "/toys",
  exchanges: "/toys/exchanges",
  locations: "/toys/places",
  rules: "/toys/rules",
  profiles: "/toys/neighbors",
  api: "/api/toys",
  auth: "/api/paw-auth",
  community: "/api/toy-community",
};
export const standaloneToyPaths: ToyPluginPaths = {
  home: "/",
  account: "/account",
  submit: "/give",
  listing: "/toys",
  exchanges: "/exchanges",
  locations: "/places",
  rules: "/rules",
  profiles: "/neighbors",
  api: "/api/toys",
  auth: "/api/paw-auth",
  community: "/api/toy-community",
};
export const toyReaderAuthenticated = petReaderAuthenticated;
export const toyMediaUrl = (api: string) => (listing: string, media: string) => `${api}/${encodeURIComponent(listing)}/media/${encodeURIComponent(media)}`;
export function Shell({ paths, children, signedIn, embedded = false }: { paths: ToyPluginPaths; children: React.ReactNode; signedIn?: boolean; embedded?: boolean }) {
  return (
    <div className={`toy${embedded ? " toy-embedded" : ""}`}>
      <header className="toy-page-heading">
        <ToyWordmark href={paths.home} />
        <nav className="toy-masthead-links" aria-label="ToyRound">
          <a href={paths.submit}>Give or swap</a>
          <a href={paths.account}>{signedIn ? "My toys" : "Sign in"}</a>
          {signedIn && <ToySignOut returnTo={paths.home} authPath={paths.auth} />}
        </nav>
      </header>
      {children}
      <footer className="toy-footer toy-page-footer">
        <div>
          <ToyWordmark size={28} href={paths.home} />
          <p>{TOY_BRAND.tagline}</p>
        </div>
        <p>
          {embedded && (
            <>
              <a href={TOY_BRAND.origin}>{TOY_BRAND.poweredBy}</a>
              <br />
            </>
          )}
          A community toy exchange by <a href={TOY_BRAND.networkUrl}>Bay Area News Network</a>.
        </p>
        <p className="toy-footer-links">
          <a href={paths.rules}>Rules, prohibited items, privacy & safety</a>
          <a href={paths.locations}>Meeting places</a>
        </p>
      </footer>
    </div>
  );
}
function LoadError({ error, retry, account, auth }: { error: unknown; retry: string; account: string; auth: string }) {
  const status = error && typeof error === "object" && "status" in error ? error.status : undefined;
  if (status === 401 || status === 403)
    return (
      <div className="toy-load-error" role="status">
        <h2>Reconnect your network account.</h2>
        <ToySignIn returnTo={retry} authPath={auth} />
      </div>
    );
  return (
    <div className="toy-load-error" role="status">
      <h2>We couldn't open ToyRound.</h2>
      <p>{status === 429 ? "There have been several requests in a short time. Wait a moment, then try again." : "The connection is temporarily unavailable. Try loading this page again."}</p>
      <div className="toy-form-actions">
        <a className="toy-button" href={retry}>
          Try again
        </a>
        {retry !== account && (
          <a className="toy-text-link" href={account}>
            My toys
          </a>
        )}
      </div>
    </div>
  );
}
async function policy(scope: ToyScope) {
  return toyCollectionRequest<ToyPolicy>({ ...scope, accessToken: undefined }, "/policy");
}
export async function ToyAccountPage({ scope, signedIn, paths = publicationToyPaths, signInEnabled = true, embedded = false }: { scope: ToyScope; signedIn: boolean; paths?: ToyPluginPaths; signInEnabled?: boolean; embedded?: boolean }) {
  let body: React.ReactNode;
  if (!signedIn) body = signInEnabled ? <ToySignIn returnTo={paths.account} authPath={paths.auth} /> : <p>Community sign-in is being prepared. Browsing is open.</p>;
  else
    try {
      const [member, mine, inbox] = await Promise.all([
        toyCollectionRequest<ToyMember>(scope, "/member"),
        toyCollectionRequest<{ items: OwnToyListing[]; next_cursor: string | null }>(scope, "/mine"),
        toyCollectionRequest<{ items: ToyRequest[] }>(scope, "/requests"),
      ]);
      const open = inbox.items.filter((r) => ["pending", "accepted"].includes(r.status));
      const closed = inbox.items.filter((r) => !["pending", "accepted"].includes(r.status));
      body = (
        <>
          <ToyMemberSetup member={member} apiPath={paths.api} />
          <section className="toy-section" aria-labelledby="toy-my-listings">
            <div className="toy-section-heading">
              <h2 id="toy-my-listings">My listings</h2>
              <a className="toy-button" href={paths.submit}>
                Give or swap a toy
              </a>
            </div>
            {!mine.items.length && <p className="toy-note">Nothing listed yet. Outgrown toys, puzzles and games are welcome.</p>}
            {mine.items.map((listing) => (
              <article className="toy-account-row" key={listing.id}>
                <ToyPhoto listing={listing} mediaUrl={toyMediaUrl(paths.api)} />
                <div>
                  <h3>
                    {listing.status === "available" || listing.status === "reserved" ? <a href={`${paths.listing}/${listing.id}`}>{listing.content.title}</a> : listing.content.title}
                  </h3>
                  <p className="toy-context">
                    {TOY_STATUS_LABELS[listing.status] || listing.status}
                    {listing.open_requests ? ` · ${listing.open_requests} open request${listing.open_requests === 1 ? "" : "s"}` : ""}
                  </p>
                  {listing.review_note && <p className="toy-note">Editor's note: {listing.review_note}</p>}
                  {listing.suspension && <p className="toy-note">Suspended for safety review{listing.suspension.note ? `: ${listing.suspension.note}` : "."}</p>}
                  <ToyOwnerActions listing={listing} apiPath={paths.api} submitUrl={paths.submit} />
                </div>
              </article>
            ))}
          </section>
          <section className="toy-section" aria-labelledby="toy-exchanges-title">
            <div className="toy-section-heading">
              <h2 id="toy-exchanges-title">Exchanges</h2>
            </div>
            {!open.length && <p className="toy-note">No open requests or offers.</p>}
            <ul className="toy-inbox">
              {[...open, ...closed.slice(0, 10)].map((r) => (
                <li key={r.id} className={["pending", "accepted"].includes(r.status) ? "open" : "closed"}>
                  <a href={`${paths.exchanges}/${r.id}`}>
                    <strong>{r.listing.title}</strong>
                    <span>
                      {r.role === "owner" ? "From" : "To"} {r.counterpart_deleted ? "a closed account" : r.counterpart?.display_name || "a neighbor"} · {TOY_REQUEST_STATUS_LABELS[r.status] || r.status}
                      {r.appointment?.status === "confirmed" ? ` · meeting ${formatLocalStart(r.appointment.local_start, r.appointment.timezone)}` : r.appointment?.status === "proposed" ? " · meeting proposed" : ""}
                    </span>
                  </a>
                </li>
              ))}
            </ul>
          </section>
          <ToyAccountDelete revision={member.revision} apiPath={paths.api} returnTo={paths.home} />
        </>
      );
    } catch (error) {
      body = <LoadError error={error} retry={paths.account} account={paths.account} auth={paths.auth} />;
    }
  return (
    <Shell paths={paths} signedIn={signedIn} embedded={embedded}>
      <section className="toy-story">
        <p className="toy-eyebrow">Your ToyRound account</p>
        <h1>My toys</h1>
        {body}
      </section>
    </Shell>
  );
}
export async function ToySubmitPage({ scope, signedIn, paths = publicationToyPaths, edit, community, submissionsEnabled = true, embedded = false }: { scope: ToyScope; signedIn: boolean; paths?: ToyPluginPaths; edit?: string; community?: string; submissionsEnabled?: boolean; embedded?: boolean }) {
  let form: React.ReactNode;
  const next = paths.submit + "?" + new URLSearchParams({ ...(edit ? { edit } : {}), ...(community ? { community } : {}) });
  if (!submissionsEnabled)
    form = (
      <section className="toy-form">
        <h1>Listings open soon.</h1>
        <p>New listings are paused while our local review team gets ready. Browsing stays open.</p>
      </section>
    );
  else if (!signedIn)
    form = (
      <section className="toy-form">
        <h1>Give or swap a toy.</h1>
        <p>Sign in with your network account to list a toy. Listing needs an adult account with verified email and phone.</p>
        <ToySignIn returnTo={next} authPath={paths.auth} />
      </section>
    );
  else
    try {
      const [rules, member, initial] = await Promise.all([
        policy(scope),
        toyCollectionRequest<ToyMember>(scope, "/member"),
        edit && TOY_UUID.test(edit) ? toyCollectionRequest<OwnToyListing>(scope, "/mine/" + edit) : undefined,
      ]);
      if (!member.verification.ready || member.status === "suspended")
        form = (
          <section className="toy-form">
            <h1>Almost there.</h1>
            <p>Finish these steps, then come back to list your toy.</p>
            <ToyMemberSetup member={member} apiPath={paths.api} compact />
            <p>
              <a className="toy-button" href={next}>
                Continue to the listing form
              </a>
            </p>
          </section>
        );
      else if (edit && !initial) form = <p>This listing is unavailable. Open it from My toys.</p>;
      else {
        const home = member.community && rules.areas.some((a) => a.id === member.community!.id) ? member.community.id : undefined;
        form = <ToyListingForm communities={rules.areas} policy={rules.submission_policy} initial={initial} defaultCommunity={rules.areas.find((a) => a.slug === community)?.id || home} apiPath={paths.api} accountUrl={paths.account} listingBasePath={paths.listing} />;
      }
    } catch (error) {
      form = (
        <section className="toy-form">
          <h1>Give or swap a toy.</h1>
          <LoadError error={error} retry={next} account={paths.account} auth={paths.auth} />
        </section>
      );
    }
  return (
    <Shell paths={paths} signedIn={signedIn} embedded={embedded}>
      {form}
    </Shell>
  );
}
export async function fetchToyListing(scope: ToyScope, id: string): Promise<ToyListing | null> {
  if (!TOY_UUID.test(id)) return null;
  try {
    return await toyCollectionRequest<ToyListing>({ ...scope, accessToken: undefined }, "/" + id);
  } catch (error) {
    if (error && typeof error === "object" && "status" in error && error.status === 404) return null;
    throw error;
  }
}
export async function ToyListingPage({ scope, listing, signedIn, paths = publicationToyPaths, canonicalOrigin, embedded = false }: { scope: ToyScope; listing: ToyListing; signedIn: boolean; paths?: ToyPluginPaths; canonicalOrigin: string; embedded?: boolean }) {
  const c = listing.content;
  let ready = false,
    own: OwnToyListing[] = [];
  if (signedIn)
    try {
      const [member, mine] = await Promise.all([toyCollectionRequest<ToyMember>(scope, "/member"), toyCollectionRequest<{ items: OwnToyListing[] }>(scope, "/mine")]);
      ready = member.verification.ready && member.status === "active";
      own = mine.items;
    } catch {
      /* Public browsing continues; request panel asks to finish setup. */
    }
  const listingPath = `${paths.listing}/${listing.id}`;
  const mediaUrl = toyMediaUrl(paths.api);
  return (
    <Shell paths={paths} signedIn={signedIn} embedded={embedded}>
      <article className="toy-listing">
        <div className="toy-listing-gallery">
          {listing.media.map((photo, index) => (
            <ToyPhoto key={photo.id} listing={listing} mediaUrl={mediaUrl} large={index === 0} index={index} />
          ))}
        </div>
        <div className="toy-listing-copy">
          <p className="toy-context">
            {toyOptionLabel(TOY_CATEGORIES, listing.category)}
            {listing.community ? ` · ${listing.community}` : ""}
          </p>
          <h1>{c.title}</h1>
          <ToyBadges listing={listing} />
          <p style={{ whiteSpace: "pre-wrap" }}>{c.description}</p>
          <dl className="toy-facts">
            {(c.brand || c.model) && (
              <>
                <dt>Brand / model</dt>
                <dd>{[c.brand, c.model].filter(Boolean).join(" · ")}</dd>
              </>
            )}
            <dt>Completeness</dt>
            <dd>{c.completeness === "complete" ? "Complete, per the owner" : c.completeness === "missing_parts" ? `Missing parts: ${c.missing_parts}` : "Not sure, per the owner"}</dd>
            <dt>Condition</dt>
            <dd>{toyOptionLabel(TOY_CONDITIONS, listing.condition)}</dd>
            <dt>Manufacturer age guidance</dt>
            <dd>
              {toyOptionLabel(TOY_AGE_RANGES, listing.age_range)}
              {c.age_guidance ? ` — "${c.age_guidance}"` : ""}
            </dd>
            {c.warnings && (
              <>
                <dt>Manufacturer warnings</dt>
                <dd>{c.warnings}</dd>
              </>
            )}
            {listing.exchange_type === "swap" && c.swap_wishes && (
              <>
                <dt>Hoping to swap for</dt>
                <dd>{c.swap_wishes}</dd>
              </>
            )}
          </dl>
          <aside className="toy-recall-statement">
            <h2>Recall check — the owner's statement</h2>
            <p>
              {c.recall_check.searched_cpsc ? (
                <>
                  The owner reports searching the CPSC recall database{c.recall_check.searched_at ? ` on ${new Date(c.recall_check.searched_at).toLocaleDateString()}` : ""}
                  {c.recall_check.search_terms ? ` for "${c.recall_check.search_terms}"` : ""} and {c.recall_check.result === "no_match_found" ? "found no recall" : "was not sure"}.
                </>
              ) : (
                "No recall search was reported."
              )}{" "}
              An editor reviewed this listing before publication. {TOY_SAFETY.recall}
            </p>
            <p className="toy-note">{TOY_SAFETY.children}</p>
          </aside>
          {listing.owner && (
            <aside className="toy-owner-card">
              <p className="toy-context">Offered by</p>
              <h2>
                <a href={`${paths.profiles}/${listing.owner.id}`}>{listing.owner.display_name}</a>
              </h2>
              <p>
                {listing.owner.community?.name ? `${listing.owner.community.name} · ` : ""}member since {listing.owner.member_since} · {listing.owner.completed_exchanges} completed exchange{listing.owner.completed_exchanges === 1 ? "" : "s"}
              </p>
              <small>Completed exchanges are participant-confirmed counts, not a rating.</small>
            </aside>
          )}
          <ToyRequestPanel listing={listing} signedIn={signedIn} ready={ready} ownListings={own} apiPath={paths.api} accountUrl={paths.account} exchangeBasePath={paths.exchanges} listingPath={listingPath} locationsAvailable={listing.exchange_locations_available !== false} />
          <p className="toy-safety">{TOY_SAFETY.meeting}</p>
          <ToyListingActions listing={listing} signedIn={signedIn} apiPath={paths.api} accountUrl={paths.account} listingPath={listingPath} />
          <p>
            <a href={canonicalOrigin + "/toys/" + listing.id}>Permanent link</a> · <a href={paths.home}>More toys</a>
          </p>
        </div>
      </article>
    </Shell>
  );
}
export async function ToyProfilePage({ scope, id, paths = publicationToyPaths, signedIn, embedded = false }: { scope: ToyScope; id: string; paths?: ToyPluginPaths; signedIn: boolean; embedded?: boolean }) {
  if (!TOY_UUID.test(id)) return null;
  let profile: (ToyOwner & { listings: ToyListing[] }) | null = null;
  try {
    profile = await toyCollectionRequest<ToyOwner & { listings: ToyListing[] }>({ ...scope, accessToken: undefined }, "/profiles/" + id);
  } catch (error) {
    if (!(error && typeof error === "object" && "status" in error && error.status === 404)) throw error;
  }
  if (!profile) return null;
  return (
    <Shell paths={paths} signedIn={signedIn} embedded={embedded}>
      <section className="toy-story">
        <p className="toy-eyebrow">Neighbor</p>
        <h1>{profile.display_name}</h1>
        <p>
          {profile.community?.name ? `${profile.community.name} · ` : ""}member since {profile.member_since} · {profile.completed_exchanges} completed exchange{profile.completed_exchanges === 1 ? "" : "s"} (participant-confirmed)
        </p>
        <div className="toy-grid">
          {profile.listings.map((listing) => (
            <ToyListingCard key={listing.id} listing={listing} href={`${paths.listing}/${listing.id}`} mediaUrl={toyMediaUrl(paths.api)} />
          ))}
        </div>
        {!profile.listings.length && <p className="toy-note">No available listings right now.</p>}
      </section>
    </Shell>
  );
}
export async function ToyExchangePage({ scope, signedIn, id, paths = publicationToyPaths, embedded = false }: { scope: ToyScope; signedIn: boolean; id: string; paths?: ToyPluginPaths; embedded?: boolean }) {
  let body: React.ReactNode;
  if (!signedIn) body = <ToySignIn returnTo={`${paths.exchanges}/${id}`} authPath={paths.auth} />;
  else if (!TOY_UUID.test(id)) body = <p>This exchange is unavailable.</p>;
  else
    try {
      const thread = await toyCollectionRequest<ToyThread>(scope, "/requests/" + id);
      body = <ToyExchangeThread thread={thread} apiPath={paths.api} listingBasePath={paths.listing} locationsUrl={paths.locations} />;
    } catch (error) {
      body = error && typeof error === "object" && "status" in error && error.status === 404 ? <p>This exchange is unavailable.</p> : <LoadError error={error} retry={`${paths.exchanges}/${id}`} account={paths.account} auth={paths.auth} />;
    }
  return (
    <Shell paths={paths} signedIn={signedIn} embedded={embedded}>
      <section className="toy-story">
        <p className="toy-eyebrow">
          <a href={paths.account}>My toys</a> · Exchange
        </p>
        {body}
      </section>
    </Shell>
  );
}
export async function ToyLocationsPage({ scope, community, signedIn, paths = publicationToyPaths, embedded = false }: { scope: ToyScope; community?: string; signedIn: boolean; paths?: ToyPluginPaths; embedded?: boolean }) {
  let body: React.ReactNode;
  try {
    const rules = await policy(scope);
    const chosen = resolveToyCommunity(rules.areas, community);
    const places = await toyCollectionRequest<{ items: ToyLocation[]; note: string }>({ ...scope, accessToken: undefined }, "/locations" + (chosen ? "?area_id=" + chosen.id : ""));
    body = (
      <>
        <form method="get" className="toy-filters">
          <label>
            Community
            <select name="community" defaultValue={chosen?.slug || ""}>
              <option value="">All communities</option>
              {rules.areas.map((a) => (
                <option key={a.id} value={a.slug}>
                  {a.name}
                </option>
              ))}
            </select>
          </label>
          <button type="submit">Show places</button>
        </form>
        <p className="toy-safety">{places.note}</p>
        {places.items.length ? (
          <div className="toy-grid">
            {places.items.map((location) => (
              <ToyLocationCard key={location.id} location={location} />
            ))}
          </div>
        ) : (
          <p className="toy-note">No checked meeting places are listed {chosen ? `for ${chosen.name}` : "yet"}. Exchanges can't be scheduled until an editor adds one. You can suggest a public place below.</p>
        )}
        {signedIn ? <ToyLocationSuggestForm communities={rules.areas} apiPath={paths.api} defaultCommunity={chosen?.id} /> : <p className="toy-note">Sign in to suggest a public meeting place for editorial review.</p>}
      </>
    );
  } catch (error) {
    body = <LoadError error={error} retry={paths.locations} account={paths.account} auth={paths.auth} />;
  }
  return (
    <Shell paths={paths} signedIn={signedIn} embedded={embedded}>
      <section className="toy-story">
        <p className="toy-eyebrow">Where exchanges happen</p>
        <h1>Public meeting places</h1>
        <p>Every place here was checked by an editor against a public source. Listed hours and any facts about lighting, cameras or staffing come from that source and are not guarantees.</p>
        {body}
      </section>
    </Shell>
  );
}
export function ToyRulesPage({ paths = publicationToyPaths, signedIn = false, embedded = false }: { paths?: ToyPluginPaths; signedIn?: boolean; embedded?: boolean }) {
  return (
    <Shell paths={paths} signedIn={signedIn} embedded={embedded}>
      <section className="toy-story">
        <p className="toy-eyebrow">ToyRound</p>
        <h1>Rules, prohibited items, privacy & safety</h1>
        <ToyRulesContent />
      </section>
    </Shell>
  );
}
export { safeToyLink, type ToyCommunity };
