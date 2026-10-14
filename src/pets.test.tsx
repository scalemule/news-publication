import React from "react";
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import {
  adoptionAvailability,
  petProfileMetadata,
  petReferences,
  preparePawWalk,
  resolvePetCommunity,
  safePetLink,
  type PetResource,
} from "./pets";
import { PetsSection, SponsorAcknowledgment } from "./pets-view";
import { openPawFlow, sealPawFlow } from "./pets-auth-server";
const id = "019a1234-1234-7123-8123-123456789abc";
describe("pet publication boundaries", () => {
  it("constrains community choices to actual coverage and preserves regional defaults", () => {
    const areas = [{ id, slug: "us-ca-dublin", name: "Dublin" }];
    expect(resolvePetCommunity(areas, "uncovered", "us-ca-dublin")?.id).toBe(
      id,
    );
    expect(resolvePetCommunity(areas, "uncovered")).toBeUndefined();
    expect(resolvePetCommunity(areas)).toBeUndefined();
  });
  it("only accepts stable references, without copying private metadata", () => {
    expect(
      petReferences({
        pet_resources: [
          {
            collection_slug: "pets",
            id,
            kind: "profile",
            owner_email: "private@example.test",
          },
          { collection_slug: "../private", id, kind: "profile" },
        ],
      }),
    ).toEqual([{ collection_slug: "pets", id, kind: "profile" }]);
    expect(
      petReferences({
        pet_resources: [
          {
            collection_slug: "pets",
            id: "00000000-0000-0000-0000-000000000000",
            kind: "profile",
          },
        ],
      }),
    ).toEqual([]);
  });
  it("does not imply current adoption availability from a stale or future source", () => {
    const now = Date.parse("2026-10-14T12:00:00Z"),
      source = {
        organization: "Test shelter",
        official_url: "https://shelter.example.test",
        availability_confirmed: true,
        verified_at: "2026-10-14T11:00:00Z",
      };
    expect(adoptionAvailability(source, now)).toBe("confirmed");
    expect(
      adoptionAvailability(
        { ...source, verified_at: "2026-10-12T11:00:00Z" },
        now,
      ),
    ).toBe("check_with_organization");
    expect(
      adoptionAvailability(
        { ...source, verified_at: "2026-10-15T11:00:00Z" },
        now,
      ),
    ).toBe("check_with_organization");
    expect(adoptionAvailability(null, now)).toBe("check_with_organization");
  });
  it("does not emit private/unavailable profile OG data", () => {
    expect(
      petProfileMetadata(null, "https://example.test/pets/secret"),
    ).toEqual({
      title: "Pet profile unavailable",
      robots: { index: false, follow: false },
    });
  });
  it("rejects executable, credential-bearing and protocol-relative links", () => {
    for (const url of [
      "javascript:alert(1)",
      "//evil.example",
      "/\\evil.example",
      "https://user:pass@example.test",
      "data:text/html,test",
    ])
      expect(safePetLink(url)).toBeUndefined();
    expect(safePetLink("/pets/" + id)).toBe("/pets/" + id);
  });
  it("bounds existing Meet dog-walk extensions", () => {
    const input = {
      duration_minutes: 30,
      distance_km: 1.5,
      leash: "required" as const,
      size_guidance: "Any size",
      accessibility: "Check the public venue",
    };
    expect(preparePawWalk(input)).toEqual(input);
    expect(() => preparePawWalk({ ...input, distance_km: NaN })).toThrow();
    expect(() => preparePawWalk({ ...input, duration_minutes: 0 })).toThrow();
  });
  it("renders an honest empty state without fabricated pets, photos or sponsorships", () => {
    const html = renderToStaticMarkup(
      <PetsSection communities={[]} resources={[]} mediaUrl={() => ""} />,
    );
    expect(html).toContain("Bay Area Paw");
    expect(html).toContain("No current, reviewed notices");
    expect(html).not.toContain("Joybound");
    expect(html).not.toContain("<img");
    expect(html).not.toContain("iframe");
  });
  it("renders the collection-managed cover and refuses unsafe cover URLs", () => {
    const base = { communities: [], resources: [], mediaUrl: () => "" };
    const fallback = renderToStaticMarkup(<PetsSection {...base} />);
    expect(fallback).toContain("Boyko Mihaylov");
    expect(fallback).toContain("cdn-public.scalemule.com");

    const managed = renderToStaticMarkup(
      <PetsSection
        {...base}
        coverPhoto={{
          url: "https://cdn-public.scalemule.com/app/anonymous/photos/p/w800.webp",
          alt: "A seasonal cover — Джаспър 🐾",
          credit: "Community photographer",
          credit_url: "https://example.com/photographer",
        }}
      />,
    );
    expect(managed).toContain("w800.webp");
    expect(managed).toContain("Community photographer");
    expect(managed).toContain("https://example.com/photographer");
    expect(managed).not.toContain("Boyko Mihaylov");

    for (const url of [
      "http://insecure.example/x.webp",
      'https://x/" onload="alert(1)',
      "javascript:alert(1)",
    ]) {
      const html = renderToStaticMarkup(
        <PetsSection
          {...base}
          coverPhoto={{ url, alt: "a", credit: "c", credit_url: url }}
        />,
      );
      expect(html).toContain("Boyko Mihaylov");
      expect(html).not.toContain("alert(1)");
    }
  });
  it("never treats an upstream outage as an empty lost-pet board", () => {
    const html = renderToStaticMarkup(
      <PetsSection
        communities={[]}
        resources={[]}
        mediaUrl={() => ""}
        unavailable
      />,
    );
    expect(html).toContain("can’t load");
    expect(html).not.toContain("No current, reviewed notices");
    expect(html).not.toContain("ready for its first neighbors");
  });
  it("removes expired paid sponsorship acknowledgments", () => {
    const html = renderToStaticMarkup(
      <SponsorAcknowledgment
        now={2000}
        acknowledgment={{
          campaign_id: id,
          placement_id: id,
          publication_id: id,
          sponsor_id: id,
          placement_type: "community_partner",
          creative: { name: "Test sponsor", description: "" },
          starts_at: new Date(0).toISOString(),
          ends_at: new Date(1000).toISOString(),
        }}
      />,
    );
    expect(html).toBe("");
  });
});
describe("network sign-in CSRF binding", () => {
  it("binds state, app secret, expiry and same-site return path", () => {
    const flow = sealPawFlow(
      "state",
      "//evil.example",
      "isolated-test-key",
      1000,
    );
    expect(openPawFlow(flow, "state", "isolated-test-key", 1001)).toBe(
      "/account",
    );
    expect(openPawFlow(flow, "wrong", "isolated-test-key", 1001)).toBeNull();
    expect(openPawFlow(flow, "state", "other-app-key", 1001)).toBeNull();
    expect(openPawFlow(flow, "state", "isolated-test-key", 601001)).toBeNull();
    expect(
      openPawFlow(flow + ".extra", "state", "isolated-test-key", 1001),
    ).toBeNull();
  });
});
