import { describe, expect, it } from "vitest";
import { canHostMeetup, isAdult, prepareMeetup, screenMessage, type PublicPlace } from "./meet";

const places: PublicPlace[] = [{ id: "civic", name: "Civic Park", detail: "Downtown park" }];
const now = new Date("2026-09-23T18:00:00.000Z");

describe("meet safety", () => {
  it("requires 18 years and a two-day-old account to host", () => {
    expect(isAdult("2008-09-23", now)).toBe(true);
    expect(isAdult("2008-09-24", now)).toBe(false);
    expect(isAdult("не-дата", now)).toBe(false);
    expect(canHostMeetup("2026-09-20T18:00:00.000Z", now)).toBe(true);
    expect(canHostMeetup("2026-09-22T18:00:00.000Z", now)).toBe(false);
  });

  it("keeps phone numbers and emails out of the chat", () => {
    expect(screenMessage("See you by the fountain.").ok).toBe(true);
    expect(screenMessage("Text me at 925-555-0134").ok).toBe(false);
    expect(screenMessage("mail me at ada@example.com").ok).toBe(false);
    expect(screenMessage("Привет 😀").ok).toBe(true);
  });

  it("only accepts a listed public place", () => {
    expect(() => prepareMeetup({
      activity: "coffee",
      placeId: "my-house",
      startsAt: "2026-09-24T18:00:00.000Z",
    }, places, now)).toThrow(/public place/);
    const meetup = prepareMeetup({
      activity: "pickleball",
      placeId: "civic",
      startsAt: "2026-09-24T18:00:00.000Z",
      capacity: 4,
      notes: "Bring a paddle if you have one.",
    }, places, now);
    expect(meetup.placeName).toBe("Civic Park");
    expect(meetup.capacity).toBe(4);
  });
});
