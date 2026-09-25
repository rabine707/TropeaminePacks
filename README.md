# Inkbound

A Next.js / React / TypeScript collectible book-character app. The default build is an interactive local-data demo, not a connected multi-user service.

## Run

Use Node 22 or newer, then `npm ci`, `npm run dev`. Open http://127.0.0.1:3000. `npm run build` creates the production build; `npm start` serves it. `npm test` checks pack, crafting, and request-merge invariants. `npm run test:schema` validates the SQL blueprint and core access-control rules in local PostgreSQL (PGlite).

## Included

- Home, searchable Discover, framed responsive Binder, Warlock set, and accessible card dialogs.
- Editable neutral proofs for Noah, Sam, Cassandra, Rachel, and Morgan. No cover art, fabricated lore, or adult artwork.
- Card variants, image upload, front/back display, favorites, missing slots, collection filters, large card view.
- 100-Ink five-card packs, guaranteed uncommon-or-better last slot, 10-Shard duplicates, 30-Shard crafting. Pool odds are visible.
- Daily visit reward and action-based quests with one-time reward claims.
- Book/character requests, normalized duplicate detection, separate SFW/After Dark interest voting, production statuses, review approval, merge, report resolution, creator poll and featured-set editing.
- Browser persistence and JSON export in collection settings. Local uploads support JPEG/PNG/WebP up to 1.5 MB each. Browser storage is limited; export backups.
- Collector+ preview, themes, explicit 18+ preference. No billing or real premium entitlement is enabled. Adult artwork uploads are disabled in the demo.

## Architecture and production boundary

`lib/catalog.ts` contains seed data and UI types. `lib/economy.ts` owns pack/crafting rules. `components/collection-app.tsx` connects the routed demo screens. `supabase/seed.sql` supplies the five-character, nine-edition demo metadata. `supabase/schema.sql` is a reviewable production schema blueprint; it has not been applied or verified on a live database. `.env.example` names future credentials; setting them alone does not activate a backend.

The schema separates series, books, characters, cards, editions, private assets, collections, inventory, wallets, immutable currency ledger, pack pools/openings/contents, quests/progress, requests/votes, entitlements, and moderation. Flexible taxonomies cover genres, shelves, tags and tropes. Public variant rows contain no asset URLs or adult descriptions. RLS and grants default to no writes. Economy, entitlement, moderation, and catalog mutations require trusted server operations.

Before public launch:

1. Create and connect your Supabase project, apply a reviewed migration derived from the blueprint, seed the catalog, and test RLS with anonymous, collector, premium, expired-premium, opted-in, and creator accounts.
2. Add Supabase Auth/session adapters and replace browser state with server reads/mutations. Verify creator role on every admin operation; the visible demo studio is deliberately local, not a secured admin console.
3. Implement atomic database transactions for pack opening, crafting, approvals and quest claims. Lock the user's wallet (`FOR UPDATE`), validate all requirements, write ledger and inventory together, and use unique idempotency keys. Never trust client-provided balances, draws, progress, votes, premium status or rewards.
4. Serve artwork from the private bucket with short-lived signed URLs after current entitlement and opt-in checks. An expired or revoked membership must stop new asset URLs. Keep adult URLs out of public catalog responses, cached pages and image optimization caches.
5. Wire request moderation, normalized dedupe/merge with vote reconciliation, rate limits and server-side approval rewards. Move daily time boundaries to the server. Add payment processing only when requested.
6. Deploy to GitHub/Vercel after choosing the repository and project. Import this folder as a Next.js project; no special build settings needed. No deployment or remote account changes were made by this build.

Genre/Event/After Dark packs are explicitly future editions. Advanced stats, paid themes, high-resolution gating and premium animations are previewed, not sold or fulfilled. Requests support optional cover/reference links. Card metadata includes editable book appearances, relationships and quotes. Full book/series publishing workflows and rich relationship graphs remain production extensions.

Security basis: [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security). Framework setup: [Next.js installation](https://nextjs.org/docs/app/getting-started/installation).

## Verification

Production build and TypeScript checks passed. Five economy/request tests and the local PostgreSQL schema/RLS tests passed. Browser checks covered desktop and 390px mobile layout, five-card pack opening, duplicate Shards, crafting, favorites, daily reward claims, request submission, voting, creator approval, and persistence across navigation. Dependency audit: zero known vulnerabilities at build time. The local schema test uses stub auth/storage schemas and does not replace a real Supabase integration test.
