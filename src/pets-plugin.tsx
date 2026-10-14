/** Native server-rendered pet pages. The host supplies its existing reader session. */
import React from "react";
import { petRequest, type PetScope } from "./pets-server";
import {
  PET_UUID,
  PET_SAFETY,
  safePetLink,
  resolvePetCommunity,
  type PetCommunity,
  type PetResource,
  type OwnPetResource,
  type PetPreferenceRecord,
} from "./pets";
import {
  PawMark,
  PetProfileCard,
  PetCelebrationCard,
  LostPetNotice,
  AdoptionListingCard,
  PetEventCard,
} from "./pets-view";
// Separate package entry points preserve React Server Component/client boundaries.
import {
  PetSignIn,
  PetOwnerActions,
  PetSubmissionForm,
} from "@scalemule/news-publication/pets-forms";
import {
  PetPreferencesForm,
  PetSignOut,
  PetResourceActions,
} from "@scalemule/news-publication/pets-interactions";

export type PetPluginPaths = {
  home: string;
  account: string;
  submit: string;
  resource: string;
  browse: string;
};
export const publicationPetPaths: PetPluginPaths = {
  home: "/pets",
  account: "/pets/account",
  submit: "/pets/submit",
  resource: "/pets",
  browse: "/pets/browse",
};
export const standalonePetPaths: PetPluginPaths = {
  home: "/",
  account: "/account",
  submit: "/submit",
  resource: "/pets",
  browse: "/browse",
};
type Collection = {
  areas: PetCommunity[];
  submission_policy: { version: string; text: string; guidelines: string };
};
export function petCollectionRequest<T>(scope: PetScope, suffix = "") {
  return petRequest<T>(
    scope,
    `/v1/knowledge/community-maps/collections/${scope.collectionSlug}${suffix}`,
  );
}
export async function petReaderAuthenticated(scope: PetScope) {
  if (!scope.accessToken) return false;
  try {
    const me = await petRequest<{ id: string; email_verified: boolean }>(
      scope,
      "/v1/auth/me",
    );
    return Boolean(me.id && me.email_verified);
  } catch {
    return false;
  }
}
function Shell({
  paths,
  children,
  signedIn,
}: {
  paths: PetPluginPaths;
  children: React.ReactNode;
  signedIn?: boolean;
}) {
  return (
    <div className="paw">
      <header className="paw-page-heading">
        <a className="paw-brand" href={paths.home}>
          <PawMark />
          Bay Area Paw
        </a>
        <div className="paw-form-actions">
          <a href={paths.account}>My pets</a>
          {signedIn && <PetSignOut returnTo={paths.home} />}
        </div>
      </header>
      {children}
    </div>
  );
}
export async function PetAccountPage({
  scope,
  signedIn,
  paths = publicationPetPaths,
  after,
  signInEnabled = true,
}: {
  scope: PetScope;
  signedIn: boolean;
  paths?: PetPluginPaths;
  after?: string;
  signInEnabled?: boolean;
}) {
  let body: React.ReactNode;
  if (!signedIn)
    body = signInEnabled ? (
      <PetSignIn returnTo={paths.account} />
    ) : (
      <p>Community sign-in is being prepared. Public browsing is open.</p>
    );
  else
    try {
      const [own, preferences, collection] = await Promise.all([
        petCollectionRequest<{
          items: OwnPetResource[];
          next_cursor: string | null;
        }>(
          scope,
          "/pets/mine" +
            (after && PET_UUID.test(after) ? "?after=" + after : ""),
        ),
        petCollectionRequest<
          PetPreferenceRecord & { communities?: PetCommunity[] }
        >(scope, "/pets/preferences"),
        petCollectionRequest<Collection>(scope),
      ]);
      body = (
        <>
          <p className="paw-intro">
            A home for their stories, wherever you read your local news.
          </p>
          {!own.items.length && (
            <p>
              Your pet’s story starts here. Create a private profile or share a
              contribution with the community.
            </p>
          )}
          {own.items.map((resource) => (
            <article className="paw-account-row" key={resource.id}>
              <h2>{resource.content.name}</h2>
              <p>
                {resource.visibility === "private"
                  ? "Private — only you"
                  : resource.status === "published"
                    ? "Editorially published; visibility follows its scheduled dates"
                    : resource.status.replaceAll("_", " ")}
              </p>
              {resource.review_note && (
                <p>Editorial note: {resource.review_note}</p>
              )}
              <PetOwnerActions resource={resource} submitUrl={paths.submit} />
            </article>
          ))}
          {own.next_cursor && (
            <a href={paths.account + "?after=" + own.next_cursor}>
              More contributions
            </a>
          )}
          <p>
            <a className="paw-button" href={paths.submit}>
              Add a pet or story
            </a>
          </p>
          <PetPreferencesForm
            record={preferences}
            communities={preferences.communities || collection.areas}
          />
        </>
      );
    } catch (error) {
      body =
        error &&
        typeof error === "object" &&
        "status" in error &&
        error.status === 403 ? (
          <>
            <p>Connect your network sign-in to open this pet community.</p>
            <PetSignIn returnTo={paths.account} />
          </>
        ) : (
          <p role="status">
            Your pets could not be loaded. Please try again shortly.
          </p>
        );
    }
  return (
    <Shell paths={paths} signedIn={signedIn}>
      <section className="paw-story">
        <p className="paw-eyebrow">Your community account</p>
        <h1>
          Your pets.
          <br />
          Your little corner.
        </h1>
        {body}
      </section>
    </Shell>
  );
}
export async function PetSubmitPage({
  scope,
  signedIn,
  paths = publicationPetPaths,
  edit,
  community,
  submissionsEnabled = true,
}: {
  scope: PetScope;
  signedIn: boolean;
  paths?: PetPluginPaths;
  edit?: string;
  community?: string;
  submissionsEnabled?: boolean;
}) {
  let form: React.ReactNode;
  const next =
    paths.submit +
    "?" +
    new URLSearchParams({
      ...(edit ? { edit } : {}),
      ...(community ? { community } : {}),
    });
  if (!submissionsEnabled)
    form = (
      <section className="paw-form">
        <h1>We’re getting ready to meet your pets.</h1>
        <p>
          Contributions will open when our local review team and photo-sharing
          experience are ready.
        </p>
      </section>
    );
  else if (!signedIn)
    form = (
      <section className="paw-form">
        <h1>
          A familiar sign-in.
          <br />A new place to belong.
        </h1>
        <PetSignIn returnTo={next} />
      </section>
    );
  else
    try {
      const [collection, own, initial] = await Promise.all([
        petCollectionRequest<Collection>(scope),
        petCollectionRequest<{ items: OwnPetResource[] }>(scope, "/pets/mine"),
        edit && PET_UUID.test(edit)
          ? petCollectionRequest<OwnPetResource>(scope, "/pets/mine/" + edit)
          : undefined,
      ]);
      form =
        edit && !initial ? (
          <p>This contribution is unavailable. Open it from My pets.</p>
        ) : (
          <PetSubmissionForm
            communities={collection.areas}
            policy={collection.submission_policy}
            profiles={own.items.filter((p) => p.kind === "profile")}
            initial={initial}
            defaultCommunity={
              collection.areas.find((a) => a.slug === community)?.id
            }
            accountUrl={paths.account}
          />
        );
    } catch {
      form = (
        <p role="status">
          This contribution could not be loaded. Open it from My pets or try
          again shortly.
        </p>
      );
    }
  return <Shell paths={paths}>{form}</Shell>;
}
export function PetStoryPage({
  resource,
  communities,
  signedIn,
  paths = publicationPetPaths,
  canonicalOrigin,
}: {
  resource: PetResource;
  communities: PetCommunity[];
  signedIn: boolean;
  paths?: PetPluginPaths;
  canonicalOrigin: string;
}) {
  const c = resource.content,
    photoUrl = (photo: string) => `/api/pets/${resource.id}/media/${photo}`,
    source = c.source && safePetLink(c.source.official_url);
  return (
    <Shell paths={paths}>
      <article
        className={`paw-story${c.category === "memorial" ? " paw-memorial" : ""}`}
      >
        <p className="paw-context">
          {communities.find((a) => a.id === resource.area_id)?.name}
        </p>
        <h1>
          {c.category === "memorial" ? "Remembering " : "Meet "}
          {c.name}.
        </h1>
        {resource.media.map((photo, index) => (
          <figure key={photo.id}>
            <picture>
              <source
                type="image/webp"
                srcSet={`${photoUrl(photo.id)}?width=640&format=webp 640w, ${photoUrl(photo.id)}?width=1280&format=webp 1280w`}
                sizes="(max-width: 850px) 100vw, 800px"
              />
              <img
                src={`${photoUrl(photo.id)}?width=1280&format=jpeg`}
                alt={photo.caption || c.name}
                width={1200}
                height={900}
                loading={index ? "lazy" : "eager"}
              />
            </picture>
            <figcaption>{photo.attribution}</figcaption>
          </figure>
        ))}
        <p>{c.story}</p>
        {c.personality && <p>{c.personality}</p>}
        {c.activities.length > 0 && (
          <p>Favorite things: {c.activities.join(", ")}.</p>
        )}
        {c.attribution && (
          <p className="paw-credit">Shared by {c.attribution}</p>
        )}
        {["lost", "found"].includes(resource.kind) && (
          <aside className="paw-safety">
            <p>
              {resource.reunited_at
                ? "Reported reunited."
                : "A community report."}
            </p>
            <p>{PET_SAFETY.recovery}</p>
            <p>
              Private recovery contact is not available yet. Do not post contact
              details in public.
            </p>
          </aside>
        )}
        {source && (
          <a href={source} rel="noopener noreferrer">
            Visit {c.source!.organization} for current information
          </a>
        )}
        <p>
          <a href={canonicalOrigin + "/pets/" + resource.id}>
            Permanent link to this story
          </a>
        </p>
        <PetResourceActions
          resource={resource}
          signedIn={signedIn}
          accountUrl={paths.account}
        />
        <a href={paths.home}>More community pets</a>
      </article>
    </Shell>
  );
}
export const petBrowseLabels: Record<string, string> = {
  neighbors: "Friends around the corner",
  profile: "Meet our pets",
  photo: "The community photo board",
  lost_found: "Let’s help them get home.",
  celebration: "Little milestones. Lasting memories.",
  adoption: "A new chapter starts with hello.",
  event: "Good things to get together for.",
};
export async function PetBrowsePage({
  scope,
  kind,
  query,
  paths = publicationPetPaths,
}: {
  scope: PetScope;
  kind: string;
  query: Record<string, string | undefined>;
  paths?: PetPluginPaths;
}) {
  let body: React.ReactNode;
  try {
    const collection = await petCollectionRequest<Collection>(scope),
      chosen = resolvePetCommunity(collection.areas, query.community);
    const filter = new URLSearchParams({ kind });
    if (chosen) filter.set("area_id", chosen.id);
    for (const key of ["after", "species", "category"])
      if (query[key]) filter.set(key, query[key]!);
    const result = await petCollectionRequest<{
      items: PetResource[];
      next_cursor: string | null;
    }>(scope, "/pets?" + filter);
    const Card =
      kind === "lost_found"
        ? LostPetNotice
        : kind === "celebration"
          ? PetCelebrationCard
          : kind === "adoption"
            ? AdoptionListingCard
            : kind === "event"
              ? PetEventCard
              : PetProfileCard;
    const next = new URLSearchParams(
      Object.entries(query).filter(
        (e): e is [string, string] => typeof e[1] === "string",
      ),
    );
    if (result.next_cursor) next.set("after", result.next_cursor);
    body = (
      <>
        <form className="paw-filters" method="get">
          <label>
            Community
            <select name="community" defaultValue={chosen?.slug || ""}>
              <option value="">All local communities</option>
              {collection.areas.map((a) => (
                <option key={a.id} value={a.slug}>
                  {a.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Species
            <input name="species" maxLength={50} defaultValue={query.species} />
          </label>
          <button>Browse</button>
        </form>
        {result.items.length ? (
          <div className="paw-gallery">
            {result.items.map((r) => (
              <Card
                key={r.id}
                resource={r}
                community={
                  collection.areas.find((a) => a.id === r.area_id)?.name ||
                  "Our community"
                }
                href={paths.resource + "/" + r.id}
                mediaUrl={(id, media) => `/api/pets/${id}/media/${media}`}
              />
            ))}
          </div>
        ) : (
          <p className="paw-empty">
            No reviewed public contributions match these filters.
          </p>
        )}
        {result.next_cursor && (
          <a className="paw-button" href={"?" + next}>
            Next page
          </a>
        )}
      </>
    );
  } catch {
    body = (
      <p role="status">
        The community board is temporarily unavailable. Please try again
        shortly.
      </p>
    );
  }
  return (
    <Shell paths={paths}>
      <section className="paw-section">
        <h1>{petBrowseLabels[kind] || "Community pets"}</h1>
        {body}
      </section>
    </Shell>
  );
}
