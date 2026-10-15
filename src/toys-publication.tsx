/** Server rendering adapter for the shared exchange surface (toyround.com and every /toys). */
import React from "react";
import { ToyCommunityMemory } from "@scalemule/news-publication/toys-interactions";
import { toyCollectionRequest, type ToyScope } from "./toys-server";
import { resolveToyCommunity, type ToyListing, type ToyPolicy } from "./toys";
import { ToysSection } from "./toys-view";
import { publicationToyPaths, standaloneToyPaths, toyMediaUrl, type ToyPluginPaths } from "./toys-plugin";

export type ToyPageQuery = Record<string, string | undefined>;
const FILTERS = ["category", "age_range", "condition", "exchange_type", "availability", "q", "after"] as const;
export async function PublicationToysSection({
  scope,
  query,
  region,
  defaultCommunity,
  rememberedCommunity,
  native = false,
  signedIn = false,
  paths,
  canonicalOrigin,
}: {
  scope: ToyScope;
  query: ToyPageQuery;
  region: string;
  defaultCommunity?: string;
  rememberedCommunity?: string;
  native?: boolean;
  signedIn?: boolean;
  paths?: ToyPluginPaths;
  canonicalOrigin: string;
}) {
  const p = paths || (native ? publicationToyPaths : standaloneToyPaths);
  const anonymous = { ...scope, accessToken: undefined };
  const mediaUrl = toyMediaUrl(p.api);
  try {
    const policy = await toyCollectionRequest<ToyPolicy>(anonymous, "/policy");
    const home = defaultCommunity || policy.areas.find((a) => a.name.toLocaleLowerCase() === region.toLocaleLowerCase())?.id;
    const chosen = resolveToyCommunity(policy.areas, query.community, rememberedCommunity, home);
    const filter = new URLSearchParams();
    if (chosen) filter.set("area_id", chosen.id);
    for (const key of FILTERS) if (query[key]) filter.set(key, query[key]!);
    filter.set("limit", "24");
    const result = await toyCollectionRequest<{ items: ToyListing[]; next_cursor: string | null }>(anonymous, "?" + filter);
    const next = new URLSearchParams(Object.entries(query).filter((e): e is [string, string] => typeof e[1] === "string"));
    if (result.next_cursor) next.set("after", result.next_cursor);
    const filters = Object.fromEntries(FILTERS.map((k) => [k, query[k]]));
    return (
      <>
        <ToyCommunityMemory selected={query.community === undefined ? undefined : chosen?.id || null} communityPath={p.community} />
        <ToysSection
          communities={policy.areas}
          community={chosen}
          listings={result.items}
          basePath={p.home}
          listingBasePath={native ? p.listing : canonicalOrigin + "/toys"}
          browsePath={p.home}
          mediaUrl={mediaUrl}
          submitUrl={native ? p.submit + (chosen ? "?community=" + encodeURIComponent(chosen.slug) : "") : canonicalOrigin + standaloneToyPaths.submit + (chosen ? "?community=" + encodeURIComponent(chosen.slug) : "")}
          accountUrl={native ? p.account : canonicalOrigin + standaloneToyPaths.account}
          locationsUrl={native ? p.locations + (chosen ? "?community=" + encodeURIComponent(chosen.slug) : "") : canonicalOrigin + standaloneToyPaths.locations}
          rulesUrl={native ? p.rules : canonicalOrigin + standaloneToyPaths.rules}
          regionLabel={region}
          nextUrl={result.next_cursor ? p.home + "?" + next : undefined}
          submissionsOpen={policy.submissions_open && scope.writesEnabled !== false}
          locationCount={chosen ? policy.location_counts[chosen.id] || 0 : undefined}
          filters={filters}
          embedded={native}
          signedIn={signedIn}
        />
      </>
    );
  } catch {
    return <ToysSection communities={[]} listings={[]} mediaUrl={mediaUrl} regionLabel={region} basePath={p.home} unavailable embedded={native} />;
  }
}
