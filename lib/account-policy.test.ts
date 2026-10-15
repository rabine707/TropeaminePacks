import test from 'node:test';
import assert from 'node:assert/strict';
import {POLICY_VERSION,validatePolicy,hasRecentAuthentication,clearAccountStorage,sameOrigin,publicRequestOrigin} from './account-policy.ts';
import {signPolicy,readPolicy} from './account-policy-token.ts';
import {deleteAccount,type DeletionServices} from './account-deletion.ts';

test('policy declarations reject under-13, absent/old acceptance and invalid values',()=>{
 for(const ageBand of ['under_13','',null,18])assert.throws(()=>validatePolicy({ageBand,acceptTerms:true,version:POLICY_VERSION}));
 assert.throws(()=>validatePolicy({ageBand:'13_17',acceptTerms:false,version:POLICY_VERSION}));
 assert.throws(()=>validatePolicy({ageBand:'18_plus',acceptTerms:true,version:'old'}));
 assert.equal(validatePolicy({ageBand:'13_17',acceptTerms:true,version:POLICY_VERSION}),'13_17');
});
test('signed OAuth policy proofs cannot be altered, reused after expiry, or created without a private secret',()=>{
 const secret='synthetic-only-policy-key-at-least-32-characters',now=1000;
 const token=signPolicy('13_17',secret,now);
 assert.equal(readPolicy(token,secret,now+10),'13_17');
 assert.equal(readPolicy(token+'x',secret,now+10),null);
 assert.equal(readPolicy(token,secret,now+901),null);
 assert.equal(readPolicy(token,'wrong-private-secret-that-is-long-enough',now+10),null);
 assert.equal(readPolicy('invalid',secret,now),null);
 assert.throws(()=>signPolicy('18_plus','short',now));
});
test('fresh iat alone and future or stale AMR cannot authorize deletion',()=>{
 assert.equal(hasRecentAuthentication({iat:1000},1001),false);
 assert.equal(hasRecentAuthentication({amr:[{method:'password',timestamp:1000}]},1001),true);
 assert.equal(hasRecentAuthentication({amr:[{method:'oauth',timestamp:1000}]},1901),false);
 assert.equal(hasRecentAuthentication({amr:[{method:'password',timestamp:2000}]},1001),false);
 assert.equal(hasRecentAuthentication({amr:[{method:'token_refresh',timestamp:1000}]},1001),false);
});
test('legitimate proxy-host requests work without allowing cross-origin or insecure production requests',()=>{
 const local=new Request('http://localhost:3014/api/account/policy',{headers:{host:'127.0.0.1:3014',origin:'http://127.0.0.1:3014'}});
 assert.equal(sameOrigin(local),true);
 const preview=new Request('http://internal:3000/api/account',{headers:{host:'preview.vercel.app',origin:'https://preview.vercel.app','x-forwarded-proto':'https'}});
 assert.equal(sameOrigin(preview),true);assert.equal(publicRequestOrigin(preview),'https://preview.vercel.app');
 assert.equal(sameOrigin(new Request('http://internal:3000/api/account',{headers:{host:'preview.vercel.app',origin:'https://evil.invalid'}})),false);
 assert.equal(sameOrigin(new Request('http://internal:3000/api/account',{headers:{host:'preview.vercel.app',origin:'http://preview.vercel.app'}})),false);
});
const request=(body:unknown,origin='https://test.invalid')=>new Request('https://test.invalid/api/account/delete',{method:'POST',headers:{origin,'Content-Type':'application/json'},body:JSON.stringify(body)});
function services(options:{signedIn?:boolean;recent?:boolean;preflightError?:boolean;revokeError?:boolean;deleteError?:boolean}={}){
 const calls:string[]=[];
 const deps:DeletionServices={
  verifiedAccount:async()=>{calls.push('verify');return options.signedIn===false?null:{id:'verified-account',accessToken:'synthetic-token',claims:{amr:[{method:'oauth',timestamp:Date.now()/1000-(options.recent===false?10000:5)}]}};},
  preflight:async()=>{calls.push('preflight');return{error:options.preflightError||null};},
  revokeSessions:async()=>{calls.push('revoke');return{error:options.revokeError||null};},
  deleteUser:async id=>{calls.push('delete:'+id);return{error:options.deleteError||null};},
  clearCookies:async()=>{calls.push('clear');},
 };return{calls,deps};
}
test('cross-origin deletion and client-selected IDs are rejected before any account operation',async()=>{
 for(const req of [request({confirmation:'DELETE'},'https://evil.invalid'),request({confirmation:'DELETE',userId:'someone-else'})]){
  const {calls,deps}=services();assert.ok((await deleteAccount(req,deps)).status>=400);assert.deepEqual(calls,[]);
 }
});
test('missing or stale authentication and protected catalog ownership prevent deletion',async()=>{
 for(const [opts,status] of [[{signedIn:false},401],[{recent:false},428],[{preflightError:true},409]] as const){
  const {calls,deps}=services(opts);assert.equal((await deleteAccount(request({confirmation:'DELETE'}),deps)).status,status);assert.ok(!calls.some(x=>x.startsWith('delete:')));
 }
});
test('sessions must revoke before Auth deletion; failures leave cookies/local deletion confirmation intact',async()=>{
 const failed=services({revokeError:true});assert.equal((await deleteAccount(request({confirmation:'DELETE'}),failed.deps)).status,503);assert.deepEqual(failed.calls,['verify','preflight','revoke']);
 const rollback=services({deleteError:true});assert.equal((await deleteAccount(request({confirmation:'DELETE'}),rollback.deps)).status,503);assert.ok(!rollback.calls.includes('clear'));
 const success=services();assert.equal((await deleteAccount(request({confirmation:'DELETE'}),success.deps)).status,200);assert.deepEqual(success.calls,['verify','preflight','revoke','delete:verified-account','clear']);
});
test('local deletion clears Tropeamine and auth drafts without erasing unrelated browser storage',()=>{
 const data=new Map([['tropeamine-packs-v1','collection'],['tropeamine-showcase-studio-v1','draft'],['sb-project-auth-token.0','auth'],['unrelated','keep']]);
 clearAccountStorage({get length(){return data.size;},key:i=>[...data.keys()][i]||null,removeItem:key=>{data.delete(key);}});
 assert.deepEqual([...data.keys()],['unrelated']);
});
