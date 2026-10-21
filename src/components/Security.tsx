"use client";

import { useEffect, useState } from "react";
import { Lock, ScanFace } from "lucide-react";
import {
  biometricLabel,
  biometricsAvailable,
  disableBiometrics,
  enableBiometrics,
  lockNow,
  removeLock,
  setAutoLock,
  setPin,
  useLock,
} from "@/lib/lock";
import { useStore } from "@/lib/store";
import { haptic } from "@/lib/haptics";
import { toast } from "sonner";
import { PinPad } from "./LockScreen";
import { InstallGuide } from "./InstallGuide";
import { Button, Chips, Panel, Sheet } from "./ui";

function NewPinSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [first, setFirst] = useState<string | null>(null);
  const [error, setError] = useState("");
  return (
    <Sheet open={open} onClose={onClose} title={first ? "Repite el PIN" : "Nuevo PIN"}>
      <p className="mb-6 text-center text-[15px] text-muted">{error || (first ? "Para confirmar." : "Elige 4 números.")}</p>
      <div className="flex justify-center pb-4">
        <PinPad
          key={first ? "b" : "a"}
          onComplete={async (pin) => {
            if (!first) {
              setFirst(pin);
              setError("");
              return true;
            }
            if (pin !== first) {
              setFirst(null);
              setError("No coincidían. Vuelve a crearlo.");
              return false;
            }
            await setPin(pin);
            haptic(12);
            toast("PIN guardado");
            onClose();
            return true;
          }}
        />
      </div>
    </Sheet>
  );
}

export function SecurityPanel() {
  const seller = useStore((s) => s.settings.sellerName);
  const pinHash = useLock((s) => s.pinHash);
  const credentialId = useLock((s) => s.credentialId);
  const autoLockMin = useLock((s) => s.autoLockMin);
  const [bioOk, setBioOk] = useState(false);
  const [pinSheet, setPinSheet] = useState({ open: false, n: 0 });
  const [confirmRemove, setConfirmRemove] = useState(false);
  const label = biometricLabel();

  useEffect(() => {
    biometricsAvailable().then(setBioOk);
  }, []);

  return (
    <Panel title="Seguridad" bodyClassName="flex flex-col gap-4">
      <div className="flex items-center gap-3 rounded-[16px] bg-surface px-4 py-3">
        <Lock size={20} strokeWidth={1.75} className={pinHash ? "text-accent" : "text-faint"} />
        <div className="min-w-0 flex-1">
          <p className="text-[15px] font-medium">{pinHash ? "Protegida con PIN" : "Sin PIN"}</p>
          <p className="text-[13px] text-muted">
            {pinHash
              ? credentialId
                ? `Se abre con ${label} o con el PIN.`
                : "Se pide al abrir la app."
              : "Cualquiera que tenga tu teléfono puede ver tus clientes."}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button variant={pinHash ? "secondary" : "primary"} onClick={() => setPinSheet((s) => ({ open: true, n: s.n + 1 }))}>
          {pinHash ? "Cambiar PIN" : "Crear PIN"}
        </Button>
        {pinHash && bioOk && (
          <Button
            onClick={async () => {
              if (credentialId) {
                disableBiometrics();
                toast(`${label} desactivado`);
              } else if (await enableBiometrics(seller)) {
                haptic(12);
                toast(`${label} activado`);
              } else toast(`No se pudo activar ${label}`);
            }}
          >
            <ScanFace size={17} strokeWidth={1.75} /> {credentialId ? `Quitar ${label}` : `Activar ${label}`}
          </Button>
        )}
        {pinHash && <Button onClick={lockNow}>Bloquear ahora</Button>}
      </div>

      {pinHash && (
        <div className="flex flex-col gap-2">
          <span className="text-[13px] font-medium text-muted">Volver a pedirlo después de salir de la app</span>
          <Chips
            label="Bloqueo automático"
            value={String(autoLockMin)}
            onChange={(v) => setAutoLock(Number(v))}
            options={[
              { value: "0", label: "Siempre" },
              { value: "1", label: "1 min" },
              { value: "5", label: "5 min" },
              { value: "15", label: "15 min" },
            ]}
          />
        </div>
      )}

      {pinHash &&
        (confirmRemove ? (
          <div className="flex gap-2">
            <Button
              variant="danger"
              onClick={() => {
                removeLock();
                setConfirmRemove(false);
              }}
            >
              Sí, quitar el PIN
            </Button>
            <Button variant="ghost" onClick={() => setConfirmRemove(false)}>
              Cancelar
            </Button>
          </div>
        ) : (
          <button type="button" onClick={() => setConfirmRemove(true)} className="self-start text-[14px] font-medium text-muted">
            Quitar el PIN
          </button>
        ))}

      {pinSheet.n > 0 && <NewPinSheet key={pinSheet.n} open={pinSheet.open} onClose={() => setPinSheet((s) => ({ ...s, open: false }))} />}
    </Panel>
  );
}

export function InstallPanel() {
  return (
    <Panel title="Instalar en el teléfono" className="scroll-mt-20">
      <span id="instalar" />
      <InstallGuide />
    </Panel>
  );
}
