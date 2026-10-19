/** Declarative presentation resolved by Blog from the article's pinned profile version. */
export type ArticleFormat =
  | "news"
  | "brief"
  | "explainer"
  | "interview"
  | "opinion"
  | "photo_essay"
  | "video_story";
export type ArticleLayout = {
  id: string;
  version: number;
  name: string;
  renderer: "standard" | "feature" | "portrait";
  hero_aspect: "landscape" | "portrait" | "square";
  headline_position: "before_hero" | "after_hero";
  wide_body: boolean;
};
export type ArticlePresentation = {
  format?: ArticleFormat | null;
  layout: ArticleLayout;
};
const standard: ArticleLayout = {
  id: "standard",
  version: 1,
  name: "Standard article",
  renderer: "standard",
  hero_aspect: "landscape",
  headline_position: "before_hero",
  wide_body: false,
};
const formats = [
  "news",
  "brief",
  "explainer",
  "interview",
  "opinion",
  "photo_essay",
  "video_story",
];
/** Never turn an arbitrary API field into CSS, HTML, a class name or a URL. */
export function articlePresentation(
  value?: ArticlePresentation | null,
): ArticlePresentation {
  const l = value?.layout;
  if (
    !l ||
    !/^[a-z0-9_-]{1,80}$/.test(l.id) ||
    !Number.isInteger(l.version) ||
    l.version < 1 ||
    !["standard", "feature", "portrait"].includes(l.renderer) ||
    !["landscape", "portrait", "square"].includes(l.hero_aspect) ||
    !["before_hero", "after_hero"].includes(l.headline_position) ||
    typeof l.wide_body !== "boolean"
  ) {
    return { layout: standard };
  }
  return {
    format:
      value?.format && formats.includes(value.format)
        ? value.format
        : undefined,
    layout: l,
  };
}
export function articleHeroRatio(layout: ArticleLayout): number {
  return layout.hero_aspect === "portrait"
    ? 4 / 5
    : layout.hero_aspect === "square"
      ? 1
      : 16 / 9;
}
export function articleFormatLabel(
  format?: ArticleFormat | null,
): string | undefined {
  return format === "opinion"
    ? "Opinion"
    : format === "explainer"
      ? "Explainer"
      : format === "interview"
        ? "Interview"
        : format === "photo_essay"
          ? "Photo essay"
          : format === "video_story"
            ? "Video story"
            : undefined;
}
