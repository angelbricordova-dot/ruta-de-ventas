"use client";

import { create } from "zustand";
import { syncData, useStore, type SyncData } from "./store";

/**
 * Sincronización con la nube (Upstash Redis detrás de /api/sync).
 *
 * El teléfono siempre trabaja con su copia local, así que la app sigue
 * funcionando sin señal. Cada cambio se sube 1,5 s después; al abrir la app,
 * al volver a ella y al recuperar la conexión se baja lo último. Si dos
 * dispositivos cambiaron cosas a la vez, se unen por ID: gana la versión más
 * reciente de cada registro y lo borrado en uno se borra en el otro.
 */

export type SyncStatus = "off" | "syncing" | "synced" | "offline" | "error" | "unauthorized" | "unconfigured";

interface Meta {
  clave: string;
  rev: number;
  lastSynced: string | null;
  dirty: boolean;
}

interface SyncState {
  status: SyncStatus;
  lastSynced: string | null;
  message: string;
  enabled: boolean;
}

const META_KEY = "ruta-de-ventas:nube";

export const useSync = create<SyncState>()(() => ({ status: "off", lastSynced: null, message: "", enabled: false }));

function readMeta(): Meta | null {
  try {
    const raw = localStorage.getItem(META_KEY);
    return raw ? (JSON.parse(raw) as Meta) : null;
  } catch {
    return null;
  }
}

function writeMeta(meta: Meta | null) {
  try {
    if (meta) localStorage.setItem(META_KEY, JSON.stringify(meta));
    else localStorage.removeItem(META_KEY);
  } catch {
    /* almacenamiento bloqueado: la sincronización sigue en memoria */
  }
}

/* Unión ----------------------------------------------------------- */

type Stamped = { id: string; updatedAt?: string };

function mergeList<T extends Stamped>(local: T[], remote: T[], deleted: Set<string>): T[] {
  const byId = new Map<string, T>();
  for (const r of remote) byId.set(r.id, r);
  for (const l of local) {
    const r = byId.get(l.id);
    byId.set(l.id, !r || (l.updatedAt ?? "") >= (r.updatedAt ?? "") ? l : r);
  }
  return [...byId.values()].filter((x) => !deleted.has(x.id));
}

export function mergeData(local: SyncData, remote: SyncData): SyncData {
  const deleted = [...new Set([...(local.deleted ?? []), ...(remote.deleted ?? [])])];
  const gone = new Set(deleted);
  const localSettingsWin = (local.settingsUpdatedAt ?? "") >= (remote.settingsUpdatedAt ?? "");
  return {
    projects: mergeList(local.projects, remote.projects ?? [], gone),
    leads: mergeList(local.leads, remote.leads ?? [], gone),
    activities: mergeList(local.activities, remote.activities ?? [], gone),
    scripts: mergeList(local.scripts, remote.scripts ?? [], gone),
    settings: localSettingsWin ? local.settings : remote.settings,
    settingsUpdatedAt: localSettingsWin ? local.settingsUpdatedAt : remote.settingsUpdatedAt,
    deleted,
  };
}

/* Motor ----------------------------------------------------------- */

let meta: Meta | null = null;
let applying = false;
let pushTimer: ReturnType<typeof setTimeout> | null = null;
let busy: Promise<void> | null = null;
let started = false;

function set(patch: Partial<SyncState>) {
  useSync.setState(patch);
}

function save(patch: Partial<Meta>) {
  if (!meta) return;
  meta = { ...meta, ...patch };
  writeMeta(meta);
  if (patch.lastSynced) set({ lastSynced: patch.lastSynced });
}

function apply(data: SyncData) {
  applying = true;
  try {
    useStore.getState().replaceData(data);
  } finally {
    applying = false;
  }
}

async function call(method: "GET" | "PUT", body?: unknown): Promise<Response> {
  return fetch("/api/sync", {
    method,
    headers: { "x-clave": meta?.clave ?? "", ...(body ? { "Content-Type": "application/json" } : {}) },
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store",
  });
}

/** Traduce una respuesta fallida a un estado. Devuelve true si hay que parar. */
async function failed(res: Response): Promise<boolean> {
  if (res.status === 401) {
    set({ status: "unauthorized", message: "La clave no coincide con la de Vercel." });
    return true;
  }
  if (res.status === 503) {
    set({ status: "unconfigured", message: "Falta conectar la base de datos en Vercel." });
    return true;
  }
  if (!res.ok && res.status !== 409) {
    const j = (await res.json().catch(() => ({}))) as { message?: string };
    set({ status: "error", message: j.message ?? `Error ${res.status}` });
    return true;
  }
  return false;
}

async function push(attempt = 0): Promise<void> {
  if (!meta) return;
  const res = await call("PUT", { baseRev: meta.rev, data: syncData() });
  if (await failed(res)) return;
  if (res.status === 409) {
    // Otro dispositivo guardó antes: unir y volver a intentar.
    const remote = (await res.json()) as { rev: number; data: SyncData | null };
    if (remote.data) apply(mergeData(syncData(), remote.data));
    save({ rev: remote.rev });
    if (attempt < 3) return push(attempt + 1);
    set({ status: "error", message: "No se pudo guardar después de varios intentos." });
    return;
  }
  const ok = (await res.json()) as { rev: number; savedAt: string };
  save({ rev: ok.rev, dirty: false, lastSynced: ok.savedAt });
  set({ status: "synced", message: "" });
}

async function pull(): Promise<void> {
  if (!meta) return;
  const res = await call("GET");
  if (await failed(res)) return;
  const remote = (await res.json()) as { rev: number; data: SyncData | null; savedAt: string | null };
  if (remote.rev !== meta.rev && remote.data) {
    const local = syncData();
    apply(meta.dirty ? mergeData(local, remote.data) : mergeData(remote.data, local));
    save({ rev: remote.rev, lastSynced: remote.savedAt ?? new Date().toISOString() });
    // Si lo local aportó algo que la nube no tenía, se sube.
    if (JSON.stringify(syncData()) !== JSON.stringify(remote.data)) save({ dirty: true });
  }
  if (meta.dirty || !remote.data) return push();
  save({ lastSynced: new Date().toISOString() });
  set({ status: "synced", message: "" });
}

/** Ejecuta una operación a la vez y traduce los fallos de red a "sin conexión". */
function run(task: () => Promise<void>): Promise<void> {
  if (!meta) return Promise.resolve();
  if (busy) return busy.then(() => run(task));
  set({ status: "syncing" });
  busy = task()
    .catch(() => set({ status: "offline", message: "Sin conexión. Los cambios se guardan en el teléfono y se suben luego." }))
    .finally(() => {
      busy = null;
    });
  return busy;
}

export function syncNow() {
  return run(pull);
}

function schedulePush() {
  if (pushTimer) clearTimeout(pushTimer);
  pushTimer = setTimeout(() => run(push), 1500);
}

export function connect(clave: string) {
  meta = { clave: clave.trim(), rev: 0, lastSynced: null, dirty: true };
  writeMeta(meta);
  set({ enabled: true, message: "" });
  return run(pull);
}

export function disconnect() {
  meta = null;
  writeMeta(null);
  set({ status: "off", enabled: false, lastSynced: null, message: "" });
}

/** Se llama una vez, cuando la copia local ya está cargada. */
export function startSync() {
  if (started) return;
  started = true;
  meta = readMeta();
  set({ enabled: !!meta, lastSynced: meta?.lastSynced ?? null });

  useStore.subscribe((state, prev) => {
    if (applying || !meta) return;
    const changed =
      state.projects !== prev.projects ||
      state.leads !== prev.leads ||
      state.activities !== prev.activities ||
      state.scripts !== prev.scripts ||
      state.settings !== prev.settings ||
      state.deleted !== prev.deleted;
    if (!changed) return;
    save({ dirty: true });
    schedulePush();
  });

  const refresh = () => document.visibilityState === "visible" && syncNow();
  document.addEventListener("visibilitychange", refresh);
  window.addEventListener("online", () => syncNow());
  setInterval(refresh, 120_000);

  if (meta) syncNow();
}
