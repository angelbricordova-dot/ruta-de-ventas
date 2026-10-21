"use client";

import { useRef, useState } from "react";
import { Download, Upload } from "lucide-react";
import { makeBackup, useStore, type Backup } from "@/lib/store";
import { isoDay } from "@/lib/format";
import { Canvas } from "@/components/Shell";
import { Button, Field, Input, PageTitle, Panel } from "@/components/ui";
import { CloudPanel } from "@/components/Cloud";
import { InstallPanel, SecurityPanel } from "@/components/Security";
import { useLock } from "@/lib/lock";
import { useSync } from "@/lib/sync";

export default function SettingsPage() {
  const settings = useStore((s) => s.settings);
  const update = useStore((s) => s.updateSettings);
  const leads = useStore((s) => s.leads);
  const activities = useStore((s) => s.activities);
  const clearDemo = useStore((s) => s.clearDemo);
  const loadDemo = useStore((s) => s.loadDemo);
  const importBackup = useStore((s) => s.importBackup);
  const resetAll = useStore((s) => s.resetAll);
  const file = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState("");
  const [confirmReset, setConfirmReset] = useState(false);
  const cloud = useSync((s) => s.enabled);

  const demoCount = leads.filter((l) => l.demo).length;
  const realCount = leads.length - demoCount;

  const download = () => {
    const blob = new Blob([JSON.stringify(makeBackup(), null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `ruta-de-ventas-${isoDay()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setMessage("Copia descargada.");
  };

  const restore = async (f: File) => {
    try {
      const data = JSON.parse(await f.text()) as Backup;
      if (data.version !== 1 || !Array.isArray(data.leads) || !Array.isArray(data.projects)) throw new Error("formato");
      importBackup(data);
      setMessage(`Copia restaurada: ${data.projects.length} proyectos y ${data.leads.length} prospectos.`);
    } catch {
      setMessage("Ese archivo no es una copia de Ruta de ventas. No se cambió nada.");
    }
  };

  return (
    <Canvas narrow>
      <PageTitle title="Ajustes" />

      <div className="flex flex-col gap-10">
        <SecurityPanel />

        <CloudPanel />

        <InstallPanel />

        <Panel title="Perfil">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Mi nombre" hint="Se usa en el saludo y en los guiones ({vendedor}).">
              {(id) => <Input id={id} value={settings.sellerName} onChange={(e) => update({ sellerName: e.target.value })} />}
            </Field>
            <Field label="Ciudad" hint="Para que Google Maps encuentre las direcciones de la ruta.">
              {(id) => <Input id={id} value={settings.city} onChange={(e) => update({ city: e.target.value })} placeholder="Ej. Lima, Bogotá, Monterrey…" />}
            </Field>
            <Field label="Símbolo de moneda">
              {(id) => <Input id={id} value={settings.currency} onChange={(e) => update({ currency: e.target.value })} className="sm:w-[120px]" maxLength={4} />}
            </Field>
          </div>
        </Panel>

        <Panel title="Copia de seguridad">
          <p className="text-[14px] leading-relaxed text-muted">
            Tienes {realCount} prospectos tuyos y {activities.filter((a) => !a.demo).length} contactos registrados.{" "}
            {cloud
              ? "Ya se guardan en la nube; esta copia es un respaldo extra en un archivo."
              : "Sin la nube viven solo en este navegador: descarga una copia de vez en cuando."}
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button onClick={download}>
              <Download size={16} strokeWidth={1.75} /> Descargar copia
            </Button>
            <Button onClick={() => file.current?.click()}>
              <Upload size={16} strokeWidth={1.75} /> Restaurar copia
            </Button>
            <input
              ref={file}
              type="file"
              accept="application/json,.json"
              hidden
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) restore(f);
                e.target.value = "";
              }}
            />
          </div>
          {message && (
            <p role="status" className="mt-3 text-[13px] text-ink">
              {message}
            </p>
          )}
        </Panel>

        <Panel title="Datos de ejemplo">
          <p className="text-[14px] text-muted">
            {demoCount
              ? `Hay ${demoCount} prospectos de ejemplo. Borrarlos no toca tus proyectos, guiones ni tus propios prospectos.`
              : "No hay datos de ejemplo cargados."}
          </p>
          <div className="mt-4">
            {demoCount ? <Button onClick={clearDemo}>Borrar ejemplos</Button> : <Button onClick={loadDemo}>Cargar ejemplos</Button>}
          </div>
        </Panel>

        <Panel title="Bienvenida">
          <p className="text-[14px] text-muted">Vuelve a ver la guía de inicio: PIN, nube e instalación.</p>
          <div className="mt-4">
            <Button onClick={() => useLock.setState({ onboarded: false })}>Ver la bienvenida otra vez</Button>
          </div>
        </Panel>

        <Panel title="Empezar de cero">
          <p className="text-[14px] text-muted">Borra todo y vuelve a los tres proyectos iniciales con datos de ejemplo.</p>
          <div className="mt-4 flex gap-2">
            {confirmReset ? (
              <>
                <Button
                  variant="danger"
                  onClick={() => {
                    resetAll();
                    setConfirmReset(false);
                    setMessage("");
                  }}
                >
                  Sí, borrar todo
                </Button>
                <Button variant="ghost" onClick={() => setConfirmReset(false)}>
                  Cancelar
                </Button>
              </>
            ) : (
              <Button variant="danger" onClick={() => setConfirmReset(true)}>
                Borrar todo
              </Button>
            )}
          </div>
        </Panel>
      </div>
    </Canvas>
  );
}
