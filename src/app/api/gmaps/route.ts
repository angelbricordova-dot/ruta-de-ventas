import { NextResponse, type NextRequest } from "next/server";
import { allowedHost, findMapsUrl, parseMapsHtml, parseMapsUrl, plausible, type ParsedPlace } from "@/lib/gmaps-link";

/**
 * Convierte un enlace compartido de Google Maps en un negocio: nombre, dirección y, si el enlace
 * las trae, coordenadas. Solo sigue redirecciones dentro de dominios de Google.
 *
 * Los enlaces del iPhone suelen traer solo "Nombre, Dirección" (maps?q=…&ftid=…). Eso basta:
 * la app guarda ese texto y Google ubica el lugar al trazar la ruta o navegar.
 */

export const dynamic = "force-dynamic";

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36";

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
  const found: ParsedPlace = { name: "", address: "", lat: null, lng: null };
  const fill = (p: Partial<ParsedPlace>) => {
    if (!found.name && p.name) found.name = p.name;
    if (!found.address && p.address) found.address = p.address;
    if (found.lat === null && plausible(p.lat ?? null, p.lng ?? null)) {
      found.lat = p.lat!;
      found.lng = p.lng!;
    }
  };

  try {
    for (let hop = 0; hop < 8; hop++) {
      if (!allowedHost(url)) return NextResponse.json({ error: "bad_host" }, { status: 400 });
      const isShort = /goo\.gl$/.test(new URL(url).hostname);
      if (!isShort) {
        fill(parseMapsUrl(url));
        if (found.name && found.address) break;
      }
      let res: Response;
      try {
        res = await fetch(url, { redirect: "manual", headers: { "User-Agent": UA, "Accept-Language": "es-419,es;q=0.9" }, cache: "no-store" });
      } catch (e) {
        if (found.name) break;
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

  const firstLine = text.split("\n")[0].trim();
  if (!found.name && firstLine && !/^https?:/i.test(firstLine)) found.name = firstLine.slice(0, 80);

  if (!found.name && !found.address && found.lat === null) {
    return NextResponse.json({ error: "empty", message: "Ese enlace no trae datos del negocio. Cópialo desde la ficha del negocio en Google Maps." }, { status: 422 });
  }
  return NextResponse.json({ place: { ...found, name: found.name || "Negocio de Google Maps", url } });
}
