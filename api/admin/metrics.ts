import { errorResponse, isAdminError, requireAdmin } from "../lib/admin.js";
export default async function handler(request: Request): Promise<Response> {
  if (request.method !== "GET") return Response.json({ error: "Método no permitido." }, { status: 405 });
  const result = await requireAdmin(request);
  if (isAdminError(result)) return result.response;
  const now = new Date();
  const to = new Date(request.url ? new URL(request.url).searchParams.get("to") ?? now.toISOString() : now.toISOString());
  const fromParam = request.url ? new URL(request.url).searchParams.get("from") : null;
  const from = new Date(fromParam ?? new Date(now.getTime() - 30 * 86400000).toISOString());
  if (!Number.isFinite(+from) || !Number.isFinite(+to) || +from >= +to || +to - +from > 366 * 86400000) return Response.json({ error: "Rango no válido (máximo 366 días)." }, { status: 400 });
  try {
    const { data, error } = await result.context.db.rpc("jobmatch_admin_dashboard_metrics", { p_from: from.toISOString(), p_to: to.toISOString() });
    if (error) throw error;
    return Response.json(data, { headers: { "Cache-Control": "no-store" } });
  } catch (cause) { return errorResponse(cause); }
}
