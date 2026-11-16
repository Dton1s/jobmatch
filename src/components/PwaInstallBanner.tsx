"use client";

import { useEffect, useState } from "react";
import { Plus, Share2, Smartphone, X } from "lucide-react";

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

const DISMISSED_KEY = "jobmatch:pwa-install-banner-dismissed:v1";

function isIosDevice() {
  if (typeof navigator === "undefined") return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent)
    || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

function isStandalone() {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(display-mode: standalone)").matches
    || ("standalone" in navigator && Boolean((navigator as Navigator & { standalone?: boolean }).standalone));
}

export function PwaInstallBanner() {
  const [ready, setReady] = useState(false);
  const [visible, setVisible] = useState(false);
  const [iosGuideOpen, setIosGuideOpen] = useState(false);
  const [installPrompt, setInstallPrompt] = useState<InstallPromptEvent | null>(null);
  const [installing, setInstalling] = useState(false);
  const ios = isIosDevice();

  useEffect(() => {
    if (window.localStorage.getItem(DISMISSED_KEY) === "true" || isStandalone()) {
      setReady(true);
      return;
    }

    const onBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as InstallPromptEvent);
      setVisible(true);
    };
    const onAppInstalled = () => {
      setVisible(false);
      setInstallPrompt(null);
      window.localStorage.setItem(DISMISSED_KEY, "true");
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    window.addEventListener("appinstalled", onAppInstalled);

    // Safari on iOS does not emit beforeinstallprompt, so show its manual guide.
    if (isIosDevice()) setVisible(true);
    setReady(true);

    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
      window.removeEventListener("appinstalled", onAppInstalled);
    };
  }, []);

  function dismissBanner() {
    window.localStorage.setItem(DISMISSED_KEY, "true");
    setVisible(false);
    setIosGuideOpen(false);
  }

  async function handleInstall() {
    if (ios) {
      setIosGuideOpen(true);
      return;
    }
    if (!installPrompt || installing) return;

    setInstalling(true);
    const prompt = installPrompt;
    setInstallPrompt(null); // A browser install prompt is single use.
    try {
      await prompt.prompt();
      await prompt.userChoice;
      // The native event is single-use, so hide this CTA until the browser
      // emits a fresh install opportunity (for example, after a later visit).
      setVisible(false);
    } finally {
      setInstalling(false);
    }
  }

  if (!ready || !visible) return null;

  return (
    <>
      <aside className="relative z-[60] border-b border-slate-200/80 bg-white px-3 py-2.5 shadow-sm sm:px-5" aria-label="Instalar Job Match">
        <div className="mx-auto flex w-full max-w-5xl items-center gap-2.5">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
            <Smartphone className="h-4 w-4" aria-hidden="true" />
          </span>
          <p className="min-w-0 flex-1 text-xs font-medium leading-5 text-slate-700 sm:text-sm">
            Instala Job Match para un acceso más rápido
          </p>
          <button
            type="button"
            onClick={handleInstall}
            disabled={!ios && (!installPrompt || installing)}
            className="shrink-0 rounded-full bg-slate-900 px-3.5 py-2 text-xs font-semibold text-white transition hover:bg-slate-700 disabled:cursor-wait disabled:opacity-75 sm:px-4 sm:text-sm"
            style={{ color: "#fff" }}
          >
            {ios ? "Cómo instalar" : installing ? "Abriendo…" : "Instalar"}
          </button>
          <button
            type="button"
            onClick={dismissBanner}
            aria-label="Cerrar aviso de instalación"
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-slate-500 transition hover:bg-slate-100 hover:text-slate-800"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      </aside>

      {iosGuideOpen && (
        <div className="fixed inset-0 z-[80] flex items-end justify-center bg-slate-950/35 p-3 sm:items-center sm:p-6" onClick={() => setIosGuideOpen(false)}>
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="pwa-ios-guide-title"
            className="w-full max-w-sm rounded-3xl bg-white p-5 shadow-2xl sm:p-6"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4">
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
                <Smartphone className="h-5 w-5" aria-hidden="true" />
              </span>
              <button
                type="button"
                onClick={() => setIosGuideOpen(false)}
                aria-label="Cerrar instrucciones"
                className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-600 transition hover:bg-slate-200"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
            <h2 id="pwa-ios-guide-title" className="mt-4 text-lg font-bold text-slate-900">Añade Job Match a tu pantalla de inicio</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Pulsa el botón de compartir de Safari ⎋ y selecciona &apos;Añadir a la pantalla de inicio&apos;.
            </p>
            <div className="mt-4 flex items-center gap-3 rounded-2xl bg-slate-50 p-3 text-sm text-slate-700">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white text-slate-700 shadow-sm">
                <Share2 className="h-4 w-4" aria-hidden="true" />
              </span>
              <span>Compartir</span>
              <span className="ml-auto text-slate-300" aria-hidden="true">→</span>
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white text-slate-700 shadow-sm">
                <Plus className="h-4 w-4" aria-hidden="true" />
              </span>
              <span className="sr-only">Añadir a pantalla de inicio</span>
            </div>
            <p className="mt-3 text-xs leading-5 text-slate-500">Si no estás en Safari, abre esta página allí y sigue esos pasos.</p>
            <button
              type="button"
              onClick={() => setIosGuideOpen(false)}
              className="mt-5 w-full rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-700"
              style={{ color: "#fff" }}
            >
              Entendido
            </button>
          </section>
        </div>
      )}
    </>
  );
}
