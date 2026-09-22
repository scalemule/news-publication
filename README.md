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

The application record is the source of truth. The site stores the last accepted copy in `publication.snapshot.json` and ships that file with the deployment. `syncPublicationFile` writes a new file only after a complete record for that paper arrives. A timeout, a 500, a truncated body, or another paper's payload leaves the file untouched.

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
