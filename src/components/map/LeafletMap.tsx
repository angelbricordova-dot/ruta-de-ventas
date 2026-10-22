"use client";

import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { useEffect, useMemo } from "react";
import { Circle, MapContainer, Marker, Polyline, TileLayer, useMap, useMapEvents } from "react-leaflet";
import { ME_HTML, MARKER_SIZE, markerHtml, type MapMarker, type MapViewProps } from "./types";

/** Mapa sin Google: teselas de TomTom (por nuestro servidor) u OpenStreetMap si no hay clave. */
export default function LeafletMap({ markers, me, path, onSelect, onMove, fit, focus, initialCenter }: MapViewProps) {
  return (
    <MapContainer
      center={[initialCenter.lat, initialCenter.lng]}
      zoom={14}
      zoomControl={false}
      className="h-full w-full"
      attributionControl
    >
      <TileLayer
        url="/api/tiles/{z}/{x}/{y}"
        attribution='&copy; <a href="https://www.tomtom.com">TomTom</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        maxZoom={20}
        maxNativeZoom={19}
        detectRetina
      />
      {path && path.length > 1 && (
        <>
          <Polyline positions={path} pathOptions={{ color: "#ffffff", weight: 9, opacity: 0.9, lineCap: "round", lineJoin: "round" }} />
          <Polyline positions={path} pathOptions={{ color: "#2257a8", weight: 5, opacity: 0.95, lineCap: "round", lineJoin: "round" }} />
        </>
      )}
      {markers.map((m) => (
        <PinMarker key={m.id} m={m} onSelect={onSelect} />
      ))}
      {me && (
        <>
          {me.accuracy < 200 && (
            <Circle center={[me.lat, me.lng]} radius={me.accuracy} pathOptions={{ color: "#1a73e8", weight: 0, fillOpacity: 0.08 }} />
          )}
          <Marker position={[me.lat, me.lng]} icon={meIcon} interactive={false} zIndexOffset={1000} />
        </>
      )}
      <Controller fit={fit} focus={focus} onMove={onMove} />
    </MapContainer>
  );
}

const meIcon = L.divIcon({ html: ME_HTML, className: "", iconSize: [18, 18], iconAnchor: [9, 9] });

function PinMarker({ m, onSelect }: { m: MapMarker; onSelect: (id: string) => void }) {
  const size = MARKER_SIZE[m.kind];
  const icon = useMemo(
    () => L.divIcon({ html: markerHtml(m), className: "", iconSize: [size, size], iconAnchor: [size / 2, size / 2] }),
    // El ícono solo cambia si cambia su dibujo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [m.kind, m.label, m.color, m.selected, m.title, size],
  );
  return (
    <Marker
      position={[m.lat, m.lng]}
      icon={icon}
      zIndexOffset={m.selected ? 900 : m.kind === "stop" ? 500 : 0}
      eventHandlers={{ click: () => onSelect(m.id) }}
      title={m.title}
    />
  );
}

function Controller({ fit, focus, onMove }: Pick<MapViewProps, "fit" | "focus" | "onMove">) {
  const map = useMap();

  useMapEvents({
    moveend: () => {
      const c = map.getCenter();
      onMove?.({ lat: c.lat, lng: c.lng });
    },
  });

  useEffect(() => {
    if (!fit || fit.points.length === 0) return;
    if (fit.points.length === 1) {
      map.flyTo([fit.points[0].lat, fit.points[0].lng], Math.max(map.getZoom(), 15), { duration: 0.6 });
      return;
    }
    // Arriba deja sitio para el buscador; abajo, para los botones del mapa.
    map.flyToBounds(L.latLngBounds(fit.points.map((p) => [p.lat, p.lng])), {
      paddingTopLeft: [40, 84],
      paddingBottomRight: [40, 72],
      maxZoom: 16,
      duration: 0.6,
    });
    // Solo cuando cambia la clave.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fit?.key]);

  useEffect(() => {
    if (!focus) return;
    map.flyTo([focus.point.lat, focus.point.lng], focus.zoom ?? Math.max(map.getZoom(), 16), { duration: 0.5 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focus?.key]);

  return null;
}
