"use client";

import dynamic from "next/dynamic";
import { googleEnabled } from "@/lib/geo";
import type { MapViewProps } from "./types";

const Placeholder = () => <div className="h-full w-full animate-pulse bg-[#eef0ec]" aria-label="Cargando mapa" />;

// Los mapas usan window: se cargan solo en el navegador.
const LeafletMap = dynamic(() => import("./LeafletMap"), { ssr: false, loading: Placeholder });
const GoogleMap = dynamic(() => import("./GoogleMap"), { ssr: false, loading: Placeholder });

export function MapView(props: MapViewProps) {
  return googleEnabled() ? <GoogleMap {...props} /> : <LeafletMap {...props} />;
}

export type { MapMarker, MapViewProps } from "./types";
