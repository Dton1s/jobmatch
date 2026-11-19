import { audit, errorResponse, isAdminError, requireAdmin } from "../lib/admin.js";
export default async function handler(request: Request): Promise<Response> {
  if (request.method !== "GET") return Response.json({ error: "Método no permitido." }, { status: 405 });
  const auth = await requireAdmin(request); if (isAdminError(auth)) return auth.response;
  const params = new URL(request.url).searchParams; const type = params.get("type"); const id = params.get("id");
  if (!id || id.length > 80 || !["profile", "offer", "message"].includes(type ?? "")) return Response.json({ error: "Objetivo no válido." }, { status: 400 });
  const targetType = type as "profile" | "offer" | "message";
  try {
    let result;
    if (targetType === "profile") result = await auth.context.db.from("jobmatch_worker_cards").select("id,user_id,full_name,desired_position,sector,city,bio,is_active,created_at").eq("id", id).maybeSingle();
    else if (targetType === "offer") result = await auth.context.db.from("jobmatch_job_offers").select("id,company_id,business_name,position,sector,city,description,is_active,created_at").eq("id", id).maybeSingle();
    else result = await auth.context.db.from("jobmatch_messages").select("id,match_id,sender_id,body,message_type,created_at").eq("id", id).maybeSingle();
    if (result.error) throw result.error;
    await audit(auth.context, "target.inspect", targetType, id, "success", "Inspección explícita solicitada por el administrador.");
    return Response.json({ target: result.data }, { headers: { "Cache-Control": "no-store" } });
  } catch (cause) { return errorResponse(cause); }
}
