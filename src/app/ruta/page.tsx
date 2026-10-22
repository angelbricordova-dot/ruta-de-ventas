"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { APIProvider } from "@vis.gl/react-google-maps";
import { AnimatePresence, motion } from "motion/react";
import {
  ArrowDown,
  ArrowUp,
  ChevronLeft,
  ChevronRight,
  ClipboardPaste,
  ExternalLink,
  MapPin,
  Navigation,
  Plus,
  Search,
  Shuffle,
  Star,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { agendaFor, inScope, useProjectMap, useStore } from "@/lib/store";
import { CHANNEL_LABEL, HUES, LANE_LABEL, LANE_OF, NICHES, OPEN_STAGES, STAGE_LABEL, type Lane } from "@/lib/labels";
import { addDays, capitalize, isoDay, longDay, parseDay, plural, relativeDay } from "@/lib/format";
import {
  distanceLabel,
  durationLabel,
  GOOGLE_KEY,
  googleEmbedRoute,
  googleEmbedSearch,
  googleEnabled,
  googleMapsSearchUrl,
  googlePlaceText,
  googleRouteUrl,
  hasCoords,
  MARACAY,
  meters,
  nearestOrder,
  nicheFor,
  placeFromGoogleLink,
  routeThrough,
  searchPlaces,
  type LatLng,
  type Place,
  type RouteResult,
  type TravelMode,
} from "@/lib/geo";
import { findMapsUrl } from "@/lib/gmaps-link";
import { startLocation, useLocation } from "@/lib/location";
import { haptic } from "@/lib/haptics";
import { Canvas } from "@/components/Shell";
import { ContactButton, DoneCircle, Due, ROW_MOTION, SwipeRow } from "@/components/LeadBits";
import { MapView, type MapMarker } from "@/components/map/MapView";
import { PlaceSheet, type MapTarget } from "@/components/PlaceSheet";
import { useUI } from "@/lib/ui-store";
import { postponeWithUndo } from "@/lib/notify";
import { Button, Chips, cx, Empty, Input, Panel, ProjectDot, Segmented, Sheet } from "@/components/ui";
import type { Channel, Lead } from "@/lib/types";

const LANES: Lane[] = ["pie", "telefono", "mensajes"];
const weekdayShort = new Intl.DateTimeFormat("es", { weekday: "short" });
const MODE_KEY = "ruta-de-ventas:modo";

/** Una visita tiene dónde ir si tiene coordenadas, texto de Google o dirección. */
const hasPlace = (l: Lead) => hasCoords(l) || !!l.gquery || !!l.address;

export default function RoutePage() {
  // Con clave de Google: mapa interactivo y búsqueda dentro de la app. Sin clave: mapa de Google incrustado.
  return googleEnabled() ? (
    <APIProvider apiKey={GOOGLE_KEY} language="es" region="VE">
      <RouteScreen interactive />
    </APIProvider>
  ) : (
    <RouteScreen interactive={false} />
  );
}

function RouteScreen({ interactive }: { interactive: boolean }) {
  const scope = useStore((s) => s.scope);
  const allLeads = useStore((s) => s.leads);
  const projects = useStore((s) => s.projects);
  const city = useStore((s) => s.settings.city) || "Maracay";
  const schedule = useStore((s) => s.schedule);
  const moveInRoute = useStore((s) => s.moveInRoute);
  const setRouteOrder = useStore((s) => s.setRouteOrder);
  const projectMap = useProjectMap();
  const openLeadForm = useUI((s) => s.openLeadForm);
  const me = useLocation((s) => s.pos);

  const today = isoDay();
  const [date, setDate] = useState(today);
  const [mode, setModeState] = useState<TravelMode>(() => {
    try {
      return (localStorage.getItem(MODE_KEY) as TravelMode) || "pie";
    } catch {
      return "pie";
    }
  });
  const setMode = (m: TravelMode) => {
    setModeState(m);
    try {
      localStorage.setItem(MODE_KEY, m);
    } catch {
      /* sin almacenamiento */
    }
  };

  // Búsqueda: en el mapa incrustado se muestra la búsqueda de Google; con clave, la lista de Places.
  const [query, setQuery] = useState("");
  const [searched, setSearched] = useState("");
  const [results, setResults] = useState<Place[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [focusText, setFocusText] = useState("");

  // Mapa interactivo
  const [fit, setFit] = useState<{ key: string; points: LatLng[] } | null>(null);
  const [focus, setFocus] = useState<{ key: string; point: LatLng; zoom?: number } | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [route, setRoute] = useState<RouteResult | null>(null);
  const center = useRef<LatLng>(MARACAY);

  const [sheet, setSheet] = useState<{ target: MapTarget | null; open: boolean; n: number }>({ target: null, open: false, n: 0 });
  const [picking, setPicking] = useState(false);
  const [paste, setPaste] = useState({ open: false, text: "", busy: false, error: "" });
  const mapBox = useRef<HTMLDivElement>(null);

  useEffect(() => {
    startLocation();
  }, []);

  const leads = inScope(allLeads, scope);
  const isToday = date === today;
  const day = agendaFor(leads, date, isToday);
  const lane = (l: Lane) =>
    day
      .filter((x) => LANE_OF[x.nextAction!.channel] === l)
      .sort((a, b) => (l === "pie" ? a.routeOrder - b.routeOrder : a.business.localeCompare(b.business)));
  const visits = lane("pie");
  const stops = visits.filter(hasPlace);
  const located = stops.filter(hasCoords);
  const origin = isToday && me ? me : null;
  const here = me ?? MARACAY;

  const week = Array.from({ length: 7 }, (_, i) => addDays(today, i));
  const countOn = (d: string) => agendaFor(leads, d, d === today).length;

  /* Mapa incrustado de Google ------------------------------------- */
  const embedSrc = useMemo(() => {
    if (searched) return googleEmbedSearch(searched, here, 14);
    if (focusText) return googleEmbedSearch(focusText, here, 17);
    if (stops.length) return googleEmbedRoute(origin, stops, mode, city);
    return googleEmbedSearch("", here, 15);
    // La ubicación se redondea para no recargar el mapa con cada paso.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searched, focusText, stops.map((s) => googlePlaceText(s, city)).join("|"), mode, origin ? `${origin.lat.toFixed(3)},${origin.lng.toFixed(3)}` : "", here.lat.toFixed(2)]);

  /* Mapa interactivo (con clave) ---------------------------------- */
  const locatedKey = located.map((s) => `${s.id}@${s.lat},${s.lng}`).join("|");
  useEffect(() => {
    if (!interactive) return;
    const pts: LatLng[] = [...(origin ? [origin] : []), ...located];
    if (pts.length < 2) {
      setRoute(null);
      return;
    }
    let cancelled = false;
    routeThrough(pts, mode)
      .then((r) => !cancelled && setRoute(r))
      .catch(() => !cancelled && setRoute(null));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [interactive, locatedKey, mode, origin ? `${origin.lat.toFixed(3)},${origin.lng.toFixed(3)}` : ""]);

  useEffect(() => {
    if (!interactive) return;
    const pts: LatLng[] = [...located, ...(origin ? [origin] : [])];
    if (pts.length) setFit({ key: `day-${date}-${located.length}`, points: pts });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [interactive, date, located.length]);

  const markers: MapMarker[] = useMemo(() => {
    if (!interactive) return [];
    const list: MapMarker[] = [];
    results?.filter(hasCoords).forEach((p) =>
      list.push({ id: `place:${p.id}`, kind: "result", lat: p.lat, lng: p.lng, title: p.name, selected: selectedId === `place:${p.id}` }),
    );
    located.forEach((s) =>
      list.push({
        id: `lead:${s.id}`,
        kind: "stop",
        lat: s.lat,
        lng: s.lng,
        title: s.business,
        label: String(visits.indexOf(s) + 1),
        color: HUES[projectMap.get(s.projectId)?.hue ?? "pizarra"].ink,
        selected: selectedId === `lead:${s.id}`,
      }),
    );
    return list;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [interactive, results, locatedKey, selectedId, projectMap]);

  /* Acciones ---------------------------------------------------- */
  const openTarget = (target: MapTarget) => setSheet((s) => ({ target, open: true, n: s.n + 1 }));

  const runSearch = async (text: string) => {
    const q = text.trim();
    if (!q) return;
    setQuery(q);
    setSearched(q);
    setFocusText("");
    (document.activeElement as HTMLElement | null)?.blur();
    mapBox.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    if (!interactive) return;
    setSearching(true);
    try {
      const found = await searchPlaces(q, center.current);
      setResults(found);
      if (found.length) setFit({ key: `search-${q}-${Date.now()}`, points: found.filter(hasCoords).slice(0, 15) as LatLng[] });
    } catch {
      setResults([]);
      toast("No se pudo buscar en Google. Revisa tu conexión.");
    } finally {
      setSearching(false);
    }
  };

  const clearSearch = () => {
    setQuery("");
    setSearched("");
    setResults(null);
    setFocusText("");
    setSelectedId(null);
  };

  const showStop = (lead: Lead) => {
    mapBox.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    if (interactive && hasCoords(lead)) {
      setSelectedId(`lead:${lead.id}`);
      setFocus({ key: `${lead.id}-${Date.now()}`, point: lead });
    } else {
      setSearched("");
      setFocusText(googlePlaceText(lead, city));
    }
  };

  const importLink = async (text: string) => {
    setPaste((p) => ({ ...p, busy: true, error: "" }));
    try {
      const place = await placeFromGoogleLink(text);
      setPaste({ open: false, text: "", busy: false, error: "" });
      haptic(10);
      openTarget({ type: "place", place, niche: searched ? nicheFor(searched) : nicheFor(place.name) === place.name ? "" : nicheFor(place.name) });
    } catch (e) {
      setPaste((p) => ({ ...p, open: true, busy: false, error: e instanceof Error ? e.message : "No pude leer ese enlace." }));
    }
  };

  const pasteFromClipboard = async () => {
    let text = "";
    try {
      text = await navigator.clipboard.readText();
    } catch {
      /* el navegador no dejó leer el portapapeles: se pide pegarlo a mano */
    }
    if (text && findMapsUrl(text)) importLink(text);
    else setPaste({ open: true, text: "", busy: false, error: "" });
  };

  const orderByDistance = () => {
    const ordered = nearestOrder(origin, visits);
    setRouteOrder(ordered.map((l) => l.id));
    haptic(10);
    toast("Ruta ordenada", { description: origin ? "Desde donde estás, de la más cercana a la más lejana." : "De la más cercana a la más lejana." });
  };

  const directions = googleRouteUrl(stops, mode, city);
  const nextStop = isToday && me ? located.find((s) => s.id === stops[0]?.id) : undefined;
  const quickNiches = useMemo(() => {
    const fromProjects = projects.filter((p) => !p.archived && (scope === "todos" || p.id === scope)).flatMap((p) => p.niches);
    return [...new Set([...fromProjects, ...NICHES.slice(0, 6)])].slice(0, 10);
  }, [projects, scope]);
  const openInGoogle = searched ? googleMapsSearchUrl(searched, here) : directions ?? googleMapsSearchUrl("", here);

  return (
    <Canvas>
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <h1 className="font-display text-[26px] leading-tight font-semibold tracking-[-0.02em] lg:text-[28px]">Ruta</h1>
        <span className="text-[14px] text-muted">{longDay(date)}</span>
      </div>

      {/* Días */}
      <div className="mb-4 flex items-center gap-1.5">
        <button
          type="button"
          onClick={() => setDate(addDays(date, -1))}
          className="press inline-flex size-10 flex-none items-center justify-center rounded-full hover:bg-active"
          aria-label="Día anterior"
        >
          <ChevronLeft size={16} strokeWidth={1.75} />
        </button>
        <div className="scroll-x flex flex-1 gap-1.5">
          {week.map((d) => {
            const on = d === date;
            const n = countOn(d);
            return (
              <button
                key={d}
                type="button"
                onClick={() => {
                  setDate(d);
                  setFocusText("");
                }}
                aria-pressed={on}
                className={cx(
                  "press flex h-12 min-w-[52px] flex-1 flex-col items-center justify-center rounded-[14px] text-[12px]",
                  on ? "bg-ink text-white" : "bg-surface hover:bg-active",
                )}
              >
                <span className={on ? "text-white/70" : "text-muted"}>{d === today ? "Hoy" : capitalize(weekdayShort.format(parseDay(d)).replace(".", ""))}</span>
                <span className="tabular text-[14px] leading-tight font-medium">{n || "·"}</span>
              </button>
            );
          })}
        </div>
        <button
          type="button"
          onClick={() => setDate(addDays(date, 1))}
          className="press inline-flex size-10 flex-none items-center justify-center rounded-full hover:bg-active"
          aria-label="Día siguiente"
        >
          <ChevronRight size={16} strokeWidth={1.75} />
        </button>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 lg:gap-8">
        {/* Mapa de Google */}
        <div ref={mapBox} className="scroll-mt-20 lg:sticky lg:top-6 lg:order-2 lg:col-span-7 lg:self-start">
          <form
            className="mb-2"
            onSubmit={(e) => {
              e.preventDefault();
              runSearch(query);
            }}
          >
            <label className="relative block">
              <Search size={17} strokeWidth={1.9} className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-muted" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar en Google Maps: gimnasio, taller…"
                aria-label="Buscar negocios en Google Maps"
                enterKeyHint="search"
                className="h-12 w-full rounded-full bg-surface pr-11 pl-11 text-[16px] outline-none placeholder:text-faint focus:bg-raised focus:ring-2 focus:ring-ink/10 lg:text-[14px]"
              />
              {(query || searched || focusText) && (
                <button
                  type="button"
                  onClick={clearSearch}
                  aria-label="Volver a la ruta"
                  className="absolute top-1/2 right-2 inline-flex size-8 -translate-y-1/2 items-center justify-center rounded-full text-muted hover:bg-active"
                >
                  <X size={16} strokeWidth={1.9} />
                </button>
              )}
            </label>
          </form>

          {!searched && (
            <div className="scroll-x -mx-4 mb-3 flex gap-1.5 px-4 lg:mx-0 lg:flex-wrap lg:px-0">
              {quickNiches.map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => runSearch(n)}
                  className="press h-9 flex-none rounded-full bg-surface px-3.5 text-[14px] font-medium hover:bg-active lg:h-8 lg:text-[13px]"
                >
                  {n}
                </button>
              ))}
            </div>
          )}

          <div className="relative isolate h-[52dvh] min-h-[340px] overflow-hidden rounded-[22px] bg-[#e8eae6] lg:h-[calc(100dvh-230px)]">
            {interactive ? (
              <MapView
                markers={markers}
                me={me}
                path={route?.path ?? null}
                onSelect={(id) => {
                  setSelectedId(id);
                  const place = results?.find((p) => `place:${p.id}` === id);
                  if (place) openTarget({ type: "place", place, niche: nicheFor(searched) });
                  const lead = allLeads.find((l) => `lead:${l.id}` === id);
                  if (lead) openTarget({ type: "lead", lead });
                }}
                onMove={(c) => (center.current = c)}
                fit={fit}
                focus={focus}
                initialCenter={here}
              />
            ) : (
              <iframe
                key={embedSrc}
                src={embedSrc}
                title="Mapa de Google"
                className="h-full w-full border-0"
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                allowFullScreen
              />
            )}
            {(searched || focusText) && (
              <div className="pointer-events-none absolute inset-x-0 top-3 z-10 flex justify-center">
                <button
                  type="button"
                  onClick={clearSearch}
                  className="pointer-events-auto inline-flex h-9 items-center gap-1.5 rounded-full bg-ink px-4 text-[13px] font-medium text-white shadow-lg"
                >
                  <X size={14} strokeWidth={2.2} /> Volver a la ruta
                </button>
              </div>
            )}
          </div>

          <div className="mt-2 flex items-center justify-between gap-2">
            <Segmented
              label="Cómo vas"
              value={mode}
              onChange={setMode}
              options={[
                { value: "pie", label: "A pie" },
                { value: "carro", label: "Carro" },
              ]}
              className="w-[160px] flex-none"
            />
            <a href={openInGoogle} target="_blank" rel="noreferrer" className="inline-flex h-10 items-center gap-1.5 text-[14px] font-medium text-accent lg:text-[13px]">
              Abrir en Google Maps <ExternalLink size={14} strokeWidth={1.9} />
            </a>
          </div>

          {/* Traer un negocio desde Google Maps */}
          {!interactive && (
            <div className="mt-3 rounded-[18px] bg-accent-tint p-3.5">
              <p className="text-[14px] leading-snug text-[#163a72] lg:text-[13px]">
                <b className="font-semibold">¿Te interesa uno?</b> Ábrelo en Google Maps, toca <b className="font-semibold">Compartir → Copiar enlace</b> y pégalo aquí.
              </p>
              <button
                type="button"
                onClick={pasteFromClipboard}
                disabled={paste.busy}
                className="press mt-2.5 inline-flex h-11 w-full items-center justify-center gap-1.5 rounded-full bg-ink text-[15px] font-medium text-white disabled:opacity-50 lg:h-9 lg:text-[13px]"
              >
                <ClipboardPaste size={16} strokeWidth={1.9} /> {paste.busy ? "Leyendo…" : "Pegar enlace de Google Maps"}
              </button>
            </div>
          )}
        </div>

        {/* Lista */}
        <div className="flex flex-col gap-8 lg:order-1 lg:col-span-5">
          {interactive && (results || searching) && (
            <Panel
              title={searching ? "Buscando…" : `Cerca: ${searched}`}
              count={results?.length}
              action={
                <button type="button" onClick={clearSearch} className="h-9 text-[14px] font-medium text-accent lg:text-[13px]">
                  Cerrar
                </button>
              }
            >
              {results && results.length === 0 && !searching ? (
                <Empty>No encontré “{searched}” por aquí. Mueve el mapa o prueba otra palabra.</Empty>
              ) : (
                <ul>
                  {results?.map((p) => {
                    const id = `place:${p.id}`;
                    const known = allLeads.some((l) => l.placeId === p.id);
                    return (
                      <li key={p.id} className="flex min-h-[64px] items-center gap-3 border-b border-rule py-2 last:border-0">
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedId(id);
                            if (hasCoords(p)) setFocus({ key: `${id}-${Date.now()}`, point: p });
                          }}
                          className="min-w-0 flex-1 text-left"
                        >
                          <span className={cx("block truncate text-[16px] font-medium lg:text-[14px]", selectedId === id && "text-accent")}>{p.name}</span>
                          <span className="flex items-center gap-1.5 truncate text-[14px] text-muted lg:text-[12.5px]">
                            {me && hasCoords(p) && <span className="tabular">{distanceLabel(meters(me, p))} · </span>}
                            <span className="truncate">{p.address || p.category}</span>
                            {p.rating !== null && (
                              <span className="inline-flex flex-none items-center gap-0.5 text-ink">
                                · <Star size={12} strokeWidth={0} className="fill-[#e3a008]" />
                                {p.rating.toFixed(1).replace(".", ",")}
                              </span>
                            )}
                          </span>
                        </button>
                        {known ? (
                          <span className="flex-none text-[13px] text-faint">Ya agregado</span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => openTarget({ type: "place", place: p, niche: nicheFor(searched) })}
                            aria-label={`Agregar ${p.name}`}
                            className="press inline-flex size-11 flex-none items-center justify-center rounded-full bg-ink text-white lg:size-9"
                          >
                            <Plus size={18} strokeWidth={2.2} />
                          </button>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </Panel>
          )}

          {/* Resumen de la ruta */}
          <section className="rounded-[20px] bg-surface p-4">
            <p className="text-[16px] font-semibold lg:text-[15px]">
              {stops.length ? plural(stops.length, "parada", "paradas") : "Sin paradas"}
              {interactive && route && (
                <span className="font-normal text-muted">
                  {" "}
                  · {distanceLabel(route.meters)} · {durationLabel(route.seconds)}
                </span>
              )}
            </p>
            <p className="text-[14px] text-muted lg:text-[13px]">
              {nextStop && me
                ? `Siguiente: ${nextStop.business} · ${distanceLabel(meters(me, nextStop))}`
                : stops.length
                  ? "Google traza la ruta en el mapa, en este orden."
                  : "Busca en Google Maps y pega el enlace del negocio para agregarlo."}
            </p>
            {stops.length > 0 && (
              <div className="mt-3 flex gap-2">
                <Button onClick={orderByDistance} disabled={located.length < 2} className="flex-1 bg-raised hover:bg-white">
                  <Shuffle size={16} strokeWidth={1.9} /> Ordenar
                </Button>
                {directions && (
                  <a
                    href={directions}
                    target="_blank"
                    rel="noreferrer"
                    className="press inline-flex h-11 flex-[1.4] items-center justify-center gap-1.5 rounded-full bg-ink px-4 text-[15px] font-medium text-white lg:h-[38px] lg:text-[14px]"
                  >
                    <Navigation size={16} strokeWidth={1.9} /> Ir con Google Maps
                  </a>
                )}
              </div>
            )}
          </section>

          {LANES.map((l) => {
            const items = l === "pie" ? visits : lane(l);
            return (
              <Panel key={l} title={LANE_LABEL[l]} count={items.length}>
                {items.length ? (
                  <ol className="relative">
                    <AnimatePresence initial={false} mode="popLayout">
                      {items.map((lead, i) => {
                        const project = projectMap.get(lead.projectId);
                        const channel = lead.nextAction!.channel;
                        const where = hasPlace(lead);
                        return (
                          <motion.li key={lead.id} {...ROW_MOTION} className="border-b border-rule last:border-0">
                            <RowShell swipe={isToday} lead={lead} channel={channel}>
                              {isToday && <DoneCircle lead={lead} channel={channel} />}
                              {l === "pie" && (
                                <button
                                  type="button"
                                  onClick={() => (where ? showStop(lead) : openLeadForm(lead.id))}
                                  aria-label={where ? `Ver ${lead.business} en el mapa` : `Agregar dirección a ${lead.business}`}
                                  className="tabular inline-flex size-8 flex-none items-center justify-center rounded-full text-[13px] font-semibold text-white"
                                  style={{ background: where ? HUES[project?.hue ?? "pizarra"].ink : "var(--control)" }}
                                >
                                  {where ? i + 1 : <MapPin size={14} strokeWidth={2} />}
                                </button>
                              )}
                              <Link href={`/prospectos/${lead.id}`} draggable={false} className="min-w-0 flex-1 py-1">
                                <span className="flex items-center gap-1.5">
                                  <span className="truncate text-[16px] font-medium lg:text-[14px]">{lead.business}</span>
                                  {scope === "todos" && l !== "pie" && <ProjectDot project={project} size={7} />}
                                </span>
                                <span className="flex items-center gap-2 text-[14px] text-muted lg:text-[12.5px]">
                                  <Due date={lead.nextAction!.date} today={today} />
                                  <span className="truncate">
                                    {l === "pie" && !where
                                      ? "Sin dirección · toca el pin para agregarla"
                                      : [
                                          l !== "pie" ? CHANNEL_LABEL[channel] : "",
                                          me && hasCoords(lead) ? distanceLabel(meters(me, lead)) : "",
                                          lead.nextAction?.note || lead.niche,
                                        ]
                                          .filter(Boolean)
                                          .join(" · ")}
                                  </span>
                                </span>
                              </Link>
                              {l === "pie" && items.length > 1 && (
                                <span className="flex flex-none flex-col">
                                  <button
                                    type="button"
                                    disabled={i === 0}
                                    onClick={() => moveInRoute(lead.id, -1, date)}
                                    className="press inline-flex size-7 items-center justify-center rounded-full text-faint hover:text-ink disabled:opacity-20"
                                    aria-label="Subir en la ruta"
                                  >
                                    <ArrowUp size={15} strokeWidth={2} />
                                  </button>
                                  <button
                                    type="button"
                                    disabled={i === items.length - 1}
                                    onClick={() => moveInRoute(lead.id, 1, date)}
                                    className="press inline-flex size-7 items-center justify-center rounded-full text-faint hover:text-ink disabled:opacity-20"
                                    aria-label="Bajar en la ruta"
                                  >
                                    <ArrowDown size={15} strokeWidth={2} />
                                  </button>
                                </span>
                              )}
                              <ContactButton lead={lead} channel={channel} />
                              <button
                                type="button"
                                onClick={() => schedule(lead.id, null)}
                                className="press hidden size-9 flex-none items-center justify-center rounded-full text-faint hover:bg-active hover:text-ink lg:inline-flex"
                                aria-label={`Quitar ${lead.business} de la ruta`}
                                title="Quitar de la ruta"
                              >
                                <X size={15} strokeWidth={1.75} />
                              </button>
                            </RowShell>
                          </motion.li>
                        );
                      })}
                    </AnimatePresence>
                  </ol>
                ) : (
                  <Empty>{l === "pie" ? "Sin visitas." : l === "telefono" ? "Sin llamadas." : "Sin mensajes."}</Empty>
                )}
              </Panel>
            );
          })}

          <Button onClick={() => setPicking(true)} className="w-full">
            <Plus size={18} strokeWidth={2} /> Agregar prospectos que ya tengo
          </Button>
        </div>
      </div>

      {sheet.n > 0 && (
        <PlaceSheet key={sheet.n} target={sheet.target} open={sheet.open} date={date} onClose={() => setSheet((s) => ({ ...s, open: false }))} />
      )}

      <Picker open={picking} onClose={() => setPicking(false)} date={date} />

      <Sheet
        open={paste.open}
        onClose={() => setPaste((p) => ({ ...p, open: false }))}
        title="Pegar de Google Maps"
        footer={
          <Button variant="primary" onClick={() => importLink(paste.text)} disabled={!paste.text.trim() || paste.busy}>
            {paste.busy ? "Leyendo…" : "Agregar"}
          </Button>
        }
      >
        <ol className="mb-4 list-decimal space-y-1 pl-5 text-[15px] text-muted lg:text-[14px]">
          <li>En Google Maps, abre la ficha del negocio.</li>
          <li>
            Toca <b className="font-medium text-ink">Compartir</b> y luego <b className="font-medium text-ink">Copiar enlace</b>.
          </li>
          <li>Pégalo aquí abajo.</li>
        </ol>
        <textarea
          value={paste.text}
          onChange={(e) => setPaste((p) => ({ ...p, text: e.target.value, error: "" }))}
          placeholder="https://maps.app.goo.gl/…"
          aria-label="Enlace de Google Maps"
          rows={3}
          className="w-full rounded-[14px] border border-control bg-raised px-3 py-2.5 text-[16px] outline-none focus:border-ink lg:text-[14px]"
        />
        {paste.error && (
          <div className="mt-2 flex flex-col gap-2">
            <p className="text-[14px] text-negative">{paste.error}</p>
            <Button
              className="self-start"
              onClick={() => {
                setPaste((p) => ({ ...p, open: false }));
                openLeadForm(null, { nextAction: { channel: "visita", date, note: "" } });
              }}
            >
              Agregar a mano
            </Button>
          </div>
        )}
      </Sheet>
    </Canvas>
  );
}

/** Agregar al día prospectos que ya están guardados. */
function Picker({ open, onClose, date }: { open: boolean; onClose: () => void; date: string }) {
  const scope = useStore((s) => s.scope);
  const allLeads = useStore((s) => s.leads);
  const projects = useStore((s) => s.projects);
  const schedule = useStore((s) => s.schedule);
  const [zone, setZone] = useState("todas");
  const [q, setQ] = useState("");
  const today = isoDay();
  const isToday = date === today;

  const candidates = inScope(allLeads, scope).filter(
    (l) => OPEN_STAGES.includes(l.stage) && l.nextAction?.date !== date && !(isToday && l.nextAction && l.nextAction.date < today),
  );
  const zones = (() => {
    const m = new Map<string, number>();
    candidates.forEach((l) => m.set(l.zone || "Sin zona", (m.get(l.zone || "Sin zona") ?? 0) + 1));
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  })();
  const needle = q.trim().toLowerCase();
  const shown = candidates
    .filter((l) => zone === "todas" || (l.zone || "Sin zona") === zone)
    .filter((l) => !needle || `${l.business} ${l.niche} ${l.contactName}`.toLowerCase().includes(needle))
    .sort((a, b) => (a.nextAction ? 1 : 0) - (b.nextAction ? 1 : 0) || a.business.localeCompare(b.business));

  return (
    <Sheet open={open} onClose={onClose} title={`Agregar a ${relativeDay(date, today).toLowerCase()}`}>
      <div className="mb-3 flex flex-col gap-3">
        <label className="relative">
          <Search size={16} strokeWidth={1.75} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-faint" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar negocio o rubro" className="pl-9" aria-label="Buscar prospecto" />
        </label>
        {zones.length > 1 && (
          <Chips
            label="Zona"
            value={zone}
            onChange={setZone}
            options={[{ value: "todas", label: "Todas" }, ...zones.map(([z, n]) => ({ value: z, label: `${z} ${n}` }))]}
          />
        )}
      </div>
      {shown.length ? (
        <ul className="relative">
          <AnimatePresence initial={false} mode="popLayout">
            {shown.map((l) => {
              const project = projects.find((p) => p.id === l.projectId);
              const options = (["visita", "llamada", "whatsapp", "dm"] as Channel[]).filter((c) => !project || project.channels.includes(c));
              return (
                <motion.li key={l.id} {...ROW_MOTION} className="border-b border-rule py-3 last:border-0">
                  <span className="flex items-center gap-1.5">
                    {scope === "todos" && <ProjectDot project={project} size={7} />}
                    <span className="truncate text-[16px] font-medium lg:text-[14px]">{l.business}</span>
                  </span>
                  <span className="block truncate text-[14px] text-muted lg:text-[12.5px]">
                    {[l.niche, l.zone, STAGE_LABEL[l.stage]].filter(Boolean).join(" · ")}
                  </span>
                  {l.nextAction && (
                    <span className="block text-[12px] text-faint">
                      Programado: {CHANNEL_LABEL[l.nextAction.channel]} {relativeDay(l.nextAction.date, today).toLowerCase()}
                    </span>
                  )}
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {options.map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => schedule(l.id, { channel: c, date, note: l.nextAction?.note ?? "" })}
                        className="press inline-flex h-10 items-center gap-1 rounded-full bg-active px-3.5 text-[14px] font-medium hover:bg-[#e2e2dd] lg:h-8 lg:px-3 lg:text-[12.5px]"
                      >
                        <Plus size={13} strokeWidth={2} /> {CHANNEL_LABEL[c]}
                      </button>
                    ))}
                  </div>
                </motion.li>
              );
            })}
          </AnimatePresence>
        </ul>
      ) : (
        <Empty>{candidates.length ? "Nada coincide con la búsqueda." : "Todos tus prospectos abiertos ya tienen fecha este día."}</Empty>
      )}
    </Sheet>
  );
}

/** Fila de la ruta: deslizable solo hoy (hecho / mañana); otros días es una fila normal. */
function RowShell({ swipe, lead, channel, children }: { swipe: boolean; lead: Lead; channel: Channel; children: React.ReactNode }) {
  const openLog = useUI((s) => s.openLog);
  const row = <div className="flex min-h-[66px] items-center gap-2 py-1.5 lg:min-h-[60px]">{children}</div>;
  if (!swipe) return row;
  return (
    <SwipeRow onDone={() => openLog(lead.id, channel)} onLater={() => postponeWithUndo(lead)}>
      {row}
    </SwipeRow>
  );
}
