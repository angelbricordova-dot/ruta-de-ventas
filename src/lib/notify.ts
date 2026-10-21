"use client";

import { toast } from "sonner";
import { useStore, type LogInput } from "./store";
import { OUTCOME_LABEL } from "./labels";
import { addDays, isoDay } from "./format";
import { haptic } from "./haptics";
import type { Lead } from "./types";

/** Registra el contacto, vibra y avisa con opción de deshacer. */
export function logWithUndo(input: LogInput) {
  const store = useStore.getState();
  const before = store.leads.find((l) => l.id === input.leadId);
  if (!before) return;
  const activityId = store.logContact(input);
  if (!activityId) return;
  haptic(input.outcome === "venta" ? [12, 60, 18] : 10);
  toast(before.business, {
    description: input.outcome === "venta" ? "¡Venta registrada!" : OUTCOME_LABEL[input.outcome],
    action: { label: "Deshacer", onClick: () => useStore.getState().undoLog(activityId, before) },
  });
}

/** Pasa el contacto a mañana (deslizar a la izquierda). */
export function postponeWithUndo(lead: Lead) {
  if (!lead.nextAction) return;
  const before = lead;
  useStore.getState().schedule(lead.id, { ...lead.nextAction, date: addDays(isoDay(), 1) });
  haptic(8);
  toast(lead.business, {
    description: "Pasó a mañana",
    action: { label: "Deshacer", onClick: () => useStore.getState().restoreLead(before) },
  });
}
