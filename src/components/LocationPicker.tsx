"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { LoaderCircle, MapPin, Plus } from "lucide-react";
import { isNativePlatform } from "@/lib/platform";
import { findMunicipality, loadSpanishMunicipalities, nearestMunicipality, type Municipality } from "@/lib/spain-locations";

export type LocationValue = { city: string; province: string; postal: string; lat: number | null; lng: number | null };
const empty: LocationValue = { city: "", province: "", postal: "", lat: null, lng: null };
let lastReverseLookupAt = 0;

export function LocationPicker({ value, onChange, onError }: { value: LocationValue; onChange: (value: LocationValue) => void; onError?: (message: string) => void }) {
  const [locations, setLocations] = useState<Municipality[]>([]);
  const [query, setQuery] = useState(value.city);
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);
  const [locating, setLocating] = useState(false);
  const [loadError, setLoadError] = useState("");
  const cityControlRef = useRef<HTMLDivElement>(null);
  const suggestionsId = useId();
  useEffect(() => { let alive = true; void loadSpanishMunicipalities().then((items) => { if (!alive) return; setLocations(items); if (!value.province && value.city) { const match = findMunicipality(items, value.city); if (match) onChange({ ...value, city: match.name, province: match.province, lat: value.lat ?? match.lat, lng: value.lng ?? match.lng }); } }).catch(() => { if (alive) setLoadError("No se pudo cargar el listado. Puedes escribir la población manualmente."); }); return () => { alive = false; }; // The initial value is used once after the catalogue loads.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => { setQuery(value.city); }, [value.city]);
  useEffect(() => {
    function closeSuggestions(event: PointerEvent) {
      if (!cityControlRef.current?.contains(event.target as Node)) setSuggestionsOpen(false);
    }
    document.addEventListener("pointerdown", closeSuggestions);
    return () => document.removeEventListener("pointerdown", closeSuggestions);
  }, []);
  const provinces = useMemo(() => [...new Set(locations.map((item) => item.province))].sort((a, b) => a.localeCompare(b, "es")), [locations]);
  const cities = useMemo(() => locations.filter((item) => item.province === value.province).sort((a, b) => a.name.localeCompare(b.name, "es")), [locations, value.province]);
  const suggestions = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("es");
    if (normalized.length < 2 || normalized === value.city.trim().toLocaleLowerCase("es")) return [];
    return cities.filter((item) => item.name.toLocaleLowerCase("es").includes(normalized)).slice(0, 12);
  }, [cities, query, value.city]);

  function selectProvince(province: string) { onChange({ ...empty, province, postal: value.postal }); setQuery(""); }
  function selectCity(city: Municipality) { onChange({ ...value, city: city.name, province: city.province, lat: city.lat, lng: city.lng }); setQuery(city.name); setSuggestionsOpen(false); }
  function typeCity(text: string) {
    setQuery(text);
    setSuggestionsOpen(true);
    const found = findMunicipality(locations, text, value.province);
    onChange({ ...value, city: text, ...(found ? { province: found.province, lat: found.lat, lng: found.lng } : { lat: null, lng: null }) });
  }

  async function locate() {
    setLocating(true); onError?.("");
    try {
      let coords: { latitude: number; longitude: number };
      if (isNativePlatform()) {
        const { Geolocation } = await import("@capacitor/geolocation");
        const permission = await Geolocation.requestPermissions();
        if (permission.location !== "granted" && permission.coarseLocation !== "granted") throw new Error("Activa el permiso de ubicación para Job Match en los ajustes de Android.");
        const position = await Geolocation.getCurrentPosition({ enableHighAccuracy: true, timeout: 20000, maximumAge: 30000 });
        coords = position.coords;
      } else {
        if (!navigator.geolocation) throw new Error("Este navegador no ofrece ubicación. Elige provincia y población.");
        const position = await new Promise<GeolocationPosition>((resolve, reject) => navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, timeout: 20000, maximumAge: 30000 }));
        coords = position.coords;
      }
      const nearest = nearestMunicipality(locations, coords.latitude, coords.longitude);
      if (!nearest) throw new Error("No encontramos un municipio cercano. Selecciónalo manualmente.");
      let postal = "";
      try {
        const wait = Math.max(0, 1000 - (Date.now() - lastReverseLookupAt));
        if (wait) await new Promise((resolve) => setTimeout(resolve, wait));
        lastReverseLookupAt = Date.now();
        const reverse = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${coords.latitude}&lon=${coords.longitude}&zoom=10&addressdetails=1&email=soporte%40job-match.es`, { headers: { Accept: "application/json" } });
        if (reverse.ok) {
          const result = await reverse.json() as { address?: { postcode?: string } };
          postal = result.address?.postcode?.match(/\d{5}/)?.[0] ?? "";
        }
      } catch { /* Las coordenadas del municipio siguen siendo válidas si falla la consulta postal. */ }
      onChange({ city: nearest.name, province: nearest.province, postal, lat: coords.latitude, lng: coords.longitude });
    } catch (cause) {
      const message = cause instanceof Error && cause.message ? cause.message : "No pudimos detectar tu ubicación. Elige provincia y población manualmente.";
      onError?.(message);
    } finally { setLocating(false); }
  }

  return <section className="location-card"><div className="location-card-top"><div className="location-summary"><span className="eyebrow">UBICACIÓN Y DISTANCIA</span><strong>{value.city || "Elige una población"}</strong><p>{[value.province, value.postal].filter(Boolean).join(" · ") || "Tu ubicación aparecerá aquí"}</p></div><button type="button" className="location-button" onClick={() => void locate()} disabled={locating || locations.length === 0}>{locating ? <LoaderCircle className="spin" size={15}/> : <MapPin size={15}/>} {locating ? "Detectando…" : "Detectar mi ubicación"}</button></div>
    {loadError && <small className="form-error">{loadError}</small>}
    <div className="form-two location-fields"><label>Provincia<select className="location-control-input" value={value.province} onChange={(event) => selectProvince(event.target.value)} required><option value="">Selecciona provincia</option>{provinces.map((province) => <option key={province}>{province}</option>)}</select></label><label>Población / Ciudad<div className="location-city-control" ref={cityControlRef}><input className="location-control-input" value={query} onFocus={() => setSuggestionsOpen(true)} onChange={(event) => typeCity(event.target.value)} autoComplete="address-level2" aria-expanded={suggestionsOpen && suggestions.length > 0} aria-controls={suggestionsId} required placeholder={value.province ? "Busca tu población" : "Selecciona primero provincia"} disabled={!value.province}/>{suggestionsOpen && suggestions.length > 0 && <div id={suggestionsId} className="location-suggestions" role="listbox" aria-label="Poblaciones">{suggestions.map((item) => <button type="button" role="option" aria-selected={item.name === value.city} key={item.ineCode} onClick={() => selectCity(item)}>{item.name}</button>)}</div>}</div></label></div>
    <label className="postal-field">Código postal<input className="location-control-input" name="postal" inputMode="numeric" maxLength={5} pattern="\d{5}" value={value.postal} onChange={(event) => onChange({ ...value, postal: event.target.value.replace(/\D/g, "").slice(0, 5) })} placeholder="03181"/></label>
    <small className="location-attribution">Geocodificación inversa © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap contributors</a></small>
  </section>;
}

export function TagInput({ label, name, suggestions, value, onChange, placeholder, max = 12 }: { label: string; name: string; suggestions: string[]; value: string[]; onChange: (value: string[]) => void; placeholder: string; max?: number }) {
  const [draft, setDraft] = useState("");
  function add(raw: string) { const tag = raw.trim().replace(/\s+/g, " "); if (!tag || value.some((item) => item.toLocaleLowerCase("es") === tag.toLocaleLowerCase("es")) || value.length >= max) return; onChange([...value, tag]); setDraft(""); }
  return <div className="tag-field"><span className="tag-field-label">{label}</span><input type="hidden" name={name} value={JSON.stringify(value)}/><div className="tag-chips">{value.map((item) => <span className="tag-chip" key={item}>{item}<button type="button" onClick={() => onChange(value.filter((tag) => tag !== item))} aria-label={`Quitar ${item}`}>×</button></span>)}</div><div className="tag-entry"><input value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); add(draft); } }} placeholder={placeholder}/><button type="button" aria-label={`Añadir ${label}`} onClick={() => add(draft)}><Plus size={16}/></button></div><div className="tag-suggestions">{suggestions.filter((item) => !value.includes(item)).map((item) => <button key={item} type="button" onClick={() => add(item)}>{item}</button>)}</div></div>;
}
