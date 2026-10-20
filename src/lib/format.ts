/** Fecha local en formato YYYY-MM-DD (sin desfase de zona horaria). */
export function isoDay(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function addDays(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  return isoDay(new Date(y, m - 1, d + days));
}

export function parseDay(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

/** Días entre hoy y la fecha: negativo = vencido. */
export function daysFrom(iso: string, today = isoDay()): number {
  return Math.round((parseDay(iso).getTime() - parseDay(today).getTime()) / 86_400_000);
}

const weekday = new Intl.DateTimeFormat("es", { weekday: "long" });
const dayMonth = new Intl.DateTimeFormat("es", { day: "numeric", month: "short" });
const longDate = new Intl.DateTimeFormat("es", { weekday: "long", day: "numeric", month: "long" });
const monthName = new Intl.DateTimeFormat("es", { month: "long" });
const time = new Intl.DateTimeFormat("es", { hour: "2-digit", minute: "2-digit" });

/** "Hoy", "Mañana", "Ayer", "hace 3 días", "jueves", "12 nov". */
export function relativeDay(iso: string, today = isoDay()): string {
  const diff = daysFrom(iso, today);
  if (diff === 0) return "Hoy";
  if (diff === 1) return "Mañana";
  if (diff === -1) return "Ayer";
  if (diff < 0) return `Hace ${-diff} días`;
  if (diff < 7) return capitalize(weekday.format(parseDay(iso)));
  return dayMonth.format(parseDay(iso));
}

export function longDay(iso: string): string {
  return capitalize(longDate.format(parseDay(iso)));
}

export function month(d: Date = new Date()): string {
  return monthName.format(d);
}

export function clock(isoDateTime: string): string {
  return time.format(new Date(isoDateTime));
}

/** Momento de una actividad: "Hoy 10:42", "Ayer 17:05", "12 nov". */
export function when(isoDateTime: string, today = isoDay()): string {
  const day = isoDay(new Date(isoDateTime));
  const diff = daysFrom(day, today);
  if (diff === 0) return `Hoy ${clock(isoDateTime)}`;
  if (diff === -1) return `Ayer ${clock(isoDateTime)}`;
  return relativeDay(day, today);
}

export function money(amount: number, currency: string): string {
  const fixed = Number.isInteger(amount) ? 0 : 2;
  const n = new Intl.NumberFormat("es", {
    minimumFractionDigits: fixed,
    maximumFractionDigits: fixed,
    useGrouping: "always",
  }).format(amount);
  return `${currency}${n}`;
}

export function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function greeting(d: Date = new Date()): string {
  const h = d.getHours();
  if (h < 12) return "Buenos días";
  if (h < 19) return "Buenas tardes";
  return "Buenas noches";
}

export function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter((w) => w.length > 2 || /^[A-ZÁÉÍÓÚÑ]/.test(w))
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}

export function uid(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2) + Date.now().toString(36);
}
