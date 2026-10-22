## 0.0.88

- Retire automatic reader SSO navigation. `ReaderSsoBoot` remains as a no-op compatibility export; rendered publication pages no longer redirect to Ledvery after load, including when a local session is stale or needs an SSO upgrade. Explicit sign-in and server-side OIDC completion remain available. Click-initiated network handoff and FedCM require separate implementation and browser acceptance.

## 0.0.87

- Reader SSO linking onto an **unconfirmed** reader account asks for a 6-digit code emailed to that account (platform ADR-2026-10-21 D2.3). The challenge token is kept in a new HttpOnly cookie (`<prefix>-link-code`), and the reader types the code in the existing code field. Paper routes and forms need no changes beyond the version bump.

## 0.0.86

- Preserve exact revision and content checks while accepting Rust’s equivalent compact/hyphenated UUID serialization for existing media identities. Resumable edits no longer report a false conflict for legacy contributions. Changed media, captions and prose still stop release; required human approvals remain enforced.

## 0.0.81

- Add one checkpointed `edit` command and `editArticle` client for prose, excerpt, cards and citations in the existing immutable revision API. Preserve omitted fields/media, reconcile lost acknowledgements, reject concurrent edits, and keep explicit onboarding/review/release gates.
- Verify rendered prose and actual card components after an explicit release; expose pending visibility and review holds without claiming completion. Default deadline is 10 seconds. This does not replace canonical entity management, photo/media intake, human review, publication adapter rollout or TTS capacity work.

## 0.0.80

- Add one resumable local-file article photo operation and `replace-photo --url`: normal managed upload, privacy/scan, measured publication renditions, version-fenced attachment and public HTML verification. Persist a private checkpoint, stop at a bounded deadline, reconcile lost acknowledgements and avoid new uploads/writes on completed replay.
- Read editorial source without optional Audio latency. Preserve text/audio and reject concurrent edits. Collaboration-managed stories retain their existing revision/review release gates; photo sourcing, distributed operation receipts and a universal processing SLA remain outside this convenience lane.

## 0.0.79

- Preserve the typing guard when a reader writes inside the newsroom widget’s nested Shadow DOM. The silent check follows the focused control rather than treating its host as an idle page.
- Email ownership/recovery and real Safari/iOS acceptance still gate the wider rollout.

## 0.0.78

- Start silent reader recognition after usable DOM and an idle delay, so slow page assets cannot postpone SSO indefinitely. Resume eligible hidden/prerendered pages on activation; recheck typing, bot, session and negative-cache guards before the single attempt.
- Wider rollout, controlled email verification and real Safari/iOS acceptance remain separate gates.

## 0.0.77

- Revalidate reader greetings after logout, account changes and focus, with bounded requests and stale-response protection. Background checks preserve the session idle limit.
- Cross-publication browser acceptance, email ownership proof and wider rollout remain release gates.

## 0.0.76

- Add `replacePublishedCover` and the `scalemule-article` executable for inspecting an article and changing a legacy published cover from an already ready public Photo asset. Read measured hero/social manifests; require rights, provenance and an explicit article version; never republish text, restart narration or overwrite a conflict.
- New photograph sourcing/upload/scan, collaboration revision approval and website cache visibility remain separate phases. This patch does not claim a measured end-to-end photo replacement SLA or complete publication-adapter rollout.

## 0.0.75

- Expose approver-authorized priority for an existing pending/queued narration intent. Discover `prioritized_narration_processing` first; expediting never resets job identity, attempts, leases, due times or replay age, and does not raise provider concurrency or budgets.
- Audio generation capacity and all-publication adapter rollout remain separate acceptance work.

## 0.0.74

- Renew existing Ledvery reader sessions once to bind cross-app logout, retiring the old credential before replacing it.
- Preserve the current account during silent conflicts and remember an explicit keep choice only for its validated session.
- Bound names on Unicode code points. Browser acceptance and passwordless ownership proof remain separate rollout work.

## 0.0.73

- Expose explicit legacy article onboarding through the existing approver-authorized collaboration enable API. Reads never silently enroll articles; callers choose review policy and resolve missing managed media identities first. Existing scheduled releases are cancelled by enrollment, as the server contract requires.
- Full legacy adoption and publication-adapter rollout remain explicit operational steps.

## 0.0.72

- Add an explicit narration-only profile reference to processing retries for legacy missing-preset holds. Keep article/editorial profiles immutable; the API validates the selected publication/language and refuses replacement of existing paid work.
- Expose profile versions and actual Audio/job references for diagnosis. Automatic generation latency and publication-adapter rollout remain separate acceptance work.

## 0.0.71

- Reader SSO through Ledvery (`reader-sso`, `reader-sso-client`; ADR-2026-10-19-ledvery-consumer-sso). Shared start/callback/link/switch/sign-out helpers with a byte-compatible flow cookie, Google and email (`upstream=scalemule_consumer`) sign-in, silent `prompt=none` checks with a 5-minute negative cache and a signed-out suppression cookie, account-switch precedence (an existing session is never replaced silently), LINK_REQUIRED account linking with password proof, Ledvery end-session on sign-out, and server-recorded `reader_signin_*` / `reader_sso_check` events.
- `ReaderSsoBoot` (top-level silent check after load and idle; skips bots, prerender, focused forms, private paths), `ReaderGreeting` (time-of-day greeting in the reader's time zone, client island, no-store), `LedveryButton` provider prop, `AccountLinkForm`, `AccountSwitchPrompt`.
- Silent checks never carry newsletter consent, whatever the flow cookie claims.

## 0.0.70

- Expose typed processing versions and media holds so clients can inspect and retry the exact server state. Add an explicit revision-bound private narration method for publication policies that require audio before release.
- Bound API requests to 30 seconds and asset transfers to 90 seconds without blind automatic retries. Submission/generation SLAs and full publication-adapter adoption remain separate rollout work.

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
