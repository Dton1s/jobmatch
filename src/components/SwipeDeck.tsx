"use client";

import { AnimatePresence, motion, useMotionValue, useTransform } from "framer-motion";
import { BriefcaseBusiness, CalendarClock, MapPin, Star, X, Heart, Sparkles, Volume2 } from "lucide-react";
import { useState } from "react";
import type { JobOffer, Role, SwipeDirection, WorkerCard } from "@/lib/supabase";

type DeckCard = (WorkerCard & { distanceKm?: number; interested?: boolean }) | (JobOffer & { distanceKm?: number });

export function SwipeDeck({ role, offer, cards, loading, onSwipe, onEdit, onCreateOffer }: {
  role: Role; offer: JobOffer | null; cards: DeckCard[]; loading: boolean;
  onSwipe: (card: DeckCard, direction: SwipeDirection) => void;
  onEdit: () => void; onCreateOffer: () => void;
}) {
  const [superEnabled] = useState(false); // Activar tras configurar suscripción y pagos.
  const card = cards[0];
  const coverImage = card ? (role === "worker" ? (card as JobOffer).business_image_path : (card as WorkerCard).photo_path) : null;
  const x = useMotionValue(0);
  const rotate = useTransform(x, [-220, 220], [-13, 13]);
  const leftOpacity = useTransform(x, [-120, -20], [1, 0]);
  const rightOpacity = useTransform(x, [20, 120], [0, 1]);

  function commit(direction: SwipeDirection) {
    if (!card) return;
    onSwipe(card, direction);
  }

  return <section className="deck-area">
    <div className="deck-heading"><div><span className="eyebrow">{role === "worker" ? "OFERTAS PARA TI" : "TALENTO LOCAL"}</span><h1>{role === "worker" ? "Un trabajo" : "La persona"}<br /><em>{role === "worker" ? "que encaja." : "que encaja."}</em></h1></div><button className="quiet-button" onClick={onEdit}>Editar ficha</button></div>
    {role === "company" && <div className="offer-picker">{offer ? <><BriefcaseBusiness size={16} /><span>Buscando para: <b>{offer.position}</b> · {offer.salary_text}</span><button onClick={onCreateOffer}>Cambiar oferta</button></> : <><span>Publica una oferta para empezar a descubrir perfiles.</span><button onClick={onCreateOffer}>Crear oferta +</button></>}</div>}
    <div className="deck-stack">
      {loading && <div className="empty-card"><div className="loader" /><p>Buscando perfiles cerca…</p></div>}
      {!loading && !card && <div className="empty-card"><div className="empty-icon">✳</div><h2>No hay más tarjetas por ahora</h2><p>Vuelve luego o amplía la distancia. Cada conexión empieza cerca.</p><button className="primary-button" onClick={onEdit}>Revisar filtros</button></div>}
      <AnimatePresence>
        {card && !loading && <motion.article key={card.id} className="swipe-card" style={{ x, rotate }} drag="x" dragConstraints={{ left: 0, right: 0 }} dragElastic={0.85} onDragEnd={(_, info) => { if (info.offset.x > 110) commit("right"); else if (info.offset.x < -110) commit("left"); }} initial={{ opacity: 0, scale: .94, y: 12 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ x: 400, opacity: 0, rotate: 16 }} transition={{ type: "spring", stiffness: 330, damping: 28 }}>
          <div className="card-cover" style={{ backgroundImage: `linear-gradient(180deg,transparent 30%,rgba(20,22,21,.8)),url(${coverImage || ""})` }}>
            <div className="distance-pill"><MapPin size={13} /> {card.distanceKm?.toFixed(1) ?? "—"} km</div>
            {role === "company" && (card as WorkerCard & { interested?: boolean }).interested && <div className="interest-pill">Le interesa tu oferta</div>}
            <div className="cover-copy"><h2>{role === "worker" ? (card as JobOffer).business_name : (card as WorkerCard).full_name}</h2><p>{role === "worker" ? (card as JobOffer).city : (card as WorkerCard).city}</p></div>
            <motion.div className="swipe-stamp stamp-no" style={{ opacity: leftOpacity }}>PASO</motion.div>
            <motion.div className="swipe-stamp stamp-yes" style={{ opacity: rightOpacity }}>¡ME INTERESA!</motion.div>
          </div>
          <div className="card-details">
            {role === "worker" ? <JobDetails card={card as JobOffer} /> : <WorkerDetails card={card as WorkerCard} />}
          </div>
        </motion.article>}
      </AnimatePresence>
    </div>
    <div className="swipe-actions">
      <button className="action-circle action-no" aria-label="Descartar" onClick={() => commit("left")}><X size={25} /></button>
      {role === "company" && <button className={`action-circle action-super ${!superEnabled ? "is-locked" : ""}`} aria-label="Propuesta directa" title="Propuesta directa: próximamente" onClick={() => superEnabled && commit("super")}><Star size={20} /></button>}
      <button className="action-circle action-yes" aria-label="Me interesa" onClick={() => commit("right")}><Heart size={24} fill="currentColor" /></button>
    </div>
    <p className="deck-hint">Desliza la tarjeta o usa los botones · Solo mostramos opciones cercanas</p>
  </section>;
}

function JobDetails({ card }: { card: JobOffer }) {
  return <><div className="job-salary">{card.salary_text}<small>{card.shift_type}</small></div><h3>{card.position}</h3><div className="detail-meta"><span>{card.sector}</span><span><CalendarClock size={14} /> Turno {card.shift_type}</span></div><p className="card-description">{card.description}</p><div className="offer-expiry">Oferta activa hasta {new Date(card.expires_at).toLocaleDateString("es-ES", { day: "numeric", month: "short" })}</div></>;
}

function WorkerDetails({ card }: { card: WorkerCard }) {
  return <><h3>{card.desired_position}</h3><div className="detail-meta"><span>{card.sector}</span><span>{card.experience_years} años exp.</span><span>{card.availability.replaceAll("_", " ")}</span></div><div className="skill-list">{card.skills.slice(0, 7).map((skill) => <span key={skill}>{skill}</span>)}</div>{card.intro_audio_path && <audio className="intro-audio" controls preload="none"><source src={card.intro_audio_path} /><Volume2 size={14} /> Presentación</audio>}</>;
}
