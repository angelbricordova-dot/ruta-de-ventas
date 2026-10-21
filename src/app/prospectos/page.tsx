"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";
import { Plus, Search, SlidersHorizontal } from "lucide-react";
import { inScope, useProjectMap, useStore } from "@/lib/store";
import { useUI } from "@/lib/ui-store";
import { CHANNEL_LABEL, OPEN_STAGES, STAGE_LABEL, STAGES } from "@/lib/labels";
import { isoDay, money, plural, relativeDay } from "@/lib/format";
import { Canvas } from "@/components/Shell";
import { Due, StagePill } from "@/components/LeadBits";
import { Avatar, Button, Chips, cx, Empty, Input, PageTitle, ProjectDot, Select } from "@/components/ui";
import type { Stage } from "@/lib/types";

type StageFilter = "abiertos" | "todos" | Stage;

function ProspectsInner() {
  const router = useRouter();
  const params = useSearchParams();
  const scope = useStore((s) => s.scope);
  const setScope = useStore((s) => s.setScope);
  const allLeads = useStore((s) => s.leads);
  const currency = useStore((s) => s.settings.currency);
  const openLeadForm = useUI((s) => s.openLeadForm);
  const projectMap = useProjectMap();

  const [q, setQ] = useState("");
  const [stage, setStage] = useState<StageFilter>((params.get("etapa") as StageFilter) || "abiertos");
  const [niche, setNiche] = useState("");
  const [zone, setZone] = useState("");
  const [showFilters, setShowFilters] = useState(false);

  // ?proyecto=… llega desde la pantalla de inicio o de proyectos.
  useEffect(() => {
    const p = params.get("proyecto");
    if (p && projectMap.has(p) && p !== scope) setScope(p);
    if (p) router.replace("/prospectos");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const today = isoDay();
  const scoped = inScope(allLeads, scope);
  const niches = useMemo(() => [...new Set(scoped.map((l) => l.niche).filter(Boolean))].sort(), [scoped]);
  const zones = useMemo(() => [...new Set(scoped.map((l) => l.zone).filter(Boolean))].sort(), [scoped]);

  const needle = q.trim().toLowerCase();
  const rows = scoped
    .filter((l) => (stage === "todos" ? true : stage === "abiertos" ? OPEN_STAGES.includes(l.stage) : l.stage === stage))
    .filter((l) => !niche || l.niche === niche)
    .filter((l) => !zone || l.zone === zone)
    .filter(
      (l) =>
        !needle ||
        [l.business, l.contactName, l.niche, l.zone, l.phone, l.instagram, l.notes].some((f) => f.toLowerCase().includes(needle)),
    )
    .sort((a, b) => {
      const da = a.nextAction?.date ?? "9999";
      const db = b.nextAction?.date ?? "9999";
      return da.localeCompare(db) || b.updatedAt.localeCompare(a.updatedAt);
    });

  const countFor = (s: StageFilter) =>
    scoped.filter((l) => (s === "todos" ? true : s === "abiertos" ? OPEN_STAGES.includes(l.stage) : l.stage === s)).length;
  const toContact = scoped.filter((l) => l.stage === "nuevo").length;

  return (
    <Canvas>
      <PageTitle
        title="Prospectos"
        sub={`${plural(scoped.length, "negocio", "negocios")} · ${toContact} por contactar`}
        actions={
          <Button variant="primary" onClick={() => openLeadForm()} className="max-lg:hidden">
            <Plus size={16} strokeWidth={2} /> Nuevo prospecto
          </Button>
        }
      />

      <div className="mb-4 flex flex-col gap-3">
        <div className="flex flex-wrap gap-2">
          <label className="relative min-w-0 flex-1 md:max-w-[320px]">
            <Search size={16} strokeWidth={1.75} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-faint" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar negocio, persona, teléfono…" className="pl-9" aria-label="Buscar" />
          </label>
          <button
            type="button"
            onClick={() => setShowFilters((v) => !v)}
            aria-expanded={showFilters}
            aria-label="Filtros"
            className={cx(
              "press relative inline-flex size-11 flex-none items-center justify-center rounded-full md:hidden",
              showFilters || niche || zone ? "bg-ink text-white" : "bg-active text-ink",
            )}
          >
            <SlidersHorizontal size={18} strokeWidth={1.75} />
          </button>
          <div className={cx("w-full gap-2 md:flex md:w-auto", showFilters ? "flex" : "hidden")}>
          <Select value={niche} onChange={(e) => setNiche(e.target.value)} aria-label="Rubro" className="min-w-0 flex-1 md:w-[190px] md:flex-none">
            <option value="">Todos los rubros</option>
            {niches.map((n) => (
              <option key={n}>{n}</option>
            ))}
          </Select>
          <Select value={zone} onChange={(e) => setZone(e.target.value)} aria-label="Zona" className="min-w-0 flex-1 md:w-[170px] md:flex-none">
            <option value="">Todas las zonas</option>
            {zones.map((z) => (
              <option key={z}>{z}</option>
            ))}
          </Select>
          </div>
        </div>
        <Chips
          label="Etapa"
          value={stage}
          onChange={setStage}
          options={(["abiertos", "todos", ...STAGES] as StageFilter[]).map((s) => ({
            value: s,
            label: (
              <>
                {s === "abiertos" ? "Abiertos" : s === "todos" ? "Todos" : STAGE_LABEL[s]}{" "}
                <span className="tabular opacity-60">{countFor(s)}</span>
              </>
            ),
          }))}
        />
      </div>

      {rows.length === 0 ? (
        <Empty
          action={
            <button type="button" className="font-medium text-ink hover:underline" onClick={() => openLeadForm()}>
              Agregar prospecto
            </button>
          }
        >
          {scoped.length === 0 ? "Todavía no tienes prospectos en este proyecto." : "Ningún prospecto coincide con estos filtros."}
        </Empty>
      ) : (
        <div>
          <table className="w-full table-fixed border-collapse text-left">
            <thead className="hidden md:table-header-group">
              <tr className="h-10 border-b border-border text-[12px] text-muted">
                <th className="w-[36%] font-normal">Negocio</th>
                <th className="hidden w-[16%] font-normal lg:table-cell">Rubro</th>
                <th className="w-[12%] font-normal">Zona</th>
                <th className="w-[15%] font-normal">Etapa</th>
                <th className="w-[15%] font-normal">Próximo contacto</th>
                <th className="w-[10%] text-right font-normal">Valor</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((l) => {
                const project = projectMap.get(l.projectId);
                return (
                  <tr
                    key={l.id}
                    onClick={() => router.push(`/prospectos/${l.id}`)}
                    className="cursor-pointer border-b border-rule last:border-0 active:bg-surface md:hover:bg-[#fafaf8]"
                  >
                    <td className="py-3 pr-3 md:py-2.5">
                      <div className="flex items-center gap-3">
                        <Avatar name={l.business} project={project} size={36} />
                        <div className="min-w-0 flex-1">
                          <Link href={`/prospectos/${l.id}`} className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                            <span className="truncate text-[14px] font-medium">{l.business}</span>
                            {scope === "todos" && <ProjectDot project={project} size={7} />}
                          </Link>
                          <span className="block truncate text-[12.5px] text-muted">
                            <span className="md:hidden">{[l.niche, l.zone].filter(Boolean).join(" · ") || "—"}</span>
                            <span className="hidden md:inline">{l.contactName || <span className="text-faint">Sin contacto</span>}</span>
                          </span>
                          <span className="mt-1.5 flex flex-wrap items-center gap-2 md:hidden">
                            <StagePill lead={l} />
                            {l.nextAction &&
                              (l.nextAction.date < today ? (
                                <Due date={l.nextAction.date} today={today} />
                              ) : (
                                <span className="text-[13px] text-muted">
                                  {CHANNEL_LABEL[l.nextAction.channel]} · {relativeDay(l.nextAction.date, today)}
                                </span>
                              ))}
                          </span>
                        </div>
                        {l.value > 0 && <span className="tabular self-start text-[14px] md:hidden">{money(l.value, currency)}</span>}
                      </div>
                    </td>
                    <td className="hidden truncate pr-3 text-[13px] text-muted lg:table-cell">{l.niche || "—"}</td>
                    <td className="hidden truncate pr-3 text-[13px] text-muted md:table-cell">{l.zone || "—"}</td>
                    <td className="hidden pr-3 md:table-cell">
                      <StagePill lead={l} />
                    </td>
                    <td className="hidden pr-3 md:table-cell">
                      {l.nextAction ? (
                        <span className="flex flex-col">
                          <span className="text-[13px]">
                            {CHANNEL_LABEL[l.nextAction.channel]}
                            {l.nextAction.date >= today && ` · ${relativeDay(l.nextAction.date, today)}`}
                          </span>
                          <Due date={l.nextAction.date} today={today} />
                        </span>
                      ) : (
                        <span className="text-faint">—</span>
                      )}
                    </td>
                    <td className="tabular hidden text-right text-[14px] md:table-cell">
                      {l.value > 0 ? money(l.value, currency) : <span className="text-faint">—</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {rows.length > 0 && (
        <p className="mt-3 text-[12.5px] text-faint">
          Mostrando {rows.length} de {scoped.length}
        </p>
      )}
    </Canvas>
  );
}

export default function ProspectsPage() {
  return (
    <Suspense>
      <ProspectsInner />
    </Suspense>
  );
}
