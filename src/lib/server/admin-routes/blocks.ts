import { errorResponse, isAdminError, requireAdmin } from "../admin-auth.js";
export default async function handler(request: Request): Promise<Response> {
  if (request.method !== "GET") return Response.json({ error: "Método no permitido." }, { status: 405 });
  const auth = await requireAdmin(request); if (isAdminError(auth)) return auth.response;
  const params = new URL(request.url).searchParams;
  const page = Math.max(0, Math.min(100000, Number(params.get("page") ?? 0) || 0));
  const limit = Math.max(1, Math.min(50, Number(params.get("limit") ?? 20) || 20));
  try {
    let query = auth.context.db.from("jobmatch_user_blocks").select("id,blocker_id,blocked_user_id,created_at", { count: "exact" }).order("created_at", { ascending: false }).range(page * limit, page * limit + limit - 1);
    const user = params.get("user"); const from = params.get("from"); const to = params.get("to");
    if (user && !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(user)) return Response.json({ error: "El UUID de filtro no es válido." }, { status: 400 });
    if (user) query = query.or(`blocker_id.eq.${user},blocked_user_id.eq.${user}`);
    if (from && Number.isFinite(Date.parse(from))) query = query.gte("created_at", new Date(from).toISOString());
    if (to && Number.isFinite(Date.parse(to))) query = query.lt("created_at", new Date(to).toISOString());
    const { data, count, error } = await query; if (error) throw error;
    return Response.json({ blocks: data ?? [], count: count ?? 0, page, limit }, { headers: { "Cache-Control": "no-store" } });
  } catch (cause) { return errorResponse(cause); }
}
