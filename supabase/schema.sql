-- Inkbound production schema blueprint. Not applied to a remote project.
-- Run in a new Supabase project after review. Economy writes are server-only.
begin;
create type public.content_rating as enum ('sfw','adult');
create type public.request_status as enum ('requested','planned','in_progress','card_added');
create type public.rarity as enum ('common','uncommon','rare','legendary');
create table public.profiles (id uuid primary key references auth.users on delete cascade, display_name text not null, created_at timestamptz not null default now());
create table public.content_preferences (user_id uuid primary key references public.profiles on delete cascade, adult_opt_in_at timestamptz, age_confirmed_at timestamptz, check ((adult_opt_in_at is null) or (age_confirmed_at is not null)));
create table public.premium_entitlements (id uuid primary key default gen_random_uuid(), user_id uuid not null references public.profiles on delete cascade, starts_at timestamptz not null default now(), expires_at timestamptz not null, revoked_at timestamptz, check(expires_at>starts_at));
create table public.creator_roles (user_id uuid primary key references public.profiles on delete cascade, role text not null check(role in ('admin','moderator')));
create table public.taxonomies (id uuid primary key default gen_random_uuid(), kind text not null check(kind in ('genre','tag','shelf','trope')), label text not null, slug text not null, unique(kind,slug));
create table public.series (id uuid primary key default gen_random_uuid(), slug text not null unique, title text not null, author text not null, description text, published boolean not null default false);
create table public.books (id uuid primary key default gen_random_uuid(), series_id uuid references public.series, title text not null, author text not null, volume numeric, reference_url text, unique(series_id,title));
create table public.series_taxonomies (series_id uuid references public.series on delete cascade, taxonomy_id uuid references public.taxonomies on delete cascade, primary key(series_id,taxonomy_id));
create table public.characters (id uuid primary key default gen_random_uuid(), series_id uuid not null references public.series, name text not null, bio text, lore jsonb not null default '{}', unique(series_id,name));
create table public.character_appearances (character_id uuid references public.characters on delete cascade, book_id uuid references public.books on delete cascade, primary key(character_id,book_id));
create table public.character_taxonomies (character_id uuid references public.characters on delete cascade, taxonomy_id uuid references public.taxonomies on delete cascade, verified boolean not null default false, primary key(character_id,taxonomy_id));
create table public.character_relationships (character_id uuid references public.characters on delete cascade, related_id uuid references public.characters on delete cascade, description text, spoiler boolean not null default false, primary key(character_id,related_id));
create table public.card_sets (id uuid primary key default gen_random_uuid(), series_id uuid not null references public.series, title text not null, code text not null unique, featured boolean not null default false, published boolean not null default false);
create table public.cards (id uuid primary key default gen_random_uuid(), character_id uuid not null references public.characters, set_id uuid not null references public.card_sets, number text not null unique);
-- Public variant metadata never contains storage URLs, explicit text, or thumbnails.
create table public.variants (id uuid primary key default gen_random_uuid(), card_id uuid not null references public.cards, label text not null, rarity public.rarity not null default 'common', rating public.content_rating not null default 'sfw', premium boolean not null default false, foil boolean not null default false, available boolean not null default false, craft_cost integer not null default 30 check(craft_cost>0), duplicate_shards integer not null default 10 check(duplicate_shards>=0), check(rating<>'adult' or premium), unique(card_id,label));
create table public.card_assets (id uuid primary key default gen_random_uuid(), variant_id uuid not null references public.variants on delete cascade, side text not null check(side in ('front','back')), storage_path text not null unique, width integer, height integer, unique(variant_id,side));
create table public.collections (id uuid primary key default gen_random_uuid(), user_id uuid not null references public.profiles on delete cascade, title text not null, theme text not null default 'midnight', shelf_id uuid references public.taxonomies, unique(user_id,title));
create table public.inventory (user_id uuid not null references public.profiles on delete cascade, variant_id uuid not null references public.variants, acquired_at timestamptz not null default now(), source text not null check(source in ('pack','craft','reward','grant')), primary key(user_id,variant_id));
create table public.collection_slots (collection_id uuid references public.collections on delete cascade, variant_id uuid references public.variants, position integer not null check(position>=0), primary key(collection_id,position), unique(collection_id,variant_id));
create table public.favorites (user_id uuid references public.profiles on delete cascade, card_id uuid references public.cards on delete cascade, created_at timestamptz not null default now(), primary key(user_id,card_id));
create table public.wallets (user_id uuid primary key references public.profiles on delete cascade, ink bigint not null default 0 check(ink>=0), shards bigint not null default 0 check(shards>=0));
create table public.currency_ledger (id uuid primary key default gen_random_uuid(), user_id uuid not null references public.profiles, currency text not null check(currency in ('ink','shards')), delta bigint not null, reason text not null, idempotency_key text not null, created_at timestamptz not null default now(), unique(user_id,currency,idempotency_key));
create table public.packs (id uuid primary key default gen_random_uuid(), title text not null, kind text not null check(kind in ('series','genre','event','adult')), set_id uuid references public.card_sets, taxonomy_id uuid references public.taxonomies, ink_cost integer not null check(ink_cost>=0), card_count integer not null default 5 check(card_count=5), guaranteed_rarity public.rarity not null default 'uncommon' check(guaranteed_rarity<>'common'), available boolean not null default false);
create table public.pack_pool (pack_id uuid references public.packs on delete cascade, variant_id uuid references public.variants, weight integer not null default 1 check(weight>0), primary key(pack_id,variant_id));
create table public.pack_openings (id uuid primary key default gen_random_uuid(), user_id uuid not null references public.profiles, pack_id uuid not null references public.packs, idempotency_key uuid not null, opened_at timestamptz not null default now(), unique(user_id,idempotency_key));
create table public.pack_contents (opening_id uuid references public.pack_openings on delete cascade, slot integer check(slot between 1 and 5), variant_id uuid not null references public.variants, duplicate boolean not null, shards_awarded integer not null default 0 check(shards_awarded>=0), primary key(opening_id,slot));
create table public.quests (id uuid primary key default gen_random_uuid(), title text not null, description text not null, category text not null check(category in ('daily','community','creator')), event text not null, target integer not null default 1 check(target>0), ink_reward integer not null default 0 check(ink_reward>=0), pack_reward uuid references public.packs, cosmetic_reward text, requires_approval boolean not null default false, starts_at timestamptz not null default now(), ends_at timestamptz);
create table public.quest_progress (user_id uuid references public.profiles on delete cascade, quest_id uuid references public.quests, period_key text not null, progress integer not null default 0 check(progress>=0), approved_at timestamptz, claimed_at timestamptz, primary key(user_id,quest_id,period_key));
create table public.book_requests (id uuid primary key default gen_random_uuid(), submitted_by uuid not null references public.profiles, title text not null, author text not null, dedupe_key text not null unique, genre text, tags text[] not null default '{}', reference_url text, status public.request_status not null default 'requested', approved_at timestamptz, reward_granted_at timestamptz, merged_into uuid references public.book_requests, created_at timestamptz not null default now(), check(merged_into is null or merged_into<>id));
create table public.character_requests (id uuid primary key default gen_random_uuid(), book_request_id uuid not null references public.book_requests, submitted_by uuid not null references public.profiles, name text not null, normalized_name text not null, status public.request_status not null default 'requested', fulfilled_card_id uuid references public.cards, unique(book_request_id,normalized_name));
create table public.request_votes (user_id uuid references public.profiles on delete cascade, character_request_id uuid references public.character_requests on delete cascade, rating public.content_rating not null, created_at timestamptz not null default now(), primary key(user_id,character_request_id,rating));
create table public.creator_polls (id uuid primary key default gen_random_uuid(), quest_id uuid references public.quests, title text not null, closes_at timestamptz);
create table public.poll_options (id uuid primary key default gen_random_uuid(), poll_id uuid not null references public.creator_polls on delete cascade, label text not null, unique(poll_id,id));
create table public.poll_votes (user_id uuid references public.profiles on delete cascade, poll_id uuid references public.creator_polls on delete cascade, option_id uuid not null, primary key(user_id,poll_id), foreign key(poll_id,option_id) references public.poll_options(poll_id,id));
create table public.moderation_reports (id uuid primary key default gen_random_uuid(), user_id uuid not null references public.profiles, card_id uuid references public.cards, request_id uuid references public.book_requests, category text not null, body text not null check(length(body) between 1 and 2000), status text not null default 'open' check(status in ('open','reviewing','resolved','dismissed')), created_at timestamptz not null default now());
create table public.moderation_actions (id uuid primary key default gen_random_uuid(), actor_id uuid not null references public.profiles, report_id uuid references public.moderation_reports, action text not null, detail jsonb not null default '{}', created_at timestamptz not null default now());
create index on public.premium_entitlements(user_id,expires_at);
create index on public.characters(series_id);
create index on public.cards(set_id);
create index on public.variants(card_id);
create index on public.card_assets(variant_id);
create index on public.character_requests(book_request_id);
create index on public.request_votes(character_request_id);
create index on public.pack_openings(user_id,opened_at);
create index on public.currency_ledger(user_id,created_at);
-- Fail-closed baseline: explicit read grants; all privileged mutations remain server-only.
do $$ declare t text; begin
 foreach t in array array['profiles','content_preferences','premium_entitlements','creator_roles','taxonomies','series','books','series_taxonomies','characters','character_appearances','character_taxonomies','character_relationships','card_sets','cards','variants','card_assets','collections','inventory','collection_slots','favorites','wallets','currency_ledger','packs','pack_pool','pack_openings','pack_contents','quests','quest_progress','book_requests','character_requests','request_votes','creator_polls','poll_options','poll_votes','moderation_reports','moderation_actions'] loop
 execute format('alter table public.%I enable row level security',t);
 execute format('revoke all on public.%I from anon, authenticated',t);
 end loop;
end $$;
create policy published_series on public.series for select to anon,authenticated using(published);
create policy published_sets on public.card_sets for select to anon,authenticated using(published and exists(select 1 from public.series s where s.id=series_id));
create policy published_books on public.books for select to anon,authenticated using(exists(select 1 from public.series s where s.id=series_id));
create policy published_characters on public.characters for select to anon,authenticated using(exists(select 1 from public.series s where s.id=series_id));
create policy published_cards on public.cards for select to anon,authenticated using(exists(select 1 from public.card_sets s where s.id=set_id));
create policy safe_variant_metadata on public.variants for select to anon,authenticated using(exists(select 1 from public.cards c where c.id=card_id));
create policy public_taxonomies on public.taxonomies for select to anon,authenticated using(true);
create policy own_profile on public.profiles for select to authenticated using(id=(select auth.uid()));
do $$ declare t text; begin
 foreach t in array array['content_preferences','premium_entitlements','collections','inventory','favorites','wallets','currency_ledger','pack_openings','quest_progress','request_votes','poll_votes','moderation_reports'] loop
 execute format('create policy own_rows on public.%I for select to authenticated using(user_id=(select auth.uid()))',t);
 execute format('grant select on public.%I to authenticated',t);
 end loop;
end $$;
grant select on public.profiles to authenticated;
grant select on public.series,public.card_sets,public.books,public.characters,public.cards,public.variants,public.taxonomies to anon,authenticated;
create policy approved_requests on public.book_requests for select to anon,authenticated using((approved_at is not null and merged_into is null) or submitted_by=(select auth.uid()));
create policy visible_character_requests on public.character_requests for select to anon,authenticated using(exists(select 1 from public.book_requests b where b.id=book_request_id));
grant select on public.book_requests,public.character_requests to anon,authenticated;
create policy visible_series_tags on public.series_taxonomies for select to anon,authenticated using(exists(select 1 from public.series s where s.id=series_id));
create policy visible_character_tags on public.character_taxonomies for select to anon,authenticated using(exists(select 1 from public.characters c where c.id=character_id));
create policy visible_appearances on public.character_appearances for select to anon,authenticated using(exists(select 1 from public.characters c where c.id=character_id) and exists(select 1 from public.books b where b.id=book_id));
create policy visible_relationships on public.character_relationships for select to anon,authenticated using(exists(select 1 from public.characters c where c.id=character_id) and exists(select 1 from public.characters c where c.id=related_id));
create policy visible_packs on public.packs for select to anon,authenticated using(available and kind<>'adult');
create policy visible_pack_pool on public.pack_pool for select to anon,authenticated using(exists(select 1 from public.packs p where p.id=pack_id) and exists(select 1 from public.variants v where v.id=variant_id and v.rating='sfw' and not v.premium));
create policy active_quests on public.quests for select to anon,authenticated using(starts_at<=now() and (ends_at is null or ends_at>now()));
create policy visible_polls on public.creator_polls for select to anon,authenticated using(closes_at is null or closes_at>now());
create policy visible_poll_options on public.poll_options for select to anon,authenticated using(exists(select 1 from public.creator_polls p where p.id=poll_id));
grant select on public.series_taxonomies,public.character_taxonomies,public.character_appearances,public.character_relationships,public.packs,public.pack_pool,public.quests,public.creator_polls,public.poll_options to anon,authenticated;
create policy own_collection_slots on public.collection_slots for select to authenticated using(exists(select 1 from public.collections c where c.id=collection_id and c.user_id=(select auth.uid())));
create policy own_pack_contents on public.pack_contents for select to authenticated using(exists(select 1 from public.pack_openings o where o.id=opening_id and o.user_id=(select auth.uid())));
grant select on public.collection_slots,public.pack_contents to authenticated;
-- Assets are private even for SFW. URLs are short lived and issued only after checks.
create policy entitled_asset_metadata on public.card_assets for select to authenticated using(exists(
 select 1 from public.variants v where v.id=variant_id and
 (not v.premium or exists(select 1 from public.premium_entitlements e where e.user_id=(select auth.uid()) and e.starts_at<=now() and e.expires_at>now() and e.revoked_at is null)) and
 (v.rating='sfw' or exists(select 1 from public.content_preferences p where p.user_id=(select auth.uid()) and p.adult_opt_in_at is not null and p.age_confirmed_at is not null))
));
grant select on public.card_assets to authenticated;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values ('card-art','card-art',false,20971520,array['image/jpeg','image/png','image/webp']);
-- No direct object policies. Backend validates session, creator role for uploads,
-- and entitlement + explicit opt-in for adult reads before creating signed URLs.
commit;
