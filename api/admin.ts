import session from "../src/lib/server/admin-routes/session.js";
import metrics from "../src/lib/server/admin-routes/metrics.js";
import reports from "../src/lib/server/admin-routes/reports.js";
import blocks from "../src/lib/server/admin-routes/blocks.js";
import target from "../src/lib/server/admin-routes/target.js";
import action from "../src/lib/server/admin-routes/action.js";
import settings from "../src/lib/server/admin-routes/settings.js";

const handlers: Record<string, (request: Request) => Promise<Response>> = { session, metrics, reports, blocks, target, action, settings };

// One Vercel Function serves every admin operation via /api/admin?action=...
export default async function handler(request: Request): Promise<Response> {
  // Vercel may provide a relative URL (and may append its temporary share query).
  const actionName = new URL(request.url, "http://localhost").searchParams.get("action") ?? "";
  const route = handlers[actionName];
  if (!route) return Response.json({ error: "Ruta administrativa no encontrada." }, { status: 404 });
  return route(request);
}
