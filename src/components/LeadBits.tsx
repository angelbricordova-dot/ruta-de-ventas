"use client";

import Link from "next/link";
import { AtSign, Check, Mail, MapPin, MessageCircle, Phone } from "lucide-react";
import { useStore } from "@/lib/store";
import { useUI } from "@/lib/ui-store";
import { CHANNEL_VERB, STAGE_LABEL, STAGE_TONE } from "@/lib/labels";
import { daysFrom, plural } from "@/lib/format";
import { fillScript, instagramLink, mailLink, mapLink, telLink, whatsappLink } from "@/lib/links";
import type { Channel, Lead, Project } from "@/lib/types";
import { Avatar, cx, Pill, ProjectDot } from "./ui";

const ICON: Record<Channel, typeof Phone> = {
  visita: MapPin,
  llamada: Phone,
  whatsapp: MessageCircle,
  dm: AtSign,
  email: Mail,
};

const ACTION_LABEL: Record<Channel, string> = {
  visita: "Cómo llegar",
  llamada: "Llamar",
  whatsapp: "WhatsApp",
  dm: "Abrir Instagram",
  email: "Escribir correo",
};

/** Enlace directo para contactar por un canal, con el guion del proyecto ya puesto. */
export function useContactHref(lead: Lead, channel: Channel): string | null {
  const city = useStore((s) => s.settings.city);
  const seller = useStore((s) => s.settings.sellerName);
  const script = useStore((s) => s.scripts.find((sc) => sc.projectId === lead.projectId && sc.channel === channel));
  const text = script ? fillScript(script.body, lead, seller) : "";
  switch (channel) {
    case "visita":
      return lead.address || lead.zone ? mapLink(lead, city) : null;
    case "llamada":
      return telLink(lead.phone);
    case "whatsapp":
      return whatsappLink(lead.phone, text);
    case "dm":
      return instagramLink(lead.instagram);
    case "email":
      return mailLink(lead.email, "", text);
  }
}

export function ContactButton({ lead, channel, label = false }: { lead: Lead; channel: Channel; label?: boolean }) {
  const href = useContactHref(lead, channel);
  const Icon = ICON[channel];
  const text = ACTION_LABEL[channel];
  const cls = cx(
    "press inline-flex flex-none items-center justify-center gap-1.5 rounded-full border border-border bg-raised text-ink hover:border-control",
    label ? "h-11 px-4 text-[14px] font-medium md:h-[38px]" : "size-10 md:size-9",
  );
  if (!href) {
    return (
      <span className={cx(cls, "pointer-events-none opacity-35")} title={`${text}: falta el dato`} aria-label={`${text} (falta el dato)`}>
        <Icon size={16} strokeWidth={1.75} />
        {label && text}
      </span>
    );
  }
  const external = href.startsWith("http");
  return (
    <a href={href} className={cls} aria-label={text} title={text} {...(external ? { target: "_blank", rel: "noreferrer" } : {})}>
      <Icon size={16} strokeWidth={1.75} />
      {label && text}
    </a>
  );
}

export function LogButton({ lead, channel, compact = false }: { lead: Lead; channel?: Channel; compact?: boolean }) {
  const openLog = useUI((s) => s.openLog);
  return (
    <button
      type="button"
      onClick={() => openLog(lead.id, channel ?? null)}
      className={cx(
        "press inline-flex flex-none items-center justify-center gap-1.5 rounded-full bg-ink font-medium text-white hover:bg-[#33342f]",
        compact ? "size-10 md:size-9" : "h-10 px-3.5 text-[13px] md:h-9",
      )}
      aria-label={`Registrar contacto con ${lead.business}`}
      title="Registrar contacto"
    >
      <Check size={16} strokeWidth={2} />
      {!compact && "Hecho"}
    </button>
  );
}

export function StagePill({ lead }: { lead: Lead }) {
  return <Pill tone={STAGE_TONE[lead.stage]}>{STAGE_LABEL[lead.stage]}</Pill>;
}

/** Texto de vencimiento: la única marca roja de la fila. */
export function Due({ date, today }: { date: string; today: string }) {
  const diff = daysFrom(date, today);
  if (diff >= 0) return null;
  return <span className="flex-none text-[12px] font-medium whitespace-nowrap text-negative">Vencido hace {plural(-diff, "día", "días")}</span>;
}

/**
 * Fila de la ruta: quién, qué hacer y el botón para hacerlo.
 * 63px de alto, una tarjeta un paso más clara que el panel.
 */
export function AgendaRow({
  lead,
  project,
  today,
  order,
  showProject = true,
}: {
  lead: Lead;
  project: Project | undefined;
  today: string;
  order?: number;
  showProject?: boolean;
}) {
  const channel = lead.nextAction?.channel ?? "visita";
  const sub = [lead.nextAction?.note || CHANNEL_VERB[channel], lead.zone].filter(Boolean).join(" · ");
  return (
    <li className="flex min-h-[63px] items-center gap-3 rounded-[14px] border border-border bg-raised py-2.5 pr-2.5 pl-3">
      {order !== undefined ? (
        <span className="tabular inline-flex size-7 flex-none items-center justify-center rounded-full border border-control text-[12px] font-semibold text-muted">
          {order}
        </span>
      ) : (
        <Avatar name={lead.business} project={project} size={32} />
      )}
      <Link href={`/prospectos/${lead.id}`} className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className="truncate text-[14px] font-medium">{lead.business}</span>
          {showProject && order !== undefined && <ProjectDot project={project} size={7} />}
        </span>
        <span className="mt-0.5 flex items-center gap-2 text-[12.5px] text-muted">
          {lead.nextAction && <Due date={lead.nextAction.date} today={today} />}
          <span className="truncate">{sub}</span>
        </span>
      </Link>
      <ContactButton lead={lead} channel={channel} />
      <LogButton lead={lead} channel={channel} compact />
    </li>
  );
}
