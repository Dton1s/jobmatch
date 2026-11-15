import { appBaseUrl, json, requireCompany, stripe } from "../../src/lib/server/billing";

export default {
  async fetch(request: Request): Promise<Response> {
    if (request.method !== "POST") return json({ error: "Método no permitido." }, 405);
    try {
      const authorized = await requireCompany(request);
      if (authorized instanceof Response) return authorized;
      const profile = authorized.profile;
      if (profile.is_pro && profile.pro_expires_at && new Date(profile.pro_expires_at).getTime() > Date.now()) {
        return json({ error: "JobMatch Pro ya está activo en esta empresa." }, 409);
      }

      const { data: existing, error: subscriptionError } = await authorized.admin.from("jobmatch_subscriptions")
        .select("stripe_customer_id,status,stripe_subscription_id")
        .eq("company_id", profile.id).maybeSingle();
      if (subscriptionError) throw subscriptionError;
      if (existing?.stripe_subscription_id && ["active", "trialing", "past_due", "unpaid"].includes(existing.status)) {
        return json({ error: "Ya existe una suscripción en curso. Revisa el estado de JobMatch Pro." }, 409);
      }

      const stripeApi = stripe();
      const customer = existing?.stripe_customer_id
        ? await stripeApi.customers.retrieve(existing.stripe_customer_id)
        : await stripeApi.customers.create({ name: profile.company_name || "Empresa JobMatch", metadata: { company_id: profile.id } });
      if (customer.deleted) return json({ error: "No se pudo reutilizar el cliente de facturación." }, 409);

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
        line_items: [{ quantity: 1, price_data: {
          currency: "eur", unit_amount: 1999, recurring: { interval: "month" },
          product_data: { name: "JobMatch Pro", description: "Conversaciones directas con candidatos y herramientas Pro para empresas." },
        } }],
        success_url: `${base}/?checkout=success&kind=subscription&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${base}/?checkout=cancel`,
      });
      if (!session.url) return json({ error: "Stripe no devolvió el enlace de pago." }, 502);
      return json({ url: session.url });
    } catch (error) {
      console.error("JobMatch Pro checkout failed:", error);
      return json({ error: error instanceof Error ? error.message : "No se pudo iniciar el pago." }, 500);
    }
  },
};
