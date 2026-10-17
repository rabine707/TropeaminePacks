-- Additive create-only endpoint. Does not change admin_save_card, policies,
-- shared metadata, existing cards, sets, assets, or pack memberships.
begin;
create function public.admin_create_card_draft(payload jsonb)
returns uuid language plpgsql security invoker set search_path='' as $$
declare
 cid uuid := (payload->>'id')::uuid;
 sid uuid := (payload->>'seriesId')::uuid;
 setid uuid := (payload->>'setId')::uuid;
 chid uuid := (payload->>'characterId')::uuid;
 vid uuid;
 card_number text := trim(payload->>'number');
 side_name text;
 path text;
begin
 if auth.uid() is null or not public.catalog_is_admin() then
  raise exception 'Admin access required' using errcode='42501';
 end if;
 if cid is null or sid is null or setid is null or chid is null
  or coalesce(length(card_number),0) not between 1 and 80
  or coalesce(payload->>'rarity','') not in ('common','uncommon','rare','legendary')
  or length(coalesce(payload->>'bookRange',''))>200
  or length(coalesce(payload->>'description',''))>4000 then
  raise exception 'Complete the required card fields.';
 end if;
 -- Lock selected records so their series membership cannot change mid-save.
 perform 1 from public.series where id=sid for share;
 if not found then raise exception 'Select an existing series.'; end if;
 perform 1 from public.card_sets where id=setid and series_id=sid for share;
 if not found then raise exception 'Select a set from this series.'; end if;
 perform 1 from public.characters where id=chid and series_id=sid for share;
 if not found then raise exception 'Select a character from this series.'; end if;
 -- Plain INSERT intentionally rejects collisions. Never upsert a card.
 insert into public.cards(id,character_id,set_id,number,book_range,description,published)
 values(cid,chid,setid,card_number,coalesce(payload->>'bookRange',''),coalesce(payload->>'description',''),false);
 insert into public.variants(card_id,label,rarity,rating,premium,available)
 values(cid,'Base',(payload->>'rarity')::public.rarity,'sfw',false,false) returning id into vid;
 foreach side_name in array array['front','back'] loop
  path := coalesce(payload->>side_name,'');
  if path<>'' then
   if path !~ ('^sfw/'||cid::text||'/[0-9a-f-]{36}-'||side_name||'[.](jpg|png|webp)$')
    or not exists(select 1 from storage.objects where bucket_id='card-art' and name=path) then
    raise exception 'Upload valid SFW artwork before saving.';
   end if;
   insert into public.card_assets(variant_id,side,storage_path) values(vid,side_name,path);
  end if;
 end loop;
 return cid;
end $$;
revoke all on function public.admin_create_card_draft(jsonb) from public,anon;
grant execute on function public.admin_create_card_draft(jsonb) to authenticated;
commit;
