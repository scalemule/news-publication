/** Server rendering adapters. Publications keep their host routing, identity and credentials. */
import React from "react";
import { PetCommunityMemory } from "@scalemule/news-publication/pets-interactions";
import {
  petRequest,
  petAcknowledgments,
  resolvePetReferences,
  type PetScope,
} from "./pets-server";
import {
  resolvePetCommunity,
  type PetCommunity,
  type PetResource,
} from "./pets";
import {
  PetsSection,
  type PetCoverPhoto,
  PetProfileCard,
  LostPetNotice,
  PetCelebrationCard,
  PetEventCard,
  AdoptionListingCard,
  PawOfTheWeekCard,
} from "./pets-view";
export type PetPageQuery = { community?: string; after?: string };
export async function PublicationPetsSection({
  scope,
  query,
  region,
  canonicalOrigin,
  defaultCommunity,
  rememberedCommunity,
  walksUrl,
  native = false,
  cleanCaption = (v) => v,
}: {
  scope: PetScope;
  query: PetPageQuery;
  region: string;
  canonicalOrigin: string;
  defaultCommunity?: string;
  rememberedCommunity?: string;
  walksUrl?: string;
  native?: boolean;
  cleanCaption?: (caption: string) => string;
}) {
  const root = `/v1/knowledge/community-maps/collections/${scope.collectionSlug}`;
  const mediaUrl = (id: string, photo: string) =>
    `/api/pets/${id}/media/${photo}`;
  try {
    const collection = await petRequest<{
      areas: PetCommunity[];
      config?: { presentation?: { cover_photo?: PetCoverPhoto | null } };
    }>(scope, root);
    const home =
      defaultCommunity ||
      collection.areas.find(
        (area) => area.name.toLocaleLowerCase() === region.toLocaleLowerCase(),
      )?.id;
    let remembered = rememberedCommunity,
      signedIn = false;
    if (native && scope.accessToken) {
      try {
        const saved = await petRequest<{
          revision: number;
          preferences: { home_area_id: string | null };
        }>(scope, root + "/pets/preferences");
        remembered =
          saved.preferences.home_area_id ||
          (saved.revision > 0 ? "all" : undefined);
        signedIn = true;
      } catch {
        /* Local browsing remains available during a session or preference outage. */
      }
    }
    const chosen = resolvePetCommunity(
      collection.areas,
      query.community,
      remembered,
      home,
    );
    const filter = new URLSearchParams();
    if (chosen) filter.set("area_id", chosen.id);
    if (query.after) filter.set("after", query.after);
    const date = new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Los_Angeles",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date());
    const monday = new Date(date + "T12:00:00Z");
    monday.setUTCDate(monday.getUTCDate() - ((monday.getUTCDay() + 6) % 7));
    const weekly = new URLSearchParams({
      kind: "spotlight",
      week: monday.toISOString().split("T")[0],
    });
    if (chosen) weekly.set("area_id", chosen.id);
    const [feeds, spotlights, acknowledgments] = await Promise.all([
      Promise.all(
        ["neighbors", "lost_found", "celebration", "adoption"].map((kind) => {
          const q = new URLSearchParams(filter);
          q.set("kind", kind);
          q.set("limit", "6");
          return petRequest<{ items: PetResource[] }>(
            scope,
            root + "/pets?" + q,
          );
        }),
      ),
      petRequest<{ items: PetResource[] }>(scope, root + "/pets?" + weekly),
      petAcknowledgments(scope, chosen?.slug),
    ]);
    const clean = (r: PetResource) => ({
      ...r,
      media: r.media.map((m) => ({
        ...m,
        caption: cleanCaption(m.caption),
        attribution: cleanCaption(m.attribution),
      })),
    });

    const local = chosen ? "?community=" + encodeURIComponent(chosen.slug) : "";
    return (
      <>
        {native && (
          <PetCommunityMemory
            signedIn={signedIn}
            selected={
              query.community === undefined ? undefined : chosen?.id || null
            }
          />
        )}
        <PetsSection
          basePath="/pets"
          coverPhoto={collection.config?.presentation?.cover_photo}
          regionLabel={region}
          resourceBasePath={native ? "/pets" : canonicalOrigin + "/pets"}
          accountUrl={native ? "/pets/account" : undefined}
          communities={collection.areas}
          community={chosen}
          acknowledgments={acknowledgments}
          resources={feeds.flatMap((feed) => feed.items).map(clean)}
          spotlight={spotlights.items[0] && clean(spotlights.items[0])}
          mediaUrl={mediaUrl}
          contributeUrl={
            (native ? "/pets/submit" : canonicalOrigin + "/submit") + local
          }
          placesUrl={canonicalOrigin + "/places" + local}
          walksUrl={walksUrl}
          browseBasePath={native ? "/pets/browse" : canonicalOrigin + "/browse"}
          eventsUrl={
            native ? "/pets/browse/event" : canonicalOrigin + "/events"
          }
        />
      </>
    );
  } catch {
    return (
      <PetsSection
        communities={[]}
        resources={[]}
        mediaUrl={mediaUrl}
        regionLabel={region}
        unavailable
      />
    );
  }
}
export async function PublicationPetReferences({
  scope,
  metadata,
  canonicalOrigin,
  native = false,
  communities,
  cleanCaption = (v) => v,
}: {
  scope: PetScope;
  metadata: unknown;
  canonicalOrigin: string;
  native?: boolean;
  communities?: PetCommunity[];
  cleanCaption?: (value: string) => string;
}) {
  let resources: PetResource[];
  try {
    resources = await resolvePetReferences(scope, metadata);
  } catch {
    return <p>Linked pet resources are temporarily unavailable.</p>;
  }
  if (!resources.length) return null;
  return (
    <section className="paw" aria-label="Related community pet resources">
      {resources.map((resource) => {
        const props = {
          resource: {
            ...resource,
            media: resource.media.map((m) => ({
              ...m,
              caption: cleanCaption(m.caption),
              attribution: cleanCaption(m.attribution),
            })),
          },
          community:
            communities?.find((c) => c.id === resource.area_id)?.name ||
            "Our community",
          href: `${native ? "" : canonicalOrigin}/pets/${resource.id}`,
          mediaUrl: (id: string, photo: string) =>
            `/api/pets/${id}/media/${photo}`,
        };
        const Card =
          resource.kind === "spotlight"
            ? PawOfTheWeekCard
            : resource.kind === "adoption"
              ? AdoptionListingCard
              : resource.kind === "event"
                ? PetEventCard
                : resource.kind === "celebration"
                  ? PetCelebrationCard
                  : ["lost", "found"].includes(resource.kind)
                    ? LostPetNotice
                    : PetProfileCard;
        return <Card {...props} key={resource.id} />;
      })}
    </section>
  );
}

/** Extends the existing publication calendar with reviewed source references. */
export async function PublicationPetEvents({
  scope,
  canonicalOrigin,
  native = false,
  cleanCaption = (value) => value,
}: {
  scope: PetScope;
  canonicalOrigin: string;
  native?: boolean;
  cleanCaption?: (value: string) => string;
}) {
  try {
    const query = new URLSearchParams({
      kind: "event",
      limit: "6",
      starts_after: new Date().toISOString(),
      starts_before: new Date(Date.now() + 7 * 86400000).toISOString(),
    });
    const { items } = await petRequest<{ items: PetResource[] }>(
      scope,
      `/v1/knowledge/community-maps/collections/${scope.collectionSlug}/pets?${query}`,
    );
    if (!items.length) return null;
    return (
      <section className="paw paw-section" aria-label="Pet events this week">
        <h2>This week for pets and their people</h2>
        <div className="paw-gallery">
          {items.map((resource) => (
            <PetEventCard
              key={resource.id}
              resource={{
                ...resource,
                media: resource.media.map((photo) => ({
                  ...photo,
                  caption: cleanCaption(photo.caption),
                  attribution: cleanCaption(photo.attribution),
                })),
              }}
              community="Our community"
              href={`${native ? "" : canonicalOrigin}/pets/${resource.id}`}
              mediaUrl={(id, media) => `/api/pets/${id}/media/${media}`}
            />
          ))}
        </div>
        <a href={native ? "/pets/browse/event" : canonicalOrigin + "/events"}>
          Browse the pet community calendar
        </a>
      </section>
    );
  } catch {
    return <p role="status">Pet event listings are temporarily unavailable.</p>;
  }
}
