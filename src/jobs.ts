/**
 * Reading rules for a paper's jobs board.
 *
 * A public posting arrives as a title, a text body and a few typed fields. These
 * helpers turn it into the facts a reader scans for (role, employer, town, pay,
 * profession, how to apply) and arrange a list of postings for the board. They are
 * pure: API calls stay in the site.
 */
import { employmentLabel, type JobOrigin, type PublicJob } from "./marketplace";

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
  /** State or region as stated ("CA"). Kept for the site; the shared pages show the town alone. */
  region: string;
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
  /** `sourced` mirrors a listing on the employer's own page: its text is the description as fetched. */
  origin: JobOrigin;
  /** Sourced listings only: the site the listing was read from, without a leading "www.". */
  sourceHost?: string;
  /** Sourced listings only: when the listing was last read at its source (ISO timestamp). */
  sourceCheckedAt?: string;
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

/** `inText` drops the sentence punctuation that trails an address written in prose; a stated field is read whole. */
function httpsUrl(raw?: string | null, inText = true): string | undefined {
  if (!raw || typeof raw !== "string") return undefined;
  try {
    const parsed = new URL(inText ? raw.trim().replace(/[).,;]+$/u, "") : raw.trim());
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

/**
 * Concise destination host for the primary Apply button ("myworkdayjobs.com", "greenhouse.io")
 * so long ATS tenant subdomains never overflow or wrap the button. Returns undefined when a
 * custom hostname still exceeds 24 characters so the button reads "Apply at the employer’s site".
 * The full hostname remains on `view.applyHost` and `view.sourceHost`.
 */
export function applyButtonHost(host?: string): string | undefined {
  if (!host) return undefined;
  const lower = host.toLowerCase().replace(/^www\./u, "");
  const parts = lower.split(".");
  const multiSuffix = parts.length >= 3 && /^(?:ca|co|com|org|net|gov|edu|ac)$/u.test(parts[parts.length - 2]) && parts[parts.length - 1].length <= 3;
  const rootCount = multiSuffix ? 3 : 2;
  let concise = lower;
  if (parts.length > rootCount) {
    if (/\.myworkdayjobs\.com$/u.test(lower)) {
      concise = "myworkdayjobs.com";
    } else if (/^(?:job-boards|boards|careers|jobs|recruiting\d*|apply|hire|join|app)\./u.test(lower)) {
      concise = parts.slice(-rootCount).join(".");
    }
  }
  return concise.length <= 24 ? concise : undefined;
}

/**
 * Drops internal ERP legal-entity codes that Workday prepends to `hiringOrganization.name`
 * ("100 Salesforce, Inc.", "00104 Equinix LLC", "10 Peet's Coffee Inc.", "ADUS-Adobe Inc.")
 * while leaving real numeric brand names ("24 Hour Fitness", "99 Ranch Market", "10x Genomics") intact.
 */
export function cleanEmployerName(raw: string): string {
  const text = raw.trim();
  if (!text) return "";
  return text
    .replace(/^0\d+\s+(?=\p{Lu})/u, "")
    .replace(/^\d{3,4}\s+(?=\p{Lu}[\p{L}\p{N}&.'()-]+(?:,?\s+(?:Inc\.?|LLC|Corp\.?|Corporation|Company|Co\.?|USA|U\.S\.A\.|Ltd\.?|L\.P\.|LLP)\b|\s+\p{Lu}))/u, "")
    .replace(/^\d{1,2}\s+(?=\p{Lu}.*\b(?:Inc\.?|LLC|Corp\.?|Corporation|Company|U\.S\.A\.|Ltd\.?)\b)/u, "")
    .replace(/^[A-Z]{2,5}-(?=\p{Lu}\p{Ll}+(?:\s|,)+(?:Inc\.?|LLC|Corp\.?|Corporation|Company|Ltd\.?)\b)/u, "")
    .trim();
}

function scheduleKeyOf(label: string): string {
  const text = label.toLowerCase();
  if (/part/u.test(text)) return "part_time";
  if (/temp|season|per diem/u.test(text)) return "temporary";
  if (/contract/u.test(text)) return "contract";
  if (/intern/u.test(text)) return "internship";
  return /full/u.test(text) ? "full_time" : "";
}

/** A stated field as one clean line. Anything that is not text reads as empty. */
function stated(value: unknown, max: number): string {
  return typeof value === "string" ? clip(value.replace(/\s+/gu, " ").trim(), max) : "";
}

const HOST_NAME = /^[\p{L}\p{N}-]+(?:\.[\p{L}\p{N}-]+)+$/u;

/** "www.edjoin.org" and "https://www.edjoin.org/x" both read as "edjoin.org"; anything that is not a host name is left out. */
function sourceHostOf(raw: unknown): string | undefined {
  const text = stated(raw, 253).toLowerCase();
  const host = (/^https?:\/\//u.test(text) ? hostOf(text) ?? "" : text).replace(/^www\./u, "");
  return HOST_NAME.test(host) ? host : undefined;
}

function isoTime(raw: unknown): string | undefined {
  return typeof raw === "string" && raw.trim() && !Number.isNaN(new Date(raw.trim()).getTime()) ? raw.trim() : undefined;
}

/** The label a reader sees and the key a filter matches always come from the same source. */
function scheduleOf(job: PublicJob, line: string): { label: string; key: string } {
  const typed = employmentLabel(job.employment_type);
  if (typed && job.employment_type) {
    return { label: line && scheduleKeyOf(line) === job.employment_type ? line : typed, key: job.employment_type };
  }
  return { label: line, key: scheduleKeyOf(line) };
}

/** A run of description text. `strong` is bold; `href` is an https address the text links to. */
export type JobInline = { text: string; strong?: true; href?: string };

/**
 * `text` and `items` are always plain words. `rich` is set only for a Markdown description,
 * and only where a line carries bold text or a link; `rich[i]` belongs to `items[i]`.
 */
export type JobBodyBlock =
  | { kind: "heading"; text: string }
  | { kind: "list"; items: string[]; rich?: JobInline[][] }
  | { kind: "text"; text: string; rich?: JobInline[] };

const BULLET = /^(?:[•·▪◦‣*–—-]|\d{1,2}[.)])\s+(?=\S)/u;

const headingLike = (line: string | undefined): boolean =>
  line !== undefined
  && !BULLET.test(line)
  && Array.from(line).length <= 60
  && line.split(/\s+/u).length <= 8
  && /\p{L}/u.test(line)
  && !/[.!?;,…。！？]$/u.test(line)
  && !/https?:\/\/|@|^#/u.test(line);

const MD_BULLET = /^(?:[•·▪◦‣*+–—-]|\d{1,3}[.)])\s+(?=\S)/u;
const MD_RULE = /^(?:[-*_=]\s*){3,}$/u;
const MD_FENCE = /^(?:```|~~~)/u;
const MD_HEADING = /^#{1,6}\s+(?=\S)/u;
const MD_BOLD_LINE = /^(?:\*\*([^*]{1,80})\*\*|__([^_]{1,80})__):?$/u;
const MD_TABLE_ROW = /^\|.*\|$/u;
const MD_TABLE_RULE = /^[\s:|-]+$/u;
// Bold, then an image or a link. Every run is bounded and stops at its own opening mark, so hostile text stays linear.
const MD_INLINE = /(?<!\\)(?:\*\*([^*\n]{1,300})\*\*|(?<![\p{L}\p{N}])__([^_\n]{1,300})__(?![\p{L}\p{N}])|(!?)\[([^[\]\n]{0,300})\]\(([^()\s]{1,2000})(?:\s+"[^"\n]{0,300}")?\))/gu;

/** Takes the marks off text that is shown plain: `*emphasis*`, `_emphasis_`, `` `code` `` and backslash escapes. */
function unmark(text: string): string {
  return text
    .replace(/(?<![\\*\p{L}\p{N}])\*(?=\S)([^*\n]{1,300}?)(?<=\S)\*(?![*\p{L}\p{N}])/gu, "$1")
    .replace(/(?<![\\_\p{L}\p{N}])_(?=\S)([^_\n]{1,300}?)(?<=\S)_(?![_\p{L}\p{N}])/gu, "$1")
    .replace(/`([^`\n]{1,300})`/gu, "$1")
    .replace(/\\([!-/:-@[-`{-~])/gu, "$1");
}

function inlineSpans(source: string, strong = false): JobInline[] {
  const spans: JobInline[] = [];
  const push = (text: string, href?: string) => {
    const clean = unmark(text);
    if (!clean) return;
    const last = spans[spans.length - 1];
    // Words that turned out plain (a link with no usable address) rejoin the text around them.
    if (last && !href && !last.href && Boolean(last.strong) === strong) last.text += clean;
    else spans.push({ text: clean, ...(strong ? { strong: true as const } : {}), ...(href ? { href } : {}) });
  };
  let at = 0;
  for (const match of source.matchAll(MD_INLINE)) {
    const start = match.index ?? 0;
    // UTF8-SAFETY: a match starts and ends on an ASCII mark, so these cuts never fall inside a character.
    push(source.slice(at, start));
    at = start + match[0].length;
    const bold = match[1] ?? match[2];
    if (bold !== undefined) for (const span of inlineSpans(bold, true)) spans.push(span);
    // A link keeps its words and, when the address is a plain https one, its destination. A picture is left out.
    else if (!match[3]) push(match[4], httpsUrl(match[5], false));
  }
  push(source.slice(at));
  return spans;
}

type MarkdownLine = { kind: "heading" | "item" | "row" | "text"; text: string; spans: JobInline[] };

function readMarkdownLine(raw: string): MarkdownLine | null {
  let line = raw.trim().replace(/^(?:>\s?)+/u, "");
  if (!line || MD_RULE.test(line) || MD_FENCE.test(line)) return null;
  let kind: MarkdownLine["kind"] = "text";
  let match: RegExpMatchArray | null;
  if (MD_TABLE_ROW.test(line)) {
    if (MD_TABLE_RULE.test(line)) return null;
    kind = "row";
    line = line.split("|").map(cell => cell.trim()).filter(Boolean).join(" · ");
  } else if ((match = line.match(MD_HEADING))) {
    kind = "heading";
    // UTF8-SAFETY: the cut follows a matched run of "#" and spaces.
    line = line.slice(match[0].length);
  } else if ((match = line.match(MD_BOLD_LINE)) && !/[.!?。！？]$/u.test(match[1] ?? match[2])) {
    kind = "heading";
    line = match[1] ?? match[2];
  } else if ((match = line.match(MD_BULLET))) {
    kind = "item";
    // UTF8-SAFETY: the cut follows a whole matched bullet mark and its spaces.
    line = line.slice(match[0].length).replace(/^\[[ xX]\]\s+/u, "");
  }
  const spans = inlineSpans(line);
  const text = spans.map(span => span.text).join("").replace(/\s+/gu, " ").trim();
  return text ? { kind, text, spans } : null;
}

const marked = (spans: JobInline[]): boolean => spans.some(span => span.strong || span.href);

/**
 * A description fetched from the employer's page as Markdown. Read: paragraphs, `#` headings,
 * a bold-only line as a heading, bullet and numbered lists (shown as bullets, nesting flattened),
 * bold text and https links. Emphasis, code marks and quote marks come off and the words stay.
 * A table row becomes one line of its cells; rules, code fences and pictures are left out.
 */
function markdownBlocks(paragraphs: readonly string[]): JobBodyBlock[] {
  const lines = paragraphs.map(readMarkdownLine).filter((line): line is MarkdownLine => line !== null);
  // A short plain line may still be a heading the source did not mark; a "Label: value" line or a table row never is.
  const loose = (line: MarkdownLine | undefined): boolean =>
    line?.kind === "text" && !marked(line.spans) && !/:\s+\S/u.test(line.text) && headingLike(line.text);
  const blocks: JobBodyBlock[] = [];
  lines.forEach((line, index) => {
    if (line.kind === "item") {
      const previous = blocks[blocks.length - 1];
      const list = previous?.kind === "list" ? previous : { kind: "list" as const, items: [] as string[], rich: [] as JobInline[][] };
      if (list !== previous) blocks.push(list);
      list.items.push(line.text);
      list.rich?.push(line.spans);
      return;
    }
    const before = lines[index - 1];
    const after = lines[index + 1];
    const heading = line.kind === "heading"
      || (loose(line) && after !== undefined && after.kind !== "heading" && !loose(after) && before?.kind !== "heading" && !loose(before));
    if (heading) blocks.push({ kind: "heading", text: line.text.replace(/\s*:$/u, "") });
    else blocks.push(marked(line.spans) ? { kind: "text", text: line.text, rich: line.spans } : { kind: "text", text: line.text });
  });
  for (const block of blocks) if (block.kind === "list" && !block.rich?.some(marked)) delete block.rich;
  return blocks;
}

/**
 * Give a description its shape back: bullet lines become one list, and a short line
 * with no sentence ending that introduces what follows becomes a sub-heading.
 * A run of short lines (an address, a sign-off) stays text. Nothing is reworded or dropped.
 *
 * `markdown` is for a sourced listing, whose text is the description as fetched: see `markdownBlocks`.
 * Without it the lines are read exactly as before.
 */
export function jobBodyBlocks(paragraphs: readonly string[], options: { markdown?: boolean } = {}): JobBodyBlock[] {
  if (options.markdown) return markdownBlocks(paragraphs);
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

/**
 * The lines of a fetched description, untouched. The one thing settled here is a heading written as a line
 * with a row of "=" or "-" directly under it, because only here are the blank lines still known.
 */
function descriptionLines(body: string): string[] {
  const lines: string[] = [];
  let underlinable = false;
  for (const rawLine of body.split(/\r?\n/u)) {
    const line = rawLine.trim();
    if (!line) { underlinable = false; continue; }
    if (underlinable && /^(?:={2,}|-{2,})$/u.test(line)) {
      lines[lines.length - 1] = `## ${lines[lines.length - 1]}`;
      underlinable = false;
      continue;
    }
    lines.push(line);
    underlinable = line.length <= 120 && !MD_BULLET.test(line) && !MD_RULE.test(line) && !/^[#|>]/u.test(line);
  }
  return lines;
}

/**
 * Reads the facts out of a posting. Every field degrades to empty rather than to a guess.
 *
 * A fact the jobs API states as a field (`employer_name`, `locality`, `region`, `apply_url`) is used
 * when it is filled; otherwise the fact is read from the headline and the labelled lines of the text.
 * A `sourced` posting's text is the description as fetched: it is not searched for facts and no line
 * is taken out of it, so its town is the stated `locality` or none.
 */
export function parseJob(job: PublicJob): JobView {
  const rawTitle = clip((job.title ?? "").trim(), TITLE_LIMIT);
  const body = (job.body_md ?? "").trim();
  const sourced = job.origin === "sourced";
  // "Role — Employer (Town, ST) [Track]". The employer may carry its own brackets: "District (EBMUD) (Alamo, CA)".
  // Without the closing "(Town, ST)" a dash is just punctuation in someone's headline, not an employer.
  const titleMatch = rawTitle.match(/^(.*)\s+—\s+(.+?)\s*\(([^()]+,\s*[A-Z]{2})\)(?:\s*\[[^\]]+\])?$/u);
  const role = cleanJobTitle(titleMatch?.[1]?.trim() || rawTitle.replace(/\s*\[[^\]]+\]$/u, ""));
  // The stated employer outranks the headline, and the headline outranks a line in the text.
  let employer = cleanEmployerName(stated(job.employer_name, 120) || (titleMatch?.[2]?.trim() ?? ""));
  const titlePlace = titleMatch?.[3]?.trim() ?? "";

  let sector = "";
  let place = "";
  let scheduleLine = "";
  let department = "";
  let textPay: JobPay | null = null;
  let applyUrl: string | undefined;
  let applyEmail: string | undefined;
  let website: string | undefined;
  const paragraphs: string[] = sourced ? descriptionLines(body) : [];

  // A labelled line is taken off the page only when its value was understood;
  // "Apply: call 925-555-1212" or "Compensation: DOE" stays in the text as written.
  for (const rawLine of sourced ? [] : body.split(/\r?\n/u)) {
    const line = rawLine.trim();
    if (!line) continue;
    if (line.length > LINE_LIMIT) { paragraphs.push(line); continue; }
    let match: RegExpMatchArray | null;
    if ((match = line.match(/^Location:\s*(.+)$/iu))) { place = match[1].trim(); continue; }
    if ((match = line.match(/^Town:\s*(.+)$/iu))) { if (!place) place = match[1].trim(); continue; }
    if ((match = line.match(/^Employer:\s*(.+)$/iu))) {
      const parts = match[1].split(/\s*·\s*/u);
      if (!employer && parts[0]) employer = cleanEmployerName(parts[0]);
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

  // The stated town outranks the text and the headline. A sourced listing has no other place to read one from:
  // its headline and description are the employer's words, not a labelled fact, so an unstated town stays empty.
  const locality = stated(job.locality, 80);
  const location = locality || (sourced ? "" : place || titlePlace);
  const where = locality ? `${locality} ${place}` : place;
  const workplace: JobWorkplace = /\bhybrid\b/iu.test(where) || job.location_type === "hybrid"
    ? "Hybrid"
    : /\bremote\b/iu.test(where) || job.location_type === "remote" || job.remote_allowed
      ? "Remote"
      : "On-site";
  let unlabelled = location
    .replace(/\s*\((On-?site|Hybrid|Remote)\)\s*/giu, " ")
    .replace(/\s*(?:[-–—·,|/]\s*)+(?:On-?site|Hybrid|Remote)\s*$/iu, "")
    .replace(/^(?:On-?site|Hybrid|Remote)\s*(?:[-–—·,|/]\s*)+/iu, "")
    .trim();
  let inferredRegion = "";
  const usStateCity = unlabelled.match(/^US(?:A)?,\s*([A-Z]{2}),\s*(.+)$/iu);
  if (usStateCity) {
    inferredRegion = usStateCity[1].toUpperCase();
    unlabelled = usStateCity[2].trim();
  }
  const caCity = unlabelled.match(/^California\s+[-–—]\s+(.+)$/iu);
  if (caCity) {
    inferredRegion = inferredRegion || "CA";
    unlabelled = caCity[1].trim();
  }
  const state = unlabelled.match(/,\s*([A-Z]{2})(?:\s+\d{5}(?:-\d{4})?)?$/u);
  // UTF8-SAFETY: the cut is at the comma the pattern matched.
  let named = (state ? unlabelled.slice(0, state.index) : unlabelled).trim();
  named = named.replace(/^([A-Za-z][A-Za-z .'-]{2,}?)\s+\d{1,3}$/u, "$1").trim();
  if (/^[A-Z]{2,}(?:\s+[A-Z]{2,})+$/u.test(named)) {
    named = named.toLowerCase().replace(/\b[a-z]/gu, ch => ch.toUpperCase());
  }
  const town = /^(remote|hybrid|on-?site|anywhere|us|usa|united states)$/iu.test(named) ? "" : clip(named, 60);
  const schedule = scheduleOf(job, scheduleLine);
  // The stated application page outranks an address found in the text; one that is not a web address is ignored.
  applyUrl = httpsUrl(job.apply_url, false) ?? applyUrl;

  // The seeded opening sentence ("Acme is hiring for Role in Town, CA.") repeats the headline; drop it when real text follows.
  const opener = paragraphs[0] ?? "";
  const seededOpener = !sourced && paragraphs.length > 1 && employer !== "" && opener.length < 400
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
    region: stated(job.region, 40) || (state?.[1] ?? inferredRegion),
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
    origin: sourced ? "sourced" : "employer",
    sourceHost: sourced ? sourceHostOf(job.source_host) : undefined,
    sourceCheckedAt: sourced ? isoTime(job.source_checked_at) : undefined,
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

/**
 * Where a sourced listing came from and when it was last read there: "Listed on edjoin.org · checked Nov 17".
 * The date is left off when it is not known and carries its year once it is from another year.
 * Empty for a posting made to the paper, and for a sourced one that does not name its source.
 */
export function jobSourceLine(job: Pick<JobView, "origin" | "sourceHost" | "sourceCheckedAt">, now: Date = new Date()): string {
  if (job.origin !== "sourced" || !job.sourceHost) return "";
  const checked = job.sourceCheckedAt ? new Date(job.sourceCheckedAt) : null;
  if (!checked || Number.isNaN(checked.getTime())) return `Listed on ${job.sourceHost}`;
  const year = (date: Date) => date.toLocaleDateString("en-US", { year: "numeric", timeZone: "America/Los_Angeles" });
  const day = checked.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "America/Los_Angeles",
    ...(year(checked) === year(now) ? {} : { year: "numeric" as const }),
  });
  return `Listed on ${job.sourceHost} · checked ${day}`;
}
