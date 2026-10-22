"use client";

/**
 * Mapas: todo es Google Maps.
 *
 * - Sin clave de API: el mapa de Ruta es el mapa de Google incrustado (ruta del día trazada por
 *   Google y búsquedas de Google), y los negocios se traen con el enlace de "Compartir".
 *   Las paradas se guardan como "Nombre, dirección" y Google mismo las ubica.
 * - Con NEXT_PUBLIC_GOOGLE_MAPS_API_KEY: mapa interactivo con marcadores propios y búsqueda
 *   de Places dentro de la app.
 */

export const GOOGLE_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? "";
export const GOOGLE_MAP_ID = process.env.NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID || "DEMO_MAP_ID";
export const googleEnabled = () => GOOGLE_KEY.length > 0;

export interface LatLng {
  lat: number;
  lng: number;
}

/** Centro de Maracay, para cuando aún no hay ubicación. */
export const MARACAY: LatLng = { lat: 10.2469, lng: -67.5958 };

export type TravelMode = "pie" | "carro";

export interface Place {
  id: string;
  name: string;
  address: string;
  category: string;
  phone: string;
  website: string;
  rating: number | null;
  ratings: number;
  mapsUrl: string;
  source: "google";
  /** Coordenadas, si se conocen. Sin ellas, Google ubica el lugar por nombre y dirección. */
  lat?: number;
  lng?: number;
}

export interface RouteResult {
  path: [number, number][];
  meters: number;
  seconds: number;
}

/* Distancias ------------------------------------------------------ */

export function meters(a: LatLng, b: LatLng) {
  const R = 6_371_000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export function distanceLabel(m: number) {
  if (m < 950) return `${Math.max(10, Math.round(m / 10) * 10)} m`;
  return `${(m / 1000).toFixed(m < 9_950 ? 1 : 0).replace(".", ",")} km`;
}

export function durationLabel(s: number) {
  const min = Math.max(1, Math.round(s / 60));
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const rest = min % 60;
  return rest ? `${h} h ${rest} min` : `${h} h`;
}

export const hasCoords = <T extends { lat?: number; lng?: number }>(x: T): x is T & LatLng =>
  typeof x.lat === "number" && typeof x.lng === "number";

/** Coordenadas dentro de Venezuela (para descartar ubicaciones equivocadas). */
export const inVenezuela = (p: LatLng) => p.lat > 0.5 && p.lat < 12.7 && p.lng > -73.6 && p.lng < -59.7;

/**
 * Orden por cercanía: desde el punto de partida, siempre a la parada más cercana que falte.
 * Las paradas sin coordenadas quedan al final, en su orden.
 */
export function nearestOrder<T extends { lat?: number; lng?: number }>(start: LatLng | null, stops: T[]): T[] {
  const located = stops.filter(hasCoords);
  const rest = stops.filter((s) => !hasCoords(s));
  const out: (T & LatLng)[] = [];
  let here: LatLng | null = start ?? located[0] ?? null;
  const pool = [...located];
  while (pool.length && here) {
    let best = 0;
    for (let i = 1; i < pool.length; i++) if (meters(here, pool[i]) < meters(here, pool[best])) best = i;
    const [next] = pool.splice(best, 1);
    out.push(next);
    here = next;
  }
  return [...out, ...rest];
}

/* Rubros ----------------------------------------------------------- */

const NICHE_WORDS: { match: RegExp; label: string }[] = [
  { match: /gimnas|gym|crossfit|fitness/, label: "Gimnasio" },
  { match: /taller|mec[aá]nic|auto|carro|moto/, label: "Taller mecánico" },
  { match: /odont|dentist|dental/, label: "Odontólogo" },
  { match: /veterin|mascota|pet/, label: "Veterinaria" },
  { match: /barber|peluquer|sal[oó]n/, label: "Barbería" },
  { match: /spa|est[eé]tica|belleza|u[ñn]as/, label: "Spa y estética" },
  { match: /restaur|comida|pizz|arepa/, label: "Restaurante" },
  { match: /caf[eé]/, label: "Cafetería" },
  { match: /panader|pasteler/, label: "Panadería" },
  { match: /farmac/, label: "Farmacia" },
  { match: /cl[ií]nica|m[eé]dic|consultorio/, label: "Clínica" },
  { match: /abogad/, label: "Abogado" },
  { match: /contad/, label: "Contador" },
  { match: /inmobil/, label: "Inmobiliaria" },
  { match: /ferret/, label: "Ferretería" },
  { match: /ropa|boutique|zapat/, label: "Tienda de ropa" },
  { match: /academ|escuela|colegio|idioma/, label: "Academia" },
  { match: /hotel|posada/, label: "Hotel" },
  { match: /mercad|abasto|bodeg|minimarket|super/, label: "Minimarket" },
  { match: /naturist|herbol|org[aá]nic/, label: "Tienda naturista" },
  { match: /regalo|detalle/, label: "Tienda de regalos" },
];

const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

/** Rubro para un texto ("gimnasios" → "Gimnasio"). */
export function nicheFor(text: string): string {
  const q = norm(text);
  return NICHE_WORDS.find((t) => t.match.test(q))?.label ?? text.trim().replace(/^\w/, (c) => c.toUpperCase());
}

/* Cómo se le indica un lugar a Google ------------------------------ */

type Where = { lat?: number; lng?: number; gquery?: string; address?: string; business?: string; zone?: string };

/** Coordenadas si se conocen; si no, "Nombre, dirección" para que Google lo ubique. */
export function googlePlaceText(w: Where, city = "Maracay"): string {
  if (hasCoords(w)) return `${w.lat.toFixed(6)},${w.lng.toFixed(6)}`;
  if (w.gquery) return w.gquery;
  return [w.business, w.address || w.zone, city].filter(Boolean).join(", ");
}

const fmt = (p: LatLng) => `${p.lat.toFixed(6)},${p.lng.toFixed(6)}`;

/** Navegación paso a paso en la app de Google Maps, parada por parada (máx. 10). */
export function googleRouteUrl(stops: Where[], mode: TravelMode, city?: string): string | null {
  const pts = stops.map((s) => googlePlaceText(s, city)).slice(0, 10);
  if (!pts.length) return null;
  const q = new URLSearchParams({ api: "1", destination: pts[pts.length - 1], travelmode: mode === "pie" ? "walking" : "driving" });
  if (pts.length > 1) q.set("waypoints", pts.slice(0, -1).join("|"));
  return `https://www.google.com/maps/dir/?${q.toString()}`;
}

/** Mapa de Google incrustado con la ruta trazada desde donde estás por todas las paradas. */
export function googleEmbedRoute(origin: LatLng | null, stops: Where[], mode: TravelMode, city?: string): string {
  const pts = stops.map((s) => googlePlaceText(s, city)).slice(0, 10);
  const from = origin ? fmt(origin) : pts.shift();
  const q = new URLSearchParams({ saddr: from ?? "", daddr: pts.join(" to:"), dirflg: mode === "pie" ? "w" : "d", hl: "es", output: "embed" });
  return `https://maps.google.com/maps?${q.toString()}`;
}

/** Mapa de Google incrustado mostrando un punto o una búsqueda cerca de un punto. */
export function googleEmbedSearch(query: string, center: LatLng, zoom = 15): string {
  const q = new URLSearchParams({
    q: query || fmt(center),
    ll: fmt(center),
    sll: fmt(center),
    z: String(zoom),
    hl: "es",
    output: "embed",
  });
  return `https://maps.google.com/maps?${q.toString()}`;
}

/** Abre Google Maps buscando cerca del punto (en el iPhone abre la app si está instalada). */
export function googleMapsSearchUrl(query: string, center: LatLng) {
  return `https://www.google.com/maps/search/${encodeURIComponent(query || "negocios")}/@${center.lat.toFixed(5)},${center.lng.toFixed(5)},15z`;
}

/* Con clave: búsqueda de Places, geocodificación y trazado ---------- */

export async function searchPlaces(query: string, center: LatLng, radius = 3000): Promise<Place[]> {
  const { Place } = (await google.maps.importLibrary("places")) as google.maps.PlacesLibrary;
  const { places } = await Place.searchByText({
    textQuery: query,
    fields: [
      "id",
      "displayName",
      "formattedAddress",
      "location",
      "nationalPhoneNumber",
      "internationalPhoneNumber",
      "websiteURI",
      "rating",
      "userRatingCount",
      "googleMapsURI",
      "primaryTypeDisplayName",
    ],
    locationBias: { center, radius: Math.min(radius, 50_000) },
    maxResultCount: 20,
    language: "es",
    region: "ve",
  });
  return places
    .filter((p) => p.location)
    .map((p) => ({
      id: `google:${p.id}`,
      name: p.displayName ?? "Sin nombre",
      address: p.formattedAddress ?? "",
      category: p.primaryTypeDisplayName ?? nicheFor(query),
      phone: p.internationalPhoneNumber ?? p.nationalPhoneNumber ?? "",
      website: p.websiteURI ?? "",
      rating: p.rating ?? null,
      ratings: p.userRatingCount ?? 0,
      mapsUrl: p.googleMapsURI ?? "",
      lat: p.location!.lat(),
      lng: p.location!.lng(),
      source: "google" as const,
    }))
    .sort((a, b) => meters(center, a as LatLng) - meters(center, b as LatLng));
}

export async function geocode(text: string, near: LatLng): Promise<LatLng | null> {
  if (!text.trim() || !googleEnabled() || typeof google === "undefined") return null;
  const { Geocoder } = (await google.maps.importLibrary("geocoding")) as google.maps.GeocodingLibrary;
  const { results } = await new Geocoder().geocode({
    address: text,
    bounds: { north: near.lat + 0.3, south: near.lat - 0.3, east: near.lng + 0.3, west: near.lng - 0.3 },
    region: "ve",
  });
  const loc = results[0]?.geometry.location;
  return loc ? { lat: loc.lat(), lng: loc.lng() } : null;
}

/** Línea de la ruta para el mapa interactivo (OSRM, solo dibuja; la navegación es de Google). */
export async function routeThrough(points: LatLng[], mode: TravelMode): Promise<RouteResult | null> {
  if (points.length < 2) return null;
  const base = mode === "pie" ? "https://routing.openstreetmap.de/routed-foot" : "https://routing.openstreetmap.de/routed-car";
  const res = await fetch(`${base}/route/v1/driving/${points.map((p) => `${p.lng},${p.lat}`).join(";")}?overview=full&geometries=geojson`);
  if (!res.ok) return null;
  const json = (await res.json()) as { routes?: { geometry: { coordinates: [number, number][] }; distance: number; duration: number }[] };
  const r = json.routes?.[0];
  return r ? { path: r.geometry.coordinates.map(([lng, lat]) => [lat, lng]), meters: r.distance, seconds: r.duration } : null;
}

/* Traer un negocio con el enlace de Google Maps --------------------- */

export async function placeFromGoogleLink(text: string): Promise<Place> {
  const res = await fetch("/api/gmaps", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
  });
  const json = (await res.json()) as {
    place?: { name: string; address: string; lat: number | null; lng: number | null; url: string };
    message?: string;
  };
  if (!res.ok || !json.place) throw new Error(json.message ?? "No pude leer ese enlace.");
  const p = json.place;
  return {
    id: `gmaps:${p.lat !== null && p.lng !== null ? `${p.lat.toFixed(5)},${p.lng.toFixed(5)}` : norm(`${p.name}|${p.address}`)}`,
    name: p.name,
    address: p.address,
    category: "",
    phone: "",
    website: "",
    rating: null,
    ratings: 0,
    mapsUrl: p.url,
    ...(p.lat !== null && p.lng !== null ? { lat: p.lat, lng: p.lng } : {}),
    source: "google",
  };
}
