-- Additive migration. Reviewed against production metadata on 2026-10-13.
-- Do not apply schema.sql to production: it is a separate normalized blueprint.
begin;
create schema if not exists mission_private;
revoke all on schema mission_private from public,anon;
grant usage on schema mission_private to authenticated;

-- Production has collector_progress/collection_items; keep all existing rows.
create table if not exists public.collector_progress(user_id uuid primary key references public.profiles, favorites text[] default '{}', showcase text[] default '{}', claimed_rewards text[] default '{}', updated_at timestamptz default now());
alter table public.collector_progress add column if not exists showcase_title text default 'My favorites';
create table if not exists public.collection_items(user_id uuid references public.profiles,card_id text,quantity integer default 1,acquired_at timestamptz default now(),primary key(user_id,card_id));
alter table public.cards add column if not exists published boolean not null default false;
create table public.mission_claims(user_id uuid references public.profiles, reward_key text not null, amount integer not null, created_at timestamptz not null default now(),primary key(user_id,reward_key));
create table public.studio_exports(id uuid primary key default gen_random_uuid(),user_id uuid not null references public.profiles,format text not null check(format in ('story','square','landscape','post')),card_ids text[] not null,created_at timestamptz not null default now(),completed_at timestamptz);

-- Extend the existing request model when installed; never recreate records.
do $$ begin
 if not exists(select 1 from pg_type where typnamespace='public'::regnamespace and typname='request_status') then
 create type public.request_status as enum ('requested','planned','in_progress','card_added'); end if;
 if not exists(select 1 from pg_type where typnamespace='public'::regnamespace and typname='content_rating') then
 create type public.content_rating as enum ('sfw','adult'); end if;
end $$;
create table if not exists public.book_requests(id uuid primary key default gen_random_uuid(),submitted_by uuid not null references public.profiles,title text not null,author text not null default '',dedupe_key text not null unique,status public.request_status not null default 'requested',approved_at timestamptz,reward_granted_at timestamptz,merged_into uuid references public.book_requests,created_at timestamptz default now());
create table if not exists public.character_requests(id uuid primary key default gen_random_uuid(),book_request_id uuid not null references public.book_requests,submitted_by uuid not null references public.profiles,name text not null,normalized_name text not null,status public.request_status not null default 'requested',unique(book_request_id,normalized_name));
create table if not exists public.request_votes(user_id uuid references public.profiles,character_request_id uuid references public.character_requests,rating public.content_rating not null,created_at timestamptz default now(),primary key(user_id,character_request_id,rating));
alter table public.book_requests add column if not exists community_managed boolean not null default false;
alter table public.character_requests add column if not exists community_managed boolean not null default false;
alter table public.character_requests add column if not exists merged_into uuid references public.character_requests;
-- Private raw submissions are separate from curated public requests, so every idea
-- is retained, including duplicates and suggestions that never become cards.
create table public.community_submissions(id uuid primary key default gen_random_uuid(),user_id uuid not null references public.profiles,category text not null check(category in ('book','character','artwork')),title text not null check(length(title) between 1 and 150),related text not null default '' check(length(related)<=150),notes text not null default '' check(length(notes)<=2000),fingerprint text not null,status text not null default 'pending' check(status in ('pending','approved','rejected','archived','planned')),book_request_id uuid references public.book_requests,character_request_id uuid references public.character_requests,merged_into uuid references public.community_submissions,created_at timestamptz not null default now());
create index community_submission_history on public.community_submissions(user_id,created_at);
create index community_submission_duplicates on public.community_submissions(fingerprint);
create table public.community_support(user_id uuid references public.profiles,submission_id uuid references public.community_submissions,primary key(user_id,submission_id));
create table public.book_support(user_id uuid references public.profiles,book_request_id uuid references public.book_requests,primary key(user_id,book_request_id));

create table if not exists public.creator_polls(id uuid primary key default gen_random_uuid(),title text not null,closes_at timestamptz);
create table if not exists public.poll_options(id uuid primary key default gen_random_uuid(),poll_id uuid not null references public.creator_polls,label text not null,unique(poll_id,id));
create table if not exists public.poll_votes(user_id uuid references public.profiles,poll_id uuid references public.creator_polls,option_id uuid not null,primary key(user_id,poll_id),foreign key(poll_id,option_id) references public.poll_options(poll_id,id));
alter table public.creator_polls add column if not exists state text not null default 'open' check(state in ('draft','open','closed','archived'));
alter table public.creator_polls add column if not exists reward_enabled boolean not null default false;
-- Existing polls remain intact and non-rewarding by default; new polls opt in.

create function mission_private.admin() returns boolean language sql stable security definer set search_path='' as $$ select auth.uid() is not null and exists(select 1 from public.creator_roles where user_id=auth.uid() and role='admin') $$;
create function mission_private.normal(value text) returns text language sql immutable set search_path='' as $$ select regexp_replace(lower(trim(value)),'[^[:alnum:]]','','g') $$;
create function mission_private.owned(ids text[]) returns integer language sql stable security definer set search_path='' as $$
 select count(distinct c.id)::integer from public.cards c where c.published and c.id::text=any(array(select split_part(x,':',1) from unnest(ids) x)) and exists(select 1 from public.collection_items ci where ci.user_id=auth.uid() and ci.quantity>0 and (ci.card_id=c.id::text or ci.card_id=c.id::text||':foil'))
$$;

-- Import only server-held claim history as a read-through compatibility layer.
-- Browser localStorage is never accepted as account reward evidence.
create function mission_private.legacy() returns text[] language plpgsql stable security definer set search_path='' as $$
declare keys text[]; progress record; key text;
begin
 select claimed_rewards into keys from public.collector_progress where user_id=auth.uid();
 keys:=coalesce(keys,'{}');
 if to_regclass('public.quest_progress') is not null then
 for progress in execute 'select q.event,p.period_key,p.quest_id from public.quest_progress p join public.quests q on q.id=p.quest_id where p.user_id=$1 and p.claimed_at is not null' using auth.uid() loop
 key:=case
 when progress.event in ('daily','daily_claim','visit','daily_visit','visit_daily') then 'daily:'||progress.period_key
 when progress.event in ('favorite','favorite_card') then 'favorite'
 when progress.event in ('pack','open_pack','first_pack') then 'pack'
 when progress.event in ('showcase:first','showcase_first') then 'showcase:first'
 when progress.event in ('showcase:six','showcase_full','showcase_six') then 'showcase:six'
 when progress.event in ('studio','studio_export','showcase_export') then 'studio:'||progress.period_key
 when progress.event in ('suggestion','request_submitted') then 'suggestion:'||progress.period_key
 else 'historic:'||progress.quest_id||':'||progress.period_key end;
 keys:=array_append(keys,key);
 end loop;
 end if;
 return keys;
end $$;

-- Serialize on the wallet before reserving the unique claim. Both ledger layouts
-- are supported, with no destructive conversion or browser-chosen amounts.
create function mission_private.pay(key text,amount integer) returns boolean language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); legacy text[]; did_claim boolean;
begin
 if actor is null then raise exception 'Sign in required'; end if;
 perform 1 from public.wallets where user_id=actor for update;
 if not found then raise exception 'Wallet unavailable'; end if;
 legacy:=mission_private.legacy();
 if key=any(coalesce(legacy,'{}')) or (key like 'daily:%' and ('visit-'||substring(key from 7))=any(coalesce(legacy,'{}'))) then return false; end if;
 insert into public.mission_claims(user_id,reward_key,amount) values(actor,key,amount) on conflict do nothing;
 did_claim:=found;
 if not did_claim then return false; end if;
 update public.wallets set ink=ink+amount where user_id=actor;
 if exists(select 1 from information_schema.columns where table_schema='public' and table_name='currency_ledger' and column_name='ink_delta') then
 execute 'insert into public.currency_ledger(user_id,ink_delta,shards_delta,reason) values($1,$2,0,$3)' using actor,amount,'Mission: '||key;
 else
 execute 'insert into public.currency_ledger(user_id,currency,delta,reason,idempotency_key) values($1,''ink'',$2,$3,$3)' using actor,amount,'Mission: '||key;
 end if;
 return true;
end $$;

create function mission_private.action(op text,payload jsonb default '{}') returns jsonb language plpgsql security definer set search_path='' as $$
#variable_conflict use_column
<<mission>>
declare actor uuid:=auth.uid(); day text:=to_char(now() at time zone 'UTC','YYYY-MM-DD');
 amount integer:=0; paid boolean:=false; ident uuid; target uuid; bookid uuid; charid uuid; rowdata record; targetrow record; cards text[]; title text; related text; notes text; category text; fingerprint text; eligible boolean; optionid uuid; labels jsonb; label text; result jsonb:='{}'; legacy text[];
begin
 -- Public read returns only curated fields and aggregated counts, never authors' accounts/notes.
 if op='public' then
 return jsonb_build_object('requests',coalesce((select jsonb_agg(jsonb_build_object('id',b.id,'title',b.title,'author',b.author,'status',b.status,'support',(select count(*) from public.book_support v where v.book_request_id=b.id),'requested',(select count(*) from public.community_submissions s where s.book_request_id=b.id),'supported',exists(select 1 from public.book_support v where v.book_request_id=b.id and v.user_id=actor),'characters',coalesce((select jsonb_agg(jsonb_build_object('id',c.id,'name',c.name,'sfw',(select count(*) from public.request_votes v where v.character_request_id=c.id and v.rating='sfw'),'adult',(select count(*) from public.request_votes v where v.character_request_id=c.id and v.rating='adult'),'my_sfw',exists(select 1 from public.request_votes v where v.character_request_id=c.id and v.rating='sfw' and v.user_id=actor),'my_adult',exists(select 1 from public.request_votes v where v.character_request_id=c.id and v.rating='adult' and v.user_id=actor))) from public.character_requests c where c.book_request_id=b.id and c.merged_into is null and (not c.community_managed or exists(select 1 from public.community_submissions s where s.character_request_id=c.id and s.status in ('approved','planned')))),'[]'::jsonb))) from public.book_requests b where b.approved_at is not null and b.merged_into is null),'[]'::jsonb),
 'artwork',coalesce((select jsonb_agg(jsonb_build_object('id',s.id,'title',s.title,'related',s.related,'status',s.status,'support',(select count(*) from public.community_support v where v.submission_id=s.id),'requested',1+(select count(*) from public.community_submissions x where x.merged_into=s.id),'supported',exists(select 1 from public.community_support v where v.submission_id=s.id and v.user_id=actor))) from public.community_submissions s where s.category='artwork' and s.status in ('approved','planned') and s.merged_into is null),'[]'::jsonb),
 'polls',coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'title',p.title,'state',p.state,'closes_at',p.closes_at,'reward_enabled',p.reward_enabled,'vote',(select option_id from public.poll_votes v where v.poll_id=p.id and v.user_id=actor),'claimed',exists(select 1 from public.mission_claims m where m.user_id=actor and m.reward_key='poll:'||p.id),'options',coalesce((select jsonb_agg(jsonb_build_object('id',o.id,'label',o.label)) from public.poll_options o where o.poll_id=p.id),'[]'::jsonb))) from public.creator_polls p where p.state in ('open','closed')),'[]'::jsonb));
 end if;
 if actor is null then raise exception 'Sign in required'; end if;
 if octet_length(payload::text)>16000 then raise exception 'Input too large'; end if;
 if op like 'admin_%' and not mission_private.admin() then raise exception 'Admin access required'; end if;
 if op='status' then
 legacy:=mission_private.legacy();
 return jsonb_build_object('day',day,'claims',coalesce((select jsonb_agg(reward_key) from public.mission_claims where user_id=actor),'[]'::jsonb),'legacy',to_jsonb(coalesce(legacy,'{}')),'showcase',coalesce((select to_jsonb(showcase) from public.collector_progress where user_id=actor),'[]'::jsonb),'eligible_slots',mission_private.owned(coalesce((select showcase from public.collector_progress where user_id=actor),'{}')),'wallet',(select jsonb_build_object('ink',ink,'shards',shards) from public.wallets where user_id=actor));
 elsif op='claim' then
 title:=payload->>'key';
 if title='daily' then paid:=mission_private.pay('daily:'||day,100); amount:=100;
 elsif title in ('showcase:first','showcase:six') then
 if title=any(mission_private.legacy()) or exists(select 1 from public.mission_claims where user_id=actor and reward_key=title) then
 return jsonb_build_object('awarded',0,'wallet',(select jsonb_build_object('ink',ink,'shards',shards) from public.wallets where user_id=actor)); end if;
 if mission_private.owned(coalesce((select showcase from public.collector_progress where user_id=actor),'{}')) < (case when title='showcase:first' then 1 else 6 end) then raise exception 'Add eligible owned cards to your showcase first'; end if;
 paid:=mission_private.pay(title,50); amount:=50;
 elsif title='favorite' then
 if mission_private.owned(coalesce((select favorites from public.collector_progress where user_id=actor),'{}'))=0 then raise exception 'Save an owned favorite first'; end if;
 paid:=mission_private.pay(title,50);amount:=50;
 elsif title='pack' then
 if not exists(select 1 from public.currency_ledger l where l.user_id=actor and l.reason ilike '%pack%') then raise exception 'Open a pack first'; end if;
 paid:=mission_private.pay(title,50);amount:=50;
 else raise exception 'Unknown mission'; end if;
 elsif op='favorite' then
 title:=payload->>'id';
 if not exists(select 1 from public.cards where id::text=title and published) then raise exception 'Card unavailable'; end if;
 insert into public.collector_progress(user_id) values(actor) on conflict do nothing;
 update public.collector_progress set favorites=case when coalesce((payload->>'enabled')::boolean,false) then array(select distinct unnest(coalesce(favorites,'{}')||array[mission.title])) else array_remove(favorites,mission.title) end,updated_at=now() where user_id=actor;
 elsif op='showcase' then
 select array_agg(value) into cards from jsonb_array_elements_text(payload->'cards');
 cards:=coalesce(cards,'{}');
 if cardinality(cards)>6 or mission_private.owned(cards)<>cardinality(cards) then raise exception 'Choose up to six different owned character cards'; end if;
 insert into public.collector_progress(user_id,showcase) values(actor,cards) on conflict(user_id) do update set showcase=excluded.showcase,updated_at=now();
 elsif op='export_begin' then
 select array_agg(distinct value) into cards from jsonb_array_elements_text(payload->'cards');
 if coalesce(cardinality(cards),0)=0 or mission_private.owned(cards)<>cardinality(cards) then raise exception 'Use owned character cards for this mission'; end if;
 perform 1 from public.wallets where user_id=actor for update;
 if (select count(*) from public.studio_exports where user_id=actor and created_at>now()-interval '1 minute')>=10 then raise exception 'Please wait a moment before another reward attempt'; end if;
 insert into public.studio_exports(user_id,format,card_ids) values(actor,payload->>'format',cards) returning id into ident;
 result:=jsonb_build_object('token',ident);
 elsif op='export_complete' then
 ident:=(payload->>'token')::uuid;
 select * into rowdata from public.studio_exports where id=ident and user_id=actor for update;
 if not found or rowdata.created_at<now()-interval '15 minutes' then raise exception 'Export session expired'; end if;
 if rowdata.completed_at is null then
 update public.studio_exports set completed_at=now() where id=ident;
 paid:=mission_private.pay('studio:'||day,100); amount:=100;
 end if;
 elsif op='submit' then
 category:=payload->>'category';title:=trim(coalesce(payload->>'title',''));related:=trim(coalesce(payload->>'related',''));notes:=trim(coalesce(payload->>'notes',''));
 if category not in ('book','character','artwork') or category is null or title='' or length(title)>150 or length(related)>150 or length(notes)>2000 or (category='character' and related='') then raise exception 'Complete the required fields'; end if;
 fingerprint:=category||':'||mission_private.normal(title)||':'||mission_private.normal(related);
 perform 1 from public.wallets where user_id=actor for update;
 eligible:=length(mission_private.normal(title))>=2 and length(regexp_replace(lower(title),'(.)\1+','\1','g'))>=2 and title !~* '(https?://|\m(test|asdf|qwerty|spam|nigger)\M)' and notes !~* '\m(nigger|kill yourself)\M'
 and not exists(select 1 from public.community_submissions where user_id=actor and fingerprint=mission.fingerprint);
 insert into public.community_submissions(user_id,category,title,related,notes,fingerprint) values(actor,category,title,related,notes,fingerprint) returning id into ident;
 if eligible then paid:=mission_private.pay('suggestion:'||day,25);amount:=25; end if;
 result:=jsonb_build_object('id',ident,'eligible',eligible);
 elsif op='support' then
 perform pg_advisory_xact_lock(720131);
 ident:=(payload->>'id')::uuid; category:=payload->>'kind';eligible:=coalesce((payload->>'enabled')::boolean,false);
 if category='character' then
 if not exists(select 1 from public.character_requests c join public.book_requests b on b.id=c.book_request_id where c.id=ident and c.merged_into is null and (not c.community_managed or exists(select 1 from public.community_submissions s where s.character_request_id=c.id and s.status in ('approved','planned'))) and b.approved_at is not null and b.merged_into is null) then raise exception 'Request unavailable'; end if;
 if eligible then insert into public.request_votes(user_id,character_request_id,rating) values(actor,ident,(payload->>'rating')::public.content_rating) on conflict do nothing;
 else delete from public.request_votes where user_id=actor and character_request_id=ident and rating=(payload->>'rating')::public.content_rating; end if;
 elsif category='book' then
 if not exists(select 1 from public.book_requests where id=ident and approved_at is not null and merged_into is null) then raise exception 'Request unavailable'; end if;
 if eligible then insert into public.book_support values(actor,ident) on conflict do nothing; else delete from public.book_support where user_id=actor and book_request_id=ident; end if;
 elsif category='artwork' then
 if not exists(select 1 from public.community_submissions where id=ident and status in ('approved','planned') and merged_into is null) then raise exception 'Request unavailable'; end if;
 if eligible then insert into public.community_support values(actor,ident) on conflict do nothing; else delete from public.community_support where user_id=actor and submission_id=ident; end if;
 else raise exception 'Unknown vote'; end if;
 elsif op='poll_vote' then
 ident:=(payload->>'poll')::uuid;optionid:=(payload->>'option')::uuid;
 select * into rowdata from public.creator_polls where id=ident for update;
 if not found or rowdata.state<>'open' or (rowdata.closes_at is not null and rowdata.closes_at<=now()) then raise exception 'Poll is closed'; end if;
 insert into public.poll_votes(user_id,poll_id,option_id) values(actor,ident,optionid) on conflict(user_id,poll_id) do update set option_id=excluded.option_id;
 if rowdata.reward_enabled then paid:=mission_private.pay('poll:'||ident,25);amount:=25; end if;
 elsif op='admin_inbox' then
 return jsonb_build_object('submissions',coalesce((select jsonb_agg(to_jsonb(s)||jsonb_build_object('duplicates',(select count(*) from public.community_submissions x where x.fingerprint=s.fingerprint))) from public.community_submissions s),'[]'::jsonb),'polls',coalesce((select jsonb_agg(to_jsonb(p)||jsonb_build_object('options',coalesce((select jsonb_agg(to_jsonb(o)||jsonb_build_object('votes',(select count(*) from public.poll_votes v where v.option_id=o.id))) from public.poll_options o where o.poll_id=p.id),'[]'::jsonb))) from public.creator_polls p),'[]'::jsonb));
 elsif op='admin_moderate' then
 perform pg_advisory_xact_lock(720131);
 ident:=(payload->>'id')::uuid; title:=payload->>'status';
 if title not in ('approved','rejected','archived','planned') then raise exception 'Unknown moderation status'; end if;
 select * into rowdata from public.community_submissions where id=ident for update;
 if not found or rowdata.merged_into is not null then raise exception 'Submission unavailable'; end if;
 if title in ('approved','planned') and rowdata.category<>'artwork' then
 related:=case when rowdata.category='book' then rowdata.title else rowdata.related end;
 bookid:=null;
 select id into bookid from public.book_requests b where b.merged_into is null and mission_private.normal(b.title)=mission_private.normal(related) and (rowdata.category='character' or mission_private.normal(b.author)=mission_private.normal(rowdata.related)) order by b.approved_at nulls last,b.id limit 1;
 if bookid is null then
 insert into public.book_requests(submitted_by,title,author,dedupe_key,approved_at,community_managed) values(rowdata.user_id,related,case when rowdata.category='book' then rowdata.related else '' end,mission_private.normal(related)||':'||case when rowdata.category='book' then mission_private.normal(rowdata.related) else '' end,now(),true) on conflict(dedupe_key) do update set approved_at=coalesce(public.book_requests.approved_at,now()) returning id into bookid;
 else update public.book_requests set approved_at=coalesce(approved_at,now()) where id=bookid; end if;
 -- Resolve old dedupe aliases to their canonical request after a merge.
 loop
 select merged_into into target from public.book_requests where id=bookid;
 exit when target is null;
 bookid:=target;
 end loop;
 update public.book_requests set approved_at=coalesce(approved_at,now()) where id=bookid;
 if rowdata.category='character' then
 insert into public.character_requests(book_request_id,submitted_by,name,normalized_name,community_managed) values(bookid,rowdata.user_id,rowdata.title,mission_private.normal(rowdata.title),true) on conflict(book_request_id,normalized_name) do update set name=public.character_requests.name returning id into charid;
 loop
 select merged_into into target from public.character_requests where id=charid;
 exit when target is null;
 charid:=target;
 end loop;
 end if;
 update public.community_submissions set book_request_id=bookid,character_request_id=charid where id=ident;
 end if;
 update public.community_submissions set status=mission.title where id=ident;
 update public.book_requests b set approved_at=null where b.community_managed and b.id=rowdata.book_request_id and not exists(select 1 from public.community_submissions s where s.book_request_id=b.id and s.status in ('approved','planned'));
 if title='planned' then update public.book_requests set status='planned' where id=bookid; end if;
 -- Publication is curated separately; rejecting one duplicate does not unpublish
 -- a request supported by other collectors. No moderation path calls pay().
 elsif op='admin_merge' then
 ident:=(payload->>'source')::uuid;target:=(payload->>'target')::uuid;
 if ident=target then raise exception 'Choose a different target'; end if;
 -- Global merge lock avoids opposing merge deadlocks; voting locks use rows below.
 perform pg_advisory_xact_lock(720131);
 select * into rowdata from public.community_submissions where id=ident for update;
 select * into targetrow from public.community_submissions where id=target for update;
 if rowdata.id is null or targetrow.id is null or rowdata.category<>targetrow.category or rowdata.merged_into is not null or targetrow.merged_into is not null then raise exception 'Choose unmerged suggestions of the same category'; end if;
 if rowdata.character_request_id is not null and targetrow.character_request_id is not null and rowdata.book_request_id=targetrow.book_request_id and rowdata.character_request_id<>targetrow.character_request_id then
 insert into public.request_votes(user_id,character_request_id,rating,created_at) select user_id,targetrow.character_request_id,rating,created_at from public.request_votes where character_request_id=rowdata.character_request_id on conflict do nothing;
 delete from public.request_votes where character_request_id=rowdata.character_request_id;
 update public.character_requests set merged_into=targetrow.character_request_id where id=rowdata.character_request_id;
 update public.community_submissions set character_request_id=targetrow.character_request_id where character_request_id=rowdata.character_request_id;
 end if;
 if rowdata.book_request_id is not null and targetrow.book_request_id is not null and rowdata.book_request_id<>targetrow.book_request_id then
 bookid:=rowdata.book_request_id;
 for rowdata in select * from public.character_requests where book_request_id=bookid loop
 insert into public.character_requests(book_request_id,submitted_by,name,normalized_name) values(targetrow.book_request_id,rowdata.submitted_by,rowdata.name,rowdata.normalized_name) on conflict(book_request_id,normalized_name) do update set name=public.character_requests.name returning id into charid;
 insert into public.request_votes(user_id,character_request_id,rating,created_at) select user_id,charid,rating,created_at from public.request_votes where character_request_id=rowdata.id on conflict do nothing;
 delete from public.request_votes where character_request_id=rowdata.id;
 update public.community_submissions set character_request_id=charid where character_request_id=rowdata.id;
 end loop;
 select * into rowdata from public.community_submissions where id=ident;
 insert into public.book_support select user_id,targetrow.book_request_id from public.book_support where book_request_id=rowdata.book_request_id on conflict do nothing;
 delete from public.book_support where book_request_id=rowdata.book_request_id;
 update public.book_requests set merged_into=targetrow.book_request_id where id=rowdata.book_request_id;
 update public.community_submissions set book_request_id=targetrow.book_request_id where book_request_id=rowdata.book_request_id;
 end if;
 insert into public.community_support select user_id,target from public.community_support where submission_id=ident on conflict do nothing;
 delete from public.community_support where submission_id=ident;
 update public.community_submissions set merged_into=target,status='archived',book_request_id=coalesce(targetrow.book_request_id,book_request_id) where id=ident;
 update public.community_submissions set merged_into=target where merged_into=ident;
 elsif op='admin_poll' then
 ident:=nullif(payload->>'id','')::uuid;title:=trim(coalesce(payload->>'title',''));category:=payload->>'state';labels:=payload->'options';
 if length(title) not between 3 and 150 or category not in ('draft','open','closed','archived') then raise exception 'Enter a question and poll state'; end if;
 if ident is null then
 if jsonb_array_length(labels) not between 2 and 12 then raise exception 'Use 2–12 options'; end if;
 insert into public.creator_polls(title,state,reward_enabled,closes_at) values(title,category,true,(nullif(payload->>'closes_at','')::timestamp at time zone 'UTC')) returning id into ident;
 for label in select trim(value) from jsonb_array_elements_text(labels) loop
 if length(label) not between 1 and 150 then raise exception 'Invalid option'; end if;
 insert into public.poll_options(poll_id,label) values(ident,label);
 end loop;
 else
 perform 1 from public.creator_polls where id=ident for update;
 if not found then raise exception 'Poll unavailable'; end if;
 update public.creator_polls set title=mission.title,state=category,closes_at=(nullif(payload->>'closes_at','')::timestamp at time zone 'UTC') where id=ident;
 -- Keep option IDs and historical votes; allow label edits, never delete options.
 for rowdata in select * from jsonb_array_elements(coalesce(payload->'option_edits','[]')) loop
 if length(trim(rowdata.value->>'label')) not between 1 and 150 then raise exception 'Invalid option'; end if;
 update public.poll_options set label=trim(rowdata.value->>'label') where id=(rowdata.value->>'id')::uuid and poll_id=ident;
 end loop;
 end if;
 else raise exception 'Unknown action'; end if;
 return result||jsonb_build_object('awarded',case when paid then amount else 0 end,'wallet',(select jsonb_build_object('ink',ink,'shards',shards) from public.wallets where user_id=actor));
end $$;

-- No direct writes to mission or moderation tables. Public reads go through a
-- field-whitelisted RPC, so RLS cannot accidentally expose submitter IDs/notes.
do $$ declare t text; begin
 foreach t in array array['mission_claims','studio_exports','community_submissions','community_support','book_support','book_requests','character_requests','request_votes','creator_polls','poll_options','poll_votes','collector_progress','collection_items'] loop
 execute format('alter table public.%I enable row level security',t);
 end loop;
 foreach t in array array['mission_claims','studio_exports','community_submissions','community_support','book_support','book_requests','character_requests','request_votes','creator_polls','poll_options','poll_votes'] loop
 execute format('revoke all on public.%I from public,anon,authenticated',t);
 end loop;
end $$;
-- Do not permit client writes to claimed_rewards. Other existing progress fields
-- remain editable; new mission payments use mission_claims, never these flags.
revoke insert,update on public.collector_progress from authenticated;
do $$ declare columns text; begin
 select string_agg(quote_ident(column_name),',') into columns from information_schema.columns where table_schema='public' and table_name='collector_progress' and column_name<>'claimed_rewards';
 execute 'grant insert('||columns||'),update('||columns||') on public.collector_progress to authenticated';
end $$;

create function public.community_action(op text,payload jsonb default '{}') returns jsonb language sql security invoker set search_path='' as $$ select mission_private.action(op,payload) $$;
revoke all on all functions in schema mission_private from public,anon,authenticated;
grant execute on function mission_private.action(text,jsonb) to authenticated,anon;
grant usage on schema mission_private to anon;
revoke all on function public.community_action(text,jsonb) from public;
grant execute on function public.community_action(text,jsonb) to authenticated,anon;
commit;
