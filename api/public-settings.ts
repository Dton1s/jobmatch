import { createClient } from "@supabase/supabase-js";
export default async function handler(request: Request): Promise<Response> {
  if (request.method !== "GET") return Response.json({ error: "Método no permitido." }, { status: 405 });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL; const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !service) return Response.json({ settings: {} }, { headers: { "Cache-Control": "public, max-age=60" } });
  try {
    const db = createClient(url, service, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data, error } = await db.from("jobmatch_app_settings").select("key,value").in("key", ["maintenance_notice", "info_banner"]);
    if (error) throw error;
    const settings: Record<string, { enabled: boolean; message: string }> = {};
    for (const item of data ?? []) {
      const value = item.value as Record<string, unknown>;
      if (typeof value?.enabled === "boolean" && typeof value?.message === "string") settings[item.key] = { enabled: value.enabled, message: value.message.replace(/<[^>]*>/g, "").slice(0, 240) };
    }
    return Response.json({ settings }, { headers: { "Cache-Control": "public, max-age=60, stale-while-revalidate=60" } });
  } catch {
    return Response.json({ settings: {} }, { headers: { "Cache-Control": "public, max-age=30" } });
  }
}
