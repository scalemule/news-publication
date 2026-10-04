# @scalemule/news-publication

Server framework for ScaleMule local news sites. Walnut Creek Times is the reference: broadsheet layout, the 30s/60s news cache, on-demand revalidation, front-page composition, article structured data, and the analytics event contract.

Each paper stays its own site, domain, and ScaleMule application. The package holds the shared behavior. The paper passes its name, towns, theme, layout, and feature flags.

```ts
import { definePublication, walnutCreekTimes } from "@scalemule/news-publication";

export const publication = walnutCreekTimes;

export const napaGate = definePublication({
  slug: "napagate",
  name: "Napa Gate",
  masthead: ["Napa", "Gate"],
  region: "Napa Valley",
  regionLabel: "Napa Valley",
  towns: ["Napa", "Yountville", "St. Helena"],
  description: "Local stories from Napa Valley.",
  layout: "napagate",
  layouts: ["napagate", "broadsheet"],
  theme: { accent: "#6b2d5b" },
  features: { referrals: true, coupons: true },
});
```

`resolveLayout(publication, cookie)` returns the paper default for crawlers and readers with no cookie. A reader preference is kept only when that paper listed the layout in `layouts`. The cookie name is `news_publication_layout`.

## Config sync

The application record is the source of truth. The site stores the last accepted copy in `publication.snapshot.json` and ships that file with the deployment. `syncPublicationFile` from `@scalemule/news-publication/snapshot-file` writes a new file only after a complete record for that paper arrives. The main package entry stays free of Node file APIs so client components can import it. A timeout, a 500, a truncated body, or another paper's payload leaves the file untouched.

That snapshot does not expire. A paper whose application API is unreachable for several days, including across restarts, keeps serving the last synced name, towns, theme, and flags. The result reports `source: "retained"` and how old the snapshot is, so the outage can be logged. The only paper that cannot render is one that has never synced.

Code hooks such as `matchTag` are attached in the site after the snapshot loads. They are not part of the stored file.

## What a paper turns on

| Flag | Default | Meaning |
|---|---|---|
| `smile` | off, on for Walnut Creek Times | Mount the paper's Daily Smile module |
| `comments` | off | Article discussion thread |
| `chat` | off | Town room, same discussions service |
| `jobs`, `classifieds` | off | Boards for that paper |
| `referrals` | off | Read a `ref` code (or `referrals.queryParam`) into analytics |
| `coupons` | off | Resolve `coupons.offers` or a paper-supplied `coupons.resolve` |

Referrals and coupons do not call Billing. `resolveCoupon` returns the offer the paper configured, or null when the flag is off. The checkout call stays in the site, using that paper's API key.

`matchTag` replaces the generic tag matcher when a paper has its own neighborhood rules. `modules.home` and `modules.articleEnd` name site-owned blocks the paper renders.

## Cache

`NEWS_CACHE` is the policy verified on walnutcreektimes.com.

- Feeds revalidate every 30 seconds (`feedCacheOptions`).
- Articles revalidate every 60 seconds (`articleCacheOptions`).
- `edgeCacheControl()` is `public, s-maxage=60, stale-while-revalidate=300`.
- `withLastKnown` returns the last good feed or article when the gateway fails, and still throws on a 404.
- `revalidateDecision` is the authorization and response body for `POST /api/revalidate`. The route then purges `defaultRevalidateTargets()`.

## Search

`newsArticleJsonLd`, `publicationJsonLd`, `publicationMeta`, and `articleMeta` are the fields the paper puts on its pages. `llmsText` is the body for `/llms.txt`. Preview hosts pass `indexable: false`.

## Type

Import `@scalemule/news-publication/tokens.css` on the publication shell. Headlines use `--font-editorial` at every width, and navigation uses `--font-inter`. The site loads those faces. Override `--pub-accent` or `--pub-serif` on `.publication` for a paper that should not match the broadsheet palette.

The React front page still lives in the Walnut Creek Times repository. This package is the server contract those components move onto, so a font, cache, or schema fix ships once and each paper picks it up by version.

## Versioning

Patch only (`0.0.x` or `0.1.x`) until a stable release is explicitly approved. Publishing is manual: `npm publish` from this directory.


### Reporting credit and sources

`ArticleProvenance` renders the public reporting projection: analysis/commentary labels, network and wire credit, and up to five deduplicated source links. It accepts `NewsArticle.metadata` and never renders internal claim mappings, reporter notes or source artifacts. Syndicated commentary keeps its canonical commentary label.

```tsx
import { ArticleProvenance } from '@scalemule/news-publication'

<ArticleProvenance metadata={article.metadata} />
```

The component inherits the publication's typography. Optional styling hooks are `article-provenance` and `article-provenance__label`. `readerSources()` is available when an existing publication component owns source-list rendering.

### Verified Community Cards

`VerifiedCardSection` and `VerifiedCardComponent` render broadsheet-styled fact sheets for verified entities (`PLACE`, `ACTIVITY`, `EVENT`, `ORGANIZATION`, `PRODUCT`). Verified cards display confirmed operating hours, venues, contact details, dates, and primary action links (tickets, registration, maps) validated by newsroom staff.

```tsx
import { VerifiedCardSection, getArticleCards } from '@scalemule/news-publication'

const cards = getArticleCards(article.metadata?.cards)

<VerifiedCardSection cards={cards} />
```

Styles adhere to the publication theme (`--pub-paper`, `--pub-ink`, `--pub-accent`, `--pub-rule`, `--pub-soft`) and are included in `@scalemule/news-publication/tokens.css` or available standalone via `@scalemule/news-publication/verified-card.css`.



### Private Celebrations reviews (0.0.27)

`StoryReview` accepts an optional `nameplateUrl` from the publication identity. Celebrations reviews lead with the finished article, keep corrections and photos separate from its text, and progressively disclose optional questions (five first, then the remaining questions). One-click approval is limited to subject-plus-editor policies without required questions; automatic-publication policies still show their explicit confirmation.

The review endpoint returns the decision for the exact invited revision. Editors can explicitly advance an existing link using Blog's `SHARE_REVISION` command; approval never carries over. This patch does not enable a publication's section or publish any content. HEIC conversion and live transport certification remain outside this patch.

### Publication framing for private previews (0.0.28)

Pass `publicationHeader` and `publicationFooter` React nodes to `StoryReview` to reuse a publication's real navigation, masthead, and footer. The private banner remains above the publication header and the review controls remain separate from the story. The standalone masthead remains the default. The host must suppress analytics on private review routes; public article indexing and sharing features are not mounted by these slots. This patch changes presentation only; review permissions and publication gates are unchanged.

### Private review sign-in and email options

`StoryReview` accepts `readerAccountUrl` and a client `renderSignIn(returnTo)`
function so the host publication can reuse its existing account and sign-in
components. Hosts must implement the `/api/news/review/:session/account`
server adapter to connect the authenticated, verified reader through Blog’s
`join-account` endpoint. Never trust a browser-supplied email or verification flag.
The private return path belongs in the host’s signed, HttpOnly OAuth flow cookie,
not the provider’s authorization URL. Contributor access does not imply subject
approval authority.

Optional questions can be browsed and copied before identity verification.
`feedbackEmail` enables mail-app links containing the story title, exact revision
reference and optional answers, never the invitation credential. Configure a
monitored mailbox; received email must be recorded by the newsroom. Online
answers retain their existing autosave and explicit-send behavior.
