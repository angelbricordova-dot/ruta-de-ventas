"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, ArrowUpRight, ChevronLeft, ChevronRight, Plus, Search, X } from "lucide-react";
import { agendaFor, inScope, useProjectMap, useStore } from "@/lib/store";
import { CHANNEL_LABEL, LANE_LABEL, LANE_OF, OPEN_STAGES, STAGE_LABEL, type Lane } from "@/lib/labels";
import { addDays, capitalize, isoDay, longDay, parseDay, plural, relativeDay } from "@/lib/format";
import { walkingRoute } from "@/lib/links";
import { Canvas } from "@/components/Shell";
import { ContactButton, DoneCircle, Due } from "@/components/LeadBits";
import { Button, Chips, cx, Empty, Input, PageTitle, Panel, ProjectDot, Sheet } from "@/components/ui";
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
  const [picking, setPicking] = useState(false);

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

  const picker = (
    <>
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
            <ul className="divide-y divide-rule lg:max-h-[640px] lg:overflow-y-auto">
              {shown.map((l) => {
                const project = projects.find((p) => p.id === l.projectId);
                const options = (["visita", "llamada", "whatsapp", "dm"] as Channel[]).filter((c) => !project || project.channels.includes(c));
                return (
                  <li key={l.id} className="py-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <span className="flex items-center gap-1.5">
                          {scope === "todos" && <ProjectDot project={project} size={7} />}
                          <span className="truncate text-[16px] font-medium lg:text-[14px]">{l.business}</span>
                        </span>
                        <span className="block truncate text-[14px] text-muted lg:text-[12.5px]">
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
                          className="press inline-flex h-10 items-center gap-1 rounded-full bg-active px-3.5 text-[14px] font-medium hover:bg-[#e2e2dd] lg:h-8 lg:px-3 lg:text-[12.5px]"
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
    </>
  );

  return (
    <Canvas>
      <PageTitle title="Ruta" sub={`${longDay(date)} · ${plural(day.length, "contacto", "contactos")}`} />

      <div className="mb-6 flex items-center gap-2">
        <button
          type="button"
          onClick={() => setDate(addDays(date, -1))}
          className="press inline-flex size-10 flex-none items-center justify-center rounded-full hover:bg-active"
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
                  "press flex h-14 min-w-[60px] flex-1 flex-col items-center justify-center rounded-[16px] text-[12px]",
                  on ? "bg-ink text-white" : "bg-surface hover:bg-active",
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
          className="press inline-flex size-10 flex-none items-center justify-center rounded-full hover:bg-active"
          aria-label="Día siguiente"
        >
          <ChevronRight size={16} strokeWidth={1.75} />
        </button>
      </div>

      <Button variant="primary" className="mb-4 w-full lg:hidden" onClick={() => setPicking(true)}>
        <Plus size={18} strokeWidth={2} /> Agregar contactos a {relativeDay(date, today).toLowerCase()}
      </Button>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
        <div className="flex flex-col gap-8 lg:col-span-7">
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
                  <ol className="divide-y divide-rule">
                    {items.map((lead, i) => {
                      const project = projectMap.get(lead.projectId);
                      const channel = lead.nextAction!.channel;
                      return (
                        <li key={lead.id} className="flex min-h-[66px] items-center gap-2 py-1.5 lg:min-h-[60px]">
                          {isToday && <DoneCircle lead={lead} channel={channel} />}
                          <Link href={`/prospectos/${lead.id}`} className="min-w-0 flex-1 py-1">
                            <span className="flex items-center gap-1.5">
                              {l === "pie" && <span className="tabular text-[14px] text-faint">{i + 1}</span>}
                              <span className="truncate text-[16px] font-medium lg:text-[14px]">{lead.business}</span>
                              {scope === "todos" && <ProjectDot project={project} size={7} />}
                            </span>
                            <span className="flex items-center gap-2 text-[14px] text-muted lg:text-[12.5px]">
                              <Due date={lead.nextAction!.date} today={today} />
                              <span className="truncate">
                                {[l !== "pie" ? CHANNEL_LABEL[channel] : "", lead.nextAction?.note || lead.niche, lead.address || lead.zone]
                                  .filter(Boolean)
                                  .join(" · ")}
                              </span>
                            </span>
                          </Link>
                          {l === "pie" && items.length > 1 && (
                            <span className="flex flex-none flex-col">
                              <button
                                type="button"
                                disabled={i === 0}
                                onClick={() => moveInRoute(lead.id, -1, date)}
                                className="press inline-flex size-7 items-center justify-center rounded-full text-faint hover:text-ink disabled:opacity-20"
                                aria-label="Subir en la ruta"
                              >
                                <ArrowUp size={15} strokeWidth={2} />
                              </button>
                              <button
                                type="button"
                                disabled={i === items.length - 1}
                                onClick={() => moveInRoute(lead.id, 1, date)}
                                className="press inline-flex size-7 items-center justify-center rounded-full text-faint hover:text-ink disabled:opacity-20"
                                aria-label="Bajar en la ruta"
                              >
                                <ArrowDown size={15} strokeWidth={2} />
                              </button>
                            </span>
                          )}
                          <ContactButton lead={lead} channel={channel} />
                          <button
                            type="button"
                            onClick={() => schedule(lead.id, null)}
                            className="press hidden size-9 flex-none items-center justify-center rounded-full text-faint hover:bg-active hover:text-ink lg:inline-flex"
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
                    {l === "pie" ? "Sin visitas." : l === "telefono" ? "Sin llamadas." : "Sin mensajes."}
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

        <Panel className="hidden lg:sticky lg:top-6 lg:col-span-5 lg:block lg:self-start" title={`Agregar a ${relativeDay(date, today).toLowerCase()}`} count={shown.length}>
          {picker}
        </Panel>
      </div>

      <Sheet open={picking} onClose={() => setPicking(false)} title={`Agregar a ${relativeDay(date, today).toLowerCase()}`}>
        {picker}
      </Sheet>
    </Canvas>
  );
}
