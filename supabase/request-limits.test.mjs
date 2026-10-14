import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
const read=name=>readFile(new URL(`./migrations/${name}`,import.meta.url),'utf8');
const migration=await read('20261014183759_request_abuse_limits.sql');
const user='00000000-0000-4000-8000-000000000001',other='00000000-0000-4000-8000-000000000002';
async function as(db,id=user){await db.exec(`reset role;select set_config('request.jwt.claim.sub','${id||''}',false);set role ${id?'authenticated':'anon'};`);}
async function root(db,sql){await db.exec('reset role');return db.query(sql);}
async function action(db,op,payload={},direct=false){return (await db.query(`select ${direct?'mission_private.action':'public.community_action'}($1,$2::jsonb) as result`,[op,JSON.stringify(payload)])).rows[0].result;}
async function fixture(){
 const db=new PGlite();
 await db.exec(`create role anon;create role authenticated;create schema auth;create schema storage;
 create table auth.users(id uuid primary key);
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 grant usage on schema auth to anon,authenticated;
 create table profiles(id uuid primary key,display_name text);
 create table wallets(user_id uuid primary key references profiles,ink bigint default 0,shards bigint default 0);
 create table currency_ledger(id uuid primary key default gen_random_uuid(),user_id uuid references profiles,ink_delta integer,shards_delta integer,reason text,created_at timestamptz default now());
 create table cards(id uuid primary key,published boolean default true);
 create table creator_roles(user_id uuid references profiles,role text);
 insert into auth.users values('${user}'),('${other}');
 insert into profiles values('${user}','Reader'),('${other}','Other');
 insert into wallets values('${user}',100,0),('${other}',100,0);
 create table rpc_calls(name text,args jsonb);
 create function public.open_pack_v2(pack_slug text) returns table(ink bigint,shards bigint,pulls jsonb) language plpgsql security definer set search_path=public as $$begin
 if pack_slug='fail' then raise exception 'Original failure';end if;
 insert into rpc_calls values('pack',jsonb_build_object('slug',pack_slug));return query select 123::bigint,456::bigint,jsonb_build_object('slug',pack_slug);end$$;
 create function public.craft_missing_card(target_card_id text) returns table(ink bigint,shards bigint) language plpgsql security definer set search_path=public as $$begin
 insert into rpc_calls values('base',jsonb_build_object('id',target_card_id));return query select 123::bigint,456::bigint;end$$;
 create function public.craft_card_treatment(target_card_id text,treatment_id text,shard_cost integer) returns table(ink bigint,shards bigint) language plpgsql security definer set search_path=public as $$begin
 insert into rpc_calls values('treatment',jsonb_build_object('id',target_card_id,'treatment',treatment_id,'cost',shard_cost));return query select 123::bigint,456::bigint;end$$;
 create function public.claim_collector_reward(reward_key text,ink_reward integer default 0,shard_reward integer default 0) returns table(ink bigint,shards bigint) language plpgsql security definer set search_path=public as $$begin
 insert into rpc_calls values('mastery',jsonb_build_object('key',reward_key,'ink',ink_reward,'shards',shard_reward));return query select 123::bigint,456::bigint;end$$;`);
 await db.exec(await read('20261013215224_earn_ink_community_missions.sql'));
 await db.exec(await read('20261014025341_daily_collector_poll_rotation.sql'));
 await db.exec(migration);await as(db);return db;
}
const suggestion=n=>({category:'book',title:`Collector Story ${n}`,related:'An Author',notes:''});
const limited=e=>e.code==='PT429'&&e.message.includes('Please wait');

test('suggestion limit is server-owned, shared by direct/RPC calls, and isolated by account',async()=>{
 const db=await fixture();try{
  for(let n=0;n<10;n++)await action(db,'submit',suggestion(n),n%2===0);
  await assert.rejects(action(db,'submit',suggestion(11)),limited);
  await assert.rejects(action(db,'submit',{...suggestion(12),user_id:other,limit:99999}),limited);
  let rows=await root(db,`select count(*)::int as n from community_submissions where user_id='${user}'`);assert.equal(rows.rows[0].n,10);
  rows=await root(db,`select ink from wallets where user_id='${user}'`);assert.equal(rows.rows[0].ink,125);
  await as(db,other);assert.equal((await action(db,'submit',suggestion('other'))).awarded,25);
 }finally{await db.close();}
});

test('UTC windows reset in bounded rows, with an independent daily suggestion ceiling',async()=>{
 const db=await fixture();try{
  for(let hour=0;hour<3;hour++){
   if(hour)await root(db,"update mission_private.request_limits set window_key=window_key-1 where bucket='suggestions:hour'");
   await as(db);for(let n=0;n<10;n++)await action(db,'submit',suggestion(`${hour}-${n}`));
  }
  await root(db,"update mission_private.request_limits set window_key=window_key-1 where bucket='suggestions:hour'");await as(db);
  await assert.rejects(action(db,'submit',suggestion('over-day')),limited);
  await root(db,"update mission_private.request_limits set window_key=window_key-1");await as(db);
  await action(db,'submit',suggestion('next-day'));
  const r=await root(db,`select count(*)::int as n from mission_private.request_limits where user_id='${user}'`);assert.equal(r.rows[0].n,2);
 }finally{await db.close();}
});

test('new private implementations and quota storage cannot be used to bypass the public entry points',async()=>{
 const db=await fixture();try{
  for(const name of ['action_before_request_limits(text,jsonb)','consume_limit(text,integer,integer)','open_pack_v2(text)','craft_missing_card(text)','craft_card_treatment(text,text,integer)','claim_collector_reward(text,integer,integer)']){
   const r=await db.query(`select has_function_privilege('authenticated',$1,'EXECUTE') as allowed`,[`mission_private.${name}`]);assert.equal(r.rows[0].allowed,false,name);
  }
  await assert.rejects(db.query('select * from mission_private.request_limits'),/permission denied/);
  await assert.rejects(db.query('select mission_private.action_before_request_limits($1,$2::jsonb)',['submit',JSON.stringify(suggestion('bypass'))]),/permission denied/);
  await as(db,null);await assert.rejects(action(db,'submit',suggestion('anon')),/Sign in required/);
  await assert.rejects(db.query("select public.open_pack_v2('harem')"),/permission denied/);
  const publicData=await action(db,'public');assert.ok(Array.isArray(publicData.requests));
 }finally{await db.close();}
});

test('economy wrappers preserve parameters/results, share craft limits and stop before settlement',async()=>{
 const db=await fixture();try{
  const first=(await db.query("select * from public.open_pack_v2('harem')")).rows[0];
  assert.equal(Number(first.ink),123);assert.deepEqual(first.pulls,{slug:'harem'});
  for(let n=1;n<12;n++)await db.query("select * from public.open_pack_v2('harem')");
  await assert.rejects(db.query("select * from public.open_pack_v2('harem')"),limited);
  for(let n=0;n<10;n++){await db.query("select * from public.craft_missing_card('card-a')");await db.query("select * from public.craft_card_treatment('card-a','holo',30)");}
  await assert.rejects(db.query("select * from public.craft_missing_card('card-b')"),limited);
  await db.query("select * from public.claim_collector_reward('mastery:warlock',150,25)");
  const r=await root(db,"select name,args from rpc_calls");assert.equal(r.rows.filter(r=>r.name==='pack').length,12);assert.equal(r.rows.filter(r=>r.name==='base').length,10);
  assert.deepEqual(r.rows.find(r=>r.name==='treatment').args,{id:'card-a',treatment:'holo',cost:30});assert.deepEqual(r.rows.find(r=>r.name==='mastery').args,{key:'mastery:warlock',ink:150,shards:25});
 }finally{await db.close();}
});

test('concurrent successful calls cannot exceed an actor limit; downstream failures roll back counters',async()=>{
 const db=await fixture();try{
  await assert.rejects(db.query("select * from public.open_pack_v2('fail')"),/Original failure/);
  const results=await Promise.allSettled(Array.from({length:20},()=>db.query("select * from public.open_pack_v2('harem')")));
  assert.equal(results.filter(r=>r.status==='fulfilled').length,12);
  assert.equal(results.filter(r=>r.status==='rejected'&&limited(r.reason)).length,8);
  const r=await root(db,"select count(*)::int as n from rpc_calls where name='pack'");assert.equal(r.rows[0].n,12);
 }finally{await db.close();}
});

test('read/claim polling stays usable below its quota and admin checks remain enforced',async()=>{
 const db=await fixture();try{
  for(let n=0;n<30;n++)assert.equal((await action(db,'status')).wallet.ink,100);
  assert.equal((await action(db,'claim',{key:'daily'})).awarded,100);
  assert.equal((await action(db,'claim',{key:'daily'})).awarded,0);
  await assert.rejects(action(db,'admin_inbox'),/Admin access required/);
  await assert.rejects(action(db,null),/Invalid request/);
  await assert.rejects(action(db,'submit',{...suggestion('large'),notes:'x'.repeat(17000)}),/Invalid request/);
 }finally{await db.close();}
});

test('rollback restores installed entry points without deleting submissions, claims or counters',async()=>{
 const db=await fixture();try{
  await action(db,'submit',suggestion('kept'));
  await action(db,'claim',{key:'daily'});
  for(let n=0;n<12;n++)await db.query("select * from public.open_pack_v2('harem')");
  await assert.rejects(db.query("select * from public.open_pack_v2('harem')"),limited);
  await db.exec('reset role');
  await db.exec(await readFile(new URL('../docs/request-abuse-protection-rollback.sql',import.meta.url),'utf8'));
  await as(db);await db.query("select * from public.open_pack_v2('harem')");
  const r=await root(db,"select (select count(*)::int from community_submissions) as submissions,(select count(*)::int from mission_claims) as claims,(select count(*)::int from mission_private.request_limits) as counters");
  assert.equal(r.rows[0].submissions,1);assert.equal(r.rows[0].claims,2);assert.ok(r.rows[0].counters>0);
  await as(db);assert.equal((await action(db,'status')).wallet.ink,225);
  await as(db,null);await assert.rejects(db.query("select * from public.open_pack_v2('harem')"),/permission denied/);
 }finally{await db.close();}
});

