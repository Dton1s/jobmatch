"use client";

import { useEffect, useRef, useState, type ChangeEvent, type CSSProperties, type FormEvent } from "react";
import { Camera, Check, LoaderCircle, Mic, Pause, Play, Save, Square, Trash2 } from "lucide-react";
import { CvUploadField } from "@/components/CvUploadField";
import { CloseButton } from "@/components/CloseButton";
import { supabase, type Profile } from "@/lib/supabase";

type WorkerForm = {
  fullName: string; birthYear: string; city: string; experienceYears: string; hasDrivingLicense: boolean;
  hasOwnVehicle: boolean; languages: string; defaultBio: string; defaultAudioUrl: string; cvUrl: string | null; cvFilename: string | null;
};
type CompanyForm = {
  name: string; sector: string; phone: string; showPhoneOnMatch: boolean; address: string; description: string;
};

async function uploadMedia(file: File | Blob, userId: string, prefix: string) {
  if (!supabase) throw new Error("Falta configurar Supabase.");
  const mimeType = file.type || "audio/webm";
  const extension = mimeType === "audio/mp4" ? "mp4" : mimeType.split("/")[1]?.replace("x-", "") || (prefix === "audio" ? "webm" : "jpg");
  const path = `${userId}/${prefix}-${crypto.randomUUID()}.${extension}`;
  const { error } = await supabase.storage.from("jobmatch-media").upload(path, file, { upsert: false, contentType: mimeType });
  if (error) throw error;
  return supabase.storage.from("jobmatch-media").getPublicUrl(path).data.publicUrl;
}

function messageFromError(error: unknown) {
  if (error && typeof error === "object" && "message" in error && typeof error.message === "string") return error.message;
  return error instanceof Error ? error.message : "Error desconocido al guardar el perfil.";
}

export function ProfileBaseEditor({ profile, onSaved, onClose }: { profile: Profile; onSaved: (updated: Partial<Profile>) => void; onClose: () => void }) {
  const [tab, setTab] = useState<"worker" | "company">(profile.role === "company" ? "company" : "worker");
  const [workerForm, setWorkerForm] = useState<WorkerForm>({
    fullName: profile.full_name ?? "", birthYear: profile.birth_year?.toString() ?? "", city: profile.city ?? "",
    experienceYears: String(profile.experience_years ?? 0), hasDrivingLicense: Boolean(profile.has_driving_license),
    hasOwnVehicle: Boolean(profile.has_own_vehicle), languages: profile.languages?.join(", ") ?? "", defaultBio: profile.default_bio ?? "", defaultAudioUrl: profile.default_audio_url ?? "", cvUrl: profile.cv_url ?? null, cvFilename: profile.cv_filename ?? null,
  });
  const [companyForm, setCompanyForm] = useState<CompanyForm>({
    name: profile.company_name ?? "", sector: profile.company_sector ?? "", phone: profile.company_phone ?? "",
    showPhoneOnMatch: Boolean(profile.show_phone_on_match), address: profile.company_address ?? "", description: profile.company_description ?? "",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [workerPhoto, setWorkerPhoto] = useState<File | null>(null);
  const [companyPhoto, setCompanyPhoto] = useState<File | null>(null);
  const [workerPreview, setWorkerPreview] = useState("");
  const [companyPreview, setCompanyPreview] = useState("");
  const [contactLoading, setContactLoading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLElement>(null);
  const isWorker = tab === "worker";
  const photo = isWorker ? workerPreview || profile.avatar_url || "" : companyPreview || profile.company_logo_url || "";

  useEffect(() => {
    panelRef.current?.scrollTo({ top: 0, behavior: "auto" });
  }, []);

  function switchTab(nextTab: "worker" | "company") {
    setTab(nextTab);
    requestAnimationFrame(() => panelRef.current?.scrollTo({ top: 0, behavior: "auto" }));
  }

  useEffect(() => {
    if (!supabase) return;
    let alive = true;
    setContactLoading(true);
    void supabase.from("jobmatch_company_contacts").select("phone,visible_after_match").eq("company_id", profile.id).maybeSingle().then(({ data, error: readError }) => {
      if (!alive) return;
      if (readError) console.error("Perfil Base: error leyendo el teléfono comercial de Supabase", readError);
      if (data) setCompanyForm((form) => ({ ...form, phone: data.phone ?? "", showPhoneOnMatch: data.visible_after_match ?? false }));
      setContactLoading(false);
    });
    return () => { alive = false; };
  }, [profile.id]);

  useEffect(() => () => {
    if (workerPreview.startsWith("blob:")) URL.revokeObjectURL(workerPreview);
    if (companyPreview.startsWith("blob:")) URL.revokeObjectURL(companyPreview);
  }, [workerPreview, companyPreview]);

  function setWorker<K extends keyof WorkerForm>(key: K, value: WorkerForm[K]) { setWorkerForm((form) => ({ ...form, [key]: value })); }
  function setCompany<K extends keyof CompanyForm>(key: K, value: CompanyForm[K]) { setCompanyForm((form) => ({ ...form, [key]: value })); }

  function chooseImage(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (file.size > 8_000_000) { setError("La imagen no puede superar 8 MB."); event.target.value = ""; return; }
    setError("");
    if (isWorker) {
      if (workerPreview.startsWith("blob:")) URL.revokeObjectURL(workerPreview);
      setWorkerPhoto(file); setWorkerPreview(URL.createObjectURL(file));
    } else {
      if (companyPreview.startsWith("blob:")) URL.revokeObjectURL(companyPreview);
      setCompanyPhoto(file); setCompanyPreview(URL.createObjectURL(file));
    }
    event.target.value = "";
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase) return;
    setBusy(true); setError("");
    try {
      let values: Record<string, unknown>;
      if (isWorker) {
        const avatarUrl = workerPhoto ? await uploadMedia(workerPhoto, profile.id, "avatar") : profile.avatar_url || null;
        values = {
          avatar_url: avatarUrl, full_name: workerForm.fullName.trim(), birth_year: Number(workerForm.birthYear) || null,
          city: workerForm.city.trim(), experience_years: Number(workerForm.experienceYears) || 0,
          has_driving_license: workerForm.hasDrivingLicense, has_own_vehicle: workerForm.hasOwnVehicle,
          languages: workerForm.languages.split(",").map((item) => item.trim()).filter(Boolean).slice(0, 12),
          default_bio: workerForm.defaultBio.trim(), default_audio_url: workerForm.defaultAudioUrl || null,
          cv_url: workerForm.cvUrl, cv_filename: workerForm.cvFilename,
          display_name: workerForm.fullName.trim(),
        };
      } else {
        const logoUrl = companyPhoto ? await uploadMedia(companyPhoto, profile.id, "company-logo") : profile.company_logo_url || null;
        values = {
          company_logo_url: logoUrl, company_name: companyForm.name.trim(), company_sector: companyForm.sector.trim(),
          company_phone: companyForm.phone.trim(), show_phone_on_match: companyForm.showPhoneOnMatch,
          company_address: companyForm.address.trim(), company_description: companyForm.description.trim(),
          display_name: companyForm.name.trim(),
        };
      }
      const { data, error: updateError } = await supabase.from("jobmatch_profiles").update(values).eq("id", profile.id).select("id").maybeSingle();
      if (updateError) throw updateError;
      if (!data) throw new Error("No encontramos la fila de tu perfil. Cierra sesión y vuelve a entrar para crearla de nuevo.");
      if (!isWorker) {
        const { error: contactError } = await supabase.from("jobmatch_company_contacts").upsert({
          company_id: profile.id, phone: companyForm.phone.trim(), visible_after_match: companyForm.showPhoneOnMatch,
        }, { onConflict: "company_id" });
        if (contactError) throw contactError;
      }
      onSaved(values as Partial<Profile>);
    } catch (cause) {
      console.error("Perfil Base: error real al guardar en Supabase", cause);
      setError(messageFromError(cause));
    } finally { setBusy(false); }
  }

  return <div className="drawer-backdrop profile-base-backdrop" onClick={onClose}>
    <section ref={panelRef} className="profile-base-panel" role="dialog" aria-modal="true" aria-labelledby="profile-base-title" onClick={(event) => event.stopPropagation()}>
      <header className="drawer-heading"><div><span className="eyebrow">DATOS REUTILIZABLES</span><h2 id="profile-base-title">Perfil Base</h2></div><CloseButton className="icon-close" onClick={onClose} label="Cerrar Perfil Base"/></header>
      <div className="profile-base-tabs" role="tablist" aria-label="Tipo de perfil"><button type="button" role="tab" aria-selected={isWorker} className={isWorker ? "selected" : ""} onClick={() => switchTab("worker")}>Datos de Trabajador</button><button type="button" role="tab" aria-selected={!isWorker} className={!isWorker ? "selected" : ""} onClick={() => switchTab("company")}>Datos de Empresa</button></div>
      <form className="editor-form profile-base-form" onSubmit={save} key={tab}>
        <div className="identity-row"><button type="button" className="avatar-picker" onClick={() => fileRef.current?.click()} aria-label={isWorker ? "Elegir avatar de trabajador" : "Elegir logo de empresa"}><span className="avatar-preview" style={photo ? { backgroundImage: `url(${photo})` } : undefined}>{photo ? null : isWorker ? "JM" : "＋"}</span><span className="camera-badge"><Camera size={15}/></span></button><input ref={fileRef} className="hidden-file" type="file" accept="image/jpeg,image/png,image/webp" onChange={chooseImage}/><div><b>{isWorker ? "Avatar predeterminado" : "Logo predeterminado"}</b><small>Se usará al crear una ficha u oferta nueva.</small></div></div>
        {isWorker ? <>
          <div className="form-two"><label>Nombre y apellidos<input name="full_name" value={workerForm.fullName} onChange={(event)=>setWorker("fullName",event.target.value)} maxLength={100}/></label><label>Año de nacimiento<input name="birth_year" type="number" min="1900" max={new Date().getFullYear()} value={workerForm.birthYear} onChange={(event)=>setWorker("birthYear",event.target.value)} placeholder="Opcional"/></label></div>
          <div className="form-two"><label>Ciudad habitual<input name="city" value={workerForm.city} onChange={(event)=>setWorker("city",event.target.value)} placeholder="Torrevieja"/></label><label>Años de experiencia<input name="experience_years" type="number" min="0" max="60" step="0.5" value={workerForm.experienceYears} onChange={(event)=>setWorker("experienceYears",event.target.value)}/></label></div>
          <label>Idiomas <small>Separados por coma</small><input name="languages" value={workerForm.languages} onChange={(event)=>setWorker("languages",event.target.value)} placeholder="Español, Inglés B2"/></label>
          <div className="profile-switches"><label className="profile-phone-toggle"><span>Tengo carnet de conducir</span><input type="checkbox" checked={workerForm.hasDrivingLicense} onChange={(event)=>setWorker("hasDrivingLicense",event.target.checked)} aria-label="Tengo carnet de conducir"/></label><label className="profile-phone-toggle"><span>Dispongo de vehículo propio</span><input type="checkbox" checked={workerForm.hasOwnVehicle} onChange={(event)=>setWorker("hasOwnVehicle",event.target.checked)} aria-label="Dispongo de vehículo propio"/></label></div>
          <label>Presentación por defecto<textarea name="default_bio" rows={4} maxLength={1200} value={workerForm.defaultBio} onChange={(event)=>setWorker("defaultBio",event.target.value)} placeholder="Experiencia, fortalezas y lo que buscas…"/></label>
          <CvUploadField userId={profile.id} value={workerForm.cvUrl} filename={workerForm.cvFilename} onChange={(url,filename)=>{setWorker("cvUrl",url);setWorker("cvFilename",filename);}}/>
          <DefaultAudioRecorder userId={profile.id} value={workerForm.defaultAudioUrl} onChange={(value)=>setWorker("defaultAudioUrl",value)}/>
        </> : <>
          <label>Nombre comercial<input name="company_name" value={companyForm.name} onChange={(event)=>setCompany("name",event.target.value)} maxLength={120}/></label>
          <div className="form-two"><label>Sector<input name="company_sector" value={companyForm.sector} onChange={(event)=>setCompany("sector",event.target.value)} placeholder="Hostelería, comercio…"/></label><label>Teléfono de contacto<input name="company_phone" type="tel" value={companyForm.phone} onChange={(event)=>setCompany("phone",event.target.value)} placeholder="+34 600 000 000"/></label></div>
          <label>Dirección del negocio<input name="company_address" value={companyForm.address} onChange={(event)=>setCompany("address",event.target.value)} placeholder="Dirección del local"/></label>
          <label>Descripción del negocio<textarea name="company_description" rows={4} maxLength={1200} value={companyForm.description} onChange={(event)=>setCompany("description",event.target.value)} placeholder="Qué hace especial a tu equipo…"/></label>
          <label className="profile-phone-toggle"><span>Mostrar mi teléfono a mis matches</span><input type="checkbox" name="show_phone_on_match" checked={companyForm.showPhoneOnMatch} onChange={(event)=>setCompany("showPhoneOnMatch",event.target.checked)} aria-label="Mostrar mi teléfono a mis matches"/></label>
          {contactLoading && <p className="form-footnote">Cargando preferencias de contacto…</p>}
        </>}
        {error && <p className="form-error" role="alert">{error}</p>}
        <p className="form-footnote"><Check size={14}/> Los datos se guardan como valores predeterminados; puedes personalizar cada ficha u oferta.</p>
        <button className="primary-button save-button" disabled={busy || contactLoading}>{busy ? <LoaderCircle className="spin" size={16}/> : <Save size={16} />}{busy ? "Guardando…" : "Guardar Perfil Base"}</button>
      </form>
    </section>
  </div>;
}

function DefaultAudioRecorder({ userId, value, onChange }: { userId: string; value: string; onChange: (value: string) => void }) {
  const [recording, setRecording] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [level, setLevel] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [error, setError] = useState("");
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const contextRef = useRef<AudioContext | null>(null);
  const frameRef = useRef<number | null>(null);
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => () => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    streamRef.current?.getTracks().forEach((track) => track.stop());
    void contextRef.current?.close();
  }, []);

  function stop() {
    if (timerRef.current) clearInterval(timerRef.current);
    if (recorderRef.current?.state === "recording") recorderRef.current.stop();
    setRecording(false);
  }

  async function start() {
    setError("");
    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) { setError("Este navegador no permite grabar audio. Prueba en Chrome o en la app instalada."); return; }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true }); streamRef.current = stream;
      const context = new AudioContext(); contextRef.current = context;
      const analyser = context.createAnalyser(); analyser.fftSize = 256; context.createMediaStreamSource(stream).connect(analyser);
      const samples = new Uint8Array(analyser.fftSize);
      const measure = () => { analyser.getByteTimeDomainData(samples); let energy=0; for (const sample of samples) energy += ((sample-128)/128)**2; setLevel(Math.min(1,Math.sqrt(energy/samples.length)*4)); frameRef.current=requestAnimationFrame(measure); };
      measure();
      const recorder = new MediaRecorder(stream); const chunks: BlobPart[]=[];
      recorder.ondataavailable = (event) => { if (event.data.size) chunks.push(event.data); };
      recorder.onstop = () => {
        const blob = new Blob(chunks,{type:recorder.mimeType||"audio/webm"});
        stream.getTracks().forEach((track)=>track.stop()); streamRef.current=null;
        if (frameRef.current!==null) cancelAnimationFrame(frameRef.current);
        void contextRef.current?.close(); contextRef.current=null; setLevel(0); setUploading(true);
        void uploadMedia(blob,userId,"audio").then(onChange).catch((cause:unknown)=>{console.error("Perfil Base: error al subir la presentación de audio",cause);setError(messageFromError(cause));}).finally(()=>setUploading(false));
      };
      recorderRef.current=recorder; setSeconds(0); recorder.start(); setRecording(true);
      let elapsed = 0;
      timerRef.current=setInterval(()=>{elapsed+=1;setSeconds(elapsed);if(elapsed>=15)stop();},1000);
    } catch (cause) { console.error("Perfil Base: error al iniciar el micrófono",cause); setError(messageFromError(cause) || "Permite el acceso al micrófono para grabar."); }
  }

  return <section className="recorder default-audio-recorder"><div className="recorder-copy"><span className="eyebrow">AUDIO PREDETERMINADO · 15 SEGUNDOS</span><p>Se reutiliza al crear tu ficha de trabajador.</p></div><div className={`audio-wave ${recording?"recording":""}`} aria-label={recording?`Nivel de micrófono ${Math.round(level*100)} por ciento`:"Indicador de grabación"}>{Array.from({length:20},(_,index)=><i key={index} style={{"--bar":`${Math.max(5,(9+(index*13)%28)*Math.max(.15,level))}px`} as CSSProperties}/>)}</div><div className="recorder-controls">{recording?<button type="button" className="record-button stop" onClick={stop}><Square size={14} fill="currentColor"/> Parar · {15-seconds}s</button>:<button type="button" className="record-button" onClick={()=>void start()} disabled={uploading}><Mic size={15}/> {uploading?"Subiendo…":value?"Grabar otra vez (15s)":"Grabar presentación (15s)"}</button>}{value&&<><audio ref={audioRef} src={value} preload="none" className="hidden-audio" onEnded={()=>setPlaying(false)}/><button type="button" className="round-control" aria-label={playing?"Pausar presentación":"Escuchar presentación"} onClick={()=>{const audio=audioRef.current;if(!audio)return;if(playing)audio.pause();else void audio.play();setPlaying(!playing);}}>{playing?<Pause size={15}/>:<Play size={15} fill="currentColor"/>}</button><button type="button" className="text-action" onClick={()=>{onChange("");setPlaying(false);}}><Trash2 size={13}/> Eliminar</button></>}</div>{error&&<p className="form-error" role="alert">{error}</p>}</section>;
}
