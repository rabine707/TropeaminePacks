# Earn Ink & community missions

This extends the existing collection shell, visual styles, Studio canvas, account showcase, and request edition-voting model. Premium/special-edition packs are outside this PR.

## Audit

The default branch's Earn Ink claims, Requests, and fixed creator poll used browser-local state. Authenticated wallets, pack settlement, crafting and collection ownership already used Supabase. Studio exported PNGs from a full-size canvas; Quick Create also had PNG download/native sharing and read the saved account showcase.

Read-only production metadata confirmed `collector_progress.showcase`, `claimed_rewards`, and text-keyed `collection_items`; production did **not** have the quest/request/poll tables in the repository blueprint. Production's ledger uses `ink_delta` and `shards_delta`; `schema.sql` instead uses `currency`, `delta`, and `idempotency_key`. There were no checked-in migrations before this task. `AGENTS.md` and the installed Next.js 16.3.6 server-function/security documentation were reviewed.

## Collector behavior

| Activity | Ink | Limit |
|---|---:|---|
| Original daily claim | 100 | Once per UTC date |
| Studio/Quick Create PNG download handoff | 100 | Once per UTC date; unlimited downloads |
| First owned card in account showcase | 50 | Once per account |
| Six eligible owned showcase cards | 50 | Once per account |
| First eligible community suggestion | 25 | One shared reward per UTC date across all categories |
| First vote in a new eligible creator poll | 25 | Once per poll; votes can change until closing |

Daily reset is **00:00 UTC**, determined by the database at settlement, independent of the browser timezone. The interface displays this explicitly and refreshes on focus and every minute. There are no streaks or social-post verification requirements.

Existing qualifying showcases can claim their milestones. Saving validates at most six distinct owned published cards, including foil-only ownership. Removing cards never clears claims. Existing server-held `collector_progress.claimed_rewards` and claimed `quest_progress` records are read through for compatible legacy reward keys. The migration does not delete or rewrite them. Browser completion records are kept as history, never used to mint account currency.

Suggestions are saved privately, including repeated/non-rewarding submissions. Required fields and length limits are enforced in PostgreSQL. Basic heuristics deny rewards for empty/obvious placeholder, repeated, link-spam, or abusive content. Normalized repeat submissions by the same account remain saved but cannot earn on later days. Not being selected for production never removes a reward.

Approved book/character ideas use `book_requests`, `character_requests`, and edition-specific `request_votes`. Artwork uses curated submissions and support votes. A field-whitelisted public RPC exposes only approved ideas, aggregate counts, and the requesting collector's own support/vote selection. Raw notes and submitter account IDs are not exposed. Earlier browser-local requests/votes remain available in a collapsible history section and the existing local admin queue.

`/admin/community` checks `creator_roles` server-side. Database checks independently protect inbox, moderation, merge and poll operations. Admins can filter the private inbox, approve/publish, reject, archive, plan, see duplicate counts and merge related ideas. Moderation never pays Ink. Request merging retains submission records and deduplicates overlapping supporters/edition votes. Existing poll IDs/options/votes survive the migration; existing polls are non-rewarding by default. New creator-defined polls pay 25 Ink. Editing changes labels while retaining option IDs and historic votes; closed/archived polls remain in the admin inbox.

## Migration and approval boundary

Required migration: `supabase/migrations/20261013215224_earn_ink_community_missions.sql`.

It is additive and has **not been applied remotely**. It creates mission claims/export tokens and private submission/support tables, creates request/poll tables only when absent, and extends existing tables without recreating records. The ledger writer supports both observed layouts. Direct writes to claims/votes/moderation tables are revoked. `collector_progress.claimed_rewards` becomes server-owned while other existing progress columns remain writable under existing policies.

Do not apply `schema.sql` to production: it is a separate normalized blueprint. Before release, approve the migration, review actual database grants/policies and function consumers, test on a staging database, and run Supabase advisors there. Keep `mission_private` out of the Data API's exposed schemas. Deploy the client only after the approved migration is installed. Until then, missing RPCs produce an explanatory UI message and artwork downloads remain available.

Existing `vercel.json` disables Git deployments. This PR does not deploy, merge, modify production records, apply migrations, or enable Git deployment.

## Security and limitations

- Amounts are fixed in database code. Wallet row locks plus the unique `(user_id,reward_key)` claim reserve make wallet/claim/ledger updates transactional and idempotent. Ledger failures roll back the payment and reservation.
- An export session requires authentication, real owned card IDs, a valid format and a short-lived account-bound token. Initiating it pays nothing. Tokens expire after 15 minutes. More than ten reward attempts per minute are rejected, without blocking the download itself. Repeat token completion pays nothing.
- The client awaits PNG generation and successful browser download handoff before completing the token. A browser cannot attest that a file reached disk or that someone posted it. Scripted clients can imitate the handoff; ownership, token expiry/rate limits and one reward per account/date constrain this. There is no claim of Instagram or filesystem verification.
- Raw submissions, reward claims and poll votes have RLS enabled and no client table privileges. Only narrow RPC operations are available. Admin authorization uses the database role table, not user-editable metadata.
- Submission checks are basic heuristics, not comprehensive abuse classification. The private inbox remains the moderation boundary.
- PGlite exercises PostgreSQL transactions, role grants, merge results and idempotence; simultaneous JS calls are serialized by its single connection. Real multi-session lock behavior and deployed Supabase/PostgREST integration still need staging verification.
- Mobile screenshots/checks use a 390 × 844 Chromium viewport. Native iPhone/WebKit download sheets still need real-device confirmation. Object URLs remain alive for 60 seconds to support delayed mobile handoff.
- The inbox currently loads all submission rows. Server pagination can be added if volume makes this costly.

## Validation and screenshots

`npm run typecheck`, `npm test`, `npm run test:schema`, and `npm run build` are required. CI now includes schema tests. The local browser fixture is synthetic and uses an ephemeral PGlite database; it contains no production account data or credentials. `scripts/community-fixture.mjs` documents its local setup.

Screenshots and browser results are stored in this folder. They show the actual implemented UI with synthetic collector data, not a deployed preview. See the PR for final check counts and results.

To reproduce the browser fixture (local only), start `node scripts/community-fixture.mjs`, run Next with `NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54329 NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=fixture-only npm run dev`, then run `node scripts/community-browser-check.mjs` with Playwright installed. `TROPEAMINE_PLAYWRIGHT_MODULE` and `TROPEAMINE_CHROMIUM` can point to an existing local Playwright module/browser. The script uses synthetic auth sessions, not a production login, and seeds a synthetic Studio composition with a real local card-back image.

The browser check also exercises restoration of an existing Studio draft. Studio now waits for draft restoration before exporting or auto-saving, avoiding an empty-draft overwrite during early hydration/Strict Mode effect replay. Export rendering waits for referenced images and omits editor guides/selection borders.


## Daily collector poll rotation

Apply `20261014025341_daily_collector_poll_rotation.sql` after the original Earn Ink migration. This follow-up keeps existing manual polls, votes, rewards and balances intact. It adds a unique daily date on the existing poll table and private rotation configuration/templates. No remote migration or deployment was performed during implementation.

In **Admin → Community inbox → Creator polls**, use **Start daily rotation**. Rotation starts paused after migration. The first start anchors the seven-question cycle to that UTC day. Pause closes today's automatic poll; resume restores the same poll and claims, without creating a second reward opportunity. Manual polls remain available independently.

Questions cover collector style, reading habits, favorite card details, pack rituals, binder organization, fictional character energy and showcases. The editable preset picker uses the same conversation topics; it no longer offers requests for books, casts or artwork.

The first public/Earn Ink/admin visit of a UTC day materializes one poll through the server RPC. No cron, browser-selected question, client clock or secret client key is involved. Missed days aren't backfilled. Questions repeat after seven days, but each new day gets its own poll ID, votes and once-only 25 Ink reward. Vote changes never repay. At midnight UTC, expired daily polls are archived and the next snapshot is created. Earn Ink refreshes on focus and every minute. No streak is required.

Only today's automatic poll appears publicly; prior results stay in the authorized admin inbox. Existing manual poll visibility is preserved. Admins can close/archive and clarify today's question/options; the server fixes automatic polls' deadline at the next UTC midnight and rejects reopening old days. Editing automatic snapshots does not edit the fixed future rotation templates; template changes currently require code/migration review.

Security: private config/helper/core functions cannot be called directly by anon/authenticated roles. Existing admin checks, option foreign keys, atomic wallet/ledger writes and unique poll reward claims are retained. An advisory transaction lock and unique date index prevent simultaneous visits from creating duplicate polls. Local PGlite tests verify permissions, duplicate reads/votes, pause/resume, UTC rollover, next-week rewards, enforced deadlines, historic vote retention and compatibility with legacy manual polls. Actual production migration review/application remains required.
