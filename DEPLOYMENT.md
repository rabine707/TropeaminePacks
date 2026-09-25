# Tropeamine Packs deployment

## Current launch target

Deploy the existing Tropeamine Packs local-data demo publicly on Vercel. Supabase is intentionally not connected yet.

## Vercel

1. Import `rabine707/TropeaminePacks` into Vercel.
2. Framework preset: Next.js (auto-detected).
3. Root directory: repository root.
4. Install command: `npm ci` (default is also acceptable).
5. Build command: `npm run build` / `next build`.
6. No environment variables are required for the local-data demo.
7. Deploy.

## Important demo behavior

Collection, Ink, Shards, quests, requests, preferences, and uploaded card images are browser-local. Clearing browser storage or changing devices/browsers does not carry the collection over. Use the in-app JSON export for backups.

Supabase files are a future production blueprint only. Do not add Supabase credentials until the backend/auth migration is intentionally started.

## Before deployment

CI should pass typecheck, economy/request tests, and the production Next.js build. The complete source import must include `app/globals.css`, `components/collection-app.tsx`, `package-lock.json`, `supabase/schema.sql`, and `supabase/schema.test.mjs`.
