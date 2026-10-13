import {pageMetadata} from '@/lib/site-metadata';
import {redirect} from 'next/navigation'
import {createClient} from '@/lib/supabase/server'
import UserManager from './user-manager'
export const metadata=pageMetadata('Collector management','Authorized creator tools for managing collector accounts and virtual currency.','/admin/users',false);
export default async function AdminUsersPage(){
 const supabase=await createClient()
 const auth=await supabase.auth.getUser()
 if(!auth.data.user)redirect('/login')
 const roles=await supabase.from('creator_roles').select('role').eq('user_id',auth.data.user.id).maybeSingle()
 if(roles.data?.role!=='admin')redirect('/')
 return <UserManager/>
}