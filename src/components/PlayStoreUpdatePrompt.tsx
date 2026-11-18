"use client";

import { useEffect, useState } from "react";
import { App } from "@capacitor/app";
import { Capacitor } from "@capacitor/core";
import { AppUpdate, AppUpdateAvailability, FlexibleUpdateInstallStatus } from "@capawesome/capacitor-app-update";
import { Download, X } from "lucide-react";
import { GOOGLE_PLAY_PACKAGE_NAME } from "@/lib/google-play-products";

export function PlayStoreUpdatePrompt() {
  const [available, setAvailable] = useState(false);
  const [opening, setOpening] = useState(false);
  const [downloaded, setDownloaded] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState<number | null>(null);
  const [flexibleAllowed, setFlexibleAllowed] = useState(false);
  const [immediateAllowed, setImmediateAllowed] = useState(false);

  useEffect(() => {
    if (Capacitor.getPlatform() !== "android") return;
    let active = true;
    const check = async () => {
      try {
        const info = await AppUpdate.getAppUpdateInfo();
        if (active) {
          setAvailable(info.updateAvailability === AppUpdateAvailability.UPDATE_AVAILABLE || info.updateAvailability === AppUpdateAvailability.UPDATE_IN_PROGRESS);
          setFlexibleAllowed(Boolean(info.flexibleUpdateAllowed));
          setImmediateAllowed(Boolean(info.immediateUpdateAllowed));
          setDownloaded(info.installStatus === FlexibleUpdateInstallStatus.DOWNLOADED);
        }
      } catch {
        // Play returns no update information when the app wasn't installed from Play or isn't eligible.
      }
    };
    void check();
    const updateListener = AppUpdate.addListener("onFlexibleUpdateStateChange", (state) => {
      if (!active) return;
      if (state.installStatus === FlexibleUpdateInstallStatus.DOWNLOADED) {
        setDownloaded(true);
        setDownloadProgress(null);
      } else if (state.installStatus === FlexibleUpdateInstallStatus.DOWNLOADING && state.bytesDownloaded && state.totalBytesToDownload) {
        setDownloadProgress(Math.min(100, Math.round(state.bytesDownloaded / state.totalBytesToDownload * 100)));
      } else if (state.installStatus === FlexibleUpdateInstallStatus.FAILED || state.installStatus === FlexibleUpdateInstallStatus.CANCELED) {
        setDownloadProgress(null);
      }
    });
    const listener = App.addListener("appStateChange", ({ isActive }) => { if (isActive) void check(); });
    return () => {
      active = false;
      void listener.then((handle) => handle.remove());
      void updateListener.then((handle) => handle.remove());
    };
  }, []);

  if (!available) return null;
  return <aside className="play-update-banner" role="status" aria-live="polite">
    <span className="play-update-icon"><Download size={17}/></span>
    <span className="play-update-copy"><b>{downloaded ? "Actualización descargada" : "Actualización disponible"}</b><small>{downloaded ? "Instálala para seguir usando la versión más reciente." : downloadProgress !== null ? `Descargando actualización · ${downloadProgress}%` : "Hay una nueva versión de Job Match en Google Play."}</small></span>
    <button type="button" className="play-update-action" disabled={opening} onClick={async () => {
      setOpening(true);
      try {
        if (downloaded) {
          await AppUpdate.completeFlexibleUpdate();
        } else if (flexibleAllowed) {
          await AppUpdate.startFlexibleUpdate();
        } else if (immediateAllowed) {
          await AppUpdate.performImmediateUpdate();
        } else {
          await AppUpdate.openAppStore({ androidPackageName: GOOGLE_PLAY_PACKAGE_NAME });
        }
      }
      finally { setOpening(false); }
    }}>{opening ? "Preparando…" : downloaded ? "Reiniciar y actualizar" : downloadProgress !== null ? "Descargando…" : "Actualizar"}</button>
    <button type="button" className="play-update-dismiss" aria-label="Cerrar aviso" onClick={() => setAvailable(false)}><X size={16}/></button>
  </aside>;
}
