begin;

-- One bounded row per actor/bucket. No request log or IP/user-agent collection.
create table mission_private.request_limits (
 user_id uuid not null references auth.users(id) on delete cascade,
 bucket text not null,
 window_key bigint not null,
 requests integer not null check(requests > 0),
 primary key(user_id,bucket)
);
alter table mission_private.request_limits enable row level security;
revoke all on mission_private.request_limits from public,anon,authenticated;

create function mission_private.consume_limit(bucket_name text,window_seconds integer,max_requests integer)
returns void language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); current_window bigint;
begin
 if actor is null then raise exception 'Sign in required' using errcode='42501'; end if;
 if window_seconds<=0 or max_requests<=0 then raise exception 'Invalid server request limit'; end if;
 current_window:=floor(extract(epoch from statement_timestamp())/window_seconds)::bigint;
 insert into mission_private.request_limits as counters(user_id,bucket,window_key,requests)
 values(actor,bucket_name,current_window,1)
 on conflict(user_id,bucket) do update
 set window_key=excluded.window_key,
 requests=case when counters.window_key=excluded.window_key then counters.requests+1 else 1 end
 where counters.window_key<>excluded.window_key or counters.requests<max_requests;
 if not found then
  raise sqlstate 'PT429' using message='Too many requests. Please wait before trying again.',
   detail=bucket_name, hint='Your cards and currency have not changed. Try again after this request window resets.';
 end if;
end $$;
revoke all on function mission_private.consume_limit(text,integer,integer) from public,anon,authenticated;

-- Preserve the installed community implementation (including daily poll rotation).
-- Revoke the old entry point so direct schema calls cannot bypass the wrapper.
alter function mission_private.action(text,jsonb) rename to action_before_request_limits;
revoke all on function mission_private.action_before_request_limits(text,jsonb) from public,anon,authenticated;
create function mission_private.action(op text,payload jsonb default '{}')
returns jsonb language plpgsql security definer set search_path='' as $$
begin
 if op is null or octet_length(coalesce(payload,'{}')::text)>16000 then raise exception 'Invalid request'; end if;
 if op<>'public' and auth.uid() is null then raise exception 'Sign in required' using errcode='42501'; end if;
 if op like 'admin_%' and not mission_private.admin() then raise exception 'Admin access required' using errcode='42501'; end if;
 if auth.uid() is not null then
  case
   when op='submit' then
    perform mission_private.consume_limit('suggestions:hour',3600,10);
    perform mission_private.consume_limit('suggestions:day',86400,30);
   when op='export_begin' then
    perform mission_private.consume_limit('exports:minute',60,10);
    perform mission_private.consume_limit('exports:hour',3600,30);
   when op='export_complete' then perform mission_private.consume_limit('export-complete:minute',60,60);
   when op='claim' then perform mission_private.consume_limit('claims:minute',60,30);
   when op in ('support','poll_vote') then perform mission_private.consume_limit('votes:minute',60,60);
   when op in ('favorite','showcase') then perform mission_private.consume_limit('preferences:minute',60,120);
   when op in ('public','status') then perform mission_private.consume_limit('community-reads:minute',60,120);
   when op like 'admin_%' then perform mission_private.consume_limit('community-admin:minute',60,120);
   else null;
  end case;
 end if;
 return mission_private.action_before_request_limits(op,payload);
end $$;
revoke all on function mission_private.action(text,jsonb) from public;
grant execute on function mission_private.action(text,jsonb) to anon,authenticated;
create or replace function public.community_action(op text,payload jsonb default '{}')
returns jsonb language sql security invoker set search_path='' as $$ select mission_private.action(op,payload) $$;
revoke all on function public.community_action(text,jsonb) from public;
grant execute on function public.community_action(text,jsonb) to anon,authenticated;

-- Keep installed economy bodies intact. Only the public entry points change;
-- private originals have no client EXECUTE grant. These wrappers never accept a
-- user-selected counter key, duration, limit, or user ID.
alter function public.open_pack_v2(text) set schema mission_private;
revoke all on function mission_private.open_pack_v2(text) from public,anon,authenticated;
create function public.open_pack_v2(pack_slug text)
returns table(ink bigint,shards bigint,pulls jsonb)
language plpgsql security definer set search_path='' as $$
begin
 perform mission_private.consume_limit('packs:minute',60,12);
 perform mission_private.consume_limit('packs:hour',3600,120);
 return query select * from mission_private.open_pack_v2(pack_slug);
end $$;
revoke all on function public.open_pack_v2(text) from public,anon;
grant execute on function public.open_pack_v2(text) to authenticated;

alter function public.craft_missing_card(text) set schema mission_private;
revoke all on function mission_private.craft_missing_card(text) from public,anon,authenticated;
create function public.craft_missing_card(target_card_id text)
returns table(ink bigint,shards bigint)
language plpgsql security definer set search_path='' as $$
begin
 perform mission_private.consume_limit('crafts:minute',60,20);
 perform mission_private.consume_limit('crafts:hour',3600,120);
 return query select * from mission_private.craft_missing_card(target_card_id);
end $$;
revoke all on function public.craft_missing_card(text) from public,anon;
grant execute on function public.craft_missing_card(text) to authenticated;

alter function public.craft_card_treatment(text,text,integer) set schema mission_private;
revoke all on function mission_private.craft_card_treatment(text,text,integer) from public,anon,authenticated;
create function public.craft_card_treatment(target_card_id text,treatment_id text,shard_cost integer)
returns table(ink bigint,shards bigint)
language plpgsql security definer set search_path='' as $$
begin
 perform mission_private.consume_limit('crafts:minute',60,20);
 perform mission_private.consume_limit('crafts:hour',3600,120);
 return query select * from mission_private.craft_card_treatment(target_card_id,treatment_id,shard_cost);
end $$;
revoke all on function public.craft_card_treatment(text,text,integer) from public,anon;
grant execute on function public.craft_card_treatment(text,text,integer) to authenticated;

alter function public.claim_collector_reward(text,integer,integer) set schema mission_private;
revoke all on function mission_private.claim_collector_reward(text,integer,integer) from public,anon,authenticated;
create function public.claim_collector_reward(reward_key text,ink_reward integer default 0,shard_reward integer default 0)
returns table(ink bigint,shards bigint)
language plpgsql security definer set search_path='' as $$
begin
 perform mission_private.consume_limit('mastery-claims:minute',60,30);
 return query select * from mission_private.claim_collector_reward(reward_key,ink_reward,shard_reward);
end $$;
revoke all on function public.claim_collector_reward(text,integer,integer) from public,anon;
grant execute on function public.claim_collector_reward(text,integer,integer) to authenticated;

notify pgrst,'reload schema';
commit;
