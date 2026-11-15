import Stripe from "stripe";
import { applyStripeEvent, serviceSupabase, stripe } from "../../src/lib/server/billing";
import { readRawBody, respondJson, type VercelApiRequest, type VercelApiResponse } from "../../src/lib/server/vercel";

export const config = { api: { bodyParser: false } };

async function syncSubscription(eventId: string, eventType: string, subscription: Stripe.Subscription, customerId?: string | null) {
  const companyId = subscription.metadata?.company_id;
  if (!companyId) throw new Error("Stripe subscription is missing company_id metadata.");
  const periodEnd = Math.max(0, ...subscription.items.data.map((item) => item.current_period_end));
  if (!periodEnd) throw new Error("Stripe subscription has no billing period end.");
  await applyStripeEvent({
    eventId, eventType, mode: "subscription", companyId,
    customerId: customerId ?? (typeof subscription.customer === "string" ? subscription.customer : subscription.customer.id),
    subscriptionId: subscription.id,
    subscriptionStatus: subscription.status,
    periodEnd: new Date(periodEnd * 1000).toISOString(),
    cancelAtPeriodEnd: subscription.cancel_at_period_end,
  });
}

export default async function handler(request: VercelApiRequest, response: VercelApiResponse): Promise<void> {
  if (request.method !== "POST") {
    respondJson(response, 405, { error: "Método no permitido." });
    return;
  }

  const signature = Array.isArray(request.headers["stripe-signature"])
    ? request.headers["stripe-signature"]?.[0]
    : request.headers["stripe-signature"];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!signature || !webhookSecret) {
    respondJson(response, 400, { error: "Webhook de Stripe no configurado." });
    return;
  }

  let event: Stripe.Event;
  try {
    event = stripe().webhooks.constructEvent(await readRawBody(request), signature, webhookSecret);
  } catch (error) {
    console.error("Invalid Stripe webhook signature:", error);
    respondJson(response, 400, { error: "Firma de Stripe no válida." });
    return;
  }

  try {
    if (event.type === "checkout.session.completed" || event.type === "checkout.session.async_payment_succeeded") {
      const session = event.data.object as Stripe.Checkout.Session;
      if (session.metadata?.kind === "boost") {
        if (session.payment_status !== "paid") {
          respondJson(response, 200, { received: true });
          return;
        }
        await applyStripeEvent({
          eventId: event.id, eventType: event.type, mode: "payment",
          companyId: session.metadata.company_id, offerId: session.metadata.offer_id,
          customerId: typeof session.customer === "string" ? session.customer : session.customer?.id,
          paymentStatus: session.payment_status,
        });
      } else if (session.metadata?.kind === "subscription" && session.subscription) {
        const subscription = await stripe().subscriptions.retrieve(typeof session.subscription === "string" ? session.subscription : session.subscription.id);
        await syncSubscription(event.id, event.type, subscription, typeof session.customer === "string" ? session.customer : session.customer?.id);
      }
    } else if (event.type.startsWith("customer.subscription.")) {
      await syncSubscription(event.id, event.type, event.data.object as Stripe.Subscription);
    } else if (event.type === "invoice.paid" || event.type === "invoice.payment_failed") {
      const invoice = event.data.object as Stripe.Invoice & { subscription?: string | Stripe.Subscription | null; parent?: { subscription_details?: { subscription?: string | null } | null } | null };
      const subscriptionId = typeof invoice.subscription === "string" ? invoice.subscription
        : invoice.subscription?.id ?? invoice.parent?.subscription_details?.subscription;
      if (subscriptionId) {
        const subscription = await stripe().subscriptions.retrieve(subscriptionId);
        await syncSubscription(event.id, event.type, subscription, typeof invoice.customer === "string" ? invoice.customer : invoice.customer?.id);
      }
    } else {
      const { error } = await serviceSupabase().rpc("jobmatch_process_stripe_event", {
        p_event_id: event.id, p_event_type: event.type, p_mode: "ignored",
        p_company_id: null, p_offer_id: null, p_customer_id: null, p_subscription_id: null,
        p_subscription_status: null, p_period_end: null, p_payment_status: null, p_cancel_at_period_end: false,
      });
      if (error) throw error;
    }
    respondJson(response, 200, { received: true });
  } catch (error) {
    console.error("Stripe webhook processing failed:", error);
    respondJson(response, 500, { error: "No se pudo procesar el evento de Stripe." });
  }
}
