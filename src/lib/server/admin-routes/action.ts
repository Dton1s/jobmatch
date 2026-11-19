import { audit, errorResponse, isAdminError, parseBody, requireAdmin } from "../admin-auth.js";
export default async function handler(request: Request): Promise<Response> {
  if (request.method !== "POST") return Response.json({ error: "Método no permitido." }, { status: 405 });
  const auth = await requireAdmin(request); if (isAdminError(auth)) return auth.response;
  const body = await parseBody(request, 3000);
  if (!body || body.confirm !== true || typeof body.action !== "string" || typeof body.target_id !== "string" || body.target_id.length > 80) return Response.json({ error: "Confirma la acción y revisa el objetivo." }, { status: 400 });
  try {
    if (body.action === "deactivate_profile") {
      const { data, error } = await auth.context.db.from("jobmatch_worker_cards").update({ is_active: false }).eq("id", body.target_id).select("id").maybeSingle(); if (error) throw error; if (!data) return Response.json({ error: "Ficha no encontrada." }, { status: 404 });
    } else if (body.action === "deactivate_offer") {
      const { data, error } = await auth.context.db.from("jobmatch_job_offers").update({ is_active: false }).eq("id", body.target_id).select("id").maybeSingle(); if (error) throw error; if (!data) return Response.json({ error: "Oferta no encontrada." }, { status: 404 });
    } else if (body.action === "suspend_user" || body.action === "restore_user") {
      const ban_duration = body.action === "suspend_user" ? "876000h" : "none";
      const { data, error } = await auth.context.db.auth.admin.updateUserById(body.target_id, { ban_duration }); if (error) throw error; if (!data.user) return Response.json({ error: "Cuenta no encontrada." }, { status: 404 });
    } else return Response.json({ error: "Acción no válida." }, { status: 400 });
    await audit(auth.context, body.action, "target", body.target_id, "success", "Acción confirmada desde el panel.");
    return Response.json({ ok: true });
  } catch (cause) { return errorResponse(cause); }
}
