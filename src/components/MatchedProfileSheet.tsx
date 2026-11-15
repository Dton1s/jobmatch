"use client";

import { useEffect, useState } from "react";
import { BriefcaseBusiness, CarFront, Check, Clock3, Languages, MapPin, Phone, ShieldCheck, Sparkles, X } from "lucide-react";
import { Avatar } from "@/components/Avatar";
import { supabase, type JobOffer, type Profile, type Role, type WorkerCard } from "@/lib/supabase";

export function MatchedProfileSheet({ profileId, matchId, viewerRole, onClose }: { profileId: string; matchId: string; viewerRole: Role | null; onClose: () => void }) {
  const [person, setPerson] = useState<Profile | null>(null);
  const [worker, setWorker] = useState<WorkerCard | null>(null);
  const [offer, setOffer] = useState<JobOffer | null>(null);
  const [companyPhone, setCompanyPhone] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const isWorkerViewer = viewerRole === "worker";

  useEffect(() => {
    let alive = true;
    async function load() {
      if (!supabase) return;
      setLoading(true); setError("");
      const [profileResult, matchResult, contactResult] = await Promise.all([
        supabase.from("jobmatch_profiles").select("*").eq("id", profileId).maybeSingle(),
        supabase.from("jobmatch_matches").select("worker_card_id,job_offer_id").eq("id", matchId).maybeSingle(),
        isWorkerViewer ? supabase.from("jobmatch_company_contacts").select("phone").eq("company_id", profileId).maybeSingle() : Promise.resolve({ data: null, error: null }),
      ]);
      if (!alive) return;
      if (matchResult.error || !matchResult.data) {
        console.error("Perfil ampliado: no se pudo leer el match", matchResult.error);
        setError(matchResult.error?.message || "No se pudo localizar esta conexión."); setLoading(false); return;
      }
      const detailResult = isWorkerViewer
        ? await supabase.from("jobmatch_job_offers").select("*").eq("id", matchResult.data.job_offer_id).maybeSingle()
        : await supabase.from("jobmatch_worker_cards").select("*").eq("id", matchResult.data.worker_card_id).maybeSingle();
      if (!alive) return;
      const linkedOffer = isWorkerViewer ? detailResult.data as JobOffer | null : null;
      const linkedWorker = isWorkerViewer ? null : detailResult.data as WorkerCard | null;
      if (linkedOffer) setOffer(linkedOffer);
      if (linkedWorker) setWorker(linkedWorker);
      if (profileResult.error) console.error("Perfil ampliado: perfil base no disponible, usando la ficha vinculada", profileResult.error);
      const fallback = isWorkerViewer && linkedOffer
        ? profileFromOffer(linkedOffer, profileId)
        : !isWorkerViewer && linkedWorker ? profileFromWorker(linkedWorker, profileId) : null;
      if (!profileResult.data && !fallback) {
        console.error("Perfil ampliado: ni el perfil base ni la ficha vinculada están disponibles", detailResult.error);
        setError("No se pudo cargar la ficha vinculada a este match."); setLoading(false); return;
      }
      setPerson((profileResult.data as Profile | null) ?? fallback);
      setCompanyPhone(contactResult.data?.phone ?? "");
      if (detailResult.error && !fallback) setError("Algunos datos de la ficha no están disponibles.");
      setLoading(false);
    }
    void load();
    return () => { alive = false; };
  }, [profileId, matchId, isWorkerViewer]);

  const name = isWorkerViewer ? person?.company_name || person?.display_name : person?.full_name || worker?.full_name || person?.display_name;
  const avatar = isWorkerViewer ? person?.company_logo_url || offer?.business_image_path : person?.avatar_url;
  const audio = person?.default_audio_url || worker?.intro_audio_path;
  const hasLicense = Boolean(person?.has_driving_license || worker?.skills.some((skill) => /carnet/i.test(skill)));
  const hasVehicle = Boolean(person?.has_own_vehicle || worker?.skills.some((skill) => /veh[ií]culo/i.test(skill)));

  return <div className="sheet-backdrop profile-sheet-backdrop" onClick={onClose}>
    <section className="details-sheet matched-profile-sheet" role="dialog" aria-modal="true" aria-labelledby="matched-profile-title" onClick={(event) => event.stopPropagation()}>
      <div className="sheet-handle"/><button className="sheet-close" onClick={onClose} aria-label="Cerrar perfil"><X size={18}/></button>
      {loading ? <div className="profile-sheet-loading"><span className="loader"/><p>Cargando perfil ampliado…</p></div> : error && !person ? <p className="form-error">{error}</p> : person && <>
        <div className="matched-profile-hero"><Avatar className="matched-profile-avatar" src={avatar} name={name}/><div className="matched-profile-heading"><span className="eyebrow">{isWorkerViewer ? "NEGOCIO CONECTADO" : "PERFIL PROFESIONAL"}</span><h2 id="matched-profile-title">{name}</h2><p>{isWorkerViewer ? `${person.company_sector || offer?.sector || "Empresa local"}${person.city ? ` · ${person.city}` : ""}` : `${worker?.desired_position || "Profesional"}${worker?.age ? ` · ${worker.age} años` : person.birth_year ? ` · ${new Date().getFullYear() - person.birth_year} años` : ""}${person.city ? ` · ${person.city}` : ""}`}</p></div></div>
        {isWorkerViewer ? <>
          <section className="profile-detail-section"><h3><BriefcaseBusiness size={16}/> Sobre el negocio</h3><p>{person.company_description || offer?.description || "Este negocio aún no ha añadido una descripción."}</p></section>
          <section className="profile-detail-grid"><div><span>Puesto vinculado</span><b>{offer?.position || "Match laboral"}</b></div><div><span>Salario</span><b>{offer?.salary_text || "Consultar condiciones"}</b></div></section>
          {offer?.description && <section className="profile-detail-section"><h3>Detalles de la oferta</h3><p>{offer.description}</p><small>{offer.shift_type}{offer.schedule ? ` · ${offer.schedule}` : ""}</small></section>}
          {(person.company_address || offer?.address_approx) && <section className="profile-detail-section"><h3><MapPin size={16}/> Dirección</h3><p>{person.company_address || offer?.address_approx}{person.city ? `, ${person.city}` : ""}</p></section>}
          {person.show_phone_on_match && (companyPhone || person.company_phone) && <a className="profile-phone-link" href={`tel:${(companyPhone || person.company_phone).replace(/[^+\d]/g, "")}`}><Phone size={16}/> Llamar al negocio · {companyPhone || person.company_phone}</a>}
        </> : <>
          <section className="profile-detail-section profile-presentation"><h3>Presentación</h3><p>{person.default_bio || worker?.bio || "Este profesional aún no ha añadido una presentación."}</p></section>
          <section className="profile-detail-grid profile-stats-grid"><div><span>Experiencia</span><b>{worker?.experience_years ?? person.experience_years ?? 0} años</b></div><div><span>Disponibilidad</span><b>{worker?.availability_note || worker?.availability || "Consultar"}</b></div></section>
          <section className="profile-detail-section"><h3><span className="profile-icon-chip"><Languages className="profile-detail-icon" size={16}/></span> Idiomas</h3><div className="skill-list">{(person.languages ?? []).map((language) => <span key={language}>{language}</span>)}{!person.languages?.length && <p>Sin idiomas indicados.</p>}</div></section>
          {worker?.skills?.length ? <section className="profile-detail-section"><h3><span className="profile-icon-chip"><Sparkles className="profile-detail-icon" size={16}/></span> Habilidades</h3><div className="skill-list">{worker.skills.map((skill) => <span key={skill}>{skill}</span>)}</div></section> : null}
          {(hasLicense || hasVehicle) && <section className="profile-credentials">{hasLicense && <span><ShieldCheck size={15}/> Carnet de conducir</span>}{hasVehicle && <span><CarFront size={15}/> Vehículo propio</span>}</section>}
          {(worker?.cv_url || person.cv_url) && <a className="cv-match-link" href={worker?.cv_url || person.cv_url || undefined} target="_blank" rel="noopener noreferrer"><BriefcaseBusiness size={16}/>📄 Ver Currículum (PDF)<small>{worker?.cv_filename || person.cv_filename || "Abrir documento"}</small></a>}
          {audio && <section className="profile-detail-section"><h3><Clock3 size={16}/> Presentación de voz</h3><audio className="base-audio-preview" controls preload="none" src={audio}/></section>}
        </>}
        {error && <p className="form-footnote">{error}</p>}
      </>}
    </section>
  </div>;
}

function profileFromOffer(offer: JobOffer, id: string): Profile {
  return {
    id, role: "company", display_name: offer.business_name, city: offer.city, lat: offer.lat, lng: offer.lng,
    avatar_path: offer.business_image_path, onboarding_complete: true, avatar_url: offer.business_image_path,
    full_name: "", birth_year: null, experience_years: 0, has_driving_license: false, has_own_vehicle: false,
    languages: [], default_bio: "", default_audio_url: null, cv_url: null, cv_filename: null, company_name: offer.business_name,
    company_logo_url: offer.business_image_path, company_sector: offer.sector, company_address: offer.address_approx,
    company_description: offer.description, company_phone: "", show_phone_on_match: false,
  };
}

function profileFromWorker(worker: WorkerCard, id: string): Profile {
  return {
    id, role: "worker", display_name: worker.full_name, city: worker.city, lat: worker.lat, lng: worker.lng,
    avatar_path: worker.photo_path, onboarding_complete: true, avatar_url: worker.photo_path,
    full_name: worker.full_name, birth_year: worker.age ? new Date().getFullYear() - worker.age : null,
    experience_years: worker.experience_years, has_driving_license: worker.skills.some((skill) => /carnet/i.test(skill)),
    has_own_vehicle: worker.skills.some((skill) => /veh[ií]culo/i.test(skill)), languages: [], default_bio: worker.bio,
    default_audio_url: worker.intro_audio_path, cv_url: worker.cv_url, cv_filename: worker.cv_filename, company_name: "", company_logo_url: null, company_sector: "",
    company_address: "", company_description: "", company_phone: "", show_phone_on_match: false,
  };
}
