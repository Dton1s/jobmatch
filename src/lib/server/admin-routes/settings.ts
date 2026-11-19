import { audit, errorResponse, isAdminError, parseBody, requireAdmin } from "../admin-auth.js";
const keys = new Set(["maintenance_notice", "info_banner", "feature_flags"]);
function validateValue(key: string, value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const input = value as Record<string, unknown>;
  if (key === "feature_flags") {
    if (Object.keys(input).length > 30 || Object.entries(input).some(([name, flag]) => !/^[a-z][a-z0-9_]{0,39}$/.test(name) || typeof flag !== "boolean")) return null;
    return input;
  }
  const enabled = input.enabled;
  const message = input.message;
  if (typeof enabled !== "boolean" || (message !== undefined && (typeof message !== "string" || message.length > 240 || /<\/?[a-z!]/i.test(message)))) return null;
  return { enabled, message: typeof message === "string" ? message.trim() : "" };
}
export default async function handler(request: Request): Promise<Response> {
  const auth = await requireAdmin(request); if (isAdminError(auth)) return auth.response;
  try {
    if (request.method === "GET") {
      const { data, error } = await auth.context.db.from("jobmatch_app_settings").select("key,value,updated_at,updated_by").order("key"); if (error) throw error;
      return Response.json({ settings: data ?? [] }, { headers: { "Cache-Control": "no-store" } });
    }
    if (request.method === "PUT") {
      const body = await parseBody(request, 5000); const key = typeof body?.key === "string" ? body.key : ""; const value = validateValue(key, body?.value);
      if (!keys.has(key) || !value) return Response.json({ error: "Ajuste no válido." }, { status: 400 });
      const { data, error } = await auth.context.db.from("jobmatch_app_settings").upsert({ key, value, updated_by: auth.context.userId, updated_at: new Date().toISOString() }).select("key,value,updated_at").single(); if (error) throw error;
      await audit(auth.context, "setting.update", "setting", key, "success", "Valor validado por lista permitida.");
      return Response.json({ setting: data }, { headers: { "Cache-Control": "no-store" } });
    }
    return Response.json({ error: "Método no permitido." }, { status: 405 });
  } catch (cause) { return errorResponse(cause); }
}
