import type { LatLng } from "@/lib/geo";

export interface MapMarker extends LatLng {
  id: string;
  kind: "stop" | "lead" | "result";
  title: string;
  /** Número de la parada. */
  label?: string;
  /** Color del proyecto. */
  color?: string;
  selected?: boolean;
}

export interface MapViewProps {
  markers: MapMarker[];
  me: (LatLng & { accuracy: number }) | null;
  path: [number, number][] | null;
  onSelect: (id: string) => void;
  onMove?: (center: LatLng) => void;
  /** Encuadra estos puntos cada vez que cambia `key`. */
  fit: { key: string; points: LatLng[] } | null;
  /** Centra en un punto cada vez que cambia `key`. */
  focus: { key: string; point: LatLng; zoom?: number } | null;
  initialCenter: LatLng;
}

/** HTML del marcador: el mismo dibujo en Leaflet y en Google. */
export function markerHtml(m: MapMarker) {
  const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
  if (m.kind === "stop") {
    return `<div class="pin pin-stop${m.selected ? " is-selected" : ""}" style="--pin:${m.color ?? "#1f201d"}" title="${esc(m.title)}">${esc(m.label ?? "")}</div>`;
  }
  if (m.kind === "lead") {
    return `<div class="pin pin-lead${m.selected ? " is-selected" : ""}" style="--pin:${m.color ?? "#46525e"}" title="${esc(m.title)}"></div>`;
  }
  return `<div class="pin pin-result${m.selected ? " is-selected" : ""}" title="${esc(m.title)}"><span></span></div>`;
}

export const ME_HTML = `<div class="pin-me"><span class="pin-me-halo"></span><span class="pin-me-dot"></span></div>`;

export const MARKER_SIZE: Record<MapMarker["kind"], number> = { stop: 30, lead: 16, result: 28 };
