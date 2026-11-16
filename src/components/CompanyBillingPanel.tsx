"use client";

import { useState } from "react";
import { Capacitor } from "@capacitor/core";
import { BadgeCheck, Crown, Sparkles } from "lucide-react";
import { supabase, type JobOffer, type Profile } from "@/lib/supabase";

export function CompanyBillingPanel({ profile, offers, onError }: { profile: Profile; offers: JobOffer[]; onError: (message: string) => void }) {
  const [busy, setBusy] = useState("");
  const activePro = Boolean(profile.is_pro && profile.pro_expires_at && new Date(profile.pro_expires_at).getTime() > Date.now());
  const native = Capacitor.isNativePlatform();

  async function checkout(endpoint: string, body: Record<string, string>, key: string) {
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
      <p>Inicia conversaciones directas con candidatos y accede a herramientas Pro para tu empresa.</p>
      {activePro && <small className="billing-expiry">Renovación / fin del periodo: {new Date(profile.pro_expires_at!).toLocaleDateString("es-ES")}</small>}
      {!native && !activePro && <button className="billing-primary" disabled={Boolean(busy)} onClick={() => void checkout("/api/checkout/subscription", {}, "pro")}><Sparkles size={15}/>{busy === "pro" ? "Abriendo pago…" : "Activar Job Match Pro"}</button>}
      {native && !activePro && <small className="billing-expiry">Las compras dentro de Android estarán disponibles al integrar Google Play Billing.</small>}
    </div>
    {!native && offers.filter((offer) => offer.company_id === profile.id && offer.is_active && !offer.is_demo && new Date(offer.expires_at).getTime() > Date.now()).map((offer) => {
      const boosted = Boolean(offer.is_boosted && offer.boost_expires_at && new Date(offer.boost_expires_at).getTime() > Date.now());
      return <div className="billing-boost-row" key={offer.id}><span><b>{offer.position}</b><small>{boosted ? `Destacada hasta ${new Date(offer.boost_expires_at!).toLocaleDateString("es-ES")}` : "Más visibilidad durante 7 días"}</small></span><button disabled={Boolean(busy) || boosted} onClick={() => void checkout("/api/checkout/boost", { offer_id: offer.id }, offer.id)}>{busy === offer.id ? "Abriendo…" : boosted ? <><BadgeCheck size={13}/> Destacada</> : "Destacar · 7,99 €"}</button></div>;
    })}
    {native && <small className="billing-expiry">Los Boost se podrán comprar desde Android cuando Google Play Billing esté conectado.</small>}
  </section>;
}
