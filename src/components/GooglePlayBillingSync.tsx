"use client";

import { useEffect, useRef } from "react";
import { App } from "@capacitor/app";
import { Capacitor } from "@capacitor/core";
import { refreshGooglePlayProducts, syncGooglePlaySubscription } from "@/lib/native-billing";

export function GooglePlayBillingSync({ userId, onSynced }: { userId: string; onSynced: () => void }) {
  const onSyncedRef = useRef(onSynced);
  useEffect(() => { onSyncedRef.current = onSynced; }, [onSynced]);
  useEffect(() => {
    if (Capacitor.getPlatform() !== "android") return;
    let active = true;
    let syncInFlight = false;
    const sync = async () => {
      if (!active || syncInFlight) return;
      syncInFlight = true;
      try {
        await refreshGooglePlayProducts();
        await syncGooglePlaySubscription(userId);
        if (active) onSyncedRef.current();
      }
      catch { /* Play may be offline or unavailable; verified server entitlements remain in effect. */ }
      finally { syncInFlight = false; }
    };
    void sync();
    const listener = App.addListener("appStateChange", ({ isActive }) => { if (isActive) void sync(); });
    return () => { active = false; void listener.then((handle) => handle.remove()); };
  }, [userId]);
  return null;
}
