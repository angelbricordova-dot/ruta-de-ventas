"use client";

import { create } from "zustand";

/**
 * Candado del dispositivo: PIN de 4 dígitos y, si el teléfono lo permite,
 * Face ID o huella (WebAuthn con el autenticador del propio teléfono).
 *
 * Vive solo en este dispositivo (no se sincroniza). Es una pantalla de bloqueo
 * para que nadie que agarre el teléfono vea los clientes; no cifra los datos.
 */

interface Saved {
  onboarded: boolean;
  pinHash: string | null;
  salt: string | null;
  credentialId: string | null;
  /** Minutos fuera de la app antes de volver a pedir el PIN. 0 = siempre. */
  autoLockMin: number;
}

interface LockState extends Saved {
  ready: boolean;
  locked: boolean;
  failures: number;
  blockedUntil: number;
}

const KEY = "ruta-de-ventas:candado";
const DEFAULTS: Saved = { onboarded: false, pinHash: null, salt: null, credentialId: null, autoLockMin: 1 };

export const useLock = create<LockState>()(() => ({
  ...DEFAULTS,
  ready: false,
  locked: false,
  failures: 0,
  blockedUntil: 0,
}));

function persist() {
  const { onboarded, pinHash, salt, credentialId, autoLockMin } = useLock.getState();
  try {
    localStorage.setItem(KEY, JSON.stringify({ onboarded, pinHash, salt, credentialId, autoLockMin }));
  } catch {
    /* almacenamiento bloqueado */
  }
}

/* Utilidades ------------------------------------------------------ */

const b64url = (buf: ArrayBuffer | Uint8Array) => {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let s = "";
  bytes.forEach((b) => (s += String.fromCharCode(b)));
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};

const fromB64url = (s: string) => {
  const bin = atob(s.replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
};

async function hash(pin: string, salt: string) {
  const data = new TextEncoder().encode(`${salt}:${pin}`);
  return b64url(await crypto.subtle.digest("SHA-256", data));
}

/* Arranque y bloqueo automático ---------------------------------- */

let hiddenAt: number | null = null;
let started = false;

export function startLock() {
  if (started) return;
  started = true;
  let saved: Saved = DEFAULTS;
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) saved = { ...DEFAULTS, ...(JSON.parse(raw) as Partial<Saved>) };
  } catch {
    /* sin datos guardados */
  }
  useLock.setState({ ...saved, ready: true, locked: !!saved.pinHash });

  document.addEventListener("visibilitychange", () => {
    const { pinHash, autoLockMin } = useLock.getState();
    if (!pinHash) return;
    if (document.visibilityState === "hidden") {
      hiddenAt = Date.now();
    } else if (hiddenAt !== null) {
      if (Date.now() - hiddenAt >= autoLockMin * 60_000) useLock.setState({ locked: true });
      hiddenAt = null;
    }
  });
}

/* PIN ------------------------------------------------------------- */

export async function setPin(pin: string) {
  const salt = b64url(crypto.getRandomValues(new Uint8Array(16)));
  useLock.setState({ pinHash: await hash(pin, salt), salt, locked: false });
  persist();
}

/** Comprueba el PIN. Tras 5 fallos seguidos espera 30 s antes de aceptar otro intento. */
export async function unlockWithPin(pin: string): Promise<"ok" | "wrong" | "blocked"> {
  const { pinHash, salt, failures, blockedUntil } = useLock.getState();
  if (Date.now() < blockedUntil) return "blocked";
  if (!pinHash || !salt) return "ok";
  if ((await hash(pin, salt)) === pinHash) {
    useLock.setState({ locked: false, failures: 0, blockedUntil: 0 });
    return "ok";
  }
  const next = failures + 1;
  useLock.setState({ failures: next, blockedUntil: next >= 5 ? Date.now() + 30_000 : 0 });
  if (next >= 5) useLock.setState({ failures: 0 });
  return "wrong";
}

export function removeLock() {
  useLock.setState({ pinHash: null, salt: null, credentialId: null, locked: false });
  persist();
}

export function setAutoLock(min: number) {
  useLock.setState({ autoLockMin: min });
  persist();
}

export function lockNow() {
  if (useLock.getState().pinHash) useLock.setState({ locked: true });
}

export function finishOnboarding() {
  useLock.setState({ onboarded: true });
  persist();
}

/* Face ID / huella ------------------------------------------------ */

export async function biometricsAvailable(): Promise<boolean> {
  try {
    return (
      typeof window !== "undefined" &&
      !!window.PublicKeyCredential &&
      (await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable())
    );
  } catch {
    return false;
  }
}

/** Registra Face ID / huella para este dispositivo. */
export async function enableBiometrics(name: string): Promise<boolean> {
  try {
    const cred = (await navigator.credentials.create({
      publicKey: {
        challenge: crypto.getRandomValues(new Uint8Array(32)),
        rp: { name: "Ruta de ventas", id: location.hostname },
        user: { id: crypto.getRandomValues(new Uint8Array(16)), name: name || "vendedor", displayName: name || "Vendedor" },
        pubKeyCredParams: [
          { type: "public-key", alg: -7 },
          { type: "public-key", alg: -257 },
        ],
        authenticatorSelection: { authenticatorAttachment: "platform", userVerification: "required", residentKey: "discouraged" },
        timeout: 60_000,
        attestation: "none",
      },
    })) as PublicKeyCredential | null;
    if (!cred) return false;
    useLock.setState({ credentialId: b64url(cred.rawId) });
    persist();
    return true;
  } catch {
    return false;
  }
}

export async function unlockWithBiometrics(): Promise<boolean> {
  const { credentialId } = useLock.getState();
  if (!credentialId) return false;
  try {
    const ok = await navigator.credentials.get({
      publicKey: {
        challenge: crypto.getRandomValues(new Uint8Array(32)),
        rpId: location.hostname,
        allowCredentials: [{ type: "public-key", id: fromB64url(credentialId), transports: ["internal"] }],
        userVerification: "required",
        timeout: 60_000,
      },
    });
    if (!ok) return false;
    useLock.setState({ locked: false, failures: 0 });
    return true;
  } catch {
    return false;
  }
}

export function disableBiometrics() {
  useLock.setState({ credentialId: null });
  persist();
}

/** "Face ID" en iPhone, "huella" en Android. */
export function biometricLabel() {
  if (typeof navigator === "undefined") return "Face ID o huella";
  return /iPhone|iPad|iPod|Macintosh/.test(navigator.userAgent) ? "Face ID" : "huella";
}
