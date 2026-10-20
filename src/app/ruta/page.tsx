"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, ArrowUpRight, ChevronLeft, ChevronRight, Plus, Search, X } from "lucide-react";
import { agendaFor, inScope, useProjectMap, useStore } from "@/lib/store";
import { CHANNEL_LABEL, LANE_LABEL, LANE_OF, OPEN_STAGES, STAGE_LABEL, type Lane } from "@/lib/labels";
import { addDays, capitalize, isoDay, longDay, parseDay, plural, relativeDay } from "@/lib/format";
import { walkingRoute } from "@/lib/links";
import { Canvas } from "@/components/Shell";
import { ContactButton, Due, LogButton } from "@/components/LeadBits";
import { Avatar, Chips, cx, Empty, Input, PageTitle, Panel, ProjectDot } from "@/components/ui";
import type { Channel, Lead } from "@/lib/types";

const LANES: Lane[] = ["pie", "telefono", "mensajes"];
const weekdayShort = new Intl.DateTimeFormat("es", { weekday: "short" });

export default function RoutePage() {
  const scope = useStore((s) => s.scope);
  const allLeads = useStore((s) => s.leads);
  const projects = useStore((s) => s.projects);
  const city = useStore((s) => s.settings.city);
  const schedule = useStore((s) => s.schedule);
  const moveInRoute = useStore((s) => s.moveInRoute);
  const projectMap = useProjectMap();

  const today = isoDay();
  const [date, setDate] = useState(today);
  const [zone, setZone] = useState("todas");
  const [q, setQ] = useState("");

  const leads = inScope(allLeads, scope);
  const isToday = date === today;
  const day = agendaFor(leads, date, isToday);
  const lane = (l: Lane) =>
    day
      .filter((x) => LANE_OF[x.nextAction!.channel] === l)
      .sort((a, b) => (l === "pie" ? a.routeOrder - b.routeOrder : a.business.localeCompare(b.business)));
  const visits = lane("pie");
  const route = walkingRoute(visits, city);

  const week = Array.from({ length: 7 }, (_, i) => addDays(today, i));
  const countOn = (d: string) => agendaFor(leads, d, d === today).length;

  // Candidatos: abiertos que no están programados para este día.
  const candidates = leads.filter((l) => OPEN_STAGES.includes(l.stage) && l.nextAction?.date !== date && !(isToday && l.nextAction && l.nextAction.date < today));
  const zones = useMemo(() => {
    const m = new Map<string, number>();
    candidates.forEach((l) => m.set(l.zone || "Sin zona", (m.get(l.zone || "Sin zona") ?? 0) + 1));
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [candidates]);
  const needle = q.trim().toLowerCase();
  const shown = candidates
    .filter((l) => zone === "todas" || (l.zone || "Sin zona") === zone)
    .filter((l) => !needle || `${l.business} ${l.niche} ${l.contactName}`.toLowerCase().includes(needle))
    .sort((a, b) => (a.nextAction ? 1 : 0) - (b.nextAction ? 1 : 0) || a.business.localeCompare(b.business));

  const addTo = (l: Lead, channel: Channel) => schedule(l.id, { channel, date, note: l.nextAction?.note ?? "" });

  return (
    <Canvas>
      <PageTitle title="Ruta" sub={`${longDay(date)} · ${plural(day.length, "contacto", "contactos")}`} />

      <div className="mb-6 flex items-center gap-2">
        <button
          type="button"
          onClick={() => setDate(addDays(date, -1))}
          className="press inline-flex size-10 flex-none items-center justify-center rounded-full border border-border hover:border-control"
          aria-label="Día anterior"
        >
          <ChevronLeft size={16} strokeWidth={1.75} />
        </button>
        <div className="scroll-x flex flex-1 gap-1.5">
          {week.map((d) => {
            const on = d === date;
            const n = countOn(d);
            return (
              <button
                key={d}
                type="button"
                onClick={() => setDate(d)}
                aria-pressed={on}
                className={cx(
                  "press flex h-14 min-w-[64px] flex-1 flex-col items-center justify-center rounded-[14px] border text-[12px]",
                  on ? "border-ink bg-ink text-white" : "border-border bg-raised hover:border-control",
                )}
              >
                <span className={on ? "text-white/70" : "text-muted"}>{d === today ? "Hoy" : capitalize(weekdayShort.format(parseDay(d)).replace(".", ""))}</span>
                <span className="tabular text-[15px] font-medium">{n || "·"}</span>
              </button>
            );
          })}
        </div>
        <button
          type="button"
          onClick={() => setDate(addDays(date, 1))}
          className="press inline-flex size-10 flex-none items-center justify-center rounded-full border border-border hover:border-control"
          aria-label="Día siguiente"
        >
          <ChevronRight size={16} strokeWidth={1.75} />
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        <div className="flex flex-col gap-4 lg:col-span-7">
          {LANES.map((l) => {
            const items = l === "pie" ? visits : lane(l);
            return (
              <Panel
                key={l}
                title={LANE_LABEL[l]}
                count={items.length}
                action={
                  l === "pie" && route && items.length > 0 ? (
                    <a href={route} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[13px] font-medium text-accent hover:underline">
                      Abrir ruta en Maps <ArrowUpRight size={14} strokeWidth={1.75} />
                    </a>
                  ) : undefined
                }
              >
                {items.length ? (
                  <ol className="flex flex-col gap-2">
                    {items.map((lead, i) => {
                      const project = projectMap.get(lead.projectId);
                      return (
                        <li key={lead.id} className="flex min-h-[63px] items-center gap-2.5 rounded-[14px] border border-border bg-raised py-2 pr-2 pl-3">
                          {l === "pie" ? (
                            <span className="flex flex-none flex-col items-center">
                              <button
                                type="button"
                                disabled={i === 0}
                                onClick={() => moveInRoute(lead.id, -1, date)}
                                className="press inline-flex size-6 items-center justify-center rounded-full text-faint hover:text-ink disabled:opacity-25"
                                aria-label="Subir en la ruta"
                              >
                                <ArrowUp size={13} strokeWidth={2} />
                              </button>
                              <span className="tabular text-[12px] font-semibold text-muted">{i + 1}</span>
                              <button
                                type="button"
                                disabled={i === items.length - 1}
                                onClick={() => moveInRoute(lead.id, 1, date)}
                                className="press inline-flex size-6 items-center justify-center rounded-full text-faint hover:text-ink disabled:opacity-25"
                                aria-label="Bajar en la ruta"
                              >
                                <ArrowDown size={13} strokeWidth={2} />
                              </button>
                            </span>
                          ) : (
                            <Avatar name={lead.business} project={project} size={32} />
                          )}
                          <Link href={`/prospectos/${lead.id}`} className="min-w-0 flex-1">
                            <span className="flex items-center gap-1.5">
                              {scope === "todos" && <ProjectDot project={project} size={7} />}
                              <span className="truncate text-[14px] font-medium">{lead.business}</span>
                            </span>
                            <span className="flex items-center gap-2 text-[12.5px] text-muted">
                              <Due date={lead.nextAction!.date} today={today} />
                              <span className="truncate">
                                {[l !== "pie" ? CHANNEL_LABEL[lead.nextAction!.channel] : "", lead.nextAction?.note || lead.niche, lead.address || lead.zone]
                                  .filter(Boolean)
                                  .join(" · ")}
                              </span>
                            </span>
                          </Link>
                          <ContactButton lead={lead} channel={lead.nextAction!.channel} />
                          {isToday && <LogButton lead={lead} channel={lead.nextAction!.channel} compact />}
                          <button
                            type="button"
                            onClick={() => schedule(lead.id, null)}
                            className="press hidden size-9 flex-none items-center justify-center rounded-full text-faint hover:bg-active hover:text-ink sm:inline-flex"
                            aria-label={`Quitar ${lead.business} de la ruta`}
                            title="Quitar de la ruta"
                          >
                            <X size={15} strokeWidth={1.75} />
                          </button>
                        </li>
                      );
                    })}
                  </ol>
                ) : (
                  <Empty>
                    {l === "pie"
                      ? "Sin visitas este día. Agrégalas desde la lista, mejor si son de la misma zona."
                      : l === "telefono"
                        ? "Sin llamadas este día."
                        : "Sin mensajes ni DMs este día."}
                  </Empty>
                )}
                {l === "pie" && items.length > 0 && !city && (
                  <p className="mt-3 text-[12.5px] text-faint">
                    Para que Maps encuentre las direcciones, pon tu ciudad en{" "}
                    <Link href="/ajustes" className="underline underline-offset-2 hover:text-ink">
                      Ajustes
                    </Link>
                    .
                  </p>
                )}
              </Panel>
            );
          })}
        </div>

        <Panel className="lg:sticky lg:top-6 lg:col-span-5 lg:self-start" title={`Agregar a ${relativeDay(date, today).toLowerCase()}`} count={shown.length}>
          <div className="mb-3 flex flex-col gap-3">
            <label className="relative">
              <Search size={16} strokeWidth={1.75} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-faint" />
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar negocio o rubro" className="pl-9" aria-label="Buscar prospecto" />
            </label>
            {zones.length > 1 && (
              <Chips
                label="Zona"
                value={zone}
                onChange={setZone}
                options={[{ value: "todas", label: "Todas" }, ...zones.map(([z, n]) => ({ value: z, label: `${z} ${n}` }))]}
              />
            )}
          </div>
          {shown.length ? (
            <ul className="flex max-h-[640px] flex-col gap-2 overflow-y-auto">
              {shown.map((l) => {
                const project = projects.find((p) => p.id === l.projectId);
                const options = (["visita", "llamada", "whatsapp", "dm"] as Channel[]).filter((c) => !project || project.channels.includes(c));
                return (
                  <li key={l.id} className="rounded-[14px] border border-border bg-raised p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <span className="flex items-center gap-1.5">
                          {scope === "todos" && <ProjectDot project={project} size={7} />}
                          <span className="truncate text-[14px] font-medium">{l.business}</span>
                        </span>
                        <span className="block truncate text-[12.5px] text-muted">
                          {[l.niche, l.zone, STAGE_LABEL[l.stage]].filter(Boolean).join(" · ")}
                        </span>
                        {l.nextAction && (
                          <span className="block text-[12px] text-faint">
                            Programado: {CHANNEL_LABEL[l.nextAction.channel]} {relativeDay(l.nextAction.date, today).toLowerCase()}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {options.map((c) => (
                        <button
                          key={c}
                          type="button"
                          onClick={() => addTo(l, c)}
                          className="press inline-flex h-9 items-center gap-1 rounded-full border border-control px-3 text-[12.5px] font-medium hover:border-ink md:h-8"
                        >
                          <Plus size={13} strokeWidth={2} /> {CHANNEL_LABEL[c]}
                        </button>
                      ))}
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : (
            <Empty>{candidates.length ? "Nada coincide con la búsqueda." : "Todos tus prospectos abiertos ya tienen fecha este día."}</Empty>
          )}
        </Panel>
      </div>
    </Canvas>
  );
}
