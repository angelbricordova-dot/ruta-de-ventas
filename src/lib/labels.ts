import type { Channel, HueKey, Outcome, ProjectMode, Stage } from "./types";

export const STAGES: Stage[] = [
  "nuevo",
  "contactado",
  "interesado",
  "propuesta",
  "ganado",
  "perdido",
];

export const OPEN_STAGES: Stage[] = ["nuevo", "contactado", "interesado", "propuesta"];

export const STAGE_LABEL: Record<Stage, string> = {
  nuevo: "Por contactar",
  contactado: "Contactado",
  interesado: "Interesado",
  propuesta: "Propuesta enviada",
  ganado: "Cerrado",
  perdido: "Descartado",
};

export const STAGE_TONE: Record<Stage, "neutral" | "accent" | "warning" | "positive" | "muted"> = {
  nuevo: "neutral",
  contactado: "neutral",
  interesado: "accent",
  propuesta: "warning",
  ganado: "positive",
  perdido: "muted",
};

export const CHANNELS: Channel[] = ["visita", "llamada", "whatsapp", "dm", "email"];

export const CHANNEL_LABEL: Record<Channel, string> = {
  visita: "Visita",
  llamada: "Llamada",
  whatsapp: "WhatsApp",
  dm: "DM",
  email: "Correo",
};

/** Verbo para la próxima acción: "Visitar Taller Ruiz". */
export const CHANNEL_VERB: Record<Channel, string> = {
  visita: "Visitar",
  llamada: "Llamar",
  whatsapp: "Escribir por WhatsApp",
  dm: "Mandar DM",
  email: "Enviar correo",
};

/** Los tres carriles de la ruta del día. */
export type Lane = "pie" | "telefono" | "mensajes";

export const LANE_OF: Record<Channel, Lane> = {
  visita: "pie",
  llamada: "telefono",
  whatsapp: "mensajes",
  dm: "mensajes",
  email: "mensajes",
};

export const LANE_LABEL: Record<Lane, string> = {
  pie: "A pie",
  telefono: "Llamadas",
  mensajes: "Mensajes y DMs",
};

export const OUTCOMES: Outcome[] = [
  "sin_respuesta",
  "contactado",
  "volver_luego",
  "interesado",
  "propuesta",
  "venta",
  "no_interesado",
];

export const OUTCOME_LABEL: Record<Outcome, string> = {
  sin_respuesta: "No contestó",
  contactado: "Hablamos",
  volver_luego: "Volver luego",
  interesado: "Le interesa",
  propuesta: "Pidió propuesta",
  venta: "Compró",
  no_interesado: "No le interesa",
};

/** Etapa a la que pasa el prospecto según el resultado del contacto. */
export function stageAfter(current: Stage, outcome: Outcome): Stage {
  const rank = STAGES.indexOf(current);
  const lift = (to: Stage) => (STAGES.indexOf(to) > rank && current !== "perdido" ? to : current);
  switch (outcome) {
    case "venta":
      return "ganado";
    case "no_interesado":
      return "perdido";
    case "propuesta":
      return lift("propuesta");
    case "interesado":
      return lift("interesado");
    case "sin_respuesta":
    case "contactado":
    case "volver_luego":
      return current === "nuevo" ? "contactado" : current;
  }
}

export const MODE_LABEL: Record<ProjectMode, string> = {
  digital: "Digital",
  presencial: "Presencial",
  mixto: "Mixto",
};

export const HUES: Record<HueKey, { ink: string; tint: string; line: string; label: string }> = {
  teal: { ink: "#1b6e66", tint: "#e3f1ef", line: "#bcdcd7", label: "Verde azulado" },
  azul: { ink: "#2257a8", tint: "#e6eefa", line: "#c3d4f0", label: "Azul" },
  oliva: { ink: "#5f6b17", tint: "#eef1dc", line: "#d4dbaa", label: "Oliva" },
  ambar: { ink: "#9a5208", tint: "#fbefdf", line: "#efd2a8", label: "Ámbar" },
  rosa: { ink: "#a3325b", tint: "#f8e6ec", line: "#ecc1d0", label: "Rosa" },
  pizarra: { ink: "#46525e", tint: "#eceff2", line: "#d0d6dc", label: "Pizarra" },
};

export const NICHES = [
  "Taller mecánico",
  "Odontólogo",
  "Gimnasio",
  "Veterinaria",
  "Barbería",
  "Peluquería",
  "Spa y estética",
  "Restaurante",
  "Cafetería",
  "Panadería",
  "Farmacia",
  "Clínica",
  "Abogado",
  "Contador",
  "Inmobiliaria",
  "Ferretería",
  "Tienda de ropa",
  "Academia",
  "Hotel",
  "Minimarket",
  "Tienda naturista",
  "Tienda de regalos",
  "Proveedor",
];
