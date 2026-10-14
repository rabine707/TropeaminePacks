/** Disposable loopback-only Auth/Data API adapter for browser QA. Never production. */
import {createServer} from 'node:http';
import {writeFile} from 'node:fs/promises';
import {safetyFixture,actors,as,root} from './account-safety-fixture.mjs';
const db=await safetyFixture();
await db.query("insert into public.community_submissions(user_id,category,title,notes,fingerprint) values($1,'artwork','Synthetic beta idea','Disposable QA notes','synthetic-preview')",[actors.user]);
await db.query('insert into public.collector_progress(user_id,showcase) values($1,$2)',[actors.user,['10000000-0000-4000-8000-000000000001']]);
const audit=[];let queue=Promise.resolve();
const sessionId='20000000-0000-4000-8000-000000000001';
const user=id=>({id,aud:'authenticated',role:'authenticated',email:`${Object.entries(actors).find(x=>x[1]===id)?.[0]||'new'}@example.invalid`,user_metadata:{},app_metadata:{provider:'email',providers:['email']},identities:[],created_at:'2026-01-01T00:00:00Z'});
const token=id=>[Buffer.from(JSON.stringify({alg:'HS256',typ:'JWT'})).toString('base64url'),Buffer.from(JSON.stringify({sub:id,role:'authenticated',aud:'authenticated',session_id:sessionId,amr:[{method:'password',timestamp:Math.floor(Date.now()/1000)}],iat:Math.floor(Date.now()/1000),exp:Math.floor(Date.now()/1000)+3600})).toString('base64url'),Buffer.from('fixture-only-signature').toString('base64url')].join('.');
const session=id=>({access_token:token(id),refresh_token:'fixture-refresh',expires_in:3600,token_type:'bearer',user:user(id)});
const decode=req=>{try{return JSON.parse(Buffer.from(String(req.headers.authorization||'').replace(/^Bearer /,'').split('.')[1],'base64url').toString()).sub;}catch{return null;}};
await db.exec(`create function public.synthetic_signup_profile() returns trigger language plpgsql security definer as $$begin insert into public.profiles(id,display_name) values(new.id,'Beta tester');insert into public.wallets(user_id,ink,shards) values(new.id,350,20);return new;end$$;create trigger on_fixture_signup after insert on auth.users for each row execute function public.synthetic_signup_profile();`);
createServer((req,res)=>{queue=queue.then(async()=>{
 const url=new URL(req.url,'http://127.0.0.1:54331');
 res.setHeader('access-control-allow-origin','http://127.0.0.1:3014');res.setHeader('access-control-allow-headers','authorization,apikey,content-type,x-client-info,prefer,x-supabase-api-version');res.setHeader('access-control-allow-methods','GET,POST,PATCH,DELETE,OPTIONS');
 if(req.method==='OPTIONS'){res.writeHead(204);res.end();return;}
 let raw='';for await(const chunk of req)raw+=chunk;const body=raw?JSON.parse(raw):{};let actor=decode(req);let result={};
 const send=(status,value)=>{res.writeHead(status,{'Content-Type':'application/json'});res.end(JSON.stringify(value));};
 try{
  await root(db);
  audit.push({method:req.method,path:url.pathname});
  if(url.pathname==='/auth/v1/authorize'){
   const destination=new URL(url.searchParams.get('redirect_to'));if(destination.hostname!=='127.0.0.1'||destination.port!=='3014')throw new Error('Fixture redirect must stay local');destination.searchParams.set('code','fixture-code');res.writeHead(302,{location:destination.href});res.end();return;
  }
  if(url.pathname==='/auth/v1/token'){
   const id=url.searchParams.get('grant_type')==='pkce'?actors.other:actors.user;
   const exists=(await db.query('select id from auth.users where id=$1',[id])).rows.length;if(!exists){send(401,{error:'invalid_grant',error_description:'Synthetic account removed'});return;}
   await db.query('insert into auth.sessions(id,user_id) values($1,$2) on conflict(id) do update set user_id=excluded.user_id',[sessionId,id]);send(200,session(id));return;
  }
  if(url.pathname==='/auth/v1/signup'){
   const id='60000000-0000-4000-8000-000000000001';await db.query("insert into auth.users(id,raw_user_meta_data,raw_app_meta_data) values($1,$2,'{\"provider\":\"email\"}')",[id,JSON.stringify(body.data)]);await db.query('insert into auth.sessions(id,user_id) values($1,$2) on conflict(id) do update set user_id=excluded.user_id',[sessionId,id]);send(200,session(id));return;
  }
  if(url.pathname==='/auth/v1/user'){
   if(!actor||(await db.query('select id from auth.users where id=$1',[actor])).rows.length===0){send(401,{code:'user_not_found',message:'Synthetic account unavailable'});return;}send(200,user(actor));return;
  }
  if(url.pathname==='/auth/v1/user/identities'){send(200,{identities:[]});return;}
  if(url.pathname==='/auth/v1/.well-known/jwks.json'){send(200,{keys:[]});return;}
  if(url.pathname==='/auth/v1/logout'){await db.query('delete from auth.sessions where user_id=$1',[actor]);res.writeHead(204);res.end();return;}
  if(url.pathname.startsWith('/auth/v1/admin/users/')&&req.method==='DELETE'){
   if(req.headers.apikey!=='fixture-server-secret'){send(403,{message:'Fixture server key required'});return;}
   await db.query('delete from auth.users where id=$1',[url.pathname.split('/').at(-1)]);await writeFile(new URL('../docs/beta/browser-fixture-audit.json',import.meta.url),JSON.stringify(audit,null,2));send(200,{user:{id:url.pathname.split('/').at(-1)}});return;
  }
  if(url.pathname.startsWith('/rest/v1/rpc/')){
   await as(db,actor);const operation=url.pathname.split('/').at(-1);
   const calls={account_policy_ready:()=>db.query('select account_policy_ready() result'),account_policy_status:()=>db.query('select account_policy_status() result'),accept_account_policy:()=>db.query('select accept_account_policy($1,$2) result',[body.declared_age_band,body.accepted_version]),set_my_profile_visibility:()=>db.query('select set_my_profile_visibility($1) result',[body.make_public]),remove_my_community_content:()=>db.query('select remove_my_community_content() result'),account_deletion_preflight:()=>db.query('select account_deletion_preflight() result'),community_action:()=>db.query('select community_action($1,$2::jsonb) result',[body.op,JSON.stringify(body.payload||{})])};
   calls.flag_my_under13_account=()=>db.query('select flag_my_under13_account() result');
   calls.admin_account_restrictions=()=>db.query('select admin_account_restrictions() result');
   if(!calls[operation])throw new Error('Unsupported fixture RPC');result=(await calls[operation]()).rows[0].result;
  }else if(url.pathname.startsWith('/rest/v1/')){
   const table=url.pathname.split('/').at(-1);await as(db,actor);
   if(['profiles','wallets','collection_items'].includes(table))result=(await db.query(`select * from ${table} where ${table==='profiles'?'id':'user_id'}=$1`,[actor])).rows;
   else result=[];
  }else{send(404,{message:'Unsupported fixture path'});return;}
  send(200,result);
 }catch(error){send(400,{message:error.message,code:'P0001'});}
}).catch(error=>{res.writeHead(500);res.end('Fixture error');console.error(error.message);});}).listen(54331,'127.0.0.1',()=>console.log('Disposable beta fixture: http://127.0.0.1:54331'));
