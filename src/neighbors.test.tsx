import { describe, expect, it } from "vitest";
import {
  NEIGHBOR_SUBMISSION_TERMS,
  applyNeighborModeration,
  containsDisallowedLink,
  filterNeighborFeed,
  nominationToArticleDraft,
  prepareNeighborFlag,
  prepareNeighborNomination,
  screenNeighborText,
  visibleInNeighborFeed,
  type NeighborFeedPost,
} from "./neighbors";
import {
  NeighborNominationDetail,
  NeighborSpotlightCallout,
  NeighborsBoard,
} from "./neighbors-view";

const towns = ["Walnut Creek", "Rossmoor", "Pleasant Hill"];
const now = new Date("2026-10-30T19:00:00.000Z");

describe("neighbors nominations and community feed", () => {
  it("strictly blocks links across URL schemes, www, markdown, HTML, and bare domains while allowing normal prose", () => {
    expect(containsDisallowedLink("https://example.com/award")).toBe(true);
    expect(containsDisallowedLink("Visit www.oakstreethardware.com today")).toBe(true);
    expect(containsDisallowedLink("Check out oakstreethardware.com for details")).toBe(true);
    expect(containsDisallowedLink("See [their site](https://example.org)")).toBe(true);
    expect(containsDisallowedLink('<a href="https://example.org">click</a>')).toBe(true);
    expect(containsDisallowedLink("Short link bit.ly/localhero")).toBe(true);

    // Normal prose, initials, honorifics, and multi-byte UTF-8 are allowed
    expect(
      containsDisallowedLink(
        "Dr. Maria Chen at St. Mary's School won the U.S. Science Educator Award 🏆!",
      ),
    ).toBe(false);
    expect(
      containsDisallowedLink(
        "Привет соседи! Мария открыла пекарню в центре города 🥐 и помогает школе.",
      ),
    ).toBe(false);
  });

  it("clips text on Unicode character boundaries without corrupting multi-byte characters", () => {
    const screened = screenNeighborText("Привет 😀 соседи мира", "headline", {
      min: 4,
      max: 8,
    });
    expect(screened).toEqual({ ok: true, text: "Привет 😀" });
  });

  it("requires explicit agreement to the removal & moderation terms and rejects links in any field", () => {
    const baseInput = {
      nomineeName: "Maria Chen",
      nomineeKind: "neighbor",
      category: "award_milestone",
      town: "Walnut Creek",
      headline: "Won the State Science Educator Award",
      story:
        "Maria spent ten years mentoring the after-school robotics club and just won the statewide educator award.",
      submitterName: "David Kim",
      submitterEmail: "david@example.com",
      agreedToTerms: true,
    };

    // Missing terms agreement is rejected
    expect(() =>
      prepareNeighborNomination({ ...baseInput, agreedToTerms: false }, towns, now),
    ).toThrow(/removed or moderated/);

    // Link in story is rejected
    expect(() =>
      prepareNeighborNomination(
        {
          ...baseInput,
          story:
            "Maria won the statewide educator award! Read more at https://stateawards.org/maria",
        },
        towns,
        now,
      ),
    ).toThrow(/Links are not allowed/);

    // Link in headline is rejected
    expect(() =>
      prepareNeighborNomination(
        { ...baseInput, headline: "Check out mariachen.com award winner" },
        towns,
        now,
      ),
    ).toThrow(/Links are not allowed/);

    // Uncovered town is rejected
    expect(() =>
      prepareNeighborNomination({ ...baseInput, town: "Oakland" }, towns, now),
    ).toThrow(/town this paper covers/);

    // Valid nomination succeeds and records terms attestation
    const prepared = prepareNeighborNomination(baseInput, towns, now);
    expect(prepared.nomineeName).toBe("Maria Chen");
    expect(prepared.categoryLabel).toBe("Awards & milestones");
    expect(prepared.agreedToTerms).toBe(true);
    expect(prepared.removalPolicyAccepted).toBe(true);
    expect(prepared.termsVersion).toBe(NEIGHBOR_SUBMISSION_TERMS.version);
    expect(prepared.status).toBe("pending_review");
  });

  it("validates optional neighbor photo metadata and blocks links in captions", () => {
    const baseInput = {
      nomineeName: "Oak Street Hardware",
      nomineeKind: "business",
      category: "behind_the_counter",
      town: "Rossmoor",
      headline: "Celebrating 40 years of family ownership",
      story:
        "Three generations have helped neighbors fix everything from leaky faucets to Little League scoreboards.",
      submitterName: "Elena Rostova",
      submitterEmail: "elena@example.com",
      agreedToTerms: true,
    };

    expect(() =>
      prepareNeighborNomination(
        {
          ...baseInput,
          photo: {
            caption: "Front counter at Oak Street Hardware",
            credit: "Elena Rostova",
            rightsConfirmed: false,
          },
        },
        towns,
        now,
      ),
    ).toThrow(/permission to share this photo/);

    expect(() =>
      prepareNeighborNomination(
        {
          ...baseInput,
          photo: {
            caption: "See more photos at oakstreethardware.com",
            credit: "Elena Rostova",
            rightsConfirmed: true,
          },
        },
        towns,
        now,
      ),
    ).toThrow(/Links are not allowed/);

    const withPhoto = prepareNeighborNomination(
      {
        ...baseInput,
        photo: {
          assetId: "asset-123",
          caption: "Three generations behind the main counter",
          credit: "Elena Rostova",
          rightsConfirmed: true,
        },
      },
      towns,
      now,
    );
    expect(withPhoto.photo).toEqual({
      assetId: "asset-123",
      caption: "Three generations behind the main counter",
      credit: "Elena Rostova",
      rightsConfirmed: true,
    });
  });

  it("supports flagging, hiding/removing posts, filtering the feed, and picking up a post for a news article", () => {
    const flag = prepareNeighborFlag(
      {
        postId: "post-1",
        reason: "privacy_or_consent",
        details: "Please remove this post at the family's request.",
      },
      now,
    );
    expect(flag.reason).toBe("privacy_or_consent");
    expect(() =>
      prepareNeighborFlag({
        postId: "post-1",
        reason: "contains_link_or_spam",
        details: "Spamming https://spam.example",
      }),
    ).toThrow(/Links are not allowed/);

    const post1: NeighborFeedPost = {
      id: "post-1",
      nomineeName: "Maria Chen",
      nomineeKind: "neighbor",
      category: "award_milestone",
      town: "Walnut Creek",
      headline: "Won the State Science Educator Award",
      story: "Maria mentored the robotics club for a decade.",
      submitterName: "David Kim",
      createdAt: "2026-10-30T18:00:00.000Z",
      status: "published",
    };

    const post2: NeighborFeedPost = {
      id: "post-2",
      nomineeName: "Oak Street Hardware",
      nomineeKind: "business",
      category: "behind_the_counter",
      town: "Rossmoor",
      headline: "40 years serving the neighborhood",
      story: "Three generations behind the counter.",
      submitterName: "Elena Rostova",
      createdAt: "2026-10-30T18:30:00.000Z",
      status: "pending_review",
    };

    // Pending review is not visible in the public feed
    expect(visibleInNeighborFeed(post1)).toBe(true);
    expect(visibleInNeighborFeed(post2)).toBe(false);

    // Publish post2, then pick up post1 for a full newsroom article
    const publishedPost2 = applyNeighborModeration(post2, { type: "publish" }, now);
    const featuredPost1 = applyNeighborModeration(
      post1,
      {
        type: "pickup_for_article",
        articleSlug: "walnut-creek-teacher-maria-chen-wins-state-science-award",
        articleTitle: "Walnut Creek teacher Maria Chen wins State Science Educator Award",
      },
      now,
    );

    const feed = [featuredPost1, publishedPost2];
    expect(filterNeighborFeed(feed)).toHaveLength(2);
    expect(filterNeighborFeed(feed, { town: "Rossmoor" }).map(p => p.id)).toEqual(["post-2"]);
    expect(filterNeighborFeed(feed, { onlyArticlePickups: true }).map(p => p.id)).toEqual([
      "post-1",
    ]);
    expect(filterNeighborFeed(feed, { followedTowns: ["Walnut Creek"] }).map(p => p.id)).toEqual([
      "post-1",
    ]);

    // Flagging or removing immediately removes the post from the public feed
    const flagged = applyNeighborModeration(
      publishedPost2,
      { type: "flag_hide", reason: "Flagged by reader" },
      now,
    );
    expect(visibleInNeighborFeed(flagged)).toBe(false);

    const removed = applyNeighborModeration(
      featuredPost1,
      { type: "remove", reason: "Subject requested removal" },
      now,
    );
    expect(visibleInNeighborFeed(removed)).toBe(false);

    // Article draft helper routes business nominations to Local businesses and neighbors to Community
    const businessDraft = nominationToArticleDraft(publishedPost2);
    expect(businessDraft.section).toBe("Local businesses");
    expect(businessDraft.community).toBe("Rossmoor");
    expect(businessDraft.title).toContain("Oak Street Hardware");

    const neighborDraft = nominationToArticleDraft(featuredPost1);
    expect(neighborDraft.section).toBe("Community");
  });

  it("renders the Neighbors feed, article pickup badge, and unavailable state for removed posts", () => {
    const featured: NeighborFeedPost = {
      id: "post-1",
      nomineeName: "Maria Chen",
      nomineeKind: "neighbor",
      category: "award_milestone",
      town: "Walnut Creek",
      headline: "Won the State Science Educator Award",
      story: "Maria mentored the robotics club for a decade.",
      submitterName: "David Kim",
      createdAt: "2026-10-30T18:00:00.000Z",
      status: "featured_in_article",
      articleSlug: "maria-chen-science-award",
      articleTitle: "Walnut Creek teacher Maria Chen wins state award",
    };

    const boardHtml = JSON.stringify(
      NeighborsBoard({
        region: "Walnut Creek",
        posts: [featured],
        towns,
      }),
    );
    expect(boardHtml).toContain("Maria Chen: Won the State Science Educator Award");
    expect(boardHtml).toContain("Picked up by the newsroom:");
    expect(boardHtml).toContain("/maria-chen-science-award");
    expect(boardHtml).toContain("Flag or request removal");

    const removed = applyNeighborModeration(featured, { type: "remove" }, now);
    const removedDetailHtml = JSON.stringify(NeighborNominationDetail({ post: removed }));
    expect(removedDetailHtml).toContain("This neighbor post is not available.");

    const calloutHtml = JSON.stringify(NeighborSpotlightCallout({ region: "Walnut Creek" }));
    expect(calloutHtml).toContain("Nominate a neighbor or business");
  });
});
