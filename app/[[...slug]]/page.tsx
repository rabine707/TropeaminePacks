import AccountCollectionShell from '@/components/account-collection-shell';
import {createClient} from '@/lib/supabase/server';
import {notFound,redirect} from 'next/navigation';

export default async function Page({params}:{params:Promise<{slug?:string[]}>}){
 const {slug=[]}=await params;
 if(slug.length>2||(slug.length===2&&slug[0]!=='series')||(slug.length&&!['discover','binder','series','packs','quests','requests','admin'].includes(slug[0])))notFound();

 const supabase=await createClient();
 const {data:{user}}=await supabase.auth.getUser();
 let isAdmin=false;
 if(user){
  const {data:role}=await supabase.from('creator_roles').select('role').eq('user_id',user.id).maybeSingle();
  isAdmin=role?.role==='admin';
 }

 if(slug[0]==='admin'&&!isAdmin){
  if(!user)redirect('/login?next=/admin');
  notFound();
 }

 return <AccountCollectionShell isAdmin={isAdmin}/>;
}
