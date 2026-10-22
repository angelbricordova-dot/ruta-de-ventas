"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { APIProvider } from "@vis.gl/react-google-maps";
import { AnimatePresence, motion } from "motion/react";
import {
  ArrowDown,
  ArrowUp,
  ChevronLeft,
  ChevronRight,
  LocateFixed,
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
  geocode,
  GOOGLE_KEY,
  googleDirections,
  googleEnabled,
  hasCoords,
  MARACAY,
  meters,
  nicheFor,
  optimizeOrder,
  routeThrough,
  searchPlaces,
  type LatLng,
  type Place,
  type RouteResult,
  type TravelMode,
} from "@/lib/geo";
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

export default function RoutePage() {
  // Con clave de Google, toda la pantalla vive dentro del proveedor de Maps (mapa, Places, geocodificación).
  return googleEnabled() ? (
    <APIProvider apiKey={GOOGLE_KEY} language="es" region="VE">
      <RouteScreen />
    </APIProvider>
  ) : (
    <RouteScreen />
  );
}

function RouteScreen() {
  const scope = useStore((s) => s.scope);
  const allLeads = useStore((s) => s.leads);
  const projects = useStore((s) => s.projects);
  const city = useStore((s) => s.settings.city);
  const schedule = useStore((s) => s.schedule);
  const moveInRoute = useStore((s) => s.moveInRoute);
  const setRouteOrder = useStore((s) => s.setRouteOrder);
  const patchLead = useStore((s) => s.patchLead);
  const projectMap = useProjectMap();
  const me = useLocation((s) => s.pos);
  const locStatus = useLocation((s) => s.status);

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

  // Búsqueda de negocios en el mapa
  const [query, setQuery] = useState("");
  const [searched, setSearched] = useState("");
  const [results, setResults] = useState<Place[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState("");
  const center = useRef<LatLng>(MARACAY);

  // Mapa
  const [fit, setFit] = useState<{ key: string; points: LatLng[] } | null>(null);
  const [focus, setFocus] = useState<{ key: string; point: LatLng; zoom?: number } | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [sheet, setSheet] = useState<{ target: MapTarget | null; open: boolean; n: number }>({ target: null, open: false, n: 0 });
  const [route, setRoute] = useState<RouteResult | null>(null);
  const [routing, setRouting] = useState(false);
  const [optimizing, setOptimizing] = useState(false);
  const [picking, setPicking] = useState(false);
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
  const stops = visits.filter(hasCoords);
  const stopKey = stops.map((s) => `${s.id}@${s.lat.toFixed(5)},${s.lng.toFixed(5)}`).join("|");

  const week = Array.from({ length: 7 }, (_, i) => addDays(today, i));
  const countOn = (d: string) => agendaFor(leads, d, d === today).length;

  /* Ruta trazada ---------------------------------------------------- */
  // Hoy la ruta parte de tu ubicación; se vuelve a trazar si te alejas más de 250 m del punto de partida.
  const origin = useRef<LatLng | null>(null);
  const useMe = isToday && !!me;
  const originKey = useMe && me ? (origin.current && meters(origin.current, me) < 250 ? "same" : `${me.lat.toFixed(3)},${me.lng.toFixed(3)}`) : "none";

  useEffect(() => {
    const pts: LatLng[] = [...(useMe && me ? [me] : []), ...stops];
    if (useMe && me) origin.current = { lat: me.lat, lng: me.lng };
    if (pts.length < 2) {
      setRoute(null);
      return;
    }
    let cancelled = false;
    setRouting(true);
    routeThrough(pts, mode)
      .then((r) => !cancelled && setRoute(r))
      .catch(() => !cancelled && setRoute(null))
      .finally(() => !cancelled && setRouting(false));
    return () => {
      cancelled = true;
    };
    // Se recalcula cuando cambian las paradas, el modo o el punto de partida.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stopKey, mode, originKey]);

  // Encuadra la ruta del día al abrir y al cambiar de día.
  useEffect(() => {
    const pts: LatLng[] = [...stops, ...(isToday && me ? [me] : [])];
    if (pts.length) setFit({ key: `day-${date}-${stops.length}`, points: pts });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date, stops.length]);

  // La primera vez que llega tu ubicación, si no hay paradas, centra en ti.
  const centeredOnMe = useRef(false);
  useEffect(() => {
    if (me && !centeredOnMe.current) {
      centeredOnMe.current = true;
      if (stops.length === 0) setFocus({ key: "me-first", point: me, zoom: 15 });
    }
  }, [me, stops.length]);

  /* Búsqueda -------------------------------------------------------- */
  const runSearch = useCallback(
    async (text: string) => {
      const q = text.trim();
      if (!q) return;
      setQuery(q);
      setSearched(q);
      setSearching(true);
      setSearchError("");
      setSelectedId(null);
      try {
        const near = center.current;
        const here = useLocation.getState().pos;
        const found = (await searchPlaces(q, near)).sort((a, b) => (here ? meters(here, a) - meters(here, b) : 0));
        setResults(found);
        if (found.length) setFit({ key: `search-${q}-${Date.now()}`, points: found.slice(0, 15) });
      } catch {
        setResults([]);
        setSearchError("No se pudo buscar. Revisa tu conexión e intenta de nuevo.");
      } finally {
        setSearching(false);
      }
    },
    [],
  );

  const clearSearch = () => {
    setResults(null);
    setSearched("");
    setQuery("");
    setSearchError("");
    setSelectedId(null);
  };

  /* Marcadores ------------------------------------------------------ */
  const markers: MapMarker[] = useMemo(() => {
    const stopIds = new Set(stops.map((s) => s.id));
    const list: MapMarker[] = [];
    // Otros prospectos abiertos con ubicación: puntos pequeños para sumarlos a la ruta.
    leads
      .filter((l) => hasCoords(l) && !stopIds.has(l.id) && OPEN_STAGES.includes(l.stage))
      .forEach((l) =>
        list.push({
          id: `lead:${l.id}`,
          kind: "lead",
          lat: l.lat!,
          lng: l.lng!,
          title: l.business,
          color: HUES[projectMap.get(l.projectId)?.hue ?? "pizarra"].ink,
          selected: selectedId === `lead:${l.id}`,
        }),
      );
    results?.forEach((p) =>
      list.push({ id: `place:${p.id}`, kind: "result", lat: p.lat, lng: p.lng, title: p.name, selected: selectedId === `place:${p.id}` }),
    );
    stops.forEach((s, i) =>
      list.push({
        id: `lead:${s.id}`,
        kind: "stop",
        lat: s.lat,
        lng: s.lng,
        title: s.business,
        label: String(visits.indexOf(s) + 1 || i + 1),
        color: HUES[projectMap.get(s.projectId)?.hue ?? "pizarra"].ink,
        selected: selectedId === `lead:${s.id}`,
      }),
    );
    return list;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leads, stopKey, results, selectedId, projectMap]);

  const openTarget = (target: MapTarget) => setSheet((s) => ({ target, open: true, n: s.n + 1 }));

  const onSelect = (id: string) => {
    setSelectedId(id);
    haptic(5);
    if (id.startsWith("place:")) {
      const place = results?.find((p) => `place:${p.id}` === id);
      if (place) openTarget({ type: "place", place, niche: nicheFor(searched) });
    } else {
      const lead = allLeads.find((l) => `lead:${l.id}` === id);
      if (lead) openTarget({ type: "lead", lead });
    }
  };

  const showOnMap = (p: LatLng, id: string) => {
    setSelectedId(id);
    setFocus({ key: `${id}-${Date.now()}`, point: p });
    mapBox.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  };

  const locate = async (lead: Lead) => {
    const text = [lead.address || lead.business, lead.zone, city || "Maracay", "Venezuela"].filter(Boolean).join(", ");
    try {
      const pos = await geocode(text, me ?? center.current);
      if (pos) {
        patchLead(lead.id, pos);
        showOnMap(pos, `lead:${lead.id}`);
        toast(lead.business, { description: "Ubicado en el mapa. Si no es ahí, edita la dirección." });
      } else toast(lead.business, { description: "No encontré esa dirección. Agrega una más precisa en la ficha." });
    } catch {
      toast("No se pudo buscar la dirección");
    }
  };

  const optimize = async () => {
    if (stops.length < 2) return;
    setOptimizing(true);
    try {
      const start = useMe && me ? me : stops[0];
      const list = useMe ? stops : stops.slice(1);
      const order = await optimizeOrder(start, list, mode);
      if (order) {
        const ordered = useMe ? order.map((i) => list[i]) : [stops[0], ...order.map((i) => list[i])];
        const rest = visits.filter((v) => !hasCoords(v));
        setRouteOrder([...ordered, ...rest].map((l) => l.id));
        haptic(10);
        toast("Ruta ordenada", { description: "De la parada más cercana a la más lejana." });
      }
    } catch {
      toast("No se pudo ordenar la ruta. Revisa tu conexión.");
    } finally {
      setOptimizing(false);
    }
  };

  const directions = googleDirections(stops, mode);
  const nextStop = isToday && me && stops[0] ? stops[0] : null;
  const quickNiches = useMemo(() => {
    const fromProjects = projects.filter((p) => !p.archived && (scope === "todos" || p.id === scope)).flatMap((p) => p.niches);
    return [...new Set([...fromProjects, ...NICHES.slice(0, 6)])].slice(0, 10);
  }, [projects, scope]);

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
                onClick={() => setDate(d)}
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
        {/* Mapa */}
        <div ref={mapBox} className="scroll-mt-20 lg:sticky lg:top-6 lg:order-2 lg:col-span-7 lg:self-start">
          <div className="relative h-[50dvh] min-h-[320px] overflow-hidden rounded-[22px] bg-[#eef0ec] lg:h-[calc(100dvh-170px)]">
            <MapView
              markers={markers}
              me={me}
              path={route?.path ?? null}
              onSelect={onSelect}
              onMove={(c) => (center.current = c)}
              fit={fit}
              focus={focus}
              initialCenter={me ?? MARACAY}
            />

            {/* Buscador sobre el mapa */}
            <form
              className="absolute inset-x-3 top-3 z-[500]"
              onSubmit={(e) => {
                e.preventDefault();
                (document.activeElement as HTMLElement | null)?.blur();
                runSearch(query);
              }}
            >
              <label className="relative block">
                <Search size={17} strokeWidth={1.9} className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-muted" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Buscar negocios cerca: gimnasio, taller…"
                  aria-label="Buscar negocios en el mapa"
                  enterKeyHint="search"
                  className="h-12 w-full rounded-full border-0 bg-raised pr-11 pl-11 text-[16px] shadow-[0_2px_12px_rgba(0,0,0,0.14)] outline-none placeholder:text-faint lg:text-[14px]"
                />
                {(query || results) && (
                  <button
                    type="button"
                    onClick={clearSearch}
                    aria-label="Limpiar búsqueda"
                    className="absolute top-1/2 right-2 inline-flex size-8 -translate-y-1/2 items-center justify-center rounded-full text-muted hover:bg-active"
                  >
                    <X size={16} strokeWidth={1.9} />
                  </button>
                )}
              </label>
            </form>

            {/* A pie o en carro: cambia el trazado y el tiempo estimado */}
            <div className="absolute bottom-8 left-3 z-[500] rounded-full shadow-[0_2px_12px_rgba(0,0,0,0.16)]">
              <Segmented
                label="Cómo vas"
                value={mode}
                onChange={setMode}
                options={[
                  { value: "pie", label: "A pie" },
                  { value: "carro", label: "Carro" },
                ]}
                className="w-[150px]"
              />
            </div>

            {/* Mi ubicación */}
            <button
              type="button"
              onClick={() => {
                if (me) setFocus({ key: `me-${Date.now()}`, point: me, zoom: 16 });
                else if (locStatus === "denied")
                  toast("Ubicación desactivada", { description: "Actívala en Ajustes del iPhone → Privacidad → Localización → Safari." });
                else startLocation();
              }}
              aria-label="Mi ubicación"
              className="press absolute right-3 bottom-8 z-[500] inline-flex size-12 items-center justify-center rounded-full bg-raised text-accent shadow-[0_2px_12px_rgba(0,0,0,0.16)]"
            >
              <LocateFixed size={21} strokeWidth={1.9} />
            </button>

            {searching && (
              <div className="absolute inset-x-0 top-[68px] z-[500] flex justify-center">
                <span className="rounded-full bg-ink px-4 py-2 text-[13px] font-medium text-white shadow-lg">Buscando “{searched}”…</span>
              </div>
            )}
          </div>

          {/* Atajos de búsqueda */}
          {!results && !searching && (
            <div className="scroll-x -mx-4 mt-3 flex gap-1.5 px-4 lg:mx-0 lg:flex-wrap lg:px-0">
              {quickNiches.map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => runSearch(n)}
                  className="press h-10 flex-none rounded-full bg-surface px-4 text-[14px] font-medium hover:bg-active lg:h-8 lg:text-[13px]"
                >
                  {n}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Lista */}
        <div className="flex flex-col gap-8 lg:order-1 lg:col-span-5">
          {(results || searching) && (
            <Panel
              title={searching ? "Buscando…" : `Cerca: ${searched}`}
              count={results?.length}
              action={
                <button type="button" onClick={clearSearch} className="h-9 text-[14px] font-medium text-accent lg:text-[13px]">
                  Cerrar
                </button>
              }
            >
              {searchError ? (
                <Empty>{searchError}</Empty>
              ) : results && results.length === 0 && !searching ? (
                <Empty>No encontré “{searched}” por aquí. Mueve el mapa a otra zona o prueba otra palabra.</Empty>
              ) : (
                <ul className="relative">
                  {results?.map((p) => {
                    const id = `place:${p.id}`;
                    const known = allLeads.some((l) => l.placeId === p.id);
                    return (
                      <li key={p.id} className="flex min-h-[64px] items-center gap-3 border-b border-rule py-2 last:border-0">
                        <button type="button" onClick={() => showOnMap(p, id)} className="min-w-0 flex-1 text-left">
                          <span className={cx("block truncate text-[16px] font-medium lg:text-[14px]", selectedId === id && "text-accent")}>{p.name}</span>
                          <span className="flex items-center gap-1.5 truncate text-[14px] text-muted lg:text-[12.5px]">
                            {me && <span className="tabular">{distanceLabel(meters(me, p))}</span>}
                            {me && " · "}
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
                            onClick={() => {
                              setSelectedId(id);
                              openTarget({ type: "place", place: p, niche: nicheFor(searched) });
                            }}
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

          {/* Resumen de la ruta a pie */}
          <section className="rounded-[20px] bg-surface p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[16px] font-semibold lg:text-[15px]">
                  {stops.length ? plural(stops.length, "parada", "paradas") : "Sin paradas en el mapa"}
                  {route && (
                    <span className="font-normal text-muted">
                      {" "}
                      · {distanceLabel(route.meters)} · {durationLabel(route.seconds)}
                    </span>
                  )}
                  {routing && <span className="font-normal text-faint"> · trazando…</span>}
                </p>
                {nextStop ? (
                  <p className="truncate text-[14px] text-muted lg:text-[13px]">
                    Siguiente: {nextStop.business} · {distanceLabel(meters(me!, nextStop))}
                  </p>
                ) : (
                  <p className="text-[14px] text-muted lg:text-[13px]">
                    {stops.length ? (isToday ? "Activa tu ubicación para salir desde donde estás." : "Ruta planificada.") : "Busca negocios en el mapa y agrégalos."}
                  </p>
                )}
              </div>
            </div>
            {stops.length > 0 && (
              <div className="mt-3 flex gap-2">
                <Button onClick={optimize} disabled={stops.length < 2 || optimizing} className="flex-1 bg-raised hover:bg-white">
                  <Shuffle size={16} strokeWidth={1.9} /> {optimizing ? "Ordenando…" : "Ordenar mejor"}
                </Button>
                {directions && (
                  <a
                    href={directions}
                    target="_blank"
                    rel="noreferrer"
                    className="press inline-flex h-11 flex-1 items-center justify-center gap-1.5 rounded-full bg-ink px-4 text-[15px] font-medium text-white lg:h-[38px] lg:text-[14px]"
                  >
                    <Navigation size={16} strokeWidth={1.9} /> Ir con Maps
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
                        const located = hasCoords(lead);
                        return (
                          <motion.li key={lead.id} {...ROW_MOTION} className="border-b border-rule last:border-0">
                            <RowShell swipe={isToday} lead={lead} channel={channel}>
                              {isToday && <DoneCircle lead={lead} channel={channel} />}
                              {l === "pie" && (
                                <button
                                  type="button"
                                  onClick={() => (located ? showOnMap(lead as Lead & LatLng, `lead:${lead.id}`) : locate(lead))}
                                  aria-label={located ? `Ver ${lead.business} en el mapa` : `Ubicar ${lead.business} en el mapa`}
                                  className="tabular inline-flex size-8 flex-none items-center justify-center rounded-full text-[13px] font-semibold text-white"
                                  style={{ background: located ? HUES[project?.hue ?? "pizarra"].ink : "var(--control)" }}
                                >
                                  {located ? i + 1 : <MapPin size={14} strokeWidth={2} />}
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
                                    {l === "pie" && !located
                                      ? "Sin ubicación · toca el pin para ubicarlo"
                                      : [
                                          l !== "pie" ? CHANNEL_LABEL[channel] : "",
                                          me && located ? distanceLabel(meters(me, lead as Lead & LatLng)) : "",
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
        <PlaceSheet
          key={sheet.n}
          target={sheet.target}
          open={sheet.open}
          date={date}
          onClose={() => {
            setSheet((s) => ({ ...s, open: false }));
          }}
        />
      )}

      <Picker open={picking} onClose={() => setPicking(false)} date={date} />
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
