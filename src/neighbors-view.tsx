import {
  NEIGHBOR_STORY_CATEGORIES,
  NEIGHBOR_SUBMISSION_TERMS,
  filterNeighborFeed,
  neighborCategoryLabel,
  nomineeKindLabel,
  visibleInNeighborFeed,
  type NeighborFeedPost,
} from "./neighbors";

function formatDay(value?: string | null): string {
  if (!value) return "";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "";
  return parsed.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function NeighborsBoard({
  region,
  posts,
  towns = [],
  selectedTown = "",
  selectedCategory = "",
  followedTowns = [],
  onlyArticlePickups = false,
}: {
  region: string;
  posts: NeighborFeedPost[];
  towns?: string[];
  selectedTown?: string;
  selectedCategory?: string;
  followedTowns?: string[];
  onlyArticlePickups?: boolean;
}) {
  const visible = filterNeighborFeed(posts, {
    town: selectedTown,
    category: selectedCategory,
    followedTowns,
    onlyArticlePickups,
  });

  const buildFilterHref = (next: {
    town?: string;
    category?: string;
    articles?: boolean;
  }) => {
    const params = new URLSearchParams();
    const town = next.town !== undefined ? next.town : selectedTown;
    const category = next.category !== undefined ? next.category : selectedCategory;
    const articles = next.articles !== undefined ? next.articles : onlyArticlePickups;
    if (town) params.set("town", town);
    if (category) params.set("category", category);
    if (articles) params.set("picked_up", "1");
    const qs = params.toString();
    return qs ? `/neighbors?${qs}` : "/neighbors";
  };

  return (
    <div className="np-market np-neighbors">
      <h1>Neighbors &amp; Local Spotlight</h1>
      <p className="lead">
        Positive stories, awards, milestones, and everyday heroes across {region} — shared by
        neighbors and reviewed by our editors.
      </p>
      <div className="actions">
        <a className="primary" href="/neighbors/nominate">
          Nominate a neighbor or business
        </a>
        <a
          className="secondary"
          href={buildFilterHref({ articles: !onlyArticlePickups })}
          aria-pressed={onlyArticlePickups}
        >
          {onlyArticlePickups ? "Showing stories picked up for articles" : "Picked up for news articles"}
        </a>
      </div>

      <nav className="filter" aria-label="Story categories">
        <a className={!selectedCategory ? "on" : undefined} href={buildFilterHref({ category: "" })}>
          All stories
        </a>
        {NEIGHBOR_STORY_CATEGORIES.map(item => (
          <a
            key={item.value}
            className={selectedCategory === item.value ? "on" : undefined}
            href={buildFilterHref({ category: item.value })}
          >
            {item.label}
          </a>
        ))}
      </nav>

      {towns.length > 0 && (
        <nav className="filter" aria-label="Towns">
          <a className={!selectedTown ? "on" : undefined} href={buildFilterHref({ town: "" })}>
            All {region}
          </a>
          {towns.map(town => (
            <a
              key={town}
              className={selectedTown === town ? "on" : undefined}
              href={buildFilterHref({ town })}
            >
              {town}
            </a>
          ))}
        </nav>
      )}

      {visible.length === 0 ? (
        <section className="empty">
          <h2>No neighbor spotlights here yet.</h2>
          <p>
            Know a neighbor who won an award, a volunteer who stepped up, or a local business with
            a story worth celebrating? <a href="/neighbors/nominate">Share their story</a>.
          </p>
        </section>
      ) : (
        <div className="list">
          {visible.map(post => {
            const dateText = formatDay(post.publishedAt || post.createdAt);
            return (
              <article key={post.id} className="item np-neighbor-card">
                <p className="meta">
                  {[
                    neighborCategoryLabel(post.category),
                    nomineeKindLabel(post.nomineeKind),
                    post.town,
                    dateText,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
                <h2>
                  <a href={`/neighbors/${encodeURIComponent(post.id)}`}>
                    {`${post.nomineeName}: ${post.headline}`}
                  </a>
                </h2>
                {post.photoUrl && (
                  <figure className="np-neighbor-figure">
                    <img src={post.photoUrl} alt={post.photoCaption || post.nomineeName} loading="lazy" />
                    {(post.photoCaption || post.photoCredit) && (
                      <figcaption className="meta">
                        {[post.photoCaption, post.photoCredit ? `Photo: ${post.photoCredit}` : null]
                          .filter(Boolean)
                          .join(" · ")}
                      </figcaption>
                    )}
                  </figure>
                )}
                <div className="body">{post.story}</div>
                {post.status === "featured_in_article" && post.articleSlug && (
                  <p className="meta np-neighbor-pickup">
                    <strong>Picked up by the newsroom:</strong>{" "}
                    <a href={`/${encodeURIComponent(post.articleSlug)}`}>
                      {post.articleTitle || `Read the full article on ${post.nomineeName}`}
                    </a>
                  </p>
                )}
                <p className="meta">
                  Shared by {post.submitterName} ·{" "}
                  <a href={`/neighbors/${encodeURIComponent(post.id)}#flag`}>
                    Flag or request removal
                  </a>
                </p>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function NeighborNominationDetail({ post }: { post: NeighborFeedPost }) {
  if (!visibleInNeighborFeed(post)) {
    return (
      <article className="np-market np-neighbors">
        <p className="meta">
          <a href="/neighbors">Neighbors</a>
        </p>
        <h1>This neighbor post is not available.</h1>
        <p className="lead">
          It may still be awaiting editorial review or may have been removed under our community
          guidelines.
        </p>
        <p className="actions">
          <a className="secondary" href="/neighbors">
            Back to Neighbors feed
          </a>
          <a className="primary" href="/neighbors/nominate">
            Nominate a neighbor or business
          </a>
        </p>
      </article>
    );
  }

  const dateText = formatDay(post.publishedAt || post.createdAt);

  return (
    <article className="np-market np-neighbors">
      <p className="meta">
        <a href="/neighbors">Neighbors</a> ·{" "}
        {[neighborCategoryLabel(post.category), nomineeKindLabel(post.nomineeKind), post.town, dateText]
          .filter(Boolean)
          .join(" · ")}
      </p>
      <h1>{`${post.nomineeName}: ${post.headline}`}</h1>
      {post.status === "featured_in_article" && post.articleSlug && (
        <aside className="np-neighbor-pickup" aria-label="Featured newsroom story">
          <p className="meta">
            <strong>Picked up for a news article:</strong> Our editors reported a full feature based
            on this community nomination.{" "}
            <a href={`/${encodeURIComponent(post.articleSlug)}`}>
              {post.articleTitle || "Read the full story"}
            </a>
            .
          </p>
        </aside>
      )}
      {post.photoUrl && (
        <figure className="np-neighbor-figure">
          <img src={post.photoUrl} alt={post.photoCaption || post.nomineeName} />
          {(post.photoCaption || post.photoCredit) && (
            <figcaption className="meta">
              {[post.photoCaption, post.photoCredit ? `Photo: ${post.photoCredit}` : null]
                .filter(Boolean)
                .join(" · ")}
            </figcaption>
          )}
        </figure>
      )}
      <div className="body">{post.story}</div>
      <p className="meta">Nominated by {post.submitterName} in {post.town}.</p>
      <p className="meta">{NEIGHBOR_SUBMISSION_TERMS.rules[2]}</p>
      <p className="actions">
        <a className="secondary" href="/neighbors">
          All neighbor stories
        </a>
        <a className="primary" href="/neighbors/nominate">
          Nominate a neighbor or business
        </a>
      </p>
    </article>
  );
}

export function NeighborSpotlightCallout({
  region,
  nominateHref = "/neighbors/nominate",
  feedHref = "/neighbors",
}: {
  region: string;
  nominateHref?: string;
  feedHref?: string;
}) {
  return (
    <aside className="np-market np-neighbor-callout" aria-label="Nominate a neighbor or local business">
      <h2>Know a neighbor or local business in {region} with a story worth sharing?</h2>
      <p className="meta">
        Whether someone won an award, celebrated a milestone, crafts something remarkable, or
        quietly stepped up for the neighborhood, share it with our editors and the community feed.
      </p>
      <div className="actions">
        <a className="primary" href={nominateHref}>
          Nominate a neighbor or business
        </a>
        <a className="secondary" href={feedHref}>
          Read the Neighbors feed
        </a>
      </div>
    </aside>
  );
}
