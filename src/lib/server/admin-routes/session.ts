import { isAdminError, requireAdmin } from "../admin-auth.js";
export default async function handler(request: Request): Promise<Response> {
  if (request.method !== "GET") return Response.json({ error: "Método no permitido." }, { status: 405 });
  const result = await requireAdmin(request, { allowAal1Session: true });
  if (isAdminError(result)) return result.response;
  if ("totpRequired" in result) return Response.json({ authorized: false, totpRequired: true, ...result.totpRequired }, { headers: { "Cache-Control": "no-store" } });
  return Response.json({ authorized: true, totpRequired: false, userId: result.context.userId, email: result.context.email }, { headers: { "Cache-Control": "no-store" } });
}
