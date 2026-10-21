"use client";

import { useState } from "react";
import { useStore } from "@/lib/store";
import { useUI } from "@/lib/ui-store";
import { CHANNEL_LABEL, OUTCOME_LABEL, OUTCOMES, STAGE_LABEL, stageAfter } from "@/lib/labels";
import { addDays, isoDay, relativeDay } from "@/lib/format";
import type { Channel, Outcome } from "@/lib/types";
import { Button, Chips, cx, Input, Sheet } from "./ui";

/** Cuándo volver a contactar según el resultado. */
const FOLLOW_UP: Record<Outcome, number | null> = {
  sin_respuesta: 2,
  contactado: 3,
  volver_luego: 7,
  interesado: 2,
  propuesta: 3,
  venta: null,
  no_interesado: null,
};

/** Fila de texto con un enlace "Cambiar" que despliega las opciones. */
function Line({ label, value, open, onToggle }: { label: string; value: string; open: boolean; onToggle: () => void }) {
  return (
    <div className="flex min-h-11 items-center justify-between gap-3 text-[15px] lg:text-[14px]">
      <span className="min-w-0 truncate">
        <span className="text-muted">{label} </span>
        {value}
      </span>
      <button type="button" onClick={onToggle} className="h-9 flex-none font-medium text-accent">
        {open ? "Listo" : "Cambiar"}
      </button>
    </div>
  );
}

export function LogContact() {
  const { leadId, channel: presetChannel } = useUI((s) => s.log);
  const close = useUI((s) => s.closeLog);
  const lead = useStore((s) => s.leads.find((l) => l.id === leadId));
  const project = useStore((s) => s.projects.find((p) => p.id === lead?.projectId));
  const logContact = useStore((s) => s.logContact);

  const channels: Channel[] = project?.channels.length ? project.channels : ["visita", "llamada", "whatsapp", "dm", "email"];
  const [channel, setChannel] = useState<Channel>(presetChannel ?? lead?.nextAction?.channel ?? channels[0]);
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [note, setNote] = useState("");
  const [amount, setAmount] = useState(lead?.value ?? 0);
  const [nextIn, setNextIn] = useState<string>("auto");
  const [nextChannel, setNextChannel] = useState<Channel | null>(null);
  const [editChannel, setEditChannel] = useState(false);
  const [editNext, setEditNext] = useState(false);

  if (!lead) return null;

  const today = isoDay();
  const suggested = outcome ? FOLLOW_UP[outcome] : null;
  const closes = outcome === "venta" || outcome === "no_interesado";
  const nextDate = nextIn === "auto" ? (suggested !== null ? addDays(today, suggested) : null) : nextIn === "none" ? null : nextIn;
  const followChannel = nextChannel ?? channel;
  const newStage = outcome ? stageAfter(lead.stage, outcome) : lead.stage;

  const save = () => {
    if (!outcome) return;
    logContact({
      leadId: lead.id,
      channel,
      outcome,
      note: note.trim(),
      amount,
      next: !closes && nextDate ? { channel: followChannel, date: nextDate, note: "" } : null,
    });
    close();
  };

  return (
    <Sheet
      open
      onClose={close}
      title="¿Cómo te fue?"
      footer={
        <Button variant="primary" onClick={save} disabled={!outcome}>
          Guardar
        </Button>
      }
    >
      <p className="-mt-1 mb-4 text-[15px] text-muted">{lead.business}</p>

      <div role="radiogroup" aria-label="Resultado" className="grid grid-cols-2 gap-2">
        {OUTCOMES.map((o) => {
          const on = outcome === o;
          return (
            <button
              key={o}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => {
                setOutcome(o);
                setNextIn("auto");
              }}
              className={cx(
                "press h-[52px] rounded-[16px] px-4 text-left text-[15px] font-medium transition-colors lg:h-12 lg:text-[14px]",
                o === "no_interesado" && "col-span-2",
                on ? (o === "venta" ? "bg-positive text-white" : "bg-ink text-white") : "bg-surface hover:bg-active",
              )}
            >
              {OUTCOME_LABEL[o]}
            </button>
          );
        })}
      </div>

      {outcome && (
        <div className="mt-4 flex flex-col">
          {outcome === "venta" && (
            <label className="mb-2 flex items-center justify-between gap-3 text-[15px]">
              <span className="text-muted">Monto</span>
              <Input
                type="number"
                inputMode="decimal"
                min={0}
                value={amount || ""}
                onChange={(e) => setAmount(Number(e.target.value) || 0)}
                className="tabular w-[140px] text-right"
              />
            </label>
          )}

          <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Nota (opcional)" aria-label="Nota" />

          <div className="mt-2 divide-y divide-rule">
            <div>
              <Line label="Por" value={CHANNEL_LABEL[channel]} open={editChannel} onToggle={() => setEditChannel((v) => !v)} />
              {editChannel && (
                <Chips
                  label="Canal"
                  value={channel}
                  options={channels.map((c) => ({ value: c, label: CHANNEL_LABEL[c] }))}
                  onChange={(c) => setChannel(c)}
                  className="pb-3"
                />
              )}
            </div>

            {!closes && (
              <div>
                <Line
                  label="Próximo:"
                  value={nextDate ? `${CHANNEL_LABEL[followChannel]}, ${relativeDay(nextDate, today).toLowerCase()}` : "ninguno"}
                  open={editNext}
                  onToggle={() => setEditNext((v) => !v)}
                />
                {editNext && (
                  <div className="flex flex-col gap-2 pb-3">
                    <Chips
                      label="Cuándo"
                      value={nextDate ?? "none"}
                      onChange={setNextIn}
                      options={[
                        { value: addDays(today, 1), label: "Mañana" },
                        { value: addDays(today, 3), label: "En 3 días" },
                        { value: addDays(today, 7), label: "En una semana" },
                        { value: addDays(today, 30), label: "En un mes" },
                        { value: "none", label: "No volver" },
                      ]}
                    />
                    {nextDate && (
                      <Chips
                        label="Canal del próximo contacto"
                        value={followChannel}
                        options={channels.map((c) => ({ value: c, label: CHANNEL_LABEL[c] }))}
                        onChange={setNextChannel}
                      />
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {newStage !== lead.stage && (
            <p className="mt-2 text-[13px] text-faint">
              Pasa a {STAGE_LABEL[newStage].toLowerCase()}.
            </p>
          )}
        </div>
      )}
    </Sheet>
  );
}
