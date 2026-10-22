"use client";

import Link from "next/link";
import { useState } from "react";
import { Globe, MapPin, Phone, Star } from "lucide-react";
import { toast } from "sonner";
import { useStore } from "@/lib/store";
import { useLocation } from "@/lib/location";
import { distanceLabel, hasCoords, meters, type Place } from "@/lib/geo";
import { CHANNEL_LABEL, STAGE_LABEL } from "@/lib/labels";
import { relativeDay, isoDay } from "@/lib/format";
import { telLink } from "@/lib/links";
import { haptic } from "@/lib/haptics";
import type { Lead } from "@/lib/types";
import { Button, Chips, Field, Input, ProjectTag, Sheet } from "./ui";

export type MapTarget = { type: "place"; place: Place; niche: string } | { type: "lead"; lead: Lead };

const LAST_PROJECT = "ruta-de-ventas:ultimo-proyecto";

function lastProject(): string | null {
  try {
    return localStorage.getItem(LAST_PROJECT);
  } catch {
    return null;
  }
}

/** Ficha de un negocio tocado en el mapa: agregarlo a la ruta con su proyecto. */
export function PlaceSheet({ target, open, onClose, date }: { target: MapTarget | null; open: boolean; onClose: () => void; date: string }) {
  const leads = useStore((s) => s.leads);
  const projects = useStore((s) => s.projects).filter((p) => !p.archived);
  const scope = useStore((s) => s.scope);
  const me = useLocation((s) => s.pos);
  const saveLead = useStore((s) => s.saveLead);
  const schedule = useStore((s) => s.schedule);
  const today = isoDay();
  const dayLabel = relativeDay(date, today).toLowerCase();

  const initialProject = (scope !== "todos" && projects.some((p) => p.id === scope) ? scope : null) ?? (projects.some((p) => p.id === lastProject()) ? lastProject()! : projects[0]?.id ?? "");
  const [projectId, setProjectId] = useState(initialProject);
  const [niche, setNiche] = useState(target?.type === "place" ? target.niche : "");

  if (!target) return null;

  /* Prospecto que ya existe ---------------------------------------- */
  if (target.type === "lead") {
    const lead = leads.find((l) => l.id === target.lead.id) ?? target.lead;
    const project = projects.find((p) => p.id === lead.projectId);
    const inRoute = lead.nextAction?.date === date;
    return (
      <Sheet open={open} onClose={onClose} title={lead.business}>
        <div className="mb-4 flex flex-wrap items-center gap-2 text-[14px] text-muted">
          <ProjectTag project={project} />
          {STAGE_LABEL[lead.stage]}
          {me && hasCoords(lead) && ` · ${distanceLabel(meters(me, lead))}`}
        </div>
        {(lead.address || lead.zone) && (
          <p className="mb-4 flex items-start gap-2 text-[15px]">
            <MapPin size={17} strokeWidth={1.75} className="mt-0.5 flex-none text-muted" />
            {[lead.address, lead.zone].filter(Boolean).join(" · ")}
          </p>
        )}
        <div className="flex flex-col gap-2">
          {inRoute ? (
            <Button
              onClick={() => {
                schedule(lead.id, null);
                onClose();
              }}
            >
              Quitar de la ruta de {dayLabel}
            </Button>
          ) : (
            <Button
              variant="primary"
              className="h-12"
              onClick={() => {
                schedule(lead.id, { channel: "visita", date, note: lead.nextAction?.note ?? "" });
                haptic(10);
                toast(lead.business, { description: `Agregado a la ruta de ${dayLabel}` });
                onClose();
              }}
            >
              Agregar a la ruta de {dayLabel}
            </Button>
          )}
          <Link href={`/prospectos/${lead.id}`} className="press flex h-11 items-center justify-center rounded-full text-[15px] font-medium text-accent">
            Ver ficha
          </Link>
        </div>
      </Sheet>
    );
  }

  /* Negocio encontrado en el mapa --------------------------------- */
  const place = target.place;
  const existing = leads.find((l) => l.placeId === place.id || (hasCoords(l) && meters(l, place) < 80 && l.business.toLowerCase() === place.name.toLowerCase()));
  const tel = telLink(place.phone);

  const add = (withDate: boolean) => {
    if (!projectId) return;
    try {
      localStorage.setItem(LAST_PROJECT, projectId);
    } catch {
      /* sin almacenamiento */
    }
    const id = saveLead({
      projectId,
      business: place.name,
      niche: niche.trim(),
      contactName: "",
      phone: place.phone,
      instagram: "",
      email: "",
      address: place.address,
      zone: "",
      stage: "nuevo",
      value: 0,
      offerId: null,
      nextAction: withDate ? { channel: "visita", date, note: "" } : null,
      notes: "",
      lat: place.lat,
      lng: place.lng,
      placeId: place.id,
      website: place.website,
    });
    haptic(10);
    toast(place.name, {
      description: withDate ? `Agregado a la ruta de ${dayLabel}` : "Guardado en prospectos",
      action: { label: "Ver ficha", onClick: () => (window.location.href = `/prospectos/${id}`) },
    });
    onClose();
  };

  return (
    <Sheet open={open} onClose={onClose} title={place.name}>
      <p className="-mt-1 mb-4 text-[14px] text-muted">
        {[place.category, me ? distanceLabel(meters(me, place)) : ""].filter(Boolean).join(" · ")}
        {place.rating !== null && (
          <span className="ml-2 inline-flex items-center gap-1 text-ink">
            <Star size={13} strokeWidth={0} className="fill-[#e3a008]" />
            <span className="tabular">{place.rating.toFixed(1).replace(".", ",")}</span>
            <span className="text-faint">({place.ratings})</span>
          </span>
        )}
      </p>

      {place.approximate && (
        <p className="mb-3 rounded-[12px] bg-[var(--pill-warning-bg)] px-3 py-2 text-[13.5px] text-[var(--pill-warning-ink)]">
          Ubicación aproximada (por la dirección). Cuando llegues, corrígela con “Estoy aquí” en su ficha.
        </p>
      )}
      <ul className="mb-5 divide-y divide-rule text-[15px]">
        {place.address && (
          <li className="flex items-start gap-3 py-2.5">
            <MapPin size={17} strokeWidth={1.75} className="mt-0.5 flex-none text-muted" />
            {place.address}
          </li>
        )}
        {place.phone && (
          <li className="flex items-center gap-3 py-2.5">
            <Phone size={17} strokeWidth={1.75} className="flex-none text-muted" />
            {tel ? (
              <a href={tel} className="text-accent">
                {place.phone}
              </a>
            ) : (
              place.phone
            )}
          </li>
        )}
        {place.website && (
          <li className="flex items-center gap-3 py-2.5">
            <Globe size={17} strokeWidth={1.75} className="flex-none text-muted" />
            <a href={place.website.startsWith("http") ? place.website : `https://${place.website}`} target="_blank" rel="noreferrer" className="truncate text-accent">
              {place.website.replace(/^https?:\/\/(www\.)?/, "")}
            </a>
          </li>
        )}
        {!place.phone && !place.website && !place.address && (
          <li className="py-2.5 text-muted">Sin más datos en el mapa. Puedes completarlos después en la ficha.</li>
        )}
      </ul>

      {existing ? (
        <div className="flex flex-col gap-2">
          <p className="rounded-[14px] bg-surface px-4 py-3 text-[14px]">
            Ya está en tus prospectos
            {existing.nextAction && ` · ${CHANNEL_LABEL[existing.nextAction.channel]} ${relativeDay(existing.nextAction.date, today).toLowerCase()}`}.
          </p>
          {existing.nextAction?.date !== date && (
            <Button
              variant="primary"
              className="h-12"
              onClick={() => {
                schedule(existing.id, { channel: "visita", date, note: "" });
                haptic(10);
                toast(existing.business, { description: `Agregado a la ruta de ${dayLabel}` });
                onClose();
              }}
            >
              Agregar a la ruta de {dayLabel}
            </Button>
          )}
          <Link href={`/prospectos/${existing.id}`} className="press flex h-11 items-center justify-center rounded-full text-[15px] font-medium text-accent">
            Ver ficha
          </Link>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <span className="text-[13px] font-medium text-muted">¿Para qué proyecto?</span>
            <Chips label="Proyecto" value={projectId} onChange={setProjectId} options={projects.map((p) => ({ value: p.id, label: p.name }))} />
          </div>
          <Field label="Rubro">{(id) => <Input id={id} value={niche} onChange={(e) => setNiche(e.target.value)} />}</Field>
          <div className="flex flex-col gap-2">
            <Button variant="primary" className="h-12" onClick={() => add(true)} disabled={!projectId}>
              Agregar a la ruta de {dayLabel}
            </Button>
            <Button variant="ghost" onClick={() => add(false)} disabled={!projectId}>
              Solo guardar como prospecto
            </Button>
          </div>
        </div>
      )}
    </Sheet>
  );
}
