import { createHash } from "node:crypto";
import { GoogleAuth } from "google-auth-library";
import { GOOGLE_PLAY_PACKAGE_NAME, GOOGLE_PLAY_PRODUCTS } from "../../src/lib/google-play-products.js";
import { requireCompany, requireWorker } from "../../src/lib/server/billing.js";

type PlayProductPurchaseV2 = {
  purchaseStateContext?: { purchaseState?: string };
  productLineItem?: Array<{ productId?: string; productOfferDetails?: { purchaseOptionId?: string } }>;
  acknowledgementState?: number;
  obfuscatedExternalAccountId?: string;
};
type PlaySubscriptionPurchase = {
  subscriptionState?: string;
  externalAccountIdentifiers?: { obfuscatedExternalAccountId?: string };
  lineItems?: Array<{ productId?: string; expiryTime?: string; offerDetails?: { basePlanId?: string } }>;
};

function responseError(message: string, status: number): Response {
  return Response.json({ error: message }, { status });
}

async function playApiRequest<T>(url: string, method = "GET"): Promise<T> {
  const rawCredentials = process.env.GOOGLE_PLAY_SERVICE_ACCOUNT_JSON;
  if (!rawCredentials) throw new Error("Falta configurar GOOGLE_PLAY_SERVICE_ACCOUNT_JSON en Vercel.");
  let credentials: Record<string, unknown>;
  try { credentials = JSON.parse(rawCredentials) as Record<string, unknown>; }
  catch { throw new Error("GOOGLE_PLAY_SERVICE_ACCOUNT_JSON no contiene JSON válido."); }
  const auth = new GoogleAuth({ credentials, scopes: ["https://www.googleapis.com/auth/androidpublisher"] });
  const client = await auth.getClient();
  const result = await client.request<T>({ url, method, ...(method === "POST" ? { data: {} } : {}) });
  return result.data;
}

function googleAccountId(userId: string): string {
  return createHash("sha256").update(userId).digest("hex");
}

async function acknowledgeOrConsume(kind: string, productId: string, purchaseToken: string) {
  const base = `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${GOOGLE_PLAY_PACKAGE_NAME}/purchases`;
  const token = encodeURIComponent(purchaseToken);
  const product = encodeURIComponent(productId);
  const operation = kind === "pro" ? `subscriptions/${product}/tokens/${token}:acknowledge` : `products/${product}/tokens/${token}:consume`;
  await playApiRequest(`${base}/${operation}`, "POST");
}

export async function GET(): Promise<Response> {
  return responseError("Método no permitido.", 405);
}

export async function POST(request: Request): Promise<Response> {
  try {
    const body = await request.json().catch(() => null) as { kind?: unknown; purchase_token?: unknown; offer_id?: unknown } | null;
    const kind = body?.kind;
    const purchaseToken = typeof body?.purchase_token === "string" ? body.purchase_token : "";
    if (!purchaseToken || purchaseToken.length > 4096 || (kind !== "pro" && kind !== "offer_boost" && kind !== "worker_boost")) {
      return responseError("La compra recibida no es válida.", 400);
    }

    const authorized = kind === "worker_boost"
      ? await requireWorker(request.headers.get("authorization"))
      : await requireCompany(request.headers.get("authorization"));
    if ("status" in authorized) return responseError(authorized.error, authorized.status);
    const userId = authorized.profile.id;
    const expectedAccountId = googleAccountId(userId);
    const tokenHash = createHash("sha256").update(purchaseToken).digest("hex");
    let productId: string;
    let purchaseType: "subscription" | "offer_boost" | "worker_boost";
    let resourceId: string | null = null;
    let expiration: string | null = null;
    let subscriptionState: string | null = null;

    if (kind === "pro") {
      productId = GOOGLE_PLAY_PRODUCTS.pro.productId;
      purchaseType = "subscription";
      const purchase = await playApiRequest<PlaySubscriptionPurchase>(`https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${GOOGLE_PLAY_PACKAGE_NAME}/purchases/subscriptionsv2/tokens/${encodeURIComponent(purchaseToken)}`);
      const lineItem = purchase.lineItems?.find((item) => item.productId === productId && item.offerDetails?.basePlanId === GOOGLE_PLAY_PRODUCTS.pro.basePlanId);
      const accountId = purchase.externalAccountIdentifiers?.obfuscatedExternalAccountId;
      subscriptionState = purchase.subscriptionState ?? null;
      expiration = lineItem?.expiryTime ?? null;
      const entitledStates = new Set(["SUBSCRIPTION_STATE_ACTIVE", "SUBSCRIPTION_STATE_IN_GRACE_PERIOD", "SUBSCRIPTION_STATE_CANCELED"]);
      if (!lineItem || accountId !== expectedAccountId || !subscriptionState || !entitledStates.has(subscriptionState)
        || !expiration || new Date(expiration).getTime() <= Date.now()) {
        return responseError("Google Play no confirma una suscripción activa para esta cuenta.", 422);
      }
    } else {
      productId = kind === "offer_boost" ? GOOGLE_PLAY_PRODUCTS.offerBoost.productId : GOOGLE_PLAY_PRODUCTS.workerBoost.productId;
      purchaseType = kind;
      if (kind === "offer_boost") {
        const offerId = typeof body?.offer_id === "string" ? body.offer_id : "";
        if (!/^[0-9a-f-]{36}$/i.test(offerId)) return responseError("Selecciona una oferta válida.", 400);
        const { data: offer, error } = await authorized.admin.from("jobmatch_job_offers").select("id,is_active,is_demo,expires_at").eq("id", offerId).eq("company_id", userId).maybeSingle();
        if (error) throw error;
        if (!offer || offer.is_demo || !offer.is_active || new Date(offer.expires_at).getTime() <= Date.now()) return responseError("Solo puedes destacar una oferta propia activa y vigente.", 404);
        resourceId = offer.id;
      } else {
        const { data: card, error } = await authorized.admin.from("jobmatch_worker_cards").select("id,is_active,is_demo").eq("user_id", userId).maybeSingle();
        if (error) throw error;
        if (!card || !card.is_active || card.is_demo) return responseError("Publica una ficha activa para poder impulsarla.", 404);
        resourceId = card.id;
      }
      const purchase = await playApiRequest<PlayProductPurchaseV2>(`https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${GOOGLE_PLAY_PACKAGE_NAME}/purchases/productsv2/tokens/${encodeURIComponent(purchaseToken)}`);
      const expectedPurchaseOptionId = kind === "offer_boost"
        ? GOOGLE_PLAY_PRODUCTS.offerBoost.purchaseOptionId
        : GOOGLE_PLAY_PRODUCTS.workerBoost.purchaseOptionId;
      const lineItem = purchase.productLineItem?.find((item) => item.productId === productId
        && item.productOfferDetails?.purchaseOptionId === expectedPurchaseOptionId);
      if (purchase.purchaseStateContext?.purchaseState !== "PURCHASED" || !lineItem
        || purchase.obfuscatedExternalAccountId !== expectedAccountId) {
        return responseError("Google Play no confirma un pago completado para este producto, opción y cuenta.", 422);
      }
    }

    const { error } = await authorized.admin.rpc("jobmatch_apply_google_play_purchase", {
      p_purchase_token_hash: tokenHash,
      p_product_id: productId,
      p_purchase_type: purchaseType,
      p_user_id: userId,
      p_resource_id: resourceId,
      p_expiration: expiration,
      p_subscription_state: subscriptionState,
    });
    if (error) throw error;

    await acknowledgeOrConsume(String(kind), productId, purchaseToken);
    return Response.json({ verified: true });
  } catch (error) {
    console.error("Google Play purchase verification failed:", error);
    return responseError(error instanceof Error ? error.message : "No se pudo verificar la compra con Google Play.", 500);
  }
}
