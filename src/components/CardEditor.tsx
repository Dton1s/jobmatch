"use client";

import { useEffect, useRef, useState, type CSSProperties, type FormEvent } from "react";
import { BriefcaseBusiness, Camera, Check, ChevronDown, Clock3, ImagePlus, LoaderCircle, MapPin, Mic, Pause, Play, Plus, Save, Square, X } from "lucide-react";
import { supabase, type JobOffer, type Profile, type WorkerCard } from "@/lib/supabase";
import { CvUploadField } from "@/components/CvUploadField";

const sectors = ["Hostelería", "Comercio", "Logística", "Limpieza", "Atención al cliente", "Administración", "Construcción", "Sanidad", "Tecnología", "Otro"];
const townCenters: Record<string, [number, number]> = {
  Torrevieja: [37.9786, -0.6822], Alicante: [38.3452, -0.481], Guardamar: [38.0901, -0.6551],
  "Orihuela Costa": [37.9292, -0.7354], "La Mata": [38.0267, -0.6541],
};
function cityName(value?: string | null) { return value?.split("·")[0]?.trim() ?? ""; }
function postalCode(value?: string | null) { return value?.match(/\b\d{5}\b/)?.[0] ?? ""; }
function parseEuroAmount(value: string) { return Number(value.trim().replace(/\s/g, "").replace(/\./g, "").replace(",", ".")); }

async function upload(file: File, userId: string, type: "photo" | "audio") {
  if (!supabase) throw new Error("Falta configurar Supabase.");
  const extension = file.type === "audio/mp4" ? "mp4" : file.type.split("/")[1]?.replace("x-", "") || (type === "audio" ? "webm" : "jpg");
  const path = `${userId}/${type}-${crypto.randomUUID()}.${extension}`;
  const { error } = await supabase.storage.from("jobmatch-media").upload(path, file, { upsert: false, contentType: file.type });
  if (error) throw error;
  return supabase.storage.from("jobmatch-media").getPublicUrl(path).data.publicUrl;
}

export function CardEditor({ profile, existingWorker, existingOffer, offers, onSaved, onCancel, onSelectOffer, onToggleOffer }: {
  profile: Profile; existingWorker: WorkerCard | null; existingOffer: JobOffer | null; offers: JobOffer[];
  onSaved: () => void; onCancel: () => void; onSelectOffer: (id: string) => void; onToggleOffer: (offer: JobOffer) => void;
}) {
  const isWorker = profile.role === "worker";
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
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
  const [locationDetected, setLocationDetected] = useState(false);
  const [creatingOffer, setCreatingOffer] = useState(!existingOffer);
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
  const currentPhoto = isWorker ? existingWorker?.photo_path ?? profile.avatar_url : existingOffer?.business_image_path ?? profile.company_logo_url;
  const avatarUrl = photoPreview || currentPhoto || "";
  const oldIntro = existingWorker?.intro_audio_path ?? profile.default_audio_url ?? "";

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

  function locate() {
    setError("");
    if (!navigator.geolocation) { setError("Este dispositivo no ofrece ubicación. Elige tu ciudad y código postal."); return; }
    navigator.geolocation.getCurrentPosition(({ coords }) => {
      setCoordinates([Number(coords.latitude.toFixed(3)), Number(coords.longitude.toFixed(3))]);
      setLocationDetected(true);
    }, () => setError("No pudimos detectar tu ubicación. Elige ciudad y código postal manualmente."), { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 });
  }

  function chooseTown(value: string) {
    setCity(value);
    const center = townCenters[value];
    if (center) { setCoordinates(center); setLocationDetected(false); }
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

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError("");
    const data = new FormData(event.currentTarget);
    try {
      if (!supabase) throw new Error("Configura las variables de Supabase primero.");
      const [lat, lng] = coordinates;
      const postal = String(data.get("postal") ?? "").trim();
      if (!city || lat === null || lng === null) throw new Error("Detecta tu ubicación o selecciona ciudad para guardar la tarjeta.");
      const publicImage = photo ? await upload(photo, profile.id, "photo") : currentPhoto ?? null;
      if (isWorker) {
        let introAudio = oldIntro || null;
        if (recorded) {
          if (recorded.size > 2_000_000) throw new Error("El audio supera el máximo de 2 MB.");
          introAudio = await upload(new File([recorded], "presentacion.webm", { type: recorded.type || "audio/webm" }), profile.id, "audio");
        }
        const skills = String(data.get("skills") ?? "").split(",").map((item) => item.trim()).filter(Boolean).slice(0, 12);
        const row = { user_id: profile.id, full_name: String(data.get("full_name")), age: Number(data.get("age")) || null, photo_path: publicImage, desired_position: String(data.get("position")), sector: String(data.get("sector")), experience_years: Number(data.get("experience")), availability: String(data.get("availability")), availability_note: String(data.get("availability_note")), skills, bio: String(data.get("bio")), city: postal ? `${city} · ${postal}` : city, lat, lng, intro_audio_path: introAudio, cv_url: cvUrl, cv_filename: cvFilename, is_active: true };
        const { error: saveError } = await supabase.from("jobmatch_worker_cards").upsert(row, { onConflict: "user_id" });
        if (saveError) throw saveError;
        const { error: profileError } = await supabase.from("jobmatch_profiles").update({ display_name: row.full_name, city, lat: Number(lat.toFixed(2)), lng: Number(lng.toFixed(2)), avatar_path: publicImage, cv_url: cvUrl, cv_filename: cvFilename, onboarding_complete: true }).eq("id", profile.id);
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
        const { error: profileError } = await supabase.from("jobmatch_profiles").update({ display_name: row.business_name, city, lat: Number(lat.toFixed(2)), lng: Number(lng.toFixed(2)), avatar_path: publicImage, onboarding_complete: true }).eq("id", profile.id);
        if (profileError) throw profileError;
      }
      onSaved();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "No se pudo guardar. Comprueba los campos e inténtalo de nuevo."); }
    finally { setBusy(false); }
  }

  return <section className="editor-panel">
    <div className="editor-heading"><div><span className="eyebrow">{isWorker ? "TU PERFIL PROFESIONAL" : "GESTIONA TU NEGOCIO"}</span><h2>{isWorker ? "Una buena primera impresión." : "Tu próxima contratación empieza aquí."}</h2></div><button className="icon-close" onClick={onCancel} aria-label="Cerrar"><X size={18}/></button></div>
    {!isWorker && <section className="offer-manager"><div className="offer-manager-title"><BriefcaseBusiness size={17}/><b>Mis ofertas</b><button type="button" className="text-action" onClick={() => { setCreatingOffer(true); setFocusedOfferId(""); onSelectOffer(""); }}><Plus size={15}/> Nueva oferta</button></div>
      {offers.length > 0 && <div className="offer-manager-list">{offers.map((offer) => <div className={`managed-offer ${focusedOfferId === offer.id ? "selected" : ""}`} key={offer.id}><button type="button" className="managed-offer-main" onClick={() => { setFocusedOfferId(offer.id); setCreatingOffer(false); onSelectOffer(offer.id); }}><span className={`status-dot ${offer.is_active ? "online" : "offline"}`}/><span><b>{offer.position}</b><small>{offer.business_name} · {offer.is_active ? "Activa" : "Pausada"}</small></span><ChevronDown size={15}/></button><button type="button" className="text-action" onClick={() => onToggleOffer(offer)}>{offer.is_active ? "Pausar" : "Reactivar"}</button></div>)}</div>}
    </section>}
    <form className="editor-form" onSubmit={save}>
      <div className="identity-row"><button type="button" className="avatar-picker" onClick={() => avatarInput.current?.click()} aria-label="Elegir foto"><span className="avatar-preview" style={avatarUrl ? { backgroundImage: `url(${avatarUrl})` } : undefined}>{avatarUrl ? null : isWorker ? "JM" : "＋"}</span><span className="camera-badge"><Camera size={15}/></span></button><input ref={avatarInput} className="hidden-file" type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => choosePhoto(event.target.files?.[0])}/><div><b>{isWorker ? "Foto de perfil" : "Logo o foto del negocio"}</b><small>Encuadre circular automático · JPG, PNG o WebP</small></div></div>
      {isWorker ? <>
        <div className="form-two"><label>Nombre y apellidos<input name="full_name" defaultValue={existingWorker?.full_name ?? profile.full_name ?? profile.display_name} required maxLength={80}/></label><label>Edad<input name="age" type="number" min="16" max="100" defaultValue={existingWorker?.age ?? (profile.birth_year ? new Date().getFullYear() - profile.birth_year : "")} placeholder="Opcional"/></label></div>
        <label>Puesto que buscas<input name="position" defaultValue={existingWorker?.desired_position} required maxLength={100} placeholder="Camarero/a, dependiente/a…"/></label>
        <div className="form-two"><label>Sector<select name="sector" defaultValue={existingWorker?.sector ?? "Hostelería"}>{sectors.map((sector) => <option key={sector}>{sector}</option>)}</select></label><label>Experiencia<input name="experience" type="number" min="0" max="60" step="0.5" defaultValue={existingWorker?.experience_years ?? profile.experience_years ?? 0}/></label></div>
        <div className="form-two"><label>Disponibilidad<select name="availability" defaultValue={existingWorker?.availability ?? "inmediata"}><option value="inmediata">Inmediata</option><option value="fines_de_semana">Fines de semana</option><option value="media_jornada">Media jornada</option><option value="completa">Jornada completa</option></select></label><label>Cuándo puedes empezar<input name="availability_note" defaultValue={existingWorker?.availability_note ?? ""} placeholder="Esta semana, en 15 días…"/></label></div>
        <label>Habilidades <small>Separadas por coma</small><input name="skills" defaultValue={existingWorker?.skills?.join(", ") ?? [...(profile.languages ?? []), ...(profile.has_driving_license ? ["Carnet B"] : []), ...(profile.has_own_vehicle ? ["Vehículo propio"] : [])].join(", ")} placeholder="Carnet B, TPV, Inglés"/></label>
        <label>Una breve presentación<textarea name="bio" rows={3} maxLength={280} defaultValue={existingWorker?.bio ?? profile.default_bio ?? ""} placeholder="Cuéntanos qué aportas al equipo…"/></label>
        <CvUploadField userId={profile.id} value={cvUrl} filename={cvFilename} onChange={(url,filename)=>{setCvUrl(url);setCvFilename(filename);}}/>
        <section className="recorder"><div className="recorder-copy"><span className="eyebrow">PRESENTACIÓN DE VOZ · 15 SEGUNDOS</span><p>Tu voz transmite mucho más que un CV.</p></div><div className={`audio-wave ${recording ? "recording" : ""}`} aria-hidden="true">{Array.from({length:20},(_,index)=><i key={index} style={{"--bar":`${Math.max(5,(12 + (index*17)%30)*Math.max(.15,audioLevel))}px`} as CSSProperties}/>)}</div><div className="recorder-controls">{recording ? <button type="button" className="record-button stop" onClick={stopRecording}><Square size={15} fill="currentColor"/> Parar · {15-seconds}s</button> : <button type="button" className="record-button" onClick={() => void startRecording()}><Mic size={16}/> {recorded ? "Regrabar" : "Grabar presentación"}</button>}{recordUrl ? <><audio ref={audioRef} src={recordUrl} onEnded={()=>setPlaying(false)} className="hidden-audio"/><button type="button" className="round-control" onClick={() => { if (!audioRef.current) return; if (playing) audioRef.current.pause(); else void audioRef.current.play(); setPlaying(!playing); }} aria-label={playing ? "Pausar audio" : "Escuchar audio"}>{playing ? <Pause size={16}/> : <Play size={16}/>}</button><button type="button" className="text-action" onClick={resetRecording}>Eliminar</button></> : oldIntro && <a className="text-action" href={oldIntro} target="_blank" rel="noreferrer">Escuchar audio actual</a>}</div></section>
      </> : <>
        <label>Nombre del negocio<input name="business" defaultValue={existingOffer?.business_name ?? profile.company_name ?? profile.display_name} required maxLength={100}/></label>
        <div className="form-two"><label>Puesto ofrecido<input name="position" defaultValue={existingOffer?.position} required maxLength={100} placeholder="Ayudante de cocina"/></label><label>Sector<select name="sector" defaultValue={existingOffer?.sector ?? profile.company_sector ?? "Hostelería"}>{sectors.map((sector) => <option key={sector}>{sector}</option>)}</select></label></div>
        <fieldset className="salary-fields"><legend>Salario visible en la tarjeta</legend><div className="salary-inputs"><label>Importe<input name="salary_amount" inputMode="decimal" defaultValue={existingOffer?.salary_amount ?? ""} required placeholder="1.350"/></label><label>Frecuencia<select name="salary_frequency" defaultValue={existingOffer?.salary_frequency ?? "mensual"}><option value="mensual">Al mes</option><option value="hora">A la hora</option><option value="jornada">Por jornada</option></select></label><label>Tipo<select name="salary_kind" defaultValue={existingOffer?.salary_kind ?? "bruto"}><option value="neto">Neto</option><option value="bruto">Bruto</option></select></label></div></fieldset>
        <div className="form-two"><label>Tipo de jornada<select name="shift" defaultValue={existingOffer?.shift_type ?? "Jornada completa"}><option>Jornada completa</option><option>Media jornada</option><option>Fines de semana</option><option>Turnos rotativos</option></select></label><label>Horario o turnos<input name="schedule" defaultValue={existingOffer?.schedule ?? ""} placeholder="Mañanas y fines de semana"/></label></div>
        <label>Condiciones y beneficios <small>Separa con comas, hasta 6</small><input name="benefits" defaultValue={existingOffer?.benefits?.join(", ")} placeholder="Contrato indefinido, propinas…"/></label>
        <label>Descripción del puesto<textarea name="description" defaultValue={existingOffer?.description ?? profile.company_description} required maxLength={1200} rows={4} placeholder="Tareas, equipo y requisitos principales…"/></label>
        <label>Dirección aproximada<input name="address_approx" defaultValue={existingOffer?.address_approx ?? profile.company_address ?? ""} placeholder="Centro, zona puerto…"/></label>
      </>}
      <section className="location-card"><div className="location-card-top"><div><span className="eyebrow">UBICACIÓN Y DISTANCIA</span><p>{locationDetected ? `📍 Ubicación detectada: ${city || "zona cercana"} (radio activo)` : coordinates[0] !== null ? `📍 Ubicación guardada · ${city || "tu zona"}` : "La distancia aproxima las oportunidades cercanas."}</p></div><button type="button" className="location-button" onClick={locate}><MapPin size={15}/> Detectar mi ubicación actual</button></div><div className="form-two"><label>Ciudad<select value={city || ""} onChange={(event)=>chooseTown(event.target.value)} required><option value="">Ciudad</option>{Object.keys(townCenters).map((town)=><option key={town}>{town}</option>)}</select></label><label>Código postal<input name="postal" inputMode="numeric" maxLength={5} defaultValue={postalCode(isWorker ? existingWorker?.city : existingOffer?.city)} placeholder="03181"/></label></div></section>
      {error && <p className="form-error" role="alert">{error}</p>}
      <button className="primary-button save-button" disabled={busy || recording} type="submit">{busy ? <LoaderCircle className="spin" size={17} /> : <Save size={17} />}{busy ? "Guardando…" : isWorker ? "Guardar mi perfil" : existingOffer ? "Guardar oferta" : "Publicar oferta"}</button>
      {!isWorker && <p className="form-footnote"><Clock3 size={14}/> Las ofertas caducan automáticamente a los 14 días.</p>}
    </form>
  </section>;
}
