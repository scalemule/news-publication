import React from "react";
import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { SponsorAcknowledgment } from "./sponsorship-view";
import { safeSponsorUrl, SPONSORSHIP_OFFERINGS } from "./sponsorships";
import { measurementConsent } from "./measurement-consent";

describe("community acknowledgments", () => {
  it("keeps proposed rates unchanged and rejects unsafe destinations", () => {
    expect(SPONSORSHIP_OFFERINGS.map((o) => o.price_cents)).toEqual([
      35000,
      25000,
      30000,
      null,
    ]);
    for (const url of [
      "javascript:alert(1)",
      "data:text/html,a",
      "https://user:pass@example.org",
      "//example.org",
    ])
      expect(safeSponsorUrl(url)).toBeUndefined();
  });
  it("escapes multilingual copy, labels previews and never instruments them", () => {
    const html = renderToStaticMarkup(
      <SponsorAcknowledgment
        preview
        creative={{
          name: "Neighbors <script> • Съседи • 邻居 🐾",
          description: "Independent support",
          destination_url: "https://example.org",
        }}
      />,
    );
    expect(html).toContain("Illustrative preview");
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain('rel="sponsored noopener noreferrer"');
    expect(html).not.toContain("data-sponsorship=");
  });
});
describe("server measurement consent", () => {
  const now = Date.parse("2026-10-13T12:00:00Z");
  function headers(
    preferences: unknown,
    extra: Record<string, string> = {},
    timestamp = new Date(now).toISOString(),
  ) {
    return new Headers({
      cookie:
        "sm_cookie_consent_v1=" +
        encodeURIComponent(
          JSON.stringify({ version: 1, preferences, timestamp }),
        ),
      ...extra,
    });
  }
  it("requires explicit, current, correctly typed category choices", () => {
    expect(measurementConsent(new Headers(), false, now)).toBe(false);
    expect(
      measurementConsent(
        headers({ essential: true, performance: "true" }),
        false,
        now,
      ),
    ).toBe(false);
    expect(
      measurementConsent(
        headers({ essential: true, performance: true, advertising: false }),
        true,
        now,
      ),
    ).toBe(false);
    expect(
      measurementConsent(
        headers({ essential: true, performance: true, advertising: true }),
        true,
        now,
      ),
    ).toBe(true);
    expect(
      measurementConsent(
        headers(
          { essential: true, performance: true },
          {},
          "2024-01-01T00:00:00Z",
        ),
        false,
        now,
      ),
    ).toBe(false);
    expect(
      measurementConsent(
        new Headers({ cookie: "sm_cookie_consent_v1=%ZZ" }),
        false,
        now,
      ),
    ).toBe(false);
  });
  it("honors GPC and DNT even after accepting", () => {
    for (const name of ["dnt", "sec-gpc"])
      expect(
        measurementConsent(
          headers(
            { essential: true, performance: true, advertising: true },
            { [name]: "1" },
          ),
          true,
          now,
        ),
      ).toBe(false);
  });
});

import { campaignReportHtml } from "./sponsorship-report";
it("exports missing measurement as unavailable, with no fabricated zero or unsafe markup", () => {
  const missing = {
    status: "unavailable" as const,
    value: null,
    methodology: "Consent or measurement not available.",
  };
  const html = campaignReportHtml({
    campaign_id: "internal-reference",
    campaign_name: "<script>bad</script> 新闻 🐾",
    sponsor: "Community organization",
    starts_at: "2027-01-01T00:00:00Z",
    ends_at: "2027-02-01T00:00:00Z",
    status: "draft",
    generated_at: "2026-10-13T00:00:00Z",
    editorial_independence: "Independent journalism",
    reporting_note: "No estimated reach.",
    placements: [
      {
        application_id: "scope",
        publication_id: "publication",
        publication: "Local publication",
        publication_url: "https://example.org",
        placement_id: "placement",
        placement: "Calendar",
        product_path: "/this-week",
        communities: [],
        delivery_status: "not_started",
        views: missing,
        clicks: missing,
        newsletter_deliveries: missing,
      },
    ],
  });
  expect(html).toContain("&lt;script&gt;bad&lt;/script&gt; 新闻 🐾");
  expect(html).not.toContain("<script>");
  expect(html.match(/<td>Unavailable<\/td>/g)).toHaveLength(3);
});
