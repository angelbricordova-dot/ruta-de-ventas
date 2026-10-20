"use client";

import Link from "next/link";
import { ArrowUpRight, Plus } from "lucide-react";
import { agendaFor, inScope, useProjectMap, useStore } from "@/lib/store";
import { useUI } from "@/lib/ui-store";
import { CHANNEL_LABEL, HUES, LANE_LABEL, LANE_OF, OPEN_STAGES, OUTCOME_LABEL, type Lane } from "@/lib/labels";
import { greeting, isoDay, longDay, money, month, plural, when } from "@/lib/format";
import { walkingRoute } from "@/lib/links";
import { AgendaRow } from "@/components/LeadBits";
import { Avatar, Button, ButtonLink, cx, Empty, Panel, PanelLink } from "@/components/ui";
import type { Lead } from "@/lib/types";

const LANES: Lane[] = ["pie", "telefono", "mensajes"];

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

  const today = isoDay();
  const now = new Date();
  const monthPrefix = today.slice(0, 7);
  const leads = inScope(allLeads, scope);
  const activities = inScope(allActivities, scope);
  const projects = allProjects.filter((p) => !p.archived && (scope === "todos" || p.id === scope));
  const hasDemo = allLeads.some((l) => l.demo);

  const agenda = agendaFor(leads, today, true);
  const overdue = agenda.filter((l) => l.nextAction!.date < today);
  const byLane = (lane: Lane) =>
    agenda
      .filter((l) => LANE_OF[l.nextAction!.channel] === lane)
      .sort((a, b) =>
        lane === "pie" ? a.routeOrder - b.routeOrder : a.nextAction!.date.localeCompare(b.nextAction!.date),
      );
  const lanes = Object.fromEntries(LANES.map((l) => [l, byLane(l)])) as Record<Lane, Lead[]>;

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

  return (
    <div className="mx-auto w-full max-w-[1132px] px-4 pt-7 md:px-8 lg:pt-[72px]">
      {/* Saludo: el h1 dice el hecho del día. */}
      <header className="mb-8 md:mb-[50px]">
        <h1 className="font-serif text-[34px] leading-[1.05] tracking-[-0.01em] text-balance md:text-[48px]">
          {greeting(now)}, {first}. <span className="text-muted">{headline}</span>
        </h1>
        <p className="mt-3 text-[14px] text-muted">
          {longDay(today)}
          {overdue.length > 0 && (
            <>
              {" · "}
              <span className="font-medium text-negative">
                {plural(overdue.length, "seguimiento vencido", "seguimientos vencidos")}
              </span>
              , empieza por ahí
            </>
          )}
        </p>
      </header>

      {hasDemo && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-[14px] border border-[#f3dfa6] bg-[#fffaeb] px-4 py-2.5 text-[13px] text-[#7c3a0b]">
          <span>Estás viendo prospectos de ejemplo para probar la app. Tus proyectos y guiones se quedan.</span>
          <button type="button" onClick={clearDemo} className="font-semibold underline-offset-2 hover:underline">
            Borrar ejemplos y empezar
          </button>
        </div>
      )}

      {/* 12 columnas, 16px de separación: 3/3/3/3, luego 12 (la ruta), luego 6/6. */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-12">
        <Tile
          label="Para hoy"
          value={String(agenda.length)}
          caption={doneToday.length ? `${plural(doneToday.length, "contacto registrado", "contactos registrados")} hoy` : "Aún no registras ninguno"}
        />
        <Tile
          label="Vencidos"
          value={String(overdue.length)}
          tone={overdue.length ? "negative" : undefined}
          caption={overdue.length ? "Atrasados de días anteriores" : "Todo al día"}
        />
        <Tile
          label="Propuestas abiertas"
          value={money(proposalValue, settings.currency)}
          caption={proposals.length ? `${plural(proposals.length, "negocio espera", "negocios esperan")} respuesta` : "Ninguna enviada"}
        />
        <Tile
          label={`Cerrado en ${month(now)}`}
          value={money(closed, settings.currency)}
          caption={
            goal
              ? `${plural(salesThisMonth.length, "venta", "ventas")} · meta ${money(goal, settings.currency)}`
              : plural(salesThisMonth.length, "venta", "ventas")
          }
        />

        <Panel
          className="col-span-2 md:col-span-12"
          title="Ruta de hoy"
          count={agenda.length}
          action={
            <div className="flex items-center gap-3">
              <PanelLink href="/ruta">Planificar</PanelLink>
            </div>
          }
        >
          <div className="grid grid-cols-1 gap-x-4 gap-y-6 lg:grid-cols-3">
            {LANES.map((lane) => (
              <div key={lane} className="min-w-0">
                <div className="mb-2 flex h-8 items-center justify-between">
                  <h3 className="text-[13px] font-medium text-muted">
                    {LANE_LABEL[lane]} <span className="tabular text-faint">{lanes[lane].length}</span>
                  </h3>
                  {lane === "pie" && route && lanes.pie.length > 0 && (
                    <a
                      href={route}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-[13px] font-medium text-accent hover:underline"
                    >
                      Abrir ruta en Maps <ArrowUpRight size={14} strokeWidth={1.75} />
                    </a>
                  )}
                </div>
                {lanes[lane].length ? (
                  <ol className="flex flex-col gap-2">
                    {lanes[lane].map((lead, i) => (
                      <AgendaRow
                        key={lead.id}
                        lead={lead}
                        project={projectMap.get(lead.projectId)}
                        today={today}
                        order={lane === "pie" ? i + 1 : undefined}
                      />
                    ))}
                  </ol>
                ) : (
                  <Empty>{lane === "pie" ? "Ninguna visita hoy." : lane === "telefono" ? "Ninguna llamada hoy." : "Ningún mensaje hoy."}</Empty>
                )}
              </div>
            ))}
          </div>
          {agenda.length === 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              <ButtonLink href="/ruta" variant="primary">
                Armar la ruta de hoy
              </ButtonLink>
              <Button onClick={() => openLeadForm()}>
                <Plus size={16} strokeWidth={2} /> Nuevo prospecto
              </Button>
            </div>
          )}
        </Panel>

        <Panel className="col-span-2 md:col-span-6" title="Proyectos este mes" action={<PanelLink href="/proyectos">Ver todos</PanelLink>}>
          {projects.length ? (
            <ul className="flex flex-col gap-2">
              {projects.map((p) => {
                const pLeads = allLeads.filter((l) => l.projectId === p.id);
                const sold = allActivities
                  .filter((a) => a.projectId === p.id && a.outcome === "venta" && isoDay(new Date(a.at)).startsWith(monthPrefix))
                  .reduce((sum, a) => sum + a.amount, 0);
                const open = pLeads.filter((l) => OPEN_STAGES.includes(l.stage)).length;
                const pct = p.monthlyGoal ? Math.min(100, (sold / p.monthlyGoal) * 100) : 0;
                const hue = HUES[p.hue];
                return (
                  <li key={p.id} className="rounded-[14px] border border-border bg-raised px-4 py-3">
                    <div className="flex items-baseline justify-between gap-3">
                      <Link href={`/prospectos?proyecto=${p.id}`} className="min-w-0 truncate text-[14px] font-medium hover:underline">
                        {p.name}
                      </Link>
                      <span className="tabular flex-none text-[14px]">
                        {money(sold, settings.currency)}
                        {p.monthlyGoal > 0 && <span className="text-faint"> / {money(p.monthlyGoal, settings.currency)}</span>}
                      </span>
                    </div>
                    {p.monthlyGoal > 0 && (
                      <div className="mt-2 h-1.5 overflow-hidden rounded-full" style={{ background: hue.tint }}>
                        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: hue.ink }} />
                      </div>
                    )}
                    <p className="mt-2 text-[12.5px] text-muted">
                      {p.owner && p.owner !== "Yo" ? `De ${p.owner} · ` : ""}
                      {plural(open, "prospecto abierto", "prospectos abiertos")}
                      {p.monthlyGoal === 0 && " · sin meta mensual"}
                    </p>
                  </li>
                );
              })}
            </ul>
          ) : (
            <Empty action={<PanelLink href="/proyectos?nuevo=1">Crear proyecto</PanelLink>}>No tienes proyectos activos.</Empty>
          )}
        </Panel>

        <Panel className="col-span-2 md:col-span-6" title="Últimos contactos" action={<PanelLink href="/prospectos">Prospectos</PanelLink>}>
          {recent.length ? (
            <ul className="flex flex-col gap-2">
              {recent.map((a) => {
                const lead = allLeads.find((l) => l.id === a.leadId);
                const project = projectMap.get(a.projectId);
                return (
                  <li key={a.id} className="flex min-h-[63px] items-center gap-3 rounded-[14px] border border-border bg-raised px-3 py-2.5">
                    <Avatar name={lead?.business ?? "?"} project={project} size={32} />
                    <Link href={lead ? `/prospectos/${lead.id}` : "#"} className="min-w-0 flex-1">
                      <span className="block truncate text-[14px] font-medium">{lead?.business ?? "Prospecto borrado"}</span>
                      <span className="block truncate text-[12.5px] text-muted">
                        {OUTCOME_LABEL[a.outcome]} · {CHANNEL_LABEL[a.channel]}
                        {a.note && ` · ${a.note}`}
                      </span>
                    </Link>
                    <span className="flex flex-none flex-col items-end">
                      {a.outcome === "venta" && a.amount > 0 && (
                        <span className="tabular text-[14px] font-medium text-positive">+{money(a.amount, settings.currency)}</span>
                      )}
                      <span className="tabular text-[12px] text-faint">{when(a.at, today)}</span>
                    </span>
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

function Tile({ label, value, caption, tone }: { label: string; value: string; caption: string; tone?: "negative" }) {
  return (
    <div className="col-span-1 flex min-h-[112px] flex-col rounded-[22px] bg-surface p-4 md:col-span-3 md:min-h-[128px]">
      <span className="text-[13px] text-muted">{label}</span>
      <span className={cx("tabular mt-auto text-[26px] leading-tight md:text-[32px]", tone === "negative" && value !== "0" && "text-negative")}>
        {value}
      </span>
      <span className="mt-1 line-clamp-2 text-[12.5px] leading-snug text-muted md:truncate">{caption}</span>
    </div>
  );
}
