"use client";

import { useEffect, useRef, useState, type CSSProperties, type FormEvent } from "react";
import { ArrowRight, BriefcaseBusiness, Camera, Check, Clock3, LoaderCircle, Mic, Pause, Play, Plus, Save, Square } from "lucide-react";
import { CloseButton } from "@/components/CloseButton";
import { supabase, type JobOffer, type Profile, type WorkerCard } from "@/lib/supabase";
import { CvUploadField } from "@/components/CvUploadField";
import { OfferBoostButton } from "@/components/CompanyBillingPanel";
import { LocationPicker, TagInput } from "@/components/LocationPicker";

const sectors = ["Hostelería", "Comercio", "Logística", "Limpieza", "Atención al cliente", "Administración", "Construcción", "Sanidad", "Tecnología", "Otro"];
function cityName(value?: string | null) { return value?.split("·")[0]?.trim() ?? ""; }
function postalCode(value?: string | null) { return value?.match(/\b\d{5}\b/)?.[0] ?? ""; }
function parseStringArray(value: FormDataEntryValue | null) { try { const parsed = JSON.parse(String(value ?? "[]")); return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string").slice(0, 12) : []; } catch { return []; } }
function parseEuroAmount(value: string) { return Number(value.trim().replace(/\s/g, "").replace(/\./g, "").replace(",", ".")); }

async function upload(file: File, userId: string, type: "photo" | "audio") {
  if (!supabase) throw new Error("Falta configurar Supabase.");
  const extension = file.type === "audio/mp4" ? "mp4" : file.type.split("/")[1]?.replace("x-", "") || (type === "audio" ? "webm" : "jpg");
  const path = `${userId}/${type}-${crypto.randomUUID()}.${extension}`;
  const { error } = await supabase.storage.from("jobmatch-media").upload(path, file, { upsert: false, contentType: file.type });
  if (error) throw error;
  return supabase.storage.from("jobmatch-media").getPublicUrl(path).data.publicUrl;
}

export function CardEditor({ profile, existingWorker, existingOffer, offers, onSaved, onCancel, onEditOffer, onChooseOffer, activeOfferId, onToggleOffer, onUpgrade, onPurchaseSuccess }: {
  profile: Profile; existingWorker: WorkerCard | null; existingOffer: JobOffer | null; offers: JobOffer[];
  onSaved: (closeAfterSave?: boolean) => Promise<void> | void; onCancel: () => void; onEditOffer: (id: string) => void; onChooseOffer: (id: string) => void; activeOfferId: string; onToggleOffer: (offer: JobOffer) => void; onUpgrade: () => void; onPurchaseSuccess: () => void;
}) {
  const isWorker = profile.role === "worker";
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [limitReached, setLimitReached] = useState(false);
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState("");
  const [recorded, setRecorded] = useState<Blob | null>(null);
  const [recordUrl, setRecordUrl] = useState("");
  const [recording, setRecording] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);
  const [seconds, setSeconds] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [city, setCity] = useState(cityName(isWorker ? existingWorker?.city ?? profile.city : existingOffer?.city ?? profile.city));
  const [coordinates, setCoordinates] = useState<[number | null, number | null]>([
    isWorker ? existingWorker?.lat ?? profile.lat : existingOffer?.lat ?? profile.lat,
    isWorker ? existingWorker?.lng ?? profile.lng : existingOffer?.lng ?? profile.lng,
  ]);
  const [province, setProvince] = useState("");
  const [postal, setPostal] = useState(postalCode(isWorker ? existingWorker?.city : existingOffer?.city));
  const [languages, setLanguages] = useState<string[]>(existingWorker?.languages ?? profile.languages ?? []);
  const [skills, setSkills] = useState<string[]>(existingWorker?.skills ?? [...(profile.has_driving_license ? ["Carnet B"] : []), ...(profile.has_own_vehicle ? ["Vehículo propio"] : [])]);
  const [focusedOfferId, setFocusedOfferId] = useState(existingOffer?.id ?? "");
  const [cvUrl, setCvUrl] = useState<string | null>(existingWorker?.cv_url ?? profile.cv_url ?? null);
  const [cvFilename, setCvFilename] = useState<string | null>(existingWorker?.cv_filename ?? profile.cv_filename ?? null);
  const avatarInput = useRef<HTMLInputElement>(null);
  const mediaRecorder = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const meterFrameRef = useRef<number | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const hasUnsavedChanges = useRef(false);
  const currentPhoto = isWorker ? existingWorker?.photo_path ?? profile.avatar_url : existingOffer?.business_image_path ?? profile.company_logo_url;
  const avatarUrl = photoPreview || currentPhoto || "";
  const oldIntro = existingWorker?.intro_audio_path ?? profile.default_audio_url ?? "";
  const activeOffersCount = offers.filter((offer) => offer.company_id === profile.id && offer.is_active && !offer.is_demo && new Date(offer.expires_at).getTime() > Date.now()).length;
  const isPro = Boolean(profile.is_pro && profile.pro_expires_at && new Date(profile.pro_expires_at).getTime() > Date.now());
  const atFreeOfferLimit = !isPro && activeOffersCount >= 3;
  const existingOfferCountsAsActive = Boolean(existingOffer?.is_active && !existingOffer.is_demo && new Date(existingOffer.expires_at).getTime() > Date.now());

  useEffect(() => () => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (meterFrameRef.current !== null) cancelAnimationFrame(meterFrameRef.current);
    void audioContextRef.current?.close();
    streamRef.current?.getTracks().forEach((track) => track.stop());
    if (photoPreview.startsWith("blob:")) URL.revokeObjectURL(photoPreview);
    if (recordUrl.startsWith("blob:")) URL.revokeObjectURL(recordUrl);
  }, [photoPreview, recordUrl]);

  function choosePhoto(file?: File) {
    if (!file) return;
    if (file.size > 8_000_000) { setError("La imagen no puede superar 8 MB."); return; }
    if (photoPreview.startsWith("blob:")) URL.revokeObjectURL(photoPreview);
    setPhoto(file); setPhotoPreview(URL.createObjectURL(file)); setError("");
  }

  function updateLocation(value: { city: string; province: string; postal: string; lat: number | null; lng: number | null }) {
    setCity(value.city); setProvince(value.province); setPostal(value.postal); setCoordinates([value.lat, value.lng]);
  }

  async function startRecording() {
    setError("");
    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) { setError("Tu dispositivo no permite grabar audio desde este navegador."); return; }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const context = new AudioContext(); audioContextRef.current = context;
      const analyser = context.createAnalyser(); analyser.fftSize = 256;
      context.createMediaStreamSource(stream).connect(analyser);
      const samples = new Uint8Array(analyser.fftSize);
      const readLevel = () => {
        analyser.getByteTimeDomainData(samples);
        let energy = 0; for (const sample of samples) { const value = (sample - 128) / 128; energy += value * value; }
        setAudioLevel(Math.min(1, Math.sqrt(energy / samples.length) * 4));
        meterFrameRef.current = requestAnimationFrame(readLevel);
      };
      readLevel();
      const recorder = new MediaRecorder(stream);
      const chunks: BlobPart[] = [];
      recorder.ondataavailable = (event) => { if (event.data.size) chunks.push(event.data); };
      recorder.onstop = () => {
        const blob = new Blob(chunks, { type: recorder.mimeType || "audio/webm" });
        if (recordUrl.startsWith("blob:")) URL.revokeObjectURL(recordUrl);
        setRecorded(blob); setRecordUrl(URL.createObjectURL(blob));
        stream.getTracks().forEach((track) => track.stop()); streamRef.current = null;
        if (meterFrameRef.current !== null) cancelAnimationFrame(meterFrameRef.current);
        void audioContextRef.current?.close(); audioContextRef.current = null; setAudioLevel(0);
      };
      mediaRecorder.current = recorder; setSeconds(0); recorder.start(); setRecording(true);
      timerRef.current = setInterval(() => setSeconds((value) => {
        if (value >= 14) { if (timerRef.current) clearInterval(timerRef.current); mediaRecorder.current?.stop(); setRecording(false); return 15; }
        return value + 1;
      }), 1000);
    } catch { setError("Permite el acceso al micrófono para grabar tu presentación."); }
  }

  function stopRecording() {
    if (timerRef.current) clearInterval(timerRef.current);
    if (mediaRecorder.current?.state === "recording") mediaRecorder.current.stop();
    setRecording(false);
  }

  function resetRecording() {
    if (recordUrl.startsWith("blob:")) URL.revokeObjectURL(recordUrl);
    setRecorded(null); setRecordUrl(""); setSeconds(0); setPlaying(false);
  }

  async function persistForm(form: HTMLFormElement, closeAfterSave: boolean): Promise<boolean> {
    setBusy(true); setError("");
    if (!isWorker && !existingOfferCountsAsActive && atFreeOfferLimit) { setBusy(false); setLimitReached(true); return false; }
    const data = new FormData(form);
    try {
      if (!supabase) throw new Error("Configura las variables de Supabase primero.");
      const [lat, lng] = coordinates;
      if (!city || lat === null || lng === null) throw new Error("Detecta tu ubicación o selecciona ciudad para guardar la tarjeta.");
      const publicImage = photo ? await upload(photo, profile.id, "photo") : currentPhoto ?? null;
      if (isWorker) {
        let introAudio = oldIntro || null;
        if (recorded) {
          if (recorded.size > 2_000_000) throw new Error("El audio supera el máximo de 2 MB.");
          introAudio = await upload(new File([recorded], "presentacion.webm", { type: recorded.type || "audio/webm" }), profile.id, "audio");
        }
        const skills = parseStringArray(data.get("skills"));
        const selectedLanguages = parseStringArray(data.get("languages"));
        const row = { user_id: profile.id, full_name: String(data.get("full_name")), age: Number(data.get("age")) || null, photo_path: publicImage, desired_position: String(data.get("position")), sector: String(data.get("sector")), experience_years: Number(data.get("experience")), availability: String(data.get("availability")), availability_note: String(data.get("availability_note")), skills, languages: selectedLanguages, education_level: String(data.get("education_level") ?? ""), bio: String(data.get("bio")), city: postal ? `${city} · ${postal}` : city, lat, lng, intro_audio_path: introAudio, cv_url: cvUrl, cv_filename: cvFilename, is_active: true };
        const { error: saveError } = await supabase.from("jobmatch_worker_cards").upsert(row, { onConflict: "user_id" });
        if (saveError) throw saveError;
        const { error: profileError } = await supabase.from("jobmatch_profiles").update({ display_name: row.full_name, city, lat, lng, avatar_path: publicImage, avatar_url: publicImage, cv_url: cvUrl, cv_filename: cvFilename, onboarding_complete: true }).eq("id", profile.id);
        if (profileError) throw profileError;
      } else {
        const amount = parseEuroAmount(String(data.get("salary_amount") ?? ""));
        const frequency = String(data.get("salary_frequency")) as JobOffer["salary_frequency"];
        const kind = String(data.get("salary_kind")) as JobOffer["salary_kind"];
        if (!Number.isFinite(amount) || amount <= 0) throw new Error("Indica un importe de salario mayor que cero.");
        const salary = new Intl.NumberFormat("es-ES", { maximumFractionDigits: 2 }).format(amount);
        const unit = frequency === "mensual" ? "/mes" : frequency === "hora" ? "/hora" : "/jornada";
        const kindLabel = kind === "neto" ? "netos" : "brutos";
        const benefits = String(data.get("benefits") ?? "").split(",").map((item) => item.trim()).filter(Boolean).slice(0, 6);
        const row = { company_id: profile.id, business_name: String(data.get("business")), business_image_path: publicImage, position: String(data.get("position")), sector: String(data.get("sector")), salary_text: `${salary} €${unit} ${kindLabel}`, salary_amount: amount, salary_frequency: frequency, salary_kind: kind, salary_min: amount, salary_period: frequency, shift_type: String(data.get("shift")), schedule: String(data.get("schedule")), benefits, description: String(data.get("description")), city: postal ? `${city} · ${postal}` : city, address_approx: String(data.get("address_approx")), lat, lng, is_active: true, expires_at: new Date(Date.now() + 14 * 86400000).toISOString() };
        const result = existingOffer
          ? await supabase.from("jobmatch_job_offers").update(row).eq("id", existingOffer.id).eq("company_id", profile.id)
          : await supabase.from("jobmatch_job_offers").insert(row);
        if (result.error) throw result.error;
        const { error: profileError } = await supabase.from("jobmatch_profiles").update({ display_name: row.business_name, city, lat, lng, avatar_path: publicImage, company_logo_url: publicImage, onboarding_complete: true }).eq("id", profile.id);
        if (profileError) throw profileError;
      }
      hasUnsavedChanges.current = false;
      await onSaved(closeAfterSave);
      return true;
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "No se pudo guardar. Comprueba los campos e inténtalo de nuevo.";
      if (message.includes("free_offer_limit_reached")) setLimitReached(true);
      setError(message.includes("free_offer_limit_reached") ? "El plan gratuito permite hasta 3 ofertas activas. Job Match Pro elimina ese límite." : message);
      return false;
    }
    finally { setBusy(false); }
  }

  async function savePendingChanges(): Promise<boolean> {
    if (!hasUnsavedChanges.current) return true;
    const form = formRef.current;
    if (!form || !form.reportValidity()) return false;
    return persistForm(form, false);
  }

  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void persistForm(event.currentTarget, true);
  }

  async function editOffer(offer: JobOffer) {
    if (busy || !await savePendingChanges()) return;
    setFocusedOfferId(offer.id);
    onEditOffer(offer.id);
  }

  async function chooseOffer(offer: JobOffer) {
    if (busy || !offer.is_active || offer.is_demo || new Date(offer.expires_at).getTime() <= Date.now()) return;
    if (!await savePendingChanges()) return;
    onChooseOffer(offer.id);
  }

  async function createNewOffer() {
    if (atFreeOfferLimit) { setLimitReached(true); return; }
    if (busy || !await savePendingChanges()) return;
    onEditOffer("");
  }

  return <section className="editor-panel">
    <div className="editor-heading"><div><span className="eyebrow">{isWorker ? "TU PERFIL PROFESIONAL" : "GESTIONA TU NEGOCIO"}</span><h2>{isWorker ? "Una buena primera impresión." : "Tu próxima contratación empieza aquí."}</h2></div><CloseButton className="icon-close" onClick={onCancel} label="Cerrar editor"/></div>
    {!isWorker && <section className="offer-manager"><div className="offer-manager-title"><BriefcaseBusiness size={17}/><b>Mis ofertas</b><span className="offer-plan-count">{isPro ? `${activeOffersCount} activas · ilimitadas` : `${activeOffersCount} / 3 activas`}</span><button type="button" className="text-action" onClick={() => void createNewOffer()}><Plus size={15}/> Nueva oferta</button></div>
      {limitReached && <div className="offer-limit-notice" role="alert"><b>Ya tienes 3 ofertas activas</b><p>Con Job Match Pro puedes publicar ofertas sin límite por 19,99 €/mes.</p><div><button type="button" className="quiet-button" onClick={() => setLimitReached(false)}>Ahora no</button><button type="button" className="primary-button" onClick={onUpgrade}>Ver Job Match Pro</button></div></div>}
      {offers.length > 0 && <div className="offer-manager-list">{offers.map((offer) => {
        const offerSelectable = offer.is_active && !offer.is_demo && new Date(offer.expires_at).getTime() > Date.now();
        const isActiveForDeck = activeOfferId === offer.id && offerSelectable;
        return <div className={`managed-offer ${focusedOfferId === offer.id ? "editing" : ""} ${isActiveForDeck ? "selected" : ""}`} key={offer.id}>
        <div className="managed-offer-top">
          <div className="managed-offer-main"><span className={`status-dot ${offer.is_active ? "online" : "offline"}`}/><span className="managed-offer-info"><b>{offer.position}</b><small>{offer.business_name} · {cityName(offer.city) || offer.city} · {offer.is_active ? "Activa" : "Pausada"}</small></span><button type="button" className="managed-offer-edit" disabled={busy} onClick={() => void editOffer(offer)}>Editar</button></div>
          <button type="button" className="managed-offer-toggle" onClick={() => onToggleOffer(offer)}>{offer.is_active ? "Pausar" : "Activar"}</button>
        </div>
        {offerSelectable && <button type="button" className={`managed-offer-choose ${isActiveForDeck ? "is-active" : ""}`} aria-pressed={isActiveForDeck} disabled={busy || isActiveForDeck} onClick={() => void chooseOffer(offer)}>{isActiveForDeck ? <><Check size={15}/> Buscando con esta oferta</> : <>Elegir esta oferta <ArrowRight size={15}/></>}</button>}
        {offer.is_active && !offer.is_demo && new Date(offer.expires_at).getTime() > Date.now() && <div className="managed-offer-boost"><OfferBoostButton offer={offer} userId={profile.id} onError={setError} onPurchased={onPurchaseSuccess}/></div>}
      </div>;})}</div>}
    </section>}
    <form ref={formRef} className="editor-form" onSubmit={save} onChange={() => { hasUnsavedChanges.current = true; }}>
      <div className="identity-row"><button type="button" className="avatar-picker" onClick={() => avatarInput.current?.click()} aria-label="Elegir foto"><span className="avatar-preview" style={avatarUrl ? { backgroundImage: `url(${avatarUrl})` } : undefined}>{avatarUrl ? null : isWorker ? "JM" : "＋"}</span><span className="camera-badge"><Camera size={15}/></span></button><input ref={avatarInput} className="hidden-file" type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => choosePhoto(event.target.files?.[0])}/><div><b>{isWorker ? "Foto de perfil" : "Logo o foto del negocio"}</b><small>Encuadre circular automático · JPG, PNG o WebP</small></div></div>
      {isWorker ? <>
        <div className="form-two"><label>Nombre y apellidos<input name="full_name" defaultValue={existingWorker?.full_name ?? profile.full_name ?? ""} required maxLength={80}/></label><label>Edad<input name="age" type="number" min="16" max="100" defaultValue={existingWorker?.age ?? (profile.birth_year ? new Date().getFullYear() - profile.birth_year : "")} placeholder="Opcional"/></label></div>
        <label>Puesto que buscas<input name="position" defaultValue={existingWorker?.desired_position} required maxLength={100} placeholder="Camarero/a, dependiente/a…"/></label>
        <div className="form-two"><label>Sector<select name="sector" defaultValue={existingWorker?.sector ?? "Hostelería"}>{sectors.map((sector) => <option key={sector}>{sector}</option>)}</select></label><label>Experiencia<input name="experience" type="number" min="0" max="60" step="0.5" defaultValue={existingWorker?.experience_years ?? profile.experience_years ?? 0}/></label></div>
        <div className="form-two"><label>Disponibilidad<select name="availability" defaultValue={existingWorker?.availability ?? "inmediata"}><option value="inmediata">Inmediata</option><option value="fines_de_semana">Fines de semana</option><option value="media_jornada">Media jornada</option><option value="completa">Jornada completa</option></select></label><label>Cuándo puedes empezar<input name="availability_note" defaultValue={existingWorker?.availability_note ?? ""} placeholder="Esta semana, en 15 días…"/></label></div>
        <label>Nivel de estudios<select name="education_level" defaultValue={existingWorker?.education_level ?? ""}><option value="">Selecciona una opción</option>{["Sin estudios", "ESO", "Bachillerato", "FP Grado Medio", "FP Grado Superior", "Grado Universitario", "Máster"].map((item) => <option key={item}>{item}</option>)}</select></label>
        <TagInput label="Idiomas" name="languages" value={languages} onChange={setLanguages} placeholder="Añade un idioma y nivel (p. ej. Inglés B2)" suggestions={["Español", "Inglés", "Francés", "Alemán", "Ruso", "Árabe"]}/>
        <TagInput label="Habilidades" name="skills" value={skills} onChange={setSkills} placeholder="Añade una habilidad" suggestions={["Carnet B", "Vehículo propio", "Manipulador de alimentos", "Atención al cliente", "Caja/TPV", "Almacén", "Limpieza", "Office/Excel"]}/>
        <label>Una breve presentación<textarea name="bio" rows={3} maxLength={280} defaultValue={existingWorker?.bio ?? profile.default_bio ?? ""} placeholder="Cuéntanos qué aportas al equipo…"/></label>
        <CvUploadField userId={profile.id} value={cvUrl} filename={cvFilename} onChange={(url,filename)=>{setCvUrl(url);setCvFilename(filename);}}/>
        <section className="recorder"><div className="recorder-copy"><span className="eyebrow">PRESENTACIÓN DE VOZ · 15 SEGUNDOS</span><p>Tu voz transmite mucho más que un CV.</p></div><div className={`audio-wave ${recording ? "recording" : ""}`} aria-hidden="true">{Array.from({length:20},(_,index)=><i key={index} style={{"--bar":`${Math.max(5,(12 + (index*17)%30)*Math.max(.15,audioLevel))}px`} as CSSProperties}/>)}</div><div className="recorder-controls">{recording ? <button type="button" className="record-button stop" onClick={stopRecording}><Square size={15} fill="currentColor"/> Parar · {15-seconds}s</button> : <button type="button" className="record-button" onClick={() => void startRecording()}><Mic size={16}/> {recorded ? "Regrabar" : "Grabar presentación"}</button>}{recordUrl ? <><audio ref={audioRef} src={recordUrl} onEnded={()=>setPlaying(false)} className="hidden-audio"/><button type="button" className="round-control" onClick={() => { if (!audioRef.current) return; if (playing) audioRef.current.pause(); else void audioRef.current.play(); setPlaying(!playing); }} aria-label={playing ? "Pausar audio" : "Escuchar audio"}>{playing ? <Pause size={16}/> : <Play size={16}/>}</button><button type="button" className="text-action" onClick={resetRecording}>Eliminar</button></> : oldIntro && <a className="text-action" href={oldIntro} target="_blank" rel="noreferrer">Escuchar audio actual</a>}</div></section>
      </> : <>
        <label>Nombre del negocio<input name="business" defaultValue={existingOffer?.business_name ?? profile.company_name ?? offers[0]?.business_name ?? ""} required maxLength={100}/></label>
        <div className="form-two"><label>Puesto ofrecido<input name="position" defaultValue={existingOffer?.position} required maxLength={100} placeholder="Ayudante de cocina"/></label><label>Sector<select name="sector" defaultValue={existingOffer?.sector ?? profile.company_sector ?? "Hostelería"}>{sectors.map((sector) => <option key={sector}>{sector}</option>)}</select></label></div>
        <fieldset className="salary-fields"><legend>Salario visible en la tarjeta</legend><div className="salary-inputs"><label>Importe<input name="salary_amount" inputMode="decimal" defaultValue={existingOffer?.salary_amount ?? ""} required placeholder="1.350"/></label><label>Frecuencia<select name="salary_frequency" defaultValue={existingOffer?.salary_frequency ?? "mensual"}><option value="mensual">Al mes</option><option value="hora">A la hora</option><option value="jornada">Por jornada</option></select></label><label>Tipo<select name="salary_kind" defaultValue={existingOffer?.salary_kind ?? "bruto"}><option value="neto">Neto</option><option value="bruto">Bruto</option></select></label></div></fieldset>
        <div className="form-two"><label>Tipo de jornada<select name="shift" defaultValue={existingOffer?.shift_type ?? "Jornada completa"}><option>Jornada completa</option><option>Media jornada</option><option>Fines de semana</option><option>Turnos rotativos</option></select></label><label>Horario o turnos<input name="schedule" defaultValue={existingOffer?.schedule ?? ""} placeholder="Mañanas y fines de semana"/></label></div>
        <label>Condiciones y beneficios <small>Separa con comas, hasta 6</small><input name="benefits" defaultValue={existingOffer?.benefits?.join(", ")} placeholder="Contrato indefinido, propinas…"/></label>
        <label>Descripción del puesto<textarea name="description" defaultValue={existingOffer?.description ?? profile.company_description} required maxLength={1200} rows={4} placeholder="Tareas, equipo y requisitos principales…"/></label>
        <label>Dirección aproximada<input name="address_approx" defaultValue={existingOffer?.address_approx ?? profile.company_address ?? ""} placeholder="Centro, zona puerto…"/></label>
      </>}
      <LocationPicker value={{ city, province, postal, lat: coordinates[0], lng: coordinates[1] }} onChange={updateLocation} onError={setError}/>
      {error && <p className="form-error" role="alert">{error}</p>}
      <button className="primary-button save-button" disabled={busy || recording} type="submit">{busy ? <LoaderCircle className="spin" size={17} /> : <Save size={17} />}{busy ? "Guardando…" : isWorker ? "Guardar mi perfil" : existingOffer ? "Guardar oferta" : "Publicar oferta"}</button>
      {!isWorker && <p className="form-footnote"><Clock3 size={14}/> Las ofertas caducan automáticamente a los 14 días.</p>}
    </form>
  </section>;
}
