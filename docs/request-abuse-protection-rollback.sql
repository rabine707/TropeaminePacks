-- Review and authorize separately. Restores code entry points; no user data is deleted.
begin;
drop function public.open_pack_v2(text);
alter function mission_private.open_pack_v2(text) set schema public;
grant execute on function public.open_pack_v2(text) to authenticated;
drop function public.craft_missing_card(text);
alter function mission_private.craft_missing_card(text) set schema public;
grant execute on function public.craft_missing_card(text) to authenticated;
drop function public.craft_card_treatment(text,text,integer);
alter function mission_private.craft_card_treatment(text,text,integer) set schema public;
grant execute on function public.craft_card_treatment(text,text,integer) to authenticated;
drop function public.claim_collector_reward(text,integer,integer);
alter function mission_private.claim_collector_reward(text,integer,integer) set schema public;
grant execute on function public.claim_collector_reward(text,integer,integer) to authenticated;
drop function mission_private.action(text,jsonb);
alter function mission_private.action_before_request_limits(text,jsonb) rename to action;
grant execute on function mission_private.action(text,jsonb) to anon,authenticated;
-- Private counters/helper remain inaccessible; no data cleanup is implicit.
notify pgrst,'reload schema';
commit;
