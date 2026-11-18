export type Municipality = { name: string; ineCode: string; province: string; community: string; lat: number; lng: number };
let locationsPromise: Promise<Municipality[]> | null = null;

export function loadSpanishMunicipalities() {
  locationsPromise ??= fetch("/data/spain-municipalities.json")
    .then((response) => { if (!response.ok) throw new Error("No se pudo cargar el listado de municipios."); return response.json() as Promise<Municipality[]>; });
  return locationsPromise;
}

export function haversineKm(a: Pick<Municipality, "lat" | "lng">, b: Pick<Municipality, "lat" | "lng">) {
  const rad = (value: number) => value * Math.PI / 180;
  const dLat = rad(b.lat - a.lat), dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 6371.0088 * 2 * Math.asin(Math.sqrt(h));
}

export function nearestMunicipality(locations: Municipality[], lat: number, lng: number) {
  let nearest: Municipality | null = null;
  let closest = Number.POSITIVE_INFINITY;
  for (const city of locations) {
    const distance = haversineKm({ lat, lng }, city);
    if (distance < closest) { closest = distance; nearest = city; }
  }
  return nearest;
}

export function findMunicipality(locations: Municipality[], name: string, province?: string) {
  const normalized = normalize(name);
  return locations.find((city) => normalize(city.name) === normalized && (!province || normalize(city.province) === normalize(province))) ??
    locations.find((city) => normalize(city.name).startsWith(normalized) && (!province || normalize(city.province) === normalize(province)));
}

function normalize(value: string) { return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("es").trim(); }
