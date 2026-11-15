"use client";

import { useRef, useState, type ChangeEvent } from "react";
import { FileText, LoaderCircle, Trash2, Upload, X } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { openCvReference, PRIVATE_CV_BUCKET, PRIVATE_CV_PREFIX, removeCvReference } from "@/lib/cv-storage";

const MAX_CV_BYTES = 5 * 1024 * 1024;

export function CvUploadField({ userId, value, filename, onChange }: {
  userId: string; value: string | null; filename: string | null; onChange: (url: string | null, filename: string | null) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [opening, setOpening] = useState(false);
  const [removing, setRemoving] = useState(false);
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
      // Keep the UUID as the first Storage folder, matching avatar/audio uploads.
      const path = `${userId}/cv-${Date.now()}.pdf`;
      const { error: uploadError } = await supabase.storage.from(PRIVATE_CV_BUCKET).upload(path, file, { upsert: false, contentType: "application/pdf" });
      if (uploadError) throw uploadError;
      onChange(`${PRIVATE_CV_PREFIX}${path}`, file.name);
    } catch (cause) {
      console.error("Error al subir el currículum PDF", cause);
      setError(cause instanceof Error ? cause.message : "No se pudo subir el PDF. Inténtalo de nuevo.");
    } finally { setUploading(false); }
  }

  async function viewFile() {
    if (!value || opening) return;
    setError(""); setOpening(true);
    try { await openCvReference(value, userId); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "No se pudo abrir el currículum."); }
    finally { setOpening(false); }
  }

  async function removeFile() {
    if (!value || removing) return;
    setError(""); setRemoving(true);
    try { await removeCvReference(value, userId); onChange(null, null); }
    catch (cause) { console.error("Error al eliminar el currículum PDF", cause); setError(cause instanceof Error ? cause.message : "No se pudo eliminar el currículum."); }
    finally { setRemoving(false); }
  }

  return <section className="cv-upload-field">
    <div className="cv-upload-heading"><FileText size={17}/><div><b>Currículum en PDF (opcional)</b><small>PDF · máximo 5 MB · visible en tus matches</small></div></div>
    <input ref={inputRef} className="hidden-file" type="file" accept="application/pdf,.pdf" onChange={(event) => void chooseFile(event)}/>
    {value ? <div className="cv-file-row"><div className="cv-file-main"><FileText size={17}/><span title={filename || "Currículum.pdf"}>{filename || "Currículum.pdf"}</span></div><div className="cv-file-actions"><button type="button" className="cv-view-link" onClick={()=>void viewFile()} disabled={opening || removing}>{opening?<><LoaderCircle className="spin" size={14}/> Abriendo…</>:"Ver mi PDF"}</button><button type="button" className="cv-remove" onClick={()=>void removeFile()} aria-label="Eliminar currículum" disabled={opening || removing}>{removing?<LoaderCircle className="spin" size={15}/>:<Trash2 size={15}/>}</button></div></div> : <button type="button" className="cv-select-button" onClick={() => inputRef.current?.click()} disabled={uploading}>{uploading ? <><LoaderCircle className="spin" size={16}/> Subiendo PDF…</> : <><Upload size={16}/> Seleccionar currículum PDF</>}</button>}
    {uploading && <div className="cv-progress" role="progressbar" aria-label="Subiendo currículum"><i/></div>}
    {error && <p className="form-error cv-error" role="alert">{error}<button type="button" onClick={() => setError("")} aria-label="Cerrar aviso"><X size={13}/></button></p>}
  </section>;
}
