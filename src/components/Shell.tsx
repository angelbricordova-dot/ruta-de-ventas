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
import { SyncBadge } from "./Cloud";
import { Mark } from "./Mark";
export { Mark };
import { startSync } from "@/lib/sync";
import { AnimatePresence, MotionConfig } from "motion/react";
import { startLock, useLock } from "@/lib/lock";
import { startInstall } from "@/lib/install";
import { LockScreen, Welcome } from "./LockScreen";
import { Onboarding } from "./Onboarding";
import { Toaster } from "sonner";

const NAV = [
  { href: "/", label: "Hoy", icon: Home },
  { href: "/ruta", label: "Ruta", icon: Map },
  { href: "/prospectos", label: "Prospectos", icon: Users },
  { href: "/embudo", label: "Embudo", icon: Columns3 },
  { href: "/proyectos", label: "Proyectos", icon: FolderKanban },
  { href: "/guiones", label: "Guiones", icon: MessageSquareText },
];

const isActive = (pathname: string, href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));

function useHydrated() {
  const [ok, setOk] = useState(false);
  useEffect(() => {
    const done = () => {
      setOk(true);
      startSync();
    };
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
          "press flex min-w-0 items-center gap-1.5 rounded-full px-2.5 text-[14px] font-medium text-muted hover:bg-active hover:text-ink",
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
          <span className="block font-display text-[15px] font-semibold tracking-[-0.01em]">Ruta de ventas</span>
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
        <SyncBadge className="mb-1" />
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

/** Barra inferior: Hoy, Ruta, [+], Prospectos, Más. El + queda bajo el pulgar. */
const TABS_LEFT = [NAV[0], NAV[1]];
const TABS_RIGHT = [NAV[2]];
const MORE = [NAV[3], NAV[4], NAV[5], { href: "/ajustes", label: "Ajustes", icon: Settings }];

function Tab({ href, label, icon: Icon, on }: { href: string; label: string; icon: typeof Home; on: boolean }) {
  return (
    <Link
      href={href}
      aria-current={on ? "page" : undefined}
      className={cx("flex h-[60px] flex-col items-center justify-center gap-1 text-[11px] font-medium", on ? "text-ink" : "text-faint")}
    >
      <Icon size={22} strokeWidth={on ? 2 : 1.6} />
      {label}
    </Link>
  );
}

function PhoneBars() {
  const pathname = usePathname();
  const openLeadForm = useUI((s) => s.openLeadForm);
  const [more, setMore] = useState(false);
  const moreActive = MORE.some((t) => isActive(pathname, t.href));

  return (
    <>
      <header className="sticky top-0 z-30 border-b border-rule bg-[rgba(255,255,255,0.97)] pt-[env(safe-area-inset-top)] lg:hidden">
        <div className="flex h-14 items-center gap-2.5 px-4">
          <Link href="/" aria-label="Inicio" className="flex-none">
            <Mark size={30} />
          </Link>
          <span className="mr-auto truncate font-display text-[18px] font-semibold tracking-[-0.01em]">
            Ruta de ventas
          </span>
          <SyncBadge />
          <ScopeButton className="h-9 max-w-[42vw]" />
        </div>
      </header>

      <nav
        className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 items-center border-t border-rule bg-[rgba(255,255,255,0.98)] pb-[env(safe-area-inset-bottom)] lg:hidden"
        aria-label="Navegación"
      >
        {TABS_LEFT.map((t) => (
          <Tab key={t.href} {...t} on={isActive(pathname, t.href)} />
        ))}
        <div className="flex justify-center">
          <button
            type="button"
            onClick={() => openLeadForm()}
            className="press inline-flex size-[52px] items-center justify-center rounded-full bg-ink text-white shadow-[0_4px_14px_rgba(31,32,29,0.28)]"
            aria-label="Nuevo prospecto"
          >
            <Plus size={24} strokeWidth={2.2} />
          </button>
        </div>
        {TABS_RIGHT.map((t) => (
          <Tab key={t.href} {...t} on={isActive(pathname, t.href)} />
        ))}
        <button
          type="button"
          onClick={() => setMore(true)}
          className={cx("flex h-[60px] flex-col items-center justify-center gap-1 text-[11px] font-medium", moreActive ? "text-ink" : "text-faint")}
        >
          <MoreHorizontal size={22} strokeWidth={moreActive ? 2 : 1.6} />
          Más
        </button>
      </nav>

      <Sheet open={more} onClose={() => setMore(false)} title="Más">
        <ul className="flex flex-col gap-1">
          {MORE.map(({ href, label, icon: Icon }) => (
            <li key={href}>
              <Link
                href={href}
                onClick={() => setMore(false)}
                className={cx(
                  "flex h-14 items-center gap-3.5 rounded-[14px] px-3 text-[16px]",
                  isActive(pathname, href) ? "bg-active font-medium" : "hover:bg-active",
                )}
              >
                <Icon size={20} strokeWidth={1.6} className="text-muted" />
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
  const lockReady = useLock((s) => s.ready);
  const locked = useLock((s) => s.locked);
  const onboarded = useLock((s) => s.onboarded);
  const hasPin = useLock((s) => !!s.pinHash);
  const [splash, setSplash] = useState(false);

  useEffect(() => {
    startLock();
    startInstall();
  }, []);

  // Sin PIN, una bienvenida breve al abrir la app (una vez por sesión).
  useEffect(() => {
    if (!lockReady || !onboarded || hasPin) return;
    try {
      if (sessionStorage.getItem("ruta-de-ventas:hola")) return;
      sessionStorage.setItem("ruta-de-ventas:hola", "1");
    } catch {
      /* sin sessionStorage */
    }
    setSplash(true);
    const t = setTimeout(() => setSplash(false), 1100);
    return () => clearTimeout(t);
  }, [lockReady, onboarded, hasPin]);

  const ready = hydrated && lockReady;
  // Con candado puesto, la app no se dibuja detrás: nada se asoma.
  const hidden = !ready || !onboarded || locked;

  return (
    <MotionConfig reducedMotion="user">
    <div className="flex min-h-dvh">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <PhoneBars />
        <main className="flex-1 pb-[calc(96px+env(safe-area-inset-bottom))] lg:pb-16">{hidden ? <Loading /> : children}</main>
      </div>
      {!hidden && leadForm.nonce > 0 && <LeadForm key={`lead-${leadForm.nonce}`} />}
      {!hidden && log.nonce > 0 && <LogContact key={`log-${log.nonce}`} />}
      {ready && !onboarded && <Onboarding />}
      <AnimatePresence>
        {ready && onboarded && locked && <LockScreen key="lock" />}
        {splash && !locked && <Welcome key="hola" onDone={() => setSplash(false)} />}
      </AnimatePresence>
      <Toaster
        position="top-center"
        offset={{ top: 24 }}
        mobileOffset={{ top: "calc(env(safe-area-inset-top) + 64px)", left: 12, right: 12 }}
        duration={4500}
        toastOptions={{
          style: {
            fontFamily: "var(--font-sans)",
            borderRadius: 18,
            border: "1px solid var(--border)",
            boxShadow: "0 10px 30px rgba(0,0,0,0.10)",
            fontSize: 15,
          },
          classNames: { actionButton: "!bg-ink !text-white !rounded-full !h-8 !px-3.5 !text-[13px] !font-medium" },
        }}
      />
    </div>
    </MotionConfig>
  );
}

/** Contenedor estándar de las pantallas internas. */
export function Canvas({ children, narrow = false }: { children: ReactNode; narrow?: boolean }) {
  return (
    <div className={cx("mx-auto w-full px-4 pt-5 md:px-8 lg:pt-9", narrow ? "max-w-[760px]" : "max-w-[1180px]")}>{children}</div>
  );
}

export function useHue(projectId: string | undefined) {
  const project = useStore((s) => s.projects.find((p) => p.id === projectId));
  return project ? HUES[project.hue] : HUES.pizarra;
}

export { Button };
