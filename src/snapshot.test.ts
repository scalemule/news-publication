import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { syncPublication, syncPublicationFile, type PublicationRecord } from "./snapshot";

const record: PublicationRecord = {
  slug: "walnutcreektimes",
  name: "Walnut Creek Times",
  masthead: ["Walnut", "Creek", "Times"],
  region: "Walnut Creek",
  regionLabel: "Walnut Creek",
  towns: ["Walnut Creek", "Rossmoor", "Saranap", "Pleasant Hill"],
  description: "Local news from Walnut Creek.",
  features: { smile: true, coupons: true },
  coupons: { offers: [{ code: "LOCAL1", label: "Intro", percentOff: 87.5 }] },
};

const previous = {
  version: 1 as const,
  syncedAt: "2026-09-18T00:00:00.000Z",
  record,
};

describe("publication snapshot", () => {
  it("keeps a days-old snapshot when the application cannot be reached", async () => {
    const now = Date.parse("2026-09-22T00:00:00.000Z");
    const synced = await syncPublication({
      previous,
      now,
      fetchRecord: async () => { throw new Error("gateway timeout"); },
    });
    expect(synced.source).toBe("retained");
    expect(synced.ageMs).toBe(4 * 24 * 60 * 60 * 1000);
    expect(synced.publication.name).toBe("Walnut Creek Times");
    expect(synced.publication.towns).toEqual(record.towns);
    expect(synced.publication.features.smile).toBe(true);
  });

  it("refuses a partial or foreign payload and leaves the previous config untouched", async () => {
    const truncated = await syncPublication({
      previous,
      fetchRecord: async () => ({ slug: "walnutcreektimes", name: "Walnut Creek Times" }),
    });
    expect(truncated.source).toBe("retained");
    expect(truncated.snapshot.record.towns).toHaveLength(4);

    const otherPaper = await syncPublication({
      previous,
      expectedSlug: "walnutcreektimes",
      fetchRecord: async () => ({ ...record, slug: "napagate", name: "Napa Gate" }),
    });
    expect(otherPaper.source).toBe("retained");
    expect(otherPaper.publication.slug).toBe("walnutcreektimes");
  });

  it("replaces the file only after a complete record, and a later outage keeps that file", async () => {
    const dir = await mkdtemp(join(tmpdir(), "news-publication-"));
    const file = join(dir, "publication.snapshot.json");
    await writeFile(file, `${JSON.stringify(previous)}\n`, "utf8");
    const before = await readFile(file, "utf8");

    const duringOutage = await syncPublicationFile({
      file,
      expectedSlug: "walnutcreektimes",
      now: Date.parse("2026-09-22T12:00:00.000Z"),
      fetchRecord: async () => { throw new Error("connect ECONNREFUSED"); },
    });
    expect(duringOutage.source).toBe("retained");
    expect(await readFile(file, "utf8")).toBe(before);

    const updated = await syncPublicationFile({
      file,
      expectedSlug: "walnutcreektimes",
      now: Date.parse("2026-09-22T18:00:00.000Z"),
      fetchRecord: async () => ({ ...record, tagline: "Городские истории 😀" }),
    });
    expect(updated.source).toBe("fresh");
    expect(updated.publication.tagline).toBe("Городские истории 😀");
    const stored = JSON.parse(await readFile(file, "utf8")) as { record: PublicationRecord };
    expect(stored.record.tagline).toBe("Городские истории 😀");

    await syncPublicationFile({
      file,
      fetchRecord: async () => { throw new Error("still down"); },
    });
    expect(JSON.parse(await readFile(file, "utf8")).record.tagline).toBe("Городские истории 😀");
  });
});
