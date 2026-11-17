import { Fragment } from "react";
import {
  categoryLabel,
  CLASSIFIED_CATEGORIES,
  dealDollars,
  type ClassifiedListing,
  type PublicDeal,
  type PublicJob,
} from "./marketplace";
import {
  dedupeJobs,
  filterJobs,
  formatJobDate,
  formatPayExact,
  formatPayShort,
  groupJobs,
  hasJobFilters,
  jobBodyBlocks,
  jobFacets,
  jobsBoardHref,
  jobsBoardState,
  jobSourceLine,
  parseJob,
  payUnit,
  professionLabel,
  relatedJobs,
  topPaidJobs,
  type JobInline,
  type JobsBoardState,
  type JobsBoardView,
  type JobView,
} from "./jobs";

function money(price?: number | null): string | null {
  return price != null ? `$${price}` : null;
}

type JobsBoardProps = {
  region: string;
  jobs: PublicJob[];
  query: string;
  /** Choices read from the page address. Omit for the default arrangement. */
  state?: JobsBoardState;
  /** Whether this paper also runs classifieds. */
  classifieds?: boolean;
};

const GROUP_PREVIEW = 6;
const VIEWS: ReadonlyArray<{ value: JobsBoardView; label: string }> = [
  { value: "profession", label: "By profession" },
  { value: "employer", label: "By employer" },
  { value: "pay", label: "By pay" },
];

function plural(count: number, word: string): string {
  return `${count} ${word}${count === 1 ? "" : "s"}`;
}

function jobMeta(job: JobView, view: JobsBoardView): string {
  const schedule = job.workplace === "On-site" ? job.schedule : [job.schedule, job.workplace].filter(Boolean).join(", ");
  return [view === "employer" ? job.department : job.employer, job.town, schedule].filter(Boolean).join(" · ");
}

function JobPayFigure({ job }: { job: JobView }) {
  if (!job.pay) return <span className="nopay">Pay not listed</span>;
  return (
    <span className="pay">
      <span className="amount">{formatPayShort(job.pay)}</span>
      <span className="unit">{payUnit(job.pay)}</span>
    </span>
  );
}

/** Ids come from the API; only name-safe characters reach the inline style. */
function transitionName(id: string): string {
  return `job-${String(id).replace(/[^A-Za-z0-9_-]/gu, "")}`;
}

/** Opts jobs pages, and only jobs pages, into the headline morph between the board and a job. */
function JobsTransition() {
  return <style>{"@media (prefers-reduced-motion: no-preference) { @view-transition { navigation: auto; } }"}</style>;
}

/** Employer-supplied destinations: no opener access and no endorsement passed to search engines. */
const OUTBOUND = { target: "_blank", rel: "noopener nofollow" } as const;

/** Bold text and links in a fetched description. A link gets the same treatment as any employer-supplied address. */
function JobText({ text, rich }: { text: string; rich?: JobInline[] }) {
  if (!rich) return <>{text}</>;
  return (
    <>
      {rich.map((span, at) => {
        const words = span.strong ? <strong>{span.text}</strong> : span.text;
        return span.href ? <a key={at} href={span.href} {...OUTBOUND}>{words}</a> : <Fragment key={at}>{words}</Fragment>;
      })}
    </>
  );
}

function JobRow({ job, view, morph = true }: { job: JobView; view: JobsBoardView; morph?: boolean }) {
  return (
    <a className="row" href={`/jobs/${encodeURIComponent(job.slug)}`}>
      <span className="what">
        <span className="role" style={morph ? { viewTransitionName: transitionName(job.id) } : undefined}>{job.title}</span>
        <span className="meta">{jobMeta(job, view)}</span>
      </span>
      <JobPayFigure job={job} />
    </a>
  );
}

function PostJobBand({ region, classifieds }: { region?: string; classifieds?: boolean }) {
  return (
    <aside className="post" aria-label="For employers">
      <div>
        <h2>{region ? `Hiring near ${region}?` : "Hiring locally?"}</h2>
        <p>Listing a job is free. No credit card.</p>
      </div>
      <p className="postActions">
        <a className="button" href="/jobs/post">Post a job</a>
        {classifieds ? <a className="quiet" href="/classifieds">Classifieds</a> : null}
      </p>
    </aside>
  );
}

export function JobsBoard({ region, jobs, query, state, classifieds = true }: JobsBoardProps) {
  const board: JobsBoardState = state ?? { ...jobsBoardState(), query };
  const all = dedupeJobs(jobs.map(parseJob));
  const facets = jobFacets(all);
  // Each chip counts what choosing it would show, given the other choices already made.
  const towns = jobFacets(filterJobs(all, { ...board, town: "" })).towns;
  const schedules = jobFacets(filterJobs(all, { ...board, schedule: "" })).schedules;
  const payListed = jobFacets(filterJobs(all, { ...board, payOnly: false })).payListed;
  const shown = filterJobs(all, board);
  const filtered = hasJobFilters(board);
  const groups = groupJobs(shown, board.view);
  const leads = !filtered && !board.query ? topPaidJobs(all) : [];
  const chip = (label: string, count: number, active: boolean, href: string) => (
    <a key={label} className="chip" href={href} aria-current={active ? "true" : undefined}>
      <span>{label}</span><span className="n">{count}</span>
    </a>
  );
  return (
    <div className="np-jobs">
      <JobsTransition />
      <header className="head">
        <p className="kicker">Jobs</p>
        <h1>Who’s hiring near {region}</h1>
        <div className="intro">
          <p className="lead">Openings from employers in and around {region}. Browsing is free, and so is posting a job.</p>
          {all.length > 0 ? (
            <dl className="stats">
              <div><dt>{all.length === 1 ? "opening" : "openings"}</dt><dd>{all.length}</dd></div>
              <div><dt>{facets.employers === 1 ? "employer" : "employers"}</dt><dd>{facets.employers}</dd></div>
              <div><dt>{facets.payListed === 1 ? "lists its pay" : "list their pay"}</dt><dd>{facets.payListed}</dd></div>
            </dl>
          ) : null}
        </div>
      </header>

      <div className="controls">
        <form className="search" method="get" action="/jobs" role="search">
          <input name="q" type="search" defaultValue={board.query} aria-label="Search jobs" placeholder="Role, employer or department" maxLength={80} />
          {board.view !== "profession" ? <input type="hidden" name="view" value={board.view} /> : null}
          {board.profession ? <input type="hidden" name="profession" value={board.profession} /> : null}
          {board.town ? <input type="hidden" name="town" value={board.town} /> : null}
          {board.schedule ? <input type="hidden" name="type" value={board.schedule} /> : null}
          {board.payOnly ? <input type="hidden" name="pay" value="1" /> : null}
          <button type="submit">Search</button>
        </form>
        <nav className="views" aria-label="Arrange openings">
          {VIEWS.map(item => (
            <a key={item.value} href={jobsBoardHref(board, { view: item.value })} aria-current={board.view === item.value ? "true" : undefined}>{item.label}</a>
          ))}
        </nav>
      </div>

      {all.length > 0 ? (
        <nav className="chips" aria-label="Narrow openings">
          {filtered || board.query ? <a className="chip clear" href={jobsBoardHref({ ...jobsBoardState(), view: board.view })}>Clear all</a> : null}
          {board.profession ? chip(professionLabel(board.profession) || board.profession, shown.length, true, jobsBoardHref(board, { profession: "" })) : null}
          {towns.slice(0, 6).map(item => chip(item.label, item.count, board.town === item.value, jobsBoardHref(board, { town: board.town === item.value ? "" : item.value })))}
          {schedules.map(item => chip(item.label, item.count, board.schedule === item.value, jobsBoardHref(board, { schedule: board.schedule === item.value ? "" : item.value })))}
          {payListed > 0 ? chip("Pay listed", payListed, board.payOnly, jobsBoardHref(board, { payOnly: !board.payOnly })) : null}
        </nav>
      ) : null}

      {leads.length === 3 ? (
        <section className="leads" aria-labelledby="np-jobs-leads">
          <h2 id="np-jobs-leads" className="label accent">Highest listed pay</h2>
          <div className="leadGrid">
            {leads.map(job => job.pay ? (
              <a key={job.id} className="leadCard" href={`/jobs/${encodeURIComponent(job.slug)}`}>
                <span className="label">{job.employer}</span>
                <span className="figure">{formatPayShort(job.pay)}</span>
                <span className="meta">{formatPayExact(job.pay)} {payUnit(job.pay)}</span>
                <span className="role">{job.title}</span>
                <span className="meta">{[job.town, job.schedule].filter(Boolean).join(" · ")}</span>
              </a>
            ) : null)}
          </div>
        </section>
      ) : null}

      {all.length === 0 ? (
        <section className="empty">
          <h2>{board.query ? "No openings match that search." : "No live jobs yet."}</h2>
          <p>{board.query ? <a href="/jobs">See every opening</a> : "Be the first local employer on the board."}</p>
        </section>
      ) : shown.length === 0 ? (
        <section className="empty">
          <h2>No openings match those choices.</h2>
          <p><a href={jobsBoardHref({ ...jobsBoardState(), view: board.view, query: board.query })}>Clear the filters</a></p>
        </section>
      ) : (
        <div className="groups">
          {groups.map(group => {
            const first = board.view === "pay" ? group.jobs : group.jobs.slice(0, GROUP_PREVIEW);
            const rest = board.view === "pay" ? [] : group.jobs.slice(GROUP_PREVIEW);
            return (
              <section key={group.key} className="group" aria-label={group.label}>
                <div className="groupHead">
                  <h2>{group.label}</h2>
                  {group.note ? <p className="meta">{group.note}</p> : null}
                  <p className="count">{plural(group.jobs.length, "opening")}</p>
                </div>
                <div className="rows">
                  {first.map(job => <JobRow key={job.id} job={job} view={board.view} />)}
                  {rest.length > 0 ? (
                    <details>
                      <summary><span className="closed">Show {rest.length} more in {group.label}</span><span className="opened">Show fewer in {group.label}</span></summary>
                      {rest.map(job => <JobRow key={job.id} job={job} view={board.view} />)}
                    </details>
                  ) : null}
                </div>
              </section>
            );
          })}
        </div>
      )}

      <PostJobBand region={region} classifieds={classifieds} />
    </div>
  );
}

type JobArticleProps = {
  job: PublicJob;
  /** Other live openings, for "more from this employer". */
  related?: PublicJob[];
  region?: string;
  /** The paper's name, used in the note about where applications go. */
  paper?: string;
  /** A paper with its own job categories names the category here; it replaces the profession. */
  category?: { label: string; href?: string };
};

export function JobArticle({ job, related = [], region, paper, category }: JobArticleProps) {
  const view = parseJob(job);
  const others = relatedJobs(view, dedupeJobs(related.map(parseJob)));
  const applyHref = view.applyUrl ?? (view.applyEmail ? `mailto:${view.applyEmail}?subject=${encodeURIComponent(view.title)}` : undefined);
  const applyLabel = view.applyUrl ? `Apply at ${view.applyHost ?? "the employer’s site"}` : "Apply by email";
  const external = view.applyUrl ? OUTBOUND : {};
  const sourced = view.origin === "sourced";
  const source = jobSourceLine(view);
  // A sourced listing that states no town shows none; "On-site" alone would be a place nobody stated.
  const place = sourced && !view.town && view.workplace === "On-site" ? "" : [view.town, view.workplace].filter(Boolean).join(" · ");
  const facts: Array<[string, string]> = [
    ["Employer", view.employer],
    ["Location", place],
    ["Schedule", view.schedule],
    ["Department", view.department],
    ["Posted", formatJobDate(view.publishedAt)],
  ];
  const posted = facts.filter(([, value]) => value);
  const calling = category ?? (view.profession !== "other"
    ? { label: professionLabel(view.profession), href: `/jobs?profession=${view.profession}` }
    : null);
  const kicker = [calling?.label, view.town].filter(Boolean).join(" · ");
  const sameProfession = category ? [] : others.sameProfession;
  return (
    <article className="np-jobs np-job">
      <JobsTransition />
      <nav className="crumbs" aria-label="Breadcrumb">
        <a href="/jobs">Jobs</a>
        {calling ? (
          <><span aria-hidden="true">/</span>{calling.href ? <a href={calling.href}>{calling.label}</a> : <span>{calling.label}</span>}</>
        ) : null}
      </nav>
      <header className="jobHead">
        {kicker ? <p className="label accent">{kicker}</p> : null}
        <h1 style={{ viewTransitionName: transitionName(view.id) }}>{view.title}</h1>
        {view.employer ? <p className="deck">{[view.employer, view.sector].filter(Boolean).join(" · ")}</p> : null}
      </header>
      <div className="sheet">
        <div className="story">
          <div className="prose">
            {view.paragraphs.length > 0
              ? jobBodyBlocks(view.paragraphs, { markdown: sourced }).map((block, index) => block.kind === "heading"
                ? <h2 key={index}>{block.text}</h2>
                : block.kind === "list"
                  ? <ul key={index}>{block.items.map((item, at) => <li key={at}><JobText text={item} rich={block.rich?.[at]} /></li>)}</ul>
                  : <p key={index}><JobText text={block.text} rich={block.rich} /></p>)
              : <p>Details are in the listing.</p>}
            {(view.truncated || view.brief) && view.applyUrl ? (
              <p className="more">
                {view.truncated ? "This is the start of the listing." : "This listing is brief."} Duties, qualifications and how to apply are on the employer’s page.{" "}
                <a href={view.applyUrl} {...external}>Continue at {view.applyHost} <span aria-hidden="true">↗</span></a>
              </p>
            ) : null}
          </div>
        </div>
        <aside className="facts" aria-label="Job facts">
          {view.pay ? (
            <p className="payBlock">
              <span className="label">Pay</span>
              <span className="figure">{formatPayExact(view.pay)}</span>
              <span className="meta">{payUnit(view.pay)}</span>
            </p>
          ) : null}
          <dl>
            {posted.map(([name, value]) => <div key={name}><dt>{name}</dt><dd>{value}</dd></div>)}
          </dl>
          {applyHref ? (
            <>
              <a className="apply" href={applyHref} {...external}>{applyLabel}{view.applyUrl ? <span aria-hidden="true"> ↗</span> : null}</a>
              <p className="meta">You apply directly with the employer{paper ? `. ${paper} does not collect applications.` : "."}{source ? <>{" "}<span className="source">{source}</span></> : null}</p>
            </>
          ) : source ? <p className="meta">{source}</p> : null}
          {view.website && view.websiteHost ? <a className="quiet" href={view.website} {...OUTBOUND}>{view.websiteHost} <span aria-hidden="true">↗</span></a> : null}
        </aside>
        {applyHref ? (
          <div className="applyBar">
            <span className="barPay">{view.pay ? <><strong>{formatPayShort(view.pay)}</strong> {payUnit(view.pay)}</> : view.employer}</span>
            <a className="apply" href={applyHref} {...external}>{view.applyUrl ? "Apply" : "Apply by email"}{view.applyUrl ? <span aria-hidden="true"> ↗</span> : null}</a>
          </div>
        ) : null}
      </div>
      {others.sameEmployer.length > 0 || sameProfession.length > 0 ? (
        <div className="relatedGrid">
          {others.sameEmployer.length > 0 ? (
            <section className="related" aria-label={`More from ${view.employer}`}>
              <h2 className="label">More from {view.employer}</h2>
              {others.sameEmployer.map(item => <JobRow key={item.id} job={item} view="employer" morph={false} />)}
            </section>
          ) : null}
          {sameProfession.length > 0 ? (
            <section className="related" aria-label={`More in ${professionLabel(view.profession)}`}>
              <h2 className="label">More in {professionLabel(view.profession)}</h2>
              {sameProfession.map(item => <JobRow key={item.id} job={item} view="profession" morph={false} />)}
            </section>
          ) : null}
        </div>
      ) : null}
      <PostJobBand region={region} />
    </article>
  );
}

function DealsBlock({ deals }: { deals: PublicDeal[] }) {
  if (deals.length === 0) return null;
  return (
    <section className="deals" aria-label="Deals">
      <h2>Deals</h2>
      <p className="meta">We may earn a commission when you use these links.</p>
      <div className="list">
        {deals.map(deal => {
          const offer = deal.offers[0];
          if (!offer) return null;
          const stores = deal.offers.map(item => item.merchant).filter(Boolean).join(", ");
          return (
            <a key={deal.id} className="item" href={`/classifieds/out/${encodeURIComponent(offer.id)}`}>
              <h2>{deal.title}</h2>
              <p className="meta">{[stores, dealDollars(deal.price_cents ?? offer.price_cents), deal.coupon_code ? `Code ${deal.coupon_code}` : null, deal.locality].filter(Boolean).join(" · ")}</p>
            </a>
          );
        })}
      </div>
    </section>
  );
}

export function ClassifiedsBoard({
  region,
  listings,
  category,
  deals = [],
}: {
  region: string;
  listings: ClassifiedListing[];
  category: string;
  deals?: PublicDeal[];
}) {
  const dealsFirst = listings.length < 8;
  return (
    <div className="np-market">
      <h1>Classifieds</h1>
      <p className="lead">For sale, services, housing and community notices from {region}. Listings stay up for 30 days.</p>
      <div className="actions">
        <a className="primary" href="/classifieds/post">Place a listing</a>
        <a className="secondary" href="/jobs">Jobs</a>
      </div>
      <nav className="filter" aria-label="Categories">
        <a className={!category ? "on" : undefined} href="/classifieds">All</a>
        {CLASSIFIED_CATEGORIES.map(item => (
          <a key={item.value} className={category === item.value ? "on" : undefined} href={`/classifieds?category=${item.value}`}>{item.label}</a>
        ))}
      </nav>
      {dealsFirst ? <DealsBlock deals={deals} /> : null}
      {listings.length === 0 ? (
        deals.length === 0 ? (
          <section className="empty">
            <h2>No classifieds yet.</h2>
            <p>Post something neighbors might need.</p>
          </section>
        ) : (
          <p className="meta">No neighbor listings yet. <a href="/classifieds/post">Place a listing</a>.</p>
        )
      ) : (
        <div className="list">
          {listings.map(listing => (
            <a key={listing.id} className="item" href={`/classifieds/${encodeURIComponent(listing.id)}`}>
              <h2>{listing.title}</h2>
              <p className="meta">{[categoryLabel(listing.category), listing.location?.town, money(listing.price)].filter(Boolean).join(" · ")}</p>
            </a>
          ))}
        </div>
      )}
      {dealsFirst ? null : <DealsBlock deals={deals} />}
    </div>
  );
}

export function ClassifiedArticle({ listing }: { listing: ClassifiedListing }) {
  return (
    <article className="np-market">
      <p className="meta"><a href="/classifieds">Classifieds</a></p>
      <h1>{listing.title}</h1>
      <p className="meta">{[categoryLabel(listing.category), listing.location?.town, money(listing.price)].filter(Boolean).join(" · ")}</p>
      <div className="body">{listing.description}</div>
      <p className="actions">
        <a className="secondary" href="/classifieds">All classifieds</a>
        <a className="primary" href="/classifieds/post">Place a listing</a>
      </p>
    </article>
  );
}
