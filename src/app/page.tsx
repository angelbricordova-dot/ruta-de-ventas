"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowUpRight, Check, ChevronRight, Plus } from "lucide-react";
import { agendaFor, inScope, useProjectMap, useStore } from "@/lib/store";
import { useUI } from "@/lib/ui-store";
import { CHANNEL_LABEL, CHANNEL_VERB, LANE_LABEL, LANE_OF, OUTCOME_LABEL, type Lane } from "@/lib/labels";
import { clock, greeting, isoDay, money, month, plural } from "@/lib/format";
import { walkingRoute } from "@/lib/links";
import { AgendaRow, ContactButton, Due, LogButton, ROW_MOTION } from "@/components/LeadBits";
import { AnimatePresence, motion } from "motion/react";
import { Button, ButtonLink, Empty, Panel, PanelLink, ProjectTag, Segmented } from "@/components/ui";
import type { Lead, Project } from "@/lib/types";

const LANES: Lane[] = ["pie", "telefono", "mensajes"];
const SHORT_LANE: Record<Lane, string> = { pie: "A pie", telefono: "Llamadas", mensajes: "Mensajes" };

function listPhrase(parts: string[]) {
  if (parts.length <= 1) return parts.join("");
  return `${parts.slice(0, -1).join(", ")} y ${parts[parts.length - 1]}`;
}

export default function Home() {
  const settings = useStore((s) => s.settings);
  const scope = useStore((s) => s.scope);
  const allLeads = useStore((s) => s.leads);
  const allActivities = useStore((s) => s.activities);
  const allProjects = useStore((s) => s.projects);
  const clearDemo = useStore((s) => s.clearDemo);
  const openLeadForm = useUI((s) => s.openLeadForm);
  const projectMap = useProjectMap();
  const [laneTab, setLaneTab] = useState<Lane | null>(null);

  const today = isoDay();
  const now = new Date();
  const monthPrefix = today.slice(0, 7);
  const leads = inScope(allLeads, scope);
  const activities = inScope(allActivities, scope);
  const projects = allProjects.filter((p) => !p.archived && (scope === "todos" || p.id === scope));
  const hasDemo = allLeads.some((l) => l.demo);

  const agenda = agendaFor(leads, today, true);
  const overdue = agenda.filter((l) => l.nextAction!.date < today).sort((a, b) => a.nextAction!.date.localeCompare(b.nextAction!.date));
  const byLane = (lane: Lane) =>
    agenda
      .filter((l) => LANE_OF[l.nextAction!.channel] === lane)
      .sort((a, b) => (lane === "pie" ? a.routeOrder - b.routeOrder : a.nextAction!.date.localeCompare(b.nextAction!.date)));
  const lanes = Object.fromEntries(LANES.map((l) => [l, byLane(l)])) as Record<Lane, Lead[]>;
  const tab = laneTab ?? LANES.find((l) => lanes[l].length) ?? "pie";

  // Orden de trabajo: lo vencido, luego la ruta a pie, luego llamadas y mensajes.
  const queue = [...overdue, ...LANES.flatMap((l) => lanes[l]).filter((l) => !overdue.includes(l))];
  const [next, ...after] = queue;

  const doneToday = activities.filter((a) => isoDay(new Date(a.at)) === today).sort((a, b) => b.at.localeCompare(a.at));
  const total = doneToday.length + agenda.length;
  const closed = activities
    .filter((a) => a.outcome === "venta" && isoDay(new Date(a.at)).startsWith(monthPrefix))
    .reduce((sum, a) => sum + a.amount, 0);
  const goal = projects.reduce((sum, p) => sum + p.monthlyGoal, 0);

  const first = settings.sellerName.split(" ")[0] || settings.sellerName;
  const counts = [
    lanes.pie.length ? plural(lanes.pie.length, "visita", "visitas") : "",
    lanes.telefono.length ? plural(lanes.telefono.length, "llamada", "llamadas") : "",
    lanes.mensajes.length ? plural(lanes.mensajes.length, "mensaje", "mensajes") : "",
  ].filter(Boolean);
  const headline =
    agenda.length === 0
      ? doneToday.length
        ? "Terminaste lo de hoy."
        : "Hoy no tienes contactos programados."
      : `Te quedan ${listPhrase(counts)}.`;

  const route = walkingRoute(lanes.pie, settings.city);
  const routeLink = route && lanes.pie.length > 0 && (
    <a href={route} target="_blank" rel="noreferrer" className="inline-flex h-9 items-center gap-1 text-[14px] font-medium text-accent lg:text-[13px]">
      Ruta en Maps <ArrowUpRight size={15} strokeWidth={1.75} />
    </a>
  );

  const list = (lane: Lane) =>
    lanes[lane].length ? (
      <ol className="relative">
        <AnimatePresence initial={false} mode="popLayout">
          {lanes[lane].map((lead) => (
            <AgendaRow key={lead.id} lead={lead} project={projectMap.get(lead.projectId)} today={today} showProject={scope === "todos"} />
          ))}
        </AnimatePresence>
      </ol>
    ) : (
      <Empty>{lane === "pie" ? "Ninguna visita." : lane === "telefono" ? "Ninguna llamada." : "Ningún mensaje."}</Empty>
    );

  return (
    <div className="mx-auto w-full max-w-[1080px] px-4 pt-6 md:px-8 lg:pt-14">
      <header>
        <h1 className="font-display text-[30px] leading-[1.08] font-semibold tracking-[-0.025em] lg:text-[40px]">
          {greeting(now)}, {first}.
        </h1>
        <p className="mt-1 text-[16px] text-muted">{headline}</p>
      </header>

      {/* Avance del día y del mes, en una sola línea. */}
      <div className="mt-5 mb-6">
        <div className="flex items-baseline justify-between gap-3 text-[14px]">
          <span>
            <span className="tabular font-semibold">{doneToday.length}</span>
            <span className="text-muted"> de {total} hechos hoy</span>
          </span>
          <Link href="/proyectos" className="tabular text-muted">
            <span className="font-semibold text-ink">{money(closed, settings.currency)}</span>
            {goal > 0 ? ` de ${money(goal, settings.currency)}` : ""} en {month(now)}
          </Link>
        </div>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-active">
          <div className="progress-fill h-full rounded-full bg-accent" style={{ transform: `scaleX(${total ? doneToday.length / total : 0})` }} />
        </div>
      </div>

      {hasDemo && (
        <p className="mb-5 text-[14px] text-muted">
          Estás viendo datos de ejemplo.{" "}
          <button type="button" onClick={clearDemo} className="font-medium text-ink underline underline-offset-2">
            Borrarlos
          </button>
        </p>
      )}

      {/* Al terminar uno, la tarjeta se va a la izquierda y entra el siguiente: la fila avanza. */}
      <AnimatePresence initial={false} mode="popLayout">
        {next && (
          <motion.div
            key={next.id}
            initial={{ opacity: 0, x: 32 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -32 }}
            transition={{ duration: 0.26, ease: [0.23, 1, 0.32, 1] }}
          >
            <NextUp lead={next} after={after.length} project={projectMap.get(next.projectId)} today={today} />
          </motion.div>
        )}
      </AnimatePresence>

      <Panel
        className="mt-8"
        title="Pendientes"
        count={agenda.length}
        action={<PanelLink href="/ruta">Planificar</PanelLink>}
      >
        {agenda.length === 0 ? (
          <div className="flex flex-col gap-2 rounded-[18px] bg-surface p-4 sm:flex-row sm:items-center">
            <p className="flex-1 text-[15px] text-muted">Agrega a quién vas a visitar, llamar o escribir.</p>
            <ButtonLink href="/ruta" variant="primary">
              Armar la ruta
            </ButtonLink>
            <Button onClick={() => openLeadForm()}>
              <Plus size={16} strokeWidth={2} /> Prospecto
            </Button>
          </div>
        ) : (
          <>
            <div className="lg:hidden">
              <Segmented
                label="Canal"
                value={tab}
                onChange={setLaneTab}
                options={LANES.map((l) => ({ value: l, label: SHORT_LANE[l], count: lanes[l].length }))}
                className="mb-2"
              />
              {tab === "pie" && routeLink && <div className="flex justify-end">{routeLink}</div>}
              {list(tab)}
            </div>
            <div className="hidden grid-cols-3 gap-x-8 lg:grid">
              {LANES.map((lane) => (
                <div key={lane} className="min-w-0">
                  <div className="flex h-9 items-center justify-between border-b border-border">
                    <h3 className="text-[13px] font-medium text-muted">
                      {LANE_LABEL[lane]} <span className="tabular text-faint">{lanes[lane].length}</span>
                    </h3>
                    {lane === "pie" && routeLink}
                  </div>
                  {list(lane)}
                </div>
              ))}
            </div>
          </>
        )}
      </Panel>

      {doneToday.length > 0 && (
        <Panel className="mt-8" title="Hechos hoy" count={doneToday.length}>
          <ol className="relative">
            <AnimatePresence initial={false} mode="popLayout">
            {doneToday.map((a) => {
              const lead = allLeads.find((l) => l.id === a.leadId);
              return (
                <motion.li key={a.id} {...ROW_MOTION} className="border-b border-rule last:border-0">
                  <Link href={lead ? `/prospectos/${lead.id}` : "#"} className="flex min-h-[56px] items-center gap-3 py-2">
                    <motion.span
                      initial={{ scale: 0.6, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{ type: "spring", duration: 0.45, bounce: 0.3 }}
                      className="inline-flex size-[26px] flex-none items-center justify-center rounded-full bg-accent text-white"
                    >
                      <Check size={14} strokeWidth={2.6} />
                    </motion.span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[15px] text-muted line-through decoration-[#c9c9c4] lg:text-[14px]">
                        {lead?.business ?? "Prospecto borrado"}
                      </span>
                      <span className="block truncate text-[13px] text-faint">
                        {OUTCOME_LABEL[a.outcome]} · {CHANNEL_LABEL[a.channel]}
                      </span>
                    </span>
                    {a.outcome === "venta" && a.amount > 0 ? (
                      <span className="tabular flex-none text-[14px] font-medium text-positive">+{money(a.amount, settings.currency)}</span>
                    ) : (
                      <span className="tabular flex-none text-[13px] text-faint">{clock(a.at)}</span>
                    )}
                  </Link>
                </motion.li>
              );
            })}
            </AnimatePresence>
          </ol>
        </Panel>
      )}
    </div>
  );
}

/** El siguiente contacto, con dos botones grandes. */
function NextUp({ lead, after, project, today }: { lead: Lead; after: number; project: Project | undefined; today: string }) {
  const channel = lead.nextAction!.channel;
  return (
    <section className="rounded-[24px] bg-surface p-4 lg:max-w-[560px] lg:p-5" aria-label="Siguiente contacto">
      <div className="flex items-center justify-between gap-3">
        <span className="text-[13px] font-medium text-muted">Ahora{after > 0 && ` · luego ${after} más`}</span>
        <ProjectTag project={project} />
      </div>
      <Link href={`/prospectos/${lead.id}`} className="mt-1 flex items-start justify-between gap-3">
        <span className="min-w-0">
          <span className="block font-display text-[22px] leading-tight font-semibold tracking-[-0.015em]">{lead.business}</span>
          <span className="mt-0.5 block text-[15px] text-muted">
            {lead.nextAction!.note || CHANNEL_VERB[channel]}
            {lead.zone && ` · ${lead.zone}`}
          </span>
          <Due date={lead.nextAction!.date} today={today} />
        </span>
        <ChevronRight size={20} strokeWidth={1.75} className="mt-1 flex-none text-faint" />
      </Link>
      <div className="mt-4 flex gap-2">
        <ContactButton lead={lead} channel={channel} big />
        <LogButton lead={lead} channel={channel} big />
      </div>
    </section>
  );
}
