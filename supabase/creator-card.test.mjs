import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const [admin,reader,series,otherSeries,ck01,ck02,otherSet,character,otherCharacter,existing]=Array.from({length:10},(_,i)=>id(i+1));
const newId=id(20);
const payload={id:newId,seriesId:series,setId:ck02,characterId:character,number:'CK02-001',rarity:'rare',bookRange:'Books 1–2',description:'Card-specific text',front:'',back:'',published:true,available:true};
async function fixture(){
  const db=new PGlite();
  await db.exec(`create role anon;create role authenticated;create schema auth;create schema storage;
    create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    grant usage on schema auth,storage to anon,authenticated;
    create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
    create table storage.objects(bucket_id text,name text);grant select on storage.objects to authenticated;`);
  await db.exec(await readFile(new URL('./schema.sql',import.meta.url),'utf8'));
  // Bring the bootstrap fixture to the deployed catalog's shape and admin policies.
  await db.exec(`alter table cards add column book_range text default '',add column description text default '',add column published boolean default false;
    create function catalog_is_admin() returns boolean language sql stable set search_path='' as $$select auth.uid() is not null and exists(select 1 from public.creator_roles where user_id=auth.uid() and role='admin')$$;
    grant select on creator_roles to authenticated;create policy own_role on creator_roles for select to authenticated using(user_id=auth.uid());
    insert into auth.users values('${admin}'),('${reader}');insert into profiles(id,display_name) values('${admin}','Creator'),('${reader}','Reader');insert into creator_roles values('${admin}','admin');
    insert into series(id,slug,title,author,published) values('${series}','coven-king','Coven King','Known author',true),('${otherSeries}','other','Other','Other',true);
    insert into card_sets(id,series_id,title,code,published) values('${ck01}','${series}','Drop 1','CK01',true),('${ck02}','${series}','Set 2','CK02',false),('${otherSet}','${otherSeries}','Other','OTHER',true);
    insert into characters(id,series_id,name,bio,lore) values('${character}','${series}','Alpha','Original bio','{"spoiler_scope":"Books 1–2"}'),('${otherCharacter}','${otherSeries}','Other','Keep','{}');
    insert into cards(id,character_id,set_id,number,published) values('${existing}','${character}','${ck01}','CK-001',true);
    insert into variants(card_id,label,available) values('${existing}','Standard',true);`);
  for(const table of ['series','characters','card_sets','cards','variants','card_assets'])await db.exec(`grant select,insert,update on ${table} to authenticated;create policy catalog_admin_read on ${table} for select to authenticated using(catalog_is_admin());create policy catalog_admin_update on ${table} for update to authenticated using(catalog_is_admin()) with check(catalog_is_admin());create policy catalog_admin_insert on ${table} for insert to authenticated with check(catalog_is_admin());`);
  await db.exec(await readFile(new URL('./migrations/20261016235050_creator_card_drafts.sql',import.meta.url),'utf8'));
  return db;
}
async function as(db,user){await db.exec('reset role');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[user||'']);await db.exec(`set role ${user?'authenticated':'anon'}`);}
const save=(db,value)=>db.query('select admin_create_card_draft($1::jsonb) id',[JSON.stringify(value)]);

test('create-only draft flow preserves CK01 and shared metadata, and never publishes or activates packs',async()=>{
  const db=await fixture();try{
    const before=(await db.query(`select row_to_json(c) row from cards c where set_id='${ck01}'`)).rows;
    const characterBefore=(await db.query('select * from characters')).rows;
    await as(db,admin);assert.equal((await save(db,payload)).rows[0].id,newId);
    const saved=(await db.query('select * from cards where id=$1',[newId])).rows[0];
    assert.equal(saved.set_id,ck02);assert.equal(saved.character_id,character);assert.equal(saved.published,false);
    const variant=(await db.query('select * from variants where card_id=$1',[newId])).rows[0];
    assert.equal(variant.available,false);assert.equal(variant.rating,'sfw');
    await assert.rejects(()=>save(db,{...payload,description:'Overwrite retry'}),/duplicate/);
    await assert.rejects(()=>save(db,{...payload,id:existing,number:'CK02-002'}),/duplicate/);
    await assert.rejects(()=>save(db,{...payload,id:id(21),number:'CK-001'}),/duplicate/);
    await db.exec('reset role');
    assert.deepEqual((await db.query(`select row_to_json(c) row from cards c where set_id='${ck01}'`)).rows,before);
    assert.deepEqual((await db.query('select * from characters')).rows,characterBefore);
    assert.equal((await db.query('select count(*)::int count from cards')).rows[0].count,2);
  }finally{await db.close()}
});

test('RPC rejects anonymous/readers, mismatched series, forged paths and missing files atomically',async()=>{
  const db=await fixture();try{
    await as(db,null);await assert.rejects(()=>save(db,payload),/permission/);
    await as(db,reader);await assert.rejects(()=>save(db,payload),/Admin/);
    await as(db,admin);
    await assert.rejects(()=>save(db,{...payload,setId:otherSet}),/set from this series/);
    await assert.rejects(()=>save(db,{...payload,characterId:otherCharacter}),/character from this series/);
    await assert.rejects(()=>save(db,{...payload,front:`sfw/${existing}/${id(30)}-front.png`}),/artwork/);
    await assert.rejects(()=>save(db,{...payload,front:`sfw/${newId}/${id(30)}-front.png`}),/artwork/);
    assert.equal((await db.query('select count(*)::int count from cards')).rows[0].count,1);
    await db.exec('reset role');
    const front=`sfw/${newId}/${id(30)}-front.png`,back=`sfw/${newId}/${id(31)}-back.webp`;
    await db.query("insert into storage.objects values('card-art',$1),('card-art',$2)",[front,back]);
    await as(db,admin);await save(db,{...payload,front,back});
    assert.equal((await db.query('select count(*)::int count from card_assets')).rows[0].count,2);
  }finally{await db.close()}
});
