/** Shelter listings: lost-and-found notices and adoptable pets.
 *
 * Both are published datasets on the platform, the way the papers' local
 * business directory is: a paper or bayareapaw.com shows them as its own
 * pages, with no reader byline, and every card links to the shelter's or the
 * notice's own page. This file is pure: it turns a dataset record into what a
 * page may show. The records are other people's typing, so nothing is taken
 * on trust: a notice's free text is never shown (it carries phone numbers and
 * house addresses); a short field is shown only when it holds no long number,
 * "@" or "#"; a house or apartment number is never shown with where a pet was
 * last seen; the only phone number is a shelter's own line, and only when it
 * is one plain number; a listing nobody has checked for two weeks is left out. */

/** The datasets, by the browse page they fill. A host may name its own. */
export const PET_LISTING_DATASETS = {
  lost_found: "us.ca.pets.lost_found",
  adoption: "us.ca.pets.adoptable",
} as const;
export type PetListingKind = keyof typeof PET_LISTING_DATASETS;
export const isPetListingKind = (kind: string): kind is PetListingKind =>
  Object.hasOwn(PET_LISTING_DATASETS, kind);

/** A listing nobody has checked for this long is no longer shown. */
export const PET_LISTING_FRESH_MS = 14 * 24 * 3600 * 1000;

export type PetListingRecord = {
  knowledge_entity_id: string;
  fields?: ({ predicate: string; value?: { value?: unknown } | null } | null)[] | null;
};

export type PetListing = {
  id: string;
  kind: "lost" | "found" | "adoption";
  /** Who has the animal or made the notice (lost and found only). */
  custody?: "shelter" | "owner" | "finder";
  title: string;
  /** The title is the pet's name from the record (not "Found dog"). */
  named: boolean;
  species: string;
  /** "Pomeranian mix · Male". */
  facts: string;
  areaSlug?: string;
  areaName?: string;
  /** For a report: the street or crossing, with no house number. */
  lastSeen?: string;
  /** The day in the notice, YYYY-MM-DD, when the record has a real date. */
  day?: string;
  shelterName?: string;
  /** The shelter's own public line; never a number from a notice's text. */
  shelterPhone?: string;
  url?: string;
  photoId?: string;
  /** When the listing was last checked against its source. */
  checkedAt: string;
  /** The papers whose area the listing is in. */
  publications: string[];
};

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
const pad = (n: number) => String(n).padStart(2, "0");

function fields(record: PetListingRecord) {
  const out = new Map<string, string>();
  for (const field of Array.isArray(record.fields) ? record.fields : []) {
    if (!field || typeof field.predicate !== "string") continue;
    const raw = field.value?.value;
    const text = typeof raw === "string" ? raw.trim() : typeof raw === "number" ? String(raw) : "";
    if (text) out.set(field.predicate, text);
  }
  return out;
}
/** A short field that can be shown as typed: no long number (a phone, a
 * house, a chip), no "@" or "#", and not a paragraph. */
function plain(text: string | undefined, max: number) {
  return text && Array.from(text).length <= max && !/[@#]|\d{3,}/.test(text) ? text : undefined;
}
function https(raw?: string) {
  if (!raw) return undefined;
  try {
    const url = new URL(raw);
    return url.protocol === "https:" && !url.username && !url.password ? url.href : undefined;
  } catch {
    return undefined;
  }
}
function known(text: string | undefined, max = 60) {
  const value = plain(text, max);
  return value && !["unknown", "n/a", "see adoption page"].includes(value.toLowerCase()) ? value : undefined;
}
function instant(text?: string) {
  const time = text ? Date.parse(text) : NaN;
  return Number.isFinite(time) ? new Date(time).toISOString() : undefined;
}

/** "us-ca-walnut-creek" → "Walnut Creek". */
export function petListingArea(slug?: string) {
  if (!slug || !/^us-ca-[a-z0-9-]+$/.test(slug)) return undefined;
  return slug
    .slice("us-ca-".length)
    .split("-")
    .filter(Boolean)
    .map((word) => word[0].toUpperCase() + word.slice(1))
    .join(" ");
}

/** The day in a notice: "2026-11-21", "Nov 21, 2026" or "Nov 21 2026".
 * Anything else (some records carry a paragraph here) is no date. */
export function petListingDay(text?: string) {
  if (!text) return undefined;
  let year: number, month: number, day: number;
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  const worded = /^([A-Za-z]{3}) (\d{1,2}),? (\d{4})$/.exec(text);
  if (iso) [year, month, day] = [Number(iso[1]), Number(iso[2]), Number(iso[3])];
  else if (worded) [year, month, day] = [Number(worded[3]), MONTHS.indexOf(worded[1].toLowerCase()) + 1, Number(worded[2])];
  else return undefined;
  const date = new Date(Date.UTC(year, month - 1, day));
  return month >= 1 && date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
    ? `${year}-${pad(month)}-${pad(day)}`
    : undefined;
}

/** "Nov 21", with the year when it is not this year. */
export function petListingDayText(day: string, now = new Date()) {
  const date = new Date(day.length === 10 ? day + "T12:00:00Z" : day);
  const zone = day.length === 10 ? "UTC" : "America/Los_Angeles";
  const year = (d: Date) => new Intl.DateTimeFormat("en-US", { timeZone: zone, year: "numeric" }).format(d);
  return new Intl.DateTimeFormat("en-US", {
    timeZone: zone,
    month: "short",
    day: "numeric",
    ...(year(date) === year(now) ? {} : { year: "numeric" }),
  }).format(date);
}

/** Where a pet was last seen, without a house number: "2000 Villa Dr" →
 * "Villa Dr", "2000-B Villa Dr" → "Villa Dr". A street's own number stays
 * ("63rd and Adeline"). When a number is still there afterwards (an apartment,
 * a number in the middle, a phone), nothing is shown at all. */
export function petListingStreet(text: string): string | undefined {
  const words = text.split(/\s+/).filter(Boolean);
  if (words[0] && /^#?\d+(-?[A-Za-z])?,?$/.test(words[0])) {
    words.shift();
    if (words[0]?.toLowerCase() === "block") words.shift();
    if (words[0]?.toLowerCase() === "of") words.shift();
  }
  // A ZIP code after the state says nothing private.
  const street = words.join(" ").replace(/\b(CA|California)\.?,?\s+\d{5}(-\d{4})?(?=$|[\s,.])/gi, "$1");
  return street.split(/\s+/).some((word) => /^\d+[,.]?$/.test(word)) ? undefined : plain(street, 70);
}

/** The name a notice gives, when it is one. Some records carry "Unknown", a
 * shelter's code, or a name with the next sentence stuck to it. */
export function petListingName(text?: string) {
  if (!text) return undefined;
  const name = text.split(" and I am")[0].trim();
  const length = Array.from(name).length;
  const lower = name.toLowerCase();
  return length < 2 || length > 30 || lower === "unknown" || lower.startsWith("feral") || /[#@\d]/.test(name)
    ? undefined
    : name;
}

/** A small or large copy of a listing's picture. */
export function petListingPhoto(photoId: string | undefined, width: number, gateway = "https://api.scalemule.com") {
  return photoId && /^[0-9a-f-]{8,64}$/i.test(photoId)
    ? `${gateway}/v1/photos/public/${photoId}/transform?width=${width}&format=webp`
    : undefined;
}

/** A shelter's line when the field holds exactly one plain US number, as
 * "+16503407022"; anything else in the field ("… or Jane 925…") is not shown. */
export function petListingShelterLine(text?: string) {
  const us = /^\+?1?[\s.-]*\(?(\d{3})\)?[\s.-]*(\d{3})[\s.-]*(\d{4})$/.exec(text || "");
  return us ? `+1${us[1]}${us[2]}${us[3]}` : undefined;
}
/** "+16503407022" → "(650) 340-7022". */
export function petListingPhone(phone: string) {
  const us = /^\+1(\d{3})(\d{3})(\d{4})$/.exec(phone);
  return us ? `(${us[1]}) ${us[2]}-${us[3]}` : phone;
}

function served(text?: string) {
  return (text || "")
    .split(",")
    .map((slug) => slug.trim().toLowerCase())
    .filter(Boolean);
}

function lostFound(record: PetListingRecord): PetListing | null {
  const f = fields(record);
  const notice = f.get("notice_kind")?.toLowerCase();
  const species = plain(f.get("species"), 30);
  const checkedAt = instant(f.get("verified_at"));
  if ((notice !== "lost" && notice !== "found") || !species || !checkedAt) return null;
  // A few records in the stray lists are animals already up for adoption.
  if (`${f.get("description") || ""} ${f.get("event_date") || ""}`.toLowerCase().includes("available for adoption"))
    return null;
  const custody = (
    { IN_SHELTER_STRAY_HOLD: "shelter", OWNER_REPORTED_LOST: "owner", PUBLIC_REPORTED_FOUND: "finder" } as const
  )[f.get("custody_status") || ""];
  if (!custody) return null;
  // A stray a shelter holds is a found animal, whatever the record says.
  const kind = custody === "shelter" ? "found" : notice;
  const sex = f.get("sex");
  const areaSlug = f.get("community_area_slug");
  const place = f.get("location_lost_or_found");
  const name = petListingName(f.get("pet_given_name"));
  return {
    id: record.knowledge_entity_id,
    kind,
    custody,
    title: name || `${kind === "lost" ? "Lost" : "Found"} ${species.toLowerCase()}`,
    named: Boolean(name),
    species,
    facts: [known(f.get("breed")), sex && /^(male|female)$/i.test(sex) ? sex[0].toUpperCase() + sex.slice(1).toLowerCase() : undefined]
      .filter(Boolean)
      .join(" · "),
    areaSlug,
    areaName: petListingArea(areaSlug),
    lastSeen: custody !== "shelter" && place ? petListingStreet(place) : undefined,
    day: petListingDay(f.get("event_date")),
    shelterName: plain(f.get("shelter_name"), 90),
    shelterPhone: custody === "shelter" ? petListingShelterLine(f.get("shelter_phone")) : undefined,
    url: https(f.get("reclaim_or_contact_url")),
    photoId: f.get("photo_id"),
    checkedAt,
    publications: served(f.get("served_publications")),
  };
}

function adoptable(record: PetListingRecord): PetListing | null {
  const f = fields(record);
  // A listing with no usable name is a shelter's banner, not a pet.
  const name = petListingName(f.get("display_name"));
  const species = plain(f.get("species"), 30);
  const shelterName = plain(f.get("shelter_name"), 90);
  const checkedAt = instant(f.get("verified_at"));
  if (f.get("availability_status") !== "AVAILABLE" || !name || !species || !shelterName || !checkedAt) return null;
  const areaSlug = f.get("community_area_slug");
  return {
    id: record.knowledge_entity_id,
    kind: "adoption",
    title: name,
    named: true,
    species,
    facts: [known(f.get("breed")), known(f.get("sex"), 20), known(f.get("age_group"), 30), known(f.get("size"), 30)]
      .filter(Boolean)
      .join(" · "),
    areaSlug,
    areaName: petListingArea(areaSlug),
    shelterName,
    url: https(f.get("adoption_url")),
    photoId: f.get("photo_id"),
    checkedAt,
    publications: served(f.get("served_publications")),
  };
}

/** One dataset record as a listing, or null when it cannot be shown truthfully. */
export function petListing(kind: PetListingKind, record: PetListingRecord): PetListing | null {
  if (!record || typeof record !== "object" || typeof record.knowledge_entity_id !== "string") return null;
  try {
    return kind === "lost_found" ? lostFound(record) : adoptable(record);
  } catch {
    return null; // one broken record never costs the page the whole list
  }
}

export type PetListingFilter = {
  /** A paper's name in the datasets ("walnutcreektimes"); omit for the whole Bay Area. */
  publication?: string;
  /** A town a reader chose ("us-ca-martinez"). */
  areaSlug?: string;
  species?: string;
  /** "lost" or "found" on the lost-and-found board. */
  notice?: string;
  now?: Date;
};

/** The listings a page shows, in the order it shows them: fresh ones only;
 * notices newest first (one with no readable date goes last); adoptable pets
 * mixed, the same every time, so one shelter does not fill the first page.
 * A pet reported twice the same day is shown once. */
export function selectPetListings(listings: readonly PetListing[], filter: PetListingFilter = {}) {
  const now = (filter.now || new Date()).getTime();
  const publication = filter.publication?.toLowerCase();
  const species = filter.species?.trim().toLowerCase();
  const day = 24 * 3600 * 1000;
  const shown = listings.filter(
    (l) =>
      now - Date.parse(l.checkedAt) <= PET_LISTING_FRESH_MS &&
      // A check dated in the future is a broken record, not a fresh one.
      now - Date.parse(l.checkedAt) >= -day &&
      (!publication || l.publications.includes(publication)) &&
      (!filter.areaSlug || l.areaSlug === filter.areaSlug) &&
      (!species || l.species.toLowerCase() === species || l.species.toLowerCase() + "s" === species) &&
      ((filter.notice !== "lost" && filter.notice !== "found") || l.kind === filter.notice),
  );
  const mixed = (id: string) => Array.from(id).reverse().join("");
  // An owner often reports the same pet to two agencies: show it once. Only
  // a named pet with a dated notice is matched, so two unnamed animals in one
  // town are never taken for the same one.
  const reported = new Set<string>();
  const once = shown.filter((l) => {
    if ((l.custody !== "owner" && l.custody !== "finder") || !l.named || !l.day) return true;
    const same = [l.custody, l.title, l.species, l.facts, l.day, l.areaSlug].join("\n").toLowerCase();
    return reported.has(same) ? false : (reported.add(same), true);
  });
  return once.sort((a, b) =>
    a.kind === "adoption" || b.kind === "adoption"
      ? mixed(a.id).localeCompare(mixed(b.id))
      : (b.day || "").localeCompare(a.day || "") || b.id.localeCompare(a.id),
  );
}
