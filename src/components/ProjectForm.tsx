"use client";

import { useState } from "react";
import { Check, Plus, X } from "lucide-react";
import { useStore } from "@/lib/store";
import { CHANNEL_LABEL, CHANNELS, HUES, MODE_LABEL, NICHES } from "@/lib/labels";
import { uid } from "@/lib/format";
import type { Channel, HueKey, Offer, Project, ProjectMode } from "@/lib/types";
import { Button, Chips, cx, Field, Input, Sheet, Textarea } from "./ui";

type Draft = Omit<Project, "id" | "createdAt">;

const MODE_CHANNELS: Record<ProjectMode, Channel[]> = {
  digital: ["llamada", "whatsapp", "dm", "email"],
  presencial: ["visita", "llamada", "whatsapp"],
  mixto: ["visita", "llamada", "whatsapp", "dm"],
};

export function ProjectForm({ projectId, open, onClose }: { projectId: string | null; open: boolean; onClose: () => void }) {
  const projects = useStore((s) => s.projects);
  const leadCount = useStore((s) => s.leads.filter((l) => l.projectId === projectId).length);
  const saveProject = useStore((s) => s.saveProject);
  const deleteProject = useStore((s) => s.deleteProject);
  const existing = projects.find((p) => p.id === projectId);

  const usedHues = new Set(projects.map((p) => p.hue));
  const [draft, setDraft] = useState<Draft>(() => {
    if (existing) {
      const { id: _i, createdAt: _c, ...rest } = existing;
      return rest;
    }
    const hue = (Object.keys(HUES) as HueKey[]).find((h) => !usedHues.has(h)) ?? "pizarra";
    return {
      name: "",
      owner: "Yo",
      description: "",
      hue,
      mode: "mixto",
      channels: MODE_CHANNELS.mixto,
      offers: [],
      niches: [],
      monthlyGoal: 0,
      archived: false,
    };
  });
  const [customNiche, setCustomNiche] = useState("");
  const [error, setError] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);

  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setDraft((d) => ({ ...d, [k]: v }));
  const toggle = <T,>(list: T[], item: T) => (list.includes(item) ? list.filter((x) => x !== item) : [...list, item]);
  const setOffer = (id: string, patch: Partial<Offer>) =>
    set("offers", draft.offers.map((o) => (o.id === id ? { ...o, ...patch } : o)));

  const submit = () => {
    if (!draft.name.trim()) return setError("Ponle un nombre al proyecto.");
    if (draft.channels.length === 0) return setError("Elige al menos un canal de venta.");
    saveProject({
      ...draft,
      id: existing?.id,
      name: draft.name.trim(),
      offers: draft.offers.filter((o) => o.name.trim()),
    });
    onClose();
  };

  const allNiches = [...new Set([...NICHES, ...draft.niches])];

  return (
    <Sheet
      open={open}
      onClose={onClose}
      wide
      title={existing ? "Editar proyecto" : "Nuevo proyecto"}
      footer={
        <>
          {existing &&
            (confirmDelete ? (
              <Button
                variant="danger"
                className="mr-auto"
                onClick={() => {
                  deleteProject(existing.id);
                  onClose();
                }}
              >
                Borrar con {leadCount} prospectos
              </Button>
            ) : (
              <Button variant="danger" className="mr-auto" onClick={() => setConfirmDelete(true)}>
                Borrar
              </Button>
            ))}
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button variant="primary" onClick={submit}>
            {existing ? "Guardar" : "Crear proyecto"}
          </Button>
        </>
      }
    >
      <form
        className="flex flex-col gap-5"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-[1fr_180px]">
          <Field label="Nombre">
            {(id) => (
              <Input
                id={id}
                value={draft.name}
                onChange={(e) => {
                  set("name", e.target.value);
                  setError("");
                }}
                placeholder="Ej. Apps y webs, Jabones…"
              />
            )}
          </Field>
          <Field label="Quién lo produce">
            {(id) => <Input id={id} value={draft.owner} onChange={(e) => set("owner", e.target.value)} placeholder="Yo, Luis Enrique…" />}
          </Field>
        </div>

        <Field label="De qué se trata">
          {(id) => (
            <Textarea
              id={id}
              value={draft.description}
              onChange={(e) => set("description", e.target.value)}
              placeholder="Qué vendo, a quién y cómo"
              className="min-h-[72px]"
            />
          )}
        </Field>

        <div className="flex flex-col gap-2">
          <span className="text-[13px] font-medium text-muted">Color</span>
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Color">
            {(Object.keys(HUES) as HueKey[]).map((h) => (
              <button
                key={h}
                type="button"
                role="radio"
                aria-checked={draft.hue === h}
                aria-label={HUES[h].label}
                title={HUES[h].label}
                onClick={() => set("hue", h)}
                className={cx(
                  "press inline-flex size-10 items-center justify-center rounded-full",
                  draft.hue === h ? "ring-2 ring-ink ring-offset-2" : "ring-1 ring-border",
                )}
                style={{ background: HUES[h].tint }}
              >
                <span className="size-4 rounded-full" style={{ background: HUES[h].ink }} />
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <span className="text-[13px] font-medium text-muted">Cómo se vende</span>
          <Chips
            label="Modalidad"
            value={draft.mode}
            onChange={(m) => setDraft((d) => ({ ...d, mode: m, channels: MODE_CHANNELS[m] }))}
            options={(Object.keys(MODE_LABEL) as ProjectMode[]).map((m) => ({
              value: m,
              label: m === "presencial" ? "Presencial (en persona)" : m === "digital" ? "Digital (llamadas y mensajes)" : "Mixto",
            }))}
          />
          <div className="mt-1 flex flex-wrap gap-1.5">
            {CHANNELS.map((c) => {
              const on = draft.channels.includes(c);
              return (
                <button
                  key={c}
                  type="button"
                  aria-pressed={on}
                  onClick={() => set("channels", toggle(draft.channels, c))}
                  className={cx(
                    "press inline-flex h-8 items-center gap-1 rounded-full border px-3 text-[13px] font-medium",
                    on ? "border-ink bg-raised text-ink" : "border-dashed border-control text-faint hover:text-ink",
                  )}
                >
                  {on ? <Check size={14} strokeWidth={2} /> : <Plus size={14} strokeWidth={1.75} />}
                  {CHANNEL_LABEL[c]}
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <span className="text-[13px] font-medium text-muted">Qué vendo y a qué precio</span>
          {draft.offers.map((o) => (
            <div key={o.id} className="flex items-center gap-2">
              <Input value={o.name} onChange={(e) => setOffer(o.id, { name: e.target.value })} placeholder="Producto o servicio" aria-label="Producto o servicio" />
              <Input
                type="number"
                inputMode="decimal"
                min={0}
                value={o.price || ""}
                onChange={(e) => setOffer(o.id, { price: Number(e.target.value) || 0 })}
                placeholder="Precio"
                aria-label="Precio"
                className="tabular w-[110px] flex-none"
              />
              <button
                type="button"
                onClick={() => set("offers", draft.offers.filter((x) => x.id !== o.id))}
                className="press inline-flex size-10 flex-none items-center justify-center rounded-full text-faint hover:bg-active hover:text-ink"
                aria-label="Quitar"
              >
                <X size={16} strokeWidth={1.75} />
              </button>
            </div>
          ))}
          <Button size="sm" className="self-start" onClick={() => set("offers", [...draft.offers, { id: uid(), name: "", price: 0 }])}>
            <Plus size={14} strokeWidth={2} /> Agregar producto o servicio
          </Button>
        </div>

        <div className="flex flex-col gap-2">
          <span className="text-[13px] font-medium text-muted">A qué rubros apunto</span>
          <div className="flex flex-wrap gap-1.5">
            {allNiches.map((n) => {
              const on = draft.niches.includes(n);
              return (
                <button
                  key={n}
                  type="button"
                  aria-pressed={on}
                  onClick={() => set("niches", toggle(draft.niches, n))}
                  className={cx(
                    "press h-8 rounded-full border px-3 text-[13px]",
                    on ? "border-ink bg-ink font-medium text-white" : "border-border bg-raised text-muted hover:text-ink",
                  )}
                >
                  {n}
                </button>
              );
            })}
          </div>
          <div className="flex gap-2">
            <Input
              value={customNiche}
              onChange={(e) => setCustomNiche(e.target.value)}
              placeholder="Otro rubro"
              aria-label="Otro rubro"
              onKeyDown={(e) => {
                if (e.key === "Enter" && customNiche.trim()) {
                  e.preventDefault();
                  set("niches", [...new Set([...draft.niches, customNiche.trim()])]);
                  setCustomNiche("");
                }
              }}
            />
            <Button
              disabled={!customNiche.trim()}
              onClick={() => {
                set("niches", [...new Set([...draft.niches, customNiche.trim()])]);
                setCustomNiche("");
              }}
            >
              Agregar
            </Button>
          </div>
        </div>

        <Field label="Meta de ventas por mes" hint="Lo que quieres cerrar cada mes en este proyecto. Déjalo en 0 si aún no tienes meta.">
          {(id) => (
            <Input
              id={id}
              type="number"
              inputMode="decimal"
              min={0}
              value={draft.monthlyGoal || ""}
              onChange={(e) => set("monthlyGoal", Number(e.target.value) || 0)}
              placeholder="0"
              className="tabular sm:w-[200px]"
            />
          )}
        </Field>

        {existing && (
          <label className="flex items-center gap-3 text-[14px]">
            <input type="checkbox" checked={draft.archived} onChange={(e) => set("archived", e.target.checked)} className="size-4 accent-[#1f201d]" />
            Archivar (se oculta de la ruta y del inicio)
          </label>
        )}

        {error && (
          <p role="alert" className="text-[13px] text-negative">
            {error}
          </p>
        )}
        <button type="submit" hidden />
      </form>
    </Sheet>
  );
}
