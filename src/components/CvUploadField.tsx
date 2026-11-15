"use client";

import { useRef, useState, type ChangeEvent } from "react";
import { FileText, LoaderCircle, Trash2, Upload, X } from "lucide-react";
import { supabase } from "@/lib/supabase";

const MAX_CV_BYTES = 5 * 1024 * 1024;

export function CvUploadField({ userId, value, filename, onChange }: {
  userId: string; value: string | null; filename: string | null; onChange: (url: string | null, filename: string | null) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  async function chooseFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".pdf") || (file.type && file.type !== "application/pdf")) {
      setError("Selecciona un archivo PDF válido."); return;
    }
    if (file.size > MAX_CV_BYTES) { setError("El PDF no puede superar los 5 MB."); return; }
    if (!supabase) { setError("No se pudo conectar con el almacenamiento."); return; }
    setError(""); setUploading(true);
    try {
      const safeName = file.name.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "").slice(-100) || "curriculum.pdf";
      const path = `cv/${userId}/${crypto.randomUUID()}-${safeName}`;
      const { error: uploadError } = await supabase.storage.from("jobmatch-media").upload(path, file, { upsert: false, contentType: "application/pdf" });
      if (uploadError) throw uploadError;
      const publicUrl = supabase.storage.from("jobmatch-media").getPublicUrl(path).data.publicUrl;
      onChange(publicUrl, file.name);
    } catch (cause) {
      console.error("Error al subir el currículum PDF", cause);
      setError(cause instanceof Error ? cause.message : "No se pudo subir el PDF. Inténtalo de nuevo.");
    } finally { setUploading(false); }
  }

  return <section className="cv-upload-field">
    <div className="cv-upload-heading"><FileText size={17}/><div><b>Currículum en PDF (opcional)</b><small>PDF · máximo 5 MB · visible en tus matches</small></div></div>
    <input ref={inputRef} className="hidden-file" type="file" accept="application/pdf,.pdf" onChange={(event) => void chooseFile(event)}/>
    {value ? <div className="cv-file-row"><FileText size={17}/><span title={filename || "Currículum.pdf"}>{filename || "Currículum.pdf"}</span><a href={value} target="_blank" rel="noopener noreferrer" className="cv-view-link">Ver mi PDF</a><button type="button" className="cv-remove" onClick={() => { setError(""); onChange(null, null); }} aria-label="Eliminar currículum"><Trash2 size={15}/></button></div> : <button type="button" className="cv-select-button" onClick={() => inputRef.current?.click()} disabled={uploading}>{uploading ? <><LoaderCircle className="spin" size={16}/> Subiendo PDF…</> : <><Upload size={16}/> Seleccionar currículum PDF</>}</button>}
    {uploading && <div className="cv-progress" role="progressbar" aria-label="Subiendo currículum"><i/></div>}
    {error && <p className="form-error cv-error" role="alert">{error}<button type="button" onClick={() => setError("")} aria-label="Cerrar aviso"><X size={13}/></button></p>}
  </section>;
}
