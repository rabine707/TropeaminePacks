import test from 'node:test';
import assert from 'node:assert/strict';
import {safetyFixture,actors,as,root,accept,community} from '../scripts/account-safety-fixture.mjs';

for(const requestLimits of ['before','after']){
 test(`account policy, request limits, withdrawal and deletion coexist (limits ${requestLimits} beta)`,async()=>{
  const db=await safetyFixture(false,{requestLimits});
  try{
   await as(db,actors.user);
   await assert.rejects(()=>community(db,'status'),/policy/);
   await accept(db,actors.user);
   for(let n=0;n<10;n++)await community(db,'submit',{category:'book',title:`Combined collection ${n}`,related:'Synthetic author'});
   await assert.rejects(()=>community(db,'submit',{category:'book',title:'Over the combined limit'}),e=>e.code==='PT429');
   await db.exec('select remove_my_community_content()');
   assert.equal((await community(db,'public')).requests.length,0,'withdrawn requests stay hidden through the limited wrapper');
   await root(db);
   assert.ok((await db.query('select count(*)::int n from mission_private.request_limits where user_id=$1',[actors.user])).rows[0].n>0);
   await db.query('delete from auth.users where id=$1',[actors.user]);
   assert.equal((await db.query('select count(*)::int n from mission_private.request_limits where user_id=$1',[actors.user])).rows[0].n,0,'account deletion removes quota rows');
  }finally{await db.close();}
 });
}
