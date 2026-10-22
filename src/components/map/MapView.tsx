"use client";

import dynamic from "next/dynamic";
import type { MapViewProps } from "./types";

const Placeholder = () => <div className="h-full w-full animate-pulse bg-[#eef0ec]" aria-label="Cargando mapa" />;

/** Mapa interactivo de Google (con clave de API). Se carga solo en el navegador. */
export const MapView = dynamic<MapViewProps>(() => import("./GoogleMap"), { ssr: false, loading: Placeholder });

export type { MapMarker, MapViewProps } from "./types";
