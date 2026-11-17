"use client";

import { useEffect, useState } from "react";
import { Capacitor } from "@capacitor/core";
import { ArrowUpRight, BadgeCheck, TrendingUp } from "lucide-react";
import { supabase, type WorkerCard } from "@/lib/supabase";

export function WorkerBoostPanel({ workerCard, onError }: { workerCard: WorkerCard | null; onError: (message: string) => void }) {
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const native = Capacitor.isNativePlatform();
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

  async function startCheckout() {
    if (!supabase || busy || native) return;
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
    {!native && <button className="worker-boost-button" disabled={busy || boosted || !workerCard?.is_active || Boolean(workerCard?.is_demo)} onClick={() => void startCheckout()}>
      <ArrowUpRight size={14}/>{busy ? "Abriendo pago…" : boosted ? `Impulso activo · ${remaining}` : "Impulsar mi perfil por 1,99 € (7 días)"}
    </button>}
    {native && <small className="billing-expiry">Los pagos desde Android estarán disponibles al integrar Google Play Billing.</small>}
  </section>;
}
