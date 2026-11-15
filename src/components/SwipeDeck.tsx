"use client";

import { AnimatePresence, motion, useMotionValue, useTransform } from "framer-motion";
import { ArrowDownLeft, BadgeCheck, BriefcaseBusiness, CalendarClock, Check, ChevronRight, Clock3, MapPin, Pause, Play, RotateCcw, Star, X, Heart } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { JobOffer, Role, SwipeDirection, WorkerCard } from "@/lib/supabase";

export type DeckCard = (WorkerCard & { distanceKm?: number; interested?: boolean }) | (JobOffer & { distanceKm?: number });

export function SwipeDeck({ role, offer, distance, cards, loading, undoAvailable, onSwipe, onEdit, onCreateOffer, onUndo, onShowFilters }: {
  role: Role; offer: JobOffer | null; distance:number; cards: DeckCard[]; loading: boolean; undoAvailable: boolean;
  onSwipe: (card: DeckCard, direction: SwipeDirection) => void; onEdit: () => void;
  onCreateOffer: () => void; onUndo: () => void; onShowFilters: () => void;
}) {
  const card = cards[0];
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [audioPlaying, setAudioPlaying] = useState(false);
  const x = useMotionValue(0);
  const rotate = useTransform(x, [-220, 220], [-12, 12]);
  const noOpacity = useTransform(x, [-115, -20], [1, 0]);
  const yesOpacity = useTransform(x, [20, 115], [0, 1]);
  const audioRef = useRef<HTMLAudioElement>(null);
  const isWorker = role === "worker";
  const job = isWorker ? card as JobOffer | undefined : undefined;
  const worker = isWorker ? undefined : card as (WorkerCard & {interested?:boolean}) | undefined;
  const image = isWorker ? job?.business_image_path : worker?.photo_path;
  const title = isWorker ? job?.business_name : worker?.full_name;
  const sector = (isWorker ? job?.sector : worker?.sector) ?? "";

  useEffect(() => { x.set(0); setDetailsOpen(false); setAudioPlaying(false); }, [card?.id, x]);

  function swipe(direction: SwipeDirection) { if (card) onSwipe(card, direction); }
  function toggleAudio() {
    if (!audioRef.current) return;
    if (audioPlaying) audioRef.current.pause(); else void audioRef.current.play();
    setAudioPlaying(!audioPlaying);
  }

  return <section className="deck-area">
    <div className="deck-heading compact-deck-heading"><div className="deck-context">{isWorker?<><b>Ofertas cerca de ti</b><span>· {distance} km</span></>:<><span>Buscando:</span><b>{offer?.position??"Elige una oferta"}</b>{offer?.salary_text&&<small>{offer.salary_text}</small>}<button onClick={onCreateOffer}>Cambiar</button></>}</div><button className="deck-radius" onClick={onShowFilters} aria-label={`Cambiar radio de búsqueda, actualmente ${distance} kilómetros`}><MapPin size={14}/>{distance} km</button></div>
    <div className="deck-stack">
      {loading && <div className="deck-state"><div className="loader"/><p>Buscando buenas coincidencias cerca…</p></div>}
      {!loading && !card && <div className="empty-card"><div className="empty-icon">✳</div><span className="eyebrow">MAZO AL DÍA</span><h2>Ya has visto todo por ahora</h2><p>Amplía el radio o ajusta el sector para descubrir más oportunidades en tu zona.</p><button className="primary-button" onClick={onShowFilters}>Ajustar filtros</button><button className="quiet-button" onClick={onUndo} disabled={!undoAvailable}><RotateCcw size={14}/> Deshacer último swipe</button></div>}
      <AnimatePresence mode="popLayout">
        {card && !loading && <motion.article key={`${role}-${card.id}`} className="swipe-card" style={{ x, rotate, touchAction: "pan-y" }} drag="x" dragDirectionLock dragConstraints={{ left: 0, right: 0 }} dragElastic={0.84} dragMomentum={false} onDragEnd={(_, info) => { if (info.offset.x > 105) swipe("right"); else if (info.offset.x < -105) swipe("left"); else x.set(0); }} initial={{ opacity: 0, scale: .95, y: 16 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ x: 390, opacity: 0, rotate: 14 }} transition={{ type: "spring", stiffness: 360, damping: 29 }}>
          <div className={`card-cover ${image ? "has-photo" : "no-photo"} sector-${sectorSlug(sector)}`} style={image ? { backgroundImage: `linear-gradient(to top, rgba(15,23,42,0.92) 0%, rgba(15,23,42,0.5) 45%, transparent 100%),url(${image})` } : undefined}>
            <div className="cover-topline">{card.is_demo && <span className="demo-badge">Perfil de ejemplo</span>}<span className="distance-pill"><MapPin size={13}/>{formatDistance(card.distanceKm ?? 0)}</span></div>
            <div className="sector-symbol" aria-hidden="true">{image ? sectorIcon(sector) : initials(title)}</div>
            <div className="cover-copy"><span className="cover-sector">{isWorker ? sector : worker?.city}</span><h2>{title}</h2><p>{isWorker ? job?.position : worker?.age ? `${worker.age} años · ${worker.city}` : worker?.city}</p></div>
            {worker?.interested && <div className="interest-pill">Le interesa tu oferta</div>}
            <motion.div className="swipe-stamp stamp-no" style={{ opacity: noOpacity }}>PASAR</motion.div><motion.div className="swipe-stamp stamp-yes" style={{ opacity: yesOpacity }}>ME INTERESA</motion.div>
          </div>
          <div className="card-details">
            {isWorker && job ? <OfferSummary offer={job}/> : worker && <WorkerSummary worker={worker} audioRef={audioRef} audioPlaying={audioPlaying} onToggleAudio={toggleAudio}/>}
            <button className="details-link" onClick={()=>setDetailsOpen(true)}>Ver detalles completos <ChevronRight size={15}/></button>
          </div>
        </motion.article>}
      </AnimatePresence>
    </div>
    <div className="deck-actions"><button className="action-circle action-no" onClick={()=>swipe("left")} aria-label="Pasar"><X size={23}/></button><button className="action-circle action-undo" onClick={onUndo} disabled={!undoAvailable} aria-label="Deshacer último swipe" title="Deshacer último swipe"><RotateCcw size={17}/></button><button className="action-circle action-yes" onClick={()=>swipe("right")} aria-label="Me interesa"><Heart size={22} fill="currentColor"/></button></div>
    <button className="undo-caption" disabled={!undoAvailable} onClick={onUndo}>{undoAvailable ? <><RotateCcw size={12}/> Deshacer último swipe</> : "Desliza la tarjeta o toca una acción"}</button>
    <AnimatePresence>{detailsOpen && card && <motion.div className="sheet-backdrop" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} onClick={()=>setDetailsOpen(false)}><motion.section className="details-sheet" initial={{y:"100%"}} animate={{y:0}} exit={{y:"100%"}} transition={{type:"spring",damping:30,stiffness:280}} onClick={(event)=>event.stopPropagation()} role="dialog" aria-modal="true" aria-label="Detalles completos"><div className="sheet-handle"/><button className="sheet-close" onClick={()=>setDetailsOpen(false)} aria-label="Cerrar"><X size={18}/></button>{isWorker && job ? <OfferDetails offer={job}/> : worker && <CandidateDetails worker={worker} audioRef={audioRef} audioPlaying={audioPlaying} onToggleAudio={toggleAudio}/>}<div className="sheet-actions"><button className="secondary-button" onClick={()=>swipe("left")}><X size={16}/> Pasar</button><button className="primary-button" onClick={()=>swipe("right")}><Heart size={16}/> Me interesa</button></div></motion.section></motion.div>}</AnimatePresence>
  </section>;
}

function OfferSummary({offer}:{offer:JobOffer}) {
  return <><div className="salary-highlight"><b>{offer.salary_text}</b><span>{offer.shift_type}</span></div><h3>{offer.position}</h3><div className="schedule-line"><Clock3 size={14}/>{offer.schedule || offer.shift_type}</div><div className="benefit-chips">{(offer.benefits ?? []).slice(0,3).map((benefit)=><span key={benefit}><Check size={12}/>{benefit}</span>)}</div><div className="verified-row"><BadgeCheck size={14}/> Oferta activa · {offer.sector}</div></>;
}

function WorkerSummary({worker,audioRef,audioPlaying,onToggleAudio}:{worker:WorkerCard;audioRef:React.RefObject<HTMLAudioElement|null>;audioPlaying:boolean;onToggleAudio:()=>void}) {
  return <><div className="candidate-heading"><div><span className="eyebrow">BUSCA</span><h3>{worker.desired_position}</h3></div><span className="availability-badge">{worker.availability_note || availabilityLabel(worker.availability)}</span></div><div className="candidate-meta"><span>{worker.experience_years} años de experiencia</span><span>{worker.sector}</span></div><p className="candidate-bio">{worker.bio || "Perfil profesional con experiencia y ganas de incorporarse a un nuevo equipo."}</p><div className="skill-list">{worker.skills.slice(0,4).map((skill)=><span key={skill}>{skill}</span>)}</div>{worker.intro_audio_path && <AudioPitch source={worker.intro_audio_path} audioRef={audioRef} playing={audioPlaying} onToggle={onToggleAudio}/>}</>;
}

function CandidateDetails({worker,audioRef,audioPlaying,onToggleAudio}:{worker:WorkerCard;audioRef:React.RefObject<HTMLAudioElement|null>;audioPlaying:boolean;onToggleAudio:()=>void}) {
  return <div className="sheet-content"><span className="eyebrow">PERFIL PROFESIONAL {worker.is_demo && "· DEMOSTRACIÓN"}</span><h2>{worker.full_name}{worker.age ? `, ${worker.age}` : ""}</h2><p className="sheet-subtitle">{worker.desired_position} · {worker.city}</p><section className="detail-block"><h3>Sobre mí</h3><p>{worker.bio || "Perfil profesional con experiencia y ganas de incorporarse a un nuevo equipo."}</p></section><section className="detail-block"><h3>Experiencia y disponibilidad</h3><p>{worker.experience_years} años · {worker.availability_note || availabilityLabel(worker.availability)}</p></section><section className="detail-block"><h3>Habilidades</h3><div className="skill-list">{worker.skills.map((skill)=><span key={skill}>{skill}</span>)}</div></section>{worker.intro_audio_path && <AudioPitch source={worker.intro_audio_path} audioRef={audioRef} playing={audioPlaying} onToggle={onToggleAudio}/>}</div>;
}

function OfferDetails({offer}:{offer:JobOffer}) {
  const mapUrl = `https://www.google.com/maps?q=${offer.lat},${offer.lng}`;
  return <div className="sheet-content"><span className="eyebrow">{offer.sector} {offer.is_demo && "· OFERTA DE EJEMPLO"}</span><h2>{offer.position}</h2><p className="sheet-subtitle">{offer.business_name} · {offer.city}</p><section className="detail-block salary-detail"><span>Salario publicado</span><b>{offer.salary_text}</b></section><section className="detail-block"><h3>Jornada y horario</h3><p>{offer.shift_type}{offer.schedule ? ` · ${offer.schedule}` : ""}</p></section>{offer.benefits?.length>0 && <section className="detail-block"><h3>Condiciones y beneficios</h3><div className="benefit-chips">{offer.benefits.map((benefit)=><span key={benefit}><Check size={12}/>{benefit}</span>)}</div></section>}<section className="detail-block"><h3>El puesto</h3><p>{offer.description}</p></section><section className="detail-block map-block"><div className="mini-map"><MapPin size={27}/><span>{offer.address_approx || offer.city}</span></div><a href={mapUrl} target="_blank" rel="noreferrer"><MapPin size={14}/> Ver zona aproximada en el mapa</a></section></div>;
}

function AudioPitch({source,audioRef,playing,onToggle}:{source:string;audioRef:React.RefObject<HTMLAudioElement|null>;playing:boolean;onToggle:()=>void}) {
  return <div className={`pitch-player ${playing?"playing":""}`}><audio ref={audioRef} src={source} preload="none" onEnded={()=>onToggle()} className="hidden-audio"/><button type="button" className="pitch-play" aria-label={playing?"Pausar presentación":"Escuchar presentación"} onClick={onToggle}>{playing?<Pause size={15}/>:<Play size={15} fill="currentColor"/>}</button><div className="pitch-wave" aria-label="Audio de presentación de hasta 15 segundos">{Array.from({length:27},(_,index)=><i key={index} style={{"--bar":`${7+(index*13)%19}px`} as React.CSSProperties}/>)}</div><span>Presentación · 0:15</span></div>;
}

function formatDistance(km:number){return km<1?`a ${Math.max(100,Math.round(km*1000/100)*100)} m`:`a ${km.toLocaleString("es-ES",{maximumFractionDigits:1})} km`;}
function availabilityLabel(value:string){return ({inmediata:"Inmediata",fines_de_semana:"Fines de semana",media_jornada:"Media jornada",completa:"Jornada completa"} as Record<string,string>)[value]??value;}
function sectorSlug(value:string){return value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z]+/g,"-");}
function sectorIcon(value:string){if(value==="Hostelería")return "✳";if(value==="Comercio")return "◈";if(value==="Logística")return "↗";if(value==="Atención al cliente")return "◎";return "+";}
function initials(value?:string){return value?.trim().split(/\s+/).slice(0,2).map((part)=>part[0]?.toUpperCase()).join("")||"JM";}
