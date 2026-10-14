import { describe, expect, it } from "vitest";
import {
  NETWORK_NAVIGATION,
  applyNavigationConfig,
  resolveNavigation,
  type NavigationConfig,
} from "./navigation";

const NETWORK_SECTIONS = ["Civic life", "Community", "Local businesses", "Real Estate", "Food & places", "Events", "Health"];

const paper = (config?: NavigationConfig | null, extras: Partial<Parameters<typeof resolveNavigation>[0]> = {}) =>
  resolveNavigation({
    publication: "walnutcreektimes",
    sections: NETWORK_SECTIONS,
    featureEnabled: feature => ["chat", "smile", "jobs", "classifieds"].includes(feature),
    config,
    ...extras,
  });

describe("network navigation defaults", () => {
  it("orders the primary row News through Jokes with no Front page and no Jobs", () => {
    const { primary } = paper();
    expect(primary.map(item => item.label)).toEqual([
      "News", "Community", "Food & drink", "Things to do", "Health", "Real Estate", "Business", "Meet", "Jokes",
    ]);
    expect(primary.some(item => item.href === "/")).toBe(false);
    expect(primary.some(item => item.href === "/jobs")).toBe(false);
  });

  it("keeps section URLs stable while renaming Civic life to News", () => {
    const { primary } = paper();
    expect(primary[0]).toMatchObject({ label: "News", href: "/sections/civic-life" });
  });

  it("collapse priority strictly decreases along the row so trailing items overflow first", () => {
    const { primary } = paper();
    const priorities = primary.map(item => item.priority);
    expect([...priorities].sort((a, b) => b - a)).toEqual(priorities);
  });

  it("groups the More menu and only shows implemented destinations", () => {
    const { groups } = paper();
    const byId = Object.fromEntries(groups.map(group => [group.id, group.links.map(link => link.label)]));
    expect(byId["news-knowledge"]).toEqual(["Civic life"]); // AI, Schools, Environment, Transportation are not configured sections yet.
    expect(byId["local-life"]).toEqual(["Pets", "Community maps", "Town chat", "Poll"]);
    expect(byId["marketplace"]).toEqual(["Jobs", "Classifieds"]); // Autos and Local services ship disabled.
    expect(byId["publication"]).toEqual(["Latest", "This week", "Newsletter", "About", "Advertise", "Contact"]);
  });

  it("drops feature-gated products on papers without the feature", () => {
    const { primary, groups } = resolveNavigation({ publication: "napagate", sections: NETWORK_SECTIONS });
    expect(primary.map(item => item.label)).not.toContain("Meet");
    expect(primary.map(item => item.label)).not.toContain("Jokes");
    expect(groups.find(group => group.id === "marketplace")).toBeUndefined();
  });

  it("limits the poll to the Walnut Creek Times", () => {
    const { groups } = resolveNavigation({ publication: "danvilletimes", sections: NETWORK_SECTIONS });
    expect(groups.flatMap(group => group.links).map(link => link.href)).not.toContain("/polls");
  });

  it("reveals a section destination once the feed discovers the section", () => {
    const { groups } = paper(undefined, { discovered: ["Schools"] });
    expect(groups.find(group => group.id === "news-knowledge")?.links.map(link => link.label)).toContain("Schools & education");
  });

  it("routes a discovered section with no configured destination into News & knowledge", () => {
    const { primary, groups } = paper(undefined, { discovered: ["Celebrations"] });
    expect(primary.map(item => item.label)).not.toContain("Celebrations");
    expect(groups.find(group => group.id === "news-knowledge")?.links).toContainEqual(
      expect.objectContaining({ label: "Celebrations", href: "/sections/celebrations" }),
    );
  });

  it("prepares Autos but keeps it hidden until a record enables it", () => {
    expect(NETWORK_NAVIGATION.find(destination => destination.id === "autos")?.enabled).toBe(false);
    const { primary } = paper({ destinations: [{ id: "autos", enabled: true }] });
    const labels = primary.map(item => item.label);
    expect(labels.indexOf("Autos")).toBe(labels.indexOf("Real Estate") + 1);
    expect(labels.indexOf("Autos")).toBe(labels.indexOf("Business") - 1);
  });
});

describe("record overrides", () => {
  it("relabels and reorders without a release", () => {
    const { primary } = paper({ destinations: [{ id: "jokes", label: "Humor", order: 5 }] });
    expect(primary[0]).toMatchObject({ label: "Humor", href: "/smile" });
  });

  it("accepts additions that carry a safe label and href", () => {
    const { groups } = paper({
      destinations: [{ id: "voting-guide", label: "Voting guide", href: "/voting", group: "news-knowledge", more: true, order: 5 }],
    });
    expect(groups.find(group => group.id === "news-knowledge")?.links[0]).toMatchObject({ href: "/voting" });
  });

  it("ignores unsafe hrefs, oversized labels and malformed entries", () => {
    const { primary, groups } = paper({
      destinations: [
        { id: "news", href: "https://evil.example" },
        { id: "community", href: "//evil.example" },
        { id: "health", label: "x".repeat(200) },
        { id: "bogus" },
        null as never,
      ],
    });
    expect(primary.find(item => item.id === "news")?.href).toBe("/sections/civic-life");
    expect(primary.find(item => item.id === "community")?.href).toBe("/sections/community");
    expect(primary.find(item => item.id === "health")?.label).toBe("Health");
    expect([...primary, ...groups.flatMap(group => group.links)].some(item => item.id === "bogus")).toBe(false);
  });

  it("applyNavigationConfig never mutates the shipped defaults", () => {
    const before = JSON.stringify(NETWORK_NAVIGATION);
    applyNavigationConfig(NETWORK_NAVIGATION, { destinations: [{ id: "news", label: "Changed" }] });
    expect(JSON.stringify(NETWORK_NAVIGATION)).toBe(before);
  });
});

describe("featured destination", () => {
  it("shows a configured promotion inside its window and hides it outside", () => {
    const featured = { label: "Holiday lights map", href: "/holiday-lights", from: "2026-11-02T08:00:00Z", until: "2027-01-07T08:00:00Z" };
    expect(paper({ featured }, { now: new Date("2026-12-01T00:00:00Z") }).featured).toEqual({ label: "Holiday lights map", href: "/holiday-lights" });
    expect(paper({ featured }, { now: new Date("2026-10-01T00:00:00Z") }).featured).toBeUndefined();
  });

  it("distinguishes 'configured off' from 'not configured'", () => {
    expect(paper({ featured: null }).featured).toBeNull();
    expect(paper({}).featured).toBeUndefined();
  });

  it("rejects an off-site promotion", () => {
    expect(paper({ featured: { label: "Spam", href: "https://spam.example" } }).featured).toBeUndefined();
  });
});
