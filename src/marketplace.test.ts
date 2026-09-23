import { describe, expect, it } from "vitest";
import { clipChars, prepareClassified, prepareJobPost, publicJobsPath } from "./marketplace";

const towns = ["Walnut Creek", "Rossmoor"];

describe("marketplace", () => {
  it("keeps emoji intact when a field is shortened", () => {
    expect(clipChars("  Привет 😀 world", 8)).toBe("Привет 😀");
  });

  it("builds a public jobs search and refuses a town outside the paper", () => {
    expect(publicJobsPath("nurse")).toContain("q=nurse");
    expect(() => prepareJobPost({
      title: "Nurse",
      company: "Clinic",
      town: "Martinez",
      employment_type: "full_time",
      description: "A complete local job description.",
    }, towns)).toThrow(/town/);
  });

  it("accepts a job and a classified for a covered town", () => {
    const job = prepareJobPost({
      title: "Desk editor",
      company: "Walnut Creek Times",
      town: "Walnut Creek",
      employment_type: "part_time",
      description: "Cover meetings and write the next day's brief.",
      apply_email: "news@example.com",
    }, towns);
    expect(job.employment_type).toBe("part_time");
    const listing = prepareClassified({
      title: "Oak table",
      description: "A solid oak table from a Rossmoor home, pickup only.",
      category: "for-sale",
      town: "Rossmoor",
      price: "40",
    }, towns, "Walnut Creek", new Date("2026-09-22T00:00:00.000Z"));
    expect(listing.location.region).toBe("Walnut Creek");
    expect(listing.expires_at.startsWith("2026-10-22")).toBe(true);
    expect(listing.price).toBe(40);
  });
});
