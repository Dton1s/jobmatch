"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { isNativePlatform } from "@/lib/platform";

type Gate = "checking" | "native" | "signed_out" | "mfa" | "denied" | "ready";
type Report = { id: string; reporter_id: string; reported_user_id: string | null; target_type: "profile" | "offer" | "message"; target_id: string; reason: string; details: string | null; review_status: string; reviewed_at: string | null; moderation_notes: string | null; created_at: string };
type Block = { id: string; blocker_id: string; blocked_user_id: string; created_at: string };
type Metrics = Record<string, unknown>;
const statuses = ["pending", "reviewing", "resolved", "dismissed"];

export default function AdminPage() {
  const [gate, setGate] = useState<Gate>("checking");
  const [token, setToken] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mfaCode, setMfaCode] = useState("");
  const [mfaFactorId, setMfaFactorId] = useState("");
  const [error, setError] = useState("");
  const [section, setSection] = useState<"overview" | "reports" | "settings">("overview");
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [metricFrom, setMetricFrom] = useState(() => dateInputValue(Date.now() - 30 * 86400000));
  const [metricTo, setMetricTo] = useState(() => dateInputValue(Date.now()));
  const [reports, setReports] = useState<Report[]>([]);
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [moderationTab, setModerationTab] = useState<"reports" | "blocks">("reports");
  const [blockUserFilter, setBlockUserFilter] = useState("");
  const [reportCount, setReportCount] = useState(0);
  const [page, setPage] = useState(0);
  const [filterStatus, setFilterStatus] = useState("");
  const [filterType, setFilterType] = useState("");
  const [filterReason, setFilterReason] = useState("");
  const [reportFrom, setReportFrom] = useState("");
  const [reportTo, setReportTo] = useState("");
  const [selected, setSelected] = useState<Report | null>(null);
  const [target, setTarget] = useState<Record<string, unknown> | null>(null);
  const [notes, setNotes] = useState("");
  const [settings, setSettings] = useState<Array<{key:string;value:Record<string,unknown>}>>([]);
  const [flagName, setFlagName] = useState("");
  const [flagValue, setFlagValue] = useState(false);
  const [busy, setBusy] = useState(false);

  const api = useCallback(async (path: string, init: RequestInit = {}) => {
    const response = await fetch(path, { ...init, headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, ...init.headers }, cache: "no-store" });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(typeof data.error === "string" ? data.error : "No se pudo completar la solicitud.");
    return data;
  }, [token]);

  const authorize = useCallback(async (accessToken: string) => {
    setToken(accessToken);
    try {
      if (supabase) {
        const { data: assurance, error: assuranceError } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
        if (assuranceError) throw assuranceError;
        if (assurance.currentLevel !== "aal2" && assurance.nextLevel === "aal2") {
          const { data: factors, error: factorsError } = await supabase.auth.mfa.listFactors(); if (factorsError) throw factorsError;
          const factor = factors.totp.find((item) => item.status === "verified"); if (!factor) { setGate("denied"); setError("Configura un segundo factor TOTP en esta cuenta administrativa."); return; }
          setMfaFactorId(factor.id); setGate("mfa"); return;
        }
      }
      const response = await fetch("/api/admin?action=session", { headers: { Authorization: `Bearer ${accessToken}` }, cache: "no-store" });
      if (!response.ok) { setGate("denied"); return; }
      setGate("ready");
    } catch { setGate("denied"); }
  }, []);

  useEffect(() => {
    if (isNativePlatform()) { setGate("native"); return; }
    if (!supabase) { setGate("denied"); setError("Servicio de autenticación no disponible."); return; }
    void supabase.auth.getSession().then(({ data }) => data.session ? authorize(data.session.access_token) : setGate("signed_out"));
  }, [authorize]);

  const loadMetrics = useCallback(async () => { const params=new URLSearchParams({from:new Date(`${metricFrom}T00:00:00`).toISOString(),to:new Date(`${metricTo}T23:59:59.999`).toISOString()});setMetrics(await api(`/api/admin?action=metrics&${params}`)); }, [api,metricFrom,metricTo]);
  const loadReports = useCallback(async () => {
    const params = new URLSearchParams({ action: "reports", page: String(page), limit: "20" });
    if (filterStatus) params.set("status", filterStatus); if (filterType) params.set("type", filterType); if (filterReason) params.set("reason", filterReason); if(reportFrom)params.set("from",new Date(`${reportFrom}T00:00:00`).toISOString());if(reportTo)params.set("to",new Date(`${reportTo}T23:59:59.999`).toISOString());
    const result = await api(`/api/admin?${params}`); setReports(result.reports); setReportCount(result.count);
  }, [api, page, filterStatus, filterType, filterReason, reportFrom, reportTo]);
  const loadBlocks = useCallback(async () => { const params=new URLSearchParams({action:"blocks",page:String(page),limit:"20"}); if(blockUserFilter.trim())params.set("user",blockUserFilter.trim()); const result=await api(`/api/admin?${params}`);setBlocks(result.blocks);setReportCount(result.count); },[api,page,blockUserFilter]);
  const loadSettings = useCallback(async () => { const result = await api("/api/admin?action=settings"); setSettings(result.settings.map((item: {key:string;value:Record<string,unknown>})=>({key:item.key,value:item.value}))); }, [api]);
  useEffect(() => { if (gate !== "ready") return; setError(""); void (section === "overview" ? loadMetrics() : section === "reports" ? moderationTab === "reports" ? loadReports() : loadBlocks() : loadSettings()).catch((cause) => setError(cause instanceof Error ? cause.message : "Error de carga.")); }, [gate, section, moderationTab, loadMetrics, loadReports, loadBlocks, loadSettings]);

  async function signIn(event: FormEvent) {
    event.preventDefault(); if (!supabase) return; setBusy(true); setError("");
    try { const { data, error: signInError } = await supabase.auth.signInWithPassword({ email: email.trim(), password }); if (signInError) throw signInError; if (!data.session) throw new Error("No se obtuvo una sesión."); await authorize(data.session.access_token); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "No se pudo iniciar sesión."); setGate("signed_out"); }
    finally { setBusy(false); }
  }
  async function verifyMfa(event: FormEvent) {
    event.preventDefault(); if (!supabase||!mfaFactorId||busy) return; setBusy(true); setError("");
    try { const { error: verifyError } = await supabase.auth.mfa.challengeAndVerify({ factorId:mfaFactorId, code:mfaCode.trim() }); if (verifyError) throw verifyError; const { data }=await supabase.auth.getSession(); if(!data.session)throw new Error("La sesión caducó. Vuelve a iniciar sesión."); await authorize(data.session.access_token); }
    catch(cause){setError(cause instanceof Error?cause.message:"No se pudo verificar el segundo factor.");}
    finally{setBusy(false);}
  }
  async function inspect(report: Report) {
    setSelected(report); setTarget(null); setNotes(report.moderation_notes ?? "");
    try { const result = await api(`/api/admin?action=target&type=${report.target_type}&id=${encodeURIComponent(report.target_id)}`); setTarget(result.target); }
    catch { setTarget({ unavailable: "El contenido ya no está disponible." }); }
  }
  async function updateReport(status: string) {
    if (!selected) return; setBusy(true);
    try { await api("/api/admin?action=reports", { method: "PATCH", body: JSON.stringify({ id: selected.id, review_status: status, moderation_notes: notes }) }); setSelected(null); await loadReports(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "No se guardó el cambio."); }
    finally { setBusy(false); }
  }
  async function action(actionName: string, targetId: string, label: string) {
    if (!window.confirm(`${label}. ¿Confirmas esta acción administrativa?`)) return;
    setBusy(true);
    try { await api("/api/admin?action=action", { method: "POST", body: JSON.stringify({ action: actionName, target_id: targetId, confirm: true }) }); setError("Acción completada."); if (section === "reports") await loadReports(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "No se pudo aplicar la acción."); }
    finally { setBusy(false); }
  }
  async function saveSetting(key: string, value: Record<string, unknown>) {
    setBusy(true); try { await api("/api/admin?action=settings", { method: "PUT", body: JSON.stringify({ key, value }) }); await loadSettings(); setError("Ajuste guardado."); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "No se pudo guardar."); }
    finally { setBusy(false); }
  }

  if (gate !== "ready") return <main className="admin-gate"><section className="admin-card"><img src="/branding/jobmatch-logo.png" alt="Job Match"/><span className="eyebrow">PANEL ADMINISTRATIVO</span>{gate === "checking" ? <p>Comprobando acceso…</p> : gate === "native" ? <><h1>Panel solo disponible en web</h1><p>Abre job-match.es/admin desde un navegador de escritorio.</p></> : gate === "signed_out" ? <><h1>Acceso restringido</h1><p>Inicia sesión con una cuenta administrativa autorizada.</p>{error&&<p className="admin-error">{error}</p>}<form onSubmit={(event)=>void signIn(event)}><label>Correo<input type="email" required autoComplete="username" value={email} onChange={(event)=>setEmail(event.target.value)}/></label><label>Contraseña<input type="password" required autoComplete="current-password" value={password} onChange={(event)=>setPassword(event.target.value)}/></label><button disabled={busy}>{busy?"Validando…":"Iniciar sesión"}</button></form></> : gate === "mfa" ? <><h1>Verificación en dos pasos</h1><p>Introduce el código de tu app de autenticación.</p>{error&&<p className="admin-error">{error}</p>}<form onSubmit={(event)=>void verifyMfa(event)}><label>Código TOTP<input inputMode="numeric" autoComplete="one-time-code" minLength={6} maxLength={8} required value={mfaCode} onChange={(event)=>setMfaCode(event.target.value)}/></label><button disabled={busy}>{busy?"Verificando…":"Verificar y continuar"}</button></form></> : <><h1>Acceso denegado</h1><p>La sesión no está autorizada para este panel.</p></>}</section></main>;

  return <main className="admin-page"><header className="admin-header"><img src="/branding/jobmatch-logo.png" alt="Job Match"/><div><span className="eyebrow">OPERACIONES</span><h1>Administración</h1></div><button className="admin-signout" onClick={async()=>{await supabase?.auth.signOut();setGate("signed_out");}}>Cerrar sesión</button></header>
    <nav className="admin-nav">{(["overview","reports","settings"] as const).map((item)=><button className={section===item?"active":""} key={item} onClick={()=>setSection(item)}>{item==="overview"?"Resumen":item==="reports"?"Moderación":"Ajustes"}</button>)}</nav>
    {error&&<p className="admin-notice" role="status">{error}</p>}
    {section==="overview"&&<section><div className="admin-section-title"><div><span className="eyebrow">ÚLTIMOS 30 DÍAS Y ESTADO ACTUAL</span><h2>Actividad de Job Match</h2></div><div className="admin-range"><label>Desde<input type="date" value={metricFrom} onChange={(event)=>setMetricFrom(event.target.value)}/></label><label>Hasta<input type="date" value={metricTo} onChange={(event)=>setMetricTo(event.target.value)}/></label><button onClick={()=>void loadMetrics()}>Aplicar rango</button></div></div>{metrics?<><div className="admin-metric-grid">{[["Cuentas nuevas",metrics.new_accounts],["Fichas activas",metrics.active_worker_profiles],["Ofertas activas",metrics.active_offers],["Swipes",metrics.swipes],["Matches",metrics.matches],["Conversaciones",metrics.conversations],["Denuncias pendientes",metrics.reports_pending],["Denuncias resueltas",metrics.reports_resolved],["Pro activas",metrics.pro_subscriptions],["Compras Play",metrics.google_play_purchases]].map(([label,value])=><article className="admin-metric" key={String(label)}><span>{String(label)}</span><strong>{String(value??0)}</strong></article>)}</div><article className="admin-card"><h3>Escaneos de /app por origen y plataforma</h3>{Array.isArray(metrics.qr_scans)&&metrics.qr_scans.length? <div className="admin-table-wrap"><table><thead><tr><th>Origen</th><th>Plataforma</th><th>Escaneos</th></tr></thead><tbody>{(metrics.qr_scans as Array<Record<string,unknown>>).map((row,index)=><tr key={index}><td>{String(row.source)}</td><td>{String(row.platform)}</td><td>{String(row.count)}</td></tr>)}</tbody></table></div>:<p>Sin escaneos en el rango.</p>}</article><p className="admin-footnote">Las cuentas son usuarios autenticados; swipes y matches son eventos del rango. Los escaneos son eventos anónimos y no identifican dispositivos.</p></>:<p>Cargando métricas…</p>}</section>}
    {section==="reports"&&<section><div className="admin-section-title"><div><span className="eyebrow">REVISIÓN DE SEGURIDAD</span><h2>Moderación</h2></div><button onClick={()=>void (moderationTab==="reports"?loadReports():loadBlocks())}>Actualizar</button></div><div className="admin-nav admin-subnav"><button className={moderationTab==="reports"?"active":""} onClick={()=>{setPage(0);setModerationTab("reports")}}>Denuncias</button><button className={moderationTab==="blocks"?"active":""} onClick={()=>{setPage(0);setModerationTab("blocks")}}>Bloqueos</button></div>{moderationTab==="reports"?<><div className="admin-filters"><label>Estado<select value={filterStatus} onChange={(event)=>{setPage(0);setFilterStatus(event.target.value)}}><option value="">Todos</option>{statuses.map((status)=><option key={status}>{status}</option>)}</select></label><label>Tipo<select value={filterType} onChange={(event)=>{setPage(0);setFilterType(event.target.value)}}><option value="">Todos</option><option value="profile">Perfil</option><option value="offer">Oferta</option><option value="message">Mensaje</option></select></label><label>Motivo<input value={filterReason} onChange={(event)=>{setPage(0);setFilterReason(event.target.value)}} placeholder="Filtrar motivo"/></label><label>Desde<input type="date" value={reportFrom} onChange={(event)=>{setPage(0);setReportFrom(event.target.value)}}/></label><label>Hasta<input type="date" value={reportTo} onChange={(event)=>{setPage(0);setReportTo(event.target.value)}}/></label></div><div className="admin-report-list">{reports.map((report)=><article className="admin-report" key={report.id}><div><b>{report.target_type} · {report.reason}</b><span>{new Date(report.created_at).toLocaleString("es-ES")} · {report.review_status}</span><p>{report.details||"Sin contexto adicional."}</p></div><button onClick={()=>void inspect(report)}>Revisar</button></article>)}{reports.length===0&&<p>No hay denuncias para estos filtros.</p>}</div></>:<><div className="admin-filters"><label>UUID de usuario<input value={blockUserFilter} onChange={(event)=>{setPage(0);setBlockUserFilter(event.target.value)}} placeholder="Filtrar por usuario"/></label></div><div className="admin-report-list">{blocks.map((block)=><article className="admin-report" key={block.id}><div><b>Bloqueo mutuo</b><span>{new Date(block.created_at).toLocaleString("es-ES")}</span><p>Inició: {block.blocker_id}<br/>Bloqueado: {block.blocked_user_id}</p></div></article>)}{blocks.length===0&&<p>No hay bloqueos para este filtro.</p>}</div></>}<div className="admin-pagination"><button disabled={page===0} onClick={()=>setPage((current)=>current-1)}>Anterior</button><span>Página {page+1}</span><button disabled={(page+1)*20>=reportCount} onClick={()=>setPage((current)=>current+1)}>Siguiente</button></div></section>}
    {section==="settings"&&<section><div className="admin-section-title"><div><span className="eyebrow">CONTENIDO CONTROLADO</span><h2>Avisos y banderas</h2></div><button onClick={()=>void loadSettings()}>Actualizar</button></div>{["maintenance_notice","info_banner"].map((key)=>{const setting=settings.find((item)=>item.key===key);const value=setting?.value??{};return <SettingEditor key={key} title={key==="maintenance_notice"?"Aviso de mantenimiento":"Banner informativo"} enabled={Boolean(value.enabled)} message={String(value.message??"")} busy={busy} onSave={(enabled,message)=>void saveSetting(key,{enabled,message})}/>})}<article className="admin-card admin-setting"><h3>Feature flags</h3><p>Identificadores sencillos y valores booleanos. No se ejecuta código ni contenido configurable.</p><div className="admin-flag-row"><label>Nombre<input value={flagName} maxLength={40} pattern="[a-z][a-z0-9_]{0,39}" onChange={(event)=>setFlagName(event.target.value.toLowerCase())} placeholder="new_discovery_flow"/></label><label className="admin-check"><input type="checkbox" checked={flagValue} onChange={(event)=>setFlagValue(event.target.checked)}/> Activada</label><button disabled={busy||! /^[a-z][a-z0-9_]{0,39}$/.test(flagName)} onClick={()=>{const current=settings.find((item)=>item.key==="feature_flags")?.value??{};void saveSetting("feature_flags",{...current,[flagName]:flagValue});setFlagName("");}}>Guardar bandera</button></div><ul className="admin-flag-list">{Object.entries(settings.find((item)=>item.key==="feature_flags")?.value??{}).map(([name,value])=><li key={name}><code>{name}</code><span>{value===true?"Activa":"Inactiva"}</span></li>)}</ul></article></section>}
    {selected&&<div className="admin-modal-backdrop" onClick={()=>setSelected(null)}><section className="admin-modal" onClick={(event)=>event.stopPropagation()}><button className="admin-modal-close" onClick={()=>setSelected(null)}>Cerrar</button><span className="eyebrow">CONTENIDO DENUNCIADO · {selected.target_type}</span><h2>{selected.reason}</h2>{target?<pre>{JSON.stringify(target,null,2)}</pre>:<p>Cargando contenido…</p>}<label>Notas internas<textarea maxLength={2000} value={notes} onChange={(event)=>setNotes(event.target.value)}/></label><div className="admin-actions"><button disabled={busy} onClick={()=>void updateReport("reviewing")}>En revisión</button><button disabled={busy} onClick={()=>void updateReport("resolved")}>Resolver</button><button disabled={busy} onClick={()=>void updateReport("dismissed")}>Descartar</button></div>{Boolean(target?.id)&&selected.target_type!=="message"&&<div className="admin-actions admin-danger-actions"><button disabled={busy} onClick={()=>void action(selected.target_type==="offer"?"deactivate_offer":"deactivate_profile",String(target?.id),"Desactivar contenido denunciado")}>Desactivar contenido…</button>{typeof target?.user_id==="string"&&<><button disabled={busy} onClick={()=>void action("suspend_user",String(target.user_id),"Suspender cuenta")}>Suspender cuenta…</button><button disabled={busy} onClick={()=>void action("restore_user",String(target.user_id),"Restaurar cuenta")}>Restaurar cuenta…</button></>}{typeof target?.company_id==="string"&&<><button disabled={busy} onClick={()=>void action("suspend_user",String(target.company_id),"Suspender cuenta")}>Suspender cuenta…</button><button disabled={busy} onClick={()=>void action("restore_user",String(target.company_id),"Restaurar cuenta")}>Restaurar cuenta…</button></>}{typeof target?.sender_id==="string"&&<><button disabled={busy} onClick={()=>void action("suspend_user",String(target.sender_id),"Suspender autor…")}>Suspender autor…</button><button disabled={busy} onClick={()=>void action("restore_user",String(target.sender_id),"Restaurar cuenta")}>Restaurar cuenta…</button></>}</div>}</section></div>}
  </main>;
}

function SettingEditor({title,enabled,message,busy,onSave}:{title:string;enabled:boolean;message:string;busy:boolean;onSave:(enabled:boolean,message:string)=>void}) {
  const [nextEnabled,setNextEnabled]=useState(enabled); const [nextMessage,setNextMessage]=useState(message);
  useEffect(()=>{setNextEnabled(enabled);setNextMessage(message)},[enabled,message]);
  return <article className="admin-card admin-setting"><h3>{title}</h3><label className="admin-check"><input type="checkbox" checked={nextEnabled} onChange={(event)=>setNextEnabled(event.target.checked)}/> Visible</label><label>Texto<textarea maxLength={240} value={nextMessage} onChange={(event)=>setNextMessage(event.target.value)}/></label><button disabled={busy} onClick={()=>onSave(nextEnabled,nextMessage)}>Guardar</button></article>;
}

function dateInputValue(timestamp:number){const date=new Date(timestamp);return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}-${String(date.getDate()).padStart(2,"0")}`;}
