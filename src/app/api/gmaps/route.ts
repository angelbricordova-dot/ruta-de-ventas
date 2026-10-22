import { NextResponse, type NextRequest } from "next/server";
import { allowedHost, findMapsUrl, parseMapsHtml, parseMapsUrl, type ParsedPlace } from "@/lib/gmaps-link";

/**
 * Convierte un enlace compartido de Google Maps en un negocio (nombre, coordenadas, dirección).
 * Solo sigue redirecciones dentro de dominios de Google.
 *
 * Los enlaces que comparte el iPhone suelen llevar nombre y dirección pero no coordenadas
 * (maps.google.com/maps?q=Nombre,+Dirección&ftid=…). Por eso, si la URL no trae la ubicación,
 * se lee la página del lugar; y si tampoco, se ubica la dirección (queda marcada como aproximada).
 */

export const dynamic = "force-dynamic";

const DESKTOP_UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36";

type Found = ParsedPlace & { precise: boolean };

export async function POST(req: NextRequest) {
  let text = "";
  try {
    text = String(((await req.json()) as { text?: string }).text ?? "").slice(0, 2000);
  } catch {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }
  const start = findMapsUrl(text);
  if (!start) return NextResponse.json({ error: "no_link", message: "No encontré un enlace de Google Maps." }, { status: 400 });

  let url = start.replace(/^http:/, "https:");
  const found: Found = { name: "", address: "", lat: null, lng: null, precise: true };
  // Solo completa lo que falta: lo que ya se encontró (más exacto) no se pisa.
  const fill = (p: Partial<ParsedPlace> & { precise?: boolean }) => {
    if (!found.name && p.name) found.name = p.name;
    if (!found.address && p.address) found.address = p.address;
    if (found.lat === null && typeof p.lat === "number" && typeof p.lng === "number") {
      found.lat = p.lat;
      found.lng = p.lng;
      found.precise = p.precise ?? true;
    }
  };

  try {
    for (let hop = 0; hop < 8; hop++) {
      if (!allowedHost(url)) return NextResponse.json({ error: "bad_host" }, { status: 400 });
      const host = new URL(url).hostname;
      const isShort = /goo\.gl$/.test(host);
      if (!isShort) {
        fill(parseMapsUrl(url));
        if (found.name && found.lat !== null && found.address) break;
      }
      let res: Response;
      try {
        res = await fetch(url, {
          redirect: "manual",
          headers: { "User-Agent": DESKTOP_UA, "Accept-Language": "es-419,es;q=0.9", Cookie: "CONSENT=YES+" },
          cache: "no-store",
        });
      } catch (e) {
        if (found.lat !== null) break;
        throw e;
      }
      const next = res.headers.get("location");
      if (res.status >= 300 && res.status < 400 && next) {
        url = new URL(next, url).toString();
        const u = new URL(url);
        const cont = u.searchParams.get("continue");
        if (/consent\.google\./.test(u.hostname) && cont) url = cont;
        continue;
      }
      if (res.ok && !isShort) fill(parseMapsHtml(await res.text()));
      break;
    }
  } catch {
    return NextResponse.json({ error: "network", message: "No pude leer el enlace. Intenta de nuevo." }, { status: 502 });
  }

  // El nombre puede venir en la primera línea del texto pegado (como al compartir por WhatsApp).
  const firstLine = text.split("\n")[0].trim();
  if (!found.name && firstLine && !/^https?:/i.test(firstLine)) found.name = firstLine.slice(0, 80);

  // Último recurso: ubicar la dirección.
  if (found.lat === null && (found.address || found.name)) {
    const pos = await geocode([found.name, found.address].filter(Boolean).join(", "), found.address);
    if (pos) {
      found.lat = pos.lat;
      found.lng = pos.lng;
      found.precise = false;
    }
  }

  if (found.lat === null || found.lng === null) {
    return NextResponse.json(
      {
        error: "no_coords",
        message: "No pude sacar la ubicación de ese enlace. Puedes agregarlo igual a mano y marcarlo con “Estoy aquí”.",
        detail: shortUrl(url),
      },
      { status: 422 },
    );
  }
  return NextResponse.json({
    place: { name: found.name || "Negocio de Google Maps", address: found.address, lat: found.lat, lng: found.lng, approximate: !found.precise, url },
  });
}

function shortUrl(u: string) {
  try {
    const x = new URL(u);
    return `${x.hostname}${x.pathname}`.slice(0, 120);
  } catch {
    return "";
  }
}

/** Ubica una dirección en Venezuela: TomTom si hay clave, si no Nominatim (OpenStreetMap). */
async function geocode(full: string, address: string): Promise<{ lat: number; lng: number } | null> {
  const tries = [full, address].filter((t, i, a) => t && a.indexOf(t) === i);
  const key = process.env.TOMTOM_API_KEY;
  for (const q of tries) {
    try {
      if (key) {
        const r = await fetch(
          `https://api.tomtom.com/search/2/geocode/${encodeURIComponent(q)}.json?key=${key}&countrySet=VE&limit=1&language=es-419`,
          { cache: "no-store" },
        );
        if (r.ok) {
          const j = (await r.json()) as { results?: { position: { lat: number; lon: number } }[] };
          const p = j.results?.[0]?.position;
          if (p) return { lat: p.lat, lng: p.lon };
        }
      }
      const r = await fetch(
        `https://nominatim.openstreetmap.org/search?${new URLSearchParams({ q, format: "json", limit: "1", countrycodes: "ve" })}`,
        { headers: { "User-Agent": "ruta-de-ventas/1.0 (app de ventas personal)", "Accept-Language": "es" }, cache: "no-store" },
      );
      if (r.ok) {
        const j = (await r.json()) as { lat: string; lon: string }[];
        if (j[0]) return { lat: Number(j[0].lat), lng: Number(j[0].lon) };
      }
    } catch {
      /* se prueba la siguiente forma */
    }
  }
  return null;
}
