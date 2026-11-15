import { appBaseUrl, requireCompany, stripe } from "../../src/lib/server/billing.js";

export function GET(): Response {
  return Response.json({ error: "Método no permitido." }, { status: 405 });
}

export async function POST(request: Request): Promise<Response> {
  try {
    const authorized = await requireCompany(request.headers.get("authorization"));
    if ("status" in authorized) {
      return Response.json({ error: authorized.error }, { status: authorized.status });
    }

    const body = await request.json().catch(() => null) as { offer_id?: unknown } | null;
    const offerId = typeof body?.offer_id === "string" ? body.offer_id : "";
    if (!/^[0-9a-f-]{36}$/i.test(offerId)) {
      return Response.json({ error: "Selecciona una oferta válida." }, { status: 400 });
    }

    const { data: offer, error } = await authorized.admin.from("jobmatch_job_offers")
      .select("id,company_id,business_name,position,is_active,is_demo,is_boosted,boost_expires_at,expires_at")
      .eq("id", offerId).eq("company_id", authorized.profile.id).maybeSingle();
    if (error) throw error;
    if (!offer || offer.is_demo || !offer.is_active || new Date(offer.expires_at).getTime() <= Date.now()) {
      return Response.json({ error: "Solo puedes destacar una oferta propia activa y vigente." }, { status: 404 });
    }
    if (offer.is_boosted && offer.boost_expires_at && new Date(offer.boost_expires_at).getTime() > Date.now()) {
      return Response.json({ error: "Esta oferta ya está destacada." }, { status: 409 });
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
      return Response.json({ error: "Stripe no devolvió el enlace de pago." }, { status: 502 });
    }
    return Response.json({ url: session.url });
  } catch (error) {
    console.error("JobMatch Boost checkout failed:", error);
    return Response.json({ error: error instanceof Error ? error.message : "No se pudo iniciar el pago." }, { status: 500 });
  }
}
