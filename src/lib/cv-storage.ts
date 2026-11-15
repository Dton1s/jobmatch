import { supabase } from "@/lib/supabase";

export const PRIVATE_CV_BUCKET = "jobmatch-cvs";
export const PRIVATE_CV_PREFIX = `${PRIVATE_CV_BUCKET}:`;

type CvObject = { bucket: typeof PRIVATE_CV_BUCKET | "jobmatch-media"; path: string };

function belongsToOwner(path: string, ownerId: string) {
  const folders = path.split("/");
  return folders[0] === ownerId || (folders[0] === "cv" && folders[1] === ownerId);
}

function parseCvReference(reference: string): CvObject {
  const value = reference.trim();
  if (value.startsWith(PRIVATE_CV_PREFIX)) {
    return { bucket: PRIVATE_CV_BUCKET, path: value.slice(PRIVATE_CV_PREFIX.length).replace(/^\/+/, "") };
  }

  if (/^https?:\/\//i.test(value)) {
    const url = new URL(value);
    const configuredUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (!configuredUrl || url.origin !== new URL(configuredUrl).origin) throw new Error("El enlace antiguo del currículum no pertenece al almacenamiento JobMatch.");
    const match = url.pathname.match(/\/storage\/v1\/object\/(?:public|sign)\/(jobmatch-media|jobmatch-cvs)\/(.+)$/);
    if (!match) throw new Error("No se reconoce la ubicación del currículum guardado.");
    return { bucket: match[1] as CvObject["bucket"], path: match[2].split("/").map((part) => decodeURIComponent(part)).join("/") };
  }

  return { bucket: PRIVATE_CV_BUCKET, path: value.replace(/^\/+/, "") };
}

export async function openCvReference(reference: string, ownerId: string) {
  if (!supabase) throw new Error("No se pudo conectar con el almacenamiento.");
  const file = parseCvReference(reference);
  if (!file.path || !belongsToOwner(file.path, ownerId)) throw new Error("El currículum no pertenece a este perfil.");

  const tab = window.open("about:blank", "_blank");
  if (!tab) throw new Error("Permite abrir ventanas emergentes para ver el PDF.");
  tab.opener = null;

  try {
    const { data, error } = await supabase.storage.from(file.bucket).createSignedUrl(file.path, 300);
    if (error) throw error;
    tab.location.replace(data.signedUrl);
  } catch (error) {
    tab.close();
    throw error;
  }
}

export async function removeCvReference(reference: string, ownerId: string) {
  if (!supabase) throw new Error("No se pudo conectar con el almacenamiento.");
  const file = parseCvReference(reference);
  if (!file.path || !belongsToOwner(file.path, ownerId)) throw new Error("El currículum no pertenece a este perfil.");
  const { error } = await supabase.storage.from(file.bucket).remove([file.path]);
  if (error) throw error;
}
