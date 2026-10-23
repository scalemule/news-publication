import { describe, expect, it } from "vitest";
import {
  LAYOUT_COOKIE,
  NEWS_CACHE,
  NewsError,
  articleMeta,
  attribution,
  briefSummary,
  composeEdition,
  defaultRevalidateTargets,
  definePublication,
  edgeCacheControl,
  editorialSections,
  featureEnabled,
  filterNews,
  llmsText,
  newsArticleJsonLd,
  publicUrl,
  referralCode,
  resolveCoupon,
  orderedSections,
  resolveLayout,
  resolveSection,
  revalidateDecision,
  sectionDefinition,
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
    story({ id: "1", slug: "lead", title: "Council meets", section: "Civic life", cover_image_url: "https://cdn.example.com/council.jpg" }),
    story({ id: "2", slug: "second", title: "Plaza opens", section: "Local businesses", cover_image_url: "https://cdn.example.com/plaza.jpg" }),
    story({ id: "1", slug: "lead-copy", title: "Duplicate" }),
    story({ id: "3", slug: "old", title: "Old brief", published_at: "2026-08-01T00:00:00.000Z", excerpt: "This one is too old." }),
  ];

  it("pins a lead until the pin expires and drops duplicate ids", () => {
    const edition = composeEdition(items, { lead_slug: "second", pinned_until: "2026-09-23T00:00:00.000Z" }, now);
    expect(edition.lead?.slug).toBe("second");
    expect(edition.navigation.flatMap(section => section.items).map(item => item.id)).toEqual(["1", "2", "3"]);
    expect(composeEdition(items, { lead_slug: "second", pinned_until: "2026-09-21T00:00:00.000Z" }, now).lead?.slug).toBe("lead");
  });

  it("avoids duplicate images between lead and secondary stories", () => {
    const photoA = "https://cdn.example.com/photo-a.jpg";
    const photoB = "https://cdn.example.com/photo-b.jpg";
    const photoC = "https://cdn.example.com/photo-c.jpg";
    const stories = [
      story({ id: "1", slug: "story-1", title: "Story 1", cover_image_url: photoA }),
      story({ id: "2", slug: "story-2", title: "Story 2 (Duplicate Photo A)", cover_image_url: photoA }),
      story({ id: "3", slug: "story-3", title: "Story 3 (Unique Photo B)", cover_image_url: photoB }),
      story({ id: "4", slug: "story-4", title: "Story 4 (Unique Photo C)", cover_image_url: photoC }),
      story({ id: "5", slug: "story-5", title: "Story 5", cover_image_url: null }),
    ];
    const edition = composeEdition(stories);
    expect(edition.lead?.slug).toBe("story-1");
    // Story 2 should be deferred because it shares photoA with lead
    expect(edition.secondary.map(s => s.slug)).toEqual(["story-3", "story-4"]);
    expect(edition.pendingImages.map(s => s.slug)).toEqual(["story-2", "story-5"]);
  });

  it("holds repeated covers in every slot without mutating inventory or refilling images", () => {
    const key = "ab".repeat(32);
    const stories = Array.from({ length: 16 }, (_, n) => story({
      id: String(n), slug: `story-${n}`, title: `Story ${n}`, section: n % 2 ? "Sports" : "Civic life",
      cover_image_url: `https://cdn.example.com/copy-${n}.webp`,
      visual_identity: { version: 1, key },
    }));
    const edition = composeEdition(stories, { lead_slug: "story-9" });
    expect(edition.lead?.id).toBe("9");
    const all = edition.navigation.flatMap(section => section.items);
    expect(all.filter(item => item.cover_image_url).map(item => item.id)).toEqual(["9"]);
    expect([...edition.secondary, ...edition.compact, ...edition.sections.flatMap(s => s.items)]
      .every(item => item.cover_image_url === null)).toBe(true);
    expect(stories.every(item => item.cover_image_url !== null)).toBe(true);
    const short = composeEdition(stories.slice(0, 2));
    expect(short.secondary).toHaveLength(0);
    expect(short.pendingImages.map(item => item.id)).toEqual(["1"]);
  });

  it("keeps held pinned stories out of all image placements and tracks them for repair", () => {
    const stories = Array.from({ length: 24 }, (_, n) => story({
      id: String(n), slug: `story-${n}`, title: `市区 Привет 😀 ${n}`,
      section: n % 2 ? "Schools" : "Civic life",
      cover_image_url: n % 3 === 0 ? null : `https://cdn.example.com/photo-${n}.webp`,
    }));
    const edition = composeEdition(stories, { lead_slug: "story-0", secondary_slugs: ["story-3", "story-5"] }, now);
    expect(edition.lead?.id).toBe("1");
    expect(edition.secondary[0].id).toBe("5");
    const placed = [edition.lead!, ...edition.secondary, ...edition.compact, ...edition.sections.flatMap(s => s.items)];
    expect(placed.length).toBe(16);
    expect(new Set(placed.map(item => item.id)).size).toBe(placed.length);
    expect(placed.every(item => !!item.cover_image_url)).toBe(true);
    expect(edition.pendingImages.map(item => item.id)).toEqual(["0", "3", "6", "9", "12", "15", "18", "21"]);
    expect(edition.navigation.flatMap(s => s.items)).toHaveLength(24);
    expect(stories[0].cover_image_url).toBeNull();
  });

  it("reports an entirely unready inventory without fabricating a visual edition", () => {
    const stories = [story({ id: "1", slug: "unready", title: "Awaiting photo" })];
    const edition = composeEdition(stories, {}, now);
    expect(edition.lead).toBeUndefined();
    expect(edition.secondary).toEqual([]);
    expect(edition.compact).toEqual([]);
    expect(edition.sections).toEqual([]);
    expect(edition.pendingImages).toEqual(stories);
    expect(edition.briefs).toEqual(stories);
  });

  it("recognizes renditions of one legacy Photo without conflating different assets", () => {
    const app = "019471a0-0021-7000-8000-001020304050";
    const photo = "019471a0-0031-7000-8000-001020304050";
    const root = `https://cdn-public.scalemule.com/${app}/anonymous/photos/${photo}/`;
    const edition = composeEdition([
      story({ id: "1", slug: "a", title: "A", cover_image_url: `${root}w1600.webp` }),
      story({ id: "2", slug: "b", title: "B", cover_image_url: `${root}w400.webp` }),
      story({ id: "3", slug: "c", title: "C", cover_image_url: `${root.replace(photo, app)}w400.webp` }),
    ]);
    const all = edition.navigation.flatMap(section => section.items);
    expect(all.find(item => item.id === "2")?.cover_image_url).toBeNull();
    expect(all.find(item => item.id === "3")?.cover_image_url).toBeTruthy();
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

  it("labels sections for readers and keeps slugs stable", () => {
    expect(sectionDefinition("Local businesses")).toMatchObject({ label: "Business", id: "section-local-businesses" });
    expect(sectionDefinition("Events")).toMatchObject({ label: "Things to do", id: "section-events" });
    expect(sectionDefinition("Real Estate")).toMatchObject({ label: "Real Estate", id: "section-real-estate" });
  });

  it("orders sections canonically with unknown names after, alphabetically", () => {
    const names = ["Health", "Opinion", "Real Estate", "Local news", "Bridge club", "Civic life", "Aquatics"];
    expect(orderedSections(names.map(name => ({ name }))).map(section => section.name))
      .toEqual(["Civic life", "Real Estate", "Health", "Opinion", "Aquatics", "Bridge club"]);
  });

  it("resolves canonical sections and normalizes aliases", () => {
    expect(resolveSection(story({ id: "1", slug: "a", title: "Council votes", section: "Government" }))).toBe("Civic life");
    expect(resolveSection(story({ id: "2", slug: "b", title: "Bakery opens", section: "Business" }))).toBe("Local businesses");
    expect(resolveSection(story({ id: "3", slug: "c", title: "Art display", section: "Arts & Culture" }))).toBe("Community");
    expect(resolveSection(story({ id: "4", slug: "d", title: "Pumpkin weigh-off", section: "Things to do" }))).toBe("Events");
  });

  it("infers canonical sections from tags and content heuristics when unassigned", () => {
    // Health from veterinary keywords
    expect(resolveSection(story({ id: "1", slug: "vet", title: "Joybound mobile veterinary wellness clinic expands", section: null }))).toBe("Health");
    // Civic life from ballot and council keywords
    expect(resolveSection(story({ id: "2", slug: "civ", title: "City council debates transit measure on November ballot", section: null }))).toBe("Civic life");
    // Real Estate from housing keywords
    expect(resolveSection(story({ id: "3", slug: "re", title: "Walnut Creek expands below-market rate homeownership program", section: null }))).toBe("Real Estate");
    // Events from festival/fair keywords
    expect(resolveSection(story({ id: "4", slug: "ev", title: "Downtown autumn harvest festival and concert planned", section: null }))).toBe("Events");
    // Local businesses from storefront/retail keywords
    expect(resolveSection(story({ id: "5", slug: "biz", title: "New downtown boutique storefront opens on Main Street", section: null }))).toBe("Local businesses");
    // Unassigned general story resolves to Community
    expect(resolveSection(story({ id: "6", slug: "gen", title: "Residents gather to celebrate historic neighborhood heritage", section: null }))).toBe("Community");
  });

  it("populates balanced editorial sections without dropping unassigned stories to Local news", () => {
    const mixed = [
      story({ id: "1", slug: "council", title: "Council votes on transit budget", section: null }),
      story({ id: "2", slug: "pet", title: "Subsidized animal clinic offers vaccines", section: null }),
      story({ id: "3", slug: "fair", title: "Community volunteer fair set for Saturday", section: null }),
      story({ id: "4", slug: "neigh", title: "Residents preserve historic neighborhood open space", section: null }),
    ];
    const sections = editorialSections(mixed);
    expect(sections.map(s => s.name)).toEqual(["Civic life", "Health", "Events", "Community"]);
    expect(sections.every(s => s.name !== "Local news")).toBe(true);
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
    expect(graph).not.toHaveProperty("dateModified");

    const modifiedArticle = {
      ...storyArticle,
      metadata: {
        ...storyArticle.metadata,
        editorial: { modified_at: "2026-10-15T20:38:00Z" },
      },
    };
    const modifiedGraph = newsArticleJsonLd(walnutCreekTimes, modifiedArticle, "https://walnutcreektimes.com", "Walnut Creek Times");
    expect(modifiedGraph.dateModified).toBe("2026-10-15T20:38:00Z");

    // The search title names the page; the display headline names the story on cards and in the graph.
    const meta = articleMeta(walnutCreekTimes, { ...storyArticle, seo_title: "Tenant rights workshop in Walnut Creek" }, "https://walnutcreektimes.com", true);
    expect(meta.title).toBe("Tenant rights workshop in Walnut Creek");
    expect(articleMeta(walnutCreekTimes, { ...storyArticle, seo_title: "  " }, "https://walnutcreektimes.com", true).title).toBe(storyArticle.title);
    const headlined = { ...storyArticle, headline: "Renters learn their rights", subtitle: "A free workshop downtown." };
    expect(newsArticleJsonLd(walnutCreekTimes, headlined, "https://walnutcreektimes.com", "Walnut Creek Times")).toMatchObject({ headline: "Renters learn their rights", alternativeHeadline: storyArticle.title, description: "A free workshop downtown." });
    expect(articleMeta(walnutCreekTimes, headlined, "https://walnutcreektimes.com", true).openGraph.title).toBe("Renters learn their rights");
    expect(meta.openGraph).not.toHaveProperty("modifiedTime");
    expect(meta.openGraph.siteName).toBe(walnutCreekTimes.name);
    expect(llmsText(walnutCreekTimes, "https://walnutcreektimes.com")).toContain("Walnut Creek, Rossmoor, Saranap, Pleasant Hill");
  });

  it("preserves syndicated cross-domain canonical URL when present", () => {
    const syndicatedArticle = article({
      id: "syndicated-1",
      slug: "concord-taco-trail",
      title: "Concord's Taco Trail is open",
      canonical_url: "https://concordchronicle.com/news/concord-taco-trail",
    });

    // When rendered on Walnut Creek Times, canonical points to Concord Chronicle
    const meta = articleMeta(walnutCreekTimes, syndicatedArticle, "https://walnutcreektimes.com", true);
    expect(meta.canonical).toBe("https://concordchronicle.com/news/concord-taco-trail");

    const jsonLd = newsArticleJsonLd(walnutCreekTimes, syndicatedArticle, "https://walnutcreektimes.com");
    expect(jsonLd.mainEntityOfPage).toBe("https://walnutcreektimes.com/news/concord-taco-trail");
    expect(jsonLd.isBasedOn).toBe("https://concordchronicle.com/news/concord-taco-trail");
    expect(jsonLd.url).toBe("https://walnutcreektimes.com/news/concord-taco-trail");
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
