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

  it("includes all 14 publications in the Bay Area network", () => {
    expect(localPublications.length).toBe(14);
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
    expect(slugs).toContain("sanjosewall");
  });

  it("filters listed and community publications correctly", () => {
    expect(listedPublications.length).toBe(14);
    expect(communityPublications.length).toBe(12); // excludes bayareachronicle and the topical title
    expect(communityPublications.some((p) => p.slug === "bayareachronicle")).toBe(false);
    expect(communityPublications.some((p) => p.slug === "lazytensor")).toBe(false);
    expect(communityPublications.some((p) => p.slug === "sfwall")).toBe(true);
    expect(communityPublications.some((p) => p.slug === "sanjosewall")).toBe(true);
    expect(communityPublications.some((p) => p.slug === "napagate")).toBe(true);
    expect(topicalPublications.map((p) => p.slug)).toEqual(["lazytensor"]);
    expect(findPublicationBySlug("lazytensor")?.kind).toBe("topical");
    expect(findPublicationBySlug("lazytensor")?.focus).toBe("AI & Technology");
  });

  it("orders each paper's network menu nearest first between fixed ends", () => {
    const order = (slug: string) => publicationsByProximity(slug).map((p) => p.slug);
    expect(order("concordchronicle")).toEqual([
      "lazytensor", "concordchronicle", "walnutcreektimes", "diablovalleynews", "alamoweekly", "lamorindapost", "danvilletimes",
      "sanramontimes", "eastbaypost", "trivalleyweekly", "sfwall", "sanjosewall", "bayareachronicle", "napagate",
    ]);
    expect(order("sfwall").slice(0, 4)).toEqual(["lazytensor", "sfwall", "eastbaypost", "lamorindapost"]);
    expect(order("sanjosewall").slice(0, 4)).toEqual(["lazytensor", "sanjosewall", "trivalleyweekly", "sanramontimes"]);
    expect(order("sanramontimes").slice(0, 4)).toEqual(["lazytensor", "sanramontimes", "danvilletimes", "alamoweekly"]);
    // Napa Gate's own menu still opens with Lazy Tensor and itself, then its nearest neighbours.
    expect(order("napagate")).toEqual([
      "lazytensor", "napagate", "concordchronicle", "walnutcreektimes", "lamorindapost", "diablovalleynews", "alamoweekly",
      "eastbaypost", "danvilletimes", "sfwall", "sanramontimes", "trivalleyweekly", "sanjosewall", "bayareachronicle",
    ]);
    expect(order("lazytensor")).toEqual([
      "lazytensor", "concordchronicle", "walnutcreektimes", "lamorindapost", "alamoweekly", "danvilletimes", "sanramontimes",
      "diablovalleynews", "trivalleyweekly", "eastbaypost", "sfwall", "sanjosewall", "bayareachronicle", "napagate",
    ]);
    for (const publication of listedPublications) {
      const menu = order(publication.slug);
      expect(menu[0]).toBe("lazytensor");
      expect(menu.indexOf(publication.slug)).toBeLessThanOrEqual(1);
      if (publication.slug !== "napagate") expect(menu.at(-1)).toBe("napagate");
      expect([...menu].sort()).toEqual(listedPublications.map((p) => p.slug).sort());
    }
    expect(order("unknown")[0]).toBe("lazytensor");
    expect(order("unknown").at(-1)).toBe("napagate");
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

  it("builds fixed handoff URLs for all 14 network publications", () => {
    expect(localPublications).toHaveLength(14);
    for (const publication of localPublications) {
      expect(getNetworkReaderHandoffUrl(publication.slug)).toBe(`${publication.url}/api/news/network-handoff`);
    }
    expect(getNetworkReaderHandoffUrl("sanramontimes.evil.test")).toBeNull();
    expect(getNetworkReaderHandoffUrl("https://evil.test")).toBeNull();
  });

  it("identifies network hostnames across all 14 publications", () => {
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
    expect(isNetworkHostname("sanjosewall.com")).toBe(true);
    expect(isNetworkHostname("preview.napsite.com")).toBe(true);

    expect(isNetworkHostname("google.com")).toBe(false);
    expect(isNetworkHostname("facebook.com")).toBe(false);
    expect(isNetworkHostname("nytimes.com")).toBe(false);
  });
});
