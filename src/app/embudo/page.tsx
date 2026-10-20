"use client";

import Link from "next/link";
import { useState } from "react";
import { ChevronRight } from "lucide-react";
import { inScope, useProjectMap, useStore } from "@/lib/store";
import { CHANNEL_LABEL, STAGE_LABEL } from "@/lib/labels";
import { isoDay, money, plural, relativeDay } from "@/lib/format";
import { Canvas } from "@/components/Shell";
import { Due } from "@/components/LeadBits";
import { cx, PageTitle, ProjectDot } from "@/components/ui";
import type { Stage } from "@/lib/types";

const COLUMNS: Stage[] = ["nuevo", "contactado", "interesado", "propuesta", "ganado"];

export default function PipelinePage() {
  const scope = useStore((s) => s.scope);
  const allLeads = useStore((s) => s.leads);
  const currency = useStore((s) => s.settings.currency);
  const setStage = useStore((s) => s.setStage);
  const projectMap = useProjectMap();
  const [dragging, setDragging] = useState<string | null>(null);
  const [over, setOver] = useState<Stage | null>(null);

  const today = isoDay();
  const leads = inScope(allLeads, scope);
  const open = leads.filter((l) => l.stage !== "ganado" && l.stage !== "perdido");
  const openValue = open.reduce((s, l) => s + l.value, 0);
  const lost = leads.filter((l) => l.stage === "perdido").length;

  return (
    <Canvas>
      <PageTitle
        title="Embudo"
        sub={
          <>
            {plural(open.length, "negocio abierto", "negocios abiertos")} · {money(openValue, currency)} en juego
            {lost > 0 && (
              <>
                {" · "}
                <Link href="/prospectos?etapa=perdido" className="underline-offset-2 hover:underline">
                  {plural(lost, "descartado", "descartados")}
                </Link>
              </>
            )}
          </>
        }
      />
      <p className="-mt-4 mb-5 hidden text-[13px] text-faint md:block">Arrastra una tarjeta para cambiarla de etapa.</p>

      <div className="scroll-x -mx-4 flex snap-x snap-mandatory gap-3 px-4 pb-4 md:mx-0 md:grid md:snap-none md:grid-cols-5 md:px-0">
        {COLUMNS.map((stage) => {
          const cards = leads
            .filter((l) => l.stage === stage)
            .sort((a, b) => (a.nextAction?.date ?? "9999").localeCompare(b.nextAction?.date ?? "9999"));
          const total = cards.reduce((s, l) => s + l.value, 0);
          const nextStage = COLUMNS[COLUMNS.indexOf(stage) + 1];
          return (
            <section
              key={stage}
              onDragOver={(e) => {
                if (!dragging) return;
                e.preventDefault();
                setOver(stage);
              }}
              onDragLeave={() => setOver((s) => (s === stage ? null : s))}
              onDrop={(e) => {
                e.preventDefault();
                if (dragging) setStage(dragging, stage);
                setDragging(null);
                setOver(null);
              }}
              className={cx(
                "flex w-[78vw] max-w-[300px] flex-none snap-start flex-col rounded-[22px] bg-surface p-3 md:w-auto md:max-w-none",
                over === stage && "ring-2 ring-ink/20",
              )}
            >
              <header className="mb-2 px-1 pt-1">
                <div className="flex items-center justify-between gap-2">
                  <h2 className="text-[14px] font-semibold">{STAGE_LABEL[stage]}</h2>
                  <span className="tabular text-[12px] text-muted">{cards.length}</span>
                </div>
                <p className="tabular text-[12.5px] text-muted">{total > 0 ? money(total, currency) : "—"}</p>
              </header>
              <ul className="flex min-h-[80px] flex-col gap-2">
                {cards.map((l) => {
                  const project = projectMap.get(l.projectId);
                  return (
                    <li
                      key={l.id}
                      draggable
                      onDragStart={(e) => {
                        setDragging(l.id);
                        e.dataTransfer.effectAllowed = "move";
                      }}
                      onDragEnd={() => {
                        setDragging(null);
                        setOver(null);
                      }}
                      className={cx(
                        "group rounded-[14px] border border-border bg-raised p-3 transition-opacity md:cursor-grab",
                        dragging === l.id && "opacity-40",
                      )}
                    >
                      <div className="flex items-start gap-2">
                        <Link href={`/prospectos/${l.id}`} className="min-w-0 flex-1">
                          <span className="flex items-center gap-1.5">
                            {scope === "todos" && <ProjectDot project={project} size={7} />}
                            <span className="truncate text-[14px] font-medium">{l.business}</span>
                          </span>
                          <span className="block truncate text-[12.5px] text-muted">{[l.niche, l.zone].filter(Boolean).join(" · ") || "—"}</span>
                        </Link>
                        {nextStage && (
                          <button
                            type="button"
                            onClick={() => setStage(l.id, nextStage)}
                            className="press -mt-1 -mr-1 inline-flex size-8 flex-none items-center justify-center rounded-full text-faint hover:bg-active hover:text-ink"
                            aria-label={`Pasar a ${STAGE_LABEL[nextStage]}`}
                            title={`Pasar a ${STAGE_LABEL[nextStage]}`}
                          >
                            <ChevronRight size={16} strokeWidth={1.75} />
                          </button>
                        )}
                      </div>
                      <div className="mt-2 flex items-center justify-between gap-2">
                        <span className="min-w-0 truncate text-[12px] text-muted">
                          {l.nextAction ? (
                            <>
                              {CHANNEL_LABEL[l.nextAction.channel]}
                              {l.nextAction.date >= today && ` · ${relativeDay(l.nextAction.date, today)}`}
                            </>
                          ) : (
                            <span className="text-faint">Sin fecha</span>
                          )}
                        </span>
                        <span className="tabular flex-none text-[13px]">{l.value > 0 ? money(l.value, currency) : <span className="text-faint">—</span>}</span>
                      </div>
                      {l.nextAction && <Due date={l.nextAction.date} today={today} />}
                    </li>
                  );
                })}
                {cards.length === 0 && (
                  <li className="flex h-[60px] items-center justify-center rounded-[14px] border border-dashed border-control text-[12.5px] text-faint">
                    Vacío
                  </li>
                )}
              </ul>
            </section>
          );
        })}
      </div>
    </Canvas>
  );
}
