"use client";

import { useCallback, useEffect, useState } from "react";
import { motion } from "motion/react";
import { Delete, ScanFace } from "lucide-react";
import { biometricLabel, unlockWithBiometrics, unlockWithPin, useLock } from "@/lib/lock";
import { useStore } from "@/lib/store";
import { greeting, isoDay, longDay } from "@/lib/format";
import { haptic } from "@/lib/haptics";
import { Mark } from "./Mark";
import { cx } from "./ui";

const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9"];

/** Teclado numérico grande, pensado para el pulgar. */
export function PinPad({
  length = 4,
  onComplete,
  extraKey,
  disabled = false,
}: {
  length?: number;
  onComplete: (pin: string) => Promise<boolean> | boolean;
  extraKey?: React.ReactNode;
  disabled?: boolean;
}) {
  const [pin, setPin] = useState("");
  const [shake, setShake] = useState(0);

  const press = useCallback(
    async (d: string) => {
      if (disabled) return;
      const next = (pin + d).slice(0, length);
      setPin(next);
      haptic(5);
      if (next.length === length) {
        const ok = await onComplete(next);
        if (!ok) {
          setShake((n) => n + 1);
          haptic([30, 40, 30]);
        }
        setTimeout(() => setPin(""), ok ? 0 : 320);
      }
    },
    [pin, length, onComplete, disabled],
  );

  const back = () => setPin((p) => p.slice(0, -1));

  // Teclado físico en la computadora.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (/^\d$/.test(e.key)) press(e.key);
      else if (e.key === "Backspace") back();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [press]);

  return (
    <div className="flex flex-col items-center">
      <motion.div
        key={shake}
        animate={shake ? { x: [0, -12, 12, -8, 8, -4, 4, 0] } : undefined}
        transition={{ duration: 0.4 }}
        className="mb-10 flex gap-4"
        aria-label={`${pin.length} de ${length} dígitos`}
      >
        {Array.from({ length }, (_, i) => (
          <span
            key={i}
            className={cx(
              "size-3.5 rounded-full transition-[background-color,transform] duration-150",
              i < pin.length ? "scale-110 bg-ink" : "bg-control",
            )}
          />
        ))}
      </motion.div>
      <div className="grid grid-cols-3 gap-x-6 gap-y-4">
        {KEYS.map((k) => (
          <Key key={k} onClick={() => press(k)} disabled={disabled}>
            {k}
          </Key>
        ))}
        <div className="flex size-[76px] items-center justify-center">{extraKey}</div>
        <Key onClick={() => press("0")} disabled={disabled}>
          0
        </Key>
        <button
          type="button"
          onClick={back}
          aria-label="Borrar"
          className="press flex size-[76px] items-center justify-center rounded-full text-muted active:bg-surface"
        >
          <Delete size={26} strokeWidth={1.6} />
        </button>
      </div>
    </div>
  );
}

function Key({ children, onClick, disabled }: { children: React.ReactNode; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="press flex size-[76px] items-center justify-center rounded-full bg-surface font-display text-[30px] font-medium active:bg-active disabled:opacity-40"
    >
      {children}
    </button>
  );
}

/** Bienvenida y candado: aparece al abrir la app y al volver después de un rato. */
export function LockScreen() {
  const seller = useStore((s) => s.settings.sellerName);
  const credentialId = useLock((s) => s.credentialId);
  const blockedUntil = useLock((s) => s.blockedUntil);
  const [now, setNow] = useState(Date.now());
  const [message, setMessage] = useState("");
  const first = seller.split(" ")[0] || seller;
  const bio = biometricLabel();
  const blocked = blockedUntil > now;

  const tryBio = useCallback(async () => {
    const ok = await unlockWithBiometrics();
    if (ok) haptic(10);
  }, []);

  // Intenta Face ID al abrir; si el navegador pide un toque primero, queda el botón.
  useEffect(() => {
    if (!credentialId) return;
    const t = setTimeout(tryBio, 350);
    return () => clearTimeout(t);
  }, [credentialId, tryBio]);

  useEffect(() => {
    if (!blocked) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [blocked]);

  return (
    <motion.div
      className="fixed inset-0 z-[90] flex flex-col items-center justify-center overflow-y-auto bg-ground px-6 pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]"
      exit={{ opacity: 0, scale: 1.02 }}
      transition={{ duration: 0.28, ease: [0.23, 1, 0.32, 1] }}
    >
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.23, 1, 0.32, 1] }}
        className="flex flex-col items-center text-center"
      >
        <Mark size={56} />
        <h1 className="mt-5 font-display text-[28px] leading-tight font-semibold tracking-[-0.02em]">
          {greeting()}, {first}
        </h1>
        <p className="mt-1 text-[15px] text-muted">{longDay(isoDay())}</p>
        <p className={cx("mt-8 mb-5 h-5 text-[15px]", message || blocked ? "text-negative" : "text-muted")}>
          {blocked ? `Demasiados intentos. Espera ${Math.ceil((blockedUntil - now) / 1000)} s` : message || "Escribe tu PIN"}
        </p>
      </motion.div>
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.08, ease: [0.23, 1, 0.32, 1] }}
      >
        <PinPad
          disabled={blocked}
          onComplete={async (pin) => {
            const r = await unlockWithPin(pin);
            setNow(Date.now());
            setMessage(r === "wrong" ? "PIN incorrecto" : "");
            return r === "ok";
          }}
          extraKey={
            credentialId ? (
              <button
                type="button"
                onClick={tryBio}
                aria-label={`Desbloquear con ${bio}`}
                className="press flex size-[76px] items-center justify-center rounded-full text-accent active:bg-surface"
              >
                <ScanFace size={30} strokeWidth={1.6} />
              </button>
            ) : null
          }
        />
      </motion.div>
    </motion.div>
  );
}

/** Bienvenida breve al abrir la app cuando no hay PIN. Se toca para saltarla. */
export function Welcome({ onDone }: { onDone: () => void }) {
  const seller = useStore((s) => s.settings.sellerName);
  const first = seller.split(" ")[0] || seller;
  return (
    <motion.button
      type="button"
      onClick={onDone}
      aria-label="Entrar"
      className="fixed inset-0 z-[90] flex flex-col items-center justify-center bg-ground"
      exit={{ opacity: 0, scale: 1.02 }}
      transition={{ duration: 0.3, ease: [0.23, 1, 0.32, 1] }}
    >
      <motion.span initial={{ opacity: 0, scale: 0.92 }} animate={{ opacity: 1, scale: 1 }} transition={{ type: "spring", duration: 0.5, bounce: 0.25 }}>
        <Mark size={64} />
      </motion.span>
      <motion.span
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.1, ease: [0.23, 1, 0.32, 1] }}
        className="mt-5 font-display text-[26px] font-semibold tracking-[-0.02em]"
      >
        {greeting()}, {first}
      </motion.span>
    </motion.button>
  );
}
