import test from 'node:test';
import assert from 'node:assert/strict';
import {safetyFixture,actors,as,root,accept,community,card} from '../scripts/account-safety-fixture.mjs';
const scalar=async(db,sql,args=[])=>Object.values((await db.query(sql,args)).rows[0])[0];

test('existing collectors keep balances and collections; consent is server-held and metadata cannot authorize access',async()=>{
 const db=await safetyFixture();try{
  await as(db,actors.user);assert.equal(await scalar(db,'select account_policy_ready()'),false);
  await assert.rejects(()=>db.exec("select accept_account_policy('under_13','2026-10-14')"),/13\+/);
  await assert.rejects(()=>db.exec("select accept_account_policy('18_plus','old')"),/policy/);
  await assert.rejects(()=>db.exec('select * from beta_private.account_policy'),/permission/);
  assert.equal((await db.query('select * from profiles')).rows.length,0);
  await assert.rejects(()=>community(db,'claim',{key:'daily'}),/policy/);
  await root(db);await db.query("update auth.users set raw_user_meta_data='{"+'"tp_age_band":"18_plus","tp_terms_accepted":true' +"}' where id=$1",[actors.user]);
  await as(db,actors.user);assert.equal(await scalar(db,'select account_policy_ready()'),false);
  await accept(db,actors.user,'13_17');const first=await scalar(db,'select account_policy_status()');
  assert.equal(first.profilePublic,false);
  await accept(db,actors.user,'13_17');const again=await scalar(db,'select account_policy_status()');assert.equal(first.acceptedAt,again.acceptedAt);
  await assert.rejects(()=>db.exec("select accept_account_policy('18_plus','2026-10-14')"),/correct/);
  await root(db);assert.equal(await scalar(db,'select ink from wallets where user_id=$1',[actors.user]),350);assert.equal(await scalar(db,'select count(*)::int from collection_items where user_id=$1',[actors.user]),1);
 }finally{await db.close();}
});
test('an existing account reporting under 13 is restricted server-side and cannot simply change its declaration',async()=>{
 const db=await safetyFixture();try{
  await accept(db,actors.user);await db.exec('select flag_my_under13_account()');assert.equal(await scalar(db,'select account_policy_ready()'),false);
  await assert.rejects(()=>db.exec("select accept_account_policy('18_plus','2026-10-14')"),/review/);
  await assert.rejects(()=>community(db,'claim',{key:'daily'}),/policy/);
  await assert.rejects(()=>db.exec('select admin_account_restrictions()'),/Admin/);
  await accept(db,actors.admin);assert.equal((await scalar(db,'select admin_account_restrictions()')).length,1);
 }finally{await db.close();}
});
test('Auth registration rejects email bypasses; Google identity remains ineligible until callback/onboarding consent',async()=>{
 const db=await safetyFixture();try{
  const email='50000000-0000-4000-8000-000000000001',google='50000000-0000-4000-8000-000000000002';
  await assert.rejects(()=>db.query('insert into auth.users(id) values($1)',[email]),/13\+/);
  await assert.rejects(()=>db.query("insert into auth.users(id,raw_user_meta_data) values($1,'{\"tp_age_band\":\"under_13\",\"tp_policy_version\":\"2026-10-14\",\"tp_terms_accepted\":true}')",[email]),/13\+/);
  await db.query("insert into auth.users(id,raw_user_meta_data) values($1,'{\"tp_age_band\":\"13_17\",\"tp_policy_version\":\"2026-10-14\",\"tp_terms_accepted\":true}')",[email]);
  await as(db,email);assert.equal(await scalar(db,'select account_policy_ready()'),true);
  await root(db);await db.query("insert into auth.users(id,raw_app_meta_data) values($1,'{\"provider\":\"google\"}')",[google]);
  await as(db,google);assert.equal(await scalar(db,'select account_policy_ready()'),false);await assert.rejects(()=>community(db,'claim',{key:'daily'}),/policy/);
  await accept(db,google);assert.equal(await scalar(db,'select account_policy_ready()'),true);
 }finally{await db.close();}
});
test('existing SECURITY DEFINER economy writes cannot bypass consent',async()=>{
 const db=await safetyFixture();try{
  await db.exec("create function public.synthetic_spend() returns void language sql security definer set search_path='' as $$update public.wallets set ink=ink-10 where user_id=auth.uid()$$;grant execute on function public.synthetic_spend() to authenticated;");
  await as(db,actors.user);await assert.rejects(()=>db.exec('select synthetic_spend()'),/policy/);
  await accept(db,actors.user);await db.exec('select synthetic_spend()');await root(db);assert.equal(await scalar(db,'select ink from wallets where user_id=$1',[actors.user]),340);
 }finally{await db.close();}
});
test('content removal hides own posts and clears personal attribution without resetting rewards or another collector',async()=>{
 const db=await safetyFixture();try{
  for(const id of Object.values(actors))await accept(db,id);
  await as(db,actors.user);const submitted=await community(db,'submit',{category:'book',title:'Synthetic Book',related:'Author',notes:'Private user notes'});await community(db,'claim',{key:'daily'});
  await as(db,actors.admin);await community(db,'admin_moderate',{id:submitted.id,status:'approved'});
  await as(db,actors.other);const other=await community(db,'submit',{category:'artwork',title:'Blue jacket',notes:'Keep these notes'});
  await root(db);const before=await scalar(db,'select ink from wallets where user_id=$1',[actors.user]);await db.query('insert into collector_progress(user_id,showcase) values($1,$2)',[actors.user,[card]]);await db.query('update profiles set profile_public=true where id=$1',[actors.user]);
  await as(db,actors.user);await db.exec('select remove_my_community_content()');assert.equal((await community(db,'public')).requests.length,0);assert.equal((await community(db,'claim',{key:'daily'})).awarded,0);
  await root(db);assert.equal(await scalar(db,'select count(*)::int from community_submissions where user_id=$1',[actors.user]),0);assert.equal(await scalar(db,'select notes from community_submissions where id=$1',[other.id]),'Keep these notes');assert.equal(await scalar(db,'select ink from wallets where user_id=$1',[actors.user]),before);assert.deepEqual(await scalar(db,'select showcase from collector_progress where user_id=$1',[actors.user]),[]);assert.equal(await scalar(db,'select submitted_by from book_requests where title=$1',['Synthetic Book']),null);
 }finally{await db.close();}
});
test('removing a merged contributor preserves an independently approved shared request and other votes',async()=>{
 const db=await safetyFixture();try{
  for(const id of Object.values(actors))await accept(db,id);
  await as(db,actors.user);const first=await community(db,'submit',{category:'character',title:'Shared character',related:'Shared book',notes:'Delete me'});
  await as(db,actors.other);const second=await community(db,'submit',{category:'character',title:'Shared character',related:'Shared book',notes:'Keep me'});
  await as(db,actors.admin);for(const id of [first.id,second.id])await community(db,'admin_moderate',{id,status:'approved'});
  const publicData=await community(db,'public');const characterId=publicData.requests[0].characters[0].id;
  await as(db,actors.other);await community(db,'support',{kind:'character',id:characterId,enabled:true,rating:'sfw'});
  await as(db,actors.user);await db.exec('select remove_my_community_content()');const after=await community(db,'public');assert.equal(after.requests.length,1);assert.equal(after.requests[0].characters[0].sfw,1);
  await root(db);assert.equal(await scalar(db,'select notes from community_submissions where id=$1',[second.id]),'Keep me');
 }finally{await db.close();}
});
test('Auth deletion cleans account FKs atomically, invalidates stale account eligibility and preserves other accounts',async()=>{
 const db=await safetyFixture();try{
  for(const id of Object.values(actors))await accept(db,id);
  await as(db,actors.user);await community(db,'submit',{category:'artwork',title:'Synthetic outfit'});await community(db,'claim',{key:'daily'});await db.exec('select account_deletion_preflight()');
  await root(db);await db.query('delete from auth.users where id=$1',[actors.user]);
  for(const t of ['profiles','wallets','collection_items','collector_progress','mission_claims','community_submissions','currency_ledger'])assert.equal(await scalar(db,`select count(*)::int from ${t} where ${t==='profiles'?'id':'user_id'}=$1`,[actors.user]),0,t);
  assert.equal(await scalar(db,'select ink from wallets where user_id=$1',[actors.other]),350);
  await as(db,actors.user);assert.equal(await scalar(db,'select account_policy_ready()'),false);await assert.rejects(()=>community(db,'claim',{key:'daily'}),/policy/);
 }finally{await db.close();}
});
test('catalog upload ownership and the last creator block deletion without partial cleanup',async()=>{
 const db=await safetyFixture();try{
  await assert.rejects(()=>db.query('delete from auth.users where id=$1',[actors.admin]),/last creator/);
  await db.query("insert into storage.objects(bucket_id,name,owner_id) values('card-art','sfw/master.webp',$1)",[actors.user]);
  await assert.rejects(()=>db.query('delete from auth.users where id=$1',[actors.user]),/ownership/);
  assert.equal(await scalar(db,'select count(*)::int from profiles where id=$1',[actors.user]),1);assert.equal(await scalar(db,'select count(*)::int from collection_items where user_id=$1',[actors.user]),1);
 }finally{await db.close();}
});
test('explicit asset and Storage reads stay blocked even if a collector changes legacy mature preferences',async()=>{
 const db=await safetyFixture();try{
  await accept(db,actors.user,'13_17');await db.exec('update profiles set adult_content_enabled=true,adult_age_confirmed_at=now()');
  assert.equal((await db.query('select * from variants')).rows.length,1);assert.equal((await db.query('select * from card_assets')).rows.length,1);
  await root(db);await db.exec("insert into storage.objects(bucket_id,name) values('card-art','sfw/example.webp'),('card-art','adult/example.webp')");
  await as(db,actors.user);assert.equal((await db.query('select * from storage.objects')).rows.length,1);
  await as(db,null);assert.equal((await db.query('select * from storage.objects')).rows.length,1);
 }finally{await db.close();}
});
test('normalized blueprint remains compatible and its profile-owned ledger does not block deletion',async()=>{
 const db=await safetyFixture(true);try{
  for(const id of Object.values(actors))await accept(db,id);
  await as(db,actors.user);await community(db,'claim',{key:'daily'});
  await root(db);await db.query('delete from auth.users where id=$1',[actors.user]);assert.equal(await scalar(db,'select count(*)::int from currency_ledger where user_id=$1',[actors.user]),0);assert.equal(await scalar(db,'select count(*)::int from profiles'),2);
 }finally{await db.close();}
});
