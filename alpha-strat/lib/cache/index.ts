import { SupabaseClient } from "@supabase/supabase-js";

export async function getOrFetch<T>(
  supabase: SupabaseClient,
  cacheKey: string,
  cacheType: string,
  ttlSeconds: number,
  fetcher: () => Promise<T>
): Promise<{ data: T; fromCache: boolean }> {
  try {
    const { data: row, error } = await supabase
      .from("cache")
      .select("data, expires_at")
      .eq("cache_key", cacheKey)
      .gt("expires_at", new Date().toISOString())
      .maybeSingle();

    if (!error && row) {
      return { data: row.data as T, fromCache: true };
    }
  } catch {}

  const freshData = await fetcher();

  try {
    await supabase.from("cache").upsert(
      {
        cache_key: cacheKey,
        cache_type: cacheType,
        data: freshData,
        fetched_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + ttlSeconds * 1000).toISOString(),
      },
      { onConflict: "cache_key" }
    );
  } catch {}

  return { data: freshData, fromCache: false };
}
