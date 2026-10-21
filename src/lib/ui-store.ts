"use client";

import { create } from "zustand";
import type { Channel, Lead } from "./types";

/** Estado de las hojas globales (no se guarda). */
interface UIState {
  leadForm: { open: boolean; leadId: string | null; defaults: Partial<Lead>; nonce: number };
  log: { open: boolean; leadId: string | null; channel: Channel | null; nonce: number };
  openLeadForm: (leadId?: string | null, defaults?: Partial<Lead>) => void;
  closeLeadForm: () => void;
  openLog: (leadId: string, channel?: Channel | null) => void;
  closeLog: () => void;
}

export const useUI = create<UIState>()((set) => ({
  leadForm: { open: false, leadId: null, defaults: {}, nonce: 0 },
  log: { open: false, leadId: null, channel: null, nonce: 0 },
  openLeadForm: (leadId = null, defaults = {}) =>
    set((s) => ({ leadForm: { open: true, leadId, defaults, nonce: s.leadForm.nonce + 1 } })),
  closeLeadForm: () => set((s) => ({ leadForm: { ...s.leadForm, open: false } })),
  openLog: (leadId, channel = null) => set((s) => ({ log: { open: true, leadId, channel, nonce: s.log.nonce + 1 } })),
  closeLog: () => set((s) => ({ log: { ...s.log, open: false } })),
}));
