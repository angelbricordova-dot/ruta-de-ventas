"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { isoDay, uid } from "./format";
import { stageAfter } from "./labels";
import { DEFAULT_SETTINGS, seedDemo, seedProjects, seedScripts } from "./seed";
import type { Activity, Channel, Lead, NextAction, Outcome, Project, Script, Settings, Stage } from "./types";

export type Scope = "todos" | string;

export interface LogInput {
  leadId: string;
  channel: Channel;
  outcome: Outcome;
  note: string;
  amount: number;
  next: NextAction | null;
}

export interface Backup {
  version: 1;
  exportedAt: string;
  projects: Project[];
  leads: Lead[];
  activities: Activity[];
  scripts: Script[];
  settings: Settings;
}

interface State {
  projects: Project[];
  leads: Lead[];
  activities: Activity[];
  scripts: Script[];
  settings: Settings;
  scope: Scope;

  setScope: (scope: Scope) => void;
  updateSettings: (patch: Partial<Settings>) => void;

  saveProject: (project: Omit<Project, "id" | "createdAt"> & { id?: string }) => string;
  deleteProject: (id: string) => void;

  saveLead: (lead: Omit<Lead, "id" | "createdAt" | "updatedAt" | "routeOrder"> & { id?: string }) => string;
  deleteLead: (id: string) => void;
  setStage: (id: string, stage: Stage) => void;
  schedule: (id: string, next: NextAction | null) => void;
  moveInRoute: (id: string, direction: -1 | 1, date: string) => void;
  logContact: (input: LogInput) => void;
  deleteActivity: (id: string) => void;

  saveScript: (script: Omit<Script, "id"> & { id?: string }) => void;
  deleteScript: (id: string) => void;

  clearDemo: () => void;
  loadDemo: () => void;
  importBackup: (backup: Backup) => void;
  resetAll: () => void;
}

const fresh = () => {
  const demo = seedDemo();
  return {
    projects: seedProjects(),
    leads: demo.leads,
    activities: demo.activities,
    scripts: seedScripts(),
    settings: DEFAULT_SETTINGS,
    scope: "todos" as Scope,
  };
};

const touch = (lead: Lead, patch: Partial<Lead>): Lead => ({
  ...lead,
  ...patch,
  updatedAt: new Date().toISOString(),
});

/** Coloca un prospecto al final de la ruta a pie del día. */
const lastRouteOrder = (leads: Lead[], date: string) =>
  leads.reduce(
    (max, l) => (l.nextAction?.date === date && l.nextAction.channel === "visita" ? Math.max(max, l.routeOrder) : max),
    0,
  ) + 1;

export const useStore = create<State>()(
  persist(
    (set, get) => ({
      ...fresh(),

      setScope: (scope) => set({ scope }),
      updateSettings: (patch) => set((s) => ({ settings: { ...s.settings, ...patch } })),

      saveProject: (input) => {
        const id = input.id ?? uid();
        set((s) => {
          const existing = s.projects.find((p) => p.id === id);
          const project: Project = existing
            ? { ...existing, ...input, id }
            : { ...input, id, createdAt: new Date().toISOString() };
          return {
            projects: existing ? s.projects.map((p) => (p.id === id ? project : p)) : [...s.projects, project],
          };
        });
        return id;
      },

      deleteProject: (id) =>
        set((s) => {
          const leadIds = new Set(s.leads.filter((l) => l.projectId === id).map((l) => l.id));
          return {
            projects: s.projects.filter((p) => p.id !== id),
            leads: s.leads.filter((l) => l.projectId !== id),
            activities: s.activities.filter((a) => !leadIds.has(a.leadId)),
            scripts: s.scripts.filter((sc) => sc.projectId !== id),
            scope: s.scope === id ? "todos" : s.scope,
          };
        }),

      saveLead: (input) => {
        const id = input.id ?? uid();
        set((s) => {
          const existing = s.leads.find((l) => l.id === id);
          if (existing) {
            const movedDay =
              input.nextAction?.date !== existing.nextAction?.date ||
              input.nextAction?.channel !== existing.nextAction?.channel;
            const routeOrder =
              movedDay && input.nextAction ? lastRouteOrder(s.leads, input.nextAction.date) : existing.routeOrder;
            return { leads: s.leads.map((l) => (l.id === id ? touch(existing, { ...input, id, routeOrder }) : l)) };
          }
          const now = new Date().toISOString();
          const lead: Lead = {
            ...input,
            id,
            createdAt: now,
            updatedAt: now,
            routeOrder: input.nextAction ? lastRouteOrder(s.leads, input.nextAction.date) : 0,
          };
          return { leads: [lead, ...s.leads] };
        });
        return id;
      },

      deleteLead: (id) =>
        set((s) => ({
          leads: s.leads.filter((l) => l.id !== id),
          activities: s.activities.filter((a) => a.leadId !== id),
        })),

      setStage: (id, stage) =>
        set((s) => ({
          leads: s.leads.map((l) =>
            l.id === id
              ? touch(l, { stage, nextAction: stage === "ganado" || stage === "perdido" ? null : l.nextAction })
              : l,
          ),
        })),

      schedule: (id, next) =>
        set((s) => ({
          leads: s.leads.map((l) =>
            l.id === id ? touch(l, { nextAction: next, routeOrder: next ? lastRouteOrder(s.leads, next.date) : 0 }) : l,
          ),
        })),

      moveInRoute: (id, direction, date) =>
        set((s) => {
          const route = s.leads
            .filter((l) => l.nextAction?.date === date && l.nextAction.channel === "visita")
            .sort((a, b) => a.routeOrder - b.routeOrder);
          const i = route.findIndex((l) => l.id === id);
          const j = i + direction;
          if (i < 0 || j < 0 || j >= route.length) return {};
          [route[i], route[j]] = [route[j], route[i]];
          const order = new Map(route.map((l, k) => [l.id, k + 1]));
          return { leads: s.leads.map((l) => (order.has(l.id) ? { ...l, routeOrder: order.get(l.id)! } : l)) };
        }),

      logContact: ({ leadId, channel, outcome, note, amount, next }) =>
        set((s) => {
          const lead = s.leads.find((l) => l.id === leadId);
          if (!lead) return {};
          const activity: Activity = {
            id: uid(),
            leadId,
            projectId: lead.projectId,
            channel,
            outcome,
            note,
            amount: outcome === "venta" ? amount : 0,
            at: new Date().toISOString(),
          };
          const stage = stageAfter(lead.stage, outcome);
          const closed = stage === "ganado" || stage === "perdido";
          const nextAction = closed ? null : next;
          return {
            activities: [activity, ...s.activities],
            leads: s.leads.map((l) =>
              l.id === leadId
                ? touch(l, {
                    stage,
                    nextAction,
                    value: outcome === "venta" && amount > 0 ? amount : l.value,
                    routeOrder: nextAction ? lastRouteOrder(s.leads, nextAction.date) : 0,
                  })
                : l,
            ),
          };
        }),

      deleteActivity: (id) => set((s) => ({ activities: s.activities.filter((a) => a.id !== id) })),

      saveScript: (input) => {
        const id = input.id ?? uid();
        set((s) => {
          const exists = s.scripts.some((sc) => sc.id === id);
          const script: Script = { ...input, id };
          return { scripts: exists ? s.scripts.map((sc) => (sc.id === id ? script : sc)) : [...s.scripts, script] };
        });
      },
      deleteScript: (id) => set((s) => ({ scripts: s.scripts.filter((sc) => sc.id !== id) })),

      clearDemo: () =>
        set((s) => ({
          leads: s.leads.filter((l) => !l.demo),
          activities: s.activities.filter((a) => !a.demo),
        })),

      loadDemo: () => {
        const demo = seedDemo();
        const missing = seedProjects().filter((p) => !get().projects.some((q) => q.id === p.id));
        set((s) => ({
          projects: [...s.projects, ...missing],
          leads: [...s.leads.filter((l) => !l.demo), ...demo.leads],
          activities: [...s.activities.filter((a) => !a.demo), ...demo.activities],
        }));
      },

      importBackup: (b) =>
        set({
          projects: b.projects,
          leads: b.leads,
          activities: b.activities,
          scripts: b.scripts,
          settings: { ...DEFAULT_SETTINGS, ...b.settings },
          scope: "todos",
        }),

      resetAll: () => set({ ...fresh() }),
    }),
    {
      name: "ruta-de-ventas",
      version: 1,
      storage: createJSONStorage(() => localStorage),
      partialize: ({ projects, leads, activities, scripts, settings, scope }) => ({
        projects,
        leads,
        activities,
        scripts,
        settings,
        scope,
      }),
    },
  ),
);

export function makeBackup(): Backup {
  const { projects, leads, activities, scripts, settings } = useStore.getState();
  return { version: 1, exportedAt: new Date().toISOString(), projects, leads, activities, scripts, settings };
}

/* ------------------------------------------------------------------ */
/* Selectores                                                          */
/* ------------------------------------------------------------------ */

export function inScope<T extends { projectId: string }>(items: T[], scope: Scope): T[] {
  return scope === "todos" ? items : items.filter((i) => i.projectId === scope);
}

export function useProjectMap() {
  const projects = useStore((s) => s.projects);
  return new Map(projects.map((p) => [p.id, p]));
}

/** Prospectos con acción para una fecha (más los vencidos si es hoy). */
export function agendaFor(leads: Lead[], date: string, includeOverdue: boolean) {
  return leads.filter((l) => {
    const d = l.nextAction?.date;
    if (!d) return false;
    return d === date || (includeOverdue && d < date);
  });
}

export function today() {
  return isoDay();
}
