import type { SupabaseClient } from "@supabase/supabase-js";
import { audit, errorResponse, isAdminError, requireAdmin } from "../admin-auth.js";

type TargetType = "profile" | "offer" | "message";

async function loadIdentity(db: SupabaseClient, userId: string | null) {
  if (!userId) return null;
  const { data: profile, error } = await db.from("jobmatch_profiles")
    .select("id,role,display_name,full_name,company_name")
    .eq("id", userId)
    .maybeSingle();
  if (error) throw error;
  const { data: authData } = await db.auth.admin.getUserById(userId);
  const role = profile?.role === "worker" || profile?.role === "company" ? profile.role : null;
  const name = role === "company"
    ? profile?.company_name || profile?.display_name || profile?.full_name
    : profile?.full_name || profile?.display_name || profile?.company_name;
  return { id: userId, role, name: name || null, email: authData.user?.email ?? null };
}

export default async function handler(request: Request): Promise<Response> {
  if (request.method !== "GET") return Response.json({ error: "Método no permitido." }, { status: 405 });
  const auth = await requireAdmin(request); if (isAdminError(auth)) return auth.response;
  const reportId = new URL(request.url).searchParams.get("report_id");
  if (!reportId || reportId.length > 80) return Response.json({ error: "Denuncia no válida." }, { status: 400 });

  try {
    const { data: report, error: reportError } = await auth.context.db.from("jobmatch_user_reports")
      .select("id,reporter_id,reported_user_id,target_type,target_id,reason,details,review_status,reviewed_at,moderation_notes,created_at")
      .eq("id", reportId)
      .maybeSingle();
    if (reportError) throw reportError;
    if (!report) return Response.json({ error: "Denuncia no encontrada." }, { status: 404, headers: { "Cache-Control": "no-store" } });

    const targetType = report.target_type as TargetType;
    let target: Record<string, unknown> | null = null;
    if (targetType === "profile") {
      const { data, error } = await auth.context.db.from("jobmatch_worker_cards")
        .select("id,user_id,full_name,desired_position,sector,city,bio,experience_years,availability,availability_note,education_level,languages,skills,is_active,created_at")
        .eq("id", report.target_id).maybeSingle();
      if (error && error.code !== "PGRST116") throw error;
      target = data as Record<string, unknown> | null;
    } else if (targetType === "offer") {
      const { data, error } = await auth.context.db.from("jobmatch_job_offers")
        .select("id,company_id,business_name,position,sector,city,salary_text,shift_type,schedule,description,is_active,created_at")
        .eq("id", report.target_id).maybeSingle();
      if (error && error.code !== "PGRST116") throw error;
      target = data as Record<string, unknown> | null;
    } else if (targetType === "message") {
      const { data, error } = await auth.context.db.from("jobmatch_messages")
        .select("id,match_id,sender_id,body,message_type,created_at")
        .eq("id", report.target_id).maybeSingle();
      if (error && error.code !== "PGRST116") throw error;
      target = data as Record<string, unknown> | null;
    } else {
      return Response.json({ error: "Tipo de denuncia no válido." }, { status: 400 });
    }

    const ownerId = targetType === "profile"
      ? typeof target?.user_id === "string" ? target.user_id : null
      : targetType === "offer"
        ? typeof target?.company_id === "string" ? target.company_id : null
        : typeof target?.sender_id === "string" ? target.sender_id : null;
    const [reporter, reportedUser] = await Promise.all([
      loadIdentity(auth.context.db, report.reporter_id),
      loadIdentity(auth.context.db, report.reported_user_id ?? ownerId),
    ]);

    let contextMessages: Array<Record<string, unknown>> = [];
    if (targetType === "message" && target && typeof target.match_id === "string" && typeof target.created_at === "string") {
      const { data: previousMessages, error: messagesError } = await auth.context.db.from("jobmatch_messages")
        .select("id,sender_id,body,message_type,created_at")
        .eq("match_id", target.match_id)
        .lt("created_at", target.created_at)
        .order("created_at", { ascending: false })
        .limit(3);
      if (!messagesError) contextMessages = (previousMessages ?? []).reverse();
    }

    await audit(auth.context, "target.inspect", targetType, report.target_id, "success", target
      ? "Inspección de denuncia y contenido solicitada por el administrador."
      : "Denuncia inspeccionada; el contenido denunciado ya no existe.");
    return Response.json({
      report,
      target: target ?? null,
      notFound: !target,
      reporter,
      reportedUser,
      contextMessages,
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (cause) { return errorResponse(cause); }
}
