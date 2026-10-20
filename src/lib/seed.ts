import { addDays, isoDay } from "./format";
import type { Activity, Lead, Project, Script, Settings } from "./types";

export const DEFAULT_SETTINGS: Settings = {
  sellerName: "Alejandro Lamont",
  currency: "$",
  city: "",
};

export const PROJECT_LUIS = "p-luis";
export const PROJECT_PROPIO = "p-propio";
export const PROJECT_JABONES = "p-jabones";

export function seedProjects(): Project[] {
  const now = new Date().toISOString();
  return [
    {
      id: PROJECT_LUIS,
      name: "Apps y webs",
      owner: "Luis Enrique",
      description:
        "Luis Enrique construye; yo vendo. Páginas web, micro apps y sistemas para negocios de barrio.",
      hue: "teal",
      mode: "mixto",
      channels: ["visita", "llamada", "whatsapp", "dm"],
      offers: [
        { id: "o-web", name: "Página web", price: 350 },
        { id: "o-micro", name: "Micro app", price: 600 },
        { id: "o-sistema", name: "Sistema a medida", price: 1500 },
      ],
      niches: ["Taller mecánico", "Odontólogo", "Gimnasio", "Veterinaria", "Barbería", "Restaurante"],
      monthlyGoal: 2000,
      archived: false,
      createdAt: now,
    },
    {
      id: PROJECT_PROPIO,
      name: "Mi proyecto",
      owner: "Yo",
      description: "Mi proyecto propio. Edítalo para poner qué vendo, a quién y a qué precio.",
      hue: "azul",
      mode: "mixto",
      channels: ["visita", "llamada", "whatsapp", "dm", "email"],
      offers: [],
      niches: [],
      monthlyGoal: 0,
      archived: false,
      createdAt: now,
    },
    {
      id: PROJECT_JABONES,
      name: "Jabones artesanales",
      owner: "Yo",
      description:
        "Venta en persona: proveedores de insumos y negocios que revendan los jabones.",
      hue: "oliva",
      mode: "presencial",
      channels: ["visita", "llamada", "whatsapp"],
      offers: [
        { id: "o-jabon", name: "Jabón 100 g", price: 4 },
        { id: "o-caja", name: "Caja de 12 (mayorista)", price: 36 },
      ],
      niches: ["Tienda naturista", "Spa y estética", "Hotel", "Minimarket", "Tienda de regalos", "Proveedor"],
      monthlyGoal: 300,
      archived: false,
      createdAt: now,
    },
  ];
}

export function seedScripts(): Script[] {
  return [
    {
      id: "s-luis-llamada",
      projectId: PROJECT_LUIS,
      channel: "llamada",
      title: "Llamada en frío",
      body:
        "Hola, ¿hablo con el encargado de {negocio}? Soy {vendedor}. Trabajo con negocios de {zona} ayudándoles a conseguir más clientes por internet.\n\n" +
        "Vi que {negocio} todavía no tiene página web propia. Le hago una pregunta rápida: ¿cómo los encuentran hoy los clientes nuevos?\n\n" +
        "[Escuchar]\n\n" +
        "Le propongo algo sencillo: le muestro en 10 minutos cómo quedaría la página de {negocio}, sin compromiso. ¿Le queda mejor mañana en la mañana o en la tarde?",
    },
    {
      id: "s-luis-dm",
      projectId: PROJECT_LUIS,
      channel: "dm",
      title: "Primer DM en Instagram",
      body:
        "Hola {contacto}, vi el perfil de {negocio} y me gustó mucho lo que hacen. Soy {vendedor}: con mi socio armamos páginas web y apps para negocios como el suyo, para que los clientes reserven o pidan sin escribir por DM.\n\n" +
        "¿Le puedo mandar un ejemplo de cómo quedaría para {negocio}? Son 2 minutos.",
    },
    {
      id: "s-luis-whatsapp",
      projectId: PROJECT_LUIS,
      channel: "whatsapp",
      title: "Seguimiento por WhatsApp",
      body:
        "Hola {contacto}, soy {vendedor}, hablamos sobre la página web para {negocio}. Le dejo el ejemplo que le comenté. ¿Tiene 10 minutos esta semana para verlo juntos?",
    },
    {
      id: "s-luis-visita",
      projectId: PROJECT_LUIS,
      channel: "visita",
      title: "Visita en persona",
      body:
        "Saludar y preguntar por el dueño o encargado.\n\n" +
        "1. Presentarme: \"Soy {vendedor}, trabajo con negocios de {zona}.\"\n" +
        "2. Pregunta: \"¿Cómo les llegan los clientes nuevos hoy?\"\n" +
        "3. Mostrar en el teléfono un ejemplo de página de otro {rubro}.\n" +
        "4. Cerrar con una cita: \"¿Le muestro cómo quedaría la suya el jueves?\"\n" +
        "5. Dejar tarjeta y pedir WhatsApp.",
    },
    {
      id: "s-jabones-visita",
      projectId: PROJECT_JABONES,
      channel: "visita",
      title: "Propuesta a una tienda",
      body:
        "Llevar 3 muestras y la lista de precios.\n\n" +
        "\"Hola, soy {vendedor}. Hago jabones artesanales y busco tiendas en {zona} que los quieran vender. Le dejo una muestra para que la pruebe.\"\n\n" +
        "Ofrecer la caja de 12 a precio mayorista y una primera entrega a consignación si duda.",
    },
    {
      id: "s-jabones-proveedor",
      projectId: PROJECT_JABONES,
      channel: "whatsapp",
      title: "Consulta a proveedor",
      body:
        "Hola, soy {vendedor}. Hago jabones artesanales y busco proveedor de insumos. ¿Me puede pasar precios por volumen y si hacen entregas en {zona}?",
    },
  ];
}

/**
 * Prospectos de ejemplo para ver la app con datos. Están marcados con `demo`
 * y se borran juntos desde Ajustes. Los teléfonos usan el rango 555-01xx,
 * reservado para ficción, para no llamar a nadie real por error.
 */
export function seedDemo(today = isoDay()): { leads: Lead[]; activities: Activity[] } {
  const t = (d: number) => addDays(today, d);
  const at = (d: number, h: number, m: number) => {
    const [y, mo, da] = t(d).split("-").map(Number);
    return new Date(y, mo - 1, da, h, m).toISOString();
  };
  const created = at(-12, 9, 0);

  const base = {
    contactName: "",
    phone: "",
    instagram: "",
    email: "",
    address: "",
    zone: "",
    value: 0,
    offerId: null,
    nextAction: null,
    routeOrder: 0,
    notes: "",
    createdAt: created,
    updatedAt: created,
    demo: true,
  } satisfies Partial<Lead>;

  const leads: Lead[] = [
    {
      ...base,
      id: "d-1",
      projectId: PROJECT_LUIS,
      business: "Taller Hermanos Ruiz",
      niche: "Taller mecánico",
      contactName: "Mario Ruiz",
      phone: "555 0101",
      address: "Av. Los Olivos 245",
      zone: "Centro",
      stage: "interesado",
      value: 350,
      offerId: "o-web",
      nextAction: { channel: "visita", date: t(0), note: "Mostrarle el ejemplo de página" },
      routeOrder: 1,
      notes: "Atiende de 8 a 13. Quiere que los clientes vean los precios de servicio.",
    },
    {
      ...base,
      id: "d-2",
      projectId: PROJECT_LUIS,
      business: "Clínica Dental Sonríe",
      niche: "Odontólogo",
      contactName: "Dra. Patricia Vega",
      phone: "555 0102",
      instagram: "@dentalsonrie",
      address: "Jr. Libertad 118, of. 3",
      zone: "Centro",
      stage: "nuevo",
      value: 600,
      offerId: "o-micro",
      nextAction: { channel: "visita", date: t(0), note: "Presentarme, ofrecer reservas en línea" },
      routeOrder: 2,
    },
    {
      ...base,
      id: "d-3",
      projectId: PROJECT_JABONES,
      business: "Naturaleza Viva",
      niche: "Tienda naturista",
      contactName: "Rosa",
      phone: "555 0103",
      address: "Calle Real 560",
      zone: "Centro",
      stage: "contactado",
      value: 72,
      offerId: "o-caja",
      nextAction: { channel: "visita", date: t(0), note: "Llevar 3 muestras de lavanda" },
      routeOrder: 3,
    },
    {
      ...base,
      id: "d-4",
      projectId: PROJECT_LUIS,
      business: "Gimnasio Fuerza Norte",
      niche: "Gimnasio",
      contactName: "Kevin Paredes",
      phone: "555 0104",
      instagram: "@fuerzanorte.gym",
      zone: "Zona Norte",
      stage: "contactado",
      value: 600,
      offerId: "o-micro",
      nextAction: { channel: "llamada", date: t(0), note: "Confirmar si quiere control de membresías" },
    },
    {
      ...base,
      id: "d-5",
      projectId: PROJECT_LUIS,
      business: "Veterinaria Patitas",
      niche: "Veterinaria",
      contactName: "Dr. Luis Salas",
      phone: "555 0105",
      zone: "Zona Sur",
      stage: "nuevo",
      value: 350,
      offerId: "o-web",
      nextAction: { channel: "llamada", date: t(0), note: "Primera llamada" },
    },
    {
      ...base,
      id: "d-6",
      projectId: PROJECT_LUIS,
      business: "Barbería El Clásico",
      niche: "Barbería",
      instagram: "@elclasico.barber",
      zone: "Centro",
      stage: "nuevo",
      value: 350,
      offerId: "o-web",
      nextAction: { channel: "dm", date: t(0), note: "Primer DM con ejemplo de reservas" },
    },
    {
      ...base,
      id: "d-7",
      projectId: PROJECT_JABONES,
      business: "Insumos La Esencia",
      niche: "Proveedor",
      contactName: "Jorge",
      phone: "555 0107",
      zone: "Zona Industrial",
      stage: "contactado",
      nextAction: { channel: "whatsapp", date: t(0), note: "Pedir precio de glicerina por 5 kg" },
    },
    {
      ...base,
      id: "d-8",
      projectId: PROJECT_LUIS,
      business: "Restaurante La Leña",
      niche: "Restaurante",
      contactName: "Carmen Ríos",
      phone: "555 0108",
      instagram: "@lalena.resto",
      address: "Av. Grau 902",
      zone: "Zona Sur",
      stage: "propuesta",
      value: 1500,
      offerId: "o-sistema",
      nextAction: { channel: "llamada", date: t(-2), note: "Respuesta sobre el sistema de pedidos" },
    },
    {
      ...base,
      id: "d-9",
      projectId: PROJECT_JABONES,
      business: "Hotel Mirador",
      niche: "Hotel",
      contactName: "Recepción, Sra. Elena",
      phone: "555 0109",
      address: "Malecón 33",
      zone: "Zona Norte",
      stage: "interesado",
      value: 144,
      offerId: "o-caja",
      nextAction: { channel: "visita", date: t(-1), note: "Llevar propuesta para amenities" },
    },
    {
      ...base,
      id: "d-10",
      projectId: PROJECT_LUIS,
      business: "Spa Armonía",
      niche: "Spa y estética",
      instagram: "@armonia.spa",
      zone: "Zona Norte",
      stage: "interesado",
      value: 350,
      offerId: "o-web",
      nextAction: { channel: "whatsapp", date: t(2), note: "Mandar 2 ejemplos de páginas de spa" },
    },
    {
      ...base,
      id: "d-11",
      projectId: PROJECT_LUIS,
      business: "Odontología Familiar Quispe",
      niche: "Odontólogo",
      contactName: "Dr. Alberto Quispe",
      phone: "555 0111",
      zone: "Zona Sur",
      stage: "propuesta",
      value: 600,
      offerId: "o-micro",
      nextAction: { channel: "llamada", date: t(3), note: "Cerrar: tiene la propuesta desde el lunes" },
    },
    {
      ...base,
      id: "d-12",
      projectId: PROJECT_LUIS,
      business: "Autoservicio Don Pepe",
      niche: "Taller mecánico",
      contactName: "José",
      phone: "555 0112",
      zone: "Zona Industrial",
      stage: "ganado",
      value: 350,
      offerId: "o-web",
    },
    {
      ...base,
      id: "d-13",
      projectId: PROJECT_JABONES,
      business: "Minimarket Doña Julia",
      niche: "Minimarket",
      contactName: "Julia",
      address: "Calle Los Pinos 77",
      zone: "Centro",
      stage: "ganado",
      value: 36,
      offerId: "o-caja",
    },
    {
      ...base,
      id: "d-14",
      projectId: PROJECT_LUIS,
      business: "CrossFit Titán",
      niche: "Gimnasio",
      instagram: "@titan.crossfit",
      zone: "Zona Norte",
      stage: "perdido",
      value: 600,
      notes: "Ya tienen app de una franquicia.",
    },
  ];

  const a = (
    id: string,
    leadId: string,
    projectId: string,
    channel: Activity["channel"],
    outcome: Activity["outcome"],
    when: string,
    note = "",
    amount = 0,
  ): Activity => ({ id, leadId, projectId, channel, outcome, note, amount, at: when, demo: true });

  const activities: Activity[] = [
    a("da-1", "d-1", PROJECT_LUIS, "visita", "interesado", at(-5, 10, 20), "Le gustó la idea, quiere ver un ejemplo."),
    a("da-2", "d-3", PROJECT_JABONES, "visita", "contactado", at(-4, 11, 5), "La dueña vuelve el lunes."),
    a("da-3", "d-4", PROJECT_LUIS, "dm", "contactado", at(-3, 19, 40), "Respondió el DM, pidió que lo llame."),
    a("da-4", "d-8", PROJECT_LUIS, "visita", "propuesta", at(-6, 16, 0), "Le envié propuesta de sistema de pedidos."),
    a("da-5", "d-9", PROJECT_JABONES, "llamada", "interesado", at(-3, 12, 15), "Les interesa para las habitaciones."),
    a("da-6", "d-10", PROJECT_LUIS, "dm", "interesado", at(-2, 20, 10)),
    a("da-7", "d-11", PROJECT_LUIS, "visita", "propuesta", at(-4, 9, 30), "Propuesta de reservas en línea."),
    a("da-8", "d-12", PROJECT_LUIS, "visita", "venta", at(-3, 15, 30), "Página web con lista de servicios.", 350),
    a("da-9", "d-13", PROJECT_JABONES, "visita", "venta", at(-1, 10, 45), "Primera caja de 12.", 36),
    a("da-10", "d-14", PROJECT_LUIS, "llamada", "no_interesado", at(-2, 11, 0), "Ya tienen app."),
    a("da-11", "d-7", PROJECT_JABONES, "llamada", "sin_respuesta", at(-1, 17, 20)),
  ];

  return { leads, activities };
}
