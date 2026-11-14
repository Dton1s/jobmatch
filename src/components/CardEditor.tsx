"use client";

import { useState, type FormEvent } from "react";
import { ImagePlus, MapPin, Save } from "lucide-react";
import { supabase, type JobOffer, type Profile, type WorkerCard } from "@/lib/supabase";

const sectors = ["Hostelería", "Comercio", "Logística", "Limpieza", "Atención al cliente", "Administración", "Construcción", "Sanidad", "Tecnología", "Otro"];

async function upload(file: File, userId: string, type: "photo" | "audio") {
  if (!supabase) throw new Error("Falta configurar Supabase.");
  const ext = file.name.split(".").pop() || (type === "audio" ? "webm" : "jpg");
  const path = `${userId}/${type}-${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from("jobmatch-media").upload(path, file, { upsert: false, contentType: file.type });
  if (error) throw error;
  return supabase.storage.from("jobmatch-media").getPublicUrl(path).data.publicUrl;
}

function audioDuration(file: File) {
  return new Promise<number>((resolve, reject) => {
    const audio = document.createElement("audio");
    const url = URL.createObjectURL(file);
    audio.preload = "metadata";
    audio.onloadedmetadata = () => { URL.revokeObjectURL(url); resolve(audio.duration); };
    audio.onerror = () => { URL.revokeObjectURL(url); reject(new Error("No se pudo leer la duración del audio.")); };
    audio.src = url;
  });
}

export function CardEditor({ profile, existingWorker, existingOffer, onSaved, onCancel }: {
  profile: Profile; existingWorker: WorkerCard | null; existingOffer: JobOffer | null;
  onSaved: () => void; onCancel: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);
  const [audio, setAudio] = useState<File | null>(null);
  const [lat, setLat] = useState(String(profile.lat ?? ""));
  const [lng, setLng] = useState(String(profile.lng ?? ""));
  const isWorker = profile.role === "worker";

  function locate() {
    navigator.geolocation?.getCurrentPosition(({ coords }) => {
      setLat((coords.latitude).toFixed(3)); setLng((coords.longitude).toFixed(3));
    }, () => setError("No se pudo obtener tu ubicación; puedes escribir ciudad y coordenadas."), { enableHighAccuracy: false, timeout: 8000 });
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError("");
    const data = new FormData(event.currentTarget);
    try {
      if (!supabase) throw new Error("Configura las variables de Supabase primero.");
      const latNumber = Number(lat), lngNumber = Number(lng);
      if (!data.get("city") || !Number.isFinite(latNumber) || !Number.isFinite(lngNumber) || lat === "" || lng === "") throw new Error("Completa la ciudad y la ubicación aproximada.");
      const photoPath = photo ? await upload(photo, profile.id, "photo") : (isWorker ? existingWorker?.photo_path : existingOffer?.business_image_path) ?? null;
      if (isWorker) {
        const skills = String(data.get("skills") ?? "").split(",").map((x) => x.trim()).filter(Boolean).slice(0, 15);
        let audioPath = existingWorker?.intro_audio_path ?? null;
        if (audio) {
          if (audio.size > 2_000_000) throw new Error("El audio no puede superar 2 MB.");
          if (await audioDuration(audio) > 15) throw new Error("La presentación de audio debe durar 15 segundos o menos.");
          audioPath = await upload(audio, profile.id, "audio");
        }
        const row = { user_id: profile.id, full_name: String(data.get("full_name")), photo_path: photoPath, desired_position: String(data.get("position")), sector: String(data.get("sector")), experience_years: Number(data.get("experience")), availability: String(data.get("availability")), skills, city: String(data.get("city")), lat: latNumber, lng: lngNumber, intro_audio_path: audioPath, is_active: true };
        const result = await supabase.from("jobmatch_worker_cards").upsert(row, { onConflict: "user_id" });
        if (result.error) throw result.error;
        await supabase.from("jobmatch_profiles").update({ display_name: row.full_name, city: row.city, lat: Number(latNumber.toFixed(2)), lng: Number(lngNumber.toFixed(2)), avatar_path: photoPath, onboarding_complete: true }).eq("id", profile.id);
      } else {
        const row = { company_id: profile.id, business_name: String(data.get("business")), business_image_path: photoPath, position: String(data.get("position")), sector: String(data.get("sector")), salary_text: String(data.get("salary_text")), salary_min: data.get("salary_min") ? Number(data.get("salary_min")) : null, salary_period: String(data.get("salary_period")), shift_type: String(data.get("shift")), description: String(data.get("description")), city: String(data.get("city")), lat: latNumber, lng: lngNumber, is_active: true, expires_at: new Date(Date.now() + 14 * 86400000).toISOString() };
        if (existingOffer) {
          const result = await supabase.from("jobmatch_job_offers").update(row).eq("id", existingOffer.id);
          if (result.error) throw result.error;
        } else {
          const result = await supabase.from("jobmatch_job_offers").insert(row);
          if (result.error) throw result.error;
        }
        await supabase.from("jobmatch_profiles").update({ display_name: row.business_name, city: row.city, lat: Number(latNumber.toFixed(2)), lng: Number(lngNumber.toFixed(2)), avatar_path: photoPath, onboarding_complete: true }).eq("id", profile.id);
      }
      onSaved();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "No se pudo guardar. Comprueba los campos e inténtalo otra vez."); }
    finally { setBusy(false); }
  }

  return <section className="editor-panel"><div className="editor-heading"><div><span className="eyebrow">TU TARJETA</span><h2>{isWorker ? "Preséntate al trabajo que buscas." : "Publica un puesto con claridad."}</h2></div><button className="icon-close" onClick={onCancel} aria-label="Cerrar">×</button></div>
    <form className="editor-form" onSubmit={save}>
      {isWorker ? <>
        <label>Nombre completo<input name="full_name" defaultValue={existingWorker?.full_name ?? profile.display_name} required maxLength={80} /></label>
        <label>Puesto que buscas<input name="position" defaultValue={existingWorker?.desired_position} required maxLength={100} placeholder="Camarero/a" /></label>
        <label>Sector<select name="sector" defaultValue={existingWorker?.sector ?? "Hostelería"}>{sectors.map((s) => <option key={s}>{s}</option>)}</select></label>
        <div className="form-two"><label>Años de experiencia<input name="experience" type="number" min="0" max="60" step="0.5" defaultValue={existingWorker?.experience_years ?? 0} /></label><label>Disponibilidad<select name="availability" defaultValue={existingWorker?.availability ?? "inmediata"}><option value="inmediata">Inmediata</option><option value="fines_de_semana">Fines de semana</option><option value="media_jornada">Media jornada</option><option value="completa">Jornada completa</option></select></label></div>
        <label>Habilidades <small>Separadas por coma</small><input name="skills" defaultValue={existingWorker?.skills?.join(", ")} placeholder="Carnet B, TPV, Inglés" /></label>
        <label>Foto de perfil<input type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => setPhoto(e.target.files?.[0] ?? null)} /></label>
        <label>Audio de presentación opcional · máximo 15 s<input type="file" accept="audio/*" onChange={(e) => setAudio(e.target.files?.[0] ?? null)} /></label>
      </> : <>
        <label>Nombre del negocio<input name="business" defaultValue={existingOffer?.business_name ?? profile.display_name} required maxLength={100} /></label>
        <label>Puesto ofrecido<input name="position" defaultValue={existingOffer?.position} required maxLength={100} placeholder="Ayudante de cocina" /></label>
        <label>Sector<select name="sector" defaultValue={existingOffer?.sector ?? "Hostelería"}>{sectors.map((s) => <option key={s}>{s}</option>)}</select></label>
        <div className="form-two"><label>Salario claro (obligatorio)<input name="salary_text" defaultValue={existingOffer?.salary_text} required placeholder="1.350 €/mes netos" /></label><label>Salario mensual desde (opcional)<input name="salary_min" type="number" min="0" step="0.01" defaultValue={existingOffer?.salary_min ?? ""} /></label></div>
        <div className="form-two"><label>Periodo<select name="salary_period" defaultValue={existingOffer?.salary_period ?? "mensual"}><option value="mensual">Al mes</option><option value="hora">Por hora</option><option value="anual">Al año</option></select></label><label>Turno<select name="shift" defaultValue={existingOffer?.shift_type ?? "Mañana"}><option>Mañana</option><option>Tarde</option><option>Noche</option><option>Rotativo</option><option>Fines de semana</option></select></label></div>
        <label>Descripción breve<textarea name="description" defaultValue={existingOffer?.description} required maxLength={1200} rows={4} placeholder="Cuéntanos las tareas y lo que ofrecéis." /></label>
        <label>Logo o foto del negocio<input type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => setPhoto(e.target.files?.[0] ?? null)} /></label>
      </>}
      <div className="location-row"><label>Ciudad<input name="city" defaultValue={isWorker ? existingWorker?.city ?? profile.city : existingOffer?.city ?? profile.city} required /></label><button className="location-button" type="button" onClick={locate}><MapPin size={15} /> Usar mi ubicación</button></div>
      <div className="form-two"><label>Latitud aproximada<input inputMode="decimal" value={lat} onChange={(e) => setLat(e.target.value)} required /></label><label>Longitud aproximada<input inputMode="decimal" value={lng} onChange={(e) => setLng(e.target.value)} required /></label></div>
      {error && <p className="form-error" role="alert">{error}</p>}
      <button className="primary-button save-button" disabled={busy} type="submit"><Save size={17} />{busy ? "Guardando…" : isWorker ? "Guardar mi ficha" : existingOffer ? "Guardar cambios" : "Publicar oferta"}</button>
      {!isWorker && <p className="form-footnote"><ImagePlus size={14} /> La oferta caduca automáticamente a los 14 días.</p>}
    </form>
  </section>;
}
