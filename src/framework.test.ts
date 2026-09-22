import { describe, expect, it } from "vitest";
import {
  LAYOUT_COOKIE,
  NEWS_CACHE,
  NewsError,
  attribution,
  briefSummary,
  composeEdition,
  defaultRevalidateTargets,
  definePublication,
  edgeCacheControl,
  featureEnabled,
  filterNews,
  llmsText,
  newsArticleJsonLd,
  publicUrl,
  referralCode,
  resolveCoupon,
  resolveLayout,
  revalidateDecision,
  sectionId,
  shortDeck,
  storyTowns,
  walnutCreekTimes,
  withLastKnown,
  type NewsArticle,
  type NewsItem,
} from "./index";

function story(partial: Partial<NewsItem> & Pick<NewsItem, "id" | "slug" | "title">): NewsItem {
  return {
    excerpt: "A complete sentence about the town.",
    cover_image_url: null,
    published_at: "2026-09-22T15:00:00.000Z",
    updated_at: "2026-09-22T15:00:00.000Z",
    reading_time_minutes: 3,
    no_index: false,
    section: "Community",
    author_name: null,
    ...partial,
  };
}

const article = (partial: Partial<NewsArticle> & Pick<NewsArticle, "id" | "slug" | "title">): NewsArticle => ({
  ...story(partial),
  content_html: "<p>Body</p>",
  ...partial,
});

describe("publication config", () => {
  it("uses the Walnut Creek Times broadsheet as the default", () => {
    expect(walnutCreekTimes.layout).toBe("broadsheet");
    expect(walnutCreekTimes.theme.accent).toBe("#bb171d");
    expect(walnutCreekTimes.towns).toEqual(["Walnut Creek", "Rossmoor", "Saranap", "Pleasant Hill"]);
    expect(featureEnabled(walnutCreekTimes, "smile")).toBe(true);
    expect(featureEnabled(walnutCreekTimes, "coupons")).toBe(false);
    expect(featureEnabled(walnutCreekTimes, "referrals")).toBe(false);
  });

  it("lets another paper keep the framework and change identity, layout, and flags", () => {
    const napa = definePublication({
      slug: "napagate",
      name: "Napa Gate",
      masthead: ["Napa", "Gate"],
      region: "Napa Valley",
      regionLabel: "Napa Valley",
      towns: ["Napa", "Yountville", "St. Helena"],
      description: "Local stories from Napa Valley.",
      layout: "napagate",
      layouts: ["napagate", "broadsheet"],
      features: { referrals: true, coupons: true },
      coupons: { offers: [{ code: "NAPA1", label: "First month", percentOff: 50, months: 1 }] },
      theme: { accent: "#6b2d5b" },
    });
    expect(napa.layout).toBe("napagate");
    expect(napa.layouts).toEqual(["napagate", "broadsheet"]);
    expect(napa.theme.accent).toBe("#6b2d5b");
    expect(napa.theme.ink).toBe("#171917");
    expect(featureEnabled(napa, "smile")).toBe(false);
    expect(featureEnabled(napa, "referrals")).toBe(true);
    expect(resolveLayout(napa, null)).toBe("napagate");
    expect(resolveLayout(napa, "broadsheet")).toBe("broadsheet");
    expect(resolveLayout(napa, "classic")).toBe("napagate");
    expect(LAYOUT_COOKIE).toBe("news_publication_layout");
  });
});

describe("cache and revalidation", () => {
  it("matches the walnutcreektimes.com timings", () => {
    expect(NEWS_CACHE.feedRevalidateSeconds).toBe(30);
    expect(NEWS_CACHE.articleRevalidateSeconds).toBe(60);
    expect(edgeCacheControl()).toBe("public, s-maxage=60, stale-while-revalidate=300");
    expect(defaultRevalidateTargets()).toEqual({
      tags: ["news-feed", "news-article", "public-news-discovery-v2"],
      paths: ["/", "/news"],
    });
  });

  it("serves the last known feed after a gateway failure and still 404s a missing article", async () => {
    const store = new Map<string, string>();
    await withLastKnown(store, "feed", async () => "headlines");
    await expect(withLastKnown(store, "feed", async () => { throw new NewsError(429, "slow"); })).resolves.toBe("headlines");
    await expect(withLastKnown(store, "missing", async () => { throw new NewsError(404, "gone"); })).rejects.toMatchObject({ status: 404 });
  });

  it("rejects an unauthenticated revalidate and echoes the default purge", () => {
    expect(revalidateDecision({ providedSecret: null, configuredSecret: "key" }).status).toBe(401);
    expect(revalidateDecision({ providedSecret: "nope", configuredSecret: "key" }).status).toBe(401);
    const ok = revalidateDecision({ providedSecret: "key", configuredSecret: "key", now: 1790114487217 });
    expect(ok).toEqual({
      status: 200,
      body: { revalidated: true, tag: "news-feed, news-article", path: "/, /news", now: 1790114487217 },
    });
  });
});

describe("front page", () => {
  const now = Date.parse("2026-09-22T20:00:00.000Z");
  const items = [
    story({ id: "1", slug: "lead", title: "Council meets", section: "Civic life" }),
    story({ id: "2", slug: "second", title: "Plaza opens", section: "Local businesses" }),
    story({ id: "1", slug: "lead-copy", title: "Duplicate" }),
    story({ id: "3", slug: "old", title: "Old brief", published_at: "2026-08-01T00:00:00.000Z", excerpt: "This one is too old." }),
  ];

  it("pins a lead until the pin expires and drops duplicate ids", () => {
    const edition = composeEdition(items, { lead_slug: "second", pinned_until: "2026-09-23T00:00:00.000Z" }, now);
    expect(edition.lead?.slug).toBe("second");
    expect(edition.navigation.flatMap(section => section.items).map(item => item.id)).toEqual(["1", "2", "3"]);
    expect(composeEdition(items, { lead_slug: "second", pinned_until: "2026-09-21T00:00:00.000Z" }, now).lead?.slug).toBe("lead");
  });

  it("keeps a complete sentence and refuses a cut-off brief", () => {
    expect(briefSummary(story({ id: "1", slug: "a", title: "A", excerpt: "Город открыл парк. Дальше ещё." }))).toBe("Город открыл парк.");
    expect(briefSummary(story({ id: "1", slug: "a", title: "A", excerpt: "Incomplete sentence…" }))).toBe("");
  });

  it("shortens on character boundaries, including emoji", () => {
    const text = "Привет 😀 мир сегодня.";
    expect(shortDeck(text, 8)).toBe("Привет…");
    expect(Array.from(shortDeck("😀😀😀 hello", 2)).length).toBeLessThanOrEqual(3);
    expect(sectionId("市区")).toBe("section-市区");
    expect(sectionId("Food & places")).toBe("section-food-places");
  });

  it("finds covered towns in Cyrillic and English copy", () => {
    const towns = storyTowns(
      story({ id: "1", slug: "rossmoor", title: "Rossmoor hosts a concert", excerpt: "" }),
      ["Walnut Creek", "Rossmoor"],
    );
    expect(towns).toEqual(["Rossmoor"]);
  });

  it("lets a paper replace tag matching", () => {
    const paper = definePublication({
      slug: "napagate",
      name: "Napa Gate",
      masthead: ["Napa", "Gate"],
      region: "Napa Valley",
      regionLabel: "Napa Valley",
      towns: ["Napa"],
      description: "Napa.",
      matchTag: (item, tag) => tag === "harvest" && item.title.includes("crush"),
    });
    const rows = [story({ id: "1", slug: "crush", title: "The crush begins" })];
    expect(filterNews(rows, { tag: "harvest" }, paper)).toHaveLength(1);
    expect(filterNews(rows, { tag: "downtown" }, paper)).toHaveLength(0);
  });
});

describe("search metadata", () => {
  it("emits NewsArticle structured data for an indexable story", () => {
    const storyArticle = article({
      id: "1",
      slug: "tenant-rights",
      title: "Tenant rights workshop",
      excerpt: "A workshop downtown.",
      cover_image_url: "https://cdn.example/cover.jpg",
      published_at: "2026-09-22T15:00:00.000Z",
      updated_at: "2026-09-22T16:00:00.000Z",
    });
    const graph = newsArticleJsonLd(walnutCreekTimes, storyArticle, "https://walnutcreektimes.com", "Walnut Creek Times");
    expect(graph["@type"]).toBe("NewsArticle");
    expect(graph.publisher).toMatchObject({ "@type": "NewsMediaOrganization", name: "Walnut Creek Times" });
    expect(graph.url).toBe("https://walnutcreektimes.com/news/tenant-rights");
    expect(llmsText(walnutCreekTimes, "https://walnutcreektimes.com")).toContain("Walnut Creek, Rossmoor, Saranap, Pleasant Hill");
  });

  it("drops credentials and collapses private paths", () => {
    expect(publicUrl("https://user:pass@walnutcreektimes.com/news/story")).toBeUndefined();
    expect(publicUrl("https://walnutcreektimes.com/news/tenant-rights")).toBe("https://walnutcreektimes.com/news/article");
    expect(publicUrl("https://walnutcreektimes.com/account")).toBe("https://walnutcreektimes.com/other");
  });
});

describe("referrals and coupons", () => {
  const napa = definePublication({
    slug: "napagate",
    name: "Napa Gate",
    masthead: ["Napa", "Gate"],
    region: "Napa Valley",
    regionLabel: "Napa Valley",
    towns: ["Napa"],
    description: "Napa.",
    features: { referrals: true, coupons: true },
    referrals: { queryParam: "via" },
    coupons: { offers: [{ code: "LOCAL1", label: "Intro", percentOff: 87.5, months: 6, planSlug: "local-reader" }] },
  });

  it("records a referral only after the paper turns the feature on", () => {
    const landed = "https://napagate.com/?via=friend_12&utm_source=newsletter";
    expect(referralCode(walnutCreekTimes, "https://walnutcreektimes.com/?ref=friend_12")).toBeNull();
    expect(referralCode(napa, landed)).toBe("friend_12");
    expect(attribution(landed, "", napa).referral_code).toBe("friend_12");
    expect(attribution(landed, "", walnutCreekTimes).referral_code).toBeUndefined();
    expect(attribution("https://napagate.com/?via=has space", "", napa).referral_code).toBeUndefined();
  });

  it("resolves a paper coupon and ignores codes while the feature is off", () => {
    expect(resolveCoupon(walnutCreekTimes, "LOCAL1")).toBeNull();
    expect(resolveCoupon(napa, "local1")?.planSlug).toBe("local-reader");
    expect(resolveCoupon(napa, "NOPE")).toBeNull();
    const custom = definePublication({
      slug: "eastbaypost",
      name: "East Bay Post",
      masthead: ["East Bay", "Post"],
      region: "the East Bay",
      regionLabel: "The East Bay",
      towns: ["Oakland"],
      description: "East Bay.",
      features: { coupons: true },
      coupons: { resolve: (code) => code === "FRIEND" ? { code, label: "Friend" } : null },
    });
    expect(resolveCoupon(custom, "FRIEND")?.label).toBe("Friend");
  });
});
