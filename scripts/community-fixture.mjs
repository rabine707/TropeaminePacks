/** Isolated preview fixture. Synthetic users only, ephemeral PGlite DB.
 * Never connect this HTTP adapter to production. It implements only the SDK
 * calls required by local UI verification, not a replacement Supabase server.
 * Run: node scripts/community-fixture.mjs
 * Next env: NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54329
 *           NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=fixture-only
 */
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
export const user = "00000000-0000-4000-8000-000000000001",
  admin = "00000000-0000-4000-8000-000000000003";
export const ids = Array.from(
  { length: 6 },
  (_, i) => `10000000-0000-4000-8000-00000000000${i + 1}`,
);
const db = new PGlite();
await db.exec(
  `create role anon;create role authenticated;create schema auth;create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth to anon,authenticated;create table profiles(id uuid primary key,display_name text,username text,avatar_url text,adult_content_enabled boolean default false,adult_age_confirmed_at timestamptz);create table wallets(user_id uuid primary key,ink bigint default 0,shards bigint default 0);create table currency_ledger(id uuid primary key default gen_random_uuid(),user_id uuid,ink_delta integer,shards_delta integer,reason text,created_at timestamptz default now());create table cards(id uuid primary key,published boolean default true);create table creator_roles(user_id uuid,role text);`,
);
await db.exec(
  await readFile(
    new URL(
      "../supabase/migrations/20261013215224_earn_ink_community_missions.sql",
      import.meta.url,
    ),
    "utf8",
  ),
);
for (const id of [user, admin]) {
  await db.query(
    "insert into profiles(id,display_name,username) values($1,$2,$3)",
    [
      id,
      id === admin ? "Creator" : "Collector",
      id === admin ? "creator" : "collector",
    ],
  );
  await db.query("insert into wallets values($1,350,20)", [id]);
}
await db.query("insert into creator_roles values($1,$2)", [admin, "admin"]);
for (const id of ids) {
  await db.query("insert into cards values($1,true)", [id]);
  await db.query(
    "insert into collection_items(user_id,card_id) values($1,$2)",
    [user, id],
  );
}
await db.query(
  "insert into collector_progress(user_id,showcase) values($1,$2)",
  [user, ids],
);
async function call(actor, op, payload = {}) {
  await db.exec("reset role");
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [
    actor ?? "",
  ]);
  await db.exec(`set role ${actor ? "authenticated" : "anon"}`);
  return (
    await db.query("select community_action($1,$2::jsonb) result", [
      op,
      JSON.stringify(payload),
    ])
  ).rows[0].result;
}
const seed = await call(admin, "submit", {
  category: "character",
  title: "Violet Sorrengail",
  related: "Fourth Wing",
  notes: "Synthetic preview submission",
});
await call(admin, "admin_moderate", { id: seed.id, status: "approved" });
await call(admin, "admin_poll", {
  title: "What should we collect next?",
  state: "open",
  options: [
    "Romantasy favorites",
    "Sports romance casts",
    "Dark romance obsessions",
  ],
});
let queue = Promise.resolve();
const names = ["Noah", "Sam", "Cassandra", "Rachel", "Morgan", "Felicity"];
const sessionUser = (id) => ({
  id,
  aud: "authenticated",
  role: "authenticated",
  email: id === admin ? "creator@example.invalid" : "collector@example.invalid",
  app_metadata: { provider: "email", providers: ["email"] },
  user_metadata: {},
  identities: [],
  created_at: "2026-01-01T00:00:00Z",
});
createServer(async (req, res) => {
  res.setHeader("access-control-allow-origin", "http://127.0.0.1:3000");
  res.setHeader(
    "access-control-allow-headers",
    String(
      req.headers["access-control-request-headers"] ??
        "authorization,apikey,content-type,x-client-info,prefer",
    ),
  );
  res.setHeader("access-control-allow-methods", "GET,POST,PATCH,OPTIONS");
  res.setHeader("content-type", "application/json");
  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }
  let actor;
  try {
    actor = JSON.parse(
      Buffer.from(
        (req.headers.authorization ?? "").split(" ")[1]?.split(".")[1] ?? "",
        "base64url",
      ).toString(),
    ).sub;
  } catch {}
  const url = new URL(req.url, "http://127.0.0.1");
  const send = (value) => res.end(JSON.stringify(value));
  try {
    if (url.pathname === "/auth/v1/user") {
      if (!actor) {
        res.writeHead(401);
        send({ message: "No fixture session" });
        return;
      }
      send(sessionUser(actor));
      return;
    }
    if (url.pathname === "/rest/v1/rpc/community_action") {
      let body = "";
      for await (const part of req) body += part;
      const { op, payload } = JSON.parse(body);
      const pending = queue.then(() => call(actor, op, payload));
      queue = pending.catch(() => {});
      send(await pending);
      return;
    }
    const table = url.pathname.split("/").at(-1);
    const single = (req.headers.accept ?? "").includes("vnd.pgrst.object");
    let data = [];
    if (table === "profiles") {
      data = [
        {
          ...sessionUser(actor),
          display_name: actor === admin ? "Creator" : "Collector",
          username: "collector",
          avatar_url: null,
          adult_content_enabled: false,
          adult_age_confirmed_at: null,
        },
      ];
    } else if (table === "wallets") {
      await queue;
      await db.exec("reset role");
      data = (
        await db.query("select ink,shards from wallets where user_id=$1", [
          actor,
        ])
      ).rows;
    } else if (table === "collector_progress") {
      await queue;
      await db.exec("reset role");
      data = (
        await db.query("select * from collector_progress where user_id=$1", [
          actor,
        ])
      ).rows;
    } else if (table === "creator_roles") {
      data = actor === admin ? [{ role: "admin" }] : [];
    } else if (table === "collection_items") {
      data =
        actor === user ? ids.map((id) => ({ card_id: id, quantity: 1 })) : [];
    } else if (table === "cards") {
      data = ids.map((id, i) => ({
        id,
        number: `WAR-${i + 1}`,
        published: true,
        characters: {
          id,
          name: names[i],
          bio: "Synthetic preview character",
          lore: {},
          series: {
            id: "series",
            title: "Warlock",
            author: "Daniel Kensington",
            published: true,
          },
        },
        card_sets: {
          id: "set",
          title: "Warlock",
          code: "WAR",
          published: true,
        },
        variants: [
          {
            id: "variant-" + i,
            label: "Standard",
            rarity: "rare",
            rating: "sfw",
            available: true,
            card_assets: [],
          },
        ],
      }));
    }
    send(single ? (data[0] ?? null) : data);
  } catch (e) {
    console.error("Fixture request failed", url.pathname, e.message);
    res.writeHead(400);
    send({ message: e.message, code: e.code ?? "FIXTURE" });
  }
}).listen(54329, "127.0.0.1", () =>
  console.log("Synthetic community fixture listening on 127.0.0.1:54329"),
);
