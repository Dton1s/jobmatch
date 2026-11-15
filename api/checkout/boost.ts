import { appBaseUrl, requireCompany, stripe } from "../../src/lib/server/billing";
import { parsedBody, respondJson, type VercelApiRequest, type VercelApiResponse } from "../../src/lib/server/vercel";

export default async function handler(request: VercelApiRequest, response: VercelApiResponse): Promise<void> {
  if (request.method !== "POST") {
    respondJson(response, 405, { error: "Método no permitido." });
    return;
  }

  try {
    const authorization = Array.isArray(request.headers.authorization)
      ? request.headers.authorization[0] ?? null
      : request.headers.authorization ?? null;
    const authorized = await requireCompany(authorization);
    if ("status" in authorized) {
      respondJson(response, authorized.status, { error: authorized.error });
      return;
    }

    const body = parsedBody(request) as { offer_id?: unknown } | null;
    const offerId = typeof body?.offer_id === "string" ? body.offer_id : "";
    if (!/^[0-9a-f-]{36}$/i.test(offerId)) {
      respondJson(response, 400, { error: "Selecciona una oferta válida." });
      return;
    }

    const { data: offer, error } = await authorized.admin.from("jobmatch_job_offers")
      .select("id,company_id,business_name,position,is_active,is_demo,is_boosted,boost_expires_at,expires_at")
      .eq("id", offerId).eq("company_id", authorized.profile.id).maybeSingle();
    if (error) throw error;
    if (!offer || offer.is_demo || !offer.is_active || new Date(offer.expires_at).getTime() <= Date.now()) {
      respondJson(response, 404, { error: "Solo puedes destacar una oferta propia activa y vigente." });
      return;
    }
    if (offer.is_boosted && offer.boost_expires_at && new Date(offer.boost_expires_at).getTime() > Date.now()) {
      respondJson(response, 409, { error: "Esta oferta ya está destacada." });
      return;
    }

    const base = appBaseUrl();
    const session = await stripe().checkout.sessions.create({
      mode: "payment",
      locale: "es",
      client_reference_id: authorized.profile.id,
      metadata: { kind: "boost", company_id: authorized.profile.id, offer_id: offer.id },
      payment_intent_data: { metadata: { kind: "boost", company_id: authorized.profile.id, offer_id: offer.id } },
      line_items: [{ quantity: 1, price_data: {
        currency: "eur", unit_amount: 799,
        product_data: { name: `Boost de oferta · ${offer.position}`, description: `Destaca ${offer.business_name} durante 7 días en JobMatch.` },
      } }],
      success_url: `${base}/?checkout=success&kind=boost&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${base}/?checkout=cancel`,
    });
    if (!session.url) {
      respondJson(response, 502, { error: "Stripe no devolvió el enlace de pago." });
      return;
    }
    respondJson(response, 200, { url: session.url });
  } catch (error) {
    console.error("JobMatch Boost checkout failed:", error);
    respondJson(response, 500, { error: error instanceof Error ? error.message : "No se pudo iniciar el pago." });
  }
}
