import { cache } from "react";
import { createClient } from "@supabase/supabase-js";
import { normalize } from "@/lib/catalog";
export const seriesPathKey = normalize;
/** Anonymous published catalog only: never cookies, service-role keys or ownership. */
export const publishedSeries = cache(
  async (): Promise<{ title: string; author: string }[]> => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL,
      key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    if (!url || !key) return [];
    try {
      const client = createClient(url, key, {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
          detectSessionInUrl: false,
        },
      });
      const { data, error } = await client
        .from("series")
        .select("title,author")
        .eq("published", true)
        .order("title");
      if (error) return [];
      return (data ?? [])
        .filter((row) => typeof row.title === "string" && row.title.trim())
        .map((row) => ({ title: row.title, author: String(row.author ?? "") }));
    } catch {
      return [];
    }
  },
);
