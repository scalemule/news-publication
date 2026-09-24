import { describe, expect, it } from "vitest";
import {
  localPublications,
  listedPublications,
  communityPublications,
  findPublicationBySlug,
  findPublicationByHost,
  getNetworkPublicationUrl,
} from "./network";

describe("publication network", () => {
  it("includes all 11 publications in the Bay Area network", () => {
    expect(localPublications.length).toBe(11);
    const slugs = localPublications.map((p) => p.slug);
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
  });

  it("filters listed and community publications correctly", () => {
    expect(listedPublications.length).toBe(10); // napagate is unlisted
    expect(communityPublications.length).toBe(9); // excludes bayareachronicle
    expect(communityPublications.some((p) => p.slug === "bayareachronicle")).toBe(false);
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
});
