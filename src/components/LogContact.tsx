"use client";

import { useState } from "react";
import { useStore } from "@/lib/store";
import { useUI } from "@/lib/ui-store";
import { CHANNEL_LABEL, OUTCOME_LABEL, OUTCOMES, STAGE_LABEL, stageAfter } from "@/lib/labels";
import { addDays, isoDay, money } from "@/lib/format";
import type { Channel, Outcome } from "@/lib/types";
import { Button, Chips, cx, Field, Input, ProjectTag, Sheet, Textarea } from "./ui";

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

export function LogContact() {
  const { leadId, channel: presetChannel } = useUI((s) => s.log);
  const close = useUI((s) => s.closeLog);
  const lead = useStore((s) => s.leads.find((l) => l.id === leadId));
  const project = useStore((s) => s.projects.find((p) => p.id === lead?.projectId));
  const currency = useStore((s) => s.settings.currency);
  const logContact = useStore((s) => s.logContact);

  const channels: Channel[] = project?.channels.length ? project.channels : ["visita", "llamada", "whatsapp", "dm", "email"];
  const [channel, setChannel] = useState<Channel>(presetChannel ?? lead?.nextAction?.channel ?? channels[0]);
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [note, setNote] = useState("");
  const [amount, setAmount] = useState(lead?.value ?? 0);
  const [nextIn, setNextIn] = useState<string>("auto");
  const [nextChannel, setNextChannel] = useState<Channel>(channel);
  const [nextNote, setNextNote] = useState("");

  if (!lead) return null;

  const today = isoDay();
  const suggested = outcome ? FOLLOW_UP[outcome] : null;
  const closes = outcome === "venta" || outcome === "no_interesado";
  const nextDate =
    nextIn === "auto" ? (suggested !== null ? addDays(today, suggested) : null) : nextIn === "none" ? null : nextIn;
  const newStage = outcome ? stageAfter(lead.stage, outcome) : lead.stage;

  const save = () => {
    if (!outcome) return;
    logContact({
      leadId: lead.id,
      channel,
      outcome,
      note: note.trim(),
      amount,
      next: !closes && nextDate ? { channel: nextChannel, date: nextDate, note: nextNote.trim() } : null,
    });
    close();
  };

  const dateOptions = [
    { value: addDays(today, 1), label: "Mañana" },
    { value: addDays(today, 3), label: "En 3 días" },
    { value: addDays(today, 7), label: "En una semana" },
    { value: addDays(today, 30), label: "En un mes" },
    { value: "none", label: "No volver" },
  ];
  const nextValue = nextIn === "auto" ? (nextDate ?? "none") : nextIn;

  return (
    <Sheet
      open
      onClose={close}
      title="Registrar contacto"
      footer={
        <>
          <Button variant="ghost" onClick={close}>
            Cancelar
          </Button>
          <Button variant="primary" onClick={save} disabled={!outcome}>
            Guardar
          </Button>
        </>
      }
    >
      <div className="mb-5 flex flex-wrap items-center gap-2">
        <span className="text-[15px] font-medium">{lead.business}</span>
        <ProjectTag project={project} />
      </div>

      <div className="flex flex-col gap-5">
        <div className="flex flex-col gap-2">
          <span className="text-[13px] font-medium text-muted">Cómo lo contacté</span>
          <Chips
            label="Canal"
            value={channel}
            options={channels.map((c) => ({ value: c, label: CHANNEL_LABEL[c] }))}
            onChange={(c) => {
              setChannel(c);
              setNextChannel(c);
            }}
          />
        </div>

        <div className="flex flex-col gap-2">
          <span className="text-[13px] font-medium text-muted">Qué pasó</span>
          <div role="radiogroup" aria-label="Resultado" className="grid grid-cols-2 gap-2 sm:grid-cols-3">
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
                    "press h-12 rounded-[14px] border px-3 text-left text-[14px] font-medium md:h-11",
                    on
                      ? o === "venta"
                        ? "border-positive bg-[var(--pill-positive-bg)] text-[var(--pill-positive-ink)]"
                        : "border-ink bg-ink text-white"
                      : "border-border bg-raised hover:border-control",
                  )}
                >
                  {OUTCOME_LABEL[o]}
                </button>
              );
            })}
          </div>
          {outcome && newStage !== lead.stage && (
            <p className="text-[13px] text-muted">
              Pasa de <span className="text-ink">{STAGE_LABEL[lead.stage]}</span> a{" "}
              <span className="text-ink">{STAGE_LABEL[newStage]}</span>.
            </p>
          )}
        </div>

        {outcome === "venta" && (
          <Field label="Monto de la venta" hint={amount ? `Se suma a lo cerrado del mes: ${money(amount, currency)}` : undefined}>
            {(id) => (
              <Input
                id={id}
                type="number"
                inputMode="decimal"
                min={0}
                value={amount || ""}
                onChange={(e) => setAmount(Number(e.target.value) || 0)}
                className="tabular"
              />
            )}
          </Field>
        )}

        <Field label="Nota">
          {(id) => (
            <Textarea
              id={id}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Qué dijo, qué le preocupa, con quién hablar…"
              className="min-h-[72px]"
            />
          )}
        </Field>

        {outcome && !closes && (
          <fieldset className="flex flex-col gap-3 rounded-[16px] bg-surface p-4">
            <legend className="sr-only">Próximo contacto</legend>
            <span className="text-[14px] font-semibold">Próximo contacto</span>
            <Chips label="Cuándo" value={nextValue} options={dateOptions} onChange={setNextIn} />
            {nextDate && (
              <>
                <Chips
                  label="Canal del próximo contacto"
                  value={nextChannel}
                  options={channels.map((c) => ({ value: c, label: CHANNEL_LABEL[c] }))}
                  onChange={setNextChannel}
                />
                <Input value={nextNote} onChange={(e) => setNextNote(e.target.value)} placeholder="Qué hacer la próxima vez" aria-label="Qué hacer la próxima vez" />
              </>
            )}
          </fieldset>
        )}
      </div>
    </Sheet>
  );
}
