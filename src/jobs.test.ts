import { describe, expect, it } from "vitest";
import {
  applyButtonHost,
  classifyProfession,
  cleanEmployerName,
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
  jobSourceLine,
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

/** No half of a character pair left on its own: the text was never cut inside a character. */
const whole = (text: string): boolean => !/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/.test(text);

describe("facts the jobs API states as fields", () => {
  /** What the API sends for every posting that exists today. */
  const unfilled = { origin: "employer", employer_name: null, locality: null, region: null, apply_url: null, source_host: null, source_checked_at: null } as const;

  const description = [
    "Under general supervision, maintains school grounds, athletic fields and irrigation systems.",
    "",
    "## Essential duties",
    "* Mow, edge and water athletic fields",
    "* Repair sprinklers and report hazards",
  ].join("\n");

  const sourced = (overrides: Partial<PublicJob> = {}): PublicJob => ({
    id: "s1",
    slug: "grounds-worker-ii",
    title: "Grounds Worker II",
    origin: "sourced",
    employer_name: "Acme School District",
    locality: "Pleasant Hill",
    region: "CA",
    apply_url: "https://example.org/job/1",
    source_host: "www.edjoin.org",
    source_checked_at: "2026-11-17T20:00:00Z",
    employment_type: "full_time",
    location_type: "onsite",
    body_md: description,
    ...overrides,
  });

  it("reads a posting with only lines in its text exactly as before", () => {
    const expected = {
      id: county.id,
      slug: county.slug,
      title: "Information Systems Programmer and Analyst IV",
      rawTitle: "Information Systems Programmer and Analyst IV — Contra Costa County (Alamo, CA)",
      employer: "Contra Costa County",
      sector: "County Government & Health Services",
      town: "Alamo",
      region: "CA",
      workplace: "On-site",
      schedule: "Full-time",
      scheduleKey: "full_time",
      department: "County-Wide",
      profession: "technology",
      pay: { min: 119438.27, max: 160058.65, period: "year", annual: 160058.65 },
      applyUrl: "https://www.governmentjobs.com/careers/contracosta/jobs/5537300/x",
      applyHost: "governmentjobs.com",
      applyEmail: undefined,
      website: "https://www.contracosta.ca.gov/",
      websiteHost: "contracosta.ca.gov",
      paragraphs: ["Why join Contra Costa County? For more details, please..."],
      truncated: true,
      brief: true,
      publishedAt: undefined,
      origin: "employer",
      sourceHost: undefined,
      sourceCheckedAt: undefined,
    };
    expect(parseJob(county)).toEqual(expected);
    // The fields sent empty, blank or as something that is not text change nothing.
    expect(parseJob({ ...county, ...unfilled })).toEqual(expected);
    expect(parseJob({ ...county, employer_name: "  ", locality: "", region: "", apply_url: "" })).toEqual(expected);
    expect(parseJob({ ...county, employer_name: 7, locality: {}, apply_url: [] } as unknown as PublicJob)).toEqual(expected);
    // A source is only ever reported for a sourced listing.
    expect(parseJob({ ...county, source_host: "www.edjoin.org", source_checked_at: "2026-11-17T20:00:00Z" })).toEqual(expected);
  });

  it("reads a sourced posting from its fields and leaves the description whole", () => {
    const job = parseJob(sourced());
    expect(job).toMatchObject({
      title: "Grounds Worker II",
      employer: "Acme School District",
      town: "Pleasant Hill",
      region: "CA",
      workplace: "On-site",
      schedule: "Full-time",
      applyUrl: "https://example.org/job/1",
      applyHost: "example.org",
      origin: "sourced",
      sourceHost: "edjoin.org",
      sourceCheckedAt: "2026-11-17T20:00:00Z",
    });
    expect(job.paragraphs).toEqual([
      "Under general supervision, maintains school grounds, athletic fields and irrigation systems.",
      "## Essential duties",
      "* Mow, edge and water athletic fields",
      "* Repair sprinklers and report hazards",
    ]);
    expect(jobDescription(job, "Pleasant Hill Weekly")).toBe("Grounds Worker II at Acme School District in Pleasant Hill. Full-time. Listed on Pleasant Hill Weekly.");
    // The calling is read from the role, as before; a description is not searched for a department.
    expect(parseJob(sourced({ title: "Night Custodian" })).profession).toBe("trades");
    expect(groupJobs([job, parseJob(sourced({ id: "s2", slug: "custodian", title: "Night Custodian" }))], "employer")).toMatchObject([{ label: "Acme School District", jobs: [{ slug: "grounds-worker-ii" }, { slug: "custodian" }] }]);
  });

  it("lets a filled field win over the headline and the lines in the text", () => {
    const job = parseJob({
      ...county,
      ...unfilled,
      employer_name: "Contra Costa County Health",
      locality: "Martinez",
      region: "CA",
      apply_url: "https://jobs.cchealth.example/5537300",
    });
    expect(job).toMatchObject({
      employer: "Contra Costa County Health",
      town: "Martinez",
      region: "CA",
      applyUrl: "https://jobs.cchealth.example/5537300",
      applyHost: "jobs.cchealth.example",
      // Facts with no field of their own are still read from the text.
      sector: "County Government & Health Services",
      department: "County-Wide",
      website: "https://www.contracosta.ca.gov/",
    });
    expect(job.pay).toMatchObject({ min: 119438.27, max: 160058.65 });
    // The lines the text carried are still taken off the page.
    expect(job.paragraphs).toEqual(["Contra Costa County is hiring for Information Systems Programmer and Analyst IV in Alamo, CA.", "Why join Contra Costa County? For more details, please..."]);
    // One field filled: the others still come from the text.
    expect(parseJob({ ...county, locality: "Martinez" })).toMatchObject({ employer: "Contra Costa County", town: "Martinez", applyHost: "governmentjobs.com" });
    // A town written with its state and workplace reads the same as a bare one.
    expect(parseJob({ ...county, locality: "Martinez, CA 94553 (Hybrid)" })).toMatchObject({ town: "Martinez", region: "CA", workplace: "Hybrid" });
  });

  it("does not search a sourced description for facts or take lines out of it", () => {
    const lines = ["Location: District Office, Room 4", "Employer: Somebody Else · Education", "Apply: https://elsewhere.example/apply", "Compensation: $28–$35 / hour", "Role Overview:", "Keeps the grounds."];
    const job = parseJob(sourced({ body_md: lines.join("\n") }));
    expect(job).toMatchObject({ employer: "Acme School District", town: "Pleasant Hill", sector: "", applyUrl: "https://example.org/job/1", pay: null });
    expect(job.paragraphs).toEqual(lines);
    // The typed salary fields are where a sourced listing's pay comes from.
    expect(parseJob(sourced({ salary_min_minor: 2800, salary_max_minor: 3500, salary_period: "hourly" })).pay).toMatchObject({ min: 28, max: 35, period: "hour" });
  });

  it("ignores an application address that is not a web address", () => {
    for (const address of ["javascript:alert(1)", "mailto:jobs@example.org", "ftp://example.org/job/1", "data:text/html,hello", "/job/1", "example.org/job/1", "https://localhost/job"]) {
      const job = parseJob(sourced({ apply_url: address }));
      expect(job.applyUrl).toBeUndefined();
      expect(job.applyHost).toBeUndefined();
    }
    // A posting made to the paper falls back to the address in its text.
    expect(parseJob({ ...county, apply_url: "javascript:alert(1)" }).applyHost).toBe("governmentjobs.com");
    // Same rule as an address read from text: http is opened as https. A stated address keeps its last character.
    expect(parseJob(sourced({ apply_url: " http://example.org/job/1 " })).applyUrl).toBe("https://example.org/job/1");
    expect(parseJob(sourced({ apply_url: "https://example.org/job/Clerk_(Part-time)" })).applyUrl).toBe("https://example.org/job/Clerk_(Part-time)");
  });

  it("keeps employers, towns and titles in any script whole", () => {
    const sofia = parseJob(sourced({ title: "Учител по математика 🧮 — пълен работен ден", employer_name: "Столична община", locality: "София", region: "София-град" }));
    expect(sofia).toMatchObject({ title: "Учител по математика 🧮 — пълен работен ден", employer: "Столична община", town: "София", region: "София-град" });
    const tokyo = parseJob(sourced({ title: "看護師 👩‍⚕️", employer_name: "東京都立病院機構", locality: "東京都", region: null }));
    expect(tokyo).toMatchObject({ title: "看護師 👩‍⚕️", employer: "東京都立病院機構", town: "東京都", region: "" });
    // A cut falls between characters, never inside one.
    const long = parseJob(sourced({ employer_name: "🌳".repeat(200), locality: "山".repeat(59) + "🏔️🏔️" }));
    expect(Array.from(long.employer)).toHaveLength(120);
    expect(long.employer).toBe("🌳".repeat(120));
    expect(Array.from(long.town)).toHaveLength(60);
    expect(whole(long.town)).toBe(true);
    expect(whole("🌳".slice(0, 1))).toBe(false);
    // Everything arranged from these values uses them.
    const all = dedupeJobs([sofia, tokyo, parseJob(sourced({ id: "s2", slug: "second", title: "Домакин", employer_name: "Столична община", locality: "София" }))]);
    expect(groupJobs(all, "employer")[0]).toMatchObject({ label: "Столична община" });
    expect(groupJobs(all, "employer")[0].jobs).toHaveLength(2);
    expect(jobFacets(all).towns).toEqual([{ value: "София", label: "София", count: 2 }, { value: "東京都", label: "東京都", count: 1 }]);
    expect(filterJobs(all, jobsBoardState({ town: "東京都" })).map(job => job.title)).toEqual(["看護師 👩‍⚕️"]);
    expect(relatedJobs(sofia, all).sameEmployer.map(job => job.title)).toEqual(["Домакин"]);
  });

  it("shows no town for a sourced posting that does not state one", () => {
    // Neither the headline nor the description stands in for the missing field.
    const job = parseJob(sourced({ title: "Grounds Worker II — Acme School District (Walnut Creek, CA)", locality: null, region: null, body_md: "Location: Walnut Creek, CA\nTown: Walnut Creek\nWe are in Walnut Creek." }));
    expect(job).toMatchObject({ title: "Grounds Worker II", employer: "Acme School District", town: "", region: "", workplace: "On-site" });
    expect(jobFacets([job]).towns).toEqual([]);
    expect(jobDescription(job, "Walnut Creek Times")).toBe("Grounds Worker II at Acme School District. Full-time. Listed on Walnut Creek Times.");
    expect(parseJob(sourced({ locality: null, location_type: "remote" }))).toMatchObject({ town: "", workplace: "Remote" });
    expect(parseJob(sourced({ locality: "Remote" }))).toMatchObject({ town: "", workplace: "Remote" });
    // With no stated employer the headline's is kept, so the role is not left without one.
    expect(parseJob(sourced({ title: "Clerk — Acme School District (Alamo, CA)", employer_name: null })).employer).toBe("Acme School District");
    expect(parseJob(sourced({ employer_name: null })).employer).toBe("");
  });

  it("says where a sourced listing came from and when it was last checked", () => {
    const now = new Date("2026-11-18T08:00:00Z");
    expect(jobSourceLine(parseJob(sourced()), now)).toBe("Listed on edjoin.org · checked Nov 17");
    expect(jobSourceLine(parseJob(sourced({ source_checked_at: null })), now)).toBe("Listed on edjoin.org");
    expect(jobSourceLine(parseJob(sourced({ source_checked_at: "not a date" })), now)).toBe("Listed on edjoin.org");
    expect(jobSourceLine(parseJob(sourced({ source_host: null })), now)).toBe("");
    expect(jobSourceLine(parseJob(sourced({ source_host: "not a host <b>" })), now)).toBe("");
    expect(jobSourceLine(parseJob(sourced({ source_host: "https://WWW.EdJoin.org/Home/Job" })), now)).toBe("Listed on edjoin.org · checked Nov 17");
    expect(jobSourceLine(parseJob(sourced({ source_host: "careers.www.example.org" })), now)).toBe("Listed on careers.www.example.org · checked Nov 17");
    // The day is the paper's, not UTC's, and a date from another year says so.
    expect(jobSourceLine(parseJob(sourced({ source_checked_at: "2026-11-18T03:00:00Z" })), now)).toBe("Listed on edjoin.org · checked Nov 17");
    expect(jobSourceLine(parseJob(sourced({ source_checked_at: "2025-12-30T20:00:00Z" })), now)).toBe("Listed on edjoin.org · checked Dec 30, 2025");
    expect(jobSourceLine(parseJob({ ...county, source_host: "www.edjoin.org" }), now)).toBe("");
  });

  it("cleans Workday ERP prefixes, composite localities and long ATS button hostnames", () => {
    expect(cleanEmployerName("100 Salesforce, Inc.")).toBe("Salesforce, Inc.");
    expect(cleanEmployerName("10 Peet's Coffee Inc.")).toBe("Peet's Coffee Inc.");
    expect(cleanEmployerName("2100 NVIDIA USA")).toBe("NVIDIA USA");
    expect(cleanEmployerName("00104 Equinix LLC")).toBe("Equinix LLC");
    expect(cleanEmployerName("0061 Chevron Products Company, a division of Chevron U.S.A. Inc.")).toBe("Chevron Products Company, a division of Chevron U.S.A. Inc.");
    expect(cleanEmployerName("ADUS-Adobe Inc.")).toBe("Adobe Inc.");
    expect(cleanEmployerName("24 Hour Fitness")).toBe("24 Hour Fitness");
    expect(cleanEmployerName("99 Ranch Market")).toBe("99 Ranch Market");
    expect(cleanEmployerName("10x Genomics")).toBe("10x Genomics");

    expect(parseJob(sourced({ employer_name: "100 Salesforce, Inc.", locality: "Illinois - Chicago Metro - Remote" }))).toMatchObject({
      employer: "Salesforce, Inc.",
      town: "Illinois - Chicago Metro",
      workplace: "Remote",
    });
    expect(parseJob(sourced({ employer_name: "100 Salesforce, Inc.", locality: "California - San Francisco" }))).toMatchObject({
      employer: "Salesforce, Inc.",
      town: "San Francisco",
      region: "CA",
      workplace: "On-site",
    });
    expect(parseJob(sourced({ locality: "USA, CA, Pleasanton", region: null }))).toMatchObject({
      town: "Pleasanton",
      region: "CA",
    });
    expect(parseJob(sourced({ locality: "US, CA, Santa Clara", region: null }))).toMatchObject({
      town: "Santa Clara",
      region: "CA",
    });
    expect(parseJob(sourced({ locality: "SAN JOSE 08", region: "CA" }))).toMatchObject({
      town: "San Jose",
      region: "CA",
    });

    expect(applyButtonHost("salesforce.wd12.myworkdayjobs.com")).toBe("myworkdayjobs.com");
    expect(applyButtonHost("mechanicsbank.wd5.myworkdayjobs.com")).toBe("myworkdayjobs.com");
    expect(applyButtonHost("job-boards.greenhouse.io")).toBe("greenhouse.io");
    expect(applyButtonHost("jobs.ashbyhq.com")).toBe("ashbyhq.com");
    expect(applyButtonHost("careers.contracosta.ca.gov")).toBe("contracosta.ca.gov");
    expect(applyButtonHost("example.org")).toBe("example.org");
    expect(applyButtonHost("extremely-long-employer-careers-portal-domain.com")).toBeUndefined();
  });
});

describe("a fetched Markdown description", () => {
  const blocks = (lines: string[]) => jobBodyBlocks(parseJob({ id: "1", slug: "x", title: "Clerk", origin: "sourced", body_md: lines.join("\n") }).paragraphs, { markdown: true });

  it("reads paragraphs, headings, lists, bold text and links", () => {
    expect(blocks([
      "# Grounds Worker II",
      "",
      "**About the role:**",
      "Maintains *school* grounds and `irrigation` systems. See the [district site](https://www.acme.example/about).",
      "",
      "Essential Duties",
      "----------------",
      "* Mow, edge and **water** athletic fields",
      "    - Replace heads and valves",
      "+ Operate light equipment",
      "",
      "### Qualifications",
      "1. Two years of experience",
      "2. Valid driver\\'s license \\(Class C\\)",
    ])).toEqual([
      { kind: "heading", text: "Grounds Worker II" },
      { kind: "heading", text: "About the role" },
      {
        kind: "text",
        text: "Maintains school grounds and irrigation systems. See the district site.",
        rich: [{ text: "Maintains school grounds and irrigation systems. See the " }, { text: "district site", href: "https://www.acme.example/about" }, { text: "." }],
      },
      { kind: "heading", text: "Essential Duties" },
      {
        kind: "list",
        items: ["Mow, edge and water athletic fields", "Replace heads and valves", "Operate light equipment"],
        rich: [[{ text: "Mow, edge and " }, { text: "water", strong: true }, { text: " athletic fields" }], [{ text: "Replace heads and valves" }], [{ text: "Operate light equipment" }]],
      },
      { kind: "heading", text: "Qualifications" },
      { kind: "list", items: ["Two years of experience", "Valid driver's license (Class C)"] },
    ]);
  });

  it("only ever links to an https web address and shows the words of anything else", () => {
    expect(blocks(["Apply [here](javascript:void) or [call](tel:+19255551212), [write](mailto:a@example.org), [see](/careers) and **[the portal](http://jobs.example.org/a?b=1 \"Jobs\")**."])).toEqual([{
      kind: "text",
      text: "Apply here or call, write, see and the portal.",
      rich: [{ text: "Apply here or call, write, see and " }, { text: "the portal", strong: true, href: "https://jobs.example.org/a?b=1" }, { text: "." }],
    }]);
    // An address this reader cannot follow stays on the page as typed; it is never made into a link.
    expect(blocks(["Apply [here](javascript:alert(1)) before the closing date on Friday."])).toEqual([{ kind: "text", text: "Apply [here](javascript:alert(1)) before the closing date on Friday." }]);
  });

  it("turns what it cannot draw into plain lines and leaves out rules and pictures", () => {
    expect(blocks([
      "| Step | Hourly |",
      "| --- | ---: |",
      "| 1 | $28.00 |",
      "",
      "---",
      "> Acme is an equal opportunity employer.",
      "![logo](https://www.acme.example/logo.png)",
      "```",
      "**Salary: $28–$35 per hour.**",
      "Location: District Office",
      "A paragraph that ends the description.",
    ])).toEqual([
      { kind: "text", text: "Step · Hourly" },
      { kind: "text", text: "1 · $28.00" },
      { kind: "text", text: "Acme is an equal opportunity employer." },
      { kind: "text", text: "Salary: $28–$35 per hour.", rich: [{ text: "Salary: $28–$35 per hour.", strong: true }] },
      { kind: "text", text: "Location: District Office" },
      { kind: "text", text: "A paragraph that ends the description." },
    ]);
    // A rule set apart by a blank line is a rule, not a heading's underline.
    expect(blocks(["We are hiring for the season.", "", "---", "", "Apply today at the front desk."]).map(block => block.kind)).toEqual(["text", "text"]);
  });

  it("keeps plain text, snake_case and other scripts as written", () => {
    expect(blocks(["Обязанности", "• Готовить **кофе** ☕", "職務内容", "お客様への対応をお願いします。"])).toEqual([
      { kind: "heading", text: "Обязанности" },
      { kind: "list", items: ["Готовить кофе ☕"], rich: [[{ text: "Готовить " }, { text: "кофе", strong: true }, { text: " ☕" }]] },
      { kind: "heading", text: "職務内容" },
      { kind: "text", text: "お客様への対応をお願いします。" },
    ]);
    expect(blocks(["Set max_retry_count and min_wait_ms, then compute 5 * 3 * 2 for the team🧮."])).toEqual([{ kind: "text", text: "Set max_retry_count and min_wait_ms, then compute 5 * 3 * 2 for the team🧮." }]);
    expect(blocks(["\\- not a bullet, 2\\. not a number, \\*\\*not bold\\*\\* and \\[not a link\\](https://example.org) here."])).toEqual([{ kind: "text", text: "- not a bullet, 2. not a number, **not bold** and [not a link](https://example.org) here." }]);
    for (const block of blocks(["**Привет 😀 мир** и [東京 🗼](https://example.org/東京)"])) expect(whole(JSON.stringify(block))).toBe(true);
  });

  it("does not read Markdown in a posting made to the paper", () => {
    const lines = ["## Not a heading here.", "+ not a bullet here.", "**Bold stays as typed** in a longer sentence."];
    expect(jobBodyBlocks(lines)).toEqual(lines.map(text => ({ kind: "text", text })));
  });

  it("stays fast on hostile Markdown", () => {
    const started = Date.now();
    const body = [`${"[".repeat(20000)}`, `${"**a".repeat(20000)}`, `${"_a ".repeat(20000)}`, `${"[a](".repeat(20000)}`, `# ${" ".repeat(20000)}x`, `${"| ".repeat(20000)}|`, `${"- ".repeat(20000)}`, `${"\\*".repeat(20000)}`, `${"`".repeat(20000)}`].join("\n");
    const view = parseJob({ id: "1", slug: "x", title: "Clerk", origin: "sourced", body_md: `${body}\n${body}\n${body}` });
    jobBodyBlocks(view.paragraphs, { markdown: true });
    expect(Date.now() - started).toBeLessThan(500);
  });
});
