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
