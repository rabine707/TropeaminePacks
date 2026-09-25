# Inkbound

A Next.js / React / TypeScript collectible book-character app for the Tropeamine Packs project. The current build is an interactive browser-local demo; it is not yet a connected multi-user service.

## Current deployment target

- **Source:** GitHub
- **Hosting:** Vercel
- **Backend later:** Supabase
- **Current persistence:** browser localStorage + JSON export
- **Authentication:** not enabled yet
- **Billing / premium entitlement:** not enabled yet

The demo can be deployed publicly to Vercel without Supabase credentials. Collections, balances, requests, creator edits, and uploaded demo artwork remain local to each browser until the Supabase integration is activated.

## Run

Use Node 22 or newer.

```bash
npm ci
npm run dev
```

Open http://127.0.0.1:3000.

Useful checks:

```bash
npm run typecheck
npm test
npm run test:schema
npm run build
```

## Vercel

Import this repository as a Next.js project. No custom build settings are required; the standard `npm run build` command is enough.

No environment variables are required for the browser-local demo.

Do **not** add `SUPABASE_SECRET_KEY` to client code or any `NEXT_PUBLIC_*` variable. When Supabase is connected later, only the Supabase URL and publishable/anon credential belong in browser-visible configuration; privileged credentials must remain server-only.

## Included

- Home, searchable Discover, framed responsive Binder, Warlock set, and accessible card dialogs.
- Editable neutral proofs for Noah, Sam, Cassandra, Rachel, and Morgan.
- Card variants, image upload, front/back display, favorites, missing slots, collection filters, and large card view.
- 100-Ink five-card packs, guaranteed uncommon-or-better last slot, 10-Shard duplicates, and 30-Shard crafting.
- Daily visit reward and action-based quests with one-time reward claims.
- Book/character requests, normalized duplicate detection, separate SFW/After Dark interest voting, production statuses, review approval, merge, report resolution, creator poll, and featured-set editing.
- Browser persistence and JSON export. Local uploads support JPEG/PNG/WebP up to 1.5 MB each.
- Collector+ preview, themes, and explicit 18+ preference. No billing or real premium entitlement is enabled. Adult artwork uploads are disabled in the demo.

## Architecture and production boundary

`lib/catalog.ts` contains seed data and UI types. `lib/economy.ts` owns pack/crafting rules. `components/collection-app.tsx` connects the routed demo screens. `supabase/seed.sql` supplies the five-character, nine-edition demo metadata. `supabase/schema.sql` is a production schema blueprint; it has not been applied to a live database. `.env.example` names future credentials; setting them alone does not activate a backend.

The schema separates series, books, characters, cards, editions, private assets, collections, inventory, wallets, immutable currency ledger, pack pools/openings/contents, quests/progress, requests/votes, entitlements, and moderation. Flexible taxonomies cover genres, shelves, tags and tropes. Public variant rows contain no asset URLs or adult descriptions. RLS and grants default to no writes. Economy, entitlement, moderation, and catalog mutations require trusted server operations.

## Before enabling real accounts/economy

1. Create and connect Supabase, apply a reviewed migration derived from the blueprint, seed the catalog, and test RLS with anonymous, collector, premium, expired-premium, opted-in, and creator accounts.
2. Add Supabase Auth/session adapters and replace browser state with server reads/mutations. Verify creator role on every admin operation.
3. Implement atomic database transactions for pack opening, crafting, approvals, and quest claims. Never trust client-provided balances, draws, progress, votes, premium status, or rewards.
4. Serve protected artwork from private storage with short-lived signed URLs after entitlement and opt-in checks.
5. Wire moderation, dedupe/merge reconciliation, rate limits, server-side rewards, and server-controlled daily boundaries.
6. Add payment processing only when requested.

Genre/Event/After Dark packs are future editions. Advanced stats, paid themes, high-resolution gating, and premium animations are previews, not sold or fulfilled.

## Verification

GitHub Actions runs lockfile install, TypeScript checks, tests, and the production Next.js build on pushes to `main` and pull requests. The exact source files are committed normally in `app/` and `components/`.
