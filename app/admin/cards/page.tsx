import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import CardManager from './card-manager'

export default async function AdminCardsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login?next=/admin/cards')

  const { data: role } = await supabase
    .from('creator_roles')
    .select('role')
    .eq('user_id', user.id)
    .maybeSingle()

  if (role?.role !== 'admin') {
    return (
      <main className="empty">
        <p className="eyebrow">TROPEAMINE PACKS</p>
        <h1>Admin access required.</h1>
        <p>This account is signed in, but it does not have permission to manage the card catalog.</p>
        <Link className="button outline" href="/">Back to the collection</Link>
      </main>
    )
  }

  return <><div style={{position:'fixed',right:24,bottom:24,zIndex:90}}><Link className="button gold" href="/admin/users">Users & currency</Link></div><CardManager email={user.email ?? 'Admin'} /></>
}
