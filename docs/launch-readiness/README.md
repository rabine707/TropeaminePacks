# Launch-readiness improvements

This PR extends the existing site without rebuilding its UI or changing collector/account data. It is independent of Earn Ink PR #46 and contains no database migration.

## Changes

- Serve DM Sans and Manrope variable WOFF2 files from `/fonts/`, preserving the existing family names and weights. Includes upstream licenses, provenance and script coverage. No new runtime dependency and no Google Fonts stylesheet import.
- Add titles, descriptions, canonical URLs and Open Graph/Twitter metadata to the main collector pages, legal pages, Showcase modes, sign-in, password update and creator tools. The existing social preview artwork stays in use.
- Mark account, authentication, admin and editor pages `noindex`. Unknown/unverified series routes are also `noindex` rather than presenting invented series names.
- Add `/robots.txt` and `/sitemap.xml`. The sitemap lists public pages and anonymously queried **published** series, using the same normalized path keys as the existing collection UI. It revalidates hourly and falls back to the fixed public pages if the catalog is unavailable. It does not include account, login, admin or editor routes and does not invent modification dates.
- Add a 180×180 Apple home-screen icon using the existing TP mark, alongside the existing favicon.
- Clarify privacy/data disclosures for email sign-in, session cookies, browser storage, locally hosted fonts, community input and browser-saved Studio compositions. Update the dates on changed privacy/data text, retaining the Terms' existing date and substantive wording.

## Validation

- TypeScript: passed after regenerating Next.js route types for this branch.
- Existing unit tests: 22 passed.
- Existing schema tests: 2 passed; no database changes.
- Production Next.js build: passed (the pre-existing Edge-runtime warning remains).
- Local browser checks: ten routes' titles/descriptions/canonical URLs and applicable noindex tags; public/published-series sitemap; robots output; local WOFF2 responses; 180×180 Apple icon.
- Browser observed **zero Google Fonts requests**, both local font families loaded, and no page exceptions.
- Mobile privacy page: 390×844 viewport, document width 390, no horizontal overflow. Screenshots in this folder show the actual rendered desktop home and mobile privacy page using an isolated guest/catalog fixture, not production account data.

## Boundaries and remaining decisions

The user chose to add a contact address later. No email address, contact form or invented privacy-request channel was published. The existing contact placeholders remain pending. No analytics, advertising tracker, session replay, cookie-consent mechanism, marketing email integration or subscription feature was introduced.

The account age policy and rights/permissions for character artwork require separate decisions; this PR does not claim legal compliance, perform identity/age verification or register a DMCA agent. Existing authentication, mature-content settings and authorization remain intact. Crawler rules are indexing guidance, not access controls.

No deployment or production writes were performed. Existing `vercel.json` still disables Git-triggered deployments. Deployment remains subject to the user's earlier approval boundary.
