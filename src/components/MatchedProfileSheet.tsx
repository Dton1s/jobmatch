"use client";

import { useEffect, useState } from "react";
import { MessageCircle } from "lucide-react";
import { CloseButton } from "@/components/CloseButton";
import { Avatar } from "@/components/Avatar";
import { supabase, type JobOffer, type Profile, type Role, type WorkerCard } from "@/lib/supabase";
import { OfferDetailsContent, WorkerDetailsContent } from "@/components/UnifiedProfileDetails";

export function MatchedProfileSheet({ profileId, matchId, viewerRole, chatOpen, onClose, onOpenChat }: { profileId: string; matchId: string; viewerRole: Role | null; chatOpen: boolean; onClose: () => void; onOpenChat: () => void }) {
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

  return <div className="sheet-backdrop profile-sheet-backdrop" onClick={onClose}>
    <section className="details-sheet matched-profile-sheet unified-match-sheet" role="dialog" aria-modal="true" aria-labelledby="matched-profile-title" onClick={(event) => event.stopPropagation()}>
      <div className="sheet-handle"/><CloseButton className="sheet-close" onClick={onClose} label="Cerrar perfil"/>
      {loading ? <div className="profile-sheet-loading"><span className="loader"/><p>Cargando perfil ampliado…</p></div> : error && !person ? <p className="form-error">{error}</p> : person && <>
        <div className="matched-profile-hero"><Avatar className="matched-profile-avatar" src={avatar} name={name}/><div className="matched-profile-heading"><span className="eyebrow">{isWorkerViewer ? "NEGOCIO CONECTADO" : "PERFIL PROFESIONAL"}</span><h2 id="matched-profile-title">{name}</h2><p>{isWorkerViewer ? `${person.company_sector || offer?.sector || "Empresa local"}${person.city ? ` · ${person.city}` : ""}` : `${worker?.desired_position || "Profesional"}${worker?.age ? ` · ${worker.age} años` : person.birth_year ? ` · ${new Date().getFullYear() - person.birth_year} años` : ""}${person.city ? ` · ${person.city}` : ""}`}</p></div></div>
        <div className="unified-match-body">{isWorkerViewer && offer ? <OfferDetailsContent offer={offer} phone={person.show_phone_on_match ? (companyPhone || person.company_phone) : undefined} businessDescription={person.company_description || offer.description} address={person.company_address || offer.address_approx}/> : worker ? <WorkerDetailsContent worker={{...worker,bio:worker.bio || person.default_bio || ""}} languages={worker.languages?.length ? worker.languages : person.languages} hasLicense={person.has_driving_license} hasVehicle={person.has_own_vehicle} allowCv/> : <p className="form-footnote">No hay una ficha profesional disponible para esta conexión.</p>}</div>
        {error && <p className="form-footnote">{error}</p>}
      </>}
      {!loading && person && <footer className="unified-match-actions"><button type="button" className="primary-button" onClick={chatOpen ? onClose : onOpenChat}>{chatOpen ? "Cerrar" : <><MessageCircle size={16}/> Abrir chat</>}</button></footer>}
    </section>
  </div>;
}

function profileFromOffer(offer: JobOffer, id: string): Profile {
  return {
    id, role: "company", enabled_roles: ["company"], display_name: offer.business_name, city: offer.city, lat: offer.lat, lng: offer.lng,
    avatar_path: offer.business_image_path, onboarding_complete: true, avatar_url: offer.business_image_path,
    full_name: "", birth_year: null, experience_years: 0, has_driving_license: false, has_own_vehicle: false,
    languages: [], default_bio: "", default_audio_url: null, cv_url: null, cv_filename: null, company_name: offer.business_name,
    company_logo_url: offer.business_image_path, company_sector: offer.sector, company_address: offer.address_approx,
    company_description: offer.description, company_phone: "", show_phone_on_match: false,
  };
}

function profileFromWorker(worker: WorkerCard, id: string): Profile {
  return {
    id, role: "worker", enabled_roles: ["worker"], display_name: worker.full_name, city: worker.city, lat: worker.lat, lng: worker.lng,
    avatar_path: worker.photo_path, onboarding_complete: true, avatar_url: worker.photo_path,
    full_name: worker.full_name, birth_year: worker.age ? new Date().getFullYear() - worker.age : null,
    experience_years: worker.experience_years, has_driving_license: worker.skills.some((skill) => /carnet/i.test(skill)),
    has_own_vehicle: worker.skills.some((skill) => /veh[ií]culo/i.test(skill)), languages: [], default_bio: worker.bio,
    default_audio_url: worker.intro_audio_path, cv_url: worker.cv_url, cv_filename: worker.cv_filename, company_name: "", company_logo_url: null, company_sector: "",
    company_address: "", company_description: "", company_phone: "", show_phone_on_match: false,
  };
}
