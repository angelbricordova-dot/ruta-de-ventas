"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { ChevronLeft, Copy, Trash2 } from "lucide-react";
import { useStore } from "@/lib/store";
import { useUI } from "@/lib/ui-store";
import { CHANNEL_LABEL, CHANNEL_VERB, OUTCOME_LABEL, STAGE_LABEL, STAGES } from "@/lib/labels";
import { addDays, isoDay, longDay, money, relativeDay, when } from "@/lib/format";
import { fillScript } from "@/lib/links";
import { Canvas } from "@/components/Shell";
import { ContactButton, Due, LogButton } from "@/components/LeadBits";
import { Avatar, Button, Chips, cx, Empty, Panel, ProjectTag } from "@/components/ui";
import type { Channel } from "@/lib/types";

export default function LeadPage() {
  const { id } = useParams<{ id: string }>();
  const lead = useStore((s) => s.leads.find((l) => l.id === id));
  const project = useStore((s) => s.projects.find((p) => p.id === lead?.projectId));
  const allActivities = useStore((s) => s.activities);
  const allScripts = useStore((s) => s.scripts);
  const settings = useStore((s) => s.settings);
  const setStage = useStore((s) => s.setStage);
  const schedule = useStore((s) => s.schedule);
  const deleteActivity = useStore((s) => s.deleteActivity);
  const openLeadForm = useUI((s) => s.openLeadForm);
  const openLog = useUI((s) => s.openLog);
  const [copied, setCopied] = useState<string | null>(null);

  if (!lead) {
    return (
      <Canvas narrow>
        <Empty action={<Link href="/prospectos" className="font-medium text-ink hover:underline">Volver a prospectos</Link>}>
          Este prospecto no existe o fue borrado.
        </Empty>
      </Canvas>
    );
  }

  const today = isoDay();
  const history = allActivities.filter((a) => a.leadId === lead.id).sort((a, b) => b.at.localeCompare(a.at));
  const scripts = allScripts.filter((s) => s.projectId === lead.projectId);
  const offer = project?.offers.find((o) => o.id === lead.offerId);
  const channels: Channel[] = project?.channels.length ? project.channels : ["visita", "llamada", "whatsapp", "dm", "email"];
  const contactChannels = (["llamada", "whatsapp", "dm", "visita", "email"] as Channel[]).filter(
    (c) => channels.includes(c) || (c === "llamada" && lead.phone) || (c === "dm" && lead.instagram) || (c === "email" && lead.email),
  );

  const copy = async (key: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      setTimeout(() => setCopied((k) => (k === key ? null : k)), 1600);
    } catch {
      /* el portapapeles puede estar bloqueado; no pasa nada */
    }
  };

  const facts: [string, string][] = [
    ["Contacto", lead.contactName],
    ["Teléfono", lead.phone],
    ["Instagram", lead.instagram],
    ["Correo", lead.email],
    ["Dirección", lead.address],
    ["Zona", lead.zone],
    ["Le ofrezco", offer?.name ?? ""],
    ["Valor estimado", lead.value ? money(lead.value, settings.currency) : ""],
    ["Agregado", relativeDay(isoDay(new Date(lead.createdAt)), today)],
  ];

  const next = lead.nextAction;
  const closed = lead.stage === "ganado" || lead.stage === "perdido";

  return (
    <Canvas>
      <Link href="/prospectos" className="mb-4 inline-flex h-8 items-center gap-1 text-[13px] font-medium text-muted hover:text-ink">
        <ChevronLeft size={16} strokeWidth={1.75} /> Prospectos
      </Link>

      <div className="mb-5 flex items-start justify-between gap-3 md:mb-8">
        <div className="flex min-w-0 items-center gap-4">
          <Avatar name={lead.business} project={project} size={52} />
          <div className="min-w-0">
            <h1 className="font-display text-[24px] leading-tight font-semibold tracking-[-0.02em] lg:text-[28px]">{lead.business}</h1>
            <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[14px] text-muted">
              <ProjectTag project={project} />
              {[lead.niche, lead.zone].filter(Boolean).join(" · ")}
            </div>
          </div>
        </div>
        <div className="flex flex-none gap-2">
          <Button size="sm" variant="ghost" onClick={() => openLeadForm(lead.id)} className="h-10 text-[15px] text-accent lg:h-8 lg:text-[13px]">
            Editar
          </Button>
          <Button variant="primary" onClick={() => openLog(lead.id)} className="max-lg:hidden">
            Registrar contacto
          </Button>
        </div>
      </div>

      <div className="scroll-x -mx-4 mb-6 flex gap-2 px-4 md:mx-0 md:flex-wrap md:px-0">
        {contactChannels.map((c) => (
          <ContactButton key={c} lead={lead} channel={c} label />
        ))}
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
        <div className="flex flex-col gap-8 lg:col-span-8">
          <Panel title="Próximo contacto">
            {next ? (
              <div className="rounded-[18px] bg-surface p-4">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="text-[16px] font-medium">
                    {CHANNEL_VERB[next.channel]} · {relativeDay(next.date, today)}
                  </span>
                  <span className="text-[13px] text-muted">{longDay(next.date)}</span>
                </div>
                {next.note && <p className="mt-1 text-[14px] text-muted">{next.note}</p>}
                <Due date={next.date} today={today} />
                <div className="mt-4 flex flex-col gap-3">
                  <Chips
                    label="Mover a"
                    value={next.date}
                    onChange={(d) => schedule(lead.id, { ...next, date: d })}
                    options={[
                      { value: today, label: "Hoy" },
                      { value: addDays(today, 1), label: "Mañana" },
                      { value: addDays(today, 3), label: "En 3 días" },
                      { value: addDays(today, 7), label: "En una semana" },
                    ]}
                  />
                  <Chips
                    label="Canal"
                    value={next.channel}
                    onChange={(c) => schedule(lead.id, { ...next, channel: c })}
                    options={channels.map((c) => ({ value: c, label: CHANNEL_LABEL[c] }))}
                  />
                </div>
                <button type="button" onClick={() => schedule(lead.id, null)} className="mt-3 text-[13px] font-medium text-muted hover:text-ink">
                  Quitar de la ruta
                </button>
              </div>
            ) : (
              <Empty
                action={
                  !closed && (
                    <button
                      type="button"
                      className="font-medium text-ink hover:underline"
                      onClick={() => schedule(lead.id, { channel: channels[0], date: today, note: "" })}
                    >
                      Agregar a la ruta de hoy
                    </button>
                  )
                }
              >
                {closed ? `Prospecto ${STAGE_LABEL[lead.stage].toLowerCase()}.` : "Sin próximo contacto programado."}
              </Empty>
            )}
          </Panel>

          <Panel title="Historial" count={history.length}>
            {history.length ? (
              <ol className="flex flex-col">
                {history.map((a, i) => (
                  <li key={a.id} className="group relative flex gap-3 pb-4 last:pb-0">
                    {i < history.length - 1 && <span className="absolute top-5 bottom-0 left-[5px] w-px bg-border" aria-hidden />}
                    <span
                      className={cx(
                        "relative mt-1.5 size-[11px] flex-none rounded-full border-2 bg-surface",
                        a.outcome === "venta" ? "border-positive bg-positive" : "border-control",
                      )}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                        <span className="text-[14px] font-medium">
                          {OUTCOME_LABEL[a.outcome]}
                          <span className="font-normal text-muted"> · {CHANNEL_LABEL[a.channel]}</span>
                          {a.outcome === "venta" && a.amount > 0 && (
                            <span className="tabular ml-2 text-positive">+{money(a.amount, settings.currency)}</span>
                          )}
                        </span>
                        <span className="tabular text-[12px] text-faint">{when(a.at, today)}</span>
                      </div>
                      {a.note && <p className="mt-0.5 text-[13.5px] text-muted">{a.note}</p>}
                    </div>
                    <button
                      type="button"
                      onClick={() => deleteActivity(a.id)}
                      className="press inline-flex size-8 flex-none items-center justify-center rounded-full text-faint opacity-100 hover:bg-active hover:text-negative md:opacity-0 md:group-hover:opacity-100 md:focus:opacity-100"
                      aria-label="Borrar este registro"
                    >
                      <Trash2 size={14} strokeWidth={1.75} />
                    </button>
                  </li>
                ))}
              </ol>
            ) : (
              <Empty>Aún no hay contactos registrados con este negocio.</Empty>
            )}
          </Panel>

          {scripts.length > 0 && (
            <Panel title="Guiones de este proyecto">
              <ul className="flex flex-col gap-2">
                {scripts.map((s) => {
                  const text = fillScript(s.body, lead, settings.sellerName);
                  return (
                    <li key={s.id}>
                      <details className="group rounded-[14px] border border-border bg-raised">
                        <summary className="flex h-12 cursor-pointer list-none items-center justify-between gap-3 px-4">
                          <span className="truncate text-[14px] font-medium">
                            {s.title} <span className="font-normal text-muted">· {CHANNEL_LABEL[s.channel]}</span>
                          </span>
                          <span className="text-[13px] text-muted group-open:hidden">Ver</span>
                        </summary>
                        <div className="border-t border-rule px-4 py-3">
                          <p className="text-[14px] leading-relaxed whitespace-pre-line">{text}</p>
                          <Button size="sm" className="mt-3" onClick={() => copy(s.id, text)}>
                            <Copy size={14} strokeWidth={1.75} /> {copied === s.id ? "Copiado" : "Copiar"}
                          </Button>
                        </div>
                      </details>
                    </li>
                  );
                })}
              </ul>
            </Panel>
          )}
        </div>

        <div className="flex flex-col gap-8 lg:col-span-4">
          <Panel title="Etapa">
            <Chips
              label="Etapa"
              value={lead.stage}
              onChange={(st) => setStage(lead.id, st)}
              options={STAGES.map((st) => ({ value: st, label: STAGE_LABEL[st] }))}
            />
          </Panel>

          <Panel title="Datos">
            <dl>
              {facts.map(([k, v]) => (
                <div key={k} className="flex min-h-9 items-center justify-between gap-3 border-b border-rule py-1.5 last:border-0">
                  <dt className="flex-none text-[13px] text-muted">{k}</dt>
                  <dd className={cx("min-w-0 truncate text-right text-[13.5px]", !v && "text-faint")}>{v || "—"}</dd>
                </div>
              ))}
            </dl>
          </Panel>

          <Panel title="Notas">
            {lead.notes ? (
              <p className="text-[14px] leading-relaxed whitespace-pre-line">{lead.notes}</p>
            ) : (
              <Empty
                action={
                  <button type="button" className="font-medium text-ink hover:underline" onClick={() => openLeadForm(lead.id)}>
                    Escribir
                  </button>
                }
              >
                Sin notas.
              </Empty>
            )}
          </Panel>
        </div>
      </div>
      {/* Teléfono: lo que más se usa, siempre a mano sobre la barra inferior. */}
      <div className="fixed inset-x-0 bottom-[calc(61px+env(safe-area-inset-bottom))] z-20 border-t border-rule bg-[rgba(255,255,255,0.97)] px-4 py-2.5 lg:hidden">
        <div className="flex gap-2">
          <ContactButton lead={lead} channel={next?.channel ?? (lead.phone ? "llamada" : channels[0])} big />
          <LogButton lead={lead} channel={next?.channel} big />
        </div>
      </div>
      <div className="h-20 lg:hidden" aria-hidden />
    </Canvas>
  );
}
