# Tropeamine Packs

> **Collect your fictional obsessions. Chase the cards. Get the dopamine.**

Tropeamine Packs is a collectible book-character experience built around the characters, series, and tropes readers cannot stop thinking about. Open themed packs, reveal character cards one at a time, build a binder, chase foil editions and treatments, and turn duplicates into progress toward the cards you still want.

The project is built with **Next.js, React, TypeScript, Supabase, and Vercel**.

## The collector loop

**Open → Reveal → Collect → Complete → Craft → Chase again**

- Open five-card packs using **Ink**.
- The first four pulls are unique within the pack opening.
- The fifth pull is a **guaranteed foil** and may repeat a character from the first four as a separate foil collectible.
- Reveal cards through the cinematic **mystery back → front → character back → next card** sequence.
- Browse owned cards in the Binder and discover locked characters without exposing their artwork.
- Duplicates award **Shards**.
- Use Shards to craft missing cards and special card treatments.
- Toggle owned foil/treatment finishes while viewing the collection.

Mystery backs use a universal rotating Tropeamine design family and intentionally do not reveal the set, character, rarity, or foil underneath.

## Packs & sets

Tropeamine is designed so a pack can contain cards from multiple related sets.

The initial **HaremLit 1** pack brings together:

- **Warlock**
- **Coven King** by Virgil Knightley

The catalog is built to expand into additional authors, series, genres, and themed packs without changing the core collector loop.

## Accounts & cloud data

Supabase powers the live account and collection layer.

- Google authentication
- Cloud-backed profiles
- Ink and Shard wallets
- Collection ownership
- Pack membership/catalog data
- Signed card-art delivery from Supabase Storage
- Account settings and usernames
- Admin-controlled catalog/economy workflows

Some UI preferences and local state are still cached in the browser for responsiveness and compatibility, while account-owned collection/economy data is synchronized with the signed-in user.

## Card system

Cards support:

- Front and back artwork
- Base and foil ownership
- Special visual treatments
- Character/set metadata
- Pack membership
- Locked/discovered states
- Full-card inspection
- Mobile-friendly 2:3 presentation

The standard Tropeamine card artwork ratio is **2:3**. Production artwork is currently standardized around **1024 × 1536 px**.

## Economy

The current collector economy uses two currencies:

**Ink** is used to open packs. A standard pack currently costs **100 Ink**.

**Shards** come from duplicate pulls and are used for crafting. Economy values live in the application/database flow and should be treated as tunable game-balance values rather than permanent constants.

Pack settlement and account-owned currency should remain server-authoritative. Client UI must never be trusted to grant itself currency, ownership, rewards, or pack results.

## Admin tools

Tropeamine includes creator/admin workflows for maintaining the collectible catalog, including card creation and editing, draft-card management, pack membership, card availability, currency administration, treatments, and production status.

The goal is to let new books and sets be added without rebuilding the collector-facing experience each time.

## Tech stack

| Layer | Technology |
| --- | --- |
| Framework | Next.js 16 |
| UI | React 19 |
| Language | TypeScript |
| Database / Auth / Storage | Supabase |
| Hosting | Vercel |
| Icons | Lucide React |
| Database testing | PGlite |

## Local development

Requires **Node.js 22+**.

```bash
npm ci
npm run dev
```

Then open `http://127.0.0.1:3000`.

### Useful checks

```bash
npm run typecheck
npm test
npm run test:schema
npm run build
```

## Environment variables

Copy `.env.example` and configure the Supabase project values used by your environment:

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
SUPABASE_SECRET_KEY=
```

`SUPABASE_SECRET_KEY` is **server-only**. Never expose it through a `NEXT_PUBLIC_*` variable or client-side code.

## Project structure

```text
app/          Next.js routes, layouts, global styling, and server endpoints
components/   Collector UI, account shell, pack opening, binder, admin interfaces
lib/          Catalog types, economy rules, helpers, and shared application logic
public/       Static assets, including universal mystery card backs
supabase/     Database schema, seed data, migrations, and schema tests
```

Key areas include:

- `components/account-collection-shell.tsx` — Supabase account/session and cloud collection bridge
- `components/collection-app.tsx` — primary collector experience and pack-opening UI
- `lib/catalog.ts` — card/catalog types and seed data
- `lib/economy.ts` — core pack draw rules
- `supabase/` — production database definitions and supporting SQL

## Pack-opening rules

The core pack algorithm currently enforces:

1. A pack costs 100 Ink.
2. At least four unique available cards must exist in the selected pool.
3. Slots 1–4 cannot duplicate one another.
4. Slot 5 is foil and is drawn independently, so its character may match one of the first four.
5. Base and foil ownership are tracked separately.
6. Duplicate ownership converts into Shards.

Changes to these rules should be covered by economy tests before deployment.

## Security & production boundaries

Tropeamine treats the browser as an untrusted client.

Privileged operations—currency changes, pack settlement, crafting, catalog moderation, and admin actions—should be validated server-side and protected by Supabase policies/roles. Protected artwork should be served through appropriately scoped storage access or signed URLs.

Never commit production secrets to the repository.

## Verification

GitHub Actions and local checks are used to validate TypeScript, economy/request tests, schema tests, and the production Next.js build.

Before merging behavior changes, run:

```bash
npm run typecheck
npm test
npm run test:schema
npm run build
```

## Status

Tropeamine Packs is under active development. The collector loop, Supabase-backed accounts, pack catalog, cinematic reveals, binder, foil system, crafting, treatments, and admin tooling are all evolving as the card catalog grows.

---

**Tropeamine Packs** — for the characters you were definitely going to stop thinking about.
