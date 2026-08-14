import { SupabaseClient } from "@supabase/supabase-js";

async function getUserId(supabase: SupabaseClient): Promise<string | null> {
  const { data } = await supabase.auth.getClaims();
  return (data?.claims?.sub as string) ?? null;
}

export async function getOrFetch<T>(
  supabase: SupabaseClient,
  cacheKey: string,
  cacheType: string,
  ttlSeconds: number,
  fetcher: () => Promise<T>,
  options?: { shouldCache?: (data: T) => boolean; shared?: boolean }
): Promise<{ data: T; fromCache: boolean }> {
  const isShared = options?.shared ?? false;
  const userId = isShared ? null : await getUserId(supabase);

  try {
    const query = supabase
      .from("cache")
      .select("data, expires_at")
      .eq("cache_key", cacheKey)
      .gt("expires_at", new Date().toISOString());

    if (isShared) {
      query.is("user_id", null);
    } else if (userId) {
      query.eq("user_id", userId);
    }

    const { data: row, error } = await query.maybeSingle();

    if (!error && row) {
      return { data: row.data as T, fromCache: true };
    }
  } catch {}

  const freshData = await fetcher();

  const shouldCache = options?.shouldCache ? options.shouldCache(freshData) : true;

  if (shouldCache) {
    try {
      if (isShared) {
        await supabase
          .from("cache")
          .delete()
          .eq("cache_key", cacheKey)
          .is("user_id", null);

        const { error: insertError } = await supabase.from("cache").insert({
          cache_key: cacheKey,
          cache_type: cacheType,
          data: freshData,
          user_id: null,
          fetched_at: new Date().toISOString(),
          expires_at: new Date(Date.now() + ttlSeconds * 1000).toISOString(),
        });
        if (insertError) {
          console.warn(`[cache] shared insert failed for ${cacheKey}:`, insertError.message);
        }
      } else {
        const { error: upsertError } = await supabase.from("cache").upsert(
          {
            cache_key: cacheKey,
            cache_type: cacheType,
            data: freshData,
            user_id: userId,
            fetched_at: new Date().toISOString(),
            expires_at: new Date(Date.now() + ttlSeconds * 1000).toISOString(),
          },
          { onConflict: "user_id,cache_key" }
        );
        if (upsertError) {
          console.warn(`[cache] upsert failed for ${cacheKey}:`, upsertError.message);
        }
      }
    } catch (err) {
      console.warn(`[cache] upsert threw for ${cacheKey}:`, err instanceof Error ? err.message : err);
    }
  }

  return { data: freshData, fromCache: false };
}
