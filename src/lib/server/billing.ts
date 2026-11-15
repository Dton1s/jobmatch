import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import Stripe from "stripe";

type BillingProfile = {
  id: string;
  role: string | null;
  enabled_roles: string[] | null;
  company_name: string | null;
  is_pro: boolean;
  pro_expires_at: string | null;
};

let stripeClient: Stripe | null = null;
export function stripe(): Stripe {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) throw new Error("Falta configurar STRIPE_SECRET_KEY en Vercel.");
  stripeClient ??= new Stripe(secretKey);
  return stripeClient;
}

export function serviceSupabase(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en Vercel.");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

export async function requireCompany(authorizationHeader: string | null): Promise<{ admin: SupabaseClient; profile: BillingProfile } | { error: string; status: number }> {
  const authorization = authorizationHeader ?? "";
  const token = authorization.match(/^Bearer\s+(.+)$/i)?.[1];
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!token || !url || !anonKey) return { error: "Inicia sesión para continuar.", status: 401 };

  const authClient = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: authData, error: authError } = await authClient.auth.getUser(token);
  if (authError || !authData.user) return { error: "La sesión ha caducado. Vuelve a iniciar sesión.", status: 401 };

  const admin = serviceSupabase();
  const { data, error } = await admin.from("jobmatch_profiles")
    .select("id,role,enabled_roles,company_name,is_pro,pro_expires_at")
    .eq("id", authData.user.id)
    .maybeSingle();
  if (error) throw error;
  const profile = data as BillingProfile | null;
  if (!profile || profile.role !== "company" || !profile.enabled_roles?.includes("company")) {
    return { error: "Activa el modo Empresa para usar la facturación de JobMatch.", status: 403 };
  }
  return { admin, profile };
}

export function appBaseUrl(): string {
  const raw = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_BASE_URL || "https://jobmatch.nebuladigitalstudio.es";
  const parsed = new URL(raw);
  if (parsed.protocol !== "https:" && parsed.hostname !== "localhost") throw new Error("NEXT_PUBLIC_APP_URL debe usar HTTPS.");
  return parsed.origin;
}

export async function applyStripeEvent(args: {
  eventId: string;
  eventType: string;
  mode: "payment" | "subscription";
  companyId: string;
  offerId?: string | null;
  customerId?: string | null;
  subscriptionId?: string | null;
  subscriptionStatus?: string | null;
  periodEnd?: string | null;
  paymentStatus?: string | null;
  cancelAtPeriodEnd?: boolean;
}) {
  const admin = serviceSupabase();
  const { error } = await admin.rpc("jobmatch_process_stripe_event", {
    p_event_id: args.eventId,
    p_event_type: args.eventType,
    p_mode: args.mode,
    p_company_id: args.companyId,
    p_offer_id: args.offerId ?? null,
    p_customer_id: args.customerId ?? null,
    p_subscription_id: args.subscriptionId ?? null,
    p_subscription_status: args.subscriptionStatus ?? null,
    p_period_end: args.periodEnd ?? null,
    p_payment_status: args.paymentStatus ?? null,
    p_cancel_at_period_end: args.cancelAtPeriodEnd ?? false,
  });
  if (error) throw error;
}
