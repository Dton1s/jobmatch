import { audit, errorResponse, isAdminError, parseBody, requireAdmin } from "../admin-auth.js";
const statuses = new Set(["pending", "reviewing", "resolved", "dismissed"]);
const types = new Set(["profile", "offer", "message"]);
export default async function handler(request: Request): Promise<Response> {
  const auth = await requireAdmin(request);
  if (isAdminError(auth)) return auth.response;
  try {
    if (request.method === "GET") {
      const params = new URL(request.url).searchParams;
      const page = Math.max(0, Math.min(100000, Number(params.get("page") ?? 0) || 0));
      const limit = Math.max(1, Math.min(50, Number(params.get("limit") ?? 20) || 20));
      const status = params.get("status"); const type = params.get("type"); const reason = params.get("reason");
      if (status && !statuses.has(status)) return Response.json({ error: "Estado no válido." }, { status: 400 });
      if (type && !types.has(type)) return Response.json({ error: "Tipo no válido." }, { status: 400 });
      const from = params.get("from"); const to = params.get("to");
      let query = auth.context.db.from("jobmatch_user_reports").select("id,reporter_id,reported_user_id,target_type,target_id,reason,details,review_status,reviewed_at,moderation_notes,created_at", { count: "exact" }).order("created_at", { ascending: false }).range(page * limit, page * limit + limit - 1);
      if (status) query = query.eq("review_status", status);
      if (type) query = query.eq("target_type", type);
      if (reason) query = query.eq("reason", reason.slice(0, 100));
      if (from && Number.isFinite(Date.parse(from))) query = query.gte("created_at", new Date(from).toISOString());
      if (to && Number.isFinite(Date.parse(to))) query = query.lt("created_at", new Date(to).toISOString());
      const { data, count, error } = await query;
      if (error) throw error;
      return Response.json({ reports: data ?? [], count: count ?? 0, page, limit }, { headers: { "Cache-Control": "no-store" } });
    }
    if (request.method === "PATCH") {
      const body = await parseBody(request, 5000); if (!body || typeof body.id !== "string" || typeof body.review_status !== "string" || !statuses.has(body.review_status)) return Response.json({ error: "Datos de moderación no válidos." }, { status: 400 });
      const moderationNotes = typeof body.moderation_notes === "string" ? body.moderation_notes.replace(/[\u0000-\u001f]/g, " ").slice(0, 2000) : null;
      const { data, error } = await auth.context.db.from("jobmatch_user_reports").update({ review_status: body.review_status, moderation_notes: moderationNotes, reviewed_at: new Date().toISOString() }).eq("id", body.id).select("id,review_status,reviewed_at,moderation_notes").maybeSingle();
      if (error) throw error; if (!data) return Response.json({ error: "Denuncia no encontrada." }, { status: 404 });
      await audit(auth.context, "report.update", "report", body.id, "success", `status=${body.review_status}`);
      return Response.json({ report: data }, { headers: { "Cache-Control": "no-store" } });
    }
    return Response.json({ error: "Método no permitido." }, { status: 405 });
  } catch (cause) { return errorResponse(cause); }
}
