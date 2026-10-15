/** ToyRound public contracts. Identity, appointments and threads are never article data. */
export const TOY_BRAND = {
  name: "ToyRound",
  tagline: "Pass along the play.",
  attribution: "A community toy exchange by Bay Area News Network.",
  poweredBy: "Powered by ToyRound",
  publicationLabel: "Toy Swap",
  origin: "https://toyround.com",
  networkUrl: "https://bayareanewsnetwork.com",
} as const;
export const TOY_UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export const TOY_SLUG = /^[a-z0-9][a-z0-9-]{0,190}$/;
export type ToyCommunity = { id: string; slug: string; name: string };
export type ToyOption = { key: string; label: string };
export const TOY_EXCHANGE_TYPES: readonly ToyOption[] = [
  { key: "giveaway", label: "Free giveaway" },
  { key: "swap", label: "Direct swap" },
];
export const TOY_CATEGORIES: readonly ToyOption[] = [
  { key: "building", label: "Building & construction" },
  { key: "puzzles", label: "Puzzles" },
  { key: "games", label: "Board & card games" },
  { key: "dolls_figures", label: "Dolls & action figures" },
  { key: "vehicles", label: "Vehicles & trains" },
  { key: "outdoor", label: "Outdoor & active play" },
  { key: "arts_crafts", label: "Arts & crafts" },
  { key: "pretend_play", label: "Pretend play & play sets" },
  { key: "stem_learning", label: "STEM & learning" },
  { key: "plush", label: "Plush & soft toys" },
  { key: "books_media", label: "Books & media" },
  { key: "baby_toddler", label: "Baby & toddler toys" },
  { key: "musical", label: "Musical toys" },
  { key: "other", label: "Other toys" },
];
export const TOY_AGE_RANGES: readonly ToyOption[] = [
  { key: "0-12m", label: "0–12 months" },
  { key: "1-2", label: "1–2 years" },
  { key: "3-5", label: "3–5 years" },
  { key: "6-8", label: "6–8 years" },
  { key: "9-12", label: "9–12 years" },
  { key: "13+", label: "13 and up" },
  { key: "unknown", label: "Not stated on the item" },
];
export const TOY_CONDITIONS: readonly ToyOption[] = [
  { key: "like_new", label: "Like new" },
  { key: "good", label: "Good — normal wear" },
  { key: "fair", label: "Fair — visible wear, works" },
];
export const TOY_EXCLUSIONS: readonly ToyOption[] = [
  { key: "car_seats", label: "Car seats and booster seats" },
  { key: "cribs_sleep", label: "Cribs, bassinets and infant sleep equipment" },
  { key: "helmets", label: "Helmets and protective gear" },
  { key: "weapons", label: "Weapons, replica weapons and hard-tipped projectile toys" },
  { key: "water_beads", label: "Water beads" },
  { key: "magnets", label: "Loose high-powered magnets and magnet sets" },
  { key: "recalled", label: "Anything subject to a CPSC recall" },
  { key: "broken", label: "Visibly unsafe, broken or sharp-edged items" },
  { key: "batteries", label: "Items with loose button or coin batteries" },
];
export const TOY_REPORT_REASONS: readonly ToyOption[] = [
  { key: "recalled_or_unsafe", label: "Recalled or unsafe item" },
  { key: "child_safety", label: "Child safety concern" },
  { key: "harassment", label: "Harassment or threats" },
  { key: "scam_or_payment", label: "Asked for money, deposits or codes" },
  { key: "prohibited_item", label: "Prohibited item" },
  { key: "inappropriate_photo", label: "Inappropriate photo" },
  { key: "no_show", label: "No-show" },
  { key: "misleading_listing", label: "Misleading listing" },
  { key: "spam", label: "Spam" },
  { key: "other", label: "Something else" },
];
export const TOY_CPSC_RECALLS_URL = "https://www.cpsc.gov/Recalls";
export const TOY_STATUS_LABELS: Record<string, string> = {
  draft: "Draft",
  pending_review: "Waiting for review",
  available: "Available",
  reserved: "Reserved",
  completed: "Completed",
  rejected: "Needs changes",
  withdrawn: "Withdrawn",
  expired: "Expired",
  suspended: "Suspended for safety review",
};
export const TOY_REQUEST_STATUS_LABELS: Record<string, string> = {
  pending: "Waiting for the owner",
  accepted: "Accepted — arrange a meeting",
  declined: "Declined",
  cancelled: "Cancelled",
  completed: "Completed",
  expired: "Expired",
};
export const TOY_SAFETY = {
  summary:
    "Public places and account verification reduce risk but do not guarantee safety. ToyRound is not supervised and no one is on call.",
  verification:
    "“Phone verified” and “email verified” mean a working contact method was confirmed. They are not an identity check, a background check or a statement that someone is trustworthy.",
  meeting:
    "Meet only at a listed public place during the day, keep arrangements in this thread, and bring someone along if you like. Never share your home address.",
  money:
    "ToyRound never involves payments, deposits, shipping fees or verification codes. Anyone asking for them is breaking the rules — report them.",
  recall:
    "A member's recall check is their own statement after searching the CPSC database. It is not a safety certification, and ToyRound never labels an item recall-free or certified.",
  children:
    "Do not share children's names, photos, schools or schedules. Manufacturer age guidance is reported as printed; ToyRound never decides what is safe for a particular child.",
} as const;
export const TOY_HOW_IT_WORKS: readonly { title: string; detail: string }[] = [
  { title: "List a toy", detail: "Real photos, honest condition, a quick CPSC recall search. Editors review every listing before it appears." },
  { title: "Agree on an exchange", detail: "Neighbors ask for the toy or propose a swap. You decide, and the toy is reserved for one person at a time." },
  { title: "Meet in public", detail: "Pick a listed public place and a daytime slot that both of you confirm. No home or porch pickups." },
  { title: "Pass along the play", detail: "Both of you mark the exchange complete. Private feedback helps keep the exchange friendly." },
];
export type ToyRecallCheck = {
  searched_cpsc: boolean;
  searched_at?: string | null;
  search_terms: string;
  result: "no_match_found" | "unsure" | "not_checked" | "possible_match" | "";
  notes: string;
};
export type ToyAttestations = {
  original_photos: boolean;
  damage_disclosed: boolean;
  not_excluded: boolean;
  not_recalled: boolean;
};
export type ToyContent = {
  title: string;
  description: string;
  brand: string;
  model: string;
  completeness: "complete" | "missing_parts" | "unknown";
  missing_parts: string;
  age_guidance: string;
  warnings: string;
  swap_wishes: string;
  recall_check: ToyRecallCheck;
  attestations: ToyAttestations;
};
export type ToyPhoto = { id: string; caption: string; status: string };
export type ToyOwner = {
  id: string;
  display_name: string;
  community: ToyCommunity | null;
  member_since: string;
  completed_exchanges: number;
  completed_exchanges_note?: string;
};
export type ToyListing = {
  id: string;
  area_id: string;
  community?: string | null;
  exchange_type: "giveaway" | "swap";
  category: string;
  age_range: string;
  condition: string;
  status: string;
  revision: number;
  content: ToyContent;
  media: ToyPhoto[];
  published_at?: string | null;
  owner: ToyOwner | null;
  exchange_locations_available?: boolean;
};
export type OwnToyListing = ToyListing & {
  review_note: string;
  suspension: { reason?: string; note?: string } | null;
  reserved_until?: string | null;
  reserved_request_id?: string | null;
  expires_at?: string | null;
  open_requests?: number;
};
export type ToyVerification = {
  adult_attested: boolean;
  email_verified: boolean;
  phone_verified: boolean;
  ready: boolean;
  meaning: string;
};
export type ToyMember = ToyOwner & {
  verification: ToyVerification;
  status: string;
  suspended_until?: string | null;
  appeal_status: string;
  appeal_note: string;
  moderation_note: string;
  revision: number;
  communities: ToyCommunity[];
  adult_attestation: { version: string; text: string };
  submissions_open: boolean;
};
export type ToyLocation = {
  id: string;
  area_id: string;
  kind: "official_exchange_zone" | "participating_business" | "public_place";
  status: string;
  name: string;
  address: string;
  map_url: string;
  timezone: string;
  source_url: string;
  last_checked_on?: string | null;
  check_expires_on?: string | null;
  hours: Record<string, [string, string][]>;
  restrictions: string;
  verified_facts: Record<string, { text: string; source_url?: string | null; checked_on?: string | null }>;
  hosting_partnership: boolean;
  partnership_note: string;
  daytime_window?: { start: string; end: string };
};
export type ToyAppointment = {
  id: string;
  status: string;
  revision: number;
  starts_at: string;
  local_start: string;
  timezone: string;
  proposed_by: "owner" | "requester";
  owner_confirmed: boolean;
  requester_confirmed: boolean;
  location: Pick<ToyLocation, "id" | "name" | "address" | "map_url" | "kind" | "restrictions">;
};
export type ToyMessage = {
  id: string;
  sender: "owner" | "requester" | "system";
  mine?: boolean;
  body: string;
  warnings: string[];
  created_at: string;
};
export type ToyListingSummary = {
  id: string;
  status: string;
  exchange_type: string;
  category: string;
  age_range: string;
  condition: string;
  area_id: string;
  title: string;
  photo_id: string | null;
};
export type ToyRequest = {
  id: string;
  role: "owner" | "requester";
  kind: "request" | "swap_offer";
  status: string;
  revision: number;
  created_at: string;
  accepted_at?: string | null;
  closed_at?: string | null;
  close_reason: string;
  owner_completed: boolean;
  requester_completed: boolean;
  last_message_at?: string | null;
  listing: ToyListingSummary;
  offered_listing: ToyListingSummary | null;
  counterpart: ToyOwner | null;
  counterpart_deleted: boolean;
  blocked: boolean;
  appointment: ToyAppointment | null;
};
export type ToyThread = ToyRequest & {
  messages: ToyMessage[];
  my_feedback: string | null;
  locations: ToyLocation[];
  safety: string;
};
export type ToyPolicy = {
  categories: ToyOption[];
  age_ranges: ToyOption[];
  conditions: ToyOption[];
  exclusions: ToyOption[];
  report_reasons: string[];
  cpsc_recalls_url: string;
  adult_attestation: { version: string; text: string };
  listing_days: number;
  reservation_days: number;
  daytime_window: { start: string; end: string };
  appointment_max_days: number;
  submission_policy: { version: string; text: string; guidelines: string };
  areas: ToyCommunity[];
  all_areas: ToyCommunity[];
  location_counts: Record<string, number>;
  submissions_open: boolean;
};
export function toyOptionLabel(options: readonly ToyOption[], key: string): string {
  return options.find((o) => o.key === key)?.label || key;
}
/** Selection is constrained to server-resolved coverage. No geolocation required. */
export function resolveToyCommunity(
  areas: readonly ToyCommunity[],
  selected?: string | null,
  preference?: string | null,
  publicationDefault?: string | null,
): ToyCommunity | undefined {
  if (selected === "" || (selected === undefined && preference === "all")) return undefined;
  for (const candidate of [selected, preference, publicationDefault]) {
    const found = areas.find((area) => area.id === candidate || area.slug === candidate);
    if (found) return found;
  }
  return undefined;
}
export function safeToyLink(raw: string | undefined | null): string | undefined {
  if (!raw) return undefined;
  if (raw.startsWith("/") && !raw.startsWith("//") && !/[\\\r\n]/.test(raw)) return raw;
  try {
    const url = new URL(raw);
    return url.protocol === "https:" && !url.username && !url.password ? url.href : undefined;
  } catch {
    return undefined;
  }
}
/** Public metadata is generated only from the public projection. */
export function toyListingMetadata(listing: ToyListing | null, canonicalUrl: string, photoUrl?: string) {
  const canonical = safeToyLink(canonicalUrl);
  if (!listing || !canonical?.startsWith("https://"))
    return { title: "Listing unavailable", robots: { index: false, follow: false } };
  const title = `${listing.content.title} — ${listing.exchange_type === "swap" ? "swap" : "free"} on ToyRound`;
  const description = Array.from(listing.content.description).slice(0, 180).join("");
  return {
    title,
    description,
    alternates: { canonical },
    openGraph: {
      title,
      description,
      url: canonical,
      ...(photoUrl && safeToyLink(photoUrl) ? { images: [{ url: photoUrl, alt: listing.content.title }] } : {}),
    },
  };
}
/** Local display of an appointment's wall-clock time. Never converts away from the place's zone. */
export function formatLocalStart(localStart: string, timezone: string): string {
  const [date, time] = localStart.split("T");
  if (!date || !time) return localStart;
  try {
    const day = new Date(date + "T12:00:00Z").toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      timeZone: "UTC",
    });
    const [h, m] = time.split(":").map(Number);
    const hour12 = ((h + 11) % 12) + 1;
    const zone = timezone.split("/").pop()?.replaceAll("_", " ") || timezone;
    return `${day}, ${hour12}:${String(m).padStart(2, "0")} ${h >= 12 ? "PM" : "AM"} (${zone} time)`;
  } catch {
    return localStart;
  }
}
export const TOY_DAY_LABELS: Record<string, string> = {
  mon: "Mon",
  tue: "Tue",
  wed: "Wed",
  thu: "Thu",
  fri: "Fri",
  sat: "Sat",
  sun: "Sun",
};
export function hoursSummary(hours: ToyLocation["hours"]): string {
  return Object.entries(hours)
    .map(([day, ranges]) => `${TOY_DAY_LABELS[day] || day} ${ranges.map(([o, c]) => `${o}–${c}`).join(", ")}`)
    .join(" · ");
}
