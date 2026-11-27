import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import {
  petListing,
  petListingDay,
  petListingName,
  petListingPhone,
  petListingPhoto,
  petListingStreet,
  selectPetListings,
  type PetListingRecord,
} from "./pets-listings";
import { PetListingCard, PetListingSection } from "./pets-listings-view";
import { forgetPetListings, petListings, petListingsOrNone, type PetScope } from "./pets-server";
import { PetBrowsePage } from "./pets-plugin";

const now = new Date("2026-11-27T16:00:00Z");
const record = (fields: Record<string, string>, id = "01a21b03-0fdc-72bd-9116-585f9c0c6e9d"): PetListingRecord => ({
  knowledge_entity_id: id,
  fields: Object.entries(fields).map(([predicate, value]) => ({ predicate, value: { value } })),
});
const held = {
  notice_kind: "FOUND",
  custody_status: "IN_SHELTER_STRAY_HOLD",
  species: "Dog",
  pet_given_name: "Cannellini",
  breed: "Pomeranian mix",
  sex: "Male",
  community_area_slug: "us-ca-san-mateo",
  location_lost_or_found: "San Mateo County",
  event_date: "Nov 21, 2026",
  shelter_name: "Peninsula Humane Society & SPCA",
  shelter_phone: "+16503407022",
  reclaim_or_contact_url: "https://24petconnect.com/PHSStrayPets/Details/PNSL/A1000431",
  photo_id: "01a21b03-0fdc-72bd-9116-585f9c0c6e9d",
  verified_at: "2026-11-26T19:15:00Z",
  served_publications: "halfmoonbaynews, sfwall, bayareachronicle",
  description: "My name is Cannellini. Call 650-555-0100 or write someone@example.test. Chip 985112345678901.",
};
const owner = {
  ...held,
  notice_kind: "LOST",
  custody_status: "OWNER_REPORTED_LOST",
  pet_given_name: "Жучка",
  community_area_slug: "us-ca-pittsburg",
  location_lost_or_found: "2000 villa dr pittsburg ca Pittsburg, CA",
  event_date: "2026-11-18",
  served_publications: "diablovalleynews, concordchronicle",
  description: "Call me on 925-555-0100. Улица Ленина 5, 東京 🐕",
};
const adoptable = {
  availability_status: "AVAILABLE",
  display_name: "Harley",
  species: "Dog",
  breed: "American Staffordshire Terrier",
  sex: "Female",
  age_group: "Young",
  size: "Medium",
  shelter_name: "Joybound People & Pets (Walnut Creek)",
  community_area_slug: "us-ca-walnut-creek",
  adoption_url: "https://adopt.adopets.com/pet/147e0ef4",
  photo_id: "01a21ad6-d8d1-75a8-9cce-d88c7e398799",
  verified_at: "2026-11-26T18:30:00Z",
  served_publications: "walnutcreektimes,lamorindapost",
  adoption_fee: "See adoption page",
  description: "Call 925-555-0199 to meet Harley.",
};

describe("a dataset record as a listing", () => {
  it("shows a shelter hold with the shelter's own line and no free text", () => {
    const listing = petListing("lost_found", record(held))!;
    expect(listing).toMatchObject({
      kind: "found",
      custody: "shelter",
      title: "Cannellini",
      facts: "Pomeranian mix · Male",
      areaName: "San Mateo",
      day: "2026-11-21",
      shelterPhone: "+16503407022",
      publications: ["halfmoonbaynews", "sfwall", "bayareachronicle"],
    });
    expect(listing.lastSeen).toBeUndefined();
    const html = renderToStaticMarkup(<PetListingCard listing={listing} now={now} />);
    expect(html).toContain("Found · at the shelter · San Mateo");
    expect(html).toContain("Came in Nov 21.");
    expect(html).toContain('href="tel:+16503407022"');
    expect(html).toContain("(650) 340-7022");
    expect(html).toContain("Checked Nov 26.");
    expect(html).toContain("/v1/photos/public/01a21b03-0fdc-72bd-9116-585f9c0c6e9d/transform?width=480&amp;format=webp");
    for (const secret of ["650-555-0100", "someone@example.test", "985112345678901", "My name is"])
      expect(html).not.toContain(secret);
  });
  it("shows an owner's report without a house number, a phone number or the description", () => {
    const listing = petListing("lost_found", record(owner))!;
    expect(listing).toMatchObject({ kind: "lost", custody: "owner", title: "Жучка", day: "2026-11-18" });
    expect(listing.lastSeen).toBe("villa dr pittsburg ca Pittsburg, CA");
    expect(listing.shelterPhone).toBeUndefined();
    const html = renderToStaticMarkup(<PetListingCard listing={listing} now={now} />);
    expect(html).toContain("Lost Nov 18 near villa dr pittsburg ca Pittsburg, CA.");
    expect(html).toContain("Reported by the pet’s owner on 24PetConnect; not checked by us.");
    for (const secret of ["2000", "925-555-0100", "tel:", "Ленина", "東京"]) expect(html).not.toContain(secret);
  });
  it("leaves out or repairs records that are wrong", () => {
    // An animal already up for adoption is not a lost-and-found notice.
    expect(petListing("lost_found", record({ ...held, event_date: "I am available for adoption! Call the shelter." }))).toBeNull();
    // A paragraph where the date should be: the notice stays, with no date.
    expect(petListing("lost_found", record({ ...held, event_date: "My name is Unknown and I would like to go home." }))!.day).toBeUndefined();
    // A stray a shelter holds is a found animal, whatever the record says.
    expect(petListing("lost_found", record({ ...held, notice_kind: "LOST" }))!.kind).toBe("found");
    expect(petListing("lost_found", record({ ...held, pet_given_name: "Unknown" }))!.title).toBe("Found dog");
    expect(petListing("lost_found", record({ ...held, custody_status: "SOMETHING_NEW" }))).toBeNull();
    expect(petListing("lost_found", record({ ...held, verified_at: "yesterday" }))).toBeNull();
    expect(petListing("lost_found", record({ ...held, reclaim_or_contact_url: "http://plain.example.test/x" }))!.url).toBeUndefined();
    expect(petListing("lost_found", { knowledge_entity_id: "x" })).toBeNull();
  });
  it("reads dates, names, streets, phones and pictures strictly", () => {
    expect(petListingDay("Nov 24 2026")).toBe("2026-11-24");
    expect(petListingDay("Feb 30, 2026")).toBeUndefined();
    expect(petListingDay("2026-13-01")).toBeUndefined();
    expect(petListingDay("next week")).toBeUndefined();
    expect(petListingName("Feral-181909")).toBeUndefined();
    expect(petListingName("J")).toBeUndefined();
    expect(petListingName("Bambi and I am described as a male")).toBe("Bambi");
    expect(petListingName("小白 🐶")).toBe("小白 🐶");
    expect(petListingName("🐶".repeat(31))).toBeUndefined();
    expect(petListingStreet("3600 Block Sierra Ridge Ave")).toBe("Sierra Ridge Ave");
    expect(petListingStreet("100 block of Main St")).toBe("Main St");
    expect(petListingStreet("63rd and Adeline, Oakland, CA")).toBe("63rd and Adeline, Oakland, CA");
    expect(petListingStreet("Улица 5 Ленина 🐕")).toBe("Улица 5 Ленина 🐕");
    expect(petListingPhone("+1 (925) 555-0142")).toBe("(925) 555-0142");
    expect(petListingPhone("+442079460000")).toBe("+442079460000");
    expect(petListingPhoto("../../evil", 480)).toBeUndefined();
  });
  it("shows an adoptable pet with the shelter's page and nothing else to contact", () => {
    const listing = petListing("adoption", record(adoptable, "a1"))!;
    expect(listing).toMatchObject({
      kind: "adoption",
      title: "Harley",
      facts: "American Staffordshire Terrier · Female · Young · Medium",
      areaName: "Walnut Creek",
      url: "https://adopt.adopets.com/pet/147e0ef4",
    });
    const html = renderToStaticMarkup(<PetListingCard listing={listing} now={now} />);
    expect(html).toContain("Looking for a home · Walnut Creek");
    expect(html).toContain("See Harley at the shelter");
    expect(html).not.toContain("925-555-0199");
    expect(html).not.toContain("tel:");
    expect(petListing("adoption", record({ ...adoptable, availability_status: "ADOPTED" }))).toBeNull();
  });
});

describe("the listings a page shows", () => {
  const all = [
    petListing("lost_found", record(held, "b"))!,
    petListing("lost_found", record(owner, "c"))!,
    petListing("lost_found", record({ ...held, event_date: "no date here", species: "Cat" }, "a"))!,
  ];
  it("puts the newest notice first and one without a date last", () => {
    expect(selectPetListings(all, { now }).map((l) => l.id)).toEqual(["b", "c", "a"]);
  });
  it("filters by paper, town, species and notice", () => {
    expect(selectPetListings(all, { now, publication: "ConcordChronicle" }).map((l) => l.id)).toEqual(["c"]);
    expect(selectPetListings(all, { now, areaSlug: "us-ca-san-mateo" }).map((l) => l.id)).toEqual(["b", "a"]);
    expect(selectPetListings(all, { now, species: " cats " }).map((l) => l.id)).toEqual(["a"]);
    expect(selectPetListings(all, { now, notice: "lost" }).map((l) => l.id)).toEqual(["c"]);
    expect(selectPetListings(all, { now, notice: "anything" })).toHaveLength(3);
  });
  it("shows a pet its owner reported twice only once, and never merges shelter animals", () => {
    const twice = [...all, petListing("lost_found", record(owner, "d"))!, petListing("lost_found", record(held, "e"))!];
    expect(selectPetListings(twice, { now }).map((l) => l.id).sort()).toEqual(["a", "b", "c", "e"]);
  });
  it("stops showing a listing nobody has checked for two weeks", () => {
    expect(selectPetListings(all, { now: new Date("2026-12-09T00:00:00Z") })).toHaveLength(3);
    expect(selectPetListings(all, { now: new Date("2026-12-11T00:00:00Z") })).toHaveLength(0);
  });
  it("pages a long list and renders nothing for an empty one", () => {
    const many = Array.from({ length: 30 }, (_, i) => petListing("adoption", record(adoptable, "id" + String(i).padStart(2, "0")))!);
    const html = renderToStaticMarkup(
      <PetListingSection listings={many} heading="Waiting" limit={24} page={2} pageHref={(n) => "?listings=" + n} now={now} />,
    );
    expect(html.match(/<article/g)).toHaveLength(6);
    expect(html).toContain("Page 2 of 2");
    expect(html).toContain('href="?listings=1"');
    expect(renderToStaticMarkup(<PetListingSection listings={[]} heading="Waiting" />)).toBe("");
  });
});

describe("reading the datasets", () => {
  const scope: PetScope = {
    apiKey: "isolated-test-key",
    gatewayUrl: "https://platform.example.test",
    origin: "https://paper.example.test",
    collectionSlug: "pet-community",
    accessToken: "isolated-test-session",
    clientContext: { ip: "203.0.113.9" },
  };
  const page = (items: PetListingRecord[], next: string | null) =>
    new Response(JSON.stringify({ success: true, data: { items, next_cursor: next } }), { status: 200 });
  beforeEach(() => forgetPetListings());
  afterEach(() => vi.unstubAllGlobals());

  it("reads every page once, without the reader's session, and keeps the list for ten minutes", async () => {
    const fetcher = vi.fn(async (url: string | URL | Request) =>
      String(url).includes("after=next") ? page([record(owner, "c")], null) : page([record(held, "b")], "next"),
    ) as unknown as typeof fetch;
    let clock = 1_000_000;
    const options = { fetcher, now: () => clock };
    expect((await petListings(scope, "lost_found", options)).map((l) => l.id)).toEqual(["b", "c"]);
    expect(fetcher).toHaveBeenCalledTimes(2);
    const [url, init] = vi.mocked(fetcher).mock.calls[0];
    expect(String(url)).toBe("https://platform.example.test/v1/knowledge/datasets/us.ca.pets.lost_found/search?entity_type=BUSINESS&limit=100");
    const sent = JSON.stringify(init?.headers);
    expect(sent).toContain("isolated-test-key");
    expect(sent).not.toContain("isolated-test-session");
    expect(sent).not.toContain("203.0.113.9");
    clock += 9 * 60 * 1000;
    await petListings(scope, "lost_found", options);
    expect(fetcher).toHaveBeenCalledTimes(2);
    clock += 2 * 60 * 1000;
    await petListings(scope, "lost_found", options);
    expect(fetcher).toHaveBeenCalledTimes(4);
  });
  it("serves the last list when the platform cannot be reached, and nothing when there is none", async () => {
    let fail = false;
    const fetcher = vi.fn(async () => (fail ? new Response(null, { status: 503 }) : page([record(held, "b")], null))) as unknown as typeof fetch;
    let clock = 1_000_000;
    const options = { fetcher, now: () => clock };
    expect(await petListings(scope, "lost_found", options)).toHaveLength(1);
    fail = true;
    clock += 11 * 60 * 1000;
    expect(await petListings(scope, "lost_found", options)).toHaveLength(1);
    forgetPetListings();
    await expect(petListings(scope, "lost_found", options)).rejects.toThrow();
    expect(await petListingsOrNone(scope, "lost_found", options)).toEqual([]);
  });
  it("puts a paper's shelter notices on its lost and found page, above what neighbors shared", async () => {
    vi.useFakeTimers({ now, toFake: ["Date"] });
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) =>
        url.includes("/datasets/")
          ? page([record(held, "b"), record(owner, "c")], null)
          : url.includes("/pets?")
            ? new Response(JSON.stringify({ data: { items: [], next_cursor: null } }))
            : new Response(JSON.stringify({ data: { areas: [], submission_policy: { version: "1", text: "", guidelines: "" } } })),
      ),
    );
    try {
      const html = renderToStaticMarkup(
        await PetBrowsePage({ scope, kind: "lost_found", query: {}, publication: "concordchronicle" }),
      );
      expect(html).toContain("At the shelters, and reported nearby");
      expect(html).toContain("Жучка");
      expect(html).not.toContain("Cannellini");
      expect(html).toContain("Shared by neighbors");
      expect(html).not.toContain("isolated-test-session");
      const celebration = renderToStaticMarkup(await PetBrowsePage({ scope, kind: "celebration", query: {} }));
      expect(celebration).not.toContain("At the shelters");
    } finally {
      vi.useRealTimers();
    }
  });
});
