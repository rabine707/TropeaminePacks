import AccountCollectionShell from '@/components/account-collection-shell';
import {createClient} from '@/lib/supabase/server';
import './newsstand.css';

export const metadata = {
  title: 'Tropeamine — Modern bookshop preview',
  robots: {index: false, follow: false},
};

export default async function NewsstandPage() {
  const client = await createClient();
  const {data: {user}} = await client.auth.getUser();
  const role = user
    ? await client.from('creator_roles').select('role').eq('user_id', user.id).maybeSingle()
    : null;
  return <AccountCollectionShell isAdmin={role?.data?.role === 'admin'}/>;
}
