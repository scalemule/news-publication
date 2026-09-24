import {
  categoryLabel,
  CLASSIFIED_CATEGORIES,
  dealDollars,
  employmentLabel,
  type ClassifiedListing,
  type PublicDeal,
  type PublicJob,
} from "./marketplace";

function money(price?: number | null): string | null {
  return price != null ? `$${price}` : null;
}

export function JobsBoard({ region, jobs, query }: { region: string; jobs: PublicJob[]; query: string }) {
  return (
    <div className="np-market">
      <h1>Jobs</h1>
      <p className="lead">Local openings from {region} employers. Browse free. Post a job without a credit card.</p>
      <div className="actions">
        <a className="primary" href="/jobs/post">Post a job</a>
        <a className="secondary" href="/classifieds">Classifieds</a>
      </div>
      <form className="search" method="get" action="/jobs">
        <input name="q" defaultValue={query} aria-label="Search jobs" placeholder="Title or employer" maxLength={80} />
        <button className="secondary" type="submit">Search</button>
      </form>
      {jobs.length === 0 ? (
        <section className="empty">
          <h2>No live jobs yet.</h2>
          <p>Be the first local employer on the board.</p>
        </section>
      ) : (
        <div className="list">
          {jobs.map(job => (
            <a key={job.id} className="item" href={`/jobs/${encodeURIComponent(job.slug)}`}>
              <h2>{job.title}</h2>
              <p className="meta">{[employmentLabel(job.employment_type), job.location_type === "remote" || job.remote_allowed ? "Remote" : "On-site"].filter(Boolean).join(" · ")}</p>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

export function JobArticle({ job }: { job: PublicJob }) {
  return (
    <article className="np-market">
      <p className="meta"><a href="/jobs">Jobs</a></p>
      <h1>{job.title}</h1>
      <div className="body">{job.body_md || "Details are in the listing."}</div>
      <p className="actions">
        <a className="secondary" href="/jobs">All jobs</a>
        <a className="primary" href="/jobs/post">Post a job</a>
      </p>
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
