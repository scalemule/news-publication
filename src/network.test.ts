import { describe, expect, it } from "vitest";
import {
  localPublications,
  listedPublications,
  communityPublications,
  topicalPublications,
  publicationsByProximity,
  findPublicationBySlug,
  findPublicationByHost,
  getNetworkPublicationUrl,
  getNetworkReaderHandoffUrl,
  isNetworkHostname,
  NETWORK_PARENT,
} from "./network";

describe("publication network", () => {
  it("defines the parent institutional network entity", () => {
    expect(NETWORK_PARENT.name).toBe("Bay Area News Network");
    expect(NETWORK_PARENT.url).toBe("https://bayareanewsnetwork.com");
    expect(NETWORK_PARENT.brandSlogan).toBe("Bringing communities closer.");
    expect(NETWORK_PARENT.publicationSlogan).toBe("Local stories. Stronger communities.");
    expect(NETWORK_PARENT.principles.length).toBe(6);
  });

  it("includes all 13 publications in the Bay Area network", () => {
    expect(localPublications.length).toBe(13);
    const slugs = localPublications.map((p) => p.slug);
    expect(slugs[0]).toBe("lazytensor"); // the technology title opens the network bar
    expect(slugs).toContain("bayareachronicle");
    expect(slugs).toContain("walnutcreektimes");
    expect(slugs).toContain("danvilletimes");
    expect(slugs).toContain("sanramontimes");
    expect(slugs).toContain("alamoweekly");
    expect(slugs).toContain("diablovalleynews");
    expect(slugs).toContain("trivalleyweekly");
    expect(slugs).toContain("concordchronicle");
    expect(slugs).toContain("lamorindapost");
    expect(slugs).toContain("eastbaypost");
    expect(slugs).toContain("napagate");
    expect(slugs).toContain("sfwall");
  });

  it("filters listed and community publications correctly", () => {
    expect(listedPublications.length).toBe(13);
    expect(communityPublications.length).toBe(11); // excludes bayareachronicle and the topical title
    expect(communityPublications.some((p) => p.slug === "bayareachronicle")).toBe(false);
    expect(communityPublications.some((p) => p.slug === "lazytensor")).toBe(false);
    expect(communityPublications.some((p) => p.slug === "sfwall")).toBe(true);
    expect(communityPublications.some((p) => p.slug === "napagate")).toBe(true);
    expect(topicalPublications.map((p) => p.slug)).toEqual(["lazytensor"]);
    expect(findPublicationBySlug("lazytensor")?.kind).toBe("topical");
    expect(findPublicationBySlug("lazytensor")?.focus).toBe("AI & Technology");
  });

  it("orders each paper's network menu nearest first", () => {
    const order = (slug: string) => publicationsByProximity(slug).map((p) => p.slug);
    expect(order("concordchronicle")).toEqual([
      "concordchronicle", "walnutcreektimes", "diablovalleynews", "alamoweekly", "lamorindapost", "danvilletimes",
      "sanramontimes", "eastbaypost", "trivalleyweekly", "sfwall", "napagate", "lazytensor", "bayareachronicle",
    ]);
    expect(order("sfwall").slice(0, 4)).toEqual(["sfwall", "eastbaypost", "lamorindapost", "alamoweekly"]);
    expect(order("napagate").slice(0, 2)).toEqual(["napagate", "concordchronicle"]);
    expect(order("sanramontimes").slice(0, 3)).toEqual(["sanramontimes", "danvilletimes", "alamoweekly"]);
    // Region-wide and topical titles keep directory order at the end, and open with themselves.
    expect(order("lazytensor")).toEqual(["lazytensor", ...listedPublications.filter((p) => p.center).map((p) => p.slug), "bayareachronicle"]);
    for (const publication of listedPublications) {
      const menu = order(publication.slug);
      expect(menu[0]).toBe(publication.slug);
      expect([...menu].sort()).toEqual(listedPublications.map((p) => p.slug).sort());
    }
    expect(order("unknown")).toEqual([
      ...listedPublications.filter((p) => p.center).map((p) => p.slug),
      ...listedPublications.filter((p) => !p.center).map((p) => p.slug),
    ]);
    expect(communityPublications.every((p) => p.center)).toBe(true);
  });

  it("finds publications by slug", () => {
    const bac = findPublicationBySlug("bayareachronicle");
    expect(bac?.name).toBe("Bay Area Chronicle");
    expect(bac?.url).toBe("https://bayareachronicle.com");

    const wct = findPublicationBySlug("walnutcreektimes");
    expect(wct?.name).toBe("Walnut Creek Times");
  });

  it("finds publications by hostname", () => {
    const danville = findPublicationByHost("danvilletimes.com");
    expect(danville?.slug).toBe("danvilletimes");

    const preview = findPublicationByHost("danvilletimes.napsite.com");
    expect(preview?.slug).toBe("danvilletimes");
  });

  it("decorates network URLs for cross-domain navigation", () => {
    const url = getNetworkPublicationUrl("alamoweekly");
    expect(url).toBeTruthy();
    expect(url).toContain("https://alamoweekly.com/");
  });

  it("builds fixed handoff URLs for all 13 network publications", () => {
    expect(localPublications).toHaveLength(13);
    for (const publication of localPublications) {
      expect(getNetworkReaderHandoffUrl(publication.slug)).toBe(`${publication.url}/api/news/network-handoff`);
    }
    expect(getNetworkReaderHandoffUrl("sanramontimes.evil.test")).toBeNull();
    expect(getNetworkReaderHandoffUrl("https://evil.test")).toBeNull();
  });

  it("identifies network hostnames across all 13 publications", () => {
    expect(isNetworkHostname("lazytensor.com")).toBe(true);
    expect(isNetworkHostname("www.lazytensor.com")).toBe(true);
    expect(isNetworkHostname("bayareachronicle.com")).toBe(true);
    expect(isNetworkHostname("www.bayareachronicle.com")).toBe(true);
    expect(isNetworkHostname("concordchronicle.com")).toBe(true);
    expect(isNetworkHostname("walnutcreektimes.com")).toBe(true);
    expect(isNetworkHostname("lamorindapost.com")).toBe(true);
    expect(isNetworkHostname("alamoweekly.com")).toBe(true);
    expect(isNetworkHostname("danvilletimes.com")).toBe(true);
    expect(isNetworkHostname("sanramontimes.com")).toBe(true);
    expect(isNetworkHostname("diablovalleynews.com")).toBe(true);
    expect(isNetworkHostname("trivalleyweekly.com")).toBe(true);
    expect(isNetworkHostname("eastbaypost.com")).toBe(true);
    expect(isNetworkHostname("napagate.com")).toBe(true);
    expect(isNetworkHostname("sfwall.com")).toBe(true);
    expect(isNetworkHostname("preview.napsite.com")).toBe(true);

    expect(isNetworkHostname("google.com")).toBe(false);
    expect(isNetworkHostname("facebook.com")).toBe(false);
    expect(isNetworkHostname("nytimes.com")).toBe(false);
  });
});
