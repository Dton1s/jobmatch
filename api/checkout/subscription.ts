import { appBaseUrl, requireCompany, stripe } from "../../src/lib/server/billing";
import { respondJson, type VercelApiRequest, type VercelApiResponse } from "../../src/lib/server/vercel";

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

    const profile = authorized.profile;
    if (profile.is_pro && profile.pro_expires_at && new Date(profile.pro_expires_at).getTime() > Date.now()) {
      respondJson(response, 409, { error: "JobMatch Pro ya está activo en esta empresa." });
      return;
    }

    const { data: existing, error: subscriptionError } = await authorized.admin.from("jobmatch_subscriptions")
      .select("stripe_customer_id,status,stripe_subscription_id")
      .eq("company_id", profile.id).maybeSingle();
    if (subscriptionError) throw subscriptionError;
    if (existing?.stripe_subscription_id && ["active", "trialing", "past_due", "unpaid"].includes(existing.status)) {
      respondJson(response, 409, { error: "Ya existe una suscripción en curso. Revisa el estado de JobMatch Pro." });
      return;
    }

    const stripeApi = stripe();
    const proPriceId = process.env.STRIPE_PRO_PRICE_ID?.trim();
    if (!proPriceId || !/^price_[A-Za-z0-9]+$/.test(proPriceId)) {
      respondJson(response, 503, { error: "Falta configurar un STRIPE_PRO_PRICE_ID válido para JobMatch Pro." });
      return;
    }
    const proPrice = await stripeApi.prices.retrieve(proPriceId);
    if (!proPrice.active || proPrice.currency !== "eur" || proPrice.unit_amount !== 1999 || proPrice.recurring?.interval !== "month" || proPrice.recurring.interval_count !== 1) {
      respondJson(response, 503, { error: "STRIPE_PRO_PRICE_ID debe apuntar a un precio activo de 19,99 € por mes." });
      return;
    }

    const customer = existing?.stripe_customer_id
      ? await stripeApi.customers.retrieve(existing.stripe_customer_id)
      : await stripeApi.customers.create({ name: profile.company_name || "Empresa JobMatch", metadata: { company_id: profile.id } });
    if (customer.deleted) {
      respondJson(response, 409, { error: "No se pudo reutilizar el cliente de facturación." });
      return;
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
      respondJson(response, 502, { error: "Stripe no devolvió el enlace de pago." });
      return;
    }
    respondJson(response, 200, { url: session.url });
  } catch (error) {
    console.error("JobMatch Pro checkout failed:", error);
    respondJson(response, 500, { error: error instanceof Error ? error.message : "No se pudo iniciar el pago." });
  }
}
