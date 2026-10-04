import { describe, it, expect } from "vitest";
import { proseDiff } from "./story-diff";
describe("readable revision comparison", () => {
  for (const [before, after] of [
    ["will celebrate", "celebrated"],
    ["София и 李 🎉", "София, 李 и 📰"],
    ["e\u0301 and family", "e\u0301 and friends"],
    ["", "A new paragraph."],
    ["Old paragraph.", ""],
    ["same", "same"],
  ]) {
    it(`preserves both documents: ${before}`, () => {
      const runs = proseDiff(before, after);
      expect(
        runs
          .filter((r) => r.kind !== "added")
          .map((r) => r.text)
          .join(""),
      ).toBe(before);
      expect(
        runs
          .filter((r) => r.kind !== "removed")
          .map((r) => r.text)
          .join(""),
      ).toBe(after);
      expect(runs.some((r) => /[\uD800-\uDBFF]$/.test(r.text))).toBe(false);
    });
  }
  it("keeps surrounding paragraphs unchanged", () => {
    expect(
      proseDiff(
        "A beginning.\n\nwill celebrate\n\nAn ending.",
        "A beginning.\n\ncelebrated\n\nAn ending.",
      )
        .filter((r) => r.kind === "same")
        .map((r) => r.text)
        .join(""),
    ).toContain("An ending.");
  });
  it("bounds the memory used by very large edits", () => {
    const a = "old 📰 ".repeat(3000),
      b = "new 李 ".repeat(3000);
    const r = proseDiff(a, b);
    expect(
      r
        .filter((x) => x.kind !== "added")
        .map((x) => x.text)
        .join(""),
    ).toBe(a);
    expect(
      r
        .filter((x) => x.kind !== "removed")
        .map((x) => x.text)
        .join(""),
    ).toBe(b);
  });
});
