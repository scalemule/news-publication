## 0.0.70

- Reader SSO through Ledvery (`reader-sso`, `reader-sso-client`; ADR-2026-10-19-ledvery-consumer-sso). Shared start/callback/link/switch/sign-out helpers with a byte-compatible flow cookie, Google and email (`upstream=scalemule_consumer`) sign-in, silent `prompt=none` checks with a 5-minute negative cache and a signed-out suppression cookie, account-switch precedence (an existing session is never replaced silently), LINK_REQUIRED account linking with password proof, Ledvery end-session on sign-out, and server-recorded `reader_signin_*` / `reader_sso_check` events.
- `ReaderSsoBoot` (top-level silent check after load and idle; skips bots, prerender, focused forms, private paths), `ReaderGreeting` (time-of-day greeting in the reader's time zone, client island, no-store), `LedveryButton` provider prop, `AccountLinkForm`, `AccountSwitchPrompt`.
- Silent checks never carry newsletter consent, whatever the flow cookie claims.

## 0.0.69

- Keep server-authorized review text visible immediately, but defer private image requests until the browser cookie exchange succeeds. This prevents an early unauthorized image request from leaving review photographs unavailable.
- Respect a publication-supplied caption formatter for generated review visuals; do not automatically append internal production labels.
- The standard workflow still requires capability discovery and separate explicit editorial release; full publication-adapter rollout remains separate.

## 0.0.68

- Add the server/CLI `article-workflow` client for idempotent draft creation, revision-fenced edits, managed private photo intake, explicit media approval and processing status/retry. It resumes matching staged assets and stops on subsequent editorial changes.
- Share safe versioned article presentation definitions and support an authorized initial review snapshot, preserving exact invited revisions after publication.
- This patch requires capability discovery from the Blog workflow release. It does not provide an atomic article-and-binary transaction, arbitrary custom renderers or automatic editorial approval. Publication adapters must adopt the private bootstrap, stable identity route and layout renderer separately.

## 0.0.62

- ToyRound: shared community toy exchange (`toys`, `toys-view`, `toys-forms`, `toys-interactions`, `toys-plugin`, `toys-publication`, `toys-server`, `toys.css`) on the Knowledge `toy-exchange` collection kind. Free giveaways and direct swaps only; every listing is editor-reviewed; adult, email- and phone-verified members; atomic reservation; public-place daytime appointments in the place's timezone; private two-party threads with scam warnings; block, report, feedback, account deletion.
- `createPublicationToysHandler` proxies an explicit allowlist of exchange routes plus Auth phone OTP; `createToyCommunityHandler` remembers the chosen community on-device. Publications mount `/toys` natively with their existing reader cookie and API key; "Toy Swap" lives in More ▸ Local life.

## 0.0.54

- Broadsheet editorial in-article figure and caption typography: add dedicated broadsheet tokens for `<figure>`, `.article-figure`, and `<figcaption>` with 36px vertical breathing room, full clear boundaries, responsive image block rendering, and crisp 13px muted sans-serif caption styling.

## 0.0.53

- Redesign the native pet community as a Bay Area field guide: original vector artwork, self-hosted licensed type, mobile navigation, useful local shortcuts and an editorial spotlight invitation. Preserve the approved logo and publication color inheritance.
- Provide explicit retry and network reconnection actions on account/submission failures. Keep community selection attached to native contribution links and fetch independent homepage resources concurrently.
- Retain moderated publication, honest empty states, anonymous browsing, dark appearance and reduced-motion support. Secure recovery contact and community notification delivery remain deferred.

## 0.0.52

- Use the publisher-supplied Bay Area Paw dog/cat/heart icon in all shared pet pages. Preserve its geometry and expose logo ink/heart color tokens for publication themes and dark appearance.
- Secure recovery contact and community notification delivery remain deferred.

## 0.0.51

- Preserve the current home community when editing a pet from another publication; keep new contributions within host coverage.
- Secure recovery contact and community notification delivery remain deferred.

## 0.0.50

- Native server-rendered pet account, submission, browsing and story pages, sharing the host publication’s reader cookie and API key.
- Ledvery session resume through a top-level OIDC code flow; signed callback state, local sign-out suppression and the existing publication callback are supported without iframes or shared cross-domain cookies.
- Shared community preferences, local Newsroom links and an accessible mobile layout with original vector pet artwork.
- Shared ownership requires the collection’s verified OIDC policy and an accepted view; notification delivery and private recovery messaging remain deferred.


## 0.0.48 - 2026-10-13

- Broadsheet section layout: Break out single child sections and odd trailing sections across the full grid (`grid-column: 1 / -1`) with an asymmetric two-column spread (Lead story + supporting rail), eliminating huge empty right-side gaps on desktop.
- Canonical editorial section resolution: Added `resolveSection` normalizing section aliases and using content/tag heuristics to categorize unassigned stories into civic, health, business, events, schools, and community desks rather than dropping them into unrendered local buckets.

## 0.0.47 - 2026-10-13

- Add community sponsorship contracts, previews and reporting.

## 0.0.46 - 2026-10-13

- Add an opt-in local briefing composer over authorized publication records, with explicit preferences, civic priority, source attribution, freshness gates and correction-aware canonical revision selection.
- Keep the existing edition path unchanged. Server projection, persistent preferences, event lifecycle APIs, publication UI and BaseNews hosting remain subsequent work; this is not a deployed personalization service.

## 0.0.45

- Consume React 0.0.21 so ended community seasons retain contributor history without mounting capture, uploads or draft storage.
- Exercise the actual closed-season submission page and require collection-specific history URLs. Seasonal schedules remain publication configuration; no backend lifecycle changes are included.

## 0.0.43

- Consume React 0.0.20 so publication guides share the illustrated city/community renderer, source attribution and optional visitor access notes.
- Keep mobile submissions separate from map rendering and geography requests. Publisher-supplied geographic snapshots remain required.

## 0.0.42

- Use React 0.0.19 for compact photo-first submission forms, safer interrupted capture recovery and mobile guide refinements.
- Match contribution presentation to the illustrated guide and remove the duplicate submission action.
- Add regression coverage proving submission screens load private contribution history without mounting the map or fetching city geography, with and without an atlas.
- Keep explicit permission and moderation. Physical-device capture verification and browser-closed background transfers remain separate.

## 0.0.41

- Use reusable ScaleMule street capture: phone camera, multi-file queues, short video/voice, recovery and private submission history.
- Add origin-checked contributor history, private media and revision-checked update proxy routes.
- Inherit publication colors and default the city atlas community on direct submission links.
- Pin SDK 0.0.75 and React 0.0.18. Real-device camera testing remains separate; background uploads after closing the browser are not supported.
