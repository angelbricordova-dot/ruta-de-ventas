"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useStore } from "@/lib/store";
import { googleEmbedSearch, type LatLng } from "@/lib/geo";
import { isoDay, relativeDay } from "@/lib/format";
import { haptic } from "@/lib/haptics";
import { Button, Chips, Field, Input, Sheet } from "./ui";

const LAST_PROJECT = "ruta-de-ventas:ultimo-proyecto";

/**
 * Agregar un negocio que viste en el mapa de Google escribiendo su nombre.
 * La vista previa es el propio mapa de Google buscando ese nombre cerca de ti, para confirmar
 * que es el correcto. Se guarda como "Nombre, ciudad" y Google lo ubica al trazar la ruta.
 */
export function AddPlaceSheet({
  open,
  onClose,
  date,
  near,
  niche: initialNiche,
}: {
  open: boolean;
  onClose: () => void;
  date: string;
  near: LatLng;
  niche: string;
}) {
  const projects = useStore((s) => s.projects).filter((p) => !p.archived);
  const scope = useStore((s) => s.scope);
  const city = useStore((s) => s.settings.city) || "Maracay";
  const leads = useStore((s) => s.leads);
  const saveLead = useStore((s) => s.saveLead);
  const schedule = useStore((s) => s.schedule);

  const last = (() => {
    try {
      return localStorage.getItem(LAST_PROJECT);
    } catch {
      return null;
    }
  })();
  const [projectId, setProjectId] = useState(
    (scope !== "todos" && projects.some((p) => p.id === scope) ? scope : null) ?? (projects.some((p) => p.id === last) ? last! : projects[0]?.id ?? ""),
  );
  const [name, setName] = useState("");
  const [preview, setPreview] = useState("");
  const [niche, setNiche] = useState(initialNiche);

  // La vista previa se actualiza cuando dejas de escribir.
  useEffect(() => {
    const t = setTimeout(() => setPreview(name.trim()), 700);
    return () => clearTimeout(t);
  }, [name]);

  const today = isoDay();
  const dayLabel = relativeDay(date, today).toLowerCase();
  const gquery = `${name.trim()}, ${city}`;
  const existing = leads.find((l) => l.business.trim().toLowerCase() === name.trim().toLowerCase());

  const add = (withDate: boolean) => {
    const business = name.trim();
    if (!business || !projectId) return;
    try {
      localStorage.setItem(LAST_PROJECT, projectId);
    } catch {
      /* sin almacenamiento */
    }
    if (existing) {
      if (withDate) schedule(existing.id, { channel: "visita", date, note: existing.nextAction?.note ?? "" });
      toast(existing.business, { description: withDate ? `Ya lo tenías: agregado a la ruta de ${dayLabel}` : "Ya estaba en tus prospectos" });
      onClose();
      return;
    }
    const id = saveLead({
      projectId,
      business,
      niche: niche.trim(),
      contactName: "",
      phone: "",
      instagram: "",
      email: "",
      address: "",
      zone: "",
      stage: "nuevo",
      value: 0,
      offerId: null,
      nextAction: withDate ? { channel: "visita", date, note: "" } : null,
      notes: "",
      gquery,
    });
    haptic(10);
    toast(business, {
      description: withDate ? `Agregado a la ruta de ${dayLabel}` : "Guardado en prospectos",
      action: { label: "Ver ficha", onClick: () => (window.location.href = `/prospectos/${id}`) },
    });
    onClose();
  };

  return (
    <Sheet open={open} onClose={onClose} title="Agregar negocio" wide>
      <div className="flex flex-col gap-4">
        <Field label="Nombre como sale en el mapa">
          {(id) => (
            <Input
              id={id}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ej. Star Gym Fitness Center"
              autoComplete="off"
              enterKeyHint="done"
            />
          )}
        </Field>

        <div className="relative h-[200px] overflow-hidden rounded-[16px] bg-surface">
          {preview ? (
            <iframe
              key={preview}
              src={googleEmbedSearch(`${preview} ${city}`, near, 16)}
              title="Vista previa en Google Maps"
              className="h-full w-full border-0"
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
            />
          ) : (
            <p className="flex h-full items-center justify-center px-6 text-center text-[14px] text-muted">
              Escribe el nombre y aquí verás si Google lo encuentra.
            </p>
          )}
        </div>

        {existing ? (
          <p className="rounded-[12px] bg-surface px-3 py-2.5 text-[14px]">Ya tienes un prospecto con ese nombre: se usará ese.</p>
        ) : (
          <>
            <div className="flex flex-col gap-1.5">
              <span className="text-[13px] font-medium text-muted">¿Para qué proyecto?</span>
              <Chips label="Proyecto" value={projectId} onChange={setProjectId} options={projects.map((p) => ({ value: p.id, label: p.name }))} />
            </div>
            <Field label="Rubro">{(id) => <Input id={id} value={niche} onChange={(e) => setNiche(e.target.value)} placeholder="Gimnasio, taller…" />}</Field>
          </>
        )}

        <div className="flex flex-col gap-2">
          <Button variant="primary" className="h-12" onClick={() => add(true)} disabled={!name.trim() || !projectId}>
            Agregar a la ruta de {dayLabel}
          </Button>
          <Button variant="ghost" onClick={() => add(false)} disabled={!name.trim() || !projectId}>
            Solo guardar como prospecto
          </Button>
        </div>
      </div>
    </Sheet>
  );
}
