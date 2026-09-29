-- Tropeamine Packs economy security contract
--
-- This file mirrors the security-sensitive RPC behavior currently deployed to
-- Supabase so the database trust boundary is reviewable from the repository.
--
-- IMPORTANT STAGED MIGRATION:
-- collection_items still temporarily permits authenticated users to write their
-- own rows because the current browser client performs legacy binder sync.
-- Remove those INSERT/UPDATE/DELETE policies only after the frontend has moved
-- fully to open_pack_v2 / crafting RPC-owned collection mutations. SELECT stays.

-- Existing economy RPCs should never be callable anonymously.
revoke all on function public.settle_pack(integer) from public, anon;
grant execute on function public.settle_pack(integer) to authenticated;

revoke all on function public.craft_missing_card(text) from public, anon;
grant execute on function public.craft_missing_card(text) to authenticated;

-- Legacy treatment signature currently accepts shard_cost from the browser, but
-- the function independently derives expected_cost from treatment_id and rejects
-- any mismatch. This parameter can be removed in a later compatibility cleanup.
revoke all on function public.craft_card_treatment(text, text, integer) from public, anon;
grant execute on function public.craft_card_treatment(text, text, integer) to authenticated;

-- Server-authoritative pack opening.
-- The database selects all four pulls, deducts Ink, grants ownership, computes
-- duplicates, awards Shards, and records the ledger entry in one transaction.
-- Pack format: 3 distinct base cards + 1 guaranteed foil as the final pull.
create or replace function public.open_pack_v2(pack_slug text)
returns table(ink bigint, shards bigint, pulls jsonb)
language plpgsql
security definer
set search_path = public
as $function$
declare
  uid uuid := auth.uid();
  target_pack_id uuid;
  base_ids text[];
  foil_id text;
  card_id text;
  owned_key text;
  duplicate_count integer := 0;
  result_pulls jsonb := '[]'::jsonb;
begin
  if uid is null then
    raise exception 'Sign in required';
  end if;

  select p.id into target_pack_id
  from public.packs p
  where p.slug = pack_slug and p.active = true
  limit 1;

  if target_pack_id is null then
    raise exception 'Pack is not available.';
  end if;

  select array_agg(x.card_id) into base_ids
  from (
    select c.id::text as card_id
    from public.card_pack_memberships m
    join public.cards c on c.id = m.card_id
    where m.pack_id = target_pack_id
      and c.published = true
      and exists (
        select 1
        from public.variants v
        where v.card_id = c.id
          and v.available = true
          and v.rating::text = 'sfw'
      )
    order by random()
    limit 3
  ) x;

  if coalesce(cardinality(base_ids), 0) < 3 then
    raise exception 'This pack needs at least 3 available cards before it can be opened.';
  end if;

  select c.id::text into foil_id
  from public.card_pack_memberships m
  join public.cards c on c.id = m.card_id
  where m.pack_id = target_pack_id
    and c.published = true
    and exists (
      select 1
      from public.variants v
      where v.card_id = c.id
        and v.available = true
        and v.rating::text = 'sfw'
    )
  order by random()
  limit 1;

  -- This conditional UPDATE serializes concurrent openings for the same wallet.
  update public.wallets
  set ink = wallets.ink - 100,
      updated_at = now()
  where user_id = uid
    and wallets.ink >= 100
  returning wallets.ink, wallets.shards into ink, shards;

  if not found then
    raise exception 'You need 100 Ink to open this pack.';
  end if;

  foreach card_id in array base_ids loop
    owned_key := card_id;
    if exists (
      select 1 from public.collection_items
      where user_id = uid and collection_items.card_id = owned_key
    ) then
      duplicate_count := duplicate_count + 1;
      result_pulls := result_pulls || jsonb_build_array(
        jsonb_build_object('id', card_id, 'duplicate', true, 'foil', false)
      );
    else
      insert into public.collection_items(user_id, card_id, quantity)
      values(uid, owned_key, 1);
      result_pulls := result_pulls || jsonb_build_array(
        jsonb_build_object('id', card_id, 'duplicate', false, 'foil', false)
      );
    end if;
  end loop;

  owned_key := foil_id || ':foil';
  if exists (
    select 1 from public.collection_items
    where user_id = uid and collection_items.card_id = owned_key
  ) then
    duplicate_count := duplicate_count + 1;
    result_pulls := result_pulls || jsonb_build_array(
      jsonb_build_object('id', foil_id, 'duplicate', true, 'foil', true)
    );
  else
    insert into public.collection_items(user_id, card_id, quantity)
    values(uid, owned_key, 1);
    result_pulls := result_pulls || jsonb_build_array(
      jsonb_build_object('id', foil_id, 'duplicate', false, 'foil', true)
    );
  end if;

  update public.wallets
  set shards = wallets.shards + (duplicate_count * 5),
      updated_at = now()
  where user_id = uid
  returning wallets.ink, wallets.shards into ink, shards;

  insert into public.currency_ledger(user_id, ink_delta, shards_delta, reason)
  values(uid, -100, duplicate_count * 5, 'Pack opened server-side via open_pack_v2');

  pulls := result_pulls;
  return next;
end;
$function$;

revoke all on function public.open_pack_v2(text) from public, anon;
grant execute on function public.open_pack_v2(text) to authenticated;

-- Additional SECURITY DEFINER hardening discovered by the Supabase advisor.
revoke all on function public.adjust_user_currency(uuid, integer, integer, text) from public, anon;
grant execute on function public.adjust_user_currency(uuid, integer, integer, text) to authenticated;

revoke all on function public.admin_list_users() from public, anon;
grant execute on function public.admin_list_users() to authenticated;

revoke all on function public.claim_collector_reward(text, integer, integer) from public, anon;
grant execute on function public.claim_collector_reward(text, integer, integer) to authenticated;

revoke all on function public.spend_ink(integer) from public, anon;
grant execute on function public.spend_ink(integer) to authenticated;

-- Internal trigger/event-trigger functions do not need Data API execution.
revoke all on function public.handle_new_tropeamine_user() from public, anon, authenticated;
revoke all on function public.rls_auto_enable() from public, anon, authenticated;

-- This RPC accepted an arbitrary achievement key and therefore allowed a signed-in
-- user to grant themselves arbitrary badges. Keep it server-only until validation
-- rules are implemented.
revoke all on function public.unlock_collector_achievement(text) from public, anon, authenticated;
grant execute on function public.unlock_collector_achievement(text) to service_role;

-- FINAL COLLECTION CUTOVER (DO NOT RUN BEFORE THE FRONTEND USES RPC-OWNED GRANTS):
-- drop policy if exists "Users can add to their own collection" on public.collection_items;
-- drop policy if exists "Users can update their own collection" on public.collection_items;
-- drop policy if exists "Users can remove from their own collection" on public.collection_items;
-- revoke insert, update, delete on public.collection_items from authenticated;
