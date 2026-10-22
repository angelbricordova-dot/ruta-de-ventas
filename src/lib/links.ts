import type { Lead } from "./types";

const digits = (phone: string) => phone.replace(/[^\d+]/g, "");

export function telLink(phone: string): string | null {
  const d = digits(phone);
  return d.length >= 6 ? `tel:${d}` : null;
}

export function whatsappLink(phone: string, text = ""): string | null {
  const d = digits(phone).replace(/^\+/, "");
  if (d.length < 6) return null;
  return `https://wa.me/${d}${text ? `?text=${encodeURIComponent(text)}` : ""}`;
}

export function instagramLink(handle: string): string | null {
  const h = handle.trim().replace(/^@/, "").replace(/^https?:\/\/(www\.)?instagram\.com\//, "").replace(/\/$/, "");
  return h ? `https://instagram.com/${h}` : null;
}

export function mailLink(email: string, subject = "", body = ""): string | null {
  if (!email.includes("@")) return null;
  const q = new URLSearchParams();
  if (subject) q.set("subject", subject);
  if (body) q.set("body", body);
  const qs = q.toString().replace(/\+/g, "%20");
  return `mailto:${email}${qs ? `?${qs}` : ""}`;
}

type Where = Pick<Lead, "address" | "business" | "zone" | "lat" | "lng" | "gquery">;

/** Coordenadas exactas si se conocen; si no, el texto de Google o la dirección escrita. */
function place(lead: Where, city: string): string {
  if (typeof lead.lat === "number" && typeof lead.lng === "number") return `${lead.lat.toFixed(6)},${lead.lng.toFixed(6)}`;
  if (lead.gquery) return lead.gquery;
  const where = lead.address ? `${lead.business}, ${lead.address}` : `${lead.business} ${lead.zone}`;
  return [where, city].filter(Boolean).join(", ");
}

export function mapLink(lead: Where, city: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(place(lead, city))}`;
}

/**
 * Ruta a pie con varias paradas en Google Maps. Sin origen: Maps parte desde
 * la ubicación actual del teléfono. Google acepta hasta 9 paradas intermedias.
 */
export function walkingRoute(leads: Where[], city: string): string | null {
  const stops = leads.map((l) => place(l, city)).slice(0, 10);
  if (stops.length === 0) return null;
  const destination = stops[stops.length - 1];
  const waypoints = stops.slice(0, -1);
  const q = new URLSearchParams({ api: "1", destination, travelmode: "walking" });
  if (waypoints.length) q.set("waypoints", waypoints.join("|"));
  return `https://www.google.com/maps/dir/?${q.toString()}`;
}

/** Rellena {negocio}, {contacto}, {rubro}, {vendedor} y {zona} en un guion. */
export function fillScript(body: string, lead: Lead | null, sellerName: string): string {
  const first = sellerName.split(" ")[0] ?? sellerName;
  return body
    .replaceAll("{negocio}", lead?.business || "su negocio")
    .replaceAll("{contacto}", lead?.contactName.split(" ")[0] || "")
    .replaceAll("{rubro}", lead?.niche.toLowerCase() || "negocio")
    .replaceAll("{zona}", lead?.zone || "la zona")
    .replaceAll("{vendedor}", first)
    .replace(/ ,/g, ",")
    .replace(/Hola ,/g, "Hola,")
    .replace(/  +/g, " ");
}
