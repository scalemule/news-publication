/**
 * Reading rules for a paper's jobs board.
 *
 * A public posting arrives as a title, a text body and a few typed fields. These
 * helpers turn it into the facts a reader scans for (role, employer, town, pay,
 * profession, how to apply) and arrange a list of postings for the board. They are
 * pure: API calls stay in the site.
 */
import { employmentLabel, type PublicJob } from "./marketplace";

export const JOB_PROFESSIONS = [
  { id: "education", label: "Education & libraries" },
  { id: "engineering", label: "Engineering & planning" },
  { id: "finance", label: "Finance & accounting" },
  { id: "healthcare", label: "Healthcare & clinical" },
  { id: "legal", label: "Legal" },
  { id: "marketing", label: "Marketing & communications" },
  { id: "office", label: "Office, HR & administration" },
  { id: "parks", label: "Parks & outdoors" },
  { id: "public-safety", label: "Public safety" },
  { id: "retail", label: "Retail, sales & hospitality" },
  { id: "technology", label: "Technology" },
  { id: "trades", label: "Trades, facilities & transportation" },
  { id: "other", label: "Other roles" },
] as const;

export type JobProfessionId = (typeof JOB_PROFESSIONS)[number]["id"];

/** First match wins, so the specific callings sit above the broad ones. */
const PROFESSION_RULES: ReadonlyArray<readonly [JobProfessionId, RegExp]> = [
  ["finance", /\b(financial (planner|advis[eo]r|analyst)|wealth (manager|advis[eo]r))\b/iu],
  ["office", /\b(event|meeting|wedding) planner\b/iu],
  ["legal", /\b(counsel|attorney|paralegal|legal|law clerk)\b/iu],
  ["public-safety", /\b(police|sheriff|dispatcher|firefighter|fire (captain|inspector|marshal|chief)|paramedic|emt|probation|correctional|public safety|security (officer|guard))\b/iu],
  ["technology", /\b(software|programmer|developer|information systems|information technology|it (support|specialist|manager|analyst)|systems? (analyst|administrator)|data (engineer|scientist|analyst)|test automation|devops|cyber\w*|network (engineer|administrator)|machine learning|qa engineer|web designer|(windows|linux|sql|database|server) (server )?(administrator|engineer)|site reliability|help ?desk)\b/iu],
  ["trades", /\b(janitor\w*|custodi\w*|maintenance|mechanic|electrician|plumber|carpenter|welder|hvac|driver|warehouse|groundskeeper|facilities|equipment operator|laborer|utility worker)\b/iu],
  ["education", /\b(teacher|teaching|instructor|professor|tutor|(school|assistant|vice) principal|school|elementary|classroom|special education|noon supervisor|librar\w*|paraeducator|substitute|child ?care|preschool)\b/iu],
  ["healthcare", /\b(rn|lvn|cna|nurse|nursing|physician|physicist|pharmac\w*|psycholog\w*|psychiatr\w*|therapist|therapy|clinical|clinic|medical|medicine|mental health|patient|sterile processing|dental|dentist|surgical|surgery|radiolog\w*|oncology|laboratory|caregiver|health professional|veterinar\w*)\b/iu],
  ["engineering", /\b(engineer|engineering|planner|planning|surveyor|architect|drafter|inspector)\b/iu],
  ["finance", /\b(account(ing|ant)s?|fund|(?<!traffic )controller|bookkeep\w*|payroll|audit\w*|financial|finance|tax|treasury|budget|loan|(?<!food )bank\w*|underwrit\w*|actuar\w*)\b/iu],
  ["marketing", /\b(marketing|communications|public relations|social media|brand|crm|copywriter|graphic design\w*|editor|reporter|journalist|content)\b/iu],
  ["retail", /\b(retail|sales|cashier|key holder|store|barista|server|cook|chef|bartender|restaurant|hospitality|merchandis\w*|customer service|stylist)\b/iu],
  ["parks", /\b(ranger|parks?|recreation|lifeguard|naturalist|gate attendant|visitor center|landscap\w*|gardener|trail)\b/iu],
  ["office", /\b(clerk|administrative|administrator|office|receptionist|secretary|registrar|billing|human resources|hr|recruit\w*|labor relations|executive assistant|mail|messenger|data entry|coordinator|business partner)\b/iu],
];

export function professionLabel(id: string): string {
  return JOB_PROFESSIONS.find(item => item.id === id)?.label ?? "";
}

/** The role names the calling; the department and the employer's sector only break a tie. */
export function classifyProfession(role: string, department = "", sector = ""): JobProfessionId {
  for (const text of [role, department, sector]) {
    if (!text) continue;
    for (const [id, pattern] of PROFESSION_RULES) {
      if (pattern.test(text)) return id;
    }
  }
  return "other";
}

export type JobPayPeriod = "year" | "month" | "hour";

export type JobPay = {
  min: number;
  max: number;
  period: JobPayPeriod;
  /** Top of the range as a yearly figure, for ordering only. */
  annual: number;
};

export type JobWorkplace = "On-site" | "Hybrid" | "Remote";

export type JobView = {
  id: string;
  slug: string;
  /** The role alone, without the employer, town or shift codes. */
  title: string;
  rawTitle: string;
  employer: string;
  sector: string;
  town: string;
  workplace: JobWorkplace;
  schedule: string;
  scheduleKey: string;
  department: string;
  profession: JobProfessionId;
  pay: JobPay | null;
  applyUrl?: string;
  /** Host of the application page, shown on the button so readers know where they are going. */
  applyHost?: string;
  applyEmail?: string;
  website?: string;
  /** Host of the employer's site, shown as the link text so the label cannot differ from the destination. */
  websiteHost?: string;
  paragraphs: string[];
  /** The source text stops mid-sentence; the page says so instead of pretending it is whole. */
  truncated: boolean;
  /** The listing says very little (under 240 characters); the page points to the employer's page for the rest. */
  brief: boolean;
  publishedAt?: string;
};

const ANNUAL_FACTOR: Record<JobPayPeriod, number> = { year: 1, month: 12, hour: 2080 };

const PERIOD_WORD = /\b(hourly|hours?|hr|monthly|months?|mo|yearly|years?|yr|annual(?:ly)?|annum)\b/iu;

function payPeriod(text?: string | null): JobPayPeriod | null {
  const word = text?.match(PERIOD_WORD)?.[1]?.toLowerCase();
  if (!word) return null;
  return word.startsWith("h") ? "hour" : word.startsWith("m") ? "month" : "year";
}

/** With no stated period only the unmistakable sizes are read; anything between stays unlisted. */
function inferPeriod(amount: number): JobPayPeriod | null {
  return amount < 200 ? "hour" : amount >= 15_000 ? "year" : null;
}

function makePay(low: number, high: number, period: JobPayPeriod | null): JobPay | null {
  if (!period || !Number.isFinite(low) || low <= 0) return null;
  const top = Number.isFinite(high) && high > 0 ? high : low;
  const min = Math.min(low, top);
  const max = Math.max(low, top);
  // An hourly figure in the thousands or a yearly one in the hundreds is a misread, not a wage.
  if ((period === "hour" && min > 1000) || (period === "year" && min < 1000)) return null;
  return { min, max, period, annual: max * ANNUAL_FACTOR[period] };
}

function payFromFields(job: PublicJob): JobPay | null {
  if (job.salary_currency && job.salary_currency.toUpperCase() !== "USD") return null;
  const low = job.salary_min_minor != null && job.salary_min_minor > 0 ? job.salary_min_minor / 100 : null;
  const high = job.salary_max_minor != null && job.salary_max_minor > 0 ? job.salary_max_minor / 100 : null;
  const min = low ?? high;
  if (min == null) return null;
  return makePay(min, high ?? min, payPeriod(job.salary_period) ?? inferPeriod(min));
}

/**
 * Reads "$119,438 – $160,059 per year", "$65K–$80K", "$22/hr". The period is the first
 * one stated after the first figure. A second figure more than ten times the first is
 * something else (a yearly equivalent, a bonus) and is left out.
 */
function payFromText(line: string): JobPay | null {
  const found = Array.from(line.matchAll(/\$\s?(\d[\d,]*(?:\.\d+)?)\s?([kK])?(?![\d\p{L}])/gu));
  const amounts = found.map(match => Number(match[1].replace(/,/gu, "")) * (match[2] ? 1000 : 1)).filter(amount => Number.isFinite(amount) && amount > 0);
  if (amounts.length === 0 || amounts.length !== found.length) return null;
  const min = amounts[0];
  const second = amounts[1] ?? min;
  const max = second > min * 10 || second * 10 < min ? min : second;
  return makePay(min, max, payPeriod(line.slice(found[0].index ?? 0)) ?? inferPeriod(min));
}

function dollars(amount: number, cents: boolean): string {
  return "$" + amount.toLocaleString("en-US", cents
    ? { minimumFractionDigits: 2, maximumFractionDigits: 2 }
    : { maximumFractionDigits: 0 });
}

function thousands(amount: number): string {
  return amount >= 1000 ? `$${Math.round(amount / 1000)}k` : dollars(amount, false);
}

function range(low: string, high: string, joiner: string): string {
  return low === high ? low : `${low}${joiner}${high}`;
}

/** Compact figure for a list row: "$178k–$212k", "$22.38–$23.55". */
export function formatPayShort(pay: JobPay): string {
  if (pay.period === "year") return range(thousands(pay.min), thousands(pay.max), "–");
  return range(dollars(pay.min, pay.period === "hour"), dollars(pay.max, pay.period === "hour"), "–");
}

/** Full figure for the job page: "$178,108 – $211,715". */
export function formatPayExact(pay: JobPay): string {
  const cents = pay.period === "hour";
  return range(dollars(pay.min, cents), dollars(pay.max, cents), " – ");
}

export function payUnit(pay: JobPay): string {
  return pay.period === "hour" ? "an hour" : pay.period === "month" ? "a month" : "a year";
}

const SHIFT_NOISE = /^(full[\s-]?time|part[\s-]?time|\d+\s?hours?|days?|nights?|evenings?|variable(\s+shift)?|day shift|night shift)(\s+\p{Lu}[\p{L} .'-]*,\s*[A-Z]{2})?…?$/iu;

/** Longest text a rule will read; anything longer is cut on a character boundary first. */
const TITLE_LIMIT = 300;
const LINE_LIMIT = 2000;

function clip(text: string, max: number): string {
  // UTF8-SAFETY: counts and cuts by code point, never by UTF-16 unit.
  return text.length <= max ? text : Array.from(text).slice(0, max).join("");
}

/**
 * Drops the run of scheduling codes an applicant-tracking system appends to a role
 * ("- Full Time - 8 Hour - Days Walnut Creek, CA"). A single trailing word such as
 * "- Days" or "- Nights" is kept: it tells two real openings apart.
 */
export function cleanJobTitle(role: string): string {
  const parts = clip(role.trim(), TITLE_LIMIT).split(/\s+-\s+/u);
  let keep = parts.length;
  while (keep > 1 && SHIFT_NOISE.test(parts[keep - 1].trim())) keep -= 1;
  const kept = parts.length - keep >= 2 ? parts.slice(0, keep) : parts;
  return kept.join(" - ").replace(/\s{2,}/gu, " ").trim().replace(/[,;:–—-]+$/u, "").trim();
}

function httpsUrl(raw?: string | null): string | undefined {
  if (!raw) return undefined;
  try {
    const parsed = new URL(raw.trim().replace(/[).,;]+$/u, ""));
    // Web addresses only, always opened over https; an "http://" careers link is upgraded rather than dropped.
    if (parsed.protocol === "http:") parsed.protocol = "https:";
    return parsed.protocol === "https:" && parsed.hostname.includes(".") ? parsed.href : undefined;
  } catch {
    return undefined;
  }
}

function hostOf(url?: string): string | undefined {
  if (!url) return undefined;
  try {
    return new URL(url).hostname.replace(/^www\./u, "");
  } catch {
    return undefined;
  }
}

function scheduleKeyOf(label: string): string {
  const text = label.toLowerCase();
  if (/part/u.test(text)) return "part_time";
  if (/temp|season|per diem/u.test(text)) return "temporary";
  if (/contract/u.test(text)) return "contract";
  if (/intern/u.test(text)) return "internship";
  return /full/u.test(text) ? "full_time" : "";
}

/** The label a reader sees and the key a filter matches always come from the same source. */
function scheduleOf(job: PublicJob, line: string): { label: string; key: string } {
  const typed = employmentLabel(job.employment_type);
  if (typed && job.employment_type) {
    return { label: line && scheduleKeyOf(line) === job.employment_type ? line : typed, key: job.employment_type };
  }
  return { label: line, key: scheduleKeyOf(line) };
}

/** Reads the facts out of a posting. Every field degrades to empty rather than to a guess. */
export type JobBodyBlock =
  | { kind: "heading"; text: string }
  | { kind: "list"; items: string[] }
  | { kind: "text"; text: string };

const BULLET = /^(?:[•·▪◦‣*–—-]|\d{1,2}[.)])\s+(?=\S)/u;

const headingLike = (line: string | undefined): boolean =>
  line !== undefined
  && !BULLET.test(line)
  && Array.from(line).length <= 60
  && line.split(/\s+/u).length <= 8
  && /\p{L}/u.test(line)
  && !/[.!?;,…。！？]$/u.test(line)
  && !/https?:\/\/|@|^#/u.test(line);

/**
 * Give a description its shape back: bullet lines become one list, and a short line
 * with no sentence ending that introduces what follows becomes a sub-heading.
 * A run of short lines (an address, a sign-off) stays text. Nothing is reworded or dropped.
 */
export function jobBodyBlocks(paragraphs: readonly string[]): JobBodyBlock[] {
  const blocks: JobBodyBlock[] = [];
  paragraphs.forEach((line, index) => {
    if (BULLET.test(line)) {
      const item = line.replace(BULLET, "").trim();
      const previous = blocks[blocks.length - 1];
      if (previous?.kind === "list") previous.items.push(item);
      else blocks.push({ kind: "list", items: [item] });
      return;
    }
    const next = paragraphs[index + 1];
    const heading = headingLike(line) && next !== undefined && !headingLike(next) && !headingLike(paragraphs[index - 1]);
    blocks.push(heading ? { kind: "heading", text: line.replace(/\s*:$/u, "") } : { kind: "text", text: line });
  });
  return blocks;
}

export function parseJob(job: PublicJob): JobView {
  const rawTitle = clip((job.title ?? "").trim(), TITLE_LIMIT);
  const body = (job.body_md ?? "").trim();
  // "Role — Employer (Town, ST) [Track]". The employer may carry its own brackets: "District (EBMUD) (Alamo, CA)".
  // Without the closing "(Town, ST)" a dash is just punctuation in someone's headline, not an employer.
  const titleMatch = rawTitle.match(/^(.*)\s+—\s+(.+?)\s*\(([^()]+,\s*[A-Z]{2})\)(?:\s*\[[^\]]+\])?$/u);
  const role = cleanJobTitle(titleMatch?.[1]?.trim() || rawTitle.replace(/\s*\[[^\]]+\]$/u, ""));
  let employer = titleMatch?.[2]?.trim() ?? "";
  const titlePlace = titleMatch?.[3]?.trim() ?? "";

  let sector = "";
  let place = "";
  let scheduleLine = "";
  let department = "";
  let textPay: JobPay | null = null;
  let applyUrl: string | undefined;
  let applyEmail: string | undefined;
  let website: string | undefined;
  const paragraphs: string[] = [];

  // A labelled line is taken off the page only when its value was understood;
  // "Apply: call 925-555-1212" or "Compensation: DOE" stays in the text as written.
  for (const rawLine of body.split(/\r?\n/u)) {
    const line = rawLine.trim();
    if (!line) continue;
    if (line.length > LINE_LIMIT) { paragraphs.push(line); continue; }
    let match: RegExpMatchArray | null;
    if ((match = line.match(/^Location:\s*(.+)$/iu))) { place = match[1].trim(); continue; }
    if ((match = line.match(/^Town:\s*(.+)$/iu))) { if (!place) place = match[1].trim(); continue; }
    if ((match = line.match(/^Employer:\s*(.+)$/iu))) {
      const parts = match[1].split(/\s*·\s*/u);
      if (!employer && parts[0]) employer = parts[0].trim();
      if (parts[1]) sector = parts.slice(1).join(" · ").trim();
      continue;
    }
    if ((match = line.match(/^Employment Type:\s*(.+)$/iu))) { scheduleLine = match[1].trim(); continue; }
    if ((match = line.match(/^Department\s*\/\s*Division:\s*(.+)$/iu))) { department = match[1].trim(); continue; }
    if ((match = line.match(/^Compensation:\s*(.+)$/iu))) {
      const read = payFromText(match[1]);
      if (read) { textPay = read; continue; }
    }
    if ((match = line.match(/^\[Apply on [^\]]*\]\((\S+)\)$/iu) ?? line.match(/^Apply on [^:]*:\s*(\S+)$/iu))) {
      const url = httpsUrl(match[1]);
      if (url) { applyUrl = url; continue; }
    }
    if ((match = line.match(/^Apply:\s*(.+)$/iu))) {
      const target = match[1].trim();
      const url = httpsUrl(target);
      if (url) { applyUrl = url; continue; }
      if (/^[A-Za-z0-9._+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+$/u.test(target)) { applyEmail = target; continue; }
    }
    if ((match = line.match(/^Employer website:\s*(\S+)$/iu))) {
      const url = httpsUrl(match[1]);
      if (url) { website = url; continue; }
    }
    if (/^\*\*Track:\*\*/u.test(line) || /^Technical Track:/iu.test(line) || /^Role Overview:$/iu.test(line)) continue;
    paragraphs.push(line);
  }

  const location = place || titlePlace;
  const named = location
    .replace(/\s*\((On-site|Hybrid|Remote)\)\s*/giu, "")
    .replace(/,\s*[A-Z]{2}(?:\s+\d{5}(?:-\d{4})?)?$/u, "")
    .trim();
  const town = /^(remote|hybrid|on-?site|anywhere)$/iu.test(named) ? "" : clip(named, 60);
  const workplace: JobWorkplace = /\bhybrid\b/iu.test(place) || job.location_type === "hybrid"
    ? "Hybrid"
    : /\bremote\b/iu.test(place) || job.location_type === "remote" || job.remote_allowed
      ? "Remote"
      : "On-site";
  const schedule = scheduleOf(job, scheduleLine);

  // The seeded opening sentence ("Acme is hiring for Role in Town, CA.") repeats the headline; drop it when real text follows.
  const opener = paragraphs[0] ?? "";
  const seededOpener = paragraphs.length > 1 && employer !== "" && opener.length < 400
    && opener.startsWith(`${employer} is hiring for `) && opener.endsWith(".");
  const prose = seededOpener ? paragraphs.slice(1) : paragraphs;
  const last = prose[prose.length - 1] ?? "";

  return {
    id: job.id,
    slug: job.slug,
    title: role || rawTitle || "Opening",
    rawTitle,
    employer,
    sector,
    town,
    workplace,
    schedule: schedule.label,
    scheduleKey: schedule.key,
    department,
    profession: classifyProfession(role, department, sector),
    pay: payFromFields(job) ?? textPay,
    applyUrl,
    applyHost: hostOf(applyUrl),
    applyEmail,
    website,
    websiteHost: hostOf(website),
    paragraphs: prose,
    truncated: /(\.\.\.|…)$/u.test(last),
    brief: Array.from(prose.join(" ")).length < 240,
    publishedAt: job.published_at ?? undefined,
  };
}

export type JobsBoardView = "profession" | "employer" | "pay";

export type JobsBoardState = {
  view: JobsBoardView;
  town: string;
  schedule: string;
  profession: string;
  payOnly: boolean;
  query: string;
};

type Params = Record<string, string | string[] | undefined>;

function param(params: Params, key: string, max = 80): string {
  const value = params[key];
  const text = (Array.isArray(value) ? value[0] : value) ?? "";
  return Array.from(text.trim()).slice(0, max).join("");
}

export function jobsBoardState(params: Params = {}): JobsBoardState {
  const view = param(params, "view");
  return {
    view: view === "employer" || view === "pay" ? view : "profession",
    town: param(params, "town"),
    schedule: param(params, "type"),
    profession: param(params, "profession"),
    payOnly: param(params, "pay") === "1",
    query: param(params, "q"),
  };
}

/** Address of the board with one or more choices changed; choices left alone are kept. */
export function jobsBoardHref(state: JobsBoardState, patch: Partial<JobsBoardState> = {}): string {
  const next = { ...state, ...patch };
  const params = new URLSearchParams();
  if (next.query) params.set("q", next.query);
  if (next.view !== "profession") params.set("view", next.view);
  if (next.profession) params.set("profession", next.profession);
  if (next.town) params.set("town", next.town);
  if (next.schedule) params.set("type", next.schedule);
  if (next.payOnly) params.set("pay", "1");
  const query = params.toString();
  return query ? `/jobs?${query}` : "/jobs";
}

export function hasJobFilters(state: JobsBoardState): boolean {
  return Boolean(state.town || state.schedule || state.profession || state.payOnly);
}

/** Same full headline, employer and town. Empty when the posting names no employer: two shops may both need a "Barista". */
function sameJobKey(job: JobView): string {
  return job.employer ? `${job.rawTitle}|${job.employer}|${job.town}`.toLowerCase() : "";
}

/** A re-imported posting must not show the same job twice. Openings that differ in any stated way are all kept. */
export function dedupeJobs(jobs: JobView[]): JobView[] {
  const seen = new Set<string>();
  return jobs.filter(job => {
    const key = sameJobKey(job);
    if (!key) return true;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function filterJobs(jobs: JobView[], state: JobsBoardState): JobView[] {
  return jobs.filter(job =>
    (!state.town || job.town === state.town) &&
    (!state.schedule || job.scheduleKey === state.schedule) &&
    (!state.profession || job.profession === state.profession) &&
    (!state.payOnly || job.pay !== null),
  );
}

export type JobFacet = { value: string; label: string; count: number };

function tally(values: string[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const value of values) if (value) counts.set(value, (counts.get(value) ?? 0) + 1);
  return counts;
}

function facets(counts: Map<string, number>, label: (value: string) => string): JobFacet[] {
  return Array.from(counts, ([value, count]) => ({ value, label: label(value), count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}

export function jobFacets(jobs: JobView[]) {
  return {
    towns: facets(tally(jobs.map(job => job.town)), value => value),
    schedules: facets(tally(jobs.map(job => job.scheduleKey)), value => employmentLabel(value) || value),
    professions: facets(tally(jobs.map(job => job.profession)), professionLabel),
    employers: tally(jobs.map(job => job.employer)).size,
    payListed: jobs.filter(job => job.pay !== null).length,
  };
}

function byPay(a: JobView, b: JobView): number {
  return (b.pay?.annual ?? -1) - (a.pay?.annual ?? -1) || a.title.localeCompare(b.title);
}

export type JobGroup = { key: string; label: string; note: string; jobs: JobView[] };

/** Sections of the board. Within a section the best-paid role leads and unlisted pay trails. */
export function groupJobs(jobs: JobView[], view: JobsBoardView): JobGroup[] {
  if (view === "pay") {
    const listed = jobs.filter(job => job.pay !== null).sort(byPay);
    const unlisted = jobs.filter(job => job.pay === null).sort(byPay);
    return [
      { key: "listed", label: "Pay listed", note: "Highest first", jobs: listed },
      { key: "unlisted", label: "Pay not listed", note: "Ask the employer", jobs: unlisted },
    ].filter(group => group.jobs.length > 0);
  }
  const buckets = new Map<string, JobView[]>();
  for (const job of jobs) {
    const key = view === "employer" ? job.employer || "Other employers" : job.profession;
    const bucket = buckets.get(key);
    if (bucket) bucket.push(job);
    else buckets.set(key, [job]);
  }
  const groups = Array.from(buckets, ([key, bucket]) => {
    const sorted = bucket.sort(byPay);
    const sectors = new Set(sorted.map(job => job.sector).filter(Boolean));
    return {
      key,
      label: view === "employer" ? key : professionLabel(key),
      note: view === "employer" && sectors.size === 1 ? Array.from(sectors)[0] : "",
      jobs: sorted,
    };
  });
  return view === "employer"
    ? groups.sort((a, b) => b.jobs.length - a.jobs.length || a.label.localeCompare(b.label))
    : groups.sort((a, b) => Number(a.key === "other") - Number(b.key === "other") || a.label.localeCompare(b.label));
}

export function topPaidJobs(jobs: JobView[], count = 3): JobView[] {
  return jobs.filter(job => job.pay !== null).sort(byPay).slice(0, count);
}

/** Other openings worth a look from a job page: the same employer, then the same calling elsewhere. */
export function relatedJobs(job: JobView, all: JobView[], count = 4) {
  const own = sameJobKey(job);
  const others = all.filter(other => other.slug !== job.slug && (!own || sameJobKey(other) !== own));
  const sameEmployer = job.employer ? others.filter(other => other.employer === job.employer).sort(byPay).slice(0, count) : [];
  const sameProfession = job.profession === "other"
    ? []
    : others.filter(other => other.profession === job.profession && other.employer !== job.employer).sort(byPay).slice(0, count);
  return { sameEmployer, sameProfession };
}

/** One-sentence summary for search results and share cards. */
export function jobDescription(job: JobView, paper: string): string {
  const where = job.town ? ` in ${job.town}` : "";
  const who = job.employer ? ` at ${job.employer}` : "";
  const pay = job.pay ? ` Pay ${formatPayExact(job.pay)} ${payUnit(job.pay)}.` : "";
  const schedule = job.schedule ? ` ${job.schedule}.` : "";
  return `${job.title}${who}${where}.${schedule}${pay} Listed on ${paper}.`;
}

export function formatJobDate(iso?: string): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "America/Los_Angeles" });
}
