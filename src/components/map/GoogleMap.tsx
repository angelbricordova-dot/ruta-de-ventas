"use client";

import { AdvancedMarker, Map, useMap } from "@vis.gl/react-google-maps";
import { useEffect, useRef } from "react";
import { GOOGLE_MAP_ID } from "@/lib/geo";
import { ME_HTML, markerHtml, type MapViewProps } from "./types";

/** Mapa de Google. Necesita estar dentro de <APIProvider> (lo pone la página). */
export default function GoogleMapView({ markers, me, path, onSelect, onMove, fit, focus, initialCenter }: MapViewProps) {
  return (
    <Map
      mapId={GOOGLE_MAP_ID}
      defaultCenter={initialCenter}
      defaultZoom={14}
      gestureHandling="greedy"
      disableDefaultUI
      clickableIcons={false}
      className="h-full w-full"
      onIdle={(e) => {
        const c = e.map.getCenter();
        if (c) onMove?.({ lat: c.lat(), lng: c.lng() });
      }}
    >
      {markers.map((m) => (
        <AdvancedMarker
          key={m.id}
          position={m}
          onClick={() => onSelect(m.id)}
          zIndex={m.selected ? 900 : m.kind === "stop" ? 500 : 1}
          title={m.title}
        >
          <div dangerouslySetInnerHTML={{ __html: markerHtml(m) }} style={{ transform: "translateY(50%)" }} />
        </AdvancedMarker>
      ))}
      {me && (
        <AdvancedMarker position={me} zIndex={1000}>
          <div dangerouslySetInnerHTML={{ __html: ME_HTML }} style={{ transform: "translateY(50%)" }} />
        </AdvancedMarker>
      )}
      <RouteLine path={path} />
      <Controller fit={fit} focus={focus} />
    </Map>
  );
}

function RouteLine({ path }: { path: [number, number][] | null }) {
  const map = useMap();
  const lines = useRef<google.maps.Polyline[]>([]);
  useEffect(() => {
    if (!map) return;
    lines.current.forEach((l) => l.setMap(null));
    lines.current = [];
    if (!path || path.length < 2) return;
    const pts = path.map(([lat, lng]) => ({ lat, lng }));
    lines.current = [
      new google.maps.Polyline({ map, path: pts, strokeColor: "#ffffff", strokeWeight: 9, strokeOpacity: 0.9 }),
      new google.maps.Polyline({ map, path: pts, strokeColor: "#2257a8", strokeWeight: 5, strokeOpacity: 0.95 }),
    ];
    return () => lines.current.forEach((l) => l.setMap(null));
  }, [map, path]);
  return null;
}

function Controller({ fit, focus }: Pick<MapViewProps, "fit" | "focus">) {
  const map = useMap();
  useEffect(() => {
    if (!map || !fit || fit.points.length === 0) return;
    if (fit.points.length === 1) {
      map.panTo(fit.points[0]);
      map.setZoom(Math.max(map.getZoom() ?? 14, 15));
      return;
    }
    const b = new google.maps.LatLngBounds();
    fit.points.forEach((p) => b.extend(p));
    map.fitBounds(b, { top: 84, bottom: 72, left: 40, right: 40 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, fit?.key]);
  useEffect(() => {
    if (!map || !focus) return;
    map.panTo(focus.point);
    map.setZoom(focus.zoom ?? Math.max(map.getZoom() ?? 14, 16));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, focus?.key]);
  return null;
}
