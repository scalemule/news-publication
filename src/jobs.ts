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
  ["legal", /\b(counsel|attorney|paralegal|legal|law clerk)\b/iu],
  ["public-safety", /\b(police|sheriff|dispatcher|firefighter|fire (captain|inspector|marshal|chief)|paramedic|emt|probation|correctional|public safety|security (officer|guard))\b/iu],
  ["technology", /\b(software|programmer|developer|information systems|information technology|it (support|specialist|manager|analyst)|systems? (analyst|administrator)|data (engineer|scientist|analyst)|test automation|devops|cyber\w*|network (engineer|administrator)|machine learning|qa engineer|web designer)\b/iu],
  ["trades", /\b(janitor\w*|custodi\w*|maintenance|mechanic|electrician|plumber|carpenter|welder|hvac|driver|warehouse|groundskeeper|facilities|equipment operator|laborer|utility worker)\b/iu],
  ["education", /\b(teacher|teaching|instructor|professor|tutor|principal|school|elementary|classroom|special education|noon supervisor|librar\w*|paraeducator|substitute|child ?care|preschool)\b/iu],
  ["healthcare", /\b(rn|lvn|cna|nurse|nursing|physician|physicist|pharmac\w*|psycholog\w*|psychiatr\w*|therapist|therapy|clinical|clinic|medical|medicine|mental health|patient|sterile processing|dental|dentist|surgical|surgery|radiolog\w*|oncology|laboratory|caregiver|health professional|veterinar\w*)\b/iu],
  ["engineering", /\b(engineer|engineering|planner|planning|surveyor|architect|drafter|inspector)\b/iu],
  ["finance", /\b(account(ing|ant)s?|fund|controller|bookkeep\w*|payroll|audit\w*|financial|finance|tax|treasury|budget|loan|bank\w*|underwrit\w*|actuar\w*)\b/iu],
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
  paragraphs: string[];
  /** The source text stops mid-sentence; the page says so instead of pretending it is whole. */
  truncated: boolean;
  publishedAt?: string;
};

const ANNUAL_FACTOR: Record<JobPayPeriod, number> = { year: 1, month: 12, hour: 2080 };

function payPeriod(text?: string | null): JobPayPeriod | null {
  if (!text) return null;
  if (/hour/iu.test(text)) return "hour";
  if (/month/iu.test(text)) return "month";
  if (/year|annual/iu.test(text)) return "year";
  return null;
}

function makePay(min: number, max: number, period: JobPayPeriod): JobPay | null {
  if (!Number.isFinite(min) || min <= 0) return null;
  const top = Number.isFinite(max) && max >= min ? max : min;
  return { min, max: top, period, annual: top * ANNUAL_FACTOR[period] };
}

function payFromFields(job: PublicJob): JobPay | null {
  if (job.salary_min_minor == null || job.salary_min_minor <= 0) return null;
  const min = job.salary_min_minor / 100;
  const max = (job.salary_max_minor ?? job.salary_min_minor) / 100;
  const period = payPeriod(job.salary_period) ?? (min < 250 ? "hour" : min < 25_000 ? "month" : "year");
  return makePay(min, max, period);
}

function payFromText(line: string): JobPay | null {
  const amounts = Array.from(line.matchAll(/\$\s?([\d,]+(?:\.\d+)?)/gu), match => Number(match[1].replace(/,/gu, "")));
  if (amounts.length === 0) return null;
  const min = amounts[0];
  const max = amounts[1] ?? amounts[0];
  const period = payPeriod(line) ?? (min < 250 ? "hour" : min < 25_000 ? "month" : "year");
  return makePay(min, max, period);
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

const SHIFT_NOISE = /^(full[\s-]?time|part[\s-]?time|\d+\s?hours?|days?|nights?|evenings?|variable(\s+shift)?|day shift|night shift)(\s+[\p{L} .]+(,\s*[A-Z]{2})?)?…?$/iu;

/** Drops scheduling codes an applicant-tracking system appends to a role ("- Full Time - 8 Hour - Days"). */
export function cleanJobTitle(role: string): string {
  const parts = role.trim().split(/\s+-\s+/u);
  const kept = parts.filter((part, index) => index === 0 || !SHIFT_NOISE.test(part.trim()));
  return kept.join(" - ").replace(/\s{2,}/gu, " ").replace(/[\s,;:–—-]+$/u, "").trim();
}

function httpsUrl(raw?: string | null): string | undefined {
  if (!raw) return undefined;
  try {
    const parsed = new URL(raw.trim().replace(/[).,;]+$/u, ""));
    return parsed.protocol === "https:" ? parsed.href : undefined;
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

function scheduleKey(job: PublicJob, label: string): string {
  if (job.employment_type && employmentLabel(job.employment_type)) return job.employment_type;
  const text = label.toLowerCase();
  if (/part/u.test(text)) return "part_time";
  if (/temp|season|per diem/u.test(text)) return "temporary";
  if (/contract/u.test(text)) return "contract";
  if (/intern/u.test(text)) return "internship";
  return text ? "full_time" : "";
}

/** Reads the facts out of a posting. Every field degrades to empty rather than to a guess. */
export function parseJob(job: PublicJob): JobView {
  const rawTitle = (job.title ?? "").trim();
  const body = (job.body_md ?? "").trim();
  // "Role — Employer (Town, ST) [Track]". The employer may carry its own brackets: "District (EBMUD) (Alamo, CA)".
  const titleMatch = rawTitle.match(/^(.*)\s+—\s+(.+?)(?:\s*\(([^()]+,\s*[A-Z]{2})\))?(?:\s*\[[^\]]+\])?$/u);
  const role = cleanJobTitle(titleMatch?.[1]?.trim() || rawTitle.replace(/\s*\[[^\]]+\]$/u, ""));
  let employer = titleMatch?.[2]?.trim() ?? "";
  const titlePlace = titleMatch?.[3]?.trim() ?? "";

  let sector = "";
  let place = "";
  let scheduleLine = "";
  let department = "";
  let payLine = "";
  let applyUrl: string | undefined;
  let applyEmail: string | undefined;
  let website: string | undefined;
  const paragraphs: string[] = [];

  for (const rawLine of body.split(/\r?\n/u)) {
    const line = rawLine.trim();
    if (!line) continue;
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
    if ((match = line.match(/^Compensation:\s*(.+)$/iu))) { payLine = match[1].trim(); continue; }
    if ((match = line.match(/^\[Apply on .*?\]\((\S+?)\)$/iu))) { applyUrl = httpsUrl(match[1]); continue; }
    if ((match = line.match(/^Apply on .*?:\s*(\S+)$/iu))) { applyUrl = httpsUrl(match[1]); continue; }
    if ((match = line.match(/^Apply:\s*(.+)$/iu))) {
      const target = match[1].trim();
      const url = httpsUrl(target);
      if (url) applyUrl = url;
      else if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(target)) applyEmail = target;
      continue;
    }
    if ((match = line.match(/^Employer website:\s*(\S+)$/iu))) { website = httpsUrl(match[1]); continue; }
    if (/^\*\*Track:\*\*/u.test(line) || /^Technical Track:/iu.test(line) || /^Role Overview:$/iu.test(line)) continue;
    paragraphs.push(line);
  }

  const location = place || titlePlace;
  const town = location.replace(/\s*\((On-site|Hybrid|Remote)\)\s*/giu, "").replace(/,\s*[A-Z]{2}$/u, "").trim();
  const workplace: JobWorkplace = /\bhybrid\b/iu.test(place) || job.location_type === "hybrid"
    ? "Hybrid"
    : /\bremote\b/iu.test(place) || job.location_type === "remote" || job.remote_allowed
      ? "Remote"
      : "On-site";
  const schedule = scheduleLine || employmentLabel(job.employment_type);

  // The seeded opening sentence repeats the headline; drop it when real text follows.
  const prose = paragraphs.length > 1 && /\bis hiring\b.+\bin\b.+\.$/iu.test(paragraphs[0]) ? paragraphs.slice(1) : paragraphs;
  const last = prose[prose.length - 1] ?? "";

  return {
    id: job.id,
    slug: job.slug,
    title: role || rawTitle,
    rawTitle,
    employer,
    sector,
    town,
    workplace,
    schedule,
    scheduleKey: scheduleKey(job, schedule),
    department,
    profession: classifyProfession(role, department, sector),
    pay: payFromFields(job) ?? (payLine ? payFromText(payLine) : null),
    applyUrl,
    applyHost: hostOf(applyUrl),
    applyEmail,
    website,
    paragraphs: prose,
    truncated: /(\.\.\.|…)$/u.test(last),
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

/** One posting per role, employer and town; a re-import must not show the same job twice. */
export function dedupeJobs(jobs: JobView[]): JobView[] {
  const seen = new Set<string>();
  return jobs.filter(job => {
    const key = `${job.title}|${job.employer}|${job.town}`.toLowerCase();
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
  const others = all.filter(other => other.slug !== job.slug);
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
