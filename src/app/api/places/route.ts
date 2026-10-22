import { NextResponse, type NextRequest } from "next/server";

/**
 * Búsqueda de negocios con TomTom (2.500 búsquedas diarias gratis, sin tarjeta).
 * La clave vive en el servidor (TOMTOM_API_KEY), nunca en el navegador.
 */

export const dynamic = "force-dynamic";

interface TomTomResult {
  id: string;
  dist?: number;
  poi?: {
    name: string;
    phone?: string;
    url?: string;
    categories?: string[];
    classifications?: { names?: { name: string }[] }[];
  };
  address?: { freeformAddress?: string; streetName?: string; streetNumber?: string; municipalitySubdivision?: string };
  position: { lat: number; lon: number };
}

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export async function GET(req: NextRequest) {
  const key = process.env.TOMTOM_API_KEY;
  if (!key) return NextResponse.json({ error: "unconfigured" }, { status: 503 });

  const p = req.nextUrl.searchParams;
  const q = (p.get("q") ?? "").trim().slice(0, 80);
  const lat = Number(p.get("lat"));
  const lng = Number(p.get("lng"));
  const radius = Math.min(Math.max(Number(p.get("radius")) || 3000, 500), 20_000);
  if (!q || !Number.isFinite(lat) || !Number.isFinite(lng)) {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  const params = new URLSearchParams({
    key,
    lat: String(lat),
    lon: String(lng),
    radius: String(radius),
    limit: "50",
    language: "es-419",
    countrySet: "VE",
  });
  try {
    const res = await fetch(`https://api.tomtom.com/search/2/poiSearch/${encodeURIComponent(q)}.json?${params}`, { cache: "no-store" });
    if (res.status === 403 || res.status === 401) return NextResponse.json({ error: "bad_key" }, { status: 502 });
    if (res.status === 429) return NextResponse.json({ error: "quota" }, { status: 429 });
    if (!res.ok) return NextResponse.json({ error: "upstream", status: res.status }, { status: 502 });
    const json = (await res.json()) as { results?: TomTomResult[] };
    const places = (json.results ?? [])
      .filter((r) => r.poi?.name)
      .map((r) => ({
        id: `tomtom:${r.id}`,
        name: r.poi!.name,
        address:
          [r.address?.streetName, r.address?.streetNumber].filter(Boolean).join(" ") ||
          r.address?.municipalitySubdivision ||
          r.address?.freeformAddress ||
          "",
        category: capitalize(r.poi!.classifications?.[0]?.names?.[0]?.name ?? r.poi!.categories?.[0] ?? ""),
        phone: r.poi!.phone ?? "",
        website: r.poi!.url ?? "",
        rating: null,
        ratings: 0,
        mapsUrl: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${r.poi!.name} ${r.position.lat},${r.position.lon}`)}`,
        lat: r.position.lat,
        lng: r.position.lon,
        source: "tomtom",
      }));
    return NextResponse.json({ places });
  } catch {
    return NextResponse.json({ error: "network" }, { status: 502 });
  }
}
