"use client";

import { useState } from "react";
import { Copy, Plus } from "lucide-react";
import { inScope, useProjectMap, useStore } from "@/lib/store";
import { CHANNEL_LABEL, CHANNELS } from "@/lib/labels";
import { fillScript } from "@/lib/links";
import { Canvas } from "@/components/Shell";
import { Button, Empty, Field, Input, PageTitle, Panel, ProjectTag, Select, Sheet, Textarea } from "@/components/ui";
import type { Channel, Script } from "@/lib/types";

const VARS = ["{negocio}", "{contacto}", "{rubro}", "{zona}", "{vendedor}"];

function ScriptForm({ script, onClose }: { script: Script | null; onClose: () => void }) {
  const projects = useStore((s) => s.projects);
  const scope = useStore((s) => s.scope);
  const saveScript = useStore((s) => s.saveScript);
  const deleteScript = useStore((s) => s.deleteScript);
  const [draft, setDraft] = useState<Omit<Script, "id">>(
    script ?? { projectId: scope !== "todos" ? scope : (projects[0]?.id ?? null), channel: "llamada", title: "", body: "" },
  );
  const [error, setError] = useState("");

  const submit = () => {
    if (!draft.title.trim() || !draft.body.trim()) return setError("Ponle título y texto al guion.");
    saveScript({ ...draft, id: script?.id });
    onClose();
  };

  return (
    <Sheet
      open
      onClose={onClose}
      wide
      title={script ? "Editar guion" : "Nuevo guion"}
      footer={
        <>
          {script && (
            <Button
              variant="danger"
              className="mr-auto"
              onClick={() => {
                deleteScript(script.id);
                onClose();
              }}
            >
              Borrar
            </Button>
          )}
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button variant="primary" onClick={submit}>
            Guardar
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <Field label="Título">
          {(id) => <Input id={id} value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} placeholder="Ej. Llamada en frío a gimnasios" />}
        </Field>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Proyecto">
            {(id) => (
              <Select id={id} value={draft.projectId ?? ""} onChange={(e) => setDraft({ ...draft, projectId: e.target.value || null })}>
                <option value="">Para cualquier proyecto</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label="Canal">
            {(id) => (
              <Select id={id} value={draft.channel} onChange={(e) => setDraft({ ...draft, channel: e.target.value as Channel })}>
                {CHANNELS.map((c) => (
                  <option key={c} value={c}>
                    {CHANNEL_LABEL[c]}
                  </option>
                ))}
              </Select>
            )}
          </Field>
        </div>
        <Field label="Texto" hint={`Se rellenan solas: ${VARS.join(" ")}`}>
          {(id) => (
            <Textarea id={id} value={draft.body} onChange={(e) => setDraft({ ...draft, body: e.target.value })} className="min-h-[220px]" />
          )}
        </Field>
        {error && (
          <p role="alert" className="text-[13px] text-negative">
            {error}
          </p>
        )}
      </div>
    </Sheet>
  );
}

export default function ScriptsPage() {
  const scope = useStore((s) => s.scope);
  const all = useStore((s) => s.scripts);
  const seller = useStore((s) => s.settings.sellerName);
  const projectMap = useProjectMap();
  const [editing, setEditing] = useState<Script | null | undefined>(undefined);
  const [copied, setCopied] = useState<string | null>(null);

  const scripts =
    scope === "todos" ? all : [...inScope(all.filter((s) => s.projectId) as (Script & { projectId: string })[], scope), ...all.filter((s) => !s.projectId)];
  const groups = new Map<string, Script[]>();
  scripts.forEach((s) => {
    const k = s.projectId ?? "";
    groups.set(k, [...(groups.get(k) ?? []), s]);
  });

  const copy = async (s: Script) => {
    try {
      await navigator.clipboard.writeText(fillScript(s.body, null, seller));
      setCopied(s.id);
      setTimeout(() => setCopied((c) => (c === s.id ? null : c)), 1600);
    } catch {
      /* portapapeles bloqueado */
    }
  };

  return (
    <Canvas>
      <PageTitle
        title="Guiones"
        sub="Lo que digo en cada llamada, visita o DM. En la ficha de cada prospecto salen con su nombre ya puesto."
        actions={
          <Button variant="primary" onClick={() => setEditing(null)}>
            <Plus size={16} strokeWidth={2} /> Nuevo guion
          </Button>
        }
      />

      {groups.size === 0 ? (
        <Empty
          action={
            <button type="button" className="font-medium text-ink hover:underline" onClick={() => setEditing(null)}>
              Escribir uno
            </button>
          }
        >
          No hay guiones en este proyecto.
        </Empty>
      ) : (
        <div className="flex flex-col gap-10">
          {[...groups.entries()].map(([pid, list]) => (
            <Panel key={pid} title={pid ? <ProjectTag project={projectMap.get(pid)} /> : "Para cualquier proyecto"} count={list.length}>
              <ul className="grid grid-cols-1 gap-2 lg:grid-cols-2">
                {list.map((s) => (
                  <li key={s.id} className="flex flex-col rounded-[14px] border border-border bg-raised p-4">
                    <div className="flex items-baseline justify-between gap-3">
                      <h3 className="truncate text-[14px] font-medium">{s.title}</h3>
                      <span className="flex-none text-[12.5px] text-muted">{CHANNEL_LABEL[s.channel]}</span>
                    </div>
                    <p className="mt-2 line-clamp-4 text-[13.5px] leading-relaxed whitespace-pre-line text-muted">{s.body}</p>
                    <div className="mt-auto flex gap-2 pt-3">
                      <Button size="sm" onClick={() => copy(s)}>
                        <Copy size={14} strokeWidth={1.75} /> {copied === s.id ? "Copiado" : "Copiar"}
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setEditing(s)}>
                        Editar
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            </Panel>
          ))}
        </div>
      )}

      {editing !== undefined && <ScriptForm script={editing} onClose={() => setEditing(undefined)} />}
    </Canvas>
  );
}
