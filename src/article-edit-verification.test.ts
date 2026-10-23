import { describe, it, expect } from "vitest";
import { articleEditHtmlMatches } from "./article-edit-verification";
const expected = {
  title: "Boots & Business София 李 📰",
  content_html: "<p>The venue is real.</p><p>Attend on Friday.</p>",
  card_titles: ["Boots to Business", "Conference Center"],
};
const valid =
  '<h1>Boots &amp; Business София 李 📰</h1><main><p>The venue is real.</p><p>Attend on Friday.</p></main><aside class="article-verified-card"><h2>Boots to Business</h2></aside><aside class="article-verified-card"><h2>Conference Center</h2></aside>';
describe("rendered editorial correction verification", () => {
  it("requires the headline, published prose and both real card components", () =>
    expect(articleEditHtmlMatches(valid, expected)).toBe(true));
  it("rejects new content mentioned only in serialized data", () =>
    expect(
      articleEditHtmlMatches(
        "<h1>Old story</h1><script>" + valid + "</script>",
        expected,
      ),
    ).toBe(false));
  it("rejects absent, duplicate or extra cards even when their titles occur in the article body", () => {
    expect(
      articleEditHtmlMatches(
        valid.replace(
          '<aside class="article-verified-card"><h2>Conference Center</h2></aside>',
          "<p>Conference Center</p>",
        ),
        expected,
      ),
    ).toBe(false);
    expect(
      articleEditHtmlMatches(
        valid +
          '<aside class="article-verified-card"><h2>Old wrong venue</h2></aside>',
        expected,
      ),
    ).toBe(false);
  });
  it("rejects stale paragraphs and accepts explicitly no cards", () => {
    expect(
      articleEditHtmlMatches(
        valid.replace("Attend on Friday.", "Old prose."),
        expected,
      ),
    ).toBe(false);
    expect(
      articleEditHtmlMatches(valid.replace(/<aside[\s\S]*$/u, ""), {
        ...expected,
        card_titles: [],
      }),
    ).toBe(true);
  });
  it("keeps literal headline text and checks duplicate card titles as a multiset", () => {
    expect(
      articleEditHtmlMatches(
        valid.replace(
          "Boots &amp; Business София 李 📰",
          "A &lt;B&gt; &amp;amp; C",
        ),
        { ...expected, title: "A <B> &amp; C" },
      ),
    ).toBe(true);
    expect(
      articleEditHtmlMatches(valid, {
        ...expected,
        card_titles: ["Boots to Business", "Boots to Business"],
      }),
    ).toBe(false);
  });
});

it("requires visible canonical tag links rather than serialized tag data", () => {
  const expected = { title: "Community news", content_html: "<p>Reported facts.</p>", card_titles: [], tags: [{ name: "Sherry Hu", slug: "sherry-hu" }] };
  const body = "<h1>Community news</h1><p>Reported facts.</p>";
  expect(articleEditHtmlMatches(body + '<script>{"name":"Sherry Hu"}</script>', expected)).toBe(false);
  expect(articleEditHtmlMatches(body + '<a href="/news?tag=sherry-hu">Sherry Hu</a>', expected)).toBe(true);
  expect(articleEditHtmlMatches(body + '<a href="/news?tag=other">Sherry Hu</a>', expected)).toBe(false);
});

describe("the papers' entity cards and the search title", () => {
  // Markup copied from sanramontimes.com on 2026-10-23: the paper renders verified cards as
  // <aside data-entity-card="venue">, not the package's article-verified-card class.
  const paperCard = `<section class="MThonG_footerSection" aria-label="Venue and directory information"><div><p class="MThonG_sectionHeading">About the Venue</p><aside id="san-ramon-council-bella-village-oct2026" data-entity-card="venue" class="MThonG_card  MThonG_venueCard" aria-label="LOCAL VENUE · DIRECTORY: San Ramon City Hall — Public Safety &amp; Housing Actions"><div class="MThonG_header"><p class="MThonG_kicker">LOCAL VENUE · DIRECTORY</p></div><h2 class="MThonG_title">San Ramon City Hall — Public Safety &amp; Housing Actions</h2><dl class="MThonG_factGrid"><div class="MThonG_factRow"><dt class="MThonG_factLabel">Public Safety Contract</dt><dd class="MThonG_factValue">10-year, $4.1 million agreement</dd></div></dl></aside></div></section>`;
  const page = (title: string) => `<html><head><title>${title}</title></head><body><h1>San Ramon approves $4.1m police technology upgrade</h1><p>Body paragraph one. София 李</p>${paperCard}</body></html>`;
  const expected = { title: "San Ramon City Council Approves $4.1 Million Police Technology Upgrade", headline: "San Ramon approves $4.1m police technology upgrade", content_html: "<p>Body paragraph one. София 李</p>", card_titles: ["San Ramon City Hall — Public Safety & Housing Actions"] };
  it("recognises a paper's data-entity-card aside by its h2", () => {
    expect(articleEditHtmlMatches(page("Anything"), expected)).toBe(true);
    expect(articleEditHtmlMatches(page("Anything"), { ...expected, card_titles: ["A card the page does not show"] })).toBe(false);
    expect(articleEditHtmlMatches(page("Anything").replace(' data-entity-card="venue"', ""), expected)).toBe(false);
  });
  it("checks the document title only when the edit carried a search title, allowing the site's suffix", () => {
    const seo = "San Ramon police technology upgrade and Bella Village housing approved";
    expect(articleEditHtmlMatches(page("Stale title"), { ...expected, seo_title: seo })).toBe(false);
    expect(articleEditHtmlMatches(page(seo), { ...expected, seo_title: seo })).toBe(true);
    expect(articleEditHtmlMatches(page(seo + " · San Ramon Times"), { ...expected, seo_title: seo })).toBe(true);
    expect(articleEditHtmlMatches(page("Stale title"), { ...expected, seo_title: null })).toBe(true);
  });
});
