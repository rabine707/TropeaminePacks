-- Additive beta policy/deletion migration. Requires both reviewed community migrations.
-- No wallets, collections, claims, artwork, or existing accounts are reset by installation.
begin;
create schema beta_private;
revoke all on schema beta_private from public;
grant usage on schema beta_private to anon,authenticated;
create table beta_private.account_policy (
 user_id uuid primary key references auth.users(id) on delete cascade,
 age_band text not null check(age_band in ('13_17','18_plus')),
 version text not null,
 accepted_at timestamptz not null default now()
);
alter table beta_private.account_policy enable row level security;
revoke all on beta_private.account_policy from public,anon,authenticated;
create table beta_private.account_restrictions(user_id uuid primary key references auth.users(id) on delete cascade,reason text not null check(reason='under_13'),created_at timestamptz not null default now());
alter table beta_private.account_restrictions enable row level security;
revoke all on beta_private.account_restrictions from public,anon,authenticated;

create function beta_private.account_ready() returns boolean
language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and exists(select 1 from beta_private.account_policy c
 join auth.users u on u.id=c.user_id where c.user_id=(select auth.uid()) and c.version='2026-10-14'
 and not exists(select 1 from beta_private.account_restrictions r where r.user_id=c.user_id))
$$;
create function beta_private.is_admin() returns boolean
language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and exists(select 1 from public.creator_roles where user_id=(select auth.uid()) and role='admin')
$$;
revoke all on function beta_private.account_ready(),beta_private.is_admin() from public;
grant execute on function beta_private.account_ready(),beta_private.is_admin() to anon,authenticated;
create function public.account_policy_ready() returns boolean
language sql stable security invoker set search_path='' as $$select beta_private.account_ready()$$;
revoke all on function public.account_policy_ready() from public;
grant execute on function public.account_policy_ready() to authenticated;

-- Email registrations must carry a valid declaration, including direct Auth API calls.
-- Google creates an Auth identity before our callback; that identity has no app permissions
-- until the callback/onboarding records the signed declaration. This is self-declaration,
-- not identity or age verification. Editable user_metadata is never read for authorization.
create function beta_private.check_registration() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if coalesce(new.raw_app_meta_data->>'provider','email')='email' and
  (coalesce(new.raw_user_meta_data->>'tp_age_band','') not in ('13_17','18_plus')
   or coalesce(new.raw_user_meta_data->>'tp_policy_version','')<>'2026-10-14'
   or new.raw_user_meta_data->'tp_terms_accepted' is distinct from 'true'::jsonb) then
  raise exception 'Complete the 13+ account policy before email registration';
 end if;
 return new;
end $$;
create function beta_private.record_registration() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if coalesce(new.raw_app_meta_data->>'provider','email')='email' then
  insert into beta_private.account_policy(user_id,age_band,version)
  values(new.id,new.raw_user_meta_data->>'tp_age_band','2026-10-14');
 end if;
 return new;
end $$;
create trigger beta_check_registration before insert on auth.users for each row execute function beta_private.check_registration();
create trigger zzz_beta_record_registration after insert on auth.users for each row execute function beta_private.record_registration();

alter table public.profiles add column if not exists profile_public boolean not null default false;
alter table public.profiles alter column profile_public set default false;
alter table public.profiles add column if not exists adult_content_enabled boolean not null default false;
alter table public.profiles add column if not exists adult_age_confirmed_at timestamptz;
alter table public.book_requests add column withdrawn boolean not null default false;
alter table public.character_requests add column withdrawn boolean not null default false;

create function public.accept_account_policy(declared_age_band text,accepted_version text) returns void
language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); previous text;
begin
 if actor is null or not exists(select 1 from auth.users where id=actor) then raise exception 'Sign in required'; end if;
 if exists(select 1 from beta_private.account_restrictions where user_id=actor) then raise exception 'This account requires privacy/support review'; end if;
 if declared_age_band is null or declared_age_band not in ('13_17','18_plus') or accepted_version is distinct from '2026-10-14' then raise exception 'Account policy requires age 13+ and current Terms acceptance'; end if;
 perform 1 from auth.users where id=actor for update;
 select age_band into previous from beta_private.account_policy where user_id=actor;
 if previous is not null and previous<>declared_age_band then raise exception 'Contact support to correct an existing age range'; end if;
 insert into beta_private.account_policy(user_id,age_band,version) values(actor,declared_age_band,accepted_version)
 on conflict(user_id) do update set version=excluded.version,accepted_at=case when beta_private.account_policy.version=excluded.version then beta_private.account_policy.accepted_at else now() end;
 if previous is null then update public.profiles set profile_public=false where id=actor; end if;
end $$;
create function public.flag_my_under13_account() returns void
language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or not exists(select 1 from auth.users where id=auth.uid()) then raise exception 'Sign in required'; end if;
 insert into beta_private.account_restrictions(user_id,reason) values(auth.uid(),'under_13') on conflict do nothing;
 update public.profiles set profile_public=false where id=auth.uid();
end $$;
create function public.admin_account_restrictions() returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
 if not beta_private.is_admin() or not beta_private.account_ready() then raise exception 'Admin access required'; end if;
 return coalesce((select jsonb_agg(jsonb_build_object('user_id',user_id,'reason',reason,'created_at',created_at)) from beta_private.account_restrictions),'[]'::jsonb);
end $$;
create function public.account_policy_status() returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare actor uuid:=auth.uid();
begin
 if actor is null or not exists(select 1 from auth.users where id=actor) then raise exception 'Sign in required'; end if;
 return jsonb_build_object('ready',beta_private.account_ready(),'version','2026-10-14',
 'ageBand',(select age_band from beta_private.account_policy where user_id=actor),
 'acceptedAt',(select accepted_at from beta_private.account_policy where user_id=actor),
 'profilePublic',coalesce((select profile_public from public.profiles where id=actor),false),
 'submissions',(select count(*) from public.community_submissions where user_id=actor));
end $$;
create function public.set_my_profile_visibility(make_public boolean) returns void
language plpgsql security definer set search_path='' as $$
begin
 if not beta_private.account_ready() then raise exception 'Complete account policy first'; end if;
 if make_public is null then raise exception 'Choose profile visibility'; end if;
 update public.profiles set profile_public=make_public where id=auth.uid();
end $$;

-- Restrictive policies intersect existing ownership/admin policies; they grant no new access.
do $$ declare t text; begin
 foreach t in array array['profiles','wallets','collection_items','collector_progress','collector_achievements','mission_claims','studio_exports','community_submissions','community_support','book_support','request_votes','poll_votes','favorites','inventory','collections','quest_progress','currency_ledger'] loop
  if to_regclass('public.'||t) is not null then
   execute format('alter table public.%I enable row level security',t);
   execute format('create policy beta_account_eligible on public.%I as restrictive for all to authenticated using ((select beta_private.account_ready())) with check ((select beta_private.account_ready()))',t);
  end if;
 end loop;
end $$;
create function beta_private.guard_economy() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is not null and not beta_private.account_ready() then raise exception 'Complete account policy first'; end if;
 if tg_op='DELETE' then return old; end if;
 return new;
end $$;
-- Existing SECURITY DEFINER economy RPCs bypass RLS, so their writes need a separate guard.
do $$ declare t text; begin
 foreach t in array array['wallets','currency_ledger','collection_items','collector_achievements','inventory','mission_claims','studio_exports'] loop
  if to_regclass('public.'||t) is not null then
   execute format('create trigger beta_economy_guard before insert or update or delete on public.%I for each row execute function beta_private.guard_economy()',t);
  end if;
 end loop;
end $$;

-- Explicit editions remain unavailable to collectors during the non-explicit beta,
-- including direct Data API and Storage access. Creators can still manage originals.
create policy beta_non_explicit on public.variants as restrictive for select to anon,authenticated
 using (rating::text<>'adult' or (select beta_private.is_admin()));
create policy beta_non_explicit on public.card_assets as restrictive for select to anon,authenticated
 using (exists(select 1 from public.variants v where v.id=variant_id and (v.rating::text<>'adult' or (select beta_private.is_admin()))));
do $$ begin
 if to_regclass('storage.objects') is not null then
  execute 'create policy beta_non_explicit on storage.objects as restrictive for select to anon,authenticated using (name not like ''adult/%'' or (select beta_private.is_admin()))';
 end if;
end $$;

-- Community cleanup keeps independent curated requests and other collectors' votes.
-- Raw submissions, notes, personal attribution, votes, profile publication and showcases
-- belonging to the requesting collector are removed. Claimed rewards never reset.
create function beta_private.remove_content(actor uuid) returns void
language plpgsql security definer set search_path='' as $$
begin
 perform pg_catalog.pg_advisory_xact_lock(720131);
 delete from public.community_support where user_id=actor or submission_id in (select id from public.community_submissions where user_id=actor);
 update public.community_submissions set merged_into=null where user_id<>actor and merged_into in (select id from public.community_submissions where user_id=actor);
 delete from public.community_submissions where user_id=actor;
 update public.character_requests c set withdrawn=true where submitted_by=actor and not exists(select 1 from public.community_submissions s where s.character_request_id=c.id and s.status in ('approved','planned'));
 update public.book_requests b set withdrawn=true,approved_at=null where submitted_by=actor
  and not exists(select 1 from public.community_submissions s where s.book_request_id=b.id and s.status in ('approved','planned'))
  and not exists(select 1 from public.character_requests c where c.book_request_id=b.id and c.submitted_by is distinct from actor and not c.withdrawn);
 update public.character_requests set submitted_by=null where submitted_by=actor;
 update public.book_requests set submitted_by=null where submitted_by=actor;
 delete from public.request_votes where user_id=actor;
 delete from public.book_support where user_id=actor;
 delete from public.poll_votes where user_id=actor;
 update public.profiles set profile_public=false where id=actor;
 update public.collector_progress set showcase='{}',showcase_title='My favorites' where user_id=actor;
end $$;
create function public.remove_my_community_content() returns void
language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or not exists(select 1 from auth.users where id=auth.uid()) then raise exception 'Sign in required'; end if;
 perform beta_private.remove_content(auth.uid());
end $$;

-- Repair non-cascading account FKs in both production and normalized blueprint layouts.
-- Shared curated requests and moderator attribution become anonymous instead of cascading.
do $$ declare fk record; treatment text; begin
 for fk in select c.oid,c.conname,c.conrelid,c.confrelid,a.attname,ns.nspname,cl.relname
  from pg_constraint c join pg_class cl on cl.oid=c.conrelid join pg_namespace ns on ns.oid=cl.relnamespace
  join pg_attribute a on a.attrelid=c.conrelid and a.attnum=c.conkey[1]
  where c.contype='f' and array_length(c.conkey,1)=1 and ns.nspname='public'
   and c.confrelid in ('public.profiles'::regclass,'auth.users'::regclass) loop
  treatment:=null;
  if fk.attname='submitted_by' and fk.relname in ('book_requests','character_requests') then treatment:='set null';
  elsif fk.attname in ('admin_id','actor_id') then treatment:='set null';
  elsif (fk.attname='id' and fk.relname='profiles') or (fk.attname='user_id' and fk.relname=any(array['wallets','collection_items','collector_progress','collector_achievements','creator_roles','mission_claims','studio_exports','community_submissions','community_support','book_support','request_votes','poll_votes','favorites','inventory','collections','quest_progress','currency_ledger','moderation_reports','content_preferences','premium_entitlements','pack_openings'])) then treatment:='cascade';
  end if;
  if treatment is not null then
   if treatment='set null' then execute format('alter table %s alter column %I drop not null',fk.conrelid::regclass,fk.attname); end if;
   execute format('alter table %s drop constraint %I',fk.conrelid::regclass,fk.conname);
   execute format('alter table %s add constraint %I foreign key (%I) references %s(id) on delete %s',fk.conrelid::regclass,fk.conname,fk.attname,fk.confrelid::regclass,treatment);
  end if;
 end loop;
end $$;

create function beta_private.deletion_check(actor uuid) returns void
language plpgsql security definer set search_path='' as $$
declare uploads bigint:=0;
begin
 -- Serialize Auth deletion checks so two creators cannot both pass as non-last.
 perform pg_catalog.pg_advisory_xact_lock(720132);
 if exists(select 1 from public.creator_roles where user_id=actor and role='admin') and not exists(select 1 from public.creator_roles where user_id<>actor and role='admin') then raise exception 'Transfer the last creator role before deletion'; end if;
 if to_regclass('storage.objects') is not null then
  execute 'select count(*) from storage.objects where owner_id=$1' into uploads using actor::text;
  if uploads>0 then raise exception 'Transfer catalog/upload ownership before deletion'; end if;
 end if;
end $$;
create function public.account_deletion_preflight() returns void
language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or not exists(select 1 from auth.users where id=auth.uid()) then raise exception 'Sign in required'; end if;
 if not exists(select 1 from auth.sessions where user_id=auth.uid() and id::text=auth.jwt()->>'session_id') then raise exception 'An active session is required'; end if;
 perform beta_private.deletion_check(auth.uid());
end $$;
create function beta_private.cleanup_auth_user() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 perform beta_private.deletion_check(old.id);
 perform beta_private.remove_content(old.id);
 return old;
end $$;
create trigger beta_cleanup_auth_user before delete on auth.users for each row execute function beta_private.cleanup_auth_user();

create policy beta_visible_request on public.book_requests as restrictive for select to anon,authenticated using (not withdrawn or (select beta_private.is_admin()));
create policy beta_visible_request on public.character_requests as restrictive for select to anon,authenticated using (not withdrawn or (select beta_private.is_admin()));

-- Keep the existing rotation and economy core unchanged; protect its public entry point.
create or replace function public.community_action(op text,payload jsonb default '{}') returns jsonb
language plpgsql security definer set search_path='' as $$
declare result jsonb; requests jsonb;
begin
 if op is distinct from 'public' and not beta_private.account_ready() then raise exception 'Complete account policy first'; end if;
 if op='support' and ((payload->>'kind'='book' and exists(select 1 from public.book_requests where id=(payload->>'id')::uuid and withdrawn))
  or (payload->>'kind'='character' and exists(select 1 from public.character_requests where id=(payload->>'id')::uuid and withdrawn))) then raise exception 'Request unavailable'; end if;
 result:=mission_private.action(op,payload);
 if op='public' then
  select coalesce(jsonb_agg(item||jsonb_build_object('characters',coalesce((select jsonb_agg(ch) from jsonb_array_elements(item->'characters') ch join public.character_requests c on c.id=(ch->>'id')::uuid where not c.withdrawn),'[]'::jsonb))),'[]'::jsonb)
  into requests from jsonb_array_elements(result->'requests') item join public.book_requests b on b.id=(item->>'id')::uuid where not b.withdrawn;
  result:=jsonb_set(result,'{requests}',requests);
 elsif op='admin_moderate' and payload->>'status' in ('approved','planned') then
  update public.book_requests set withdrawn=false where id in (select book_request_id from public.community_submissions where id=(payload->>'id')::uuid);
  update public.character_requests set withdrawn=false where id in (select character_request_id from public.community_submissions where id=(payload->>'id')::uuid);
 end if;
 return result;
end $$;
revoke all on function public.community_action(text,jsonb) from public;
grant execute on function public.community_action(text,jsonb) to anon,authenticated;

-- Do not change the deployed profile return shape; gate existing public publication on consent.
do $$ begin
 if to_regprocedure('public.public_collector_profile(text)') is not null then
  execute $fn$create or replace function public.public_collector_profile(profile_username text)
  returns table(display_name text,username text,avatar_url text,bio text,pronouns text,favorite_series text,showcase text[],badges text[],binder_theme text)
  language sql stable security definer set search_path='' as $body$
   select p.display_name,p.username,p.avatar_url,p.bio,p.pronouns,p.favorite_series,cp.showcase,cp.badges,cp.binder_theme
   from public.profiles p left join public.collector_progress cp on cp.user_id=p.id
   join beta_private.account_policy ap on ap.user_id=p.id and ap.version='2026-10-14'
   where lower(p.username)=lower(profile_username) and p.profile_public=true
    and not exists(select 1 from beta_private.account_restrictions r where r.user_id=p.id) limit 1
  $body$ $fn$;
 end if;
end $$;

revoke all on all functions in schema beta_private from public,anon,authenticated;
grant execute on function beta_private.account_ready(),beta_private.is_admin() to anon,authenticated;
revoke all on function public.accept_account_policy(text,text),public.account_policy_status(),public.set_my_profile_visibility(boolean),public.remove_my_community_content(),public.account_deletion_preflight() from public;
grant execute on function public.accept_account_policy(text,text),public.account_policy_status(),public.set_my_profile_visibility(boolean),public.remove_my_community_content(),public.account_deletion_preflight() to authenticated;
revoke all on function public.flag_my_under13_account(),public.admin_account_restrictions() from public;
grant execute on function public.flag_my_under13_account(),public.admin_account_restrictions() to authenticated;
commit;
