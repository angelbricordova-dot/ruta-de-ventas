"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { useStore } from "@/lib/store";
import { CHANNEL_LABEL, HUES, MODE_LABEL, OPEN_STAGES } from "@/lib/labels";
import { isoDay, money, month, plural } from "@/lib/format";
import { Canvas } from "@/components/Shell";
import { ProjectForm } from "@/components/ProjectForm";
import { Button, Empty, PageTitle, Pill } from "@/components/ui";

function ProjectsInner() {
  const router = useRouter();
  const params = useSearchParams();
  const projects = useStore((s) => s.projects);
  const leads = useStore((s) => s.leads);
  const activities = useStore((s) => s.activities);
  const currency = useStore((s) => s.settings.currency);
  const setScope = useStore((s) => s.setScope);
  // La hoja queda montada al cerrarse para poder animar su salida; cada apertura la reinicia.
  const [editing, setEditingState] = useState<{ id: string | null; open: boolean; n: number }>({ id: null, open: false, n: 0 });
  const setEditing = (id: string | null) => setEditingState((e) => ({ id, open: true, n: e.n + 1 }));

  useEffect(() => {
    if (params.get("nuevo")) {
      setEditing(null);
      router.replace("/proyectos");
    }
  }, [params, router]);

  const monthPrefix = isoDay().slice(0, 7);
  const sorted = [...projects].sort((a, b) => Number(a.archived) - Number(b.archived));

  return (
    <Canvas>
      <PageTitle
        title="Proyectos"
        sub="Cada proyecto tiene su ruta, sus prospectos y sus guiones."
        actions={
          <Button variant="primary" onClick={() => setEditing(null)}>
            <Plus size={16} strokeWidth={2} /> Nuevo proyecto
          </Button>
        }
      />

      {sorted.length === 0 ? (
        <Empty
          action={
            <button type="button" className="font-medium text-ink hover:underline" onClick={() => setEditing(null)}>
              Crear el primero
            </button>
          }
        >
          No tienes proyectos.
        </Empty>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {sorted.map((p) => {
            const hue = HUES[p.hue];
            const pLeads = leads.filter((l) => l.projectId === p.id);
            const open = pLeads.filter((l) => OPEN_STAGES.includes(l.stage));
            const won = pLeads.filter((l) => l.stage === "ganado").length;
            const sold = activities
              .filter((a) => a.projectId === p.id && a.outcome === "venta" && isoDay(new Date(a.at)).startsWith(monthPrefix))
              .reduce((s, a) => s + a.amount, 0);
            const pct = p.monthlyGoal ? Math.min(100, (sold / p.monthlyGoal) * 100) : 0;
            return (
              <article key={p.id} className="flex flex-col rounded-[22px] bg-surface p-5" style={p.archived ? { opacity: 0.6 } : undefined}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="flex items-center gap-2 text-[16px] font-semibold">
                      <span className="size-2.5 flex-none rounded-full" style={{ background: hue.ink }} aria-hidden />
                      <span className="truncate">{p.name}</span>
                    </h2>
                    <p className="mt-0.5 text-[13px] text-muted">
                      {p.owner && p.owner !== "Yo" ? `Produce ${p.owner}` : "Proyecto propio"} · {MODE_LABEL[p.mode]}
                    </p>
                  </div>
                  {p.archived && <Pill tone="muted">Archivado</Pill>}
                </div>

                {p.description && <p className="mt-3 text-[14px] leading-relaxed text-ink/80">{p.description}</p>}

                <dl className="mt-4 grid grid-cols-3 divide-x divide-border rounded-[14px] border border-border bg-raised">
                  {[
                    ["Abiertos", String(open.length)],
                    ["Clientes", String(won)],
                    [`En ${month()}`, money(sold, currency)],
                  ].map(([k, v]) => (
                    <div key={k} className="px-3 py-2.5">
                      <dt className="truncate text-[12px] text-muted">{k}</dt>
                      <dd className="tabular truncate text-[18px]">{v}</dd>
                    </div>
                  ))}
                </dl>

                {p.monthlyGoal > 0 && (
                  <div className="mt-3">
                    <div className="h-1.5 overflow-hidden rounded-full" style={{ background: hue.tint }}>
                      <div className="h-full rounded-full" style={{ width: `${pct}%`, background: hue.ink }} />
                    </div>
                    <p className="tabular mt-1.5 text-[12.5px] text-muted">
                      {money(sold, currency)} de {money(p.monthlyGoal, currency)} este mes
                    </p>
                  </div>
                )}

                <div className="mt-4 flex flex-col gap-2 text-[13px]">
                  <p className="text-muted">
                    <span className="text-ink">Vende: </span>
                    {p.offers.length ? p.offers.map((o) => `${o.name} (${money(o.price, currency)})`).join(", ") : "aún sin productos"}
                  </p>
                  <p className="text-muted">
                    <span className="text-ink">Canales: </span>
                    {p.channels.map((c) => CHANNEL_LABEL[c]).join(", ")}
                  </p>
                  {p.niches.length > 0 && (
                    <p className="text-muted">
                      <span className="text-ink">Rubros: </span>
                      {p.niches.join(", ")}
                    </p>
                  )}
                </div>

                <div className="mt-auto flex flex-wrap gap-2 pt-5">
                  <Button size="sm" onClick={() => setEditing(p.id)}>
                    Editar
                  </Button>
                  <Link
                    href="/prospectos"
                    onClick={() => setScope(p.id)}
                    className="press inline-flex h-8 items-center rounded-full px-3 text-[13px] font-medium hover:bg-active"
                  >
                    {plural(pLeads.length, "prospecto", "prospectos")}
                  </Link>
                  <Link
                    href="/ruta"
                    onClick={() => setScope(p.id)}
                    className="press inline-flex h-8 items-center rounded-full px-3 text-[13px] font-medium hover:bg-active"
                  >
                    Ruta
                  </Link>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {editing.n > 0 && (
        <ProjectForm
          key={editing.n}
          projectId={editing.id}
          open={editing.open}
          onClose={() => setEditingState((e) => ({ ...e, open: false }))}
        />
      )}
    </Canvas>
  );
}

export default function ProjectsPage() {
  return (
    <Suspense>
      <ProjectsInner />
    </Suspense>
  );
}
