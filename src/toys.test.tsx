import { afterEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { ToysSection, ToyRulesContent } from "./toys-view";
import { ToyAccountPage, ToyListingPage, ToyRulesPage, standaloneToyPaths } from "./toys-plugin";
import { PublicationToysSection } from "./toys-publication";
import { formatLocalStart, resolveToyCommunity, toyListingMetadata, type ToyListing } from "./toys";
import type { ToyScope } from "./toys-server";

const scope: ToyScope = {
  apiKey: "isolated-test-key",
  gatewayUrl: "https://platform.example.test",
  origin: "https://paper.example.test",
  collectionSlug: "toyround",
  accessToken: "isolated-test-session",
  clientContext: {},
  writesEnabled: true,
};
const areas = [
  { id: "019a0000-0000-7000-8000-000000000001", slug: "walnut-creek", name: "Walnut Creek" },
  { id: "019a0000-0000-7000-8000-000000000002", slug: "danville", name: "Danville" },
];
const listing: ToyListing = {
  id: "019a0000-0000-7000-8000-00000000aaaa",
  area_id: areas[0].id,
  community: "Walnut Creek",
  exchange_type: "giveaway",
  category: "vehicles",
  age_range: "3-5",
  condition: "good",
  status: "available",
  revision: 2,
  content: {
    title: "Wooden train set",
    description: "Complete set, light wear.",
    brand: "Brio",
    model: "",
    completeness: "complete",
    missing_parts: "",
    age_guidance: "3+",
    warnings: "",
    swap_wishes: "",
    recall_check: { searched_cpsc: true, searched_at: "2026-10-14T10:00:00Z", search_terms: "Brio train", result: "no_match_found", notes: "" },
    attestations: { original_photos: true, damage_disclosed: true, not_excluded: true, not_recalled: true },
  },
  media: [{ id: "019a0000-0000-7000-8000-00000000bbbb", caption: "", status: "PUBLISHED" }],
  owner: { id: "019a0000-0000-7000-8000-00000000cccc", display_name: "Plamen", community: areas[0], member_since: "2026-10", completed_exchanges: 1 },
  exchange_locations_available: false,
};
afterEach(() => vi.unstubAllGlobals());
describe("ToyRound contracts", () => {
  it("resolves the reader's community without geolocation and never beyond coverage", () => {
    expect(resolveToyCommunity(areas, "danville")?.name).toBe("Danville");
    expect(resolveToyCommunity(areas, undefined, areas[0].id)?.name).toBe("Walnut Creek");
    expect(resolveToyCommunity(areas, "")).toBeUndefined();
    expect(resolveToyCommunity(areas, "oakland", undefined, "walnut-creek")?.name).toBe("Walnut Creek");
  });
  it("builds public metadata only from the public projection", () => {
    const meta = toyListingMetadata(listing, "https://toyround.com/toys/" + listing.id);
    expect(meta.title).toContain("Wooden train set");
    expect(meta.alternates?.canonical).toBe("https://toyround.com/toys/" + listing.id);
    expect(toyListingMetadata(null, "https://toyround.com/toys/x").robots).toEqual({ index: false, follow: false });
    expect(toyListingMetadata(listing, "http://insecure.example.test/x").robots).toEqual({ index: false, follow: false });
  });
  it("formats appointment wall-clock times in the place's zone", () => {
    expect(formatLocalStart("2026-10-17T10:30", "America/Los_Angeles")).toBe("Sat, Oct 17, 10:30 AM (Los Angeles time)");
  });
});
describe("shared exchange surface", () => {
  it("renders prominent actions, honest empty state, attribution and no fabricated activity", () => {
    const html = renderToStaticMarkup(
      <ToysSection communities={areas} community={areas[0]} listings={[]} mediaUrl={() => "/api/toys/x/media/y"} submitUrl="/give" accountUrl="/account" locationsUrl="/places" rulesUrl="/rules" locationCount={0} regionLabel="Walnut Creek" />,
    );
    expect(html).toContain("Find a toy");
    expect(html).toContain("Give or swap a toy");
    expect(html).toContain("Pass along");
    expect(html).toContain("Be the first to pass along the play in Walnut Creek");
    expect(html).toContain("No checked meeting places are listed for Walnut Creek yet");
    expect(html).toContain("A community toy exchange by");
    expect(html).toContain("How it works");
    expect(html).not.toMatch(/\d+ neighbors|rated|★/);
  });
  it("marks publication embeds with the Powered by ToyRound attribution", () => {
    const html = renderToStaticMarkup(<ToysSection communities={areas} listings={[listing]} mediaUrl={(l, m) => `/api/toys/${l}/media/${m}`} embedded basePath="/toys" />);
    expect(html).toContain("Powered by ToyRound");
    expect(html).toContain('href="https://toyround.com"');
    expect(html).toContain("Wooden train set");
    expect(html).toContain("Free");
  });
  it("keeps private pages noindex-safe and explains verification honestly", () => {
    const html = renderToStaticMarkup(<ToyRulesContent />);
    expect(html).toContain("not an identity check");
    expect(html).toContain("No home or porch pickups");
    expect(html).toContain("Water beads");
  });
});
describe("native pages", () => {
  it("renders a listing with the owner's recall statement, never a certification", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(null, { status: 503 })));
    const html = renderToStaticMarkup(await ToyListingPage({ scope, listing, signedIn: false, paths: standaloneToyPaths, canonicalOrigin: "https://toyround.com" }));
    expect(html).toContain("the owner&#x27;s statement");
    expect(html).toContain("found no recall");
    expect(html).not.toContain("CPSC approved");
    expect(html).toContain("Sign in to request this toy");
    expect(html).toContain("participant-confirmed");
  });
  it("offers the network sign-in on the account page and never leaks the session", async () => {
    const html = renderToStaticMarkup(await ToyAccountPage({ scope, signedIn: false, paths: standaloneToyPaths }));
    expect(html).toContain("Continue with your network sign-in");
    expect(html).not.toContain("isolated-test-session");
  });
  it("offers a retry when the account service is unavailable", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(null, { status: 503 })));
    const html = renderToStaticMarkup(await ToyAccountPage({ scope, signedIn: true, paths: standaloneToyPaths }));
    expect(html).toContain("Try again");
  });
  it("renders the shared surface for a publication with filters applied", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) =>
        url.includes("/policy")
          ? Response.json({ data: { areas, all_areas: areas, location_counts: { [areas[0].id]: 2 }, submissions_open: true, categories: [], age_ranges: [], conditions: [], exclusions: [], report_reasons: [], cpsc_recalls_url: "", adult_attestation: { version: "v", text: "t" }, listing_days: 60, reservation_days: 5, daytime_window: { start: "08:00", end: "19:00" }, appointment_max_days: 21, submission_policy: { version: "v", text: "t", guidelines: "g" } } })
          : Response.json({ data: { items: [listing], next_cursor: null } }),
      ),
    );
    const html = renderToStaticMarkup(await PublicationToysSection({ scope, query: { community: "walnut-creek", category: "vehicles" }, region: "Walnut Creek", native: true, canonicalOrigin: "https://toyround.com" }));
    expect(html).toContain("Toys in Walnut Creek");
    expect(html).toContain("Wooden train set");
    expect(html).toContain('href="/toys/' + listing.id + '"');
    expect(html).toContain("Powered by ToyRound");
    expect(html).not.toContain("isolated-test-session");
  });
  it("renders the rules page", () => {
    expect(renderToStaticMarkup(<ToyRulesPage paths={standaloneToyPaths} />)).toContain("Prohibited items");
  });
});
