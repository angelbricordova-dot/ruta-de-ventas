"use client";

import Link from "next/link";
import { useRef, useState, type ReactNode } from "react";
import { motion, useMotionValue, useMotionValueEvent, useTransform, type HTMLMotionProps } from "motion/react";
import { AtSign, CalendarClock, Check, Mail, MapPin, MessageCircle, Phone } from "lucide-react";
import { useStore } from "@/lib/store";
import { useUI } from "@/lib/ui-store";
import { CHANNEL_VERB, STAGE_LABEL, STAGE_TONE } from "@/lib/labels";
import { daysFrom, plural } from "@/lib/format";
import { fillScript, instagramLink, mailLink, mapLink, telLink, whatsappLink } from "@/lib/links";
import { haptic } from "@/lib/haptics";
import { postponeWithUndo } from "@/lib/notify";
import type { Channel, Lead, Project } from "@/lib/types";
import { cx, Pill, ProjectDot } from "./ui";

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

export function ContactButton({
  lead,
  channel,
  label = false,
  big = false,
}: {
  lead: Lead;
  channel: Channel;
  label?: boolean;
  big?: boolean;
}) {
  const href = useContactHref(lead, channel);
  const Icon = ICON[channel];
  const text = ACTION_LABEL[channel];
  const cls = cx(
    "press inline-flex items-center justify-center gap-2 rounded-full text-ink",
    big ? "bg-raised hover:bg-white" : "bg-active hover:bg-[#e2e2dd]",
    big
      ? "h-[52px] flex-1 px-4 text-[16px] font-medium"
      : label
        ? "h-11 flex-none px-4 text-[15px] font-medium lg:h-[38px] lg:text-[14px]"
        : "size-11 flex-none lg:size-9",
  );
  if (!href) {
    return (
      <span className={cx(cls, "pointer-events-none opacity-35")} title={`${text}: falta el dato`} aria-label={`${text} (falta el dato)`}>
        <Icon size={big ? 19 : 17} strokeWidth={1.75} />
        {(label || big) && text}
      </span>
    );
  }
  const external = href.startsWith("http");
  return (
    <a href={href} className={cls} aria-label={text} title={text} {...(external ? { target: "_blank", rel: "noreferrer" } : {})}>
      <Icon size={big ? 19 : 17} strokeWidth={1.75} />
      {(label || big) && text}
    </a>
  );
}

export function LogButton({
  lead,
  channel,
  compact = false,
  big = false,
}: {
  lead: Lead;
  channel?: Channel;
  compact?: boolean;
  big?: boolean;
}) {
  const openLog = useUI((s) => s.openLog);
  return (
    <button
      type="button"
      onClick={() => openLog(lead.id, channel ?? null)}
      className={cx(
        "press inline-flex flex-none items-center justify-center gap-1.5 rounded-full bg-ink font-medium text-white hover:bg-[#33342f]",
        big ? "h-[52px] flex-1 px-5 text-[16px]" : compact ? "size-11 lg:size-9" : "h-11 px-4 text-[14px] lg:h-9 lg:text-[13px]",
      )}
      aria-label={`Registrar contacto con ${lead.business}`}
      title="Registrar contacto"
    >
      <Check size={big ? 20 : 17} strokeWidth={2.2} />
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

/** Círculo para marcar un pendiente como hecho (abre "¿Cómo te fue?"). */
export function DoneCircle({ lead, channel }: { lead: Lead; channel?: Channel }) {
  const openLog = useUI((s) => s.openLog);
  return (
    <button
      type="button"
      onClick={() => openLog(lead.id, channel ?? null)}
      aria-label={`Marcar como hecho: ${lead.business}`}
      title="Marcar como hecho"
      className="group -ml-1.5 inline-flex size-11 flex-none items-center justify-center rounded-full"
    >
      <span className="inline-flex size-[26px] items-center justify-center rounded-full border-[1.5px] border-[#bdbdb7] text-white transition-colors group-hover:border-accent group-hover:bg-accent group-active:scale-90">
        <Check size={14} strokeWidth={2.6} className="opacity-0 transition-opacity group-hover:opacity-100" />
      </span>
    </button>
  );
}

const SWIPE = 72;

/** Movimiento de las filas en la lista: aparecen, se van y las demás se reacomodan. */
const EASE_OUT = [0.23, 1, 0.32, 1] as const;
const EASE_IN_OUT = [0.77, 0, 0.175, 1] as const;

export const ROW_MOTION = {
  layout: "position",
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, scale: 0.98, transition: { duration: 0.18, ease: EASE_OUT } },
  transition: { duration: 0.24, ease: EASE_OUT, layout: { duration: 0.3, ease: EASE_IN_OUT } },
} satisfies HTMLMotionProps<"li">;

/**
 * Fila que se desliza: a la derecha marca "Hecho", a la izquierda pasa a "Mañana".
 * Al cruzar el umbral vibra y el fondo se llena de color; si se suelta antes, vuelve con un resorte.
 */
export function SwipeRow({
  children,
  onDone,
  onLater,
  className,
}: {
  children: ReactNode;
  onDone: () => void;
  onLater?: () => void;
  className?: string;
}) {
  const x = useMotionValue(0);
  const [armed, setArmed] = useState<"done" | "later" | null>(null);
  const armedRef = useRef<typeof armed>(null);
  const dragged = useRef(false);
  const doneOpacity = useTransform(x, [0, 24], [0, 1]);
  const laterOpacity = useTransform(x, [-24, 0], [1, 0]);

  useMotionValueEvent(x, "change", (v) => {
    const next = v > SWIPE ? "done" : v < -SWIPE && onLater ? "later" : null;
    if (next !== armedRef.current) {
      armedRef.current = next;
      setArmed(next);
      if (next) haptic(8);
    }
  });

  return (
    <div className={cx("relative overflow-hidden", className)}>
      <motion.div
        aria-hidden
        style={{ opacity: doneOpacity }}
        className={cx(
          "absolute inset-0 flex items-center gap-2 pl-5 text-[15px] font-medium transition-colors duration-150",
          armed === "done" ? "bg-accent text-white" : "bg-accent-tint text-accent",
        )}
      >
        <Check size={20} strokeWidth={2.4} /> Hecho
      </motion.div>
      {onLater && (
        <motion.div
          aria-hidden
          style={{ opacity: laterOpacity }}
          className={cx(
            "absolute inset-0 flex items-center justify-end gap-2 pr-5 text-[15px] font-medium transition-colors duration-150",
            armed === "later" ? "bg-ink text-white" : "bg-active text-ink",
          )}
        >
          Mañana <CalendarClock size={20} strokeWidth={2} />
        </motion.div>
      )}
      <motion.div
        style={{ x }}
        drag="x"
        dragDirectionLock
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={{ left: onLater ? 0.65 : 0.08, right: 0.65 }}
        dragTransition={{ bounceStiffness: 520, bounceDamping: 38 }}
        onDragStart={() => (dragged.current = true)}
        onDragEnd={(_, info) => {
          setTimeout(() => (dragged.current = false), 0);
          if (info.offset.x > SWIPE || info.velocity.x > 900) onDone();
          else if (onLater && (info.offset.x < -SWIPE || info.velocity.x < -900)) onLater();
        }}
        // Un arrastre no debe abrir la ficha al soltar.
        onClickCapture={(e) => {
          if (dragged.current) {
            e.preventDefault();
            e.stopPropagation();
          }
        }}
        className="relative bg-raised"
      >
        {children}
      </motion.div>
    </div>
  );
}

/** Fila de pendiente: círculo para marcar hecho, quién y qué, y el botón para contactar. */
export function AgendaRow({
  lead,
  project,
  today,
  showProject = true,
}: {
  lead: Lead;
  project: Project | undefined;
  today: string;
  showProject?: boolean;
}) {
  const openLog = useUI((s) => s.openLog);
  const channel = lead.nextAction?.channel ?? "visita";
  const sub = [lead.nextAction?.note || CHANNEL_VERB[channel], lead.zone].filter(Boolean).join(" · ");
  return (
    <motion.li {...ROW_MOTION} className="border-b border-rule last:border-0">
      <SwipeRow onDone={() => openLog(lead.id, channel)} onLater={() => postponeWithUndo(lead)}>
        <div className="flex min-h-[66px] items-center gap-2 py-1.5 lg:min-h-[60px]">
          <DoneCircle lead={lead} channel={channel} />
          <Link href={`/prospectos/${lead.id}`} draggable={false} className="min-w-0 flex-1 py-1">
            <span className="flex items-center gap-2">
              <span className="truncate text-[16px] font-medium lg:text-[14px]">{lead.business}</span>
              {showProject && <ProjectDot project={project} size={7} />}
            </span>
            <span className="mt-0.5 flex items-center gap-2 text-[14px] text-muted lg:text-[12.5px]">
              {lead.nextAction && <Due date={lead.nextAction.date} today={today} />}
              <span className="truncate">{sub}</span>
            </span>
          </Link>
          <ContactButton lead={lead} channel={channel} />
        </div>
      </SwipeRow>
    </motion.li>
  );
}

export { ICON as CHANNEL_ICON, ACTION_LABEL };
