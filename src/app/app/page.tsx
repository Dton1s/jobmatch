"use client";

import { useEffect, useState } from "react";
import { ArrowRight, Check, ExternalLink, MonitorDown, Share2, Smartphone } from "lucide-react";
import { supabase } from "@/lib/supabase";

type Platform = "checking" | "android" | "ios" | "web";

const PLAY_STORE_URL = "https://play.google.com/store/apps/details?id=es.nebuladigitalstudio.jobmatch";

export default function AppLandingPage() {
  const [platform, setPlatform] = useState<Platform>("checking");
  const [webHref, setWebHref] = useState("/");
  const [playStoreHref, setPlayStoreHref] = useState(PLAY_STORE_URL);
  const [showInstallHelp, setShowInstallHelp] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const requestedSource = params.get("src") || "direct";
    const source = /^[a-zA-Z0-9_-]{1,120}$/.test(requestedSource) ? requestedSource : "direct";
    const userAgent = navigator.userAgent.slice(0, 500);
    const isAndroid = /android/i.test(userAgent);
    const isIOS = /iPad|iPhone|iPod/i.test(userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    const detectedPlatform: Exclude<Platform, "checking"> = isAndroid ? "android" : isIOS ? "ios" : "web";

    setPlatform(detectedPlatform);
    setWebHref(`/${window.location.search}${window.location.hash}`);

    if (supabase) {
      void Promise.resolve(supabase.from("jobmatch_qr_scans").insert({ source, platform: detectedPlatform })).then(({ error }) => {
        if (error && process.env.NODE_ENV !== "production") console.info("No se pudo registrar la visita a /app.", error.message);
      }).catch(() => undefined);
    }

    if (source !== "direct") {
      const referrer = new URLSearchParams({ utm_source: "jobmatch_qr", utm_campaign: source }).toString();
      const storeUrl = new URL(PLAY_STORE_URL);
      storeUrl.searchParams.set("referrer", referrer);
      setPlayStoreHref(storeUrl.toString());
    }

    if (detectedPlatform !== "android") return;
    const redirectTimer = window.setTimeout(() => window.location.assign(playStoreHrefFor(source)), 1000);
    return () => window.clearTimeout(redirectTimer);
  }, []);

  if (platform === "checking") {
    return <main className="app-landing app-landing-checking"><img src="/branding/jobmatch-logo.png" alt="Job Match"/><span className="app-landing-spinner" aria-label="Cargando"/></main>;
  }

  if (platform === "android") {
    return <main className="app-landing"><section className="app-landing-card app-landing-android">
      <img className="app-landing-logo" src="/branding/jobmatch-logo.png" alt="Job Match"/>
      <span className="app-landing-kicker">APP OFICIAL</span>
      <h1>Abriendo Job Match en Google Play…</h1>
      <p>En un momento te llevaremos a la ficha oficial para instalar o abrir la aplicación.</p>
      <a className="app-landing-primary" href={playStoreHref}><ExternalLink size={18}/> Abrir Google Play</a>
      <small>Si no se abre automáticamente, pulsa el botón.</small>
    </section></main>;
  }

  return <main className="app-landing"><section className="app-landing-card">
    <img className="app-landing-logo" src="/branding/jobmatch-logo.png" alt="Job Match"/>
    <span className="app-landing-kicker">EMPLEO QUE ENCAJA</span>
    <h1>Tu próximo trabajo puede empezar aquí.</h1>
    <p>Encuentra oportunidades cerca de ti y conecta con negocios de tu zona.</p>
    <a className="app-landing-primary" href={webHref}><ArrowRight size={18}/> Entrar ahora desde la web</a>
    <button className="app-landing-secondary" type="button" onClick={() => setShowInstallHelp((value) => !value)}>
      {platform === "ios" ? <Share2 size={18}/> : <MonitorDown size={18}/>}
      {showInstallHelp ? "Ocultar instrucciones" : platform === "ios" ? "Añadir Job Match a inicio" : "Instalar Job Match"}
    </button>
    {showInstallHelp && <aside className="app-install-guide" aria-live="polite">
      <span className="app-install-guide-icon">{platform === "ios" ? <Share2 size={20}/> : <Smartphone size={20}/>}</span>
      <div><b>{platform === "ios" ? "En Safari" : "Instálala desde tu navegador"}</b><p>{platform === "ios" ? <>Pulsa <strong>Compartir</strong> <Share2 size={14} className="app-inline-icon"/> y selecciona <strong>Añadir a pantalla de inicio</strong>.</> : <>Abre el menú de tu navegador y elige <strong>Instalar Job Match</strong> o <strong>Añadir a pantalla de inicio</strong>.</>}</p></div>
      <Check size={17} className="app-install-check"/>
    </aside>}
    <small className="app-landing-footnote">{platform === "ios" ? "Funciona desde Safari y también puedes instalarla en tu pantalla de inicio." : "Job Match está disponible en web y se puede instalar desde navegadores compatibles."}</small>
  </section></main>;
}

function playStoreHrefFor(source: string) {
  if (!source || source === "direct") return PLAY_STORE_URL;
  const storeUrl = new URL(PLAY_STORE_URL);
  storeUrl.searchParams.set("referrer", new URLSearchParams({ utm_source: "jobmatch_qr", utm_campaign: source }).toString());
  return storeUrl.toString();
}
