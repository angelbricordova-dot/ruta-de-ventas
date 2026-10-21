"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowUpRight, ChevronRight, Plus } from "lucide-react";
import { agendaFor, inScope, useProjectMap, useStore } from "@/lib/store";
import { useUI } from "@/lib/ui-store";
import { CHANNEL_LABEL, CHANNEL_VERB, HUES, LANE_LABEL, LANE_OF, OPEN_STAGES, OUTCOME_LABEL, type Lane } from "@/lib/labels";
import { greeting, isoDay, longDay, money, month, plural, when } from "@/lib/format";
import { walkingRoute } from "@/lib/links";
import { AgendaRow, ContactButton, Due, LogButton } from "@/components/LeadBits";
import { Avatar, Button, ButtonLink, cx, Empty, Panel, PanelLink, ProjectTag, Segmented } from "@/components/ui";
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
      .sort((a, b) =>
        lane === "pie" ? a.routeOrder - b.routeOrder : a.nextAction!.date.localeCompare(b.nextAction!.date),
      );
  const lanes = Object.fromEntries(LANES.map((l) => [l, byLane(l)])) as Record<Lane, Lead[]>;
  const tab = laneTab ?? LANES.find((l) => lanes[l].length) ?? "pie";

  // Orden de trabajo: primero lo vencido, luego la ruta a pie, luego llamadas y mensajes.
  const queue = [...overdue, ...LANES.flatMap((l) => lanes[l]).filter((l) => !overdue.includes(l))];
  const [next, ...after] = queue;

  const doneToday = activities.filter((a) => isoDay(new Date(a.at)) === today);
  const proposals = leads.filter((l) => l.stage === "propuesta");
  const proposalValue = proposals.reduce((sum, l) => sum + l.value, 0);
  const salesThisMonth = activities.filter((a) => a.outcome === "venta" && isoDay(new Date(a.at)).startsWith(monthPrefix));
  const closed = salesThisMonth.reduce((sum, a) => sum + a.amount, 0);
  const goal = projects.reduce((sum, p) => sum + p.monthlyGoal, 0);

  const first = settings.sellerName.split(" ")[0] || settings.sellerName;
  const counts = [
    lanes.pie.length ? plural(lanes.pie.length, "visita", "visitas") : "",
    lanes.telefono.length ? plural(lanes.telefono.length, "llamada", "llamadas") : "",
    lanes.mensajes.length ? plural(lanes.mensajes.length, "mensaje", "mensajes") : "",
  ].filter(Boolean);
  const pieZones = [...new Set(lanes.pie.map((l) => l.zone).filter(Boolean))];

  const headline =
    agenda.length === 0
      ? "Hoy no tienes contactos programados."
      : `Hoy te tocan ${listPhrase(counts)}${pieZones.length === 1 ? `, a pie por ${pieZones[0]}` : ""}.`;

  const route = walkingRoute(lanes.pie, settings.city);
  const recent = [...activities].sort((a, b) => b.at.localeCompare(a.at)).slice(0, 5);

  const laneList = (lane: Lane) =>
    lanes[lane].length ? (
      <ol className="flex flex-col gap-2">
        {lanes[lane].map((lead, i) => (
          <AgendaRow key={lead.id} lead={lead} project={projectMap.get(lead.projectId)} today={today} order={lane === "pie" ? i + 1 : undefined} />
        ))}
      </ol>
    ) : (
      <Empty>{lane === "pie" ? "Ninguna visita hoy." : lane === "telefono" ? "Ninguna llamada hoy." : "Ningún mensaje hoy."}</Empty>
    );

  const routeLink = route && lanes.pie.length > 0 && (
    <a href={route} target="_blank" rel="noreferrer" className="inline-flex h-9 items-center gap-1 text-[14px] font-medium text-accent hover:underline lg:text-[13px]">
      Abrir ruta en Maps <ArrowUpRight size={15} strokeWidth={1.75} />
    </a>
  );

  return (
    <div className="mx-auto w-full max-w-[1132px] px-4 pt-6 md:px-8 lg:pt-[64px]">
      <header className="mb-5 lg:mb-10">
        <h1 className="font-display text-[30px] leading-[1.08] font-semibold tracking-[-0.025em] text-balance lg:text-[44px]">
          {greeting(now)}, {first}.
          <span className="hidden text-muted lg:inline"> {headline}</span>
        </h1>
        <p className="mt-1.5 text-[16px] leading-snug text-muted lg:hidden">{headline}</p>
        <p className="mt-2 text-[14px] text-muted">
          {longDay(today)}
          {overdue.length > 0 && (
            <>
              {" · "}
              <span className="font-medium text-negative">{plural(overdue.length, "vencido", "vencidos")}</span>
            </>
          )}
        </p>
      </header>

      {hasDemo && (
        <div className="mb-4 flex items-center justify-between gap-3 rounded-[16px] border border-[#f3dfa6] bg-[#fffaeb] px-4 py-3 text-[13.5px] text-[#7c3a0b]">
          <span className="min-w-0">Estos prospectos son de ejemplo.</span>
          <button type="button" onClick={clearDemo} className="h-9 flex-none font-semibold underline-offset-2 hover:underline">
            Borrarlos
          </button>
        </div>
      )}

      {next && <NextUp lead={next} after={after} project={projectMap.get(next.projectId)} today={today} />}

      <div className="grid grid-cols-2 gap-3 md:gap-4 lg:grid-cols-12">
        <Tile
          label="Para hoy"
          value={String(agenda.length)}
          caption={doneToday.length ? `${plural(doneToday.length, "hecho", "hechos")} hoy` : "Ninguno hecho aún"}
        />
        <Tile
          label="Vencidos"
          value={String(overdue.length)}
          tone={overdue.length ? "negative" : undefined}
          caption={overdue.length ? "De días anteriores" : "Todo al día"}
        />
        <Tile
          label="Propuestas"
          value={money(proposalValue, settings.currency)}
          caption={proposals.length ? `${plural(proposals.length, "espera", "esperan")} respuesta` : "Ninguna enviada"}
        />
        <Tile
          label={`Cerrado en ${month(now)}`}
          value={money(closed, settings.currency)}
          caption={goal ? `Meta ${money(goal, settings.currency)}` : plural(salesThisMonth.length, "venta", "ventas")}
        />

        <Panel
          className="order-1 col-span-2 lg:order-none lg:col-span-12"
          title="Ruta de hoy"
          count={agenda.length}
          action={<PanelLink href="/ruta">Planificar</PanelLink>}
        >
          {/* Teléfono: un carril a la vez. */}
          <div className="lg:hidden">
            <Segmented
              label="Carril"
              value={tab}
              onChange={setLaneTab}
              options={LANES.map((l) => ({ value: l, label: SHORT_LANE[l], count: lanes[l].length }))}
              className="mb-3"
            />
            {tab === "pie" && routeLink && <div className="-mt-1 mb-2 flex justify-end">{routeLink}</div>}
            {laneList(tab)}
          </div>
          {/* Escritorio: los tres carriles lado a lado. */}
          <div className="hidden grid-cols-3 gap-x-4 lg:grid">
            {LANES.map((lane) => (
              <div key={lane} className="min-w-0">
                <div className="mb-2 flex h-8 items-center justify-between">
                  <h3 className="text-[13px] font-medium text-muted">
                    {LANE_LABEL[lane]} <span className="tabular text-faint">{lanes[lane].length}</span>
                  </h3>
                  {lane === "pie" && routeLink}
                </div>
                {laneList(lane)}
              </div>
            ))}
          </div>
          {agenda.length === 0 && (
            <div className="mt-4 flex flex-col gap-2 sm:flex-row">
              <ButtonLink href="/ruta" variant="primary">
                Armar la ruta de hoy
              </ButtonLink>
              <Button onClick={() => openLeadForm()}>
                <Plus size={16} strokeWidth={2} /> Nuevo prospecto
              </Button>
            </div>
          )}
        </Panel>

        <Panel className="order-3 col-span-2 lg:order-none lg:col-span-6" title="Proyectos este mes" action={<PanelLink href="/proyectos">Ver todos</PanelLink>}>
          {projects.length ? (
            <ul className="flex flex-col gap-2">
              {projects.map((p) => (
                <ProjectRow key={p.id} project={p} />
              ))}
            </ul>
          ) : (
            <Empty action={<PanelLink href="/proyectos?nuevo=1">Crear proyecto</PanelLink>}>No tienes proyectos activos.</Empty>
          )}
        </Panel>

        <Panel className="order-3 col-span-2 lg:order-none lg:col-span-6" title="Últimos contactos" action={<PanelLink href="/prospectos">Prospectos</PanelLink>}>
          {recent.length ? (
            <ul className="flex flex-col gap-2">
              {recent.map((a) => {
                const lead = allLeads.find((l) => l.id === a.leadId);
                const project = projectMap.get(a.projectId);
                return (
                  <li key={a.id}>
                    <Link
                      href={lead ? `/prospectos/${lead.id}` : "#"}
                      className="flex min-h-[68px] items-center gap-3 rounded-[16px] border border-border bg-raised px-3 py-2.5 lg:min-h-[63px] lg:rounded-[14px]"
                    >
                      <Avatar name={lead?.business ?? "?"} project={project} size={36} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[15px] font-medium lg:text-[14px]">{lead?.business ?? "Prospecto borrado"}</span>
                        <span className="block truncate text-[13px] text-muted lg:text-[12.5px]">
                          {OUTCOME_LABEL[a.outcome]} · {CHANNEL_LABEL[a.channel]}
                          {a.note && ` · ${a.note}`}
                        </span>
                      </span>
                      <span className="flex flex-none flex-col items-end">
                        {a.outcome === "venta" && a.amount > 0 && (
                          <span className="tabular text-[14px] font-medium text-positive">+{money(a.amount, settings.currency)}</span>
                        )}
                        <span className="tabular text-[12px] text-faint">{when(a.at, today)}</span>
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          ) : (
            <Empty>Cuando registres un contacto aparecerá aquí.</Empty>
          )}
        </Panel>
      </div>
    </div>
  );
}

/** El siguiente contacto, con botones grandes para hacerlo sin buscar. */
function NextUp({ lead, after, project, today }: { lead: Lead; after: Lead[]; project: Project | undefined; today: string }) {
  const channel = lead.nextAction!.channel;
  return (
    <section className="mb-4 rounded-[24px] border border-border bg-raised p-4 shadow-[0_1px_2px_rgba(0,0,0,0.04)] lg:mb-6 lg:p-5" aria-label="Siguiente contacto">
      <div className="flex items-center justify-between gap-3">
        <span className="text-[13px] font-medium text-muted">Ahora</span>
        <ProjectTag project={project} />
      </div>
      <Link href={`/prospectos/${lead.id}`} className="mt-1.5 flex items-start justify-between gap-3">
        <span className="min-w-0">
          <span className="block font-display text-[22px] leading-tight font-semibold tracking-[-0.015em]">{lead.business}</span>
          <span className="mt-1 block text-[15px] text-muted">
            {lead.nextAction!.note || CHANNEL_VERB[channel]}
            {lead.zone && ` · ${lead.zone}`}
          </span>
          <span className="mt-1 block">
            <Due date={lead.nextAction!.date} today={today} />
          </span>
        </span>
        <ChevronRight size={20} strokeWidth={1.75} className="mt-1 flex-none text-faint" />
      </Link>
      <div className="mt-4 flex gap-2">
        <ContactButton lead={lead} channel={channel} big />
        <LogButton lead={lead} channel={channel} big />
      </div>
      {after.length > 0 && (
        <p className="mt-3 truncate text-[13px] text-muted">
          Después: {after.slice(0, 2).map((l) => l.business).join(" · ")}
          {after.length > 2 && ` y ${after.length - 2} más`}
        </p>
      )}
    </section>
  );
}

function ProjectRow({ project: p }: { project: Project }) {
  const leads = useStore((s) => s.leads);
  const activities = useStore((s) => s.activities);
  const currency = useStore((s) => s.settings.currency);
  const monthPrefix = isoDay().slice(0, 7);
  const sold = activities
    .filter((a) => a.projectId === p.id && a.outcome === "venta" && isoDay(new Date(a.at)).startsWith(monthPrefix))
    .reduce((sum, a) => sum + a.amount, 0);
  const open = leads.filter((l) => l.projectId === p.id && OPEN_STAGES.includes(l.stage)).length;
  const pct = p.monthlyGoal ? Math.min(100, (sold / p.monthlyGoal) * 100) : 0;
  const hue = HUES[p.hue];
  return (
    <li>
      <Link href={`/prospectos?proyecto=${p.id}`} className="block rounded-[16px] border border-border bg-raised px-4 py-3 lg:rounded-[14px]">
        <div className="flex items-baseline justify-between gap-3">
          <span className="min-w-0 truncate text-[15px] font-medium lg:text-[14px]">{p.name}</span>
          <span className="tabular flex-none text-[15px] lg:text-[14px]">
            {money(sold, currency)}
            {p.monthlyGoal > 0 && <span className="text-faint"> / {money(p.monthlyGoal, currency)}</span>}
          </span>
        </div>
        {p.monthlyGoal > 0 && (
          <div className="mt-2 h-1.5 overflow-hidden rounded-full" style={{ background: hue.tint }}>
            <div className="h-full rounded-full" style={{ width: `${pct}%`, background: hue.ink }} />
          </div>
        )}
        <p className="mt-2 text-[13px] text-muted lg:text-[12.5px]">
          {p.owner && p.owner !== "Yo" ? `De ${p.owner} · ` : ""}
          {plural(open, "prospecto abierto", "prospectos abiertos")}
          {p.monthlyGoal === 0 && " · sin meta"}
        </p>
      </Link>
    </li>
  );
}

function Tile({ label, value, caption, tone }: { label: string; value: string; caption: string; tone?: "negative" }) {
  return (
    <div className="order-2 col-span-1 flex min-h-[100px] flex-col rounded-[20px] bg-surface lg:order-none p-3.5 lg:col-span-3 lg:min-h-[128px] lg:rounded-[22px] lg:p-4">
      <span className="text-[13px] text-muted">{label}</span>
      <span
        className={cx(
          "tabular mt-auto font-display text-[26px] leading-tight font-semibold tracking-[-0.02em] lg:text-[32px]",
          tone === "negative" && value !== "0" && "text-negative",
        )}
      >
        {value}
      </span>
      <span className="mt-0.5 truncate text-[12.5px] text-muted">{caption}</span>
    </div>
  );
}
