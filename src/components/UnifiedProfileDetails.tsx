"use client";

import { useState, type ReactNode, type RefObject } from "react";
import { BadgeCheck, BriefcaseBusiness, Building2, CarFront, Check, Clock3, FileText, GraduationCap, Languages, MapPin, Pause, Phone, Play, UserRound } from "lucide-react";
import type { JobOffer, WorkerCard } from "@/lib/supabase";
import { openCvReference } from "@/lib/cv-storage";

export function WorkerDetailsContent({ worker, languages, educationLevel, hasLicense, hasVehicle, allowCv = false, audioRef, audioPlaying = false, onToggleAudio }: {
  worker: WorkerCard; languages?: string[]; educationLevel?: string; hasLicense?: boolean; hasVehicle?: boolean; allowCv?: boolean;
  audioRef?: RefObject<HTMLAudioElement | null>; audioPlaying?: boolean; onToggleAudio?: () => void;
}) {
  const [cvBusy, setCvBusy] = useState(false);
  const [cvError, setCvError] = useState("");
  const mobility = worker.skills.filter((skill) => /carnet|veh[ií]culo|conducir/i.test(skill));
  if (hasLicense && !mobility.some((item) => /carnet|conducir/i.test(item))) mobility.push("Carnet de conducir");
  if (hasVehicle && !mobility.some((item) => /veh[ií]culo/i.test(item))) mobility.push("Vehículo propio");
  const skills = worker.skills.filter((skill) => !/carnet|veh[ií]culo|conducir/i.test(skill));
  const workerLanguages = languages ?? worker.languages ?? [];
  const cv = worker.cv_url;

  async function viewCv() {
    if (!cv || !worker.user_id || cvBusy) return;
    setCvBusy(true); setCvError("");
    try { await openCvReference(cv, worker.user_id); }
    catch (cause) { setCvError(cause instanceof Error ? cause.message : "No se pudo abrir el currículum."); }
    finally { setCvBusy(false); }
  }

  return <div className="sheet-content details-card-stack">
    <DetailCard title="Presentación"><DetailRow icon={<UserRound/>}>{worker.bio || "Aún no ha añadido una presentación."}</DetailRow></DetailCard>
    <DetailCard title="Experiencia y disponibilidad"><DetailRow icon={<BriefcaseBusiness/>}><b>{worker.desired_position}</b><span>{worker.experience_years} años de experiencia</span></DetailRow><DetailRow icon={<Clock3/>}>{worker.availability_note || availabilityLabel(worker.availability)}</DetailRow></DetailCard>
    <DetailCard title="Formación e idiomas">{educationLevel || worker.education_level ? <DetailRow icon={<GraduationCap/>}>{educationLevel || worker.education_level}</DetailRow> : null}{workerLanguages.length > 0 ? <DetailRow icon={<Languages/>}><ChipList values={workerLanguages}/></DetailRow> : <DetailRow icon={<Languages/>}>Idiomas no indicados</DetailRow>}</DetailCard>
    <DetailCard title="Habilidades">{skills.length ? <ChipList values={skills}/> : <DetailRow icon={<BriefcaseBusiness/>}>Aún no ha indicado habilidades.</DetailRow>}</DetailCard>
    <DetailCard title="Carnet de conducir / movilidad"><DetailRow icon={<CarFront/>}>{mobility.length ? <ChipList values={mobility}/> : <span>Sin información de carnet o vehículo.</span>}</DetailRow></DetailCard>
    {allowCv && cv && worker.user_id && <DetailCard title="Currículum"><button type="button" className="detail-map-link cv-detail-link" onClick={() => void viewCv()} disabled={cvBusy}><FileText size={15}/>{cvBusy ? "Preparando PDF…" : "Ver currículum (PDF)"}{worker.cv_filename ? <span>{worker.cv_filename}</span> : null}</button>{cvError && <p className="form-error" role="alert">{cvError}</p>}</DetailCard>}
    {worker.intro_audio_path && <DetailCard title="Presentación de voz">{audioRef && onToggleAudio ? <AudioPitch source={worker.intro_audio_path} audioRef={audioRef} playing={audioPlaying} onToggle={onToggleAudio}/> : <audio className="base-audio-preview" controls preload="none" src={worker.intro_audio_path}/>}</DetailCard>}
  </div>;
}

export function OfferDetailsContent({ offer, phone, businessDescription, address }: { offer: JobOffer; phone?: string; businessDescription?: string; address?: string }) {
  const mapUrl = `https://www.google.com/maps?q=${offer.lat},${offer.lng}`;
  return <div className="sheet-content details-card-stack">
    <DetailCard title="Sobre el negocio"><DetailRow icon={<Building2/>}><b>{offer.business_name}</b><span>{offer.sector}</span></DetailRow><DetailRow icon={<BriefcaseBusiness/>}>{businessDescription || offer.description}</DetailRow></DetailCard>
    <DetailCard title="Condiciones del puesto"><DetailRow icon={<BriefcaseBusiness/>}><b>Puesto vinculado</b><span>{offer.position}</span></DetailRow><DetailRow icon={<span className="detail-euro">€</span>}><b>Salario</b><span>{offer.salary_text}</span></DetailRow><DetailRow icon={<Clock3/>}><b>Jornada / turno</b><span>{offer.shift_type}{offer.schedule ? ` · ${offer.schedule}` : ""}</span></DetailRow>{offer.benefits?.length > 0 && <ChipList values={offer.benefits} checks/>}</DetailCard>
    <DetailCard title="Ubicación y contacto"><DetailRow icon={<MapPin/>}><span>{address ? `${address}, ` : offer.address_approx ? `${offer.address_approx}, ` : ""}{offer.city}</span></DetailRow><a className="detail-map-link" href={mapUrl} target="_blank" rel="noreferrer"><MapPin size={15}/> Ver zona en el mapa</a>{phone && <a className="detail-map-link" href={`tel:${phone.replace(/[^+\d]/g, "")}`}><Phone size={15}/> Llamar al negocio · {phone}</a>}</DetailCard>
  </div>;
}

function DetailCard({ title, children }: { title: string; children: ReactNode }) { return <section className="detail-card"><h3>{title}</h3><div className="detail-card-content">{children}</div></section>; }
function DetailRow({ icon, children }: { icon: ReactNode; children: ReactNode }) { return <div className="detail-row"><span className="detail-row-icon">{icon}</span><div className="detail-row-copy">{children}</div></div>; }
function ChipList({ values, checks = false }: { values: string[]; checks?: boolean }) { return <div className="detail-chips">{values.map((value) => <span key={value}>{checks && <Check size={12}/>}{value}</span>)}</div>; }
function AudioPitch({ source, audioRef, playing, onToggle }: { source: string; audioRef: RefObject<HTMLAudioElement | null>; playing: boolean; onToggle: () => void }) { return <div className={`pitch-player ${playing ? "playing" : ""}`}><audio ref={audioRef} src={source} preload="none" onEnded={onToggle} className="hidden-audio"/><button type="button" className="pitch-play" aria-label={playing ? "Pausar presentación" : "Escuchar presentación"} onClick={onToggle}>{playing ? <Pause size={15}/> : <Play size={15} fill="currentColor"/>}</button><div className="pitch-wave" aria-label="Audio de presentación de hasta 15 segundos">{Array.from({ length: 27 }, (_, index) => <i key={index} style={{ "--bar": `${7 + (index * 13) % 19}px` } as React.CSSProperties}/>)}</div><span>Presentación · 0:15</span></div>; }
function availabilityLabel(value: string) { return ({ inmediata: "Inmediata", fines_de_semana: "Fines de semana", media_jornada: "Media jornada", completa: "Jornada completa" } as Record<string, string>)[value] ?? value; }
