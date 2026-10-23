import { describe, expect, it } from "vitest";
import { FLY_TITLE_MAX_CHARS, HEADLINE_MAX_CHARS, headlineLength, headlineProblems, headlineSet } from "./headline";
import { displayHeadline } from "./editorial";

const base = { slug: "s", title: "San Ramon Police Department Deploys Enhanced Traffic Safety Patrols Along Bollinger Canyon Corridor", section: "Civic life", excerpt: null };

describe("headline set", () => {
  it("falls back to the long title and the section when an article carries only a title", () => {
    const set = headlineSet(base);
    expect(set.headline).toBe(base.title);
    expect(set.seoTitle).toBe(base.title);
    expect(set.flyTitle).toBe("Civic life");
    expect(set.rubric).toBeUndefined();
  });
  it("prefers the editor's headline, kicker, rubric and search title", () => {
    const set = headlineSet({ ...base, headline: "Police patrols return to Bollinger Canyon", fly_title: "City hall", subtitle: "A $4.1m technology package pays for them.", seo_title: "San Ramon police traffic patrols Bollinger Canyon 2026" });
    expect(set).toEqual({ flyTitle: "City hall", headline: "Police patrols return to Bollinger Canyon", rubric: "A $4.1m technology package pays for them.", seoTitle: "San Ramon police traffic patrols Bollinger Canyon 2026", title: base.title });
    expect(displayHeadline({ ...base, headline: "Police patrols return to Bollinger Canyon" } as never)).toBe("Police patrols return to Bollinger Canyon");
  });
  it("lets a paper's homepage override win and ignores blank fields", () => {
    const set = headlineSet({ ...base, headline: "  ", fly_title: "", subtitle: "Rubric" }, { stories: { s: { display_title: "Paper's own line", deck: "Paper's deck" } } });
    expect(set.headline).toBe("Paper's own line");
    expect(set.rubric).toBe("Paper's deck");
    expect(set.flyTitle).toBe("Civic life");
  });
  it("counts characters, never bytes, and reports limits the service enforces", () => {
    expect(headlineLength("Жители 学校 🎃")).toBe(11);
    expect(headlineProblems({ headline: "Ж".repeat(HEADLINE_MAX_CHARS), fly_title: "学".repeat(FLY_TITLE_MAX_CHARS) })).toEqual([]);
    expect(headlineProblems({ headline: "🎃".repeat(HEADLINE_MAX_CHARS + 1), fly_title: 12 })).toEqual([`headline exceeds ${HEADLINE_MAX_CHARS} characters`, "fly_title must be a string"]);
  });
});
