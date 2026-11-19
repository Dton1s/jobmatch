import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { isAdminIdAllowed, parseAdminIds } from "./admin-policy.mjs";

export type AdminContext = { userId: string; email: string | null; db: SupabaseClient };
export type AdminAuthResult = { context: AdminContext } | { response: Response } | { totpRequired: { userId: string; email: string | null } };
type AdminReadyResult = { context: AdminContext } | { response: Response };
type AdminSessionResult = AdminReadyResult | { totpRequired: { userId: string; email: string | null } };
const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { "Cache-Control": "no-store" } });

export function requireAdmin(request: Request, options: { allowAal1Session: true }): Promise<AdminSessionResult>;
export function requireAdmin(request: Request, options?: { allowAal1Session?: false }): Promise<AdminReadyResult>;
export async function requireAdmin(request: Request, options: { allowAal1Session?: boolean } = {}): Promise<AdminAuthResult> {
  const bearer = request.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1];
  const allowedIds = parseAdminIds(process.env.JOBMATCH_ADMIN_USER_IDS);
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!bearer || !url || !anon) return { response: json({ error: "Sesión no válida." }, 401) };
  if (allowedIds.length === 0) return { response: json({ error: "Cuenta no autorizada." }, 403) };
  try {
    const auth = createClient(url, anon, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data, error } = await auth.auth.getUser(bearer);
    const userId = data.user?.id.toLowerCase();
    if (error || !userId) return { response: json({ error: "Sesión no válida." }, 401) };
    if (!isAdminIdAllowed(userId, allowedIds)) return { response: json({ error: "Cuenta no autorizada." }, 403) };
    const tokenPayload = JSON.parse(Buffer.from(bearer.split(".")[1] ?? "", "base64url").toString("utf8")) as { aal?: string };
    if (tokenPayload.aal !== "aal2") {
      if (options.allowAal1Session) return { totpRequired: { userId, email: data.user.email ?? null } };
      return { response: json({ error: "Verifica TOTP para continuar." }, 403) };
    }
    if (!service) return { response: json({ error: "Panel administrativo sin configurar." }, 503) };
    const db = createClient(url, service, { auth: { persistSession: false, autoRefreshToken: false } });
    return { context: { userId, email: data.user.email ?? null, db } };
  } catch {
    return { response: json({ error: "No se pudo validar el acceso." }, 401) };
  }
}

export function isAdminError(result: AdminAuthResult): result is { response: Response } { return "response" in result; }
export async function parseBody(request: Request, maxBytes = 12000): Promise<Record<string, unknown> | null> {
  const raw = await request.text();
  if (raw.length > maxBytes) return null;
  try { const value: unknown = JSON.parse(raw); return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null; }
  catch { return null; }
}
export async function audit(ctx: AdminContext, action: string, targetType: string, targetId: string | null, result: "success" | "denied" | "error", notes?: string) {
  const safeNotes = notes?.replace(/[\r\n\t]/g, " ").replace(/\b(?:eyJ[a-zA-Z0-9_-]{10,}|sk_live_[^\s]+|whsec_[^\s]+)\b/g, "[redacted]").slice(0, 500) ?? null;
  await ctx.db.rpc("jobmatch_admin_audit_append", { p_admin_user_id: ctx.userId, p_action: action.slice(0, 80), p_target_type: targetType.slice(0, 40), p_target_id: targetId?.slice(0, 120) ?? null, p_result: result, p_notes: safeNotes });
}
export function errorResponse(error: unknown, status = 500) {
  const message = error instanceof Error ? error.message : "Error interno.";
  return json({ error: message.slice(0, 300) }, status);
}
