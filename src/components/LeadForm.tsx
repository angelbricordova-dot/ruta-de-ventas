"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { useStore } from "@/lib/store";
import { useUI } from "@/lib/ui-store";
import { CHANNEL_LABEL, NICHES, STAGE_LABEL, STAGES } from "@/lib/labels";
import { addDays, isoDay } from "@/lib/format";
import type { Channel, Lead, Stage } from "@/lib/types";
import { Button, Chips, Field, Input, Select, Sheet, Textarea } from "./ui";

type Draft = Omit<Lead, "id" | "createdAt" | "updatedAt" | "routeOrder">;

export function LeadForm() {
  const router = useRouter();
  const { leadId, defaults, open } = useUI((s) => s.leadForm);
  const close = useUI((s) => s.closeLeadForm);
  const projects = useStore((s) => s.projects);
  const leads = useStore((s) => s.leads);
  const scope = useStore((s) => s.scope);
  const saveLead = useStore((s) => s.saveLead);
  const deleteLead = useStore((s) => s.deleteLead);
  const existing = leads.find((l) => l.id === leadId);
  const active = projects.filter((p) => !p.archived);

  const [draft, setDraft] = useState<Draft>(() => {
    if (existing) {
      const { id: _id, createdAt: _c, updatedAt: _u, routeOrder: _r, ...rest } = existing;
      return rest;
    }
    const projectId = defaults.projectId ?? (scope !== "todos" ? scope : active[0]?.id ?? "");
    const project = projects.find((p) => p.id === projectId);
    return {
      projectId,
      business: "",
      niche: "",
      contactName: "",
      phone: "",
      instagram: "",
      email: "",
      address: "",
      zone: "",
      stage: "nuevo",
      value: 0,
      offerId: null,
      nextAction: { channel: project?.channels[0] ?? "visita", date: isoDay(), note: "" },
      notes: "",
      ...defaults,
    };
  });
  const [error, setError] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);

  const project = projects.find((p) => p.id === draft.projectId);
  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => setDraft((d) => ({ ...d, [key]: value }));

  const zones = useMemo(() => [...new Set(leads.map((l) => l.zone).filter(Boolean))].sort(), [leads]);
  const niches = useMemo(() => [...new Set([...(project?.niches ?? []), ...NICHES])], [project]);
  const channels: Channel[] = project?.channels.length ? project.channels : ["visita", "llamada", "whatsapp", "dm", "email"];

  const today = isoDay();
  const quickDates = [
    { value: today, label: "Hoy" },
    { value: addDays(today, 1), label: "Mañana" },
    { value: addDays(today, 3), label: "En 3 días" },
    { value: addDays(today, 7), label: "En una semana" },
  ];
  const quick = quickDates.find((q) => q.value === draft.nextAction?.date)?.value ?? "otra";

  const submit = () => {
    if (!draft.business.trim()) return setError("Escribe el nombre del negocio.");
    if (!draft.projectId) return setError("Elige un proyecto. Si no tienes ninguno, créalo en Proyectos.");
    const id = saveLead({ ...draft, id: existing?.id, business: draft.business.trim() });
    close();
    if (!existing) router.push(`/prospectos/${id}`);
  };

  return (
    <Sheet
      open={open}
      onClose={close}
      wide
      title={existing ? "Editar prospecto" : "Nuevo prospecto"}
      footer={
        <>
          {existing &&
            (confirmDelete ? (
              <Button
                variant="danger"
                className="mr-auto"
                onClick={() => {
                  deleteLead(existing.id);
                  close();
                  router.push("/prospectos");
                }}
              >
                Sí, borrar
              </Button>
            ) : (
              <Button variant="danger" className="mr-auto" onClick={() => setConfirmDelete(true)}>
                Borrar
              </Button>
            ))}
          <Button variant="primary" onClick={submit}>
            {existing ? "Guardar" : "Agregar prospecto"}
          </Button>
        </>
      }
    >
      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <Field label="Negocio">
          {(id) => (
            <Input
              id={id}
              value={draft.business}
              onChange={(e) => {
                set("business", e.target.value);
                setError("");
              }}
              placeholder="Ej. Taller Hermanos Ruiz"
              autoComplete="off"
            />
          )}
        </Field>

        {active.length > 1 && (
          <div className="flex flex-col gap-1.5">
            <span className="text-[13px] font-medium text-muted">Proyecto</span>
            <Chips
              label="Proyecto"
              value={draft.projectId}
              options={active.map((p) => ({ value: p.id, label: p.name }))}
              onChange={(pid) => {
                const p = projects.find((x) => x.id === pid);
                setDraft((d) => ({
                  ...d,
                  projectId: pid,
                  offerId: null,
                  nextAction:
                    d.nextAction && p && !p.channels.includes(d.nextAction.channel)
                      ? { ...d.nextAction, channel: p.channels[0] ?? "visita" }
                      : d.nextAction,
                }));
              }}
            />
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <Field label="Rubro">
            {(id) => (
              <>
                <Input id={id} list={`${id}-l`} value={draft.niche} onChange={(e) => set("niche", e.target.value)} placeholder="Gimnasio…" />
                <datalist id={`${id}-l`}>
                  {niches.map((n) => (
                    <option key={n} value={n} />
                  ))}
                </datalist>
              </>
            )}
          </Field>
          <Field label="Zona">
            {(id) => (
              <>
                <Input id={id} list={`${id}-z`} value={draft.zone} onChange={(e) => set("zone", e.target.value)} placeholder="Barrio" />
                <datalist id={`${id}-z`}>
                  {zones.map((z) => (
                    <option key={z} value={z} />
                  ))}
                </datalist>
              </>
            )}
          </Field>
          <Field label="WhatsApp o teléfono">
            {(id) => <Input id={id} type="tel" inputMode="tel" value={draft.phone} onChange={(e) => set("phone", e.target.value)} placeholder="+51…" />}
          </Field>
          <Field label="Instagram">
            {(id) => <Input id={id} value={draft.instagram} onChange={(e) => set("instagram", e.target.value)} placeholder="@usuario" autoCapitalize="off" />}
          </Field>
        </div>

        <div className="flex flex-col gap-2">
          <span className="text-[13px] font-medium text-muted">Próximo contacto</span>
          <Chips
            label="Fecha"
            value={draft.nextAction ? quick : "nunca"}
            options={[...quickDates, { value: "otra", label: "Otra fecha" }, { value: "nunca", label: "Sin fecha" }]}
            onChange={(v) => {
              if (v === "nunca") return set("nextAction", null);
              const base = draft.nextAction ?? { channel: channels[0], date: today, note: "" };
              set("nextAction", { ...base, date: v === "otra" ? addDays(today, 14) : v });
            }}
          />
          {draft.nextAction && (
            <>
              <Chips
                label="Canal"
                value={draft.nextAction.channel}
                options={channels.map((c) => ({ value: c, label: CHANNEL_LABEL[c] }))}
                onChange={(c) => set("nextAction", { ...draft.nextAction!, channel: c })}
              />
              {quick === "otra" && (
                <Input
                  type="date"
                  aria-label="Fecha del próximo contacto"
                  value={draft.nextAction.date}
                  onChange={(e) => e.target.value && set("nextAction", { ...draft.nextAction!, date: e.target.value })}
                />
              )}
              <Input
                aria-label="Qué hacer"
                value={draft.nextAction.note}
                onChange={(e) => set("nextAction", { ...draft.nextAction!, note: e.target.value })}
                placeholder="Qué hacer (opcional)"
              />
            </>
          )}
        </div>

        <details className="group rounded-[16px] bg-surface" open={!!existing && !!(draft.contactName || draft.address || draft.notes)}>
          <summary className="flex h-12 cursor-pointer list-none items-center justify-between px-4 text-[15px] font-medium lg:text-[14px]">
            Más datos
            <span className="text-[13px] font-normal text-muted group-open:hidden">Contacto, dirección, valor, notas</span>
          </summary>
          <div className="flex flex-col gap-4 px-4 pb-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="Persona de contacto">
                {(id) => <Input id={id} value={draft.contactName} onChange={(e) => set("contactName", e.target.value)} placeholder="Dueño o encargado" />}
              </Field>
              <Field label="Correo">
                {(id) => <Input id={id} type="email" value={draft.email} onChange={(e) => set("email", e.target.value)} autoCapitalize="off" />}
              </Field>
            </div>
            <Field label="Dirección">
              {(id) => <Input id={id} value={draft.address} onChange={(e) => set("address", e.target.value)} placeholder="Calle y número" />}
            </Field>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <Field label="Etapa">
                {(id) => (
                  <Select id={id} value={draft.stage} onChange={(e) => set("stage", e.target.value as Stage)}>
                    {STAGES.map((s) => (
                      <option key={s} value={s}>
                        {STAGE_LABEL[s]}
                      </option>
                    ))}
                  </Select>
                )}
              </Field>
              <Field label="Valor estimado">
                {(id) => (
                  <Input
                    id={id}
                    type="number"
                    inputMode="decimal"
                    min={0}
                    value={draft.value || ""}
                    onChange={(e) => set("value", Number(e.target.value) || 0)}
                    placeholder="0"
                    className="tabular"
                  />
                )}
              </Field>
              {project && project.offers.length > 0 && (
                <Field label="Qué le ofrezco" className="col-span-2 sm:col-span-1">
                  {(id) => (
                    <Select
                      id={id}
                      value={draft.offerId ?? ""}
                      onChange={(e) => {
                        const offer = project.offers.find((o) => o.id === e.target.value);
                        setDraft((d) => ({ ...d, offerId: offer?.id ?? null, value: offer ? offer.price : d.value }));
                      }}
                    >
                      <option value="">Sin definir</option>
                      {project.offers.map((o) => (
                        <option key={o.id} value={o.id}>
                          {o.name}
                        </option>
                      ))}
                    </Select>
                  )}
                </Field>
              )}
            </div>
            <Field label="Notas">
              {(id) => <Textarea id={id} value={draft.notes} onChange={(e) => set("notes", e.target.value)} placeholder="Horario, quién decide, qué le preocupa…" />}
            </Field>
          </div>
        </details>

        {error && (
          <p role="alert" className="text-[14px] text-negative">
            {error}
          </p>
        )}
        <button type="submit" hidden />
      </form>
    </Sheet>
  );
}
