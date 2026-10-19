import { describe, it, expect } from "vitest";
import {
  articlePresentation,
  articleHeroRatio,
  articleFormatLabel,
} from "./article-presentation";
describe("article presentation", () => {
  it("accepts versioned custom combinations from Blog without arbitrary executable settings", () => {
    const p = articlePresentation({
      format: "opinion",
      layout: {
        id: "weekend-feature",
        version: 3,
        name: "София 李 🙂",
        renderer: "feature",
        hero_aspect: "portrait",
        headline_position: "after_hero",
        wide_body: true,
      },
    });
    expect(articleHeroRatio(p.layout)).toBe(0.8);
    expect(articleFormatLabel(p.format)).toBe("Opinion");
    expect(p.layout.version).toBe(3);
    expect(
      articlePresentation({ layout: { ...p.layout, id: "<script>" } }).layout
        .id,
    ).toBe("standard");
    expect(
      articlePresentation({
        layout: { ...p.layout, renderer: "url(evil)" } as any,
      }).layout.id,
    ).toBe("standard");
  });
});
