"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Cloud, Lock, MapPinned, ScanFace, Smartphone } from "lucide-react";
import { biometricLabel, biometricsAvailable, enableBiometrics, finishOnboarding, setPin, useLock } from "@/lib/lock";
import { connect, useSync } from "@/lib/sync";
import { useInstall } from "@/lib/install";
import { useStore } from "@/lib/store";
import { haptic } from "@/lib/haptics";
import { Mark } from "./Mark";
import { PinPad } from "./LockScreen";
import { InstallGuide } from "./InstallGuide";
import { Button, cx, Input } from "./ui";

type StepId = "hola" | "pin" | "bio" | "nube" | "datos" | "instalar";

const EASE = [0.23, 1, 0.32, 1] as const;

/** Primera vez en este dispositivo: bienvenida, PIN, Face ID, nube, datos e instalación. */
export function Onboarding() {
  const seller = useStore((s) => s.settings.sellerName);
  const leads = useStore((s) => s.leads);
  const clearDemo = useStore((s) => s.clearDemo);
  const pinHash = useLock((s) => s.pinHash);
  const cloud = useSync((s) => s.enabled);
  const installed = useInstall((s) => s.installed);
  const [bioOk, setBioOk] = useState(false);
  const [index, setIndex] = useState(0);
  const first = seller.split(" ")[0] || seller;

  useEffect(() => {
    biometricsAvailable().then(setBioOk);
  }, []);

  // Se decide al abrir qué pasos tocan, para que la lista no cambie mientras se avanza.
  const [start] = useState(() => ({
    cloud,
    installed,
    demoOnly: leads.some((l) => l.demo) && !leads.some((l) => !l.demo),
  }));

  // Los pasos que no aplican a este teléfono no aparecen.
  const steps = useMemo<StepId[]>(() => {
    const s: StepId[] = ["hola", "pin"];
    if (bioOk) s.push("bio");
    if (!start.cloud) s.push("nube");
    if (start.demoOnly) s.push("datos");
    if (!start.installed) s.push("instalar");
    return s;
  }, [bioOk, start]);

  const step = steps[Math.min(index, steps.length - 1)];
  const next = useCallback(() => {
    setIndex((i) => {
      if (i >= steps.length - 1) {
        finishOnboarding();
        return i;
      }
      return i + 1;
    });
  }, [steps.length]);

  // Sin PIN no tiene sentido Face ID: se salta.
  useEffect(() => {
    if (step === "bio" && !pinHash) next();
  }, [step, pinHash, next]);

  return (
    <div className="fixed inset-0 z-[90] flex flex-col bg-ground pt-[env(safe-area-inset-top)] pb-[max(16px,env(safe-area-inset-bottom))]">
      <div className="flex h-14 flex-none items-center justify-center gap-1.5" aria-label={`Paso ${index + 1} de ${steps.length}`}>
        {steps.map((s, i) => (
          <span key={s} className={cx("h-1.5 rounded-full transition-[width,background-color] duration-300", i === index ? "w-6 bg-ink" : "w-1.5 bg-control")} />
        ))}
      </div>

      <div className="relative flex-1 overflow-hidden">
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.div
            key={step}
            initial={{ opacity: 0, x: 40 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -40 }}
            transition={{ duration: 0.3, ease: EASE }}
            className="absolute inset-0 overflow-y-auto px-6"
          >
            <div className="mx-auto flex min-h-full w-full max-w-[420px] flex-col">
              {step === "hola" && <Hello first={first} onNext={next} />}
              {step === "pin" && <PinStep onNext={next} />}
              {step === "bio" && <BioStep name={seller} onNext={next} />}
              {step === "nube" && <CloudStep onNext={next} />}
              {step === "datos" && (
                <DataStep
                  onEmpty={() => {
                    clearDemo();
                    next();
                  }}
                  onDemo={next}
                />
              )}
              {step === "instalar" && <InstallStep onNext={next} />}
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}

function Header({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) {
  return (
    <div className="pt-6">
      <span className="inline-flex size-14 items-center justify-center rounded-[18px] bg-accent-tint text-accent">{icon}</span>
      <h1 className="mt-5 font-display text-[28px] leading-tight font-semibold tracking-[-0.02em]">{title}</h1>
      <p className="mt-2 text-[16px] leading-relaxed text-muted">{text}</p>
    </div>
  );
}

function Footer({ children }: { children: React.ReactNode }) {
  return <div className="mt-auto flex flex-col gap-2 pt-8 pb-2">{children}</div>;
}

function Skip({ onClick, children = "Ahora no" }: { onClick: () => void; children?: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} className="h-12 text-[15px] font-medium text-muted">
      {children}
    </button>
  );
}

function Hello({ first, onNext }: { first: string; onNext: () => void }) {
  return (
    <>
      <div className="flex flex-1 flex-col justify-center">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, ease: EASE }}>
          <Mark size={72} />
        </motion.div>
        <motion.h1
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, delay: 0.06, ease: EASE }}
          className="mt-7 font-display text-[34px] leading-[1.05] font-semibold tracking-[-0.025em]"
        >
          Hola, {first}.
          <br />
          <span className="text-muted">Tu ruta de ventas, en el bolsillo.</span>
        </motion.h1>
        <motion.ul
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, delay: 0.12, ease: EASE }}
          className="mt-8 flex flex-col gap-4 text-[16px]"
        >
          <li className="flex items-center gap-3">
            <MapPinned size={20} strokeWidth={1.75} className="flex-none text-accent" /> A quién visitar, llamar o escribir hoy
          </li>
          <li className="flex items-center gap-3">
            <Lock size={20} strokeWidth={1.75} className="flex-none text-accent" /> Protegida con PIN y {biometricLabel()}
          </li>
          <li className="flex items-center gap-3">
            <Cloud size={20} strokeWidth={1.75} className="flex-none text-accent" /> Guardada en la nube, en todos tus equipos
          </li>
        </motion.ul>
      </div>
      <Footer>
        <Button variant="primary" className="h-[52px] w-full text-[16px]" onClick={onNext}>
          Empezar
        </Button>
      </Footer>
    </>
  );
}

function PinStep({ onNext }: { onNext: () => void }) {
  const hasPin = useLock((s) => !!s.pinHash);
  const [firstPin, setFirstPin] = useState<string | null>(null);
  const [error, setError] = useState("");
  return (
    <>
      <Header
        icon={<Lock size={26} strokeWidth={1.75} />}
        title={firstPin ? "Repite tu PIN" : hasPin ? "Cambia tu PIN" : "Crea un PIN"}
        text={error || (firstPin ? "Para confirmar que lo recuerdas." : "4 números para que nadie más vea tus clientes si agarra tu teléfono.")}
      />
      <div className="mt-8 flex justify-center">
        <PinPad
          key={firstPin ? "confirm" : "create"}
          onComplete={async (pin) => {
            if (!firstPin) {
              setFirstPin(pin);
              setError("");
              return true;
            }
            if (pin !== firstPin) {
              setFirstPin(null);
              setError("No coincidían. Vuelve a crearlo.");
              return false;
            }
            await setPin(pin);
            haptic(12);
            onNext();
            return true;
          }}
        />
      </div>
      <Footer>
        <Skip onClick={onNext}>{hasPin ? "Mantener el actual" : "Sin PIN por ahora"}</Skip>
      </Footer>
    </>
  );
}

function BioStep({ name, onNext }: { name: string; onNext: () => void }) {
  const [error, setError] = useState("");
  const label = biometricLabel();
  return (
    <>
      <Header
        icon={<ScanFace size={28} strokeWidth={1.75} />}
        title={`Abre con ${label}`}
        text={error || `Así no tienes que escribir el PIN cada vez. El PIN queda de respaldo.`}
      />
      <Footer>
        <Button
          variant="primary"
          className="h-[52px] w-full text-[16px]"
          onClick={async () => {
            const ok = await enableBiometrics(name);
            if (ok) {
              haptic(12);
              onNext();
            } else setError(`No se pudo activar ${label}. Puedes intentarlo luego en Ajustes.`);
          }}
        >
          Activar {label}
        </Button>
        <Skip onClick={onNext} />
      </Footer>
    </>
  );
}

function CloudStep({ onNext }: { onNext: () => void }) {
  const status = useSync((s) => s.status);
  const [clave, setClave] = useState("");
  const [tried, setTried] = useState(false);

  useEffect(() => {
    if (tried && status === "synced") onNext();
  }, [tried, status, onNext]);

  const error =
    tried && status === "unauthorized"
      ? "Esa clave no coincide con la de Vercel."
      : tried && status === "unconfigured"
        ? "La nube aún no está configurada en Vercel. Puedes hacerlo luego."
        : tried && status === "offline"
          ? "Sin conexión. Intenta de nuevo."
          : "";

  return (
    <>
      <Header
        icon={<Cloud size={26} strokeWidth={1.75} />}
        title="Conecta la nube"
        text="Escribe la clave que pusiste en Vercel (CLAVE_ACCESO). Tus datos quedan iguales en el teléfono y la computadora."
      />
      <form
        className="mt-6 flex flex-col gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (!clave.trim()) return;
          setTried(true);
          connect(clave);
        }}
      >
        <Input type="password" value={clave} onChange={(e) => setClave(e.target.value)} placeholder="Clave de acceso" aria-label="Clave de acceso" className="h-12" />
        {error && <p className="text-[14px] text-negative">{error}</p>}
        <Button type="submit" variant="primary" className="mt-2 h-[52px] w-full text-[16px]" disabled={!clave.trim() || status === "syncing"}>
          {status === "syncing" && tried ? "Conectando…" : "Conectar"}
        </Button>
      </form>
      <Footer>
        <Skip onClick={onNext} />
      </Footer>
    </>
  );
}

function DataStep({ onEmpty, onDemo }: { onEmpty: () => void; onDemo: () => void }) {
  return (
    <>
      <Header
        icon={<MapPinned size={26} strokeWidth={1.75} />}
        title="¿Cómo quieres empezar?"
        text="Tus tres proyectos ya están creados: Apps y webs, Mi proyecto y Jabones artesanales."
      />
      <div className="mt-6 flex flex-col gap-2">
        <button type="button" onClick={onEmpty} className="press rounded-[18px] bg-surface p-4 text-left active:bg-active">
          <span className="block text-[16px] font-semibold">Empezar vacío</span>
          <span className="block text-[14px] text-muted">Agrego mis propios prospectos.</span>
        </button>
        <button type="button" onClick={onDemo} className="press rounded-[18px] bg-surface p-4 text-left active:bg-active">
          <span className="block text-[16px] font-semibold">Ver con ejemplos</span>
          <span className="block text-[14px] text-muted">14 negocios de prueba. Se borran con un toque.</span>
        </button>
      </div>
    </>
  );
}

function InstallStep({ onNext }: { onNext: () => void }) {
  const installed = useInstall((s) => s.installed);
  return (
    <>
      <Header
        icon={<Smartphone size={26} strokeWidth={1.75} />}
        title="Ponla en tu pantalla de inicio"
        text="Se abre como una app, a pantalla completa y con su ícono."
      />
      <div className="mt-4">
        <InstallGuide />
      </div>
      <Footer>
        <Button variant="primary" className="h-[52px] w-full text-[16px]" onClick={onNext}>
          {installed ? "Listo" : "Ya la agregué"}
        </Button>
        {!installed && <Skip onClick={onNext}>Lo hago después</Skip>}
      </Footer>
    </>
  );
}
