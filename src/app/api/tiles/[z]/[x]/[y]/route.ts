import { NextResponse, type NextRequest } from "next/server";

/**
 * Imágenes del mapa (teselas de 256 px) desde TomTom, con la clave guardada en el servidor.
 * Vercel las guarda en su CDN, así que cada tesela se pide a TomTom muy pocas veces
 * (el plan gratis da 50.000 por día). Sin clave, redirige a OpenStreetMap.
 */

const CACHE = "public, max-age=604800, s-maxage=2592000, stale-while-revalidate=86400";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ z: string; x: string; y: string }> }) {
  const { z, x, y } = await params;
  const [zi, xi, yi] = [z, x, y.replace(/\.png$/, "")].map((v) => Number.parseInt(v, 10));
  const max = 2 ** zi;
  if (![zi, xi, yi].every(Number.isInteger) || zi < 0 || zi > 22 || xi < 0 || yi < 0 || xi >= max || yi >= max) {
    return new NextResponse(null, { status: 400 });
  }

  const key = process.env.TOMTOM_API_KEY;
  if (!key) {
    return NextResponse.redirect(`https://tile.openstreetmap.org/${zi}/${xi}/${yi}.png`, { status: 302 });
  }

  const url = `https://api.tomtom.com/map/1/tile/basic/main/${zi}/${xi}/${yi}.png?key=${key}&tileSize=256&view=Unified&language=es-ES`;
  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) {
      // Si TomTom falla (clave mal puesta, cuota), el mapa sigue con OpenStreetMap.
      return NextResponse.redirect(`https://tile.openstreetmap.org/${zi}/${xi}/${yi}.png`, { status: 302 });
    }
    return new NextResponse(res.body, {
      status: 200,
      headers: { "Content-Type": res.headers.get("content-type") ?? "image/png", "Cache-Control": CACHE },
    });
  } catch {
    return NextResponse.redirect(`https://tile.openstreetmap.org/${zi}/${xi}/${yi}.png`, { status: 302 });
  }
}
