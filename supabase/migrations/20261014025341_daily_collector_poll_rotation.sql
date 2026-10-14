-- Requires the Earn Ink community migration. Additive; existing polls/votes remain intact.
begin;
alter table public.creator_polls add column rotation_day date;
create unique index creator_polls_rotation_day on public.creator_polls(rotation_day) where rotation_day is not null;
create table mission_private.poll_rotation (
  singleton boolean primary key default true check(singleton),
  enabled boolean not null default false,
  anchor_day date not null default (now() at time zone 'UTC')::date
);
insert into mission_private.poll_rotation(singleton) values(true);
create table mission_private.poll_rotation_templates (
  position integer primary key check(position>=0),
  template_key text unique not null,
  question text not null,
  options jsonb not null check(jsonb_array_length(options) between 2 and 12)
);
-- Fixed seven-day rotation; snapshots are copied into the existing poll tables.
insert into mission_private.poll_rotation_templates(position,template_key,question,options)
select ordinality::integer-1,value->>'id',value->>'question',value->'options'
from jsonb_array_elements($presets$[{"id": "collector-style", "question": "What kind of collector are you?", "options": ["One favorite, all the editions", "The whole fictional cast", "Whatever matches my current read", "Rare pulls are my weakness", "A little bit of everything"]}, {"id": "reading-ritual", "question": "How do you usually meet your next obsession?", "options": ["Reading on my phone or Kindle", "An audiobook in my headphones", "A paperback with tabs everywhere", "Reading and listening together", "A friend who won’t stop talking about them"]}, {"id": "favorite-detail", "question": "What makes a character card an instant favorite?", "options": ["A likeness that feels right", "An outfit straight from the story", "An expression full of personality", "Details only a fellow fan would notice", "The whole card just hits"]}, {"id": "pack-ritual", "question": "What’s your pack-opening ritual?", "options": ["Slow reveal. Let me savor it.", "Straight to the foil", "Open everything, then admire", "Send my favorite pull to a friend", "One pack before I get back to my book"]}, {"id": "binder-style", "question": "How do you like to organize your binder?", "options": ["By series", "By favorite character", "By color and mood", "By rarity or finish", "Organized chaos"]}, {"id": "fictional-type", "question": "Which character energy gets you every time?", "options": ["The grumpy one with a soft spot", "The chaotic charmer", "The quietly devoted protector", "The clever troublemaker", "The sunshine with a backbone"]}, {"id": "showcase-style", "question": "What belongs at the center of your showcase?", "options": ["My current fictional obsession", "The whole found family", "My favorite couple", "My rarest pull", "A rotating cast of favorites"]}]$presets$::jsonb) with ordinality;
alter table mission_private.poll_rotation enable row level security;
alter table mission_private.poll_rotation_templates enable row level security;
revoke all on mission_private.poll_rotation,mission_private.poll_rotation_templates from public,anon,authenticated;

create function mission_private.ensure_daily_poll() returns void
language plpgsql security definer set search_path='' as $$
declare today date:=(now() at time zone 'UTC')::date; cfg record; template record; ident uuid; n integer;
begin
 perform pg_catalog.pg_advisory_xact_lock(720142);
 select * into cfg from mission_private.poll_rotation where singleton;
 update public.creator_polls set state='archived' where rotation_day<today and state in ('open','closed');
 if not cfg.enabled then return; end if;
 if exists(select 1 from public.creator_polls where rotation_day=today) then return; end if;
 select count(*) into n from mission_private.poll_rotation_templates;
 if n=0 then return; end if;
 select * into template from mission_private.poll_rotation_templates
 order by position offset (((today-cfg.anchor_day)%n+n)%n) limit 1;
 insert into public.creator_polls(title,state,reward_enabled,closes_at,rotation_day)
 values(template.question,'open',true,(today+1)::timestamp at time zone 'UTC',today) returning id into ident;
 insert into public.poll_options(poll_id,label)
 select ident,value from jsonb_array_elements_text(template.options);
end $$;

-- Keep the existing moderation/economy implementation, wrapping it with rotation rules.
alter function mission_private.action(text,jsonb) rename to action_before_rotation;
revoke all on function mission_private.action_before_rotation(text,jsonb) from public,anon,authenticated;
create function mission_private.action(op text,payload jsonb default '{}') returns jsonb
language plpgsql security definer set search_path='' as $$
declare today date:=(now() at time zone 'UTC')::date; result jsonb; daily date; enable boolean;
begin
 if op<>'public' and auth.uid() is null then raise exception 'Sign in required'; end if;
 if octet_length(payload::text)>16000 then raise exception 'Input too large'; end if;
 if op like 'admin_%' and not mission_private.admin() then raise exception 'Admin access required'; end if;
 if op='admin_rotation' then
  if jsonb_typeof(payload->'enabled') is distinct from 'boolean' then raise exception 'Choose on or paused'; end if;
  enable:=(payload->>'enabled')::boolean;
  perform pg_catalog.pg_advisory_xact_lock(720142);
  update mission_private.poll_rotation set enabled=enable,
   anchor_day=case when enable and not exists(select 1 from public.creator_polls where rotation_day is not null) then today else anchor_day end where singleton;
  if not enable then update public.creator_polls set state='closed' where rotation_day=today and state='open';
  else update public.creator_polls set state='open' where rotation_day=today and state='closed'; end if;
  perform mission_private.ensure_daily_poll();
  return jsonb_build_object('rotation',jsonb_build_object('enabled',enable));
 end if;
 if op in ('public','admin_inbox','status','admin_poll','poll_vote') then
  perform mission_private.ensure_daily_poll();
 end if;
 if op='poll_vote' or (op='admin_poll' and payload->>'id' is not null) then
  select rotation_day into daily from public.creator_polls where id=coalesce(payload->>'poll',payload->>'id')::uuid;
  if daily is not null then
   if op='poll_vote' and daily<>today then raise exception 'Poll is closed'; end if;
   if op='admin_poll' then
    if payload->>'state'='open' and (daily<>today or not (select enabled from mission_private.poll_rotation where singleton)) then
     raise exception 'Only today’s enabled rotation can be opened';
    end if;
    payload:=payload||jsonb_build_object('closes_at',to_char((daily+1)::timestamp,'YYYY-MM-DD"T"HH24:MI'));
   end if;
  end if;
 end if;
 result:=mission_private.action_before_rotation(op,payload);
 if op='public' then
  -- Past daily results are retained in the admin inbox, not piled onto Earn Ink.
  result:=jsonb_set(result,'{polls}',coalesce((select jsonb_agg(value||jsonb_build_object('daily',p.rotation_day is not null))
   from jsonb_array_elements(result->'polls') value join public.creator_polls p on p.id=(value->>'id')::uuid
   where p.rotation_day is null or p.rotation_day=today),'[]'::jsonb));
 elsif op='admin_inbox' then
  result:=result||jsonb_build_object('rotation',jsonb_build_object('enabled',(select enabled from mission_private.poll_rotation where singleton)));
 end if;
 return result;
end $$;
revoke all on function mission_private.ensure_daily_poll() from public,anon,authenticated;
revoke all on function mission_private.action(text,jsonb) from public;
grant execute on function mission_private.action(text,jsonb) to anon,authenticated;
-- Rebind the public entry point to the new wrapper (the old SQL body may be cached).
create or replace function public.community_action(op text,payload jsonb default '{}') returns jsonb
language sql security invoker set search_path='' as $$ select mission_private.action(op,payload) $$;
commit;
