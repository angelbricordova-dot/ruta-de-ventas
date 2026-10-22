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

export function startLocation() {
  if (watchId !== null || typeof navigator === "undefined") return;
  if (!("geolocation" in navigator)) {
    useLocation.setState({ status: "unavailable" });
    return;
  }
  useLocation.setState((s) => ({ status: s.pos ? "on" : "asking" }));
  watchId = navigator.geolocation.watchPosition(
    (p) =>
      useLocation.setState({
        pos: { lat: p.coords.latitude, lng: p.coords.longitude, accuracy: p.coords.accuracy },
        status: "on",
      }),
    (err) => {
      useLocation.setState({ status: err.code === err.PERMISSION_DENIED ? "denied" : "unavailable" });
      if (watchId !== null) navigator.geolocation.clearWatch(watchId);
      watchId = null;
    },
    { enableHighAccuracy: true, maximumAge: 10_000, timeout: 20_000 },
  );
}

export function stopLocation() {
  if (watchId !== null) navigator.geolocation.clearWatch(watchId);
  watchId = null;
}
