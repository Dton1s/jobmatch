"use client";
import { useEffect, useState } from "react";
type Notice = { enabled: boolean; message: string };
export function OperationalNotice() {
  const [notice, setNotice] = useState<Notice | null>(null);
  useEffect(() => { let live = true; void fetch("/api/public-settings", { cache: "no-store" }).then((response) => response.ok ? response.json() : null).then((result) => { if (!live) return; const values = result?.settings ?? {}; const maintenance = values.maintenance_notice as Notice | undefined; const info = values.info_banner as Notice | undefined; setNotice(maintenance?.enabled && maintenance.message ? maintenance : info?.enabled && info.message ? info : null); }).catch(() => undefined); return () => { live = false; }; }, []);
  if (!notice) return null;
  return <aside className="operational-notice" role="status">{notice.message}</aside>;
}
