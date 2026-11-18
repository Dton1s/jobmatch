"use client";

import { useEffect, useState } from "react";
import { App } from "@capacitor/app";
import { ArrowUpRight, BadgeCheck, TrendingUp } from "lucide-react";
import { supabase, type WorkerCard } from "@/lib/supabase";
import { getPaymentChannel } from "@/lib/platform";
import { getCachedGooglePlayProduct, getGooglePlayProduct, purchaseWithGooglePlay } from "@/lib/native-billing";
import type { Product } from "@capgo/native-purchases";

export function WorkerBoostPanel({ workerCard, userId, onError, onPurchased }: { workerCard: WorkerCard | null; userId: string; onError: (message: string) => void; onPurchased: () => void }) {
  const [busy, setBusy] = useState(false);
  const [playProduct, setPlayProduct] = useState<Product | null>(() => getCachedGooglePlayProduct("worker_boost"));
  const [now, setNow] = useState(() => Date.now());
  const native = getPaymentChannel() === "google_play";
  const boostExpiry = workerCard?.boost_expires_at ? new Date(workerCard.boost_expires_at).getTime() : 0;
  const boosted = Boolean(workerCard?.is_boosted && boostExpiry > now);
  const hoursRemaining = boosted ? Math.ceil((boostExpiry - now) / (60 * 60 * 1000)) : 0;
  const remaining = hoursRemaining >= 48
    ? `${Math.ceil(hoursRemaining / 24)} días`
    : hoursRemaining === 1 ? "1 hora" : `${Math.max(1, hoursRemaining)} horas`;

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!native) return;
    let active = true;
    const refresh = async (forceRefresh = false) => {
      try { const product = await getGooglePlayProduct("worker_boost", forceRefresh); if (active) setPlayProduct(product); }
      catch { if (active && !getCachedGooglePlayProduct("worker_boost")) setPlayProduct(null); }
    };
    void refresh();
    const listener = App.addListener("appStateChange", ({ isActive }) => { if (isActive) void refresh(true); });
    return () => { active = false; void listener.then((handle) => handle.remove()); };
  }, [native]);

  async function startCheckout() {
    if (getPaymentChannel() === "google_play") {
      if (busy || !workerCard) return;
      setBusy(true); onError("");
      try {
        if (!playProduct) { setPlayProduct(await getGooglePlayProduct("worker_boost", true)); return; }
        await purchaseWithGooglePlay("worker_boost", userId); onPurchased();
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

      const response = await fetch("/api/checkout/worker-boost", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: "{}",
      });
      const result = await response.json() as { url?: string; error?: string };
      if (!response.ok || !result.url) throw new Error(result.error || "No se pudo iniciar el pago.");
      window.location.assign(result.url);
    } catch (cause) {
      onError(cause instanceof Error ? cause.message : "No se pudo iniciar el pago.");
      setBusy(false);
    }
  }

  return <section className="worker-boost-card">
    <div className="worker-boost-heading">
      <span className="worker-boost-icon"><TrendingUp size={17}/></span>
      <div><b>Impulso de perfil</b><small>Más visibilidad durante 7 días · 1,99 €</small></div>
      {boosted && <span className="billing-status active"><BadgeCheck size={13}/> Activo</span>}
    </div>
    {boosted
      ? <p className="worker-boost-status">Tu perfil está impulsado. Te quedan <b>{remaining}</b> (hasta {new Date(boostExpiry).toLocaleString("es-ES", { dateStyle: "medium", timeStyle: "short" })}).</p>
      : !workerCard || !workerCard.is_active || workerCard.is_demo
        ? <p className="worker-boost-status">Publica una ficha de trabajador activa para poder impulsarla.</p>
        : <p className="worker-boost-status">Destaca tu perfil para que más empresas lo vean en Descubrir.</p>}
    {native && !playProduct && !boosted && workerCard?.is_active && !workerCard.is_demo && <small className="billing-store-note">El producto de impulso aún no está disponible en Google Play.</small>}
    <button className="worker-boost-button" disabled={busy || boosted || !workerCard?.is_active || Boolean(workerCard?.is_demo)} onClick={() => void startCheckout()}>
      <ArrowUpRight size={14}/>{busy ? (native ? (playProduct ? "Procesando compra…" : "Comprobando Google Play…") : "Abriendo pago…") : boosted ? `Impulso activo · ${remaining}` : native ? playProduct ? `Impulsar mi perfil · ${playProduct.priceString} (7 días)` : "Reintentar Google Play" : "Impulsar mi perfil por 1,99 € (7 días)"}
    </button>
  </section>;
}
