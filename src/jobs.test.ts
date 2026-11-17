import { describe, expect, it } from "vitest";
import {
  classifyProfession,
  cleanJobTitle,
  dedupeJobs,
  filterJobs,
  formatPayExact,
  formatPayShort,
  groupJobs,
  jobDescription,
  jobFacets,
  jobsBoardHref,
  jobsBoardState,
  parseJob,
  payUnit,
  relatedJobs,
  topPaidJobs,
} from "./jobs";
import type { PublicJob } from "./marketplace";

const seeded = (overrides: Partial<PublicJob> & { title: string }, lines: string[] = []): PublicJob => ({
  id: overrides.id ?? overrides.title,
  slug: overrides.slug ?? overrides.title.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
  employment_type: "full_time",
  location_type: "onsite",
  body_md: lines.join("\n"),
  ...overrides,
});

const county = seeded(
  { title: "Information Systems Programmer and Analyst IV — Contra Costa County (Alamo, CA)" },
  [
    "Contra Costa County is hiring for Information Systems Programmer and Analyst IV in Alamo, CA.",
    "",
    "Location: Alamo, CA (On-site)",
    "Employer: Contra Costa County · County Government & Health Services",
    "Employment Type: Full-time",
    "Department / Division: County-Wide",
    "Compensation: $119,438.27 – $160,058.65 per year",
    "",
    "Role Overview:",
    "Why join Contra Costa County? For more details, please...",
    "",
    "Apply on Contra Costa County's official career page: https://www.governmentjobs.com/careers/contracosta/jobs/5537300/x",
    "Employer website: https://www.contracosta.ca.gov",
  ],
);

describe("parseJob", () => {
  it("reads role, employer, town, pay and the application page out of a posting", () => {
    const job = parseJob(county);
    expect(job.title).toBe("Information Systems Programmer and Analyst IV");
    expect(job.employer).toBe("Contra Costa County");
    expect(job.sector).toBe("County Government & Health Services");
    expect(job.town).toBe("Alamo");
    expect(job.workplace).toBe("On-site");
    expect(job.department).toBe("County-Wide");
    expect(job.profession).toBe("technology");
    expect(job.pay).toMatchObject({ min: 119438.27, max: 160058.65, period: "year" });
    expect(job.applyHost).toBe("governmentjobs.com");
    expect(job.website).toBe("https://www.contracosta.ca.gov/");
    expect(job.paragraphs).toEqual(["Why join Contra Costa County? For more details, please..."]);
    expect(job.truncated).toBe(true);
  });

  it("keeps an employer whose own name carries brackets", () => {
    const job = parseJob(seeded({ title: "Engineering Aide (Part-time) — East Bay Municipal Utility District (EBMUD) (Alamo, CA)" }));
    expect(job.title).toBe("Engineering Aide (Part-time)");
    expect(job.employer).toBe("East Bay Municipal Utility District (EBMUD)");
    expect(job.town).toBe("Alamo");
  });

  it("prefers the typed salary fields over the text line", () => {
    const job = parseJob({ ...county, salary_min_minor: 2238, salary_max_minor: 2355, salary_period: "hourly" });
    expect(job.pay).toMatchObject({ min: 22.38, max: 23.55, period: "hour" });
    expect(formatPayShort(job.pay!)).toBe("$22.38–$23.55");
    expect(payUnit(job.pay!)).toBe("an hour");
  });

  it("shows a reader-submitted job without inventing facts", () => {
    const job = parseJob({ id: "1", slug: "barista", title: "Бариста ☕ 咖啡师", body_md: "Утренние смены 😀 в кафе.\n\nTown: Danville\nApply: jobs@example.com", employment_type: "part_time" });
    expect(job.title).toBe("Бариста ☕ 咖啡师");
    expect(job.employer).toBe("");
    expect(job.town).toBe("Danville");
    expect(job.applyEmail).toBe("jobs@example.com");
    expect(job.applyUrl).toBeUndefined();
    expect(job.pay).toBeNull();
    expect(job.schedule).toBe("Part-time");
    expect(job.paragraphs).toEqual(["Утренние смены 😀 в кафе."]);
    expect(job.truncated).toBe(false);
  });

  it("refuses an application link that is not https", () => {
    expect(parseJob(seeded({ title: "Clerk" }, ["Apply: javascript:alert(1)"])).applyUrl).toBeUndefined();
    expect(parseJob(seeded({ title: "Clerk" }, ["Apply on Acme's official career page: http://acme.example/jobs"])).applyUrl).toBeUndefined();
  });
});

describe("titles and professions", () => {
  it("drops scheduling codes but keeps the role", () => {
    expect(cleanJobTitle("RN - Supervisor - Telephone Triage Program - Full Time - 8 Hour - Days Walnut Creek, CA")).toBe("RN - Supervisor - Telephone Triage Program");
    expect(cleanJobTitle("Special Education Assistant I - IEP @ Northgate High School,")).toBe("Special Education Assistant I - IEP @ Northgate High School");
    expect(cleanJobTitle("Full Time Nanny")).toBe("Full Time Nanny");
  });

  it("files a role by what the person does, not by who employs them", () => {
    expect(classifyProfession("Business Partner-Senior - Human Resources", "Clinical & Hospital Operations", "Healthcare")).toBe("office");
    expect(classifyProfession("Institutional Services Worker - Generalist (Hospital Janitorial Services)")).toBe("trades");
    expect(classifyProfession("Senior Test Automation Engineer, Python")).toBe("technology");
    expect(classifyProfession("Associate Civil Engineer")).toBe("engineering");
    expect(classifyProfession("Police Officer (Lateral)", "", "Regional Parks & Conservation")).toBe("public-safety");
    expect(classifyProfession("Client Onboarding Senior Associate", "Fund Administration & Accounting")).toBe("finance");
    expect(classifyProfession("Deputy County Counsel - Exempt")).toBe("legal");
    expect(classifyProfession("Library Assistant - Advanced Level")).toBe("education");
    expect(classifyProfession("Ambassador")).toBe("other");
  });
});

describe("board", () => {
  const jobs = [
    county,
    seeded({ title: "Deputy County Counsel - Exempt — Contra Costa County (Alamo, CA)" }, ["Employer: Contra Costa County · County Government", "Compensation: $178,108.20 – $211,714.66 per year"]),
    seeded({ title: "Park Ranger — East Bay Regional Park District (Alamo, CA)", employment_type: "temporary" }, ["Compensation: $22.38 – $23.55 per hour"]),
    seeded({ title: "Key Holder — VICI Collection (Walnut Creek, CA)" }),
    seeded({ id: "dup", slug: "key-holder-2", title: "Key Holder — VICI Collection (Walnut Creek, CA)" }),
  ].map(parseJob);
  const unique = dedupeJobs(jobs);

  it("shows a re-imported job once", () => {
    expect(unique).toHaveLength(4);
  });

  it("counts towns, schedules, employers and listed pay", () => {
    const facets = jobFacets(unique);
    expect(facets.towns[0]).toEqual({ value: "Alamo", label: "Alamo", count: 3 });
    expect(facets.employers).toBe(3);
    expect(facets.payListed).toBe(3);
    expect(facets.schedules.map(item => item.label)).toContain("Temporary");
  });

  it("groups by profession with the best-paid role first and other roles last", () => {
    const groups = groupJobs(unique, "profession");
    expect(groups.map(group => group.key)).toEqual(["legal", "parks", "retail", "technology"]);
    expect(groupJobs(unique, "employer")[0]).toMatchObject({ label: "Contra Costa County" });
    expect(groupJobs(unique, "employer")[0].jobs[0].title).toBe("Deputy County Counsel - Exempt");
    const byPay = groupJobs(unique, "pay");
    expect(byPay[0].jobs.map(job => job.title)).toEqual(["Deputy County Counsel - Exempt", "Information Systems Programmer and Analyst IV", "Park Ranger"]);
    expect(byPay[1].jobs).toHaveLength(1);
  });

  it("narrows by the choices in the address and builds the address back", () => {
    const state = jobsBoardState({ view: "pay", town: "Alamo", pay: "1", type: ["temporary", "x"], junk: "1" });
    expect(state).toEqual({ view: "pay", town: "Alamo", schedule: "temporary", profession: "", payOnly: true, query: "" });
    expect(filterJobs(unique, state).map(job => job.title)).toEqual(["Park Ranger"]);
    expect(jobsBoardHref(state, { town: "" })).toBe("/jobs?view=pay&type=temporary&pay=1");
    expect(jobsBoardHref(jobsBoardState())).toBe("/jobs");
    expect(Array.from(jobsBoardState({ view: "nonsense", q: "Привет 😀".repeat(30) }).query)).toHaveLength(80);
  });

  it("ranks pay, relates openings and writes a summary", () => {
    expect(topPaidJobs(unique, 2).map(job => job.title)).toEqual(["Deputy County Counsel - Exempt", "Information Systems Programmer and Analyst IV"]);
    const related = relatedJobs(unique[0], unique);
    expect(related.sameEmployer.map(job => job.title)).toEqual(["Deputy County Counsel - Exempt"]);
    expect(related.sameProfession).toEqual([]);
    expect(formatPayExact(unique[0].pay!)).toBe("$119,438 – $160,059");
    expect(formatPayShort(unique[0].pay!)).toBe("$119k–$160k");
    expect(jobDescription(unique[0], "Alamo Weekly")).toBe("Information Systems Programmer and Analyst IV at Contra Costa County in Alamo. Full-time. Pay $119,438 – $160,059 a year. Listed on Alamo Weekly.");
  });
});
