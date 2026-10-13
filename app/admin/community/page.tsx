import { createClient } from "@/lib/supabase/server";
import { notFound, redirect } from "next/navigation";
import CommunityAdmin from "./community-admin";
export default async function CommunityAdminPage() {
  const client = await createClient();
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user) redirect("/login?next=/admin/community");
  const { data } = await client
    .from("creator_roles")
    .select("role")
    .eq("user_id", user.id)
    .maybeSingle();
  if (data?.role !== "admin") notFound();
  return (
    <main className="community-admin">
      <CommunityAdmin />
    </main>
  );
}
