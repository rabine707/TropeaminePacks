import { createClient } from "./supabase/client";
import type { CommunityResult } from "./community";
export async function communityAction(
  op: string,
  payload: Record<string, unknown> = {},
): Promise<CommunityResult> {
  const { data, error } = await createClient().rpc("community_action", {
    op,
    payload,
  });
  if (error)
    throw new Error(
      error.code === "PGRST202"
        ? "Community missions are awaiting the reviewed database migration."
        : error.message,
    );
  if (data?.wallet)
    window.dispatchEvent(
      new CustomEvent("tropeamine-wallet", { detail: data.wallet }),
    );
  return data as CommunityResult;
}
