import { describe, expect, it } from "vitest";
import {
  VerifiedCardComponent,
  VerifiedCardSection,
  getArticleCards,
  isSafeActionUrl,
} from "./verified-card";

describe("verified-card functionality and security", () => {
  it("validates and filters safe action URLs strictly", () => {
    // Valid URLs
    expect(isSafeActionUrl("https://runsignup.com/Race/CA/Dublin/DublinTrailChallenge")).toBe(true);
    expect(isSafeActionUrl("https://www.dublin.ca.gov/trails")).toBe(true);
    expect(isSafeActionUrl("tel:+19255564500")).toBe(true);
    expect(isSafeActionUrl("mailto:info@museumonmain.org")).toBe(true);

    // Invalid / unsafe URLs
    expect(isSafeActionUrl("javascript:alert(1)")).toBe(false);
    expect(isSafeActionUrl("data:text/html,<script>alert(1)</script>")).toBe(false);
    expect(isSafeActionUrl("blob:https://example.com/1234")).toBe(false);
    expect(isSafeActionUrl("https://127.0.0.1/admin")).toBe(false);
    expect(isSafeActionUrl("https://169.254.169.254/latest/meta-data")).toBe(false);
    expect(isSafeActionUrl("https://internal.service.local/dashboard")).toBe(false);
    expect(isSafeActionUrl("https://user:password@example.com/login")).toBe(false);
    expect(isSafeActionUrl("https://example.com/api?token=secret123")).toBe(false);
    expect(isSafeActionUrl("https://s3.amazonaws.com/doc?X-Amz-Signature=abc")).toBe(false);
  });

  it("projects raw cards into typed VerifiedCard records safely", () => {
    const rawCards = [
      {
        id: "card-dublin-trail-2026",
        card_type: "ACTIVITY",
        title: "2026 Dublin Trail Challenge",
        subtitle: "City of Dublin Parks & Rec",
        summary: "Annual community health initiative.",
        badge: "Open Registration",
        timeframe: "September 7 – October 11, 2026",
        cost: "Free",
        actions: [
          {
            label: "Register for Challenge",
            url: "https://runsignup.com/Race/CA/Dublin/DublinTrailChallenge",
            primary: true,
          },
          {
            label: "Unsafe Action",
            url: "javascript:alert(1)",
          },
        ],
        verification_note: "Official portal verified with City staff",
        verified_at: "October 2, 2026",
      },
      {
        id: "card-unknown-type",
        card_type: "INVALID_KIND",
        title: "Default Fallback Entity",
      },
      {
        id: "card-missing-title",
        title: "",
      },
    ];

    const cards = getArticleCards(rawCards);
    expect(cards).toHaveLength(2);

    const first = cards[0];
    expect(first.id).toBe("card-dublin-trail-2026");
    expect(first.cardType).toBe("ACTIVITY");
    expect(first.title).toBe("2026 Dublin Trail Challenge");
    expect(first.subtitle).toBe("City of Dublin Parks & Rec");
    expect(first.badge).toBe("Open Registration");
    expect(first.facts).toEqual([
      { label: "Timeframe", value: "September 7 – October 11, 2026" },
      { label: "Cost", value: "Free" },
    ]);
    expect(first.actions).toEqual([
      {
        label: "Register for Challenge",
        url: "https://runsignup.com/Race/CA/Dublin/DublinTrailChallenge",
        primary: true,
      },
    ]);
    expect(first.verificationNote).toBe("Official portal verified with City staff");
    expect(first.verifiedAt).toBe("October 2, 2026");

    // Unknown card_type defaults safely to PLACE
    expect(cards[1].cardType).toBe("PLACE");
    expect(cards[1].title).toBe("Default Fallback Entity");
  });

  it("renders broadsheet verified card and section elements without throwing", () => {
    const cards = getArticleCards([
      {
        id: "card-museum",
        card_type: "PLACE",
        title: "Museum on Main",
        address: "603 Main Street, Pleasanton, CA 94566",
        phone: "(925) 462-2766",
        actions: [
          {
            label: "Buy Tickets",
            url: "https://www.museumonmain.org/ghost-walk.html",
            primary: true,
          },
        ],
      },
    ]);

    const singleHtml = JSON.stringify(VerifiedCardComponent({ card: cards[0] }));
    expect(singleHtml).toContain("Museum on Main");
    expect(singleHtml).toContain("603 Main Street, Pleasanton, CA 94566");
    expect(singleHtml).toContain("tel:9254622766");
    expect(singleHtml).toContain("Buy Tickets");
    expect(singleHtml).toContain("article-verified-card");

    const sectionHtml = JSON.stringify(VerifiedCardSection({ cards }));
    expect(sectionHtml).toContain("article-verified-card-section");

    // Empty section renders null
    expect(VerifiedCardSection({})).toBeNull();
    expect(VerifiedCardSection({ cards: [] })).toBeNull();
  });
});
