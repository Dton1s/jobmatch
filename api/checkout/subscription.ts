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

    const profile = authorized.profile;
    if (profile.is_pro && profile.pro_expires_at && new Date(profile.pro_expires_at).getTime() > Date.now()) {
      return Response.json({ error: "JobMatch Pro ya está activo en esta empresa." }, { status: 409 });
    }

    const { data: existing, error: subscriptionError } = await authorized.admin.from("jobmatch_subscriptions")
      .select("stripe_customer_id,status,stripe_subscription_id")
      .eq("company_id", profile.id).maybeSingle();
    if (subscriptionError) throw subscriptionError;
    if (existing?.stripe_subscription_id && ["active", "trialing", "past_due", "unpaid"].includes(existing.status)) {
      return Response.json({ error: "Ya existe una suscripción en curso. Revisa el estado de JobMatch Pro." }, { status: 409 });
    }

    const stripeApi = stripe();
    const proPriceId = process.env.STRIPE_PRO_PRICE_ID?.trim();
    if (!proPriceId || !/^price_[A-Za-z0-9]+$/.test(proPriceId)) {
      return Response.json({ error: "Falta configurar un STRIPE_PRO_PRICE_ID válido para JobMatch Pro." }, { status: 503 });
    }
    const proPrice = await stripeApi.prices.retrieve(proPriceId);
    if (!proPrice.active || proPrice.currency !== "eur" || proPrice.unit_amount !== 1999 || proPrice.recurring?.interval !== "month" || proPrice.recurring.interval_count !== 1) {
      return Response.json({ error: "STRIPE_PRO_PRICE_ID debe apuntar a un precio activo de 19,99 € por mes." }, { status: 503 });
    }

    const customer = existing?.stripe_customer_id
      ? await stripeApi.customers.retrieve(existing.stripe_customer_id)
      : await stripeApi.customers.create({ name: profile.company_name || "Empresa JobMatch", metadata: { company_id: profile.id } });
    if (customer.deleted) {
      return Response.json({ error: "No se pudo reutilizar el cliente de facturación." }, { status: 409 });
    }

    const { error: saveCustomerError } = await authorized.admin.from("jobmatch_subscriptions").upsert({
      company_id: profile.id,
      stripe_customer_id: customer.id,
      stripe_subscription_id: null,
      status: "incomplete",
      current_period_end: null,
      cancel_at_period_end: false,
      updated_at: new Date().toISOString(),
    }, { onConflict: "company_id" });
    if (saveCustomerError) throw saveCustomerError;

    const base = appBaseUrl();
    const session = await stripeApi.checkout.sessions.create({
      mode: "subscription",
      locale: "es",
      customer: customer.id,
      client_reference_id: profile.id,
      metadata: { kind: "subscription", company_id: profile.id },
      subscription_data: { metadata: { kind: "subscription", company_id: profile.id } },
      line_items: [{ quantity: 1, price: proPrice.id }],
      success_url: `${base}/?checkout=success&kind=subscription&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${base}/?checkout=cancel`,
    });
    if (!session.url) {
      return Response.json({ error: "Stripe no devolvió el enlace de pago." }, { status: 502 });
    }
    return Response.json({ url: session.url });
  } catch (error) {
    console.error("JobMatch Pro checkout failed:", error);
    return Response.json({ error: error instanceof Error ? error.message : "No se pudo iniciar el pago." }, { status: 500 });
  }
}
