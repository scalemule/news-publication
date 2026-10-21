import { describe, expect, it } from "vitest";
import {
  ARTICLE_CONVERSION_EXPERIMENT,
  classifyStoryInvitationCategory,
  contextualCommunityInvitation,
  isSponsoredStoryItem,
  resolveArticleConversionVariant,
  selectRelevantLocalStories,
} from "./community-conversion";
import type { NewsItem } from "./types";

const sanRamonPub = {
  name: "San Ramon Times",
  regionLabel: "San Ramon",
  coverageText: "San Ramon, Dougherty Valley, and the Tri-Valley",
  towns: ["San Ramon", "Danville", "Dublin", "Pleasanton"],
};

const walnutCreekPub = {
  name: "Walnut Creek Times",
  regionLabel: "Walnut Creek",
  coverageText: "Walnut Creek, Rossmoor, and Central Contra Costa",
  towns: ["Walnut Creek", "Lafayette", "Pleasant Hill"],
};

function makeStory(overrides: Partial<NewsItem> & { id: string; slug: string; title: string }): NewsItem {
  return {
    excerpt: "Local community reporting.",
    cover_image_url: `https://cdn-public.scalemule.com/covers/${overrides.slug}.jpg`,
    published_at: "2026-10-19T12:00:00Z",
    ...overrides,
  };
}

describe("community-conversion", () => {
  it("resolves article_conversion_module variants with query override support", () => {
    expect(ARTICLE_CONVERSION_EXPERIMENT).toBe("article_conversion_module");
    expect(resolveArticleConversionVariant(undefined, undefined)).toBe("control");
    expect(resolveArticleConversionVariant("control", undefined)).toBe("control");
    expect(resolveArticleConversionVariant("treatment", undefined)).toBe("treatment");
    expect(resolveArticleConversionVariant("control", "treatment")).toBe("treatment");
    expect(resolveArticleConversionVariant("treatment", "control")).toBe("control");
  });

  it("generates category-tailored community invitations across publications", () => {
    const zorawar = makeStory({
      id: "1",
      slug: "san-ramons-little-warrior-zorawar-reaches-baby-of-the-year-quarter-finals-b42503f0",
      title: "San Ramon’s Little Warrior: Zorawar Reaches Baby of the Year Quarter-Finals",
      section: "Community",
    });

    expect(classifyStoryInvitationCategory(zorawar)).toBe("celebrations");
    const srInvite = contextualCommunityInvitation(zorawar, sanRamonPub);
    expect(srInvite.heading).toBe("Stay connected to San Ramon");
    expect(srInvite.subprompt).toBe("Discover more people and milestones worth celebrating.");
    expect(srInvite.description).toContain("San Ramon is full of stories worth celebrating.");

    const wcBusiness = makeStory({
      id: "2",
      slug: "downtown-bakery-opens",
      title: "Family Bakery Opens New Storefront in Downtown Walnut Creek",
      section: "Local businesses",
    });
    const wcInvite = contextualCommunityInvitation(wcBusiness, walnutCreekPub);
    expect(wcInvite.category).toBe("local_businesses");
    expect(wcInvite.heading).toBe("Stay connected to Walnut Creek");
    expect(wcInvite.subprompt).toBe("Meet the entrepreneurs building your community.");
  });

  it("selects 2-3 relevant local stories with photos while excluding current, duplicate-cover, and sponsored items", () => {
    const current = makeStory({
      id: "zorawar",
      slug: "zorawar-story",
      title: "San Ramon’s Little Warrior: Zorawar Reaches Quarter-Finals",
      section: "Community",
      cover_image_url: "https://cdn-public.scalemule.com/covers/zorawar.jpg",
    });

    const candidates: NewsItem[] = [
      current,
      makeStory({
        id: "sponsored-1",
        slug: "sponsored-story",
        title: "San Ramon Partner Spotlight",
        section: "Community",
        tags: [{ id: "t1", name: "Sponsored", slug: "sponsored" }],
      }),
      makeStory({
        id: "dup-cover",
        slug: "duplicate-cover-story",
        title: "San Ramon Neighbors Gather at Central Park",
        section: "Community",
        cover_image_url: "https://cdn-public.scalemule.com/covers/zorawar.jpg",
      }),
      makeStory({
        id: "sr-1",
        slug: "san-ramon-art-walk",
        title: "San Ramon Families Celebrate Autumn Art Walk at City Center",
        section: "Community",
        cover_image_url: "https://cdn-public.scalemule.com/covers/sr-1.jpg",
      }),
      makeStory({
        id: "sr-2",
        slug: "dougherty-valley-robotics",
        title: "San Ramon Students Win Regional Robotics Honor",
        section: "Schools",
        cover_image_url: "https://cdn-public.scalemule.com/covers/sr-2.jpg",
      }),
      makeStory({
        id: "sr-3",
        slug: "bishop-ranch-farmers-market",
        title: "New Weekend Farmers Market Vendors Arrive in San Ramon",
        section: "Events",
        cover_image_url: "https://cdn-public.scalemule.com/covers/sr-3.jpg",
      }),
    ];

    expect(isSponsoredStoryItem(candidates[1])).toBe(true);
    const selected = selectRelevantLocalStories(current, candidates, sanRamonPub, 3);
    expect(selected.map(s => s.id)).toEqual(["sr-1", "sr-2", "sr-3"]);
  });
});
