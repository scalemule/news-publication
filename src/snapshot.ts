import { definePublication } from "./config";
import type { NewsPublication, PublicationInput } from "./types";

/**
 * Serializable application config. Code hooks (`matchTag`, `coupons.resolve`)
 * stay in the site and are attached after the snapshot loads.
 */
export type PublicationRecord = Omit<PublicationInput, "matchTag" | "coupons"> & {
  coupons?: Omit<NonNullable<PublicationInput["coupons"]>, "resolve">;
};

/** Last config the application accepted. Age never invalidates it. */
export type PublicationSnapshot = {
  version: 1;
  syncedAt: string;
  record: PublicationRecord;
};

export type SnapshotHooks = {
  matchTag?: PublicationInput["matchTag"];
  resolveCoupon?: NonNullable<PublicationInput["coupons"]>["resolve"];
};

export type SyncSource = "fresh" | "retained";

export type SyncedPublication = {
  publication: NewsPublication;
  snapshot: PublicationSnapshot;
  source: SyncSource;
  /** How long this snapshot has been the one on disk. Zero for a fresh sync. */
  ageMs: number;
};

const SNAPSHOT_VERSION = 1;

export function publicationRecord(publication: NewsPublication): PublicationRecord {
  return {
    slug: publication.slug,
    name: publication.name,
    masthead: publication.masthead,
    region: publication.region,
    regionLabel: publication.regionLabel,
    towns: publication.towns,
    nearbyTowns: publication.nearbyTowns,
    sections: publication.sections,
    description: publication.description,
    tagline: publication.tagline,
    briefTitle: publication.briefTitle,
    parent: publication.parent,
    layout: publication.layout,
    layouts: publication.layouts,
    features: publication.features,
    theme: publication.theme,
    referrals: publication.referrals,
    coupons: { enabled: publication.coupons.enabled, offers: publication.coupons.offers },
    modules: publication.modules,
  };
}

export function snapshotFromRecord(record: PublicationRecord, syncedAt = new Date().toISOString()): PublicationSnapshot {
  const publication = definePublication(record);
  return { version: SNAPSHOT_VERSION, syncedAt, record: publicationRecord(publication) };
}

export function parseSnapshot(raw: string): PublicationSnapshot | null {
  try {
    return acceptSnapshot(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function acceptSnapshot(value: unknown): PublicationSnapshot | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const snapshot = value as Partial<PublicationSnapshot>;
  if (snapshot.version !== SNAPSHOT_VERSION || typeof snapshot.syncedAt !== "string") return null;
  if (!Number.isFinite(Date.parse(snapshot.syncedAt))) return null;
  try {
    return snapshotFromRecord(snapshot.record as PublicationRecord, snapshot.syncedAt);
  } catch {
    return null;
  }
}

/** A remote payload replaces the snapshot only when it is a complete record for this paper. */
export function acceptRemoteRecord(value: unknown, expectedSlug?: string): PublicationRecord | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const body = value as { record?: unknown; publication?: unknown };
  const candidate = body.record ?? body.publication ?? value;
  try {
    const publication = definePublication(candidate as PublicationRecord);
    if (expectedSlug && publication.slug !== expectedSlug) return null;
    return publicationRecord(publication);
  } catch {
    return null;
  }
}

export function publicationFromSnapshot(snapshot: PublicationSnapshot, hooks: SnapshotHooks = {}): NewsPublication {
  return definePublication({
    ...snapshot.record,
    matchTag: hooks.matchTag,
    coupons: { ...snapshot.record.coupons, resolve: hooks.resolveCoupon },
  });
}

/**
 * Fetch the application config. Any failure, timeout, or malformed body keeps
 * the previous snapshot. Nothing here expires a snapshot because the API was
 * unreachable for hours or days.
 */
export async function syncPublication(input: {
  previous: PublicationSnapshot | null;
  fetchRecord: () => Promise<unknown>;
  expectedSlug?: string;
  now?: number;
  hooks?: SnapshotHooks;
}): Promise<SyncedPublication> {
  const now = input.now ?? Date.now();
  try {
    const remote = acceptRemoteRecord(await input.fetchRecord(), input.expectedSlug);
    if (remote) {
      const snapshot = snapshotFromRecord(remote, new Date(now).toISOString());
      return { publication: publicationFromSnapshot(snapshot, input.hooks), snapshot, source: "fresh", ageMs: 0 };
    }
  } catch {
    // The last synced file is the paper until a later sync succeeds.
  }
  if (!input.previous) {
    throw new Error("This paper has no synced publication config");
  }
  const ageMs = Math.max(0, now - Date.parse(input.previous.syncedAt));
  return {
    publication: publicationFromSnapshot(input.previous, input.hooks),
    snapshot: input.previous,
    source: "retained",
    ageMs,
  };
}


