"use client";

/**
 * Mapas: búsqueda de negocios, rutas y direcciones.
 *
 * Con NEXT_PUBLIC_GOOGLE_MAPS_API_KEY se usa Google (mapa, Places y geocodificación).
 * Sin clave, todo funciona con servicios libres: OpenStreetMap (Overpass para buscar,
 * Nominatim para direcciones) y OSRM para trazar rutas. Las rutas usan OSRM en ambos casos.
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

export interface Place extends LatLng {
  id: string;
  name: string;
  address: string;
  category: string;
  phone: string;
  website: string;
  rating: number | null;
  ratings: number;
  mapsUrl: string;
  source: "google" | "tomtom" | "osm";
}

export interface RouteResult {
  path: [number, number][];
  meters: number;
  seconds: number;
  /** Orden sugerido (índices de las paradas de entrada) cuando se optimiza. */
  order?: number[];
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

/* Rubros → etiquetas de OpenStreetMap ------------------------------ */

type Tag = [string, string];

const OSM_TAGS: { match: RegExp; label: string; tags: Tag[] }[] = [
  { match: /gimnas|gym|crossfit|fitness/, label: "Gimnasio", tags: [["leisure", "fitness_centre"], ["leisure", "sports_centre"]] },
  { match: /taller|mec[aá]nic|auto|carro|moto/, label: "Taller mecánico", tags: [["shop", "car_repair"], ["craft", "car_repair"], ["shop", "motorcycle_repair"]] },
  { match: /odont|dentist|dental/, label: "Odontólogo", tags: [["amenity", "dentist"], ["healthcare", "dentist"]] },
  { match: /veterin|mascota|pet/, label: "Veterinaria", tags: [["amenity", "veterinary"], ["shop", "pet"]] },
  { match: /barber|peluquer|sal[oó]n/, label: "Barbería", tags: [["shop", "hairdresser"]] },
  { match: /spa|est[eé]tica|belleza|u[ñn]as/, label: "Spa y estética", tags: [["shop", "beauty"], ["leisure", "spa"]] },
  { match: /restaur|comida|pizz|arepa/, label: "Restaurante", tags: [["amenity", "restaurant"], ["amenity", "fast_food"]] },
  { match: /caf[eé]/, label: "Cafetería", tags: [["amenity", "cafe"]] },
  { match: /panader|pasteler/, label: "Panadería", tags: [["shop", "bakery"], ["shop", "pastry"]] },
  { match: /farmac/, label: "Farmacia", tags: [["amenity", "pharmacy"]] },
  { match: /cl[ií]nica|m[eé]dic|consultorio/, label: "Clínica", tags: [["amenity", "clinic"], ["amenity", "doctors"]] },
  { match: /abogad/, label: "Abogado", tags: [["office", "lawyer"]] },
  { match: /contad/, label: "Contador", tags: [["office", "accountant"]] },
  { match: /inmobil/, label: "Inmobiliaria", tags: [["office", "estate_agent"]] },
  { match: /ferret/, label: "Ferretería", tags: [["shop", "hardware"], ["shop", "doityourself"]] },
  { match: /ropa|boutique|zapat/, label: "Tienda de ropa", tags: [["shop", "clothes"], ["shop", "shoes"]] },
  { match: /academ|escuela|colegio|idioma/, label: "Academia", tags: [["amenity", "school"], ["amenity", "language_school"], ["amenity", "college"]] },
  { match: /hotel|posada/, label: "Hotel", tags: [["tourism", "hotel"], ["tourism", "guest_house"]] },
  { match: /mercad|abasto|bodeg|minimarket|super/, label: "Minimarket", tags: [["shop", "convenience"], ["shop", "supermarket"]] },
  { match: /naturist|herbol|org[aá]nic/, label: "Tienda naturista", tags: [["shop", "health_food"], ["shop", "herbalist"]] },
  { match: /regalo|detalle/, label: "Tienda de regalos", tags: [["shop", "gift"]] },
];

const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

/** Rubro para un texto de búsqueda ("gimnasios" → "Gimnasio"). */
export function nicheFor(query: string): string {
  const q = norm(query);
  return OSM_TAGS.find((t) => t.match.test(q))?.label ?? query.trim().replace(/^\w/, (c) => c.toUpperCase());
}

/* Búsqueda: OpenStreetMap ------------------------------------------ */

async function searchOsm(query: string, center: LatLng, radius: number): Promise<Place[]> {
  const q = norm(query);
  const known = OSM_TAGS.find((t) => t.match.test(q));
  const around = `(around:${radius},${center.lat},${center.lng})`;
  const safe = query.replace(/["\\]/g, "").trim();
  const filters = known
    ? known.tags.map(([k, v]) => `nwr["${k}"="${v}"]${around};`).join("")
    : `nwr["name"~"${safe}",i]${around};`;
  const body = `[out:json][timeout:20];(${filters});out center tags 60;`;
  const res = await fetch("https://overpass-api.de/api/interpreter", {
    method: "POST",
    body: new URLSearchParams({ data: body }),
  });
  if (!res.ok) throw new Error(`Overpass ${res.status}`);
  const json = (await res.json()) as {
    elements: { type: string; id: number; lat?: number; lon?: number; center?: { lat: number; lon: number }; tags?: Record<string, string> }[];
  };
  return json.elements
    .filter((e) => e.tags?.name)
    .map((e) => {
      const t = e.tags!;
      const lat = e.lat ?? e.center!.lat;
      const lng = e.lon ?? e.center!.lon;
      const address = [t["addr:street"], t["addr:housenumber"]].filter(Boolean).join(" ") || t["addr:full"] || t["addr:suburb"] || "";
      return {
        id: `osm:${e.type}/${e.id}`,
        name: t.name,
        address,
        category: known?.label ?? nicheFor(query),
        phone: t.phone || t["contact:phone"] || t["contact:whatsapp"] || "",
        website: t.website || t["contact:website"] || t["contact:instagram"] || "",
        rating: null,
        ratings: 0,
        mapsUrl: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${t.name} ${lat},${lng}`)}`,
        lat,
        lng,
        source: "osm" as const,
      };
    })
    .sort((a, b) => meters(center, a) - meters(center, b))
    .slice(0, 40);
}

/* Búsqueda: Google Places ------------------------------------------ */

async function searchGoogle(query: string, center: LatLng, radius: number): Promise<Place[]> {
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
    .sort((a, b) => meters(center, a) - meters(center, b));
}

/* Búsqueda: TomTom (por nuestro servidor, que guarda la clave) ---- */

/** null = TomTom no está configurado en el servidor. */
async function searchTomTom(query: string, center: LatLng, radius: number): Promise<Place[] | null> {
  const q = new URLSearchParams({ q: query, lat: String(center.lat), lng: String(center.lng), radius: String(radius) });
  const res = await fetch(`/api/places?${q}`, { cache: "no-store" });
  if (res.status === 503) return null;
  if (!res.ok) throw new Error(`TomTom ${res.status}`);
  return ((await res.json()) as { places: Place[] }).places;
}

const sameName = (a: string, b: string) => {
  const x = norm(a).replace(/[^a-z0-9]/g, "");
  const y = norm(b).replace(/[^a-z0-9]/g, "");
  return x === y || (x.length > 5 && (x.includes(y) || y.includes(x)));
};

/** Une dos listas sin repetir el mismo negocio (mismo nombre a menos de 120 m). */
function mergePlaces(primary: Place[], extra: Place[]): Place[] {
  const out = [...primary];
  for (const p of extra) {
    if (!out.some((o) => meters(o, p) < 120 && sameName(o.name, p.name))) out.push(p);
  }
  return out;
}

/**
 * Busca negocios cerca. Con Google, usa Google. Si no, junta TomTom (si está configurado)
 * y OpenStreetMap, para tener la mayor cantidad de negocios posible.
 */
export async function searchPlaces(query: string, center: LatLng, radius = 3000): Promise<Place[]> {
  if (googleEnabled() && typeof google !== "undefined") return searchGoogle(query, center, radius);
  const [tomtom, osm] = await Promise.allSettled([searchTomTom(query, center, radius), searchOsm(query, center, radius)]);
  const a = tomtom.status === "fulfilled" && tomtom.value ? tomtom.value : [];
  const b = osm.status === "fulfilled" ? osm.value : [];
  if (tomtom.status === "rejected" && osm.status === "rejected") throw new Error("Sin búsqueda");
  return mergePlaces(a, b).sort((x, y) => meters(center, x) - meters(center, y));
}

/* Direcciones → coordenadas ---------------------------------------- */

export async function geocode(text: string, near: LatLng): Promise<LatLng | null> {
  if (!text.trim()) return null;
  if (googleEnabled() && typeof google !== "undefined") {
    const { Geocoder } = (await google.maps.importLibrary("geocoding")) as google.maps.GeocodingLibrary;
    const { results } = await new Geocoder().geocode({
      address: text,
      bounds: { north: near.lat + 0.3, south: near.lat - 0.3, east: near.lng + 0.3, west: near.lng - 0.3 },
      region: "ve",
    });
    const loc = results[0]?.geometry.location;
    return loc ? { lat: loc.lat(), lng: loc.lng() } : null;
  }
  const q = new URLSearchParams({
    q: text,
    format: "json",
    limit: "1",
    countrycodes: "ve",
    viewbox: `${near.lng - 0.3},${near.lat + 0.3},${near.lng + 0.3},${near.lat - 0.3}`,
  });
  const res = await fetch(`https://nominatim.openstreetmap.org/search?${q}`, { headers: { "Accept-Language": "es" } });
  if (!res.ok) return null;
  const json = (await res.json()) as { lat: string; lon: string }[];
  return json[0] ? { lat: Number(json[0].lat), lng: Number(json[0].lon) } : null;
}

/* Rutas (OSRM) ----------------------------------------------------- */

const OSRM: Record<TravelMode, string> = {
  pie: "https://routing.openstreetmap.de/routed-foot",
  carro: "https://routing.openstreetmap.de/routed-car",
};

const coordList = (pts: LatLng[]) => pts.map((p) => `${p.lng.toFixed(6)},${p.lat.toFixed(6)}`).join(";");

/** Ruta que pasa por los puntos en ese orden. */
export async function routeThrough(points: LatLng[], mode: TravelMode): Promise<RouteResult | null> {
  if (points.length < 2) return null;
  const url = `${OSRM[mode]}/route/v1/driving/${coordList(points)}?overview=full&geometries=geojson&steps=false`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`OSRM ${res.status}`);
  const json = (await res.json()) as { routes?: { geometry: { coordinates: [number, number][] }; distance: number; duration: number }[] };
  const r = json.routes?.[0];
  if (!r) return null;
  return { path: r.geometry.coordinates.map(([lng, lat]) => [lat, lng]), meters: r.distance, seconds: r.duration };
}

/**
 * Orden más corto para visitar las paradas empezando por el primer punto
 * (tu ubicación o la primera parada). Devuelve el orden de las paradas restantes.
 */
export async function optimizeOrder(start: LatLng, stops: LatLng[], mode: TravelMode): Promise<number[] | null> {
  if (stops.length < 2) return stops.map((_, i) => i);
  const url = `${OSRM[mode]}/trip/v1/driving/${coordList([start, ...stops])}?source=first&roundtrip=false&destination=any&overview=false`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`OSRM ${res.status}`);
  const json = (await res.json()) as { waypoints?: { waypoint_index: number }[] };
  if (!json.waypoints) return null;
  // waypoint_index = posición de cada punto de entrada dentro del viaje.
  return json.waypoints
    .slice(1)
    .map((w, i) => ({ i, pos: w.waypoint_index }))
    .sort((a, b) => a.pos - b.pos)
    .map((x) => x.i);
}

/** Navegación paso a paso en la app de Google Maps. */
export function googleDirections(stops: LatLng[], mode: TravelMode): string | null {
  if (stops.length === 0) return null;
  const fmt = (p: LatLng) => `${p.lat.toFixed(6)},${p.lng.toFixed(6)}`;
  const q = new URLSearchParams({ api: "1", destination: fmt(stops[stops.length - 1]), travelmode: mode === "pie" ? "walking" : "driving" });
  if (stops.length > 1) q.set("waypoints", stops.slice(0, -1).slice(0, 9).map(fmt).join("|"));
  return `https://www.google.com/maps/dir/?${q.toString()}`;
}
