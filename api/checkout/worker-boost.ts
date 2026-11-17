import { appBaseUrl, requireWorker, stripe } from "../../src/lib/server/billing.js";

export function GET(): Response {
  return Response.json({ error: "Método no permitido." }, { status: 405 });
}

export async function POST(request: Request): Promise<Response> {
  try {
    const authorized = await requireWorker(request.headers.get("authorization"));
    if ("status" in authorized) {
      return Response.json({ error: authorized.error }, { status: authorized.status });
    }

    const userId = authorized.profile.id;
    const { data: card, error } = await authorized.admin.from("jobmatch_worker_cards")
      .select("id,is_active,is_demo,is_boosted,boost_expires_at")
      .eq("user_id", userId)
      .maybeSingle();
    if (error) throw error;
    if (!card || card.is_demo || !card.is_active) {
      return Response.json({ error: "Publica una ficha de trabajador activa antes de impulsarla." }, { status: 409 });
    }
    if (card.is_boosted && card.boost_expires_at && new Date(card.boost_expires_at).getTime() > Date.now()) {
      return Response.json({ error: "Tu perfil ya está impulsado." }, { status: 409 });
    }

    const base = appBaseUrl();
    const metadata = { kind: "worker_boost", user_id: userId, worker_card_id: card.id };
    const session = await stripe().checkout.sessions.create({
      mode: "payment",
      locale: "es",
      client_reference_id: userId,
      metadata,
      payment_intent_data: { metadata },
      line_items: [{ quantity: 1, price_data: {
        currency: "eur",
        unit_amount: 199,
        product_data: {
          name: "Impulso de perfil de trabajador",
          description: "Impulso de perfil de trabajador - 7 días",
        },
      } }],
      success_url: `${base}/?checkout=success&kind=worker_boost&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${base}/?checkout=cancel`,
    });
    if (!session.url) {
      return Response.json({ error: "Stripe no devolvió el enlace de pago." }, { status: 502 });
    }
    return Response.json({ url: session.url });
  } catch (error) {
    console.error("JobMatch worker boost checkout failed:", error);
    return Response.json({ error: error instanceof Error ? error.message : "No se pudo iniciar el pago." }, { status: 500 });
  }
}
