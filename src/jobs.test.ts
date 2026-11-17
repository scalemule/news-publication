import { describe, expect, it } from "vitest";
import {
  classifyProfession,
  cleanJobTitle,
  dedupeJobs,
  filterJobs,
  formatPayExact,
  formatPayShort,
  groupJobs,
  jobBodyBlocks,
  jobDescription,
  jobFacets,
  jobsBoardHref,
  jobsBoardState,
  parseJob,
  payUnit,
  relatedJobs,
  topPaidJobs,
} from "./jobs";
import { jobPostingBody, prepareJobPost, type PublicJob } from "./marketplace";

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
    expect(job.brief).toBe(true);
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
    expect(parseJob(seeded({ title: "Clerk" }, ["Work the front desk. ".repeat(20)])).brief).toBe(false);
  });

  it("only ever links to an https web address", () => {
    expect(parseJob(seeded({ title: "Clerk" }, ["Apply: jobs@example.com?bcc=other@example.net&body=x"])).applyEmail).toBeUndefined();
    expect(parseJob(seeded({ title: "Clerk" }, ["Apply: javascript:alert(1)"])).applyUrl).toBeUndefined();
    expect(parseJob(seeded({ title: "Clerk" }, ["Apply on Acme's official career page: http://acme.example/jobs"])).applyUrl).toBe("https://acme.example/jobs");
    expect(parseJob(seeded({ title: "Clerk" }, ["Apply: data:text/html,hello"])).applyUrl).toBeUndefined();
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

describe("jobBodyBlocks", () => {
  it("turns bullet lines into one list and an introducing short line into a sub-heading", () => {
    expect(jobBodyBlocks([
      "We are seeking a skilled Line Cook to join the team.",
      "What You'll Do",
      "• Prepare food for 350 guests",
      "- Keep the station clean",
      "2) Check deliveries",
      "Requirements:",
      "• 2+ years of experience",
    ])).toEqual([
      { kind: "text", text: "We are seeking a skilled Line Cook to join the team." },
      { kind: "heading", text: "What You'll Do" },
      { kind: "list", items: ["Prepare food for 350 guests", "Keep the station clean", "Check deliveries"] },
      { kind: "heading", text: "Requirements" },
      { kind: "list", items: ["2+ years of experience"] },
    ]);
  });

  it("keeps short runs, closing lines and non-Latin text as written", () => {
    expect(jobBodyBlocks(["Acme Bakery", "12 Main Street", "Open daily and hiring now for the holiday season."]).map(block => block.kind)).toEqual(["text", "text", "text"]);
    expect(jobBodyBlocks(["Thanks for reading"])).toEqual([{ kind: "text", text: "Thanks for reading" }]);
    expect(jobBodyBlocks(["#LI-Associate", "Veeva is an equal opportunity employer."])[0].kind).toBe("text");
    expect(jobBodyBlocks(["Обязанности", "• Готовить кофе ☕", "職務内容", "お客様への対応をお願いします。"])).toEqual([
      { kind: "heading", text: "Обязанности" },
      { kind: "list", items: ["Готовить кофе ☕"] },
      { kind: "heading", text: "職務内容" },
      { kind: "text", text: "お客様への対応をお願いします。" },
    ]);
    expect(jobBodyBlocks(["-5% is not a bullet, and neither is this.", "Email jobs@example.com", "Pay is $20-25 an hour."]).map(block => block.kind)).toEqual(["text", "text", "text"]);
  });
});

describe("review regressions", () => {
  const withPay = (line: string) => parseJob(seeded({ title: "Clerk" }, [`Compensation: ${line}`]));

  it("reads pay as written and leaves a doubtful figure unlisted", () => {
    expect(withPay("$65K – $80K per year").pay).toMatchObject({ min: 65000, max: 80000, period: "year" });
    expect(withPay("$65k-$80k").pay).toMatchObject({ min: 65000, max: 80000, period: "year" });
    expect(withPay("$22 hourly ($45,760 yearly)").pay).toMatchObject({ min: 22, max: 22, period: "hour" });
    expect(withPay("$25/hour plus $1,000 signing bonus").pay).toMatchObject({ min: 25, max: 25, period: "hour" });
    expect(withPay("$20,000/yr").pay).toMatchObject({ min: 20000, period: "year" });
    expect(withPay("$4,500 – $5,200 per month").pay).toMatchObject({ min: 4500, max: 5200, period: "month" });
    expect(withPay("$80,000 – $65,000 a year").pay).toMatchObject({ min: 65000, max: 80000 });
    expect(withPay("$5,000 signing bonus; salary DOE").pay).toBeNull();
    expect(withPay("$5,000 signing bonus; salary DOE").paragraphs).toEqual(["Compensation: $5,000 signing bonus; salary DOE"]);
    expect(withPay("DOE").paragraphs).toEqual(["Compensation: DOE"]);
    expect(parseJob({ ...county, salary_min_minor: null, salary_max_minor: 9_000_000, salary_period: null }).pay).toMatchObject({ min: 90000, max: 90000, period: "year" });
    expect(parseJob({ ...county, body_md: "", salary_min_minor: 500_000, salary_period: null }).pay).toBeNull();
    expect(parseJob({ ...county, body_md: "", salary_min_minor: 5_000_000, salary_currency: "EUR", salary_period: "yearly" }).pay).toBeNull();
  });

  it("keeps a line it could not turn into a button", () => {
    const job = parseJob(seeded({ title: "Clerk" }, ["Apply: call 925-555-1212", "Apply on Acme's official career page: ftp://acme.example/jobs", "Employer website: ftp://acme.example"]));
    expect(job.applyUrl).toBeUndefined();
    expect(job.applyEmail).toBeUndefined();
    expect(job.paragraphs).toEqual(["Apply: call 925-555-1212", "Apply on Acme's official career page: ftp://acme.example/jobs", "Employer website: ftp://acme.example"]);
    expect(parseJob(seeded({ title: "Clerk" }, ["Apply: mailto:jobs@example.com"])).applyEmail).toBeUndefined();
  });

  it("does not hide real openings as duplicates", () => {
    const cafes = dedupeJobs([parseJob({ id: "1", slug: "barista-a", title: "Barista", body_md: "Morning shifts." }), parseJob({ id: "2", slug: "barista-b", title: "Barista", body_md: "Evening shifts." })]);
    expect(cafes).toHaveLength(2);
    const shifts = dedupeJobs([
      parseJob(seeded({ slug: "rn-days", title: "Registered Nurse - Days — John Muir Health (Walnut Creek, CA)" })),
      parseJob(seeded({ slug: "rn-nights", title: "Registered Nurse - Nights — John Muir Health (Walnut Creek, CA)" })),
    ]);
    expect(shifts.map(job => job.title)).toEqual(["Registered Nurse - Days", "Registered Nurse - Nights"]);
    const twin = seeded({ slug: "key-holder-2", title: "Key Holder — VICI Collection (Walnut Creek, CA)" });
    const original = parseJob(seeded({ slug: "key-holder", title: "Key Holder — VICI Collection (Walnut Creek, CA)" }));
    expect(relatedJobs(original, [original, parseJob(twin)]).sameEmployer).toEqual([]);
  });

  it("keeps the words of a role and of a headline", () => {
    expect(cleanJobTitle("Housekeeper - Days Inn")).toBe("Housekeeper - Days Inn");
    expect(cleanJobTitle("Nurse - Night Shift Supervisor")).toBe("Nurse - Night Shift Supervisor");
    expect(cleanJobTitle("Nurse - Full Time Oncology")).toBe("Nurse - Full Time Oncology");
    const plain = parseJob({ id: "1", slug: "barista", title: "Barista — weekend shifts", body_md: "Acme is hiring two baristas for our new shop in Alamo.\nCall 555-1212." });
    expect(plain.title).toBe("Barista — weekend shifts");
    expect(plain.employer).toBe("");
    expect(plain.paragraphs).toEqual(["Acme is hiring two baristas for our new shop in Alamo.", "Call 555-1212."]);
    expect(parseJob({ id: "1", slug: "x", title: "", body_md: "" }).title).toBe("Opening");
  });

  it("names the town and schedule the same way for the label and the filter", () => {
    expect(parseJob(seeded({ title: "Clerk" }, ["Location: Alamo, CA 94507 (On-site)"])).town).toBe("Alamo");
    expect(parseJob(seeded({ title: "Clerk", location_type: "remote" }, ["Location: Remote"]))).toMatchObject({ town: "", workplace: "Remote" });
    expect(parseJob(seeded({ title: "Clerk", employment_type: "full_time" }, ["Employment Type: Part-time"]))).toMatchObject({ schedule: "Full-time", scheduleKey: "full_time" });
    expect(parseJob(seeded({ title: "Clerk", employment_type: "temporary" }, ["Employment Type: Temporary / Seasonal"]))).toMatchObject({ schedule: "Temporary / Seasonal", scheduleKey: "temporary" });
    expect(parseJob(seeded({ title: "Clerk", employment_type: undefined }, ["Employment Type: Volunteer"]))).toMatchObject({ schedule: "Volunteer", scheduleKey: "" });
  });

  it("files look-alike titles under the right calling", () => {
    expect(classifyProfession("Principal Civil Engineer")).toBe("engineering");
    expect(classifyProfession("Assistant Principal")).toBe("education");
    expect(classifyProfession("Financial Planner")).toBe("finance");
    expect(classifyProfession("Event Planner")).toBe("office");
    expect(classifyProfession("Windows Server Administrator")).toBe("technology");
    expect(classifyProfession("Air Traffic Controller")).not.toBe("finance");
    expect(classifyProfession("Food Bank Coordinator")).toBe("office");
  });

  it("stays fast on hostile text", () => {
    const started = Date.now();
    parseJob({ id: "1", slug: "x", title: `${"a — ".repeat(8000)}`, body_md: `${"is hiring in ".repeat(3000)}\nMore.\n${"Apply on ".repeat(4000)}` });
    cleanJobTitle(`Role${" ,;-".repeat(10000)}x`);
    expect(Date.now() - started).toBeLessThan(500);
  });

  it("publishes a reader-posted job with the facts needed to act on it", () => {
    const prepared = prepareJobPost({ title: "Barista", company: "Sideboard Café", town: "Danville", employment_type: "part_time", description: "Morning shifts, tips shared. Experience preferred.", apply_email: "jobs@sideboard.example" }, ["Danville"]);
    const posted = parseJob({ id: "1", slug: "barista", title: prepared.title, body_md: jobPostingBody(prepared).body_md, employment_type: prepared.employment_type });
    expect(posted).toMatchObject({ title: "Barista", employer: "Sideboard Café", town: "Danville", applyEmail: "jobs@sideboard.example", schedule: "Part-time" });
    expect(posted.paragraphs).toEqual(["Morning shifts, tips shared. Experience preferred."]);
  });
});
