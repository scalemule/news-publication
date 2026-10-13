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
