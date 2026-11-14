"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { BriefcaseBusiness, ChevronDown, Compass, LogOut, MapPin, MessageCircle, SlidersHorizontal, Sparkles, UserRound, Users } from "lucide-react";
import { CardEditor } from "@/components/CardEditor";
import { MatchChat } from "@/components/MatchChat";
import { SwipeDeck } from "@/components/SwipeDeck";
import { supabase, type JobOffer, type Match, type Profile, type Role, type SwipeDirection, type WorkerCard } from "@/lib/supabase";

type FeedCard = (WorkerCard & { distanceKm?: number; interested?: boolean }) | (JobOffer & { distanceKm?: number });
type View = "discover" | "matches";

function distanceKm(lat1: number, lng1: number, lat2: number, lng2: number) {
  const rad = (value: number) => value * Math.PI / 180;
  const dLat = rad(lat2 - lat1), dLng = rad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(a));
}

export default function HomePage() {
  const [user, setUser] = useState<{ id: string; email?: string } | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [workerCard, setWorkerCard] = useState<WorkerCard | null>(null);
  const [offers, setOffers] = useState<JobOffer[]>([]);
  const [selectedOfferId, setSelectedOfferId] = useState("");
  const [cards, setCards] = useState<FeedCard[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [view, setView] = useState<View>("discover");
  const [editing, setEditing] = useState(false);
  const [activeMatch, setActiveMatch] = useState<Match | null>(null);
  const [loading, setLoading] = useState(true);
  const [booting, setBooting] = useState(true);
  const [distance, setDistance] = useState(25);
  const [sector, setSector] = useState("Todos los sectores");
  const [newMatch, setNewMatch] = useState<Match | null>(null);
  const [notice, setNotice] = useState("");

  const selectedOffer = offers.find((offer) => offer.id === selectedOfferId) ?? offers[0] ?? null;
  const greeting = useMemo(() => profile?.display_name?.trim().split(/\s+/)[0] || "", [profile?.display_name]);

  const loadAccount = useCallback(async (userId: string) => {
    if (!supabase) { setBooting(false); return; }
    const { data: profileData } = await supabase.from("jobmatch_profiles").select("*").eq("id", userId).maybeSingle();
    if (!profileData) {
      setProfile(null); setWorkerCard(null); setOffers([]); setBooting(false); return;
    }
    setProfile(profileData as Profile);
    const [workerResult, offerResult] = await Promise.all([
      supabase.from("jobmatch_worker_cards").select("*").eq("user_id", userId).maybeSingle(),
      supabase.from("jobmatch_job_offers").select("*").eq("company_id", userId).eq("is_active", true).gt("expires_at", new Date().toISOString()).order("created_at", { ascending: false }),
    ]);
    setWorkerCard(workerResult.data as WorkerCard | null);
    setOffers((offerResult.data ?? []) as JobOffer[]);
    if (!selectedOfferId && offerResult.data?.[0]) setSelectedOfferId(offerResult.data[0].id);
    setBooting(false);
  }, [selectedOfferId]);

  useEffect(() => {
    if (!supabase) { setBooting(false); return; }
    void supabase.auth.getSession().then(({ data }) => {
      const sessionUser = data.session?.user;
      setUser(sessionUser ? { id: sessionUser.id, email: sessionUser.email } : null);
      if (sessionUser) void loadAccount(sessionUser.id); else setBooting(false);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      const sessionUser = session?.user;
      setUser(sessionUser ? { id: sessionUser.id, email: sessionUser.email } : null);
      if (sessionUser) void loadAccount(sessionUser.id); else { setProfile(null); setBooting(false); }
    });
    return () => listener.subscription.unsubscribe();
  }, [loadAccount]);

  const loadMatches = useCallback(async () => {
    if (!supabase || !profile) return;
    const column = profile.role === "worker" ? "worker_id" : "company_id";
    const { data } = await supabase.from("jobmatch_matches").select("*").eq(column, profile.id).order("created_at", { ascending: false });
    setMatches((data ?? []) as Match[]);
  }, [profile]);

  useEffect(() => { void loadMatches(); }, [loadMatches]);
  useEffect(() => {
    if (!supabase || !profile) return;
    const channel = supabase.channel(`jobmatch-match-feed-${profile.id}`).on("postgres_changes", { event: "INSERT", schema: "public", table: "jobmatch_matches" }, (payload) => {
      const match = payload.new as Match;
      if (match.worker_id !== profile.id && match.company_id !== profile.id) return;
      setMatches((current) => current.some((item) => item.id === match.id) ? current : [match, ...current]);
      setNewMatch(match);
    }).subscribe();
    return () => { void supabase?.removeChannel(channel); };
  }, [profile]);

  const loadDeck = useCallback(async () => {
    if (!profile?.role || !supabase) return;
    setLoading(true);
    try {
      if (profile.role === "company") {
        if (!selectedOffer) { setCards([]); return; }
        const [{ data: workerRows }, { data: priorSwipes }, { data: workerInterests }] = await Promise.all([
          supabase.from("jobmatch_worker_cards").select("*").eq("is_active", true).neq("user_id", profile.id).order("is_featured", { ascending: false }).limit(80),
          supabase.from("jobmatch_swipes").select("worker_card_id").eq("actor_id", profile.id).eq("job_offer_id", selectedOffer.id),
          supabase.from("jobmatch_swipes").select("worker_card_id").eq("actor_role", "worker").eq("job_offer_id", selectedOffer.id).eq("direction", "right"),
        ]);
        const seen = new Set((priorSwipes ?? []).map((row) => row.worker_card_id));
        const interested = new Set((workerInterests ?? []).map((row) => row.worker_card_id));
        setCards(((workerRows ?? []) as WorkerCard[]).filter((row) => !seen.has(row.id)).map((row) => ({ ...row, distanceKm: profile.lat !== null && profile.lng !== null ? distanceKm(profile.lat, profile.lng, row.lat, row.lng) : 0, interested: interested.has(row.id) }))
          .filter((row) => row.distanceKm! <= distance && (sector === "Todos los sectores" || row.sector === sector))
          .sort((a, b) => Number(b.is_featured) - Number(a.is_featured) || a.distanceKm! - b.distanceKm!));
      } else {
        if (!workerCard) { setCards([]); return; }
        const [{ data: offerRows }, { data: priorSwipes }] = await Promise.all([
          supabase.from("jobmatch_job_offers").select("*").eq("is_active", true).gt("expires_at", new Date().toISOString()).neq("company_id", profile.id).order("created_at", { ascending: false }).limit(100),
          supabase.from("jobmatch_swipes").select("job_offer_id").eq("actor_id", profile.id).eq("worker_card_id", workerCard.id),
        ]);
        const seen = new Set((priorSwipes ?? []).map((row) => row.job_offer_id));
        setCards(((offerRows ?? []) as JobOffer[]).filter((row) => !seen.has(row.id)).map((row) => ({ ...row, distanceKm: profile.lat !== null && profile.lng !== null ? distanceKm(profile.lat, profile.lng, row.lat, row.lng) : 0 }))
          .filter((row) => row.distanceKm! <= distance && (sector === "Todos los sectores" || row.sector === sector)).sort((a, b) => a.distanceKm! - b.distanceKm!));
      }
    } catch (cause) { setNotice(cause instanceof Error ? cause.message : "No pudimos cargar las tarjetas."); }
    finally { setLoading(false); }
  }, [profile, selectedOffer, workerCard, distance, sector]);

  useEffect(() => { void loadDeck(); }, [loadDeck]);

  async function decide(card: FeedCard, direction: SwipeDirection) {
    if (!supabase || !profile?.role) return;
    const isCompany = profile.role === "company";
    const row = {
      actor_id: profile.id,
      actor_role: profile.role,
      worker_card_id: isCompany ? card.id : workerCard?.id,
      job_offer_id: isCompany ? selectedOffer?.id : card.id,
      direction,
    };
    if (!row.worker_card_id || !row.job_offer_id) return;
    const { error } = await supabase.from("jobmatch_swipes").upsert(row, { onConflict: "actor_id,worker_card_id,job_offer_id" });
    if (error) { setNotice(error.message); return; }
    setCards((current) => current.filter((item) => item.id !== card.id));
    if (direction === "super") setNotice("Propuesta directa registrada. La insignia se activa con la suscripción para empresas.");
  }

  async function signIn() {
    if (!supabase) return;
    const redirectTo = typeof window === "undefined" ? undefined : `${window.location.origin}/`;
    const { error } = await supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo } });
    if (error) setNotice(error.message);
  }

  async function chooseRole(role: Role) {
    if (!supabase || !user) return;
    const { error } = await supabase.from("jobmatch_profiles").upsert({ id: user.id, role, display_name: user.email?.split("@")[0] ?? "", onboarding_complete: false }, { onConflict: "id" });
    if (error) { setNotice(error.message); return; }
    await loadAccount(user.id); setEditing(true);
  }

  async function changeRole(role: Role) {
    if (!supabase || !profile || profile.role === role) return;
    const { error } = await supabase.from("jobmatch_profiles").update({ role }).eq("id", profile.id);
    if (error) { setNotice(error.message); return; }
    setProfile({ ...profile, role }); setView("discover"); setActiveMatch(null);
  }

  async function signOut() { await supabase?.auth.signOut(); setUser(null); setProfile(null); }

  if (!supabase) return <ConfigMissing />;
  if (booting) return <main className="splash"><div className="brand-mark">j.</div><div className="loader"/><p>Preparando JobMatch…</p></main>;
  if (!user) return <main className="auth-screen"><div className="auth-card"><a className="brand-lockup"><span className="brand-mark">j.</span> jobmatch<span className="brand-period">.</span></a><div className="auth-visual"><div className="orbit orbit-one"/><div className="orbit orbit-two"/><div className="center-spark">✳</div><span className="float-tag tag-one">Talento cerca</span><span className="float-tag tag-two">Trabajo real</span></div><span className="eyebrow">EMPLEO QUE EMPIEZA CERCA</span><h1>El próximo<br/>match puede ser <em>aquí.</em></h1><p>Personas y negocios locales conectando de forma directa, sin currículums eternos ni ofertas a ciegas.</p>{notice && <div className="form-error">{notice}</div>}<button className="google-button" onClick={signIn}><GoogleMark/> Continuar con Google</button><small className="auth-terms">Al continuar aceptas nuestras condiciones y política de privacidad.</small></div><div className="auth-side-note"><Sparkles size={15}/> Hecho para el empleo local.</div></main>;
  if (!profile?.role) return <main className="role-screen"><a className="brand-lockup"><span className="brand-mark">j.</span> jobmatch<span className="brand-period">.</span></a><div className="role-copy"><span className="eyebrow">UNA APP · DOS CAMINOS</span><h1>¿Qué te trae<br/>por aquí, <em>{user.email?.split("@")[0]}?</em></h1><p>Elige cómo quieres empezar. Podrás cambiar de modo desde tu perfil.</p></div><div className="role-cards"><button onClick={() => void chooseRole("worker")} className="role-card worker-role"><span className="role-icon"><UserRound/></span><span className="eyebrow">BUSCO TRABAJO</span><strong>Soy trabajador/a</strong><p>Descubre ofertas que encajan contigo, cerca de donde estás.</p><span className="role-arrow">↗</span></button><button onClick={() => void chooseRole("company")} className="role-card company-role"><span className="role-icon"><BriefcaseBusiness/></span><span className="eyebrow">BUSCO TALENTO</span><strong>Soy empresa</strong><p>Encuentra personas de tu zona con ganas de trabajar.</p><span className="role-arrow">↗</span></button></div>{notice && <p className="form-error">{notice}</p>}</main>;

  if (editing || !profile.onboarding_complete || (profile.role === "worker" && !workerCard) || (profile.role === "company" && !offers.length)) return <main className="editor-screen"><a className="brand-lockup"><span className="brand-mark">j.</span> jobmatch<span className="brand-period">.</span></a><CardEditor profile={profile} existingWorker={workerCard} existingOffer={selectedOffer} onCancel={() => setEditing(false)} onSaved={async () => { setEditing(false); await loadAccount(profile.id); }} /></main>;

  return <main className="app-shell">
    <header className="app-header"><a className="brand-lockup"><span className="brand-mark">j.</span> jobmatch<span className="brand-period">.</span></a><div className="header-location"><MapPin size={14}/>{profile.city || "Cerca de ti"}<ChevronDown size={13}/></div><div className="header-actions"><button className="header-icon" onClick={() => setEditing(true)} aria-label="Editar ficha"><UserRound size={18}/></button><button className="header-icon match-notification" onClick={() => {setView("matches");setActiveMatch(null);}} aria-label="Conexiones"><MessageCircle size={18}/>{matches.length > 0 && <i/>}</button><button className="header-avatar" onClick={() => void signOut()} title="Cerrar sesión">{profile.display_name?.slice(0,1) || "J"}</button></div></header>
    <div className="mobile-role-switch"><button className={profile.role === "worker" ? "active" : ""} onClick={() => void changeRole("worker")}><UserRound size={14}/> Trabajador</button><button className={profile.role === "company" ? "active" : ""} onClick={() => void changeRole("company")}><BriefcaseBusiness size={14}/> Empresa</button></div>
    <div className="main-layout"><aside className="side-rail"><div className="profile-mini"><span className="profile-mini-avatar">{profile.display_name?.slice(0,1) || "J"}</span><div><b>{greeting || "Tu perfil"}</b><small>{profile.role === "worker" ? "Trabajador/a" : "Empresa"}</small></div></div><nav><button className={view === "discover" ? "selected" : ""} onClick={() => {setView("discover");setActiveMatch(null);}}><Compass size={18}/> Descubrir</button><button className={view === "matches" ? "selected" : ""} onClick={() => {setView("matches");setActiveMatch(null);}}><MessageCircle size={18}/> Conexiones <span className="nav-count">{matches.length}</span></button></nav><div className="side-rule"/><div className="side-filter"><div className="filter-title"><SlidersHorizontal size={15}/> Filtros <button onClick={() => {setDistance(25);setSector("Todos los sectores");}}>Limpiar</button></div><label>Distancia <b>{distance} km</b></label><input type="range" min="5" max="80" step="5" value={distance} onChange={(e) => setDistance(Number(e.target.value))}/><label>Sector</label><select value={sector} onChange={(e) => setSector(e.target.value)}><option>Todos los sectores</option>{[...new Set([...(workerCard ? [workerCard.sector] : []), ...offers.map((item) => item.sector), "Hostelería", "Comercio", "Logística", "Limpieza", "Atención al cliente"])].map((item) => <option key={item}>{item}</option>)}</select></div><div className="side-promo"><span>✳</span><b>El empleo local<br/>se mueve contigo.</b><small>Conexiones reales, a pocos kilómetros.</small></div><button className="signout-button" onClick={() => void signOut()}><LogOut size={15}/> Cerrar sesión</button></aside>
      <div className="content-area">{view === "discover" ? <SwipeDeck role={profile.role} offer={selectedOffer} cards={cards} loading={loading} onSwipe={(card, direction) => void decide(card, direction)} onEdit={() => setEditing(true)} onCreateOffer={() => setEditing(true)}/> : activeMatch ? <MatchChat match={activeMatch} profile={profile} onClose={() => setActiveMatch(null)}/> : <MatchesView matches={matches} profile={profile} onOpen={setActiveMatch}/>}</div>
      <aside className="right-rail"><div className="right-heading"><span className="eyebrow">TU ACTIVIDAD</span><button onClick={() => setView("matches")}>Ver todo ↗</button></div><h3>Conexiones recientes</h3>{matches.slice(0, 3).map((match) => <button key={match.id} className="recent-match" onClick={() => {setView("matches");setActiveMatch(match);}}><span className="recent-avatar">✳</span><span><b>Nuevo match</b><small>{new Date(match.created_at).toLocaleDateString("es-ES")}</small></span><MessageCircle size={16}/></button>)}{matches.length === 0 && <div className="activity-empty"><div>✳</div><p>Tus conexiones aparecerán aquí. Un gesto puede ser el comienzo.</p></div>}<div className="nearby-note"><div><MapPin size={16}/><b>Hiperlocal</b></div><p>Las tarjetas se ordenan por cercanía a {profile.city || "tu zona"}.</p></div><footer>JobMatch · Empleo que conecta cerca</footer></aside>
    </div>
    <nav className="mobile-bottom-nav"><button className={view === "discover" ? "active" : ""} onClick={() => setView("discover")}><Compass/><span>Descubrir</span></button><button className={view === "matches" ? "active" : ""} onClick={() => setView("matches")}><MessageCircle/><span>Conexiones</span></button><button onClick={() => setEditing(true)}><UserRound/><span>Mi ficha</span></button></nav>
    {notice && <button className="toast" onClick={() => setNotice("")}>{notice} ×</button>}
    <AnimatePresence>{newMatch && <motion.div className="match-modal-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}><motion.div className="match-modal" initial={{ scale: .8, y: 18 }} animate={{ scale: 1, y: 0 }} exit={{ scale: .9 }}><span className="match-burst">✳</span><span className="eyebrow">DOS CAMINOS SE CRUZAN</span><h2>¡Hay <em>Match!</em></h2><p>Hay interés por ambas partes. Ahora podéis hablar directamente.</p><button className="primary-button" onClick={() => {setView("matches");setActiveMatch(newMatch);setNewMatch(null);}}>Abrir conversación <MessageCircle size={16}/></button><button className="quiet-button" onClick={() => setNewMatch(null)}>Seguir descubriendo</button></motion.div></motion.div>}</AnimatePresence>
  </main>;
}

function MatchesView({ matches, profile, onOpen }: { matches: Match[]; profile: Profile; onOpen: (match: Match) => void }) {
  return <section className="matches-page"><span className="eyebrow">CONEXIONES RECÍPROCAS</span><h1>Hay algo que<br/><em>puede empezar.</em></h1><p>Cuando os interesáis mutuamente, la conversación está a un paso.</p><div className="matches-list">{matches.map((match) => <button className="match-row" key={match.id} onClick={() => onOpen(match)}><span className="match-row-avatar">✳</span><span><b>¡Hay Match!</b><small>{profile.role === "worker" ? "Oferta · " : "Perfil · "}{new Date(match.created_at).toLocaleDateString("es-ES")}</small></span><span className="match-open"><MessageCircle size={16}/> Abrir chat</span></button>)}</div>{matches.length === 0 && <div className="empty-card"><div className="empty-icon">✳</div><h2>Tu primer Match está cerca</h2><p>Sigue descubriendo perfiles y ofertas de tu zona.</p></div>}</section>;
}

function ConfigMissing() { return <main className="splash"><div className="brand-mark">j.</div><h1>Falta conectar Supabase</h1><p>Copia <code>.env.example</code> a <code>.env.local</code> y añade la URL y la clave pública de tu proyecto.</p></main>; }
function GoogleMark() { return <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true"><path fill="#4285F4" d="M43.6 24.5c0-1.4-.1-2.8-.4-4.1H24v7.8h11a9.4 9.4 0 0 1-4 6.2v5h6.5c3.8-3.5 6.1-8.7 6.1-14.9Z"/><path fill="#34A853" d="M24 44c5.5 0 10.1-1.8 13.5-4.8l-6.5-5c-1.8 1.2-4.1 2-7 2-5.4 0-10-3.6-11.6-8.5H5.7v5.2A20 20 0 0 0 24 44Z"/><path fill="#FBBC05" d="M12.4 27.7a12 12 0 0 1 0-7.4v-5.2H5.7a20 20 0 0 0 0 17.8l6.7-5.2Z"/><path fill="#EA4335" d="M24 11.8c3 0 5.7 1 7.8 3.1l5.8-5.8C34.1 5.8 29.5 4 24 4A20 20 0 0 0 5.7 15.1l6.7 5.2c1.6-4.9 6.2-8.5 11.6-8.5Z"/></svg>}
