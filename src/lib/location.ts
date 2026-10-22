"use client";

import { create } from "zustand";
import type { LatLng } from "./geo";

/** Ubicación en vivo del teléfono, compartida por toda la app (un solo watchPosition). */
interface LocationState {
  pos: (LatLng & { accuracy: number }) | null;
  status: "idle" | "asking" | "on" | "denied" | "unavailable";
}

export const useLocation = create<LocationState>()(() => ({ pos: null, status: "idle" }));

let watchId: number | null = null;
let poll: ReturnType<typeof setInterval> | null = null;

const save = (p: GeolocationPosition) =>
  useLocation.setState({ pos: { lat: p.coords.latitude, lng: p.coords.longitude, accuracy: p.coords.accuracy }, status: "on" });

export function startLocation() {
  if (watchId !== null || typeof navigator === "undefined") return;
  if (!("geolocation" in navigator)) {
    useLocation.setState({ status: "unavailable" });
    return;
  }
  useLocation.setState((s) => ({ status: s.pos ? "on" : "asking" }));
  watchId = navigator.geolocation.watchPosition(
    save,
    (err) => {
      // Solo un permiso negado detiene el seguimiento. Un "sin señal" o "tiempo agotado"
      // (pasa al quedarse quieto) no: el GPS sigue y la próxima lectura llega sola.
      if (err.code !== err.PERMISSION_DENIED) {
        if (!useLocation.getState().pos) useLocation.setState({ status: "asking" });
        return;
      }
      useLocation.setState({ status: "denied" });
      if (watchId !== null) navigator.geolocation.clearWatch(watchId);
      watchId = null;
    },
    { enableHighAccuracy: true, maximumAge: 10_000 },
  );
  // Respaldo: el iPhone a veces pausa watchPosition; cada 20 s se pide la ubicación de nuevo.
  poll ??= setInterval(() => {
    if (document.visibilityState !== "visible" || watchId === null) return;
    navigator.geolocation.getCurrentPosition(save, () => {}, { enableHighAccuracy: true, maximumAge: 15_000, timeout: 15_000 });
  }, 20_000);
}

export function stopLocation() {
  if (watchId !== null) navigator.geolocation.clearWatch(watchId);
  watchId = null;
  if (poll) clearInterval(poll);
  poll = null;
}
