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

## Local briefing foundation

`composeLocalBriefing(candidates, options)` is an opt-in, pure selector for an existing
publication brief. It consumes `BriefingCandidate` projections from an authorized
server adapter and returns a bounded list using existing `NewsItem` text. It does
not fetch or generate news, verify claims, store preferences, or change the current
`composeEdition` path. A server adapter and publication pilot are still required;
there is no new live BaseNews endpoint in this package.

This is an article-backed presentation helper, not the canonical BaseNews schema.
BaseNews events, issues and opportunities must also work without an article.
Its eligibility rules apply only to this optional brief. They must never become
new publishing gates for articles, questionnaires, jokes, jobs, classifieds,
celebrations or other existing publication features. Their current owner services
and workflows continue independently, including when intelligence processing is
unavailable. Underlying capture, trust and agent APIs take priority over UI rollout.

Supply the recipient `sm_application_id`, `publication_id`, resolved
`coverage_area_ids`, and optional explicit community/topic/entity/issue preferences.
`personalized: false` ignores all preferences. `limit` is a maximum from 1–12
(default 6); zero useful records yields an empty briefing. Render summaries as
text, with original reporting links, verification labels and source attribution.
`why_it_matters` is optional editorial text; reason codes explain selection and
are not factual claims about an item's consequences.

The server must derive scope from authentication, authorize destination grants,
resolve geographic relationships, enforce evidence/summary redistribution rights,
and send public, approved projections. Reuse existing Content Intelligence
classification, coverage profiles, editorial decisions and current evaluation
receipts in that adapter; this presentation selector does not replace its generic
relevance engine or editorial ledger. This helper is **not an authorization or
input-validation boundary**. Do not pass client-supplied trust/approval fields,
private artifacts, or raw community submissions. Unverified and community-submitted
information retains those labels even after editorial approval.

Each candidate references an existing canonical development, occurrence or reporting
record via a namespaced `canonical_key`, with its revision. Do not use a whole issue
ID as the key: separate developments must survive. Include withdrawal/supersession
revisions when combining cached inventories; the newest revision wins before
eligibility and ranking. Supply one selected edition per canonical revision;
conflicting copies of that revision are omitted for reconciliation, not selected
by input order. A feed lacking tombstones cannot prove that cached records
are still current. The caller must invalidate caches on corrections and grant
revocation. Treat personalized HTTP responses as `private, no-store`.

Policy 1 uses a civic priority tier, followed by geography × 4, practical value × 3,
explicit follows × 3, topics × 2, reporting recency and editorial discovery value.
All seven components and reason codes are returned. Recency describes reporting,
not event time or urgency. Civic importance comes from editors, not section names.
Keep a visible link to all important coverage whenever `remaining_important_count`
is positive. Eligibility still applies to civic items: stale or unauthorized facts
cannot bypass trust gates.

`relevant_until` is required. Confirmed labels also require a public evidence link,
`last_verified_at` and a future `review_due_at`. Expired review/relevance deadlines
exclude records; missing freshness information stays `unknown`. No date is inferred
from `updated_at`, no confidence score promotes verification, and no fallback story
fills a quota. The entire approved excerpt must end with sentence punctuation and
fit within 280 Unicode code points; otherwise it is omitted for editorial repair.
Later qualifications and corrections are never cut off to make a shorter summary.


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

## Community Maps

The `community-maps-server` subpath exports `createPublicationCommunityMapsHandler`.
Supply a resolver that verifies the publication host using your existing site lookup,
then returns its server API key, gateway origin, canonical public origin, and trusted
reader context. Forward only the public allowlisted catch-all route. The handler
checks POST origins, bounds uploads, signs an HttpOnly reader cookie, and applies
no-store responses. It never proxies editorial routes or accepts a caller-selected
application ID. Use a Node server runtime; this module imports node:crypto.

The `community-maps-view` subpath exports `PublicationCommunityMapPage` and
`CommunityMapArticleEmbeds`. Supply the publication chrome and import the React map CSS.
The optional React peer is required only when consuming these views. Use the map
worker asset CLI from `@scalemule/react` before building the site.

Article integration uses the existing Blog metadata extension:

```json
{"community_maps":[{"collection_slug":"halloween-2026","mode":"map"}]}
```

Other modes are `cards` and `features`; optional `area_id` / `feature_ids` select live
records. No copied feature snapshot is embedded in a story, so withdrawal takes effect
on the next read. Publishers should apply their caption policy to public media copy.

### Votes and moderated conversations

Set `config.voting_enabled` and `config.comments_enabled` on the canonical collection
in the Community Maps editor to enable these controls. Both default to off for
existing collections. Views share one place record, score, and discussion.

The server resolver should include the signed-in reader's `accessToken` from its
HttpOnly session cookie. Keep the publication API key on the server. Voting
requires a signed-in reader; guests can read totals and submit comments for review.
Each reader can upvote (`1`), downvote (`-1`), or clear (`0`) their place vote.

The public proxy allows `features/:id/vote` and `comments?feature_id=:id` under
`collections/:slug`. Without `feature_id`, comments belong to the guide. It strips
editorial query flags and uses the same signed anonymous identity and origin
checks as submissions. Comments and replies require the current publication
permission and always enter review, including comments from signed-in readers.
Only approved comments whose ancestors remain approved are public.

Moderate through **Newsroom → Community Maps → Comments**. Approval requires
explicit guideline review and the current revision. Existing pumpkin reactions
remain configurable alongside voting. The UI links to `/account?next=...`; the
publication must validate that return path and preserve it through sign-in.

### Community partnerships

`SPONSORSHIP_OFFERINGS` defines preliminary USD rates and exact web/email deliverables. `Placement`, `SponsorParty`, `Campaign` and `SponsorshipReport` describe the publication-owned Blog API. `SponsorAcknowledgment` from `@scalemule/news-publication/sponsorship-view` and `sponsorship.css` use publication tokens, explicit labels and safe HTTPS links. They do not insert article ads, load advertising scripts, or measure preview renders.

Inventory is unavailable until a verified operational placement is active. `placementAvailable` enforces verification freshness and keeps paid briefings disabled. Campaign approval, authorization, allocation capacity and manual commercial references remain server responsibilities. Report HTML distinguishes observed counts from unavailable data and can be printed or rendered to PDF. No invoice or payment is initiated by this SDK.

The consent banner now offers a choice in every geography where optional measurement requires one. `measurementConsent` is the server gate for current, explicitly allowed categories and GPC/DNT. Positive permission is local: unsigned URL parameters and a binary network hub cannot grant all categories. Rendering sponsorship recognition does not require tracking consent; measuring it requires both performance and advertising permission.

## Community pet sections

The `pets`, `pets-view`, `pets-forms`, `pets-interactions`, `pets-server`,
`pets-auth-server`, and `pets-publication` entry points add typed, moderated pet
resources to existing Community Maps collections. Import `pets.css` for the
scoped presentation. Server adapters require each application's own API key;
never pass credentials or a `PetScope` to a client component.

`PublicationPetsSection` resolves an accepted collection view and its coverage.
`PublicationPetReferences` resolves `metadata.pet_resources` at render time:
each reference has `collection_slug`, the API-returned `id`, and `kind`.
Removed/private resources are omitted; article records need no copied pet data.
`PublicationPetEvents` extends the existing publication calendar with reviewed
pet event references and official registration links. Meet's optional `walk`
field extends its existing dog-walk activity without creating another join system.

`createPawAuthHandler` delegates authentication to the platform's supported
Ledvery OIDC flow. Enable it only after configuring and testing the application
client and callback. `createPublicationPetsHandler` restricts routes, requires
same-origin authenticated writes, and proxies visibility-checked photographs.
Approved sponsorships come from existing Blog campaign delivery and reporting.
There is no fictional sponsor fallback and no public demonstration inventory.

Private recovery contact and broad community alert delivery are not implemented
by these components. Notification controls default to disabled. The canonical
application, collections, publication views and legitimate source content must
be provisioned separately before launch.

### Native pet plugin and shared sign-in

`pets-plugin` exports `PetAccountPage`, `PetSubmitPage`, `PetStoryPage` and
`PetBrowsePage`, with `publicationPetPaths` or `standalonePetPaths`. These are
server components: give them the publication’s `PetScope` resolved on the server
and its current reader token. Mount publication pages at `/pets/account`,
`/pets/submit`, `/pets/:id` and `/pets/browse/:kind`. `native` on the publication
section, references and calendar keeps resource links inside the publication.

Configure `createPawAuthHandler` with the host’s existing `sessionCookie`,
`callbackPath` and `accountPath`. An existing callback should dispatch to this
handler only when `openPawFlow(pawCookie(request, PAW_FLOW_COOKIE), state, key)`
validates. Otherwise preserve the publication’s normal authentication flow.
`GET resume?next=...` makes a top-level `prompt=none` attempt; protected pages
should call it only when the session is absent/invalid, `signin` is absent and
`PAW_SIGNED_OUT_COOKIE` is absent. Failed continuity returns `signin=required`
or `signin=retry`, preventing redirect loops. Explicit `POST start` opens the
normal sign-in. Honor and clear the sign-out marker in existing host login/logout
flows. All cookies remain host-only; do not embed the sign-in in an iframe.

The collection must explicitly set `shared_identity_provider` to its configured
OIDC provider. Auth resolves the verified provider subject; Knowledge authorizes
each accepted view and keeps ownership collection-scoped. Never correlate local
users by email or forward one application’s reader token/API key to another.
Provision and verify each RP before enabling sign-in or contribution flags.
