/** Public community pet contracts. Identity and editorial records never belong in article data. */
export const PET_KINDS = [
  "profile",
  "spotlight",
  "photo",
  "celebration",
  "lost",
  "found",
  "adoption",
  "event",
] as const;
export type PetKind = (typeof PET_KINDS)[number];
export type PetCommunity = { id: string; slug: string; name: string };
export type PetContent = {
  name: string;
  species: string;
  story: string;
  breed: string;
  age_description?: string;
  birthday?: string | null;
  adoption_anniversary?: string | null;
  personality: string;
  activities: string[];
  public_place_id?: string | null;
  category: string;
  attribution: string;
  date?: string | null;
  source?: {
    organization: string;
    official_url: string;
    verified_at?: string | null;
    availability_confirmed: boolean;
  } | null;
  event?: {
    starts_at: string;
    ends_at: string;
    event_type: string;
    cost: "free" | "paid" | "unknown";
    cost_verified: boolean;
  } | null;
};
export type PetPhoto = {
  id: string;
  caption: string;
  attribution: string;
  status: string;
};
export type PetResource = {
  id: string;
  kind: PetKind;
  area_id: string;
  revision: number;
  content: PetContent;
  media: PetPhoto[];
  expires_at?: string | null;
  reunited_at?: string | null;
  /** "shelter_record": a card made from a shelter's or a public board's own list. */
  origin?: string | null;
  /** The town the record itself names. `area_id` only says which paper it is local to. */
  locality?: string | null;
  listing?: {
    custody?: "shelter_hold" | "owner_report" | "finder_report" | "public_report" | null;
    named?: boolean;
    happened_on?: string | null;
    place?: string | null;
    shelter?: string | null;
    shelter_phone?: string | null;
    checked_at?: string | null;
  } | null;
};
/** Who a card is from: a neighbor shared it, a person posted a notice, or a shelter listed it. */
export function petCredit(resource: PetResource): string | null {
  const who = resource.content.attribution?.trim();
  if (!who) return null;
  if (resource.origin !== "shelter_record") return `Shared by ${who}`;
  const custody = resource.listing?.custody;
  return custody && custody !== "shelter_hold"
    ? `Posted by ${who}`
    : `From ${who}`;
}
/** The heading of a pet's own page. */
export function petHeadline(resource: PetResource): string {
  const c = resource.content;
  if (c.category === "memorial") return `Remembering ${c.name}.`;
  if (resource.kind === "lost" || resource.kind === "found") {
    // An unnamed notice is already called "Found cat".
    if (resource.listing?.named === false) return `${c.name}.`;
    return `${resource.kind === "lost" ? "Lost" : "Found"}: ${c.name}.`;
  }
  return `Meet ${c.name}.`;
}
/** A shelter's own line, for a link and for reading: "+19256088400" → "(925) 608-8400". */
export function shelterPhone(
  resource: PetResource,
): { href: string; text: string } | null {
  const line = resource.listing?.shelter_phone;
  const digits = /^\+1(\d{3})(\d{3})(\d{4})$/.exec(line || "");
  if (!line || !digits) return null;
  return {
    href: `tel:${line}`,
    text: `(${digits[1]}) ${digits[2]}-${digits[3]}`,
  };
}
/** The town printed on a card: the record's own town, or else the view's community. */
export function petPlace(resource: PetResource, community: string): string {
  return resource.locality?.trim() || community;
}
export type OwnPetResource = PetResource & {
  visibility: "public" | "private";
  status:
    | "draft"
    | "submitted"
    | "reviewing"
    | "changes_requested"
    | "approved"
    | "published"
    | "rejected"
    | "removed";
  review_note: string;
  profile_id?: string | null;
};
export type PetPreferences = {
  home_area_id: string | null;
  followed_area_ids: string[];
  categories: string[];
  email_enabled: boolean;
  frequency: "immediate" | "daily" | "weekly" | null;
};
export type PetPreferenceRecord = {
  revision: number;
  preferences: PetPreferences;
};
export const PET_NOTIFICATION_CATEGORIES = [
  ["lost_found", "Lost & found"],
  ["walks", "Paw Walks"],
  ["adoption_events", "Adoption events"],
  ["celebrations", "Pet celebrations"],
  ["spotlight", "Paw of the Week"],
  ["community", "Community information"],
] as const;
export type PetReference = {
  collection_slug: string;
  id: string;
  kind: PetKind;
};
export const PET_PHOTO_CATEGORIES = [
  ["cute", "Cute pets"],
  ["funny", "Funny moments"],
  ["adventures", "Adventures"],
  ["senior", "Senior pets"],
  ["rescue", "Rescue stories"],
  ["young", "Puppies & kittens"],
  ["unusual", "Unusual pets"],
  ["friends", "Best friends"],
  ["holiday", "Holiday pets"],
] as const;
export const PET_CELEBRATIONS = [
  ["birthday", "Pet birthday"],
  ["adoption_anniversary", "Adoption anniversary"],
  ["welcome_home", "Welcome home"],
  ["rescue_story", "Rescue story"],
  ["happy_reunion", "Happy reunion"],
  ["memorial", "Memorial tribute"],
] as const;
export const PET_SAFETY = {
  recovery:
    "Bay Area Paw does not independently verify pet ownership. A report is a contributor’s account. Never send money or verification codes to someone claiming to have found a pet. Keep microchip numbers and ownership evidence private.",
  walks:
    "Walks are independently organized. Bay Area Paw does not supervise meetups or guarantee participants’ safety. Meet in a public place, follow leash rules and respect other people and animals.",
  adoption:
    "Contact the named shelter or rescue for current availability, eligibility and adoption arrangements. Bay Area Paw is not the adoption agency and does not collect adoption payments.",
  wellness:
    "Wellness information is educational. Contact a veterinarian for advice about your pet.",
} as const;
export const PET_UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export const PET_SLUG = /^[a-z0-9][a-z0-9-]{0,190}$/;

export function petReferences(metadata: unknown): PetReference[] {
  const entries =
    metadata && typeof metadata === "object"
      ? (metadata as Record<string, unknown>).pet_resources
      : null;
  if (!Array.isArray(entries)) return [];
  return entries.slice(0, 12).flatMap((v: unknown) => {
    if (!v || typeof v !== "object") return [];
    const r = v as Record<string, unknown>;
    return typeof r.collection_slug === "string" &&
      PET_SLUG.test(r.collection_slug) &&
      typeof r.id === "string" &&
      PET_UUID.test(r.id) &&
      PET_KINDS.includes(r.kind as PetKind)
      ? [
          {
            collection_slug: r.collection_slug,
            id: r.id,
            kind: r.kind as PetKind,
          },
        ]
      : [];
  });
}
/** Selection is constrained to server-resolved publication coverage. No geolocation required. */
export function resolvePetCommunity(
  areas: readonly PetCommunity[],
  selected?: string | null,
  preference?: string | null,
  publicationDefault?: string | null,
): PetCommunity | undefined {
  if (selected === "" || (selected === undefined && preference === "all")) return undefined;
  for (const candidate of [selected, preference, publicationDefault]) {
    const found = areas.find(
      (area) => area.id === candidate || area.slug === candidate,
    );
    if (found) return found;
  }
  return undefined; // "All communities" preserves regional coverage, including Tri-Valley.
}
export function safePetLink(raw: string): string | undefined {
  if (raw.startsWith("/") && !raw.startsWith("//") && !/[\\\r\n]/.test(raw))
    return raw;
  try {
    const url = new URL(raw);
    return url.protocol === "https:" && !url.username && !url.password
      ? url.href
      : undefined;
  } catch {
    return undefined;
  }
}
export function adoptionAvailability(
  source: PetContent["source"],
  now = Date.now(),
): "confirmed" | "check_with_organization" {
  const at = source?.verified_at ? Date.parse(source.verified_at) : NaN;
  return source?.availability_confirmed &&
    Number.isFinite(at) &&
    at <= now &&
    now - at <= 86400000
    ? "confirmed"
    : "check_with_organization";
}
export function petProfileMetadata(
  resource: PetResource | null,
  canonicalUrl: string,
  photoUrl?: string,
) {
  const canonical = safePetLink(canonicalUrl);
  if (!resource || !canonical?.startsWith("https://"))
    return {
      title: "Pet profile unavailable",
      robots: { index: false, follow: false },
    };
  return {
    title: `Meet ${resource.content.name}`,
    description: Array.from(resource.content.story).slice(0, 180).join(""),
    alternates: { canonical },
    openGraph: {
      title: `Meet ${resource.content.name}`,
      description: resource.content.story,
      url: canonical,
      ...(photoUrl && safePetLink(photoUrl)
        ? { images: [{ url: photoUrl, alt: resource.content.name }] }
        : {}),
    },
  };
}

export type PawWalkDetails = {
  duration_minutes: number;
  distance_km?: number;
  leash: "required" | "venue_rules";
  size_guidance: string;
  accessibility: string;
};
/** Added to the existing Meet model; booking, participants, cancellation and rooms remain Meet-owned. */
export function preparePawWalk(value: Partial<PawWalkDetails>): PawWalkDetails {
  if (
    !Number.isInteger(value.duration_minutes) ||
    value.duration_minutes! < 10 ||
    value.duration_minutes! > 240
  )
    throw new Error("Choose a walk duration from 10 to 240 minutes.");
  if (
    value.distance_km !== undefined &&
    (!Number.isFinite(value.distance_km) ||
      value.distance_km < 0 ||
      value.distance_km > 30)
  )
    throw new Error("Choose a walking distance from 0 to 30 km.");
  if (value.leash !== "required" && value.leash !== "venue_rules")
    throw new Error("Choose the leash requirements.");
  for (const field of [value.size_guidance, value.accessibility])
    if (typeof field !== "string" || Array.from(field).length > 500)
      throw new Error("Keep walk guidance within 500 characters.");
  return {
    duration_minutes: value.duration_minutes!,
    distance_km: value.distance_km,
    leash: value.leash,
    size_guidance: value.size_guidance!,
    accessibility: value.accessibility!,
  };
}
