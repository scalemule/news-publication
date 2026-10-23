import type { HomepageSelection, NewsArticle, NewsItem } from "./types";

/**
 * The newspaper headline set. Every article may carry four pieces of title text, each with a job:
 *
 * - `fly_title`  the kicker above the headline: a beat, column or section label (<= 40 characters);
 * - `headline`   the short display headline, written as a line, not a summary (recommended <= 70,
 *                hard limit 120); front pages and the article h1 show it;
 * - `subtitle`   the rubric (deck): one sentence that carries the facts;
 * - `seo_title`  the search title for <title> and link previews.
 *
 * `title` is the long descriptive title that every article already has; it is the fallback for the
 * headline and the search title, so nothing changes for an article that carries only a title.
 * A per-paper homepage override (`StoryDisplay.display_title`/`deck`) still wins where an editor set one.
 */
export const HEADLINE_RECOMMENDED_CHARS = 70;
export const HEADLINE_MAX_CHARS = 120;
export const FLY_TITLE_MAX_CHARS = 40;
export const RUBRIC_MAX_CHARS = 500;
export const SEO_TITLE_MAX_CHARS = 200;

type Headlined = Pick<NewsItem, "slug" | "title" | "section"> & Partial<Pick<NewsItem, "headline" | "fly_title" | "excerpt">> & Partial<Pick<NewsArticle, "subtitle" | "seo_title">>;

const text = (value: unknown): string | undefined => {
  if (typeof value !== "string") return undefined;
  const trimmed = value.replace(/\s+/gu, " ").trim();
  return trimmed || undefined;
};

/** Characters, never bytes: Cyrillic, CJK and emoji count once each. */
export const headlineLength = (value: string): number => Array.from(value).length;

export type HeadlineSet = {
  /** Kicker: the editor's fly title, else the section. */
  flyTitle?: string;
  /** Display headline: the paper's override, else the article's headline, else its title. */
  headline: string;
  /** Rubric: the paper's deck override, else the subtitle. Never a cut sentence. */
  rubric?: string;
  /** Search title for <title> and previews. */
  seoTitle: string;
  /** The long descriptive title, for alternativeHeadline when it differs from the headline. */
  title: string;
};

export function headlineSet(article: Headlined, selection: HomepageSelection = {}): HeadlineSet {
  const display = selection.stories?.[article.slug];
  const title = text(article.title) ?? "";
  const headline = text(display?.display_title) ?? text(article.headline) ?? title;
  return {
    flyTitle: text(article.fly_title) ?? text(article.section),
    headline,
    rubric: text(display?.deck) ?? text(article.subtitle),
    seoTitle: text(article.seo_title) ?? title,
    title,
  };
}

/** Validation shared by the edit command and the editors: hard limits match the service. */
export function headlineProblems(fields: { headline?: unknown; fly_title?: unknown; subtitle?: unknown; seo_title?: unknown }): string[] {
  const problems: string[] = [];
  const check = (name: string, value: unknown, max: number) => {
    if (value === undefined || value === null) return;
    if (typeof value !== "string") { problems.push(`${name} must be a string`); return; }
    if (headlineLength(value.trim()) > max) problems.push(`${name} exceeds ${max} characters`);
  };
  check("headline", fields.headline, HEADLINE_MAX_CHARS);
  check("fly_title", fields.fly_title, FLY_TITLE_MAX_CHARS);
  check("subtitle", fields.subtitle, RUBRIC_MAX_CHARS);
  check("seo_title", fields.seo_title, SEO_TITLE_MAX_CHARS);
  return problems;
}
