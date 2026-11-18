"use client";

import { AnimatePresence, motion, useMotionValue, useTransform } from "framer-motion";
import { BadgeCheck, BriefcaseBusiness, Building2, Check, ChevronRight, Clock3, GraduationCap, Headset, Languages, MapPin, MessageCircle, Pause, Play, RotateCcw, Store, Truck, Utensils, X, Heart, CarFront, Phone, UserRound } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { JobOffer, Role, SwipeDirection, WorkerCard } from "@/lib/supabase";
import { CloseButton } from "@/components/CloseButton";

export type DeckCard = (WorkerCard & { distanceKm?: number; interested?: boolean }) | (JobOffer & { distanceKm?: number });

type DeckProps = {
  role: Role; offer: JobOffer | null; distance: number; cards: DeckCard[]; loading: boolean; undoAvailable: boolean; isPro: boolean; visible: boolean;
  onSwipe: (card: DeckCard, direction: SwipeDirection) => void;
  onCreateOffer: () => void; onUndo: () => void; onShowFilters: () => void;
  pausedOffer: JobOffer | null; onActivateOffer: (offer: JobOffer) => void;
  onModalOpen: () => void;
  onContactDirect: (card: DeckCard) => void;
};

export function SwipeDeck({ role, offer, distance, cards, loading, undoAvailable, isPro, visible, onSwipe, onCreateOffer, onUndo, onShowFilters, pausedOffer, onActivateOffer, onModalOpen, onContactDirect }: DeckProps) {
  const [exitDirection, setExitDirection] = useState<SwipeDirection>("right");
  const currentCard = cards[0];
  const needsActiveOffer = role === "company" && !offer && !loading;
  const hasActiveCard = Boolean(currentCard) && !loading && !needsActiveOffer;
  const handleSwipe = (card: DeckCard, direction: SwipeDirection) => {
    setExitDirection(direction);
    onSwipe(card, direction);
  };

  return <section className="deck-area">
    <div className="deck-heading compact-deck-heading"><div className="deck-context">{role === "worker" ? <><b>Ofertas cerca de ti</b><span>· {distance} km</span></> : <><span>Buscando:</span><b>{offer?.position ?? "Elige una oferta"}</b>{offer?.salary_text && <small>{offer.salary_text}</small>}<button onClick={onCreateOffer}>Cambiar</button></>}</div><button className="deck-radius" onClick={onShowFilters} aria-label={`Cambiar radio de búsqueda, actualmente ${distance} kilómetros`}><MapPin size={14}/>{distance} km</button></div>
    {cards.some((card) => card.is_demo) && <p className="sample-feed-notice" role="status">Modo de pruebas: el mazo incluye perfiles y ofertas ficticios; no representan personas ni vacantes reales y no crean conexiones.</p>}
    <div className="deck-stack">
      {loading && <div className="deck-state"><div className="loader"/><p>Buscando buenas coincidencias cerca…</p></div>}
      {needsActiveOffer && <div className="empty-card offer-required-state"><BriefcaseBusiness size={34}/><span className="eyebrow">PUBLICA UNA OPORTUNIDAD</span><h2>Activa o crea una oferta para empezar a deslizar candidatos</h2>{pausedOffer && <button className="primary-button" onClick={() => onActivateOffer(pausedOffer)}>Activar mi oferta</button>}<button className={pausedOffer ? "quiet-button" : "primary-button"} onClick={onCreateOffer}>Crear nueva oferta</button></div>}
      {!loading && !needsActiveOffer && !currentCard && <div className="empty-card"><div className="empty-icon"><BriefcaseBusiness size={22}/></div><span className="eyebrow">OPORTUNIDADES DE EMPLEO</span><h2>{role === "worker" ? "Ofertas de empleo al día" : "No hay más perfiles en tu radio actual"}</h2><p>{role === "worker" ? "No hay más ofertas que encajen con tus filtros por ahora. Amplía el radio o vuelve a consultar más tarde." : "Prueba a ampliar el radio o ajustar los filtros para encontrar más candidatos."}</p><button className="primary-button" onClick={onShowFilters}>Ajustar filtros</button>{undoAvailable && <button className="quiet-button" onClick={onUndo}><RotateCcw size={14}/> Deshacer última acción</button>}</div>}
      <AnimatePresence initial={false} mode="sync" custom={exitDirection}>
        {!loading && !needsActiveOffer && cards.slice(0, 2).map((item, index) => <motion.div key={`${item.id}-${index === 0 ? "active" : "next"}`} className={`deck-card-layer ${index === 0 ? "deck-card-layer-current" : "deck-card-layer-next"}`} custom={exitDirection} variants={{ exit: (direction: SwipeDirection) => ({ x: direction === "left" ? -900 : 900, opacity: 0, rotate: direction === "left" ? -18 : 18 }) }} exit="exit" transition={{ type: "tween", duration: .24, ease: "easeOut" }}><SwipeDeckCard role={role} card={item} active={index === 0} visible={visible} isPro={isPro} onContactDirect={onContactDirect} onSwipe={handleSwipe} onModalOpen={onModalOpen}/></motion.div>) }
      </AnimatePresence>
    </div>
    {hasActiveCard && <>
      <div className="deck-actions"><button className="action-circle action-no" onClick={() => handleSwipe(currentCard!, "left")} aria-label="Pasar"><X size={23}/></button><button className="action-circle action-undo" onClick={onUndo} disabled={!undoAvailable} aria-label="Deshacer último swipe" title="Deshacer último swipe"><RotateCcw size={17}/></button><button className="action-circle action-yes" onClick={() => handleSwipe(currentCard!, "right")} aria-label="Me interesa"><Heart size={22} fill="currentColor"/></button></div>
      <button className="undo-caption" disabled={!undoAvailable} onClick={onUndo}>{undoAvailable ? <><RotateCcw size={12}/> Deshacer último swipe</> : "Desliza la tarjeta o toca una acción"}</button>
    </>}
  </section>;
}

function SwipeDeckCard({ role, card, active, visible, isPro, onContactDirect, onSwipe, onModalOpen }: { role: Role; card: DeckCard; active: boolean; visible: boolean; isPro: boolean; onContactDirect: (card: DeckCard) => void; onSwipe: (card: DeckCard, direction: SwipeDirection) => void; onModalOpen: () => void }) {
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [audioPlaying, setAudioPlaying] = useState(false);
  const x = useMotionValue(0);
  const rotate = useTransform(x, [-220, 220], [-12, 12]);
  const noOpacity = useTransform(x, [-115, -20], [1, 0]);
  const yesOpacity = useTransform(x, [20, 115], [0, 1]);
  const audioRef = useRef<HTMLAudioElement>(null);
  const dragInProgress = useRef(false);
  const isWorker = role === "worker";
  const job = isWorker ? card as JobOffer : null;
  const worker = isWorker ? null : card as WorkerCard & { interested?: boolean };
  const image = job ? job.business_image_path : worker?.photo_path;
  const title = job ? job.business_name : worker?.full_name;
  const sector = job ? job.sector : worker?.sector ?? "";
  const detailPosition = job ? job.position : worker?.desired_position;
  const detailLocation = job ? job.city : worker?.city;
  const detailBadge = job ? job.shift_type : worker ? (worker.availability_note || availabilityLabel(worker.availability)) : "";

  useEffect(() => {
    if (active) { x.set(0); setDetailsOpen(false); setAudioPlaying(false); }
  }, [active, x]);

  useEffect(() => {
    if (!visible) {
      setDetailsOpen(false);
      audioRef.current?.pause();
      setAudioPlaying(false);
    }
  }, [visible]);

  useEffect(() => {
    const resetInterruptedDrag = () => {
      if (document.visibilityState === "visible" && active && dragInProgress.current) {
        dragInProgress.current = false;
        x.set(0);
      }
    };
    document.addEventListener("visibilitychange", resetInterruptedDrag);
    window.addEventListener("focus", resetInterruptedDrag);
    return () => {
      document.removeEventListener("visibilitychange", resetInterruptedDrag);
      window.removeEventListener("focus", resetInterruptedDrag);
    };
  }, [active, x]);

  function toggleAudio() {
    if (!audioRef.current) return;
    if (audioPlaying) audioRef.current.pause(); else void audioRef.current.play();
    setAudioPlaying(!audioPlaying);
  }

  function finishDrag(offsetX: number) {
    const direction: SwipeDirection | null = offsetX > 105 ? "right" : offsetX < -105 ? "left" : null;
    x.set(0);
    if (direction) onSwipe(card, direction);
  }

  return <>
      <motion.article className={`swipe-card ${active ? "swipe-card-current" : "swipe-card-next"}`} style={{ x, rotate, scale: active ? 1 : .96, opacity: 1, backgroundColor: "#ffffff", zIndex: active ? 10 : 0, touchAction: "pan-y" }} drag={active && visible ? "x" : false} dragDirectionLock dragConstraints={{ left: 0, right: 0 }} dragElastic={0.85} dragMomentum={false} onDragStart={() => { if (active) dragInProgress.current = true; }} onDragEnd={(_, info) => { if (active) { dragInProgress.current = false; if (document.visibilityState === "hidden" || !visible) x.set(0); else finishDrag(info.offset.x); } }} initial={active ? { opacity: 0, scale: .95, y: 16 } : false} animate={{ opacity: 1, scale: active ? 1 : .96, y: 0 }} transition={{ type: "tween", duration: .24, ease: "easeOut" }}>
      <div className={`card-cover ${image ? "has-photo" : "no-photo"} sector-${sectorSlug(sector)}`} style={image ? { backgroundImage: `linear-gradient(to top, rgba(15,23,42,0.92) 0%, rgba(15,23,42,0.5) 45%, transparent 100%),url(${image})` } : undefined}>
        <div className="cover-topline">{job?.is_boosted&&job.boost_expires_at&&new Date(job.boost_expires_at).getTime()>Date.now()&&<span className="boost-badge"><BadgeCheck size={13}/> Destacada</span>}<span className="distance-pill"><MapPin size={13}/>{formatDistance(card.distanceKm ?? 0)}</span></div>
        <div className="sector-symbol" aria-hidden="true"><SectorIcon sector={sector}/></div>
        <div className="cover-copy"><span className="cover-sector">{job ? job.sector : worker?.city}</span><h2>{title}</h2><p>{job ? job.position : worker?.age ? `${worker.age} años · ${worker.city}` : worker?.city}</p></div>
        {worker?.interested && <div className="interest-pill">Le interesa tu oferta</div>}
        {active && <><motion.div className="swipe-stamp stamp-no" style={{ opacity: noOpacity }}>PASAR</motion.div><motion.div className="swipe-stamp stamp-yes" style={{ opacity: yesOpacity }}>ME INTERESA</motion.div></>}
      </div>
      <div className="card-details">
        {job ? <OfferSummary offer={job}/> : worker && <WorkerSummary worker={worker} audioRef={audioRef} audioPlaying={audioPlaying} onToggleAudio={toggleAudio}/>}
        <button className="details-link" onClick={() => { onModalOpen(); setDetailsOpen(true); }}>Ver detalles completos <ChevronRight size={15}/></button>
      </div>
    </motion.article>
    {typeof document !== "undefined" && createPortal(<AnimatePresence>{visible && active && detailsOpen && <motion.div className="sheet-backdrop deck-details-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setDetailsOpen(false)}><motion.section className="details-sheet deck-details-modal" initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} transition={{ type: "spring", damping: 30, stiffness: 280 }} onClick={(event) => event.stopPropagation()} role="dialog" aria-modal="true" aria-label="Detalles completos">
      <header className="deck-details-header"><div className="deck-details-heading"><h2>{title}</h2><p>{detailPosition} · {detailLocation}</p><div><span><MapPin size={13}/>{formatDistance(card.distanceKm ?? 0)}</span>{detailBadge&&<span>{detailBadge}</span>}</div></div><CloseButton className="sheet-close" onClick={() => setDetailsOpen(false)} label="Cerrar detalles"/></header>
      <div className="deck-details-body">{job ? <OfferDetails offer={job}/> : worker && <CandidateDetails worker={worker} audioRef={audioRef} audioPlaying={audioPlaying} onToggleAudio={toggleAudio}/>}</div>
      <footer className={`deck-details-actions ${role==="company"&&worker&&!worker.is_demo&&isPro?"has-pro-actions":""}`}>
        {role==="company"&&worker&&!worker.is_demo&&isPro&&<button className="secondary-button pro-contact-button" onClick={()=>{setDetailsOpen(false);onContactDirect(card);}}><MessageCircle size={16}/> Escribir con Pro</button>}
        <div className="deck-details-choice-actions">
          <button className="secondary-button" onClick={() => { setDetailsOpen(false); onSwipe(card, "left"); }}><X size={17}/> Rechazar</button>
          <button className="primary-button" onClick={() => { setDetailsOpen(false); onSwipe(card, "right"); }}><Heart size={17} fill="currentColor"/> {isWorker ? "Aplicar" : "Me interesa"}</button>
        </div>
      </footer>
    </motion.section></motion.div>}</AnimatePresence>, document.body)}
  </>;
}

function OfferSummary({ offer }: { offer: JobOffer }) {
  return <><div className="salary-highlight"><b>{offer.salary_text}</b><span>{offer.shift_type}</span></div><h3>{offer.position}</h3><div className="schedule-line"><Clock3 size={14}/>{offer.schedule || offer.shift_type}</div><div className="benefit-chips">{(offer.benefits ?? []).slice(0, 3).map((benefit) => <span key={benefit}><Check size={12}/>{benefit}</span>)}</div><div className="verified-row"><BadgeCheck size={14}/> Oferta activa · {offer.sector}</div></>;
}

function WorkerSummary({ worker, audioRef, audioPlaying, onToggleAudio }: { worker: WorkerCard; audioRef: React.RefObject<HTMLAudioElement | null>; audioPlaying: boolean; onToggleAudio: () => void }) {
  return <><div className="candidate-heading"><div><span className="eyebrow">BUSCA</span><h3>{worker.desired_position}</h3></div><span className="availability-badge">{worker.availability_note || availabilityLabel(worker.availability)}</span></div><div className="candidate-meta"><span>{worker.experience_years} años de experiencia</span><span>{worker.sector}</span></div>{worker.bio&&<p className="candidate-bio">{worker.bio}</p>}<div className="skill-list">{worker.skills.slice(0, 4).map((skill) => <span key={skill}>{skill}</span>)}</div>{worker.intro_audio_path && <AudioPitch source={worker.intro_audio_path} audioRef={audioRef} playing={audioPlaying} onToggle={onToggleAudio}/>}</>;
}

function CandidateDetails({ worker, audioRef, audioPlaying, onToggleAudio }: { worker: WorkerCard; audioRef: React.RefObject<HTMLAudioElement | null>; audioPlaying: boolean; onToggleAudio: () => void }) {
  const mobility = worker.skills.filter((skill) => /carnet|veh[ií]culo|conducir/i.test(skill));
  const skills = worker.skills.filter((skill) => !mobility.includes(skill));
  return <div className="sheet-content details-card-stack">
    {worker.bio && <DetailCard title="Presentación"><DetailRow icon={<UserRound/>}>{worker.bio}</DetailRow></DetailCard>}
    <DetailCard title="Experiencia y disponibilidad"><DetailRow icon={<BriefcaseBusiness/>}><b>{worker.desired_position}</b><span>{worker.experience_years} años de experiencia</span></DetailRow><DetailRow icon={<Clock3/>}>{worker.availability_note || availabilityLabel(worker.availability)}</DetailRow></DetailCard>
    <DetailCard title="Formación e idiomas">{worker.education_level && <DetailRow icon={<GraduationCap/>}>{worker.education_level}</DetailRow>}{(worker.languages ?? []).length > 0 ? <DetailRow icon={<Languages/>}><div className="detail-chips">{worker.languages!.map((language) => <span key={language}>{language}</span>)}</div></DetailRow> : <DetailRow icon={<Languages/>}>Idiomas no indicados</DetailRow>}</DetailCard>
    {skills.length > 0 && <DetailCard title="Habilidades"><div className="detail-chips">{skills.map((skill) => <span key={skill}>{skill}</span>)}</div></DetailCard>}
    {mobility.length > 0 && <DetailCard title="Carnet de conducir y movilidad"><DetailRow icon={<CarFront/>}><div className="detail-chips">{mobility.map((skill) => <span key={skill}>{skill}</span>)}</div></DetailRow></DetailCard>}
    {worker.intro_audio_path && <DetailCard title="Presentación de voz"><AudioPitch source={worker.intro_audio_path} audioRef={audioRef} playing={audioPlaying} onToggle={onToggleAudio}/></DetailCard>}
  </div>;
}

function OfferDetails({ offer }: { offer: JobOffer }) {
  const mapUrl = `https://www.google.com/maps?q=${offer.lat},${offer.lng}`;
  const phone = (offer as JobOffer & { business_phone?: string }).business_phone;
  return <div className="sheet-content details-card-stack">
    <DetailCard title="Sobre el negocio"><DetailRow icon={<Building2/>}><b>{offer.business_name}</b><span>{offer.sector}</span></DetailRow><DetailRow icon={<BriefcaseBusiness/>}>{offer.description}</DetailRow></DetailCard>
    <DetailCard title="Condiciones del puesto"><DetailRow icon={<BriefcaseBusiness/>}><b>Puesto vinculado</b><span>{offer.position}</span></DetailRow><DetailRow icon={<span className="detail-euro">€</span>}><b>Salario</b><span>{offer.salary_text}</span></DetailRow><DetailRow icon={<Clock3/>}><b>Jornada / turno</b><span>{offer.shift_type}{offer.schedule ? ` · ${offer.schedule}` : ""}</span></DetailRow>{offer.benefits?.length > 0 && <div className="detail-chips">{offer.benefits.map((benefit) => <span key={benefit}><Check size={12}/>{benefit}</span>)}</div>}</DetailCard>
    <DetailCard title="Ubicación y contacto"><DetailRow icon={<MapPin/>}><span>{offer.address_approx ? `${offer.address_approx}, ` : ""}{offer.city}</span></DetailRow><a className="detail-map-link" href={mapUrl} target="_blank" rel="noreferrer"><MapPin size={15}/> Ver zona en el mapa</a>{phone && <a className="detail-map-link" href={`tel:${phone.replace(/[^+\d]/g, "")}`}><Phone size={15}/> Llamar al negocio · {phone}</a>}</DetailCard>
  </div>;
}

function DetailCard({ title, children }: { title: string; children: React.ReactNode }) { return <section className="detail-card"><h3>{title}</h3><div className="detail-card-content">{children}</div></section>; }
function DetailRow({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) { return <div className="detail-row"><span className="detail-row-icon">{icon}</span><div className="detail-row-copy">{children}</div></div>; }

function AudioPitch({ source, audioRef, playing, onToggle }: { source: string; audioRef: React.RefObject<HTMLAudioElement | null>; playing: boolean; onToggle: () => void }) {
  return <div className={`pitch-player ${playing ? "playing" : ""}`}><audio ref={audioRef} src={source} preload="none" onEnded={onToggle} className="hidden-audio"/><button type="button" className="pitch-play" aria-label={playing ? "Pausar presentación" : "Escuchar presentación"} onClick={onToggle}>{playing ? <Pause size={15}/> : <Play size={15} fill="currentColor"/>}</button><div className="pitch-wave" aria-label="Audio de presentación de hasta 15 segundos">{Array.from({ length: 27 }, (_, index) => <i key={index} style={{ "--bar": `${7 + (index * 13) % 19}px` } as React.CSSProperties}/>)}</div><span>Presentación · 0:15</span></div>;
}

function formatDistance(km: number) { return km < 1 ? `a ${Math.max(100, Math.round(km * 1000 / 100) * 100)} m` : `a ${km.toLocaleString("es-ES", { maximumFractionDigits: 1 })} km`; }
function availabilityLabel(value: string) { return ({ inmediata: "Inmediata", fines_de_semana: "Fines de semana", media_jornada: "Media jornada", completa: "Jornada completa" } as Record<string, string>)[value] ?? value; }
function sectorSlug(value: string) { return value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z]+/g, "-"); }
function SectorIcon({ sector }: { sector: string }) { const Icon = sector === "Hostelería" ? Utensils : sector === "Comercio" ? Store : sector === "Logística" ? Truck : sector === "Atención al cliente" ? Headset : BriefcaseBusiness; return <Icon size={50} strokeWidth={1.5}/>; }
