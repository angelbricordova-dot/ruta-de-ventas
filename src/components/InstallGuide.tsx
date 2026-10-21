"use client";

import { Check, EllipsisVertical, Share, SquarePlus } from "lucide-react";
import type { ReactNode } from "react";
import { installNow, useInstall } from "@/lib/install";
import { Button } from "./ui";

function Step({ n, icon, children }: { n: number; icon: ReactNode; children: ReactNode }) {
  return (
    <li className="flex items-center gap-3.5 py-3">
      <span className="tabular inline-flex size-7 flex-none items-center justify-center rounded-full bg-ink text-[13px] font-semibold text-white">
        {n}
      </span>
      <span className="flex-1 text-[15px] leading-snug">{children}</span>
      <span className="inline-flex size-11 flex-none items-center justify-center rounded-[12px] bg-surface text-accent">{icon}</span>
    </li>
  );
}

/** Cómo poner la app en la pantalla de inicio, según el teléfono. */
export function InstallGuide() {
  const { installed, platform, iosBrowser, prompt } = useInstall();

  if (installed) {
    return (
      <p className="flex items-center gap-2 rounded-[16px] bg-surface px-4 py-3.5 text-[15px]">
        <Check size={18} strokeWidth={2.2} className="text-positive" /> Ya está instalada en este teléfono.
      </p>
    );
  }

  if (platform === "ios") {
    return (
      <div>
        <ol className="divide-y divide-rule">
          <Step n={1} icon={<Share size={20} strokeWidth={1.8} />}>
            Toca <b className="font-semibold">Compartir</b>
            <span className="block text-[13px] text-muted">
              {iosBrowser === "safari" ? "El cuadrito con flecha, abajo en Safari" : "Arriba a la derecha en Chrome o Firefox"}
            </span>
          </Step>
          <Step n={2} icon={<SquarePlus size={20} strokeWidth={1.8} />}>
            Elige <b className="font-semibold">Agregar a inicio</b>
            <span className="block text-[13px] text-muted">Si no lo ves, desliza la lista hacia arriba</span>
          </Step>
          <Step n={3} icon={<Check size={20} strokeWidth={2} />}>
            Toca <b className="font-semibold">Agregar</b>. El ícono azul queda en tu pantalla.
          </Step>
        </ol>
      </div>
    );
  }

  if (platform === "android") {
    return prompt ? (
      <div className="flex flex-col gap-3">
        <p className="text-[15px] text-muted">Queda como una app más, con su ícono y a pantalla completa.</p>
        <Button variant="primary" className="h-12 w-full" onClick={() => installNow()}>
          Instalar app
        </Button>
      </div>
    ) : (
      <ol className="divide-y divide-rule">
        <Step n={1} icon={<EllipsisVertical size={20} strokeWidth={1.8} />}>
          Toca el <b className="font-semibold">menú de tres puntos</b> de Chrome, arriba a la derecha
        </Step>
        <Step n={2} icon={<SquarePlus size={20} strokeWidth={1.8} />}>
          Elige <b className="font-semibold">Instalar app</b> o <b className="font-semibold">Agregar a la pantalla principal</b>
        </Step>
        <Step n={3} icon={<Check size={20} strokeWidth={2} />}>
          Confirma. El ícono azul queda con tus apps.
        </Step>
      </ol>
    );
  }

  return (
    <p className="rounded-[16px] bg-surface px-4 py-3.5 text-[15px] leading-relaxed text-muted">
      Abre <b className="font-medium text-ink">{typeof location !== "undefined" ? location.host : "este enlace"}</b> en tu celular y
      vuelve a esta pantalla: ahí te aparecen los pasos para tu teléfono.
    </p>
  );
}
