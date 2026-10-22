/**
 * Lee un enlace compartido desde Google Maps ("Compartir → Copiar enlace") y saca
 * el nombre del negocio, sus coordenadas y, si viene, la dirección.
 *
 * Formatos que maneja:
 *   https://maps.app.goo.gl/AbC123            (corto, se resuelve en el servidor)
 *   https://www.google.com/maps/place/Nombre/@10.24,-67.59,17z/data=...!3d10.2478!4d-67.5951...
 *   https://maps.google.com/maps?q=Nombre,+Dirección&ftid=...
 *   https://www.google.com/maps/search/?api=1&query=10.24,-67.59
 */

export interface ParsedPlace {
  name: string;
  address: string;
  lat: number | null;
  lng: number | null;
}

const ALLOWED = [/^(.+\.)?google\.[a-z.]+$/, /^goo\.gl$/, /^maps\.app\.goo\.gl$/];

export function allowedHost(url: string) {
  try {
    const u = new URL(url);
    return u.protocol === "https:" && ALLOWED.some((re) => re.test(u.hostname));
  } catch {
    return false;
  }
}

/** Primer enlace de Google Maps dentro de un texto (WhatsApp manda nombre + dirección + enlace). */
export function findMapsUrl(text: string): string | null {
  const urls = text.match(/https?:\/\/[^\s<>"']+/g) ?? [];
  return urls.find((u) => allowedHost(u.replace(/^http:/, "https:"))) ?? null;
}

const num = (s: string | undefined) => (s === undefined ? null : Number(s));
const clean = (s: string) => decodeURIComponent(s.replace(/\+/g, " ")).replace(/\s+/g, " ").trim();

function coordsFrom(url: string): { lat: number; lng: number } | null {
  // Coordenadas exactas del lugar (no del centro de la vista).
  let m = url.match(/!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/);
  if (m) return { lat: Number(m[1]), lng: Number(m[2]) };
  const u = new URL(url);
  for (const key of ["query", "q", "ll", "center", "destination"]) {
    const v = u.searchParams.get(key);
    m = v?.match(/^\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*$/) ?? null;
    if (m) return { lat: Number(m[1]), lng: Number(m[2]) };
  }
  m = url.match(/@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/);
  if (m) return { lat: Number(m[1]), lng: Number(m[2]) };
  return null;
}

/** Saca lo que se pueda de la URL final de Google Maps. */
export function parseMapsUrl(url: string): ParsedPlace {
  const out: ParsedPlace = { name: "", address: "", lat: null, lng: null };
  const u = new URL(url);
  const place = u.pathname.match(/\/maps\/place\/([^/]+)/);
  if (place) {
    const parts = clean(place[1]).split(",");
    out.name = parts[0].trim();
    out.address = parts.slice(1).join(",").trim();
  } else {
    const q = u.searchParams.get("q") ?? u.searchParams.get("query") ?? "";
    if (q && !/^\s*-?\d+(\.\d+)?\s*,\s*-?\d+(\.\d+)?\s*$/.test(q)) {
      const parts = clean(q).split(",");
      out.name = parts[0].trim();
      out.address = parts.slice(1).join(",").trim();
    }
  }
  const c = coordsFrom(url);
  if (c) {
    out.lat = c.lat;
    out.lng = c.lng;
  }
  return out;
}

/** Coordenadas razonables (descarta ceros y valores fuera de rango). */
const valid = (lat: number, lng: number) => Math.abs(lat) <= 90 && Math.abs(lng) <= 180 && !(lat === 0 && lng === 0);

/**
 * Datos que vienen en el HTML de la página del lugar. Google los pone en varios sitios;
 * se prueban del más exacto al menos exacto.
 */
export function parseMapsHtml(html: string): Partial<ParsedPlace> & { precise?: boolean } {
  const out: Partial<ParsedPlace> & { precise?: boolean } = {};
  const meta = (prop: string) =>
    html.match(new RegExp(`<meta[^>]+(?:property|itemprop|name)="${prop}"[^>]+content="([^"]*)"`, "i"))?.[1] ??
    html.match(new RegExp(`<meta[^>]+content="([^"]*)"[^>]+(?:property|itemprop|name)="${prop}"`, "i"))?.[1];
  const decode = (s: string) => s.replace(/&amp;/g, "&").replace(/&#39;/g, "'").replace(/&quot;/g, '"');

  const title = meta("og:title") ?? html.match(/<title>([^<]*)<\/title>/i)?.[1];
  if (title) {
    const [name, ...rest] = decode(title).replace(/\s*-\s*Google Maps\s*$/i, "").split(" · ");
    if (name && !/^Google Maps$/i.test(name.trim())) out.name = name.trim();
    if (rest.length) out.address = rest.join(" · ").trim();
  }

  const set = (lat: number, lng: number, precise: boolean) => {
    if (out.lat === undefined && valid(lat, lng)) {
      out.lat = lat;
      out.lng = lng;
      out.precise = precise;
    }
  };

  // 1. Marcador exacto dentro de los datos del lugar: !3d<lat>!4d<lng>
  const d34 = html.match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/);
  if (d34) set(Number(d34[1]), Number(d34[2]), true);

  // 2. Mapa de vista previa: staticmap?center=lat,lng
  const image = meta("og:image");
  const c = image && decode(image).match(/center=(-?\d+(?:\.\d+)?)(?:%2C|,)(-?\d+(?:\.\d+)?)/);
  if (c) set(Number(c[1]), Number(c[2]), true);

  // 3. Datos precargados del lugar: [null,null,lat,lng]
  const nn = html.match(/\[null,null,(-?\d{1,2}\.\d{4,}),(-?\d{1,3}\.\d{4,})\]/);
  if (nn) set(Number(nn[1]), Number(nn[2]), true);

  // 4. Centro de la vista con la que abre la página: APP_INITIALIZATION_STATE=[[[escala,lng,lat]
  const app = html.match(/APP_INITIALIZATION_STATE=\[\[\[(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)\]/);
  if (app) set(Number(app[3]), Number(app[2]), false);

  return out;
}
