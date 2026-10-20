"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import {
  Check,
  ChevronsUpDown,
  Columns3,
  FolderKanban,
  Home,
  Map,
  MessageSquareText,
  MoreHorizontal,
  Plus,
  Settings,
  Users,
} from "lucide-react";
import { useStore } from "@/lib/store";
import { useUI } from "@/lib/ui-store";
import { HUES } from "@/lib/labels";
import { Button, cx, ProjectDot, Sheet } from "./ui";
import { LeadForm } from "./LeadForm";
import { LogContact } from "./LogContact";

const NAV = [
  { href: "/", label: "Hoy", icon: Home },
  { href: "/ruta", label: "Ruta", icon: Map },
  { href: "/prospectos", label: "Prospectos", icon: Users },
  { href: "/embudo", label: "Embudo", icon: Columns3 },
  { href: "/proyectos", label: "Proyectos", icon: FolderKanban },
  { href: "/guiones", label: "Guiones", icon: MessageSquareText },
];

const isActive = (pathname: string, href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));

/** Marca: una ruta con tres paradas, la última llena. */
export function Mark({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 28 28" aria-hidden className="flex-none">
      <rect width="28" height="28" rx="8" fill="#1f201d" />
      <path d="M7 20.5c3.5 0 3-6 7-6s3.5-6 7-6" fill="none" stroke="#9fd3cc" strokeWidth="1.6" strokeLinecap="round" strokeDasharray="0.1 3.2" />
      <circle cx="7" cy="20.5" r="2" fill="#fff" />
      <circle cx="14" cy="14.5" r="2" fill="#fff" />
      <circle cx="21" cy="8.5" r="2.6" fill="#3fb3a5" />
    </svg>
  );
}

function useHydrated() {
  const [ok, setOk] = useState(false);
  useEffect(() => {
    const done = () => setOk(true);
    if (useStore.persist.hasHydrated()) done();
    return useStore.persist.onFinishHydration(done);
  }, []);
  return ok;
}

function ScopePicker({ onPick }: { onPick?: () => void }) {
  const projects = useStore((s) => s.projects).filter((p) => !p.archived);
  const scope = useStore((s) => s.scope);
  const setScope = useStore((s) => s.setScope);
  const options = [{ id: "todos", name: "Todos los proyectos", project: undefined }, ...projects.map((p) => ({ id: p.id, name: p.name, project: p }))];
  return (
    <ul className="flex flex-col gap-0.5">
      {options.map((o) => (
        <li key={o.id}>
          <button
            type="button"
            onClick={() => {
              setScope(o.id);
              onPick?.();
            }}
            className="press flex h-11 w-full items-center gap-3 rounded-[10px] px-3 text-left text-[14px] hover:bg-active lg:h-9"
          >
            {o.project ? <ProjectDot project={o.project} size={10} /> : <span className="size-2.5 flex-none rounded-full border border-faint" />}
            <span className="flex-1 truncate">{o.name}</span>
            {scope === o.id && <Check size={16} strokeWidth={1.75} className="text-ink" />}
          </button>
        </li>
      ))}
    </ul>
  );
}

function ScopeButton({ className }: { className?: string }) {
  const [open, setOpen] = useState(false);
  const scope = useStore((s) => s.scope);
  const project = useStore((s) => s.projects.find((p) => p.id === s.scope));
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cx(
          "press flex min-w-0 items-center gap-2 rounded-full border border-border bg-raised pr-2.5 pl-3 text-[13px] font-medium hover:border-control",
          className,
        )}
        aria-label="Cambiar de proyecto"
      >
        {project ? <ProjectDot project={project} /> : <span className="size-2 flex-none rounded-full border border-faint" />}
        <span className="truncate">{scope === "todos" || !project ? "Todos" : project.name}</span>
        <ChevronsUpDown size={14} strokeWidth={1.75} className="flex-none text-muted" />
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} title="Ver proyecto">
        <ScopePicker onPick={() => setOpen(false)} />
      </Sheet>
    </>
  );
}

function Sidebar() {
  const pathname = usePathname();
  const seller = useStore((s) => s.settings.sellerName);
  const scope = useStore((s) => s.scope);
  const project = useStore((s) => s.projects.find((p) => p.id === s.scope));
  const [picking, setPicking] = useState(false);

  return (
    <aside className="sticky top-0 hidden h-dvh w-[240px] flex-none flex-col border-r border-rule px-3 py-5 lg:flex">
      <Link href="/" className="mb-5 flex items-center gap-2.5 px-2">
        <Mark />
        <span className="min-w-0 leading-tight">
          <span className="block text-[14px] font-semibold">Ruta de ventas</span>
          <span className="block truncate text-[12px] text-muted">{seller}</span>
        </span>
      </Link>

      <div className="relative mb-6">
        <button
          type="button"
          onClick={() => setPicking((v) => !v)}
          aria-expanded={picking}
          className="press flex h-10 w-full items-center gap-2.5 rounded-[12px] border border-border bg-raised px-3 text-left text-[13px] font-medium hover:border-control"
        >
          {project ? <ProjectDot project={project} size={10} /> : <span className="size-2.5 flex-none rounded-full border border-faint" />}
          <span className="flex-1 truncate">{scope === "todos" || !project ? "Todos los proyectos" : project.name}</span>
          <ChevronsUpDown size={14} strokeWidth={1.75} className="text-muted" />
        </button>
        {picking && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setPicking(false)} aria-hidden />
            <div className="absolute top-11 right-0 left-0 z-20 rounded-[14px] border border-border bg-raised p-1 shadow-[0_8px_24px_rgba(0,0,0,0.10)]">
              <ScopePicker onPick={() => setPicking(false)} />
              <Link
                href="/proyectos?nuevo=1"
                onClick={() => setPicking(false)}
                className="mt-1 flex h-9 items-center gap-3 rounded-[10px] border-t border-rule px-3 text-[13px] text-muted hover:bg-active hover:text-ink"
              >
                <Plus size={14} strokeWidth={1.75} /> Nuevo proyecto
              </Link>
            </div>
          </>
        )}
      </div>

      <nav className="flex flex-col gap-0.5">
        {NAV.map(({ href, label, icon: Icon }) => {
          const on = isActive(pathname, href);
          return (
            <Link
              key={href}
              href={href}
              aria-current={on ? "page" : undefined}
              className={cx(
                "flex h-8 items-center gap-2.5 rounded-[8px] px-2.5 text-[14px]",
                on ? "bg-active font-medium text-ink" : "text-muted hover:bg-[#f3f3ef] hover:text-ink",
              )}
            >
              <Icon size={16} strokeWidth={1.5} />
              {label}
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto flex flex-col gap-0.5">
        <Link
          href="/ajustes"
          aria-current={isActive(pathname, "/ajustes") ? "page" : undefined}
          className={cx(
            "flex h-8 items-center gap-2.5 rounded-[8px] px-2.5 text-[14px]",
            isActive(pathname, "/ajustes") ? "bg-active font-medium text-ink" : "text-muted hover:bg-[#f3f3ef] hover:text-ink",
          )}
        >
          <Settings size={16} strokeWidth={1.5} />
          Ajustes
        </Link>
      </div>
    </aside>
  );
}

const TABS = [NAV[0], NAV[1], NAV[2], NAV[3]];

function PhoneBars() {
  const pathname = usePathname();
  const openLeadForm = useUI((s) => s.openLeadForm);
  const [more, setMore] = useState(false);
  const current = [...NAV, { href: "/ajustes", label: "Ajustes" }].find((n) => isActive(pathname, n.href));
  const moreActive = !TABS.some((t) => isActive(pathname, t.href));

  return (
    <>
      <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b border-rule bg-[rgba(255,255,255,0.96)] px-4 pt-[env(safe-area-inset-top)] lg:hidden">
        <Mark size={26} />
        <span className="mr-auto truncate text-[16px] font-semibold">{current?.label ?? "Ruta de ventas"}</span>
        <ScopeButton className="h-9 max-w-[46vw]" />
        <button
          type="button"
          onClick={() => openLeadForm()}
          className="press inline-flex size-9 flex-none items-center justify-center rounded-full bg-ink text-white"
          aria-label="Nuevo prospecto"
        >
          <Plus size={18} strokeWidth={2} />
        </button>
      </header>

      <nav
        className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-rule bg-[rgba(255,255,255,0.97)] pb-[env(safe-area-inset-bottom)] lg:hidden"
        aria-label="Navegación"
      >
        {TABS.map(({ href, label, icon: Icon }) => {
          const on = isActive(pathname, href);
          return (
            <Link
              key={href}
              href={href}
              aria-current={on ? "page" : undefined}
              className={cx("flex h-[58px] flex-col items-center justify-center gap-1 text-[11px] font-medium", on ? "text-ink" : "text-faint")}
            >
              <Icon size={20} strokeWidth={on ? 2 : 1.5} />
              {label}
            </Link>
          );
        })}
        <button
          type="button"
          onClick={() => setMore(true)}
          className={cx("flex h-[58px] flex-col items-center justify-center gap-1 text-[11px] font-medium", moreActive ? "text-ink" : "text-faint")}
        >
          <MoreHorizontal size={20} strokeWidth={moreActive ? 2 : 1.5} />
          Más
        </button>
      </nav>

      <Sheet open={more} onClose={() => setMore(false)} title="Más">
        <ul className="flex flex-col gap-0.5">
          {[NAV[4], NAV[5], { href: "/ajustes", label: "Ajustes", icon: Settings }].map(({ href, label, icon: Icon }) => (
            <li key={href}>
              <Link
                href={href}
                onClick={() => setMore(false)}
                className="flex h-12 items-center gap-3 rounded-[12px] px-3 text-[15px] hover:bg-active"
              >
                <Icon size={18} strokeWidth={1.5} className="text-muted" />
                {label}
              </Link>
            </li>
          ))}
        </ul>
      </Sheet>
    </>
  );
}

function Loading() {
  return (
    <div className="mx-auto w-full max-w-[1100px] px-4 pt-8 md:px-8 lg:pt-[72px]" aria-busy="true" aria-label="Cargando">
      <div className="h-10 w-2/3 max-w-[520px] rounded-[10px] bg-surface" />
      <div className="mt-3 h-4 w-1/3 max-w-[240px] rounded-[6px] bg-surface" />
      <div className="mt-12 grid grid-cols-2 gap-4 md:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-[128px] rounded-[22px] bg-surface" />
        ))}
      </div>
    </div>
  );
}

export function Shell({ children }: { children: ReactNode }) {
  const hydrated = useHydrated();
  const leadForm = useUI((s) => s.leadForm);
  const log = useUI((s) => s.log);

  return (
    <div className="flex min-h-dvh">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <PhoneBars />
        <main className="flex-1 pb-[calc(84px+env(safe-area-inset-bottom))] lg:pb-16">{hydrated ? children : <Loading />}</main>
      </div>
      {hydrated && leadForm.open && <LeadForm />}
      {hydrated && log.open && <LogContact />}
    </div>
  );
}

/** Contenedor estándar de las pantallas internas. */
export function Canvas({ children, narrow = false }: { children: ReactNode; narrow?: boolean }) {
  return (
    <div className={cx("mx-auto w-full px-4 pt-6 md:px-8 lg:pt-9", narrow ? "max-w-[760px]" : "max-w-[1180px]")}>{children}</div>
  );
}

export function useHue(projectId: string | undefined) {
  const project = useStore((s) => s.projects.find((p) => p.id === projectId));
  return project ? HUES[project.hue] : HUES.pizarra;
}

export { Button };
