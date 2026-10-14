# Request abuse protections

## Release state

The SQL migration and UI copy are prepared on `security/request-abuse-limits`.
They have not been applied to production. The Vercel firewall changes are drafts,
not published protection. Baseline platform DDoS mitigation remains active.

The current Hobby project's API rejected an additional rate-limit rule with
`Rate limiting is not available for this plan (401)`, despite exposing the form
and initially accepting a draft. That unsupported draft was changed to plain
logging. No upgrade, purchase or paid integration was enabled.

## Vercel draft

Project: `tropeaminepacks`, team: `ready-set-ink`.

- Bot Protection: Off → Log.
- GET `/api/card-art/…`: Log, with no challenge/block/rate counter.
- GET `/`, `/discover`, `/packs`, `/requests`, `/quests`, `/binder`, `/albums`,
  `/odds`, `/showcase`: Log. Static assets and OAuth callbacks are outside these
  custom rule conditions.

These drafts do not block bots or cap requests. Review the final diff, then the
project owner publishes the logging stage from the dashboard or with:

```sh
vercel firewall publish --scope ready-set-ink --project tropeaminepacks
```

After observing normal collector traffic, review false positives and test bot
challenge behavior in preview before moving production Bot Protection to
Challenge. This staged rollout follows the Vercel Firewall skill. No emergency
Attack Mode or broad bypass rule is part of this change. Rate-limit enforcement
at Vercel remains a plan/architecture decision; the UI offering a form is not
proof the current plan permits it.

## Backend enforcement

Migration: `supabase/migrations/20261014183759_request_abuse_limits.sql`.
This is an additive wrapper migration for the currently installed production
RPCs, not a replacement of the normalized `schema.sql` blueprint.

| Account action | Fixed-window maximum |
|---|---|
| Book/character/artwork suggestions combined | 10 per UTC hour and 30 per UTC day |
| Start a rewarded Studio export | 10 per minute and 30 per UTC hour |
| Complete an export | 60 per minute |
| Mission claims | 30 per minute |
| Support/poll voting combined | 60 per minute |
| Favorites/showcase edits combined | 120 per minute |
| Signed-in community public/status reads combined | 120 per minute |
| Authorized community admin actions | 120 per minute |
| Pack opening | 12 per minute and 120 per UTC hour |
| Base/treatment crafts combined | 20 per minute and 120 per UTC hour |
| Mastery claims | 30 per minute |

Buckets are derived on the server from `auth.uid()` and fixed action names.
Clients cannot choose actor IDs, limits or windows. Counters use atomic UPSERTs
and a primary key `(user_id,bucket)`, reusing bounded rows instead of retaining
every request. Rows are removed on account deletion by a foreign key cascade.
No IP addresses or user agents are stored by this limiter.

The existing economy bodies are moved intact into the private schema. Their
client EXECUTE privileges are revoked. Public wrappers preserve the existing
parameter names and return types, check quotas first, then delegate. The former
private community entry point is also revoked, so calling it directly cannot
bypass the new wrapper. Existing auth/admin checks and daily reward logic remain.

A rejected quota returns SQLSTATE `PT429` (PostgREST HTTP 429) with a readable
message. No wallet/collection mutation occurs for that request. Frontend copy
states suggestion limits before submission; other existing error handling shows
the server message. Deploy the migration before the changed UI copy.

### Boundaries

- These are limits on successful committed operations. A downstream exception
  rolls the quota counter back with the rest of the transaction, avoiding quota
  loss from failed actions. They do not independently cap malformed/failed
  request attempts or all database CPU work.
- Fixed UTC windows permit bursts on either side of a boundary. They are not
  sliding-window, global-capacity or per-IP controls.
- Anonymous catalog/community reads, direct table reads, direct profile updates,
  authentication endpoints and storage traffic are not universally throttled by
  this migration. Vercel rules do not cover the Supabase hostname.
- The migration deliberately preserves existing draw/craft eligibility logic.
  The separate audit findings about parent publication/SFW eligibility and
  achievement integrity remain open.
- Supabase billing/spend-cap inspection remains deferred by the user.

## Verification

The existing unit suite, existing schema/community fixtures and the new limit
fixtures must all pass before release. The new fixtures cover shared direct/RPC
limits, per-account isolation, hourly/daily boundaries, private-entry bypass
denial, unchanged economy parameters/results, combined craft limits, actor-limit
contention, original-failure rollback, and normal read/claim behavior. Economy
delegation tests use instrumented stubs; they do not claim production settlement
or multi-connection/load-test coverage. Existing community/rotation bodies run
in the new fixtures.

After an authorized production migration, inspect live grants and new function
definitions. Use approved disposable accounts to test first success, boundary,
HTTP 429, isolation and recovery without spending real collector balances.
Recheck normal login, catalog, binder, packs, Studio, requests and admin access.

## Rollback

If needed, execute `docs/request-abuse-protection-rollback.sql` as a separately
authorized database operation. It restores the original function entry points
and grants without deleting account, collection, ledger or mission rows. The
private counter table stays inaccessible and is retained for inspection; a
separate retention decision can remove it later.

Vercel drafts have not been published. Remove only the new rules/managed-setting
change if abandoning this rollout; do not discard unrelated future drafts. After
publication, return these custom rules to Log or disable them, and set Bot
Protection to its prior mode if needed. Inspect and publish that rollback as a
separate firewall change.
