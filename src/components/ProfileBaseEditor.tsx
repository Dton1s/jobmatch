"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { Camera, Check, Mic2, Save, X } from "lucide-react";
import { supabase, type Profile } from "@/lib/supabase";

async function uploadImage(file: File, userId: string) {
  if (!supabase) throw new Error("Falta configurar Supabase.");
  if (file.size > 8_000_000) throw new Error("La imagen no puede superar 8 MB.");
  const extension = file.type.split("/")[1]?.replace("x-", "") || "jpg";
  const path = `${userId}/base-${crypto.randomUUID()}.${extension}`;
  const { error } = await supabase.storage.from("jobmatch-media").upload(path, file, { upsert: false, contentType: file.type });
  if (error) throw error;
  return supabase.storage.from("jobmatch-media").getPublicUrl(path).data.publicUrl;
}

export function ProfileBaseEditor({ profile, onSaved, onClose }: { profile: Profile; onSaved: () => void; onClose: () => void }) {
  const [tab, setTab] = useState<"worker" | "company">(profile.role === "company" ? "company" : "worker");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [image, setImage] = useState<File | null>(null);
  const [preview, setPreview] = useState("");
  const [companyPhone, setCompanyPhone] = useState("");
  const [phoneVisible, setPhoneVisible] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const isWorker = tab === "worker";
  const photo = preview || (isWorker ? profile.avatar_url : profile.company_logo_url) || "";

  useEffect(() => {
    if (!supabase) return;
    void supabase.from("jobmatch_company_contacts").select("phone,visible_after_match").eq("company_id", profile.id).maybeSingle().then(({ data }) => {
      setCompanyPhone(data?.phone ?? ""); setPhoneVisible(data?.visible_after_match ?? false);
    });
  }, [profile.id]);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase) return;
    setBusy(true); setError("");
    const data = new FormData(event.currentTarget);
    try {
      const imageUrl = image ? await uploadImage(image, profile.id) : photo || null;
      const values = isWorker ? {
        avatar_url: imageUrl,
        full_name: String(data.get("full_name") || "").trim(),
        birth_year: Number(data.get("birth_year")) || null,
        city: String(data.get("city") || "").trim(),
        experience_years: Number(data.get("experience_years")) || 0,
        has_driving_license: data.get("has_driving_license") === "on",
        has_own_vehicle: data.get("has_own_vehicle") === "on",
        languages: String(data.get("languages") || "").split(",").map((item) => item.trim()).filter(Boolean).slice(0, 12),
        default_bio: String(data.get("default_bio") || "").trim(),
        default_audio_url: String(data.get("default_audio_url") || "").trim() || null,
        display_name: String(data.get("full_name") || "").trim(),
      } : {
        company_logo_url: imageUrl,
        company_name: String(data.get("company_name") || "").trim(),
        company_sector: String(data.get("company_sector") || "").trim(),
        company_address: String(data.get("company_address") || "").trim(),
        company_description: String(data.get("company_description") || "").trim(),
        company_phone: String(data.get("company_phone") || "").trim(),
        company_phone_enabled: data.get("company_phone_enabled") === "on",
        display_name: String(data.get("company_name") || "").trim(),
        avatar_url: imageUrl,
      };
      const { error: updateError } = await supabase.from("jobmatch_profiles").update(values).eq("id", profile.id);
      if (updateError) throw updateError;
      if (!isWorker) {
        const { error: contactError } = await supabase.from("jobmatch_company_contacts").upsert({ company_id: profile.id, phone: String(data.get("company_phone") || "").trim(), visible_after_match: data.get("company_phone_enabled") === "on" }, { onConflict: "company_id" });
        if (contactError) throw contactError;
      }
      onSaved();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "No se pudo guardar el perfil."); }
    finally { setBusy(false); }
  }

  return <div className="drawer-backdrop profile-base-backdrop" onClick={onClose}>
    <section className="profile-base-panel" role="dialog" aria-modal="true" aria-labelledby="profile-base-title" onClick={(event) => event.stopPropagation()}>
      <header className="drawer-heading"><div><span className="eyebrow">DATOS REUTILIZABLES</span><h2 id="profile-base-title">Perfil Base</h2></div><button className="icon-close" onClick={onClose} aria-label="Cerrar"><X size={18}/></button></header>
      <div className="profile-base-tabs" role="tablist" aria-label="Tipo de perfil"><button role="tab" aria-selected={isWorker} className={isWorker ? "selected" : ""} onClick={() => { setTab("worker"); setImage(null); setPreview(""); }}>Datos de Trabajador</button><button role="tab" aria-selected={!isWorker} className={!isWorker ? "selected" : ""} onClick={() => { setTab("company"); setImage(null); setPreview(""); }}>Datos de Empresa</button></div>
      <form className="editor-form profile-base-form" onSubmit={save}>
        <div className="identity-row"><button type="button" className="avatar-picker" onClick={() => fileRef.current?.click()} aria-label={isWorker ? "Elegir avatar de trabajador" : "Elegir logo de empresa"}><span className="avatar-preview" style={photo ? { backgroundImage: `url(${photo})` } : undefined}>{photo ? null : isWorker ? "JM" : "＋"}</span><span className="camera-badge"><Camera size={15}/></span></button><input ref={fileRef} className="hidden-file" type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => { const file = event.target.files?.[0]; if (!file) return; if (preview.startsWith("blob:")) URL.revokeObjectURL(preview); setImage(file); setPreview(URL.createObjectURL(file)); }}/><div><b>{isWorker ? "Avatar predeterminado" : "Logo predeterminado"}</b><small>Se usará al crear una ficha u oferta nueva.</small></div></div>
        {isWorker ? <>
          <div className="form-two"><label>Nombre y apellidos<input name="full_name" defaultValue={profile.full_name || profile.display_name} maxLength={100}/></label><label>Año de nacimiento<input name="birth_year" type="number" min="1900" max={new Date().getFullYear()} defaultValue={profile.birth_year ?? ""} placeholder="Opcional"/></label></div>
          <div className="form-two"><label>Ciudad habitual<input name="city" defaultValue={profile.city} placeholder="Torrevieja"/></label><label>Años de experiencia<input name="experience_years" type="number" min="0" max="60" step="0.5" defaultValue={profile.experience_years || 0}/></label></div>
          <label>Idiomas <small>Separados por coma</small><input name="languages" defaultValue={profile.languages?.join(", ") ?? ""} placeholder="Español, Inglés B2"/></label>
          <div className="profile-checks"><label><input type="checkbox" name="has_driving_license" defaultChecked={profile.has_driving_license}/> Tengo carnet de conducir</label><label><input type="checkbox" name="has_own_vehicle" defaultChecked={profile.has_own_vehicle}/> Dispongo de vehículo propio</label></div>
          <label>Presentación por defecto<textarea name="default_bio" rows={4} maxLength={1200} defaultValue={profile.default_bio} placeholder="Experiencia, fortalezas y lo que buscas…"/></label>
          <label><span><Mic2 size={14}/> Audio predeterminado <small>(URL pública, opcional)</small></span><input name="default_audio_url" type="url" defaultValue={profile.default_audio_url ?? ""} placeholder="https://…"/></label>
          {profile.default_audio_url && <audio controls preload="none" src={profile.default_audio_url} className="base-audio-preview"/>}
        </> : <>
          <label>Nombre comercial<input name="company_name" defaultValue={profile.company_name || profile.display_name} maxLength={120}/></label>
          <div className="form-two"><label>Sector<input name="company_sector" defaultValue={profile.company_sector} placeholder="Hostelería, comercio…"/></label><label>Teléfono de contacto<input name="company_phone" type="tel" value={companyPhone} onChange={(event)=>setCompanyPhone(event.target.value)} placeholder="+34 600 000 000"/></label></div>
          <label>Dirección del negocio<input name="company_address" defaultValue={profile.company_address} placeholder="Dirección del local"/></label>
          <label>Descripción del negocio<textarea name="company_description" rows={4} maxLength={1200} defaultValue={profile.company_description} placeholder="Qué hace especial a tu equipo…"/></label>
          <label className="profile-phone-toggle"><input type="checkbox" name="company_phone_enabled" checked={phoneVisible} onChange={(event)=>setPhoneVisible(event.target.checked)}/> Mostrar mi teléfono a mis matches</label>
        </>}
        {error && <p className="form-error" role="alert">{error}</p>}
        <p className="form-footnote"><Check size={14}/> Los datos se guardan como valores predeterminados; puedes personalizar cada ficha u oferta.</p>
        <button className="primary-button save-button" disabled={busy}><Save size={16}/>{busy ? "Guardando…" : "Guardar Perfil Base"}</button>
      </form>
    </section>
  </div>;
}
