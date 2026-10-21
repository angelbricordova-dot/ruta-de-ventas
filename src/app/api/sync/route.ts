import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Guarda todos los datos de la app como un solo documento en Upstash Redis.
 *
 * Variables de entorno (Vercel las pone solas al conectar Upstash desde Storage):
 *   KV_REST_API_URL / KV_REST_API_TOKEN  (o UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN)
 * Y una que pones tú, para que nadie más pueda leer tus datos:
 *   CLAVE_ACCESO
 */

export const dynamic = "force-dynamic";

const KEY = "ruta-de-ventas:v1";

interface Stored {
  rev: number;
  savedAt: string;
  data: unknown;
}

function redisConfig() {
  const url = process.env.KV_REST_API_URL ?? process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN ?? process.env.UPSTASH_REDIS_REST_TOKEN;
  return url && token ? { url, token } : null;
}

async function redis<T>(command: (string | number)[]): Promise<T> {
  const cfg = redisConfig()!;
  const res = await fetch(cfg.url, {
    method: "POST",
    headers: { Authorization: `Bearer ${cfg.token}`, "Content-Type": "application/json" },
    body: JSON.stringify(command),
    cache: "no-store",
  });
  const json = (await res.json()) as { result?: T; error?: string };
  if (!res.ok || json.error) throw new Error(json.error ?? `Redis ${res.status}`);
  return json.result as T;
}

function sameSecret(a: string, b: string) {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

/** Devuelve una respuesta de error si la petición no puede seguir. */
function guard(req: NextRequest): NextResponse | null {
  const secret = process.env.CLAVE_ACCESO;
  if (!redisConfig() || !secret) {
    return NextResponse.json(
      { error: "unconfigured", message: "Falta conectar Upstash Redis o poner CLAVE_ACCESO en Vercel." },
      { status: 503 },
    );
  }
  const given = req.headers.get("x-clave") ?? "";
  if (!sameSecret(given, secret)) {
    return NextResponse.json({ error: "unauthorized", message: "Clave incorrecta." }, { status: 401 });
  }
  return null;
}

async function read(): Promise<Stored | null> {
  const raw = await redis<string | null>(["GET", KEY]);
  return raw ? (JSON.parse(raw) as Stored) : null;
}

export async function GET(req: NextRequest) {
  const blocked = guard(req);
  if (blocked) return blocked;
  try {
    const stored = await read();
    return NextResponse.json(stored ?? { rev: 0, savedAt: null, data: null });
  } catch (e) {
    return NextResponse.json({ error: "storage", message: String(e) }, { status: 502 });
  }
}

/** Guarda si `baseRev` coincide con la versión actual; si no, devuelve 409 con lo que hay. */
export async function PUT(req: NextRequest) {
  const blocked = guard(req);
  if (blocked) return blocked;
  let body: { baseRev?: number; data?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }
  if (!body.data || typeof body.baseRev !== "number") {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }
  try {
    const current = await read();
    const rev = current?.rev ?? 0;
    if (body.baseRev !== rev) {
      return NextResponse.json({ error: "conflict", ...current }, { status: 409 });
    }
    const next: Stored = { rev: rev + 1, savedAt: new Date().toISOString(), data: body.data };
    await redis(["SET", KEY, JSON.stringify(next)]);
    return NextResponse.json({ rev: next.rev, savedAt: next.savedAt });
  } catch (e) {
    return NextResponse.json({ error: "storage", message: String(e) }, { status: 502 });
  }
}
