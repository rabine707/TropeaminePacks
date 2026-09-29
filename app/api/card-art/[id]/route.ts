import {createClient} from '@supabase/supabase-js';
import {deliverCardArt} from '@/lib/card-art-delivery';

export async function GET(request: Request, {params}: {params: Promise<{id: string}>}) {
  // Deliberately no cookies, user session, or service-role key on this public route.
  const client = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, {
    auth: {persistSession: false, autoRefreshToken: false, detectSessionInUrl: false},
  });
  return deliverCardArt(request, (await params).id, client);
}
