import { isAdminError, requireAdmin } from "../lib/admin.js";
export default async function handler(request: Request): Promise<Response> {
  if (request.method !== "GET") return Response.json({ error: "Método no permitido." }, { status: 405 });
  const result = await requireAdmin(request);
  if (isAdminError(result)) return result.response;
  return Response.json({ authorized: true, userId: result.context.userId }, { headers: { "Cache-Control": "no-store" } });
}
