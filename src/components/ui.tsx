"use client";

import Link from "next/link";
import { X } from "lucide-react";
import { useEffect, useId, useRef, type ComponentProps, type ReactNode } from "react";
import { HUES } from "@/lib/labels";
import { initials } from "@/lib/format";
import type { Project } from "@/lib/types";

export function cx(...parts: (string | false | null | undefined)[]) {
  return parts.filter(Boolean).join(" ");
}

/* Botones ---------------------------------------------------------- */

type Variant = "primary" | "secondary" | "ghost" | "danger";

const variants: Record<Variant, string> = {
  primary: "bg-ink text-white hover:bg-[#33342f]",
  secondary: "bg-active text-ink hover:bg-[#e2e2dd]",
  ghost: "text-ink hover:bg-active",
  danger: "text-negative hover:bg-[var(--pill-negative-bg)]",
};

const base =
  "press inline-flex items-center justify-center gap-1.5 rounded-full font-medium whitespace-nowrap disabled:opacity-40 disabled:pointer-events-none";

const sizes = {
  sm: "h-8 px-3 text-[13px]",
  md: "h-11 md:h-[38px] px-4 text-[14px]",
};

export function Button({
  variant = "secondary",
  size = "md",
  className,
  ...props
}: ComponentProps<"button"> & { variant?: Variant; size?: keyof typeof sizes }) {
  return <button type="button" className={cx(base, sizes[size], variants[variant], className)} {...props} />;
}

export function ButtonLink({
  variant = "secondary",
  size = "md",
  className,
  ...props
}: ComponentProps<typeof Link> & { variant?: Variant; size?: keyof typeof sizes }) {
  return <Link className={cx(base, sizes[size], variants[variant], className)} {...props} />;
}

/** Enlace externo con aspecto de botón (tel:, wa.me, Maps…). */
export function ActionLink({
  href,
  variant = "secondary",
  size = "md",
  className,
  children,
  ...props
}: Omit<ComponentProps<"a">, "href"> & { href: string | null; variant?: Variant; size?: keyof typeof sizes }) {
  if (!href) {
    return (
      <span className={cx(base, sizes[size], variants[variant], "pointer-events-none opacity-40", className)} aria-disabled>
        {children}
      </span>
    );
  }
  const external = href.startsWith("http");
  return (
    <a
      href={href}
      className={cx(base, sizes[size], variants[variant], className)}
      {...(external ? { target: "_blank", rel: "noreferrer" } : {})}
      {...props}
    >
      {children}
    </a>
  );
}

/* Píldoras --------------------------------------------------------- */

export type Tone = "neutral" | "accent" | "warning" | "positive" | "negative" | "muted";

const tones: Record<Tone, string> = {
  neutral: "bg-[var(--pill-neutral-bg)] text-[var(--pill-neutral-ink)]",
  accent: "bg-[var(--pill-accent-bg)] text-[var(--pill-accent-ink)]",
  warning: "bg-[var(--pill-warning-bg)] text-[var(--pill-warning-ink)]",
  positive: "bg-[var(--pill-positive-bg)] text-[var(--pill-positive-ink)]",
  negative: "bg-[var(--pill-negative-bg)] text-[var(--pill-negative-ink)]",
  muted: "bg-transparent text-faint ring-1 ring-inset ring-border",
};

export function Pill({ tone = "neutral", children, className }: { tone?: Tone; children: ReactNode; className?: string }) {
  return (
    <span
      className={cx(
        "inline-flex h-[22px] flex-none items-center rounded-full px-2.5 text-[12px] font-medium whitespace-nowrap",
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

/** Etiqueta del proyecto en su tono pálido. */
export function ProjectTag({ project, className }: { project: Project | undefined; className?: string }) {
  if (!project) return null;
  const hue = HUES[project.hue];
  return (
    <span
      className={cx(
        "inline-flex h-[22px] max-w-full flex-none items-center gap-1.5 truncate rounded-full px-2.5 text-[12px] font-medium whitespace-nowrap",
        className,
      )}
      style={{ background: hue.tint, color: hue.ink }}
    >
      {project.name}
    </span>
  );
}

export function ProjectDot({ project, size = 8 }: { project: Project | undefined; size?: number }) {
  if (!project) return null;
  return (
    <span
      aria-hidden
      className="inline-block flex-none rounded-full"
      style={{ width: size, height: size, background: HUES[project.hue].ink }}
    />
  );
}

/** Inicial del negocio sobre el tono pálido de su proyecto. */
export function Avatar({ name, project, size = 36 }: { name: string; project: Project | undefined; size?: number }) {
  const hue = project ? HUES[project.hue] : HUES.pizarra;
  return (
    <span
      aria-hidden
      className="inline-flex flex-none items-center justify-center rounded-full font-semibold"
      style={{ width: size, height: size, background: hue.tint, color: hue.ink, fontSize: size * 0.36 }}
    >
      {initials(name) || "·"}
    </span>
  );
}

/* Paneles ---------------------------------------------------------- */

export function Panel({
  title,
  count,
  action,
  children,
  className,
  bodyClassName,
}: {
  title?: ReactNode;
  count?: number;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <section className={cx("rounded-[22px] bg-surface p-4 md:p-5", className)}>
      {(title || action) && (
        <header className="mb-3 flex min-h-8 items-center justify-between gap-3">
          <h2 className="flex items-center gap-2 text-[14px] font-semibold">
            {title}
            {count !== undefined && (
              <span className="tabular rounded-full bg-raised px-2 py-px text-[12px] font-medium text-muted ring-1 ring-border">
                {count}
              </span>
            )}
          </h2>
          {action}
        </header>
      )}
      <div className={bodyClassName}>{children}</div>
    </section>
  );
}

export function PanelLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className="text-[13px] font-medium text-muted hover:text-ink">
      {children}
    </Link>
  );
}

/** Sección vacía: conserva su marco y dice qué hacer. */
export function Empty({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex min-h-[44px] flex-wrap items-center justify-between gap-2 rounded-[12px] border border-dashed border-control px-4 py-3 text-[13px] text-muted">
      <span>{children}</span>
      {action}
    </div>
  );
}

/* Formularios ------------------------------------------------------ */

const inputBase =
  "w-full rounded-[12px] border border-control bg-raised px-3 text-ink placeholder:text-faint hover:border-[#c4c4be] focus:border-ink focus:outline-none";

export function Field({
  label,
  hint,
  children,
  className,
}: {
  label: string;
  hint?: string;
  children: (id: string) => ReactNode;
  className?: string;
}) {
  const id = useId();
  return (
    <div className={cx("flex flex-col gap-1.5", className)}>
      <label htmlFor={id} className="text-[13px] font-medium text-muted">
        {label}
      </label>
      {children(id)}
      {hint && <p className="text-[12px] text-faint">{hint}</p>}
    </div>
  );
}

export function Input({ className, ...props }: ComponentProps<"input">) {
  return <input className={cx(inputBase, "h-11 md:h-[38px]", className)} {...props} />;
}

export function Select({ className, ...props }: ComponentProps<"select">) {
  return (
    <select
      className={cx(
        inputBase,
        "h-11 appearance-none bg-[url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2212%22 height=%2212%22 viewBox=%220 0 24 24%22 fill=%22none%22 stroke=%22%2361615d%22 stroke-width=%222%22><path d=%22m6 9 6 6 6-6%22/></svg>')] bg-[length:14px] bg-[right_12px_center] bg-no-repeat pr-9 md:h-[38px]",
        className,
      )}
      {...props}
    />
  );
}

export function Textarea({ className, ...props }: ComponentProps<"textarea">) {
  return <textarea className={cx(inputBase, "min-h-[88px] py-2.5 leading-relaxed", className)} {...props} />;
}

/** Fila de opciones tipo chip (una sola elegida). */
export function Chips<T extends string>({
  value,
  options,
  onChange,
  label,
  className,
}: {
  value: T;
  options: { value: T; label: ReactNode }[];
  onChange: (v: T) => void;
  label: string;
  className?: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className={cx("scroll-x -mx-4 flex gap-1.5 px-4 md:mx-0 md:flex-wrap md:px-0", className)}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onChange(o.value)}
            className={cx(
              "press h-9 flex-none rounded-full border px-3.5 text-[13px] font-medium md:h-8",
              on ? "border-ink bg-ink text-white" : "border-control bg-raised text-ink hover:border-[#bdbdb7]",
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/* Hoja (diálogo) --------------------------------------------------- */

export function Sheet({
  open,
  onClose,
  title,
  children,
  footer,
  wide = false,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    // En el teléfono no se abre el teclado solo: se enfoca la hoja, no el primer campo.
    const fine = window.matchMedia("(pointer: fine)").matches;
    const target = fine
      ? ref.current?.querySelector<HTMLElement>("input, select, textarea, button:not([data-close])")
      : ref.current;
    target?.focus({ preventScroll: true });
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center md:items-stretch md:justify-end">
      <div className="backdrop absolute inset-0 bg-[rgba(31,32,29,0.32)]" onClick={onClose} aria-hidden />
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className={cx(
          "sheet relative flex max-h-[94dvh] w-full flex-col rounded-t-[26px] bg-raised shadow-[0_12px_40px_rgba(0,0,0,0.16)] outline-none md:m-2 md:max-h-none md:rounded-[22px]",
          wide ? "md:w-[560px]" : "md:w-[460px]",
        )}
      >
        <span aria-hidden className="mx-auto mt-2 h-1 w-10 flex-none rounded-full bg-control md:hidden" />
        <header className="flex items-center justify-between gap-3 px-5 pt-2 pb-2 md:pt-5">
          <h2 className="font-display text-[19px] font-semibold tracking-[-0.01em]">{title}</h2>
          <button
            type="button"
            data-close
            onClick={onClose}
            className="press -mr-2 inline-flex size-10 items-center justify-center rounded-full text-muted hover:bg-active hover:text-ink"
            aria-label="Cerrar"
          >
            <X size={18} strokeWidth={1.75} />
          </button>
        </header>
        <div className="flex-1 overflow-y-auto px-5 pb-5">{children}</div>
        {footer && (
          <footer className="flex items-center justify-end gap-2 border-t border-rule px-4 py-3 pb-[max(12px,env(safe-area-inset-bottom))] max-md:[&>*]:h-12 max-md:[&>*]:flex-1 md:px-5">
            {footer}
          </footer>
        )}
      </div>
    </div>
  );
}

/* Título de pantalla ----------------------------------------------- */

export function PageTitle({ title, sub, actions }: { title: string; sub?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-x-4 gap-y-3 md:mb-8">
      <div className="min-w-0">
        <h1 className="font-display text-[26px] leading-tight font-semibold tracking-[-0.02em] md:text-[28px]">{title}</h1>
        {sub && <p className="mt-1 text-[14px] text-muted">{sub}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

/* Pestañas de ancho completo (carriles de la ruta en el teléfono) ------ */

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
  className,
}: {
  value: T;
  options: { value: T; label: string; count?: number }[];
  onChange: (v: T) => void;
  label: string;
  className?: string;
}) {
  return (
    <div role="tablist" aria-label={label} className={cx("flex gap-1 rounded-full bg-active p-1", className)}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="tab"
            aria-selected={on}
            onClick={() => onChange(o.value)}
            className={cx(
              "press flex h-10 min-w-0 flex-1 items-center justify-center gap-1.5 rounded-full px-2 text-[14px] font-medium",
              on ? "bg-raised text-ink shadow-[0_1px_3px_rgba(0,0,0,0.08)]" : "text-muted",
            )}
          >
            <span className="truncate">{o.label}</span>
            {o.count !== undefined && <span className={cx("tabular text-[13px]", on ? "text-muted" : "text-faint")}>{o.count}</span>}
          </button>
        );
      })}
    </div>
  );
}
