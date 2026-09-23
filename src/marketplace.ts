/** Shared jobs and classifieds rules for a local paper. API calls stay in the site. */

export const JOB_EMPLOYMENT_TYPES = [
  { value: "full_time", label: "Full-time" },
  { value: "part_time", label: "Part-time" },
  { value: "contract", label: "Contract" },
  { value: "temporary", label: "Temporary" },
  { value: "internship", label: "Internship" },
] as const;

export const CLASSIFIED_CATEGORIES = [
  { value: "for-sale", label: "For sale" },
  { value: "services", label: "Services" },
  { value: "housing", label: "Housing" },
  { value: "community", label: "Community" },
  { value: "wanted", label: "Wanted" },
] as const;

export type EmploymentType = (typeof JOB_EMPLOYMENT_TYPES)[number]["value"];
export type ClassifiedCategory = (typeof CLASSIFIED_CATEGORIES)[number]["value"];

export type PublicJob = {
  id: string;
  slug: string;
  title: string;
  body_md?: string;
  employment_type?: string;
  location_type?: string;
  remote_allowed?: boolean;
  published_at?: string | null;
};

export type ClassifiedListing = {
  id: string;
  title: string;
  description: string;
  category: string;
  price?: number | null;
  currency?: string;
  location?: { town?: string; region?: string } | null;
  created_at?: string;
};

export type PreparedJob = {
  title: string;
  company: string;
  town: string;
  employment_type: EmploymentType;
  description: string;
  apply_email?: string;
};

export type PreparedClassified = {
  title: string;
  description: string;
  category: ClassifiedCategory;
  price?: number;
  currency: "USD";
  location: { town: string; region: string };
  expires_at: string;
};

export function clipChars(value: string, max: number): string {
  const chars = Array.from(value.trim());
  return chars.length <= max ? chars.join("") : chars.slice(0, max).join("");
}

export function isEmploymentType(value: string): value is EmploymentType {
  return JOB_EMPLOYMENT_TYPES.some(item => item.value === value);
}

export function isClassifiedCategory(value: string): value is ClassifiedCategory {
  return CLASSIFIED_CATEGORIES.some(item => item.value === value);
}

export function employmentLabel(value?: string): string {
  return JOB_EMPLOYMENT_TYPES.find(item => item.value === value)?.label ?? "";
}

export function categoryLabel(value?: string): string {
  return CLASSIFIED_CATEGORIES.find(item => item.value === value)?.label ?? "";
}

export function publicJobsPath(query = ""): string {
  const params = new URLSearchParams({ limit: "50" });
  const q = clipChars(query, 80);
  if (q) params.set("q", q);
  return `/v1/jobs/openings/public/postings?${params}`;
}

export function publicJobPath(slug: string): string {
  return `/v1/jobs/openings/public/postings/${encodeURIComponent(slug)}`;
}

export function classifiedSearchPath(options: { query?: string; category?: string } = {}): string {
  const params = new URLSearchParams({ status: "active", limit: "50", sort_by: "newest" });
  const query = clipChars(options.query ?? "", 80);
  if (query) params.set("query", query);
  if (options.category && isClassifiedCategory(options.category)) params.set("category", options.category);
  return `/v1/listings/search?${params}`;
}

export function classifiedPath(id: string): string {
  return `/v1/listings/${encodeURIComponent(id)}`;
}

function requireText(value: unknown, label: string, max: number, min = 1): string {
  const text = clipChars(typeof value === "string" ? value : "", max);
  if (Array.from(text).length < min) throw new Error(`Please complete the ${label}.`);
  return text;
}

export function prepareJobPost(input: {
  title?: unknown;
  company?: unknown;
  town?: unknown;
  employment_type?: unknown;
  description?: unknown;
  apply_email?: unknown;
}, towns: string[]): PreparedJob {
  const title = requireText(input.title, "job title", 120);
  const company = requireText(input.company, "employer", 120);
  const town = requireText(input.town, "town", 80);
  const description = requireText(input.description, "description", 4000, 20);
  const employment = typeof input.employment_type === "string" ? input.employment_type : "";
  if (!towns.includes(town)) throw new Error("Please choose a town this paper covers.");
  if (!isEmploymentType(employment)) throw new Error("Please choose a job type.");
  const email = clipChars(typeof input.apply_email === "string" ? input.apply_email : "", 254);
  if (email && !/^[^\s@]+@[^\s@]+$/.test(email)) throw new Error("Please check the apply email.");
  return { title, company, town, employment_type: employment, description, apply_email: email || undefined };
}

export function jobEmployerBody(job: PreparedJob) {
  return { company_name: job.company, headline: `${job.company} in ${job.town}` };
}

export function jobOpeningBody(job: PreparedJob) {
  const apply = job.apply_email ? `\nApply: ${job.apply_email}` : "";
  return {
    title: job.title,
    employment_type: job.employment_type,
    location_type: "onsite",
    description_md: `${job.description}\n\nTown: ${job.town}${apply}`,
  };
}

export function jobPostingBody(job: PreparedJob) {
  return { channel: "partner_board" as const, title_override: job.title, body_md: job.description, language: "en" };
}

export function prepareClassified(input: {
  title?: unknown;
  description?: unknown;
  category?: unknown;
  town?: unknown;
  price?: unknown;
}, towns: string[], region: string, now = new Date()): PreparedClassified {
  const title = requireText(input.title, "title", 120);
  const description = requireText(input.description, "description", 4000, 20);
  const town = requireText(input.town, "town", 80);
  const category = typeof input.category === "string" ? input.category : "";
  if (!towns.includes(town)) throw new Error("Please choose a town this paper covers.");
  if (!isClassifiedCategory(category)) throw new Error("Please choose a category.");
  let price: number | undefined;
  if (input.price !== undefined && input.price !== "" && input.price !== null) {
    const parsed = Number(input.price);
    if (!Number.isInteger(parsed) || parsed < 0 || parsed > 1_000_000) throw new Error("Please check the price.");
    price = parsed;
  }
  const expires = new Date(now);
  expires.setUTCDate(expires.getUTCDate() + 30);
  return {
    title,
    description,
    category,
    price,
    currency: "USD",
    location: { town, region },
    expires_at: expires.toISOString(),
  };
}
