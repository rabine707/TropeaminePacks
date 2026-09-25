import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';

test('demo seed creates five characters, nine editions, and a valid five-card pack',async()=>{
 const db=new PGlite();try{
 await db.exec(`create role anon; create role authenticated; create schema auth; create schema storage; create table auth.users(id uuid primary key); create function auth.uid() returns uuid language sql stable as $$ select null::uuid $$; create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);`);
 await db.exec(await readFile(new URL('./schema.sql',import.meta.url),'utf8'));
 await db.exec(await readFile(new URL('./seed.sql',import.meta.url),'utf8'));
 assert.equal((await db.query('select * from public.characters')).rows.length,5);
 assert.equal((await db.query('select * from public.variants')).rows.length,9);
 assert.equal((await db.query('select * from public.pack_pool')).rows.length,9);
 assert.equal((await db.query('select card_count from public.packs')).rows[0].card_count,5);
 }finally{await db.close()}
});

test('schema compiles; RLS protects balances and gates adult assets by current entitlement AND consent',async()=>{
 const db=new PGlite();
 try {
 await db.exec(`create role anon; create role authenticated; create schema auth; create schema storage;
 create table auth.users(id uuid primary key);
 create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
 grant usage on schema auth to anon,authenticated;
 create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);`);
 await db.exec(await readFile(new URL('./schema.sql',import.meta.url),'utf8'));
 const tables=await db.query(`select count(*)::int as count from pg_tables t join pg_class c on c.relname=t.tablename join pg_namespace n on n.oid=c.relnamespace and n.nspname=t.schemaname where t.schemaname='public' and not c.relrowsecurity`);
 assert.equal(tables.rows[0].count,0);
 const user='00000000-0000-4000-8000-000000000001',other='00000000-0000-4000-8000-000000000002';
 await db.exec(`insert into auth.users values ('${user}'),('${other}');
 insert into public.profiles(id,display_name) values ('${user}','Reader'),('${other}','Other');
 insert into public.wallets values ('${user}',100,30),('${other}',500,200);
 insert into public.series(id,slug,title,author,published) values ('10000000-0000-4000-8000-000000000001','warlock','Warlock','Daniel Kensington',true);
 insert into public.card_sets(id,series_id,title,code,published) values ('20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','Founding','WAR',true);
 insert into public.characters(id,series_id,name) values ('30000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','Noah');
 insert into public.cards(id,character_id,set_id,number) values ('40000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','WAR-001');
 insert into public.variants(id,card_id,label,rating,premium) values ('50000000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000001','Base','sfw',false),('50000000-0000-4000-8000-000000000002','40000000-0000-4000-8000-000000000001','After Dark','adult',true);
 insert into public.card_assets(variant_id,side,storage_path) values ('50000000-0000-4000-8000-000000000001','front','sfw-proof.webp'),('50000000-0000-4000-8000-000000000002','front','adult-private.webp');
 set role anon;`);
 assert.equal((await db.query('select * from public.variants')).rows.length,2);
 await assert.rejects(()=>db.query('select * from public.card_assets'));
 await db.exec(`reset role; select set_config('request.jwt.claim.sub','${user}',false); set role authenticated;`);
 assert.equal((await db.query('select * from public.wallets')).rows.length,1);
 assert.equal((await db.query('select * from public.card_assets')).rows.length,1);
 await assert.rejects(()=>db.exec('update public.wallets set ink=100000'));
 await assert.rejects(()=>db.exec(`insert into public.premium_entitlements(user_id,expires_at) values ('${user}',now()+interval '1 day')`));
 await db.exec(`reset role; insert into public.premium_entitlements(user_id,expires_at) values ('${user}',now()+interval '1 day'); set role authenticated;`);
 assert.equal((await db.query('select * from public.card_assets')).rows.length,1,'premium alone cannot expose adult assets');
 await db.exec(`reset role; insert into public.content_preferences values ('${user}',now(),now()); set role authenticated;`);
 assert.equal((await db.query('select * from public.card_assets')).rows.length,2);
 await db.exec(`reset role; update public.premium_entitlements set revoked_at=now(); set role authenticated;`);
 assert.equal((await db.query('select * from public.card_assets')).rows.length,1,'revocation removes asset access');
 await db.exec('reset role');
 await assert.rejects(()=>db.exec(`update public.wallets set shards=-1 where user_id='${user}'`));
 } finally {await db.close()}
});
