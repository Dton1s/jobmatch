import { NativePurchases, PURCHASE_TYPE, type Product } from "@capgo/native-purchases";
import { supabase } from "@/lib/supabase";
import { GOOGLE_PLAY_PRODUCTS } from "@/lib/google-play-products";

export type GooglePlayPurchaseKind = "pro" | "offer_boost" | "worker_boost";
const pendingContextKey = "jobmatch.google-play-pending-purchase";
type ProductType = typeof PURCHASE_TYPE[keyof typeof PURCHASE_TYPE];
const PRODUCT_CACHE_TTL_MS = 60_000;
const PRODUCT_RETRY_DELAY_MS = 2_000;
const productCatalogs = new Map<ProductType, { products: Product[]; loadedAt: number }>();
const productCatalogRequests = new Map<ProductType, Promise<Product[]>>();

function productConfig(kind: GooglePlayPurchaseKind) {
  return GOOGLE_PLAY_PRODUCTS[kind === "pro" ? "pro" : kind === "offer_boost" ? "offerBoost" : "workerBoost"];
}

function findProduct(kind: GooglePlayPurchaseKind, products: Product[]): Product | undefined {
  const config = productConfig(kind);
  // The installed Capacitor plugin exposes the backward-compatible one-time option only.
  return kind === "pro"
    ? products.find((item) => item.planIdentifier === config.productId && item.identifier === GOOGLE_PLAY_PRODUCTS.pro.basePlanId)
    : products.find((item) => item.identifier === config.productId);
}

export function getCachedGooglePlayProduct(kind: GooglePlayPurchaseKind): Product | null {
  const type = kind === "pro" ? PURCHASE_TYPE.SUBS : PURCHASE_TYPE.INAPP;
  return findProduct(kind, productCatalogs.get(type)?.products ?? []) ?? null;
}

async function queryProductCatalog(type: ProductType, forceRefresh = false): Promise<Product[]> {
  const cached = productCatalogs.get(type);
  if (!forceRefresh && cached && Date.now() - cached.loadedAt < PRODUCT_CACHE_TTL_MS) return cached.products;
  const pending = productCatalogRequests.get(type);
  if (pending) return pending;

  const productIdentifiers = type === PURCHASE_TYPE.SUBS
    ? [GOOGLE_PLAY_PRODUCTS.pro.productId]
    : [GOOGLE_PLAY_PRODUCTS.offerBoost.productId, GOOGLE_PLAY_PRODUCTS.workerBoost.productId];
  const request = (async () => {
    let { products } = await NativePurchases.getProducts({ productIdentifiers, productType: type });
    if (!products.length) {
      await new Promise((resolve) => window.setTimeout(resolve, PRODUCT_RETRY_DELAY_MS));
      ({ products } = await NativePurchases.getProducts({ productIdentifiers, productType: type }));
    }
    if (products.length) productCatalogs.set(type, { products, loadedAt: Date.now() });
    else productCatalogs.delete(type);
    return products;
  })();
  productCatalogRequests.set(type, request);
  try { return await request; }
  finally { if (productCatalogRequests.get(type) === request) productCatalogRequests.delete(type); }
}

export async function getGooglePlayProduct(kind: GooglePlayPurchaseKind, forceRefresh = false): Promise<Product> {
  const type = kind === "pro" ? PURCHASE_TYPE.SUBS : PURCHASE_TYPE.INAPP;
  const products = await queryProductCatalog(type, forceRefresh);
  let match = findProduct(kind, products);
  if (!match && products.length) {
    await new Promise((resolve) => window.setTimeout(resolve, PRODUCT_RETRY_DELAY_MS));
    match = findProduct(kind, await queryProductCatalog(type, true));
  }
  if (!match) throw new Error("Este producto todavía no está disponible en Google Play. Comprueba que esté activo en Play Console y vuelve a intentarlo.");
  return match;
}

export async function purchaseWithGooglePlay(kind: GooglePlayPurchaseKind, userId: string, offerId?: string): Promise<void> {
  if (!supabase) throw new Error("No se pudo conectar con la cuenta.");
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  const accessToken = data.session?.access_token;
  if (!accessToken) throw new Error("Inicia sesión de nuevo para continuar.");

  const product = await getGooglePlayProduct(kind);
  const accountToken = await obfuscateAccountId(userId);
  if (typeof window !== "undefined") window.localStorage.setItem(pendingContextKey, JSON.stringify({ kind, offerId }));
  let transaction;
  try {
    transaction = await NativePurchases.purchaseProduct({
      productIdentifier: kind === "pro" ? product.planIdentifier! : product.identifier,
      productType: kind === "pro" ? PURCHASE_TYPE.SUBS : PURCHASE_TYPE.INAPP,
      ...(kind === "pro" ? { planIdentifier: GOOGLE_PLAY_PRODUCTS.pro.basePlanId } : { isConsumable: true }),
      appAccountToken: accountToken,
      autoAcknowledgePurchases: false,
    });
  } catch (error) {
    const code = error && typeof error === "object" && "code" in error ? String(error.code) : "";
    if (code !== "PENDING" && typeof window !== "undefined") window.localStorage.removeItem(pendingContextKey);
    throw error;
  }
  if (!transaction.purchaseToken || transaction.purchaseState !== "1") {
    throw new Error("Google Play aún no ha confirmado el pago. Si está pendiente, el beneficio se activará cuando se complete.");
  }

  const response = await fetch("/api/google-play/verify-purchase", {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ kind, purchase_token: transaction.purchaseToken, offer_id: offerId }),
  });
  const result = await response.json().catch(() => ({})) as { error?: string };
  if (!response.ok) throw new Error(result.error || "No se pudo validar la compra con Google Play.");
  if (typeof window !== "undefined") window.localStorage.removeItem(pendingContextKey);
}

export async function syncGooglePlaySubscription(userId: string): Promise<void> {
  if (!supabase) return;
  const { data } = await supabase.auth.getSession();
  const accessToken = data.session?.access_token;
  if (!accessToken) return;
  const accountToken = await obfuscateAccountId(userId);
  const { purchases } = await NativePurchases.getPurchases({ productType: PURCHASE_TYPE.SUBS, appAccountToken: accountToken });
  let verifiedPro = false;
  for (const purchase of purchases) {
    if (purchase.productIdentifier !== GOOGLE_PLAY_PRODUCTS.pro.productId || !purchase.purchaseToken || purchase.purchaseState !== "1") continue;
    const response = await fetch("/api/google-play/verify-purchase", {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ kind: "pro", purchase_token: purchase.purchaseToken }),
    });
    verifiedPro ||= response.ok;
  }

  const pending = readPendingPurchaseContext();
  if (pending?.kind === "pro" && verifiedPro && typeof window !== "undefined") window.localStorage.removeItem(pendingContextKey);
  if (!pending || pending.kind === "pro") return;
  const { purchases: oneTimePurchases } = await NativePurchases.getPurchases({ productType: PURCHASE_TYPE.INAPP, appAccountToken: accountToken });
  const expectedProductId = pending.kind === "offer_boost" ? GOOGLE_PLAY_PRODUCTS.offerBoost.productId : GOOGLE_PLAY_PRODUCTS.workerBoost.productId;
  const transaction = oneTimePurchases.find((purchase) => purchase.productIdentifier === expectedProductId && purchase.purchaseState === "1" && purchase.purchaseToken);
  if (!transaction?.purchaseToken || (pending.kind === "offer_boost" && !pending.offerId)) return;
  const response = await fetch("/api/google-play/verify-purchase", {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ kind: pending.kind, purchase_token: transaction.purchaseToken, offer_id: pending.offerId }),
  });
  if (response.ok && typeof window !== "undefined") window.localStorage.removeItem(pendingContextKey);
}

function readPendingPurchaseContext(): { kind: GooglePlayPurchaseKind; offerId?: string } | null {
  if (typeof window === "undefined") return null;
  try {
    const parsed = JSON.parse(window.localStorage.getItem(pendingContextKey) || "null") as { kind?: unknown; offerId?: unknown } | null;
    if (!parsed || (parsed.kind !== "pro" && parsed.kind !== "offer_boost" && parsed.kind !== "worker_boost")) return null;
    return { kind: parsed.kind, ...(typeof parsed.offerId === "string" ? { offerId: parsed.offerId } : {}) };
  } catch { return null; }
}

async function obfuscateAccountId(userId: string): Promise<string> {
  const bytes = new TextEncoder().encode(userId);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}
