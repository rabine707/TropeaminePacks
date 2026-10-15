/** Synthetic local Postgres fixture. No production credentials or user data. */
import {PGlite} from '@electric-sql/pglite';
import {readFile} from 'node:fs/promises';
export const actors={user:'00000000-0000-4000-8000-000000000001',other:'00000000-0000-4000-8000-000000000002',admin:'00000000-0000-4000-8000-000000000003'};
export const card='10000000-0000-4000-8000-000000000001';
const session='20000000-0000-4000-8000-000000000001';
export async function root(db){await db.exec("reset role;select set_config('request.jwt.claim.sub','',false);select set_config('request.jwt.claims','{}',false);");}
export async function as(db,id){
 await db.exec('reset role');
 await db.query("select set_config('request.jwt.claim.sub',$1,false),set_config('request.jwt.claims',$2,false)",[id||'',JSON.stringify({sub:id,session_id:session,amr:[{method:'password',timestamp:Math.floor(Date.now()/1000)}]})]);
 await db.exec(`set role ${id?'authenticated':'anon'}`);
}
export async function accept(db,id,band='18_plus'){await as(db,id);await db.query("select accept_account_policy($1,'2026-10-14')",[band]);}
export async function community(db,op,payload={}){return(await db.query('select community_action($1,$2::jsonb) result',[op,JSON.stringify(payload)])).rows[0].result;}
export async function safetyFixture(blueprint=false,{requestLimits}={}){
 const db=new PGlite();
 try {
 await db.exec(`create role anon;create role authenticated;create schema auth;create schema storage;
 create table auth.users(id uuid primary key,raw_user_meta_data jsonb default '{}',raw_app_meta_data jsonb default '{}');
 create table auth.sessions(id uuid primary key,user_id uuid references auth.users on delete cascade);
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 create function auth.jwt() returns jsonb language sql stable as $$select coalesce(nullif(current_setting('request.jwt.claims',true),'')::jsonb,'{}')$$;
 grant usage on schema auth,storage to anon,authenticated;
 create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
 create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text,owner_id text);
 alter table storage.objects enable row level security;create policy storage_read on storage.objects for select to anon,authenticated using(true);
 grant select on storage.objects to anon,authenticated;`);
 if(blueprint)await db.exec(await readFile(new URL('../supabase/schema.sql',import.meta.url),'utf8'));
 else await db.exec(`create table profiles(id uuid primary key references auth.users on delete cascade,display_name text,username text,avatar_url text,bio text,pronouns text,favorite_series text,profile_public boolean default true,adult_content_enabled boolean default false,adult_age_confirmed_at timestamptz);
 create table wallets(user_id uuid primary key references auth.users on delete cascade,ink bigint default 0,shards bigint default 0);
 create table currency_ledger(id uuid primary key default gen_random_uuid(),user_id uuid references auth.users on delete cascade,admin_id uuid references auth.users on delete set null,ink_delta integer,shards_delta integer,reason text,created_at timestamptz default now());
 create table cards(id uuid primary key,published boolean default true);
 create table variants(id uuid primary key,card_id uuid references cards,rating text,available boolean default true);
 create table card_assets(id uuid primary key,variant_id uuid references variants,side text,storage_path text);
 create table creator_roles(user_id uuid references profiles,role text);
 create table collector_progress(user_id uuid primary key references auth.users on delete cascade,favorites text[] default '{}',showcase text[] default '{}',claimed_rewards text[] default '{}',badges text[] default '{}',binder_theme text default 'midnight');
 create table collection_items(user_id uuid references auth.users on delete cascade,card_id text,quantity integer default 1,primary key(user_id,card_id));
 alter table profiles enable row level security;create policy own_profile on profiles for all to authenticated using(id=auth.uid()) with check(id=auth.uid());grant select,update on profiles to authenticated;
 alter table variants enable row level security;create policy variants_read on variants for select to anon,authenticated using(true);grant select on variants to anon,authenticated;
 alter table card_assets enable row level security;create policy assets_read on card_assets for select to anon,authenticated using(true);grant select on card_assets to anon,authenticated;
 create function public.public_collector_profile(profile_username text) returns table(display_name text,username text,avatar_url text,bio text,pronouns text,favorite_series text,showcase text[],badges text[],binder_theme text) language sql stable security definer as $$select p.display_name,p.username,p.avatar_url,p.bio,p.pronouns,p.favorite_series,cp.showcase,cp.badges,cp.binder_theme from profiles p left join collector_progress cp on cp.user_id=p.id where p.username=profile_username and profile_public$$;`);
 for(const [name,id]of Object.entries(actors)){
  await db.query('insert into auth.users(id) values($1)',[id]);
  await db.query('insert into profiles(id,display_name) values($1,$2)',[id,name]);
  await db.query('insert into wallets(user_id,ink,shards) values($1,350,20)',[id]);
 }
 await db.query('insert into auth.sessions values($1,$2)',[session,actors.user]);
 await db.query("insert into creator_roles values($1,'admin')",[actors.admin]);
 for(const file of ['20261013215224_earn_ink_community_missions.sql','20261014025341_daily_collector_poll_rotation.sql'])await db.exec(await readFile(new URL('../supabase/migrations/'+file,import.meta.url),'utf8'));
 if(!blueprint){
  await db.query('insert into cards values($1,true)',[card]);
  await db.query('insert into collection_items(user_id,card_id) values($1,$2)',[actors.user,card]);
  await db.query("insert into variants values('30000000-0000-4000-8000-000000000001',$1,'sfw',true),('30000000-0000-4000-8000-000000000002',$1,'adult',true)",[card]);
  await db.exec("insert into card_assets values('40000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001','front','sfw/front.webp'),('40000000-0000-4000-8000-000000000002','30000000-0000-4000-8000-000000000002','front','adult/front.webp');");
 }
 const installLimits=async()=>{
  // Minimal economy endpoints let the real rate-limit migration wrap them.
  // Community actions, policy checks and cleanup use their real migration bodies.
  await db.exec(`create function public.open_pack_v2(pack_slug text) returns table(ink bigint,shards bigint,pulls jsonb) language sql as $$select 350::bigint,20::bigint,'[]'::jsonb$$;
  create function public.craft_missing_card(target_card_id text) returns table(ink bigint,shards bigint) language sql as $$select 350::bigint,20::bigint$$;
  create function public.craft_card_treatment(target_card_id text,treatment_id text,shard_cost integer) returns table(ink bigint,shards bigint) language sql as $$select 350::bigint,20::bigint$$;
  create function public.claim_collector_reward(reward_key text,ink_reward integer default 0,shard_reward integer default 0) returns table(ink bigint,shards bigint) language sql as $$select 350::bigint,20::bigint$$;`);
  await db.exec(await readFile(new URL('../supabase/migrations/20261014183759_request_abuse_limits.sql',import.meta.url),'utf8'));
 };
 if(requestLimits==='before')await installLimits();
 await db.exec(await readFile(new URL('../supabase/migrations/20261014044307_beta_account_safety.sql',import.meta.url),'utf8'));
 if(requestLimits==='after')await installLimits();
 return db;
 } catch(error) {await db.close();throw error;}
}
