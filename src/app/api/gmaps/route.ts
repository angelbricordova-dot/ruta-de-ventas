import { NextResponse, type NextRequest } from "next/server";
import { allowedHost, findMapsUrl, parseMapsHtml, parseMapsUrl, type ParsedPlace } from "@/lib/gmaps-link";

/**
 * Convierte un enlace compartido de Google Maps en un negocio (nombre, coordenadas, dirección).
 * Solo sigue redirecciones dentro de dominios de Google.
 */

export const dynamic = "force-dynamic";

const UA = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1";

export async function POST(req: NextRequest) {
  let text = "";
  try {
    text = String(((await req.json()) as { text?: string }).text ?? "").slice(0, 2000);
  } catch {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }
  const start = findMapsUrl(text);
  if (!start) return NextResponse.json({ error: "no_link", message: "No encontré un enlace de Google Maps." }, { status: 400 });

  // Sigue las redirecciones (enlaces cortos) sin salir de Google.
  let url = start.replace(/^http:/, "https:");
  let result: ParsedPlace = { name: "", address: "", lat: null, lng: null };
  try {
    for (let hop = 0; hop < 6; hop++) {
      if (!allowedHost(url)) return NextResponse.json({ error: "bad_host" }, { status: 400 });
      const host = new URL(url).hostname;
      const isShort = /goo\.gl$/.test(host);
      if (!isShort) {
        result = { ...result, ...stripEmpty(parseMapsUrl(url)) };
        if (result.name && result.lat !== null && result.address) break;
      }
      let res: Response;
      try {
        res = await fetch(url, { redirect: "manual", headers: { "User-Agent": UA, "Accept-Language": "es-419,es;q=0.9" }, cache: "no-store" });
      } catch (e) {
        // Si ya tenemos nombre y ubicación, la dirección es opcional.
        if (result.lat !== null) break;
        throw e;
      }
      const next = res.headers.get("location");
      if (res.status >= 300 && res.status < 400 && next) {
        url = new URL(next, url).toString();
        // La página de consentimiento lleva el destino real en "continue".
        const cont = new URL(url).searchParams.get("continue");
        if (/consent\.google\./.test(new URL(url).hostname) && cont) url = cont;
        continue;
      }
      if (res.ok && !isShort) {
        const html = await res.text();
        result = { ...result, ...stripEmpty(parseMapsHtml(html)) };
      }
      break;
    }
  } catch {
    return NextResponse.json({ error: "network", message: "No pude leer el enlace. Intenta de nuevo." }, { status: 502 });
  }

  // Si el texto pegado traía el nombre en la primera línea (como al compartir por WhatsApp), úsalo.
  const firstLine = text.split("\n")[0].trim();
  if (!result.name && firstLine && !/^https?:/i.test(firstLine)) result.name = firstLine.slice(0, 80);

  if (result.lat === null || result.lng === null) {
    return NextResponse.json({ error: "no_coords", message: "El enlace no trae la ubicación. Copia el enlace desde la ficha del negocio." }, { status: 422 });
  }
  return NextResponse.json({ place: { ...result, name: result.name || "Negocio de Google Maps", url } });
}

function stripEmpty(p: Partial<ParsedPlace>): Partial<ParsedPlace> {
  return Object.fromEntries(Object.entries(p).filter(([, v]) => v !== "" && v !== null && v !== undefined)) as Partial<ParsedPlace>;
}
