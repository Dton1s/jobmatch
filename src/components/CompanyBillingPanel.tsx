"use client";

import { useEffect, useState } from "react";
import { App } from "@capacitor/app";
import { BadgeCheck, BriefcaseBusiness, Crown } from "lucide-react";
import { supabase, type JobOffer, type Profile } from "@/lib/supabase";
import { getPaymentChannel } from "@/lib/platform";
import { getCachedGooglePlayProduct, getGooglePlayProduct, openGooglePlaySubscriptionManagement, purchaseWithGooglePlay } from "@/lib/native-billing";
import type { Product } from "@capgo/native-purchases";

export function CompanyBillingPanel({ profile, onError, onPurchased }: { profile: Profile; onError: (message: string) => void; onPurchased: () => void }) {
  const [busy, setBusy] = useState("");
  const [playProduct, setPlayProduct] = useState<Product | null>(() => getCachedGooglePlayProduct("pro"));
  const [playProductMissing, setPlayProductMissing] = useState(false);
  const activePro = Boolean(profile.is_pro && profile.pro_expires_at && new Date(profile.pro_expires_at).getTime() > Date.now());
  const native = getPaymentChannel() === "google_play";

  useEffect(() => {
    if (!native) return;
    let active = true;
    const refresh = async (forceRefresh = false) => {
      try { const product = await getGooglePlayProduct("pro", forceRefresh); if (active) { setPlayProduct(product); setPlayProductMissing(false); } }
      catch { if (active && !getCachedGooglePlayProduct("pro")) { setPlayProductMissing(true); } }
    };
    void refresh();
    const listener = App.addListener("appStateChange", ({ isActive }) => { if (isActive) void refresh(true); });
    return () => { active = false; void listener.then((handle) => handle.remove()); };
  }, [native]);

  async function startNativePurchase() {
    if (busy) return;
    setBusy("pro"); onError("");
    try {
      if (!playProduct) { setPlayProduct(await getGooglePlayProduct("pro", true)); setPlayProductMissing(false); return; }
      await purchaseWithGooglePlay("pro", profile.id); onPurchased();
    }
    catch (cause) { onError(cause instanceof Error ? cause.message : "No se pudo completar la compra con Google Play."); }
    finally { setBusy(""); }
  }

  async function checkout(endpoint: string, body: Record<string, string>, key: string) {
    if (getPaymentChannel() === "google_play") { void startNativePurchase(); return; }
    if (!supabase || busy) return;
    setBusy(key); onError("");
    try {
      const { data, error } = await supabase.auth.getSession();
      if (error) throw error;
      const token = data.session?.access_token;
      if (!token) throw new Error("Inicia sesión de nuevo para continuar.");
      const response = await fetch(endpoint, { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const responseText = await response.text();
      let result: { url?: string; error?: string };
      try {
        result = JSON.parse(responseText) as { url?: string; error?: string };
      } catch {
        throw new Error(response.ok ? "El servidor devolvió una respuesta no válida." : `Error ${response.status}: no se pudo iniciar el pago. Inténtalo de nuevo.`);
      }
      if (!response.ok || !result.url) throw new Error(result.error || "No se pudo abrir el pago.");
      window.location.assign(result.url);
    } catch (cause) {
      onError(cause instanceof Error ? cause.message : "No se pudo iniciar el pago.");
      setBusy("");
    }
  }

  return <section className="billing-panel">
    <div className="billing-pro-card">
      <div className="billing-card-heading"><span className="billing-icon"><Crown size={18}/></span><div><b>Job Match Pro</b><small>19,99 €/mes</small></div><span className={`billing-status ${activePro ? "active" : "inactive"}`}>{activePro ? <><BadgeCheck size={13}/> Activa</> : "Inactiva"}</span></div>
      <p>Publica ofertas sin límite y escribe directamente a candidatos, aunque todavía no haya match.</p>
      {activePro && <small className="billing-expiry">Renovación / fin del periodo: {new Date(profile.pro_expires_at!).toLocaleDateString("es-ES")}</small>}
      {native && activePro && <button className="text-action" type="button" onClick={() => void openGooglePlaySubscriptionManagement().catch(() => onError("No se pudieron abrir las suscripciones de Google Play."))}>Gestionar suscripción en Google Play</button>}
      {!native && !activePro && <button className="billing-primary" disabled={Boolean(busy)} onClick={() => void checkout("/api/checkout/subscription", {}, "pro")}><BriefcaseBusiness size={15}/>{busy === "pro" ? "Abriendo pago…" : "Activar Job Match Pro"}</button>}
      {native && !activePro && <><button className="billing-primary" disabled={Boolean(busy)} onClick={() => void startNativePurchase()}><BriefcaseBusiness size={15}/>{busy === "pro" ? (playProduct ? "Procesando compra…" : "Comprobando Google Play…") : playProduct ? `Activar Job Match Pro · ${playProduct.priceString}/mes` : "Reintentar Google Play"}</button>{playProductMissing && <small className="billing-store-note">El producto todavía no aparece. Puedes volver a intentarlo aquí.</small>}</>}
    </div>
  </section>;
}

export function OfferBoostButton({ offer, userId, onError, onPurchased }: { offer: JobOffer; userId: string; onError: (message: string) => void; onPurchased?: () => void }) {
  const [busy, setBusy] = useState(false);
  const [playProduct, setPlayProduct] = useState<Product | null>(() => getCachedGooglePlayProduct("offer_boost"));
  const native = getPaymentChannel() === "google_play";
  const boosted = Boolean(offer.is_boosted && offer.boost_expires_at && new Date(offer.boost_expires_at).getTime() > Date.now());

  useEffect(() => {
    if (!native) return;
    let active = true;
    const refresh = async (forceRefresh = false) => {
      try { const product = await getGooglePlayProduct("offer_boost", forceRefresh); if (active) setPlayProduct(product); }
      catch { if (active && !getCachedGooglePlayProduct("offer_boost")) setPlayProduct(null); }
    };
    void refresh();
    const listener = App.addListener("appStateChange", ({ isActive }) => { if (isActive) void refresh(true); });
    return () => { active = false; void listener.then((handle) => handle.remove()); };
  }, [native]);

  async function startCheckout() {
    if (getPaymentChannel() === "google_play") {
      if (busy) return;
      setBusy(true); onError("");
      try {
        if (!playProduct) { setPlayProduct(await getGooglePlayProduct("offer_boost", true)); return; }
        await purchaseWithGooglePlay("offer_boost", userId, offer.id); onPurchased?.();
      }
      catch (cause) { onError(cause instanceof Error ? cause.message : "No se pudo completar la compra con Google Play."); }
      finally { setBusy(false); }
      return;
    }
    if (!supabase || busy) return;
    setBusy(true);
    onError("");
    try {
      const { data, error } = await supabase.auth.getSession();
      if (error) throw error;
      const token = data.session?.access_token;
      if (!token) throw new Error("Inicia sesión de nuevo para continuar.");
      const response = await fetch("/api/checkout/boost", { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({ offer_id: offer.id }) });
      const result = await response.json() as { url?: string; error?: string };
      if (!response.ok || !result.url) throw new Error(result.error || "No se pudo abrir el pago.");
      window.location.assign(result.url);
    } catch (cause) {
      onError(cause instanceof Error ? cause.message : "No se pudo iniciar el pago.");
      setBusy(false);
    }
  }

  if (native) return <span className="native-boost-action"><button type="button" className="offer-boost-button" disabled={busy || boosted || !offer.is_active} onClick={() => void startCheckout()}>{busy ? (playProduct ? "Procesando…" : "Comprobando Google Play…") : boosted ? `Destacada hasta ${new Date(offer.boost_expires_at!).toLocaleDateString("es-ES")}` : playProduct ? `Destacar · ${playProduct.priceString}` : "Reintentar Google Play"}</button>{!playProduct && <small>El producto aún no aparece. Pulsa para reintentar.</small>}</span>;
  return <button type="button" className="offer-boost-button" disabled={busy || boosted || !offer.is_active} onClick={() => void startCheckout()}>{busy ? "Abriendo…" : boosted ? `Destacada hasta ${new Date(offer.boost_expires_at!).toLocaleDateString("es-ES")}` : "Destacar · 7,99 €"}</button>;
}
