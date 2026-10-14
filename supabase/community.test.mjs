import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
const migration = await readFile(
  new URL(
    "./migrations/20261013215224_earn_ink_community_missions.sql",
    import.meta.url,
  ),
  "utf8",
);
const user = "00000000-0000-4000-8000-000000000001",
  other = "00000000-0000-4000-8000-000000000002",
  admin = "00000000-0000-4000-8000-000000000003";
const cards = Array.from(
  { length: 6 },
  (_, i) => `10000000-0000-4000-8000-00000000000${i + 1}`,
);
async function fixture(blueprint = false, rotation = false) {
  const db = new PGlite();
  await db.exec(
    `create role anon;create role authenticated;create schema auth;create schema storage;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth to anon,authenticated;create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);`,
  );
  if (blueprint) {
    await db.exec(
      await readFile(new URL("./schema.sql", import.meta.url), "utf8"),
    );
  } else {
    await db.exec(
      `create table profiles(id uuid primary key,display_name text);create table wallets(user_id uuid primary key references profiles,ink bigint default 0,shards bigint default 0);create table currency_ledger(id uuid primary key default gen_random_uuid(),user_id uuid references profiles,ink_delta integer,shards_delta integer,reason text,created_at timestamptz default now());create table cards(id uuid primary key,published boolean default true);create table creator_roles(user_id uuid references profiles,role text);`,
    );
  }
  await db.exec(
    `insert into auth.users values('${user}'),('${other}'),('${admin}');insert into profiles(id,display_name) values('${user}','Reader'),('${other}','Other'),('${admin}','Creator');insert into wallets(user_id,ink,shards) values('${user}',100,0),('${other}',100,0),('${admin}',100,0);insert into creator_roles values('${admin}','admin');`,
  );
  if (blueprint) {
    await db.exec(`insert into book_requests(submitted_by,title,author,dedupe_key) values('${user}','Existing','Author','existing');
    insert into creator_polls(id,title,closes_at) values('20000000-0000-4000-8000-000000000001','Historical poll',now()-interval '1 day');
    insert into poll_options(id,poll_id,label) values('30000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','Original answer');
    insert into poll_votes values('${user}','20000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001');
    insert into quests(id,title,description,category,event,ink_reward) values('40000000-0000-4000-8000-000000000001','Original daily','Daily','daily','visit',100);
    insert into quest_progress(user_id,quest_id,period_key,claimed_at) values('${other}','40000000-0000-4000-8000-000000000001',to_char(now() at time zone 'UTC','YYYY-MM-DD'),now());`);
  }
  await db.exec(migration);
  if (rotation) await db.exec(await readFile(new URL("./migrations/20261014025341_daily_collector_poll_rotation.sql", import.meta.url), "utf8"));
  if (!blueprint) {
    for (const id of cards)
      await db.query("insert into cards(id) values($1)", [id]);
    for (const id of cards)
      await db.query(
        "insert into collection_items(user_id,card_id) values($1,$2)",
        [user, id],
      );
  }
  await as(db, user);
  return db;
}
async function as(db, id) {
  await db.exec(
    `reset role;select set_config('request.jwt.claim.sub','${id ?? ""}',false);set role ${id ? "authenticated" : "anon"};`,
  );
}
async function action(db, op, payload = {}) {
  return (
    await db.query("select public.community_action($1,$2::jsonb) as result", [
      op,
      JSON.stringify(payload),
    ])
  ).rows[0].result;
}
async function root(db, sql) {
  await db.exec("reset role");
  return db.exec(sql);
}

test("daily settlement is idempotent across simultaneous requests, legacy keys and UTC periods", async () => {
  const db = await fixture();
  try {
    const results = await Promise.all(
      Array.from({ length: 8 }, () => action(db, "claim", { key: "daily" })),
    );
    assert.equal(
      results.reduce((n, r) => n + r.awarded, 0),
      100,
    );
    assert.equal((await action(db, "status")).wallet.ink, 200);
    await root(db, `update mission_claims set reward_key='daily:2000-01-01';`);
    await as(db, user);
    assert.equal((await action(db, "claim", { key: "daily" })).awarded, 100);
    await root(
      db,
      "delete from mission_claims;update collector_progress set claimed_rewards='{}';",
    );
    const day = (
      await db.query(
        "select to_char(now() at time zone 'UTC','YYYY-MM-DD') as reset_day",
      )
    ).rows[0].reset_day;
    await root(
      db,
      `insert into collector_progress(user_id,claimed_rewards) values('${other}',array['visit-${day}']) on conflict(user_id) do update set claimed_rewards=excluded.claimed_rewards;`,
    );
    await as(db, other);
    assert.equal((await action(db, "claim", { key: "daily" })).awarded, 0);
    await as(db, null);
    await assert.rejects(
      () => action(db, "claim", { key: "daily" }),
      /permission|Sign in/,
    );
  } finally {
    await db.close();
  }
});

test("export start pays nothing; successful tokens pay once, support every format, reject expired/foreign/unowned attempts", async () => {
  const db = await fixture();
  try {
    for (const format of ["story", "square", "landscape"]) {
      const begin = await action(db, "export_begin", {
        format,
        cards: [cards[0]],
      });
      assert.equal(begin.awarded, 0);
      const complete = await action(db, "export_complete", {
        token: begin.token,
      });
      assert.equal(complete.awarded, format === "story" ? 100 : 0);
      assert.equal(
        (await action(db, "export_complete", { token: begin.token })).awarded,
        0,
      );
    }
    const abandoned = await action(db, "export_begin", {
      format: "story",
      cards: [cards[0]],
    });
    assert.equal((await action(db, "status")).wallet.ink, 200);
    await as(db, other);
    await assert.rejects(
      () => action(db, "export_complete", { token: abandoned.token }),
      /expired/,
    );
    await assert.rejects(
      () => action(db, "export_begin", { format: "story", cards: [cards[0]] }),
      /owned/,
    );
    await root(
      db,
      `update studio_exports set created_at=now()-interval '16 minutes';`,
    );
    await as(db, user);
    await assert.rejects(
      () => action(db, "export_complete", { token: abandoned.token }),
      /expired/,
    );
    await assert.rejects(
      () => action(db, "claim", { key: "studio" }),
      /Unknown/,
    );
  } finally {
    await db.close();
  }
});

test("existing showcase qualifies; milestones stay claimed after removal, ownership and unique slots required", async () => {
  const db = await fixture();
  try {
    await root(
      db,
      `insert into collector_progress(user_id,showcase) values('${user}',array[${cards.map((x) => `'${x}'`).join(",")}]);`,
    );
    await as(db, user);
    assert.equal((await action(db, "status")).eligible_slots, 6);
    assert.equal(
      (await action(db, "claim", { key: "showcase:first" })).awarded,
      50,
    );
    assert.equal(
      (await action(db, "claim", { key: "showcase:six" })).awarded,
      50,
    );
    await action(db, "showcase", { cards: [] });
    assert.ok((await action(db, "status")).claims.includes("showcase:six"));
    assert.equal(
      (await action(db, "claim", { key: "showcase:six" })).awarded,
      0,
    );
    await action(db, "showcase", { cards });
    assert.equal(
      (await action(db, "claim", { key: "showcase:six" })).awarded,
      0,
    );
    await assert.rejects(
      () => action(db, "showcase", { cards: [cards[0], cards[0]] }),
      /different/,
    );
    await as(db, other);
    await assert.rejects(
      () => action(db, "showcase", { cards: [cards[0]] }),
      /owned/,
    );
  } finally {
    await db.close();
  }
});

test("unlimited private suggestions share one daily reward; invalid/repeated content never earns, moderation never repays", async () => {
  const db = await fixture();
  try {
    for (const category of ["book", "character", "artwork"]) {
      const r = await action(db, "submit", {
        category,
        title: "A sincere idea " + category,
        related: "Fictional series",
      });
      assert.equal(r.awarded, category === "book" ? 25 : 0);
    }
    for (let i = 0; i < 20; i++)
      await action(db, "submit", {
        category: "book",
        title: "Another sincere series " + i,
      });
    assert.equal((await action(db, "public")).requests.length, 0);
    await as(db, other);
    assert.equal(
      (await action(db, "submit", { category: "book", title: "aaaaaa" }))
        .awarded,
      0,
    );
    await assert.rejects(
      () => action(db, "submit", { category: "book", title: " " }),
      /required/,
    );
    await assert.rejects(
      () => action(db, "submit", { category: "character", title: "Someone" }),
      /required/,
    );
    const sincere = await action(db, "submit", {
      category: "book",
      title: "Warlock",
    });
    assert.equal(sincere.awarded, 25);
    await root(
      db,
      `update mission_claims set reward_key='suggestion:2000-01-01' where user_id='${other}';`,
    );
    await as(db, other);
    assert.equal(
      (await action(db, "submit", { category: "book", title: "Warlock" }))
        .awarded,
      0,
    );
    await assert.rejects(
      () =>
        action(db, "admin_moderate", { id: sincere.id, status: "approved" }),
      /Admin/,
    );
    await assert.rejects(
      () => db.query("select * from community_submissions"),
      /permission/,
    );
    await as(db, admin);
    await action(db, "admin_moderate", { id: sincere.id, status: "approved" });
    const pub = await action(db, "public");
    assert.equal(pub.requests[0].title, "Warlock");
    assert.ok(!JSON.stringify(pub).includes(other));
    assert.ok(!JSON.stringify(pub).includes("notes"));
    assert.equal((await action(db, "admin_inbox")).submissions.length, 26);
    await action(db, "admin_moderate", { id: sincere.id, status: "planned" });
    await as(db, other);
    assert.equal((await action(db, "status")).wallet.ink, 125);
  } finally {
    await db.close();
  }
});

test("request merge preserves unique edition votes, supporting users, submission counts and private history", async () => {
  const db = await fixture();
  try {
    const a = await action(db, "submit", {
      category: "character",
      title: "Noah",
      related: "Warlock",
    });
    const b = await action(db, "submit", {
      category: "character",
      title: "Noah",
      related: "Warlock series",
    });
    await as(db, admin);
    for (const r of [a, b])
      await action(db, "admin_moderate", { id: r.id, status: "approved" });
    let pub = await action(db, "public");
    const ar = pub.requests.find((r) => r.title === "Warlock"),
      br = pub.requests.find((r) => r.title === "Warlock series");
    await as(db, user);
    for (const r of [ar, br]) {
      await action(db, "support", { id: r.id, kind: "book", enabled: true });
      await action(db, "support", {
        id: r.characters[0].id,
        kind: "character",
        rating: "sfw",
        enabled: true,
      });
      await action(db, "support", {
        id: r.characters[0].id,
        kind: "character",
        rating: "adult",
        enabled: true,
      });
    }
    await as(db, other);
    await action(db, "support", {
      id: ar.characters[0].id,
      kind: "character",
      rating: "sfw",
      enabled: true,
    });
    await as(db, admin);
    await action(db, "admin_merge", { source: a.id, target: b.id });
    pub = await action(db, "public");
    assert.equal(pub.requests.length, 1);
    assert.equal(pub.requests[0].support, 1);
    assert.equal(pub.requests[0].requested, 2);
    assert.equal(pub.requests[0].characters[0].sfw, 2);
    assert.equal(pub.requests[0].characters[0].adult, 1);
    assert.equal((await action(db, "admin_inbox")).submissions.length, 2);
    await as(db, user);
    await action(db, "support", {
      id: br.characters[0].id,
      kind: "character",
      rating: "adult",
      enabled: false,
    });
    assert.equal(
      (await action(db, "public")).requests[0].characters[0].adult,
      0,
    );
    const later = await action(db, "submit", {
      category: "character",
      title: "Noah",
      related: "Warlock",
    });
    await as(db, admin);
    await action(db, "admin_moderate", { id: later.id, status: "approved" });
    const afterAlias = await action(db, "public");
    assert.equal(afterAlias.requests.length, 1);
    assert.equal(afterAlias.requests[0].requested, 3);
    assert.equal(afterAlias.requests[0].characters.length, 1);
  } finally {
    await db.close();
  }
});

test("polls are configurable and historic votes survive editing; changes do not repay, closed polls reject votes", async () => {
  const db = await fixture();
  try {
    await assert.rejects(
      () =>
        action(db, "admin_poll", {
          title: "Choose next",
          state: "open",
          options: ["One", "Two"],
        }),
      /Admin/,
    );
    await as(db, admin);
    await action(db, "admin_poll", {
      title: "Choose next",
      state: "open",
      options: ["One", "Two"],
    });
    const poll = (await action(db, "public")).polls[0];
    await as(db, user);
    assert.equal(
      (
        await action(db, "poll_vote", {
          poll: poll.id,
          option: poll.options[0].id,
        })
      ).awarded,
      25,
    );
    assert.equal(
      (
        await action(db, "poll_vote", {
          poll: poll.id,
          option: poll.options[1].id,
        })
      ).awarded,
      0,
    );
    await as(db, admin);
    let history = (await action(db, "admin_inbox")).polls[0];
    assert.equal(
      history.options.reduce((n, o) => n + o.votes, 0),
      1,
    );
    await action(db, "admin_poll", {
      id: poll.id,
      title: "Choose our next obsession",
      state: "closed",
      option_edits: poll.options.map((o) => ({
        id: o.id,
        label: o.label + " clarified",
      })),
    });
    await as(db, user);
    await assert.rejects(
      () =>
        action(db, "poll_vote", { poll: poll.id, option: poll.options[0].id }),
      /closed/,
    );
    assert.equal(
      (await action(db, "public")).polls[0].vote,
      poll.options[1].id,
    );
    await as(db, admin);
    await root(db, "set timezone='America/Los_Angeles';");
    await as(db, admin);
    await action(db, "admin_poll", {
      id: poll.id,
      title: "Choose our next obsession",
      state: "open",
      closes_at: "2000-01-01T00:00",
    });
    const deadline = (await action(db, "admin_inbox")).polls[0].closes_at;
    assert.equal(new Date(deadline).toISOString(), "2000-01-01T00:00:00.000Z");
    await as(db, user);
    await assert.rejects(
      () =>
        action(db, "poll_vote", { poll: poll.id, option: poll.options[0].id }),
      /closed/,
    );
    await as(db, admin);
    await action(db, "admin_poll", {
      id: poll.id,
      title: "Choose our next obsession",
      state: "archived",
    });
    assert.equal((await action(db, "public")).polls.length, 0);
    assert.equal(
      (await action(db, "admin_inbox")).polls[0].options.reduce(
        (n, o) => n + o.votes,
        0,
      ),
      1,
    );
  } finally {
    await db.close();
  }
});

test("migration supports blueprint ledger without recreating legacy requests, polls, claims or balances", async () => {
  const db = await fixture(true);
  try {
    await root(db, "select 1;");
    await as(db, user);
    assert.equal((await action(db, "claim", { key: "daily" })).awarded, 100);
    await root(db, "");
    assert.equal(
      (await db.query("select * from currency_ledger")).rows.length,
      1,
    );
    assert.equal(
      (await db.query("select * from book_requests")).rows.length,
      1,
    );
    assert.equal(
      (await db.query("select reward_enabled from creator_polls")).rows[0]
        .reward_enabled,
      false,
    );
    assert.equal((await db.query("select * from poll_votes")).rows.length, 1);
    await as(db, other);
    assert.equal((await action(db, "claim", { key: "daily" })).awarded, 0);
    assert.ok(
      (await action(db, "status")).legacy.some((k) => k.startsWith("daily:")),
    );
  } finally {
    await db.close();
  }
});

test("same-book character merges preserve distinct votes and hide the merged character", async () => {
  const db = await fixture();
  try {
    const a = await action(db, "submit", {
      category: "character",
      title: "Noah Ashe",
      related: "Warlock",
    });
    const b = await action(db, "submit", {
      category: "character",
      title: "Noah",
      related: "Warlock",
    });
    await as(db, admin);
    for (const r of [a, b])
      await action(db, "admin_moderate", { id: r.id, status: "approved" });
    const chars = (await action(db, "public")).requests[0].characters;
    await as(db, user);
    for (const c of chars)
      await action(db, "support", {
        kind: "character",
        id: c.id,
        rating: "sfw",
        enabled: true,
      });
    await as(db, other);
    await action(db, "support", {
      kind: "character",
      id: chars[0].id,
      rating: "adult",
      enabled: true,
    });
    await as(db, admin);
    await action(db, "admin_merge", { source: a.id, target: b.id });
    const pub = await action(db, "public");
    assert.equal(pub.requests[0].characters.length, 1);
    assert.equal(pub.requests[0].characters[0].sfw, 1);
    assert.equal(pub.requests[0].characters[0].adult, 1);
    await action(db, "admin_moderate", { id: b.id, status: "archived" });
    assert.equal((await action(db, "public")).requests.length, 0);
  } finally {
    await db.close();
  }
});

test("private helpers and direct inserts cannot forge rewards; favorites persist and ledger failures roll back claims", async () => {
  const db = await fixture();
  try {
    await assert.rejects(
      () => db.query("select mission_private.pay('forged',10000)"),
      /permission/,
    );
    await assert.rejects(
      () =>
        db.query("insert into mission_claims values($1,'forged',10000,now())", [
          user,
        ]),
      /permission/,
    );
    await assert.rejects(
      () =>
        db.query(
          "insert into poll_votes(user_id,poll_id,option_id) values($1,gen_random_uuid(),gen_random_uuid())",
          [user],
        ),
      /permission/,
    );
    await action(db, "favorite", { id: cards[0], enabled: true });
    assert.equal((await action(db, "claim", { key: "favorite" })).awarded, 50);
    assert.equal((await action(db, "claim", { key: "favorite" })).awarded, 0);
    await root(
      db,
      "alter table currency_ledger add constraint test_reject_daily check(reason not like 'Mission: daily:%');",
    );
    await as(db, user);
    await assert.rejects(
      () => action(db, "claim", { key: "daily" }),
      /check constraint/,
    );
    const status = await action(db, "status");
    assert.equal(status.wallet.ink, 150);
    assert.ok(!status.claims.some((x) => x.startsWith("daily:")));
    await as(db, null);
    assert.deepEqual((await action(db, "public")).requests, []);
    await assert.rejects(() => action(db, "admin_inbox"), /Sign in/);
  } finally {
    await db.close();
  }
});


test("daily rotation is admin-controlled, atomic, UTC-bound and preserves history and rewards", async () => {
  const db = await fixture(false, true);
  try {
    assert.equal((await action(db, "public")).polls.length, 0);
    await assert.rejects(() => action(db, "admin_rotation", { enabled: true }), /Admin/);
    await assert.rejects(() => db.query("select mission_private.ensure_daily_poll()"), /permission/);
    await assert.rejects(() => db.query("select mission_private.action_before_rotation('public','{}')"), /permission/);
    await assert.rejects(() => db.query("select * from mission_private.poll_rotation"), /permission/);
    await as(db, admin);
    await assert.rejects(() => action(db, "admin_rotation", { enabled: "false" }), /Choose/);
    await action(db, "admin_rotation", { enabled: true });
    await as(db, null);
    const reads = await Promise.all(Array.from({ length: 8 }, () => action(db, "public")));
    const p = reads[0].polls[0];
    assert.equal(p.title, "What kind of collector are you?");
    assert.equal(p.daily, true);
    assert.ok(reads.every(r => r.polls.length === 1 && r.polls[0].id === p.id));
    assert.equal(p.options.length, 5);
    assert.equal(new Date(p.closes_at).getUTCHours(), 0);
    assert.ok(!JSON.stringify(reads).includes("anchor_day"));
    await assert.rejects(() => action(db, "poll_vote", { poll: p.id, option: p.options[0].id }), /Sign in/);
    await as(db, user);
    const votes = await Promise.all(p.options.map(o => action(db, "poll_vote", { poll: p.id, option: o.id })));
    assert.equal(votes.reduce((sum, v) => sum + v.awarded, 0), 25);
    await as(db, admin);
    await action(db, "admin_rotation", { enabled: false });
    await as(db, user);
    await assert.rejects(() => action(db, "poll_vote", { poll: p.id, option: p.options[0].id }), /closed/);
    await as(db, admin);
    await action(db, "admin_rotation", { enabled: true });
    await as(db, user);
    assert.equal((await action(db, "poll_vote", { poll: p.id, option: p.options[0].id })).awarded, 0);
    // Simulate a midnight transition with last day's snapshot and stable anchor.
    await root(db, "update creator_polls set rotation_day=rotation_day-1,closes_at=now()-interval '1 second' where rotation_day is not null; update mission_private.poll_rotation set anchor_day=anchor_day-1;set timezone='America/Los_Angeles';");
    await as(db, user);
    const next = (await action(db, "public")).polls[0];
    assert.notEqual(next.id, p.id);
    assert.equal(next.title, "How do you usually meet your next obsession?");
    assert.equal((await action(db, "poll_vote", { poll: next.id, option: next.options[0].id })).awarded, 25);
    await assert.rejects(() => action(db, "poll_vote", { poll: p.id, option: p.options[0].id }), /closed/);
    await as(db, admin);
    await assert.rejects(() => action(db, "admin_poll", { id: p.id, title: p.title, state: "open" }), /today/);
    await action(db, "admin_poll", { id: next.id, title: next.title, state: "open", closes_at: "2099-01-01T00:00" });
    const inbox = await action(db, "admin_inbox");
    assert.equal(inbox.rotation.enabled, true);
    assert.equal(inbox.polls.length, 2);
    assert.equal(inbox.polls.find(x => x.id === next.id).closes_at, next.closes_at);
    assert.equal(inbox.polls.find(x => x.id === p.id).options.reduce((n, o) => n + o.votes, 0), 1);
    // Same question seven days later is a new daily poll, with its own reward.
    await root(db, "update creator_polls set rotation_day=rotation_day-7,closes_at=now()-interval '1 second' where rotation_day is not null; update mission_private.poll_rotation set anchor_day=anchor_day-7;");
    await as(db, user);
    const week = (await action(db, "public")).polls[0];
    assert.equal(week.title, next.title);
    assert.notEqual(week.id, next.id);
    assert.equal((await action(db, "poll_vote", { poll: week.id, option: week.options[0].id })).awarded, 25);
    assert.equal((await action(db, "status")).wallet.ink, 175);
  } finally { await db.close(); }
});

test("rotation migration preserves manual and legacy poll rows in the blueprint schema", async () => {
  const db = await fixture(true, true);
  try {
    await as(db, admin);
    await action(db, "admin_poll", { title: "A manual creator question", state: "open", options: ["First", "Second"] });
    await action(db, "admin_rotation", { enabled: true });
    assert.equal((await action(db, "public")).polls.length, 3);
    await root(db, "select 1");
    assert.equal((await db.query("select * from poll_votes")).rows.length, 1);
    assert.equal((await db.query("select * from mission_claims")).rows.length, 0);
    assert.equal((await db.query("select * from currency_ledger")).rows.length, 0);
    assert.equal((await db.query("select ink from wallets where user_id=$1", [user])).rows[0].ink, 100);
    assert.equal((await db.query("select * from creator_polls where rotation_day is null")).rows.length, 2);
  } finally { await db.close(); }
});
