# Tropeamine Packs

A collectible-card experience for book lovers, built with Next.js and Supabase.

## Current pack format

Packs contain **4 cards total**:

- 3 distinct base-card pulls
- 1 guaranteed foil as the fourth/final pull
- duplicate editions convert to 5 Shards
- packs cost 100 Ink

## Economy trust boundary

Economy mutations are moving to server-authoritative Supabase RPCs. The deployed `open_pack_v2(pack_slug)` function now selects pulls, deducts Ink, grants collection ownership, calculates duplicates, awards Shards, and writes the currency ledger in one database transaction.

The repository mirrors the live security-sensitive SQL in `supabase/economy-security.sql` so RPC definitions and grants are reviewable in source control.

### Staged collection cutover

The legacy browser still synchronizes `collection_items` from local state. Until the frontend is switched fully to RPC-owned grants, authenticated collection write policies remain temporarily enabled. **Do not treat browser/localStorage ownership as trusted.** The final cutover is to remove authenticated INSERT/UPDATE/DELETE access to `collection_items` and retain owner-scoped SELECT only.

---

## Development

```bash
npm install
npm run dev
```

Run the repository checks with the scripts defined in `package.json` before merging changes.
