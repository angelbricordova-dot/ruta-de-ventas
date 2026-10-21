"use client";

import { create } from "zustand";

/** Evento de Chrome/Android para instalar la app con un botón. */
interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export type Platform = "ios" | "android" | "desktop";

interface InstallState {
  installed: boolean;
  platform: Platform;
  /** En iPhone, Chrome y Firefox también instalan desde Compartir (iOS 16.4+). */
  iosBrowser: "safari" | "otro";
  prompt: InstallPromptEvent | null;
}

export const useInstall = create<InstallState>()(() => ({
  installed: false,
  platform: "desktop",
  iosBrowser: "safari",
  prompt: null,
}));

let started = false;

export function startInstall() {
  if (started) return;
  started = true;
  const ua = navigator.userAgent;
  const ios = /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
  const platform: Platform = ios ? "ios" : /Android/.test(ua) ? "android" : "desktop";
  const installed =
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true;
  useInstall.setState({ platform, installed, iosBrowser: /CriOS|FxiOS|EdgiOS/.test(ua) ? "otro" : "safari" });

  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    useInstall.setState({ prompt: e as InstallPromptEvent });
  });
  window.addEventListener("appinstalled", () => useInstall.setState({ installed: true, prompt: null }));
}

/** Muestra el diálogo de instalación de Android. Devuelve true si la instaló. */
export async function installNow(): Promise<boolean> {
  const { prompt } = useInstall.getState();
  if (!prompt) return false;
  await prompt.prompt();
  const { outcome } = await prompt.userChoice;
  useInstall.setState({ prompt: null, installed: outcome === "accepted" });
  return outcome === "accepted";
}
