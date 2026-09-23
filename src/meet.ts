/** Rules for in-person meetups and the paper's chat. */

export const MEET_ACTIVITIES = [
  { value: "coffee", label: "Coffee" },
  { value: "walk", label: "Walk" },
  { value: "hike", label: "Hike" },
  { value: "pickleball", label: "Pickleball" },
  { value: "tennis", label: "Tennis" },
  { value: "bike", label: "Bike ride" },
  { value: "dogs", label: "Dog walk" },
  { value: "books", label: "Book club" },
  { value: "games", label: "Board games" },
  { value: "kids", label: "Kids outing" },
  { value: "volunteer", label: "Volunteer" },
  { value: "other", label: "Something else" },
] as const;

export type MeetActivity = (typeof MEET_ACTIVITIES)[number]["value"];

export type PublicPlace = { id: string; name: string; detail: string };

export type MeetupInput = {
  activity?: unknown;
  otherLabel?: unknown;
  placeId?: unknown;
  startsAt?: unknown;
  notes?: unknown;
  capacity?: unknown;
};

export type PreparedMeetup = {
  activity: MeetActivity;
  activityLabel: string;
  placeId: string;
  placeName: string;
  placeDetail: string;
  startsAt: string;
  notes: string;
  capacity: number;
};

const HOST_WAIT_MS = 48 * 60 * 60 * 1000;

export function isAdult(bornOn: string, now = new Date()): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(bornOn)) return false;
  const born = new Date(`${bornOn}T00:00:00.000Z`);
  if (Number.isNaN(born.getTime())) return false;
  const adult = new Date(born);
  adult.setUTCFullYear(adult.getUTCFullYear() + 18);
  return adult.getTime() <= now.getTime();
}

export function canHostMeetup(accountCreatedAt: string, now = new Date()): boolean {
  const created = Date.parse(accountCreatedAt);
  return Number.isFinite(created) && now.getTime() - created >= HOST_WAIT_MS;
}

/** Refuse phone numbers, email addresses, and contact links. */
export function screenMessage(value: string): { ok: true; text: string } | { ok: false; reason: string } {
  const text = Array.from(value.trim()).slice(0, 1000).join("");
  if (Array.from(text).length < 1) return { ok: false, reason: "Write a short message." };
  if (/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i.test(text)) return { ok: false, reason: "Share an email in person, not in the chat." };
  if (/(https?:\/\/|www\.)\S+/i.test(text)) return { ok: false, reason: "Links are not allowed in the chat." };
  const digits = text.replace(/\D/g, "");
  if (digits.length >= 10) return { ok: false, reason: "Share a phone number in person, not in the chat." };
  return { ok: true, text };
}

export function activityLabel(value: string, otherLabel = ""): string {
  if (value === "other") return Array.from(otherLabel.trim()).slice(0, 40).join("") || "Something else";
  return MEET_ACTIVITIES.find(item => item.value === value)?.label ?? "";
}

export function prepareMeetup(input: MeetupInput, places: PublicPlace[], now = new Date()): PreparedMeetup {
  const activity = typeof input.activity === "string" ? input.activity : "";
  if (!MEET_ACTIVITIES.some(item => item.value === activity)) throw new Error("Choose an activity.");
  const label = activityLabel(activity, typeof input.otherLabel === "string" ? input.otherLabel : "");
  if (activity === "other" && label === "Something else" && !String(input.otherLabel ?? "").trim()) {
    throw new Error("Name the activity.");
  }
  const place = places.find(item => item.id === input.placeId);
  if (!place) throw new Error("Choose a public place.");
  const starts = typeof input.startsAt === "string" ? Date.parse(input.startsAt) : NaN;
  if (!Number.isFinite(starts) || starts < now.getTime() + 60 * 60 * 1000) {
    throw new Error("Choose a time at least an hour from now.");
  }
  const notes = screenMessage(typeof input.notes === "string" && input.notes.trim() ? input.notes : "Meet at the public place.");
  if (!notes.ok) throw new Error(notes.reason);
  const capacity = Number(input.capacity ?? 6);
  if (!Number.isInteger(capacity) || capacity < 2 || capacity > 12) throw new Error("Choose a group size from 2 to 12.");
  return {
    activity: activity as MeetActivity,
    activityLabel: label,
    placeId: place.id,
    placeName: place.name,
    placeDetail: place.detail,
    startsAt: new Date(starts).toISOString(),
    notes: notes.text,
    capacity,
  };
}
