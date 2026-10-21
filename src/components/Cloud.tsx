"use client";

import Link from "next/link";
import { useState } from "react";
import { Cloud, CloudOff, RefreshCw } from "lucide-react";
import { connect, disconnect, syncNow, useSync, type SyncStatus } from "@/lib/sync";
import { when } from "@/lib/format";
import { Button, cx, Field, Input, Panel } from "./ui";

const LABEL: Record<SyncStatus, string> = {
  off: "Solo en este teléfono",
  syncing: "Guardando…",
  synced: "Guardado en la nube",
  offline: "Sin conexión",
  error: "Error al guardar",
  unauthorized: "Clave incorrecta",
  unconfigured: "Nube sin configurar",
};

/** Indicador pequeño para la barra superior. */
export function SyncBadge({ className }: { className?: string }) {
  const status = useSync((s) => s.status);
  const bad = status === "error" || status === "unauthorized" || status === "unconfigured";
  // Solo aparece cuando hay algo que atender; si todo va bien, no ocupa espacio.
  if (!bad && status !== "offline") return null;
  return (
    <Link
      href="/ajustes#nube"
      aria-label={LABEL[status]}
      title={LABEL[status]}
      className={cx(
        "press relative inline-flex size-9 flex-none items-center justify-center rounded-full hover:bg-active",
        bad ? "text-negative" : "text-faint",
        className,
      )}
    >
      <CloudOff size={18} strokeWidth={1.75} />
    </Link>
  );
}

export function CloudPanel() {
  const { status, lastSynced, message, enabled } = useSync();
  const [clave, setClave] = useState("");
  const bad = status === "error" || status === "unauthorized" || status === "unconfigured";

  return (
    <Panel title="Nube" className="scroll-mt-20" bodyClassName="flex flex-col gap-4">
      <div id="nube" className="flex items-center gap-3 rounded-[14px] bg-raised px-4 py-3 ring-1 ring-border">
        {status === "off" ? <CloudOff size={20} strokeWidth={1.75} className="text-faint" /> : <Cloud size={20} strokeWidth={1.75} className={bad ? "text-negative" : "text-accent"} />}
        <div className="min-w-0 flex-1">
          <p className={cx("text-[15px] font-medium", bad && "text-negative")}>{LABEL[status]}</p>
          <p className="text-[13px] text-muted">
            {message ||
              (enabled
                ? lastSynced
                  ? `Última vez: ${when(lastSynced)}`
                  : "Conectando…"
                : "Conéctala para tener los mismos datos en el teléfono y la computadora, y no perderlos.")}
          </p>
        </div>
        {enabled && (
          <button
            type="button"
            onClick={() => syncNow()}
            className="press inline-flex size-10 flex-none items-center justify-center rounded-full text-muted hover:bg-active hover:text-ink"
            aria-label="Sincronizar ahora"
          >
            <RefreshCw size={17} strokeWidth={1.75} className={status === "syncing" ? "animate-spin" : ""} />
          </button>
        )}
      </div>

      {(!enabled || status === "unauthorized") && (
        <form
          className="flex flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (clave.trim()) connect(clave);
          }}
        >
          <Field label="Clave de acceso" hint="La misma que pusiste en Vercel como CLAVE_ACCESO. Se pide una sola vez en cada dispositivo.">
            {(id) => (
              <Input id={id} type="password" autoComplete="current-password" value={clave} onChange={(e) => setClave(e.target.value)} />
            )}
          </Field>
          <Button type="submit" variant="primary" disabled={!clave.trim()} className="self-start">
            Conectar
          </Button>
        </form>
      )}

      {status === "unconfigured" && (
        <ol className="list-decimal space-y-1 pl-5 text-[13.5px] text-muted">
          <li>En Vercel, abre el proyecto y entra en Storage.</li>
          <li>Crea una base Upstash for Redis (plan gratis) y conéctala al proyecto.</li>
          <li>En Settings → Environment Variables agrega CLAVE_ACCESO con una clave tuya.</li>
          <li>Vuelve a publicar (Deployments → Redeploy).</li>
        </ol>
      )}

      {enabled && (
        <button type="button" onClick={disconnect} className="self-start text-[13px] font-medium text-muted hover:text-ink">
          Desconectar este dispositivo
        </button>
      )}
    </Panel>
  );
}
