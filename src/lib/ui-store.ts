"use client";

import { create } from "zustand";
import type { Channel, Lead } from "./types";

/** Estado de las hojas globales (no se guarda). */
interface UIState {
  leadForm: { open: boolean; leadId: string | null; defaults: Partial<Lead> };
  log: { open: boolean; leadId: string | null; channel: Channel | null };
  openLeadForm: (leadId?: string | null, defaults?: Partial<Lead>) => void;
  closeLeadForm: () => void;
  openLog: (leadId: string, channel?: Channel | null) => void;
  closeLog: () => void;
}

export const useUI = create<UIState>()((set) => ({
  leadForm: { open: false, leadId: null, defaults: {} },
  log: { open: false, leadId: null, channel: null },
  openLeadForm: (leadId = null, defaults = {}) => set({ leadForm: { open: true, leadId, defaults } }),
  closeLeadForm: () => set((s) => ({ leadForm: { ...s.leadForm, open: false } })),
  openLog: (leadId, channel = null) => set({ log: { open: true, leadId, channel } }),
  closeLog: () => set((s) => ({ log: { ...s.log, open: false } })),
}));
