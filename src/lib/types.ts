export type Channel = "visita" | "llamada" | "whatsapp" | "dm" | "email";

export type Stage =
  | "nuevo"
  | "contactado"
  | "interesado"
  | "propuesta"
  | "ganado"
  | "perdido";

export type Outcome =
  | "sin_respuesta"
  | "contactado"
  | "interesado"
  | "volver_luego"
  | "propuesta"
  | "venta"
  | "no_interesado";

export type ProjectMode = "digital" | "presencial" | "mixto";

export type HueKey = "teal" | "azul" | "oliva" | "ambar" | "rosa" | "pizarra";

export interface Offer {
  id: string;
  name: string;
  price: number;
}

export interface Project {
  id: string;
  name: string;
  /** Quién produce lo que se vende: "Luis Enrique", "Yo", un proveedor… */
  owner: string;
  description: string;
  hue: HueKey;
  mode: ProjectMode;
  channels: Channel[];
  offers: Offer[];
  niches: string[];
  /** Meta de ventas cerradas por mes, en la moneda de ajustes. */
  monthlyGoal: number;
  archived: boolean;
  createdAt: string;
}

export interface NextAction {
  channel: Channel;
  /** YYYY-MM-DD */
  date: string;
  note: string;
}

export interface Lead {
  id: string;
  projectId: string;
  business: string;
  niche: string;
  contactName: string;
  phone: string;
  instagram: string;
  email: string;
  address: string;
  zone: string;
  stage: Stage;
  /** Valor estimado de la venta. 0 = sin estimar. */
  value: number;
  offerId: string | null;
  nextAction: NextAction | null;
  /** Orden dentro de la ruta a pie del día. */
  routeOrder: number;
  notes: string;
  createdAt: string;
  updatedAt: string;
  demo?: boolean;
}

export interface Activity {
  id: string;
  leadId: string;
  projectId: string;
  channel: Channel;
  outcome: Outcome;
  note: string;
  /** Monto cobrado cuando outcome = venta. */
  amount: number;
  at: string;
  demo?: boolean;
}

export interface Script {
  id: string;
  projectId: string | null;
  channel: Channel;
  title: string;
  body: string;
}

export interface Settings {
  sellerName: string;
  currency: string;
  /** Ciudad base para las búsquedas en el mapa. */
  city: string;
}
