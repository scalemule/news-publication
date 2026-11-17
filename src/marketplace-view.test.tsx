import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { jobsBoardState } from "./jobs";
import type { PublicJob } from "./marketplace";
import { JobArticle, JobsBoard } from "./marketplace-view";

/** A posting as the papers carry it today: the employer, town and apply address are lines in the text. */
const acme: PublicJob = {
  id: "0195f3a0-0000-7000-8000-000000000001",
  slug: "grounds-worker-ii-acme",
  title: "Grounds Worker II — Acme School District (Pleasant Hill, CA)",
  employment_type: "full_time",
  location_type: "onsite",
  published_at: "2026-11-10T18:00:00Z",
  body_md: [
    "Acme School District is hiring for Grounds Worker II in Pleasant Hill, CA.",
    "",
    "Location: Pleasant Hill, CA (On-site)",
    "Employer: Acme School District · Education",
    "Employment Type: Full-time",
    "Compensation: $28–$35 / hour",
    "",
    "Role Overview:",
    "Keeps school grounds, fields and irrigation in safe working order.",
    "What You'll Do",
    "• Mow, edge and water athletic fields",
    "• Repair sprinklers and report hazards",
    "",
    "[Apply on Acme School District's Official Career Page](https://example.org/job/1)",
    "Apply on Acme School District's official career page: https://example.org/job/1",
    "Employer website: https://example.org",
  ].join("\n"),
};

const cafe: PublicJob = {
  id: "0195f3a0-0000-7000-8000-000000000002",
  slug: "barista",
  title: "Бариста ☕ 咖啡师",
  employment_type: "part_time",
  body_md: "Утренние смены 😀 в кафе.\n\nTown: Danville\nApply: jobs@example.com",
};

const counsel: PublicJob = {
  id: "0195f3a0-0000-7000-8000-000000000003",
  slug: "deputy-county-counsel",
  title: "Deputy County Counsel - Exempt — Contra Costa County (Alamo, CA)",
  employment_type: "full_time",
  body_md: "Employer: Contra Costa County · County Government\nCompensation: $178,108.20 – $211,714.66 per year",
};

const ranger: PublicJob = {
  id: "0195f3a0-0000-7000-8000-000000000004",
  slug: "park-ranger",
  title: "Park Ranger — East Bay Regional Park District (Alamo, CA)",
  employment_type: "temporary",
  body_md: "Compensation: $22.38 – $23.55 per hour",
};

const today = [acme, cafe, counsel, ranger];

/** What the jobs API returns for every posting that exists today. */
const unfilled = {
  origin: "employer",
  employer_name: null,
  locality: null,
  region: null,
  apply_url: null,
  source_host: null,
  source_checked_at: null,
} as const;

const article = (job: PublicJob, related: PublicJob[] = today) =>
  renderToStaticMarkup(<JobArticle job={job} related={related} region="Pleasant Hill" paper="Pleasant Hill Weekly" />);

const board = (jobs: PublicJob[], view = "profession") =>
  renderToStaticMarkup(<JobsBoard region="Pleasant Hill" jobs={jobs} query="" state={jobsBoardState({ view })} />);

describe("postings whose facts are lines in the text", () => {
  // These snapshots were written by the release before the API fields existed (0.0.119).
  // They must never be regenerated to make a change pass: they are the proof that today's pages are untouched.
  it("renders the job page as before", () => {
    expect(article(acme)).toMatchSnapshot();
    expect(article(cafe)).toMatchSnapshot();
  });

  it("renders the board as before", () => {
    expect(board(today)).toMatchSnapshot();
    expect(board(today, "employer")).toMatchSnapshot();
    expect(board(today, "pay")).toMatchSnapshot();
  });

  it("renders the same pages when the API sends the new fields empty", () => {
    const sent = today.map(job => ({ ...job, ...unfilled }));
    expect(article(sent[0], sent)).toBe(article(acme));
    expect(article(sent[1], sent)).toBe(article(cafe));
    expect(board(sent)).toBe(board(today));
    expect(board(today.map(job => ({ ...job, origin: "employer" as const, employer_name: "  ", locality: "", apply_url: "" })))).toBe(board(today));
  });
});

describe("sourced postings", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-18T08:00:00Z"));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  /** The same job once its text is the description fetched from the employer's page. */
  const sourced = (overrides: Partial<PublicJob> = {}): PublicJob => ({
    id: "0195f3a0-0000-7000-8000-000000000009",
    slug: "grounds-worker-ii-acme-sourced",
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
    published_at: "2026-11-10T18:00:00Z",
    body_md: [
      "Keeps school grounds, fields and irrigation in **safe working order**. Read the [full posting](https://www.edjoin.org/Home/JobPosting/1).",
      "",
      "## What you'll do",
      "",
      "* Mow, edge and water athletic fields",
      "* Repair sprinklers and report hazards",
    ].join("\n"),
    ...overrides,
  });

  it("shows the employer, town and apply link from the fields", () => {
    const html = article(sourced());
    expect(html).toContain('<p class="deck">Acme School District</p>');
    expect(html).toContain("<dt>Employer</dt><dd>Acme School District</dd>");
    expect(html).toContain("<dt>Location</dt><dd>Pleasant Hill · On-site</dd>");
    expect(html).toContain('<a class="apply" href="https://example.org/job/1" target="_blank" rel="noopener nofollow">Apply at example.org');
    // The button, the phone apply bar and the "continue at" note under a short description all go to the same place.
    expect(html.match(/href="https:\/\/example\.org\/job\/1" target="_blank" rel="noopener nofollow"/gu)).toHaveLength(3);
    expect(html).toContain('<p class="meta">You apply directly with the employer. Pleasant Hill Weekly does not collect applications. <span class="source">Listed on edjoin.org · checked Nov 17</span></p>');
  });

  it("draws the fetched description", () => {
    const html = article(sourced());
    expect(html).toContain('<p>Keeps school grounds, fields and irrigation in <strong>safe working order</strong>. Read the <a href="https://www.edjoin.org/Home/JobPosting/1" target="_blank" rel="noopener nofollow">full posting</a>.</p>');
    expect(html).toContain("<h2>What you’ll do</h2>".replace("’", "&#x27;"));
    expect(html).toContain("<ul><li>Mow, edge and water athletic fields</li><li>Repair sprinklers and report hazards</li></ul>");
    expect(html).not.toContain("**");
    expect(html).not.toContain("##");
  });

  it("leaves out what the posting does not state", () => {
    const untimed = article(sourced({ source_checked_at: null }));
    expect(untimed).toContain('<span class="source">Listed on edjoin.org</span>');
    expect(untimed).not.toContain("checked");
    expect(article(sourced({ source_host: null }))).not.toContain("Listed on");

    // No town: none is shown, and the paper's own town does not stand in for it.
    const nowhere = article(sourced({ locality: null, region: null }), []);
    expect(nowhere).not.toContain("<dt>Location</dt>");
    expect(nowhere).not.toContain("Pleasant Hill ·");
    expect(nowhere).not.toContain("· Pleasant Hill");
    expect(article(sourced({ locality: null, location_type: "remote" }), [])).toContain("<dt>Location</dt><dd>Remote</dd>");

    // No usable address: no button, and the source is still named.
    const unlinked = article(sourced({ apply_url: "javascript:alert(1)" }));
    expect(unlinked).not.toContain('class="apply"');
    expect(unlinked).not.toContain("javascript:");
    expect(unlinked).toContain('<p class="meta">Listed on edjoin.org · checked Nov 17</p>');
  });

  it("escapes whatever the fields and the description carry", () => {
    const html = article(sourced({ employer_name: "Acme <script>alert(1)</script>", source_host: "evil.example\"><script>", body_md: "<img src=x onerror=alert(1)> **<b>bold</b>** [x](https://example.org/\"onmouseover=\"alert(1))" }));
    expect(html).not.toContain("<script>");
    expect(html).not.toContain("<img");
    expect(html).not.toContain("<b>");
    expect(html).not.toContain('onmouseover="');
    expect(html).not.toContain("Listed on");
  });

  it("lists sourced and posted jobs together on the board", () => {
    const html = board([...today, sourced(), sourced({ id: "s2", slug: "kanji", title: "看護師 👩‍⚕️", employer_name: "東京都立病院機構", locality: "София", apply_url: null })], "employer");
    expect(html).toContain('<span class="role" style="view-transition-name:job-0195f3a0-0000-7000-8000-000000000009">Grounds Worker II</span><span class="meta">Pleasant Hill · Full-time</span>');
    expect(html).toContain("<h2>Acme School District</h2>");
    expect(html).toContain("<h2>東京都立病院機構</h2>");
    expect(html).toContain('<span class="role" style="view-transition-name:job-s2">看護師 👩‍⚕️</span><span class="meta">София · Full-time</span>');
    // The new jobs add to the counts; the town chips count them with the rest.
    expect(html).toContain("<dt>openings</dt><dd>6</dd>");
    expect(html).toContain('<span>Pleasant Hill</span><span class="n">2</span>');
  });
});
