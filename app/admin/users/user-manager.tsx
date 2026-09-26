'use client'
import {useEffect,useState} from 'react'
import Link from 'next/link'
import {createClient} from '@/lib/supabase/client'
type U={user_id:string;display_name:string|null;username:string|null;email:string|null;ink:number|null;shards:number|null}
export default function UserManager(){
 const client=createClient();const [users,setUsers]=useState<U[]>([]);const [q,setQ]=useState('');const [msg,setMsg]=useState('')
 async function load(){const {data,error}=await client.rpc('admin_list_users');if(error)setMsg(error.message);else setUsers((data||[]) as U[])}
 useEffect(()=>{void load()},[])
 async function adjust(u:U,c:'ink'|'shards',d:number){
  const value=window.prompt((d>0?'Add ':'Remove ')+(c==='ink'?'Ink':'Shards'));if(value===null)return
  const n=Math.floor(Number(value));if(!Number.isFinite(n)||n<=0){setMsg('Enter a positive whole number.');return}
  const reason=window.prompt('Reason for adjustment?','Admin adjustment');if(reason===null)return
  const {error}=await client.rpc('adjust_user_currency',{target_user_id:u.user_id,ink_change:c==='ink'?n*d:0,shards_change:c==='shards'?n*d:0,adjustment_reason:reason})
  if(error)setMsg(error.message);else{setMsg('Currency updated.');await load()}
 }
 const list=users.filter(u=>((u.display_name||'')+' '+(u.username||'')+' '+(u.email||'')).toLowerCase().includes(q.toLowerCase()))
 return <main><div className="page-heading"><div><p className="eyebrow">TROPEAMINE PACKS · ADMIN</p><h1>Users & currency</h1><p>Manage account-linked Ink and Shards. Adjustments are recorded in Supabase.</p></div><Link className="button outline" href="/admin/cards">Card manager</Link></div>
 <label className="search"><input value={q} onChange={e=>setQ(e.target.value)} placeholder="Search name, username, or email"/></label>{msg&&<p className="footnote">{msg}</p>}
 <div className="table-wrap"><table><thead><tr><th>User</th><th>Ink</th><th>Shards</th><th>Adjust</th></tr></thead><tbody>{list.map(u=><tr key={u.user_id}><td><strong>{u.display_name||'Collector'}</strong><small>{u.username?'@'+u.username+' · ':''}{u.email}</small></td><td>{u.ink??0}</td><td>{u.shards??0}</td><td><div className="button-row"><button className="button outline" onClick={()=>adjust(u,'ink',1)}>+ Ink</button><button className="button outline" onClick={()=>adjust(u,'ink',-1)}>− Ink</button><button className="button outline" onClick={()=>adjust(u,'shards',1)}>+ Shards</button><button className="button outline" onClick={()=>adjust(u,'shards',-1)}>− Shards</button></div></td></tr>)}</tbody></table></div></main>
}