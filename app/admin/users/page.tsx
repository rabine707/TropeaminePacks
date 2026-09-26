import {redirect} from 'next/navigation'
import {createClient} from '@/lib/supabase/server'
import UserManager from './user-manager'
export default async function AdminUsersPage(){
 const supabase=await createClient()
 const auth=await supabase.auth.getUser()
 if(!auth.data.user)redirect('/login')
 const roles=await supabase.from('creator_roles').select('role').eq('user_id',auth.data.user.id).maybeSingle()
 if(roles.data?.role!=='admin')redirect('/')
 return <UserManager/>
}