import { firestore } from "./firebase-admin";
import { createHash, randomBytes } from "node:crypto";
import { parseSessionCookie } from "./session";
import { AppError } from "./errors";
import type { EntityKind, TasteEntity } from "./types";

export const UUID =
  /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const KINDS = new Set(["artist", "movie", "book", "tv_show"]);
export type QlooResult = {
  entity_id: string;
  name: string;
  types?: string[];
  subtype?: string;
  disambiguation?: string;
  properties?: {
    short_description?: string;
    description?: string;
    image?: { url?: string };
  };
  query?: { affinity?: number; explainability?: unknown };
};
export type QlooPayload = {
  success?: boolean;
  results: QlooResult[] | { entities?: QlooResult[] };
  error?: unknown;
  warnings?: { type?: string; [key: string]: unknown }[];
};
export function entitiesFrom(payload: QlooPayload): QlooResult[] {
  const list =
    payload &&
    (Array.isArray(payload.results)
      ? payload.results
      : payload.results?.entities);
  if (!Array.isArray(list))
    throw new AppError(
      "Qloo returned an unexpected response. Please try again.",
      502,
    );
  return list.filter(
    (e) =>
      e &&
      typeof e.entity_id === "string" &&
      UUID.test(e.entity_id) &&
      typeof e.name === "string",
  );
}
export function cleanEntity(entity: QlooResult, kind: EntityKind): TasteEntity {
  const image = entity.properties?.image?.url;
  const description =
    entity.properties?.short_description ?? entity.properties?.description;
  return {
    id: entity.entity_id.toUpperCase(),
    name: entity.name,
    kind,
    ...(typeof entity.disambiguation === "string"
      ? { disambiguation: entity.disambiguation }
      : {}),
    description: (typeof description === "string" ? description : "")
      .replace(/<[^>]+>/g, "")
      .slice(0, 240),
    ...(typeof image === "string" &&
    image.startsWith("https://images.qloo.com/")
      ? { image }
      : {}),
  };
}
const digest = (key: string) => createHash("sha256").update(key).digest("hex");
/** A single Firestore transaction makes each limiter increment atomic. */
export async function quota(key: string, limit: number, seconds: number) {
  const ref = firestore().collection("rate_limits").doc(digest(key));
  const now = Date.now();
  await firestore().runTransaction(async (transaction) => {
    const previous = (await transaction.get(ref)).data();
    const count =
      previous && previous.expiresAt > now ? Number(previous.count) + 1 : 1;
    if (count > limit)
      throw new AppError(
        "The demo has reached its request allowance. Reuse a saved collection or try again later.",
        429,
      );
    const expiresAt =
      previous && previous.expiresAt > now
        ? previous.expiresAt
        : now + seconds * 1000;
    transaction.set(ref, { count, expiresAt, cleanupAt: new Date(expiresAt) });
  });
}
/** Opaque visitor quota identity, not an authenticated user or claimed IP address. */
export function visitorIdentity(request: Request): {
  identity: string;
  cookie?: string;
} {
  const value = request.headers
    .get("cookie")
    ?.split(";")
    .map((v) => v.trim())
    .find((v) => v.startsWith("__session="))
    ?.slice("__session=".length);
  const parsed = parseSessionCookie(value);
  const existing = parsed.guestToken ?? parsed.sessionToken;
  if (existing) return { identity: digest(existing).slice(0, 24) };
  const token = randomBytes(32).toString("hex");
  return {
    identity: digest(token).slice(0, 24),
    cookie: `__session=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=2592000${process.env.NODE_ENV === "production" || new URL(request.url).protocol === "https:" ? "; Secure" : ""}`,
  };
}
/** Legacy coarse gateway key only. Never use forwarding headers as an authenticated identity. */
export async function requestIdentity(request: Request) {
  return digest(
    request.headers.get("x-forwarded-for")?.split(",").at(-1)?.trim() ??
      "local-preview",
  ).slice(0, 24);
}
const inFlight = new Map<
  string,
  Promise<{ data: QlooPayload; cached: boolean; fetchedAt: string }>
>();
export async function qloo(
  path: "/search" | "/v2/insights",
  params: Record<string, string>,
  ttl = 86400,
) {
  const key =
    path +
    "?" +
    new URLSearchParams(
      Object.entries(params).sort(([a], [b]) => a.localeCompare(b)),
    ).toString();
  const existing = inFlight.get(key);
  if (existing) return existing;
  const operation = loadQloo(key, ttl);
  inFlight.set(key, operation);
  try {
    return await operation;
  } finally {
    inFlight.delete(key);
  }
}
async function loadQloo(key: string, ttl: number) {
  const ref = firestore().collection("api_cache").doc(digest(key));
  const now = Date.now();
  const snapshot = await ref.get();
  const cached = snapshot.data();
  if (cached && cached.expiresAt > now && typeof cached.value === "string") {
    try {
      const data = JSON.parse(cached.value) as QlooPayload;
      entitiesFrom(data);
      return { data, cached: true, fetchedAt: String(cached.fetchedAt) };
    } catch {
      /* Corrupt cache entries are misses, not valid evidence. */
    }
  }
  const apiKey = process.env.QLOO_API_KEY;
  if (!apiKey)
    throw new AppError(
      "Live Qloo access is not configured. Saved collections remain available.",
      503,
    );
  const base = process.env.QLOO_API_BASE ?? "https://hackathon.api.qloo.com";
  if (
    !["https://hackathon.api.qloo.com", "https://api.qloo.com"].includes(base)
  )
    throw new AppError("Qloo server configuration is invalid.", 503);
  let response: Response | undefined;
  for (let attempt = 0; attempt < 2; attempt++) {
    await quota(
      "qloo-day:" + new Date().toISOString().slice(0, 10),
      250,
      86400,
    );
    response = undefined;
    try {
      response = await fetch(base + key, {
        headers: { "X-Api-Key": apiKey, Accept: "application/json" },
        signal: AbortSignal.timeout(16000),
      });
    } catch {
      if (attempt === 1)
        throw new AppError(
          "Qloo is taking too long. Your stock and saved collections are safe; try again.",
          504,
        );
    }
    if (response?.ok) break;
    if (response && ![429, 500, 502, 503, 504].includes(response.status)) break;
    if (attempt === 0) await new Promise((r) => setTimeout(r, 700));
  }
  if (!response?.ok)
    throw new AppError(
      response?.status === 429
        ? "Qloo is busy. Please retry shortly."
        : "Qloo could not complete this cultural analysis. Please try another audience or retry.",
      response?.status === 429 ? 429 : 502,
    );
  let data: QlooPayload;
  try {
    data = (await response.json()) as QlooPayload;
  } catch {
    throw new AppError(
      "Qloo returned an unreadable response. Please retry.",
      502,
    );
  }
  if (data?.success === false)
    throw new AppError(
      "Qloo could not score this audience. Try another cultural anchor.",
      502,
    );
  entitiesFrom(data);
  const fetchedAt = new Date().toISOString();
  const value = JSON.stringify(data);
  // Firestore documents are limited to 1 MiB. A large upstream response remains usable without caching it.
  if (Buffer.byteLength(value, "utf8") < 800_000) {
    try {
      await ref.set({
        value,
        fetchedAt,
        expiresAt: now + ttl * 1000,
        cleanupAt: new Date(now + ttl * 1000),
      });
    } catch {
      console.warn("Qloo cache write skipped");
    }
  }
  return { data, cached: false, fetchedAt };
}
export async function searchEntities(query: string, kind: EntityKind) {
  if (!KINDS.has(kind) || query.trim().length < 2 || query.length > 80)
    throw new AppError(
      "Enter 2–80 characters and choose a supported cultural category.",
    );
  const result = await qloo(
    "/search",
    { query: query.trim(), types: "urn:entity:" + kind, take: "8" },
    604800,
  );
  return {
    ...result,
    entities: entitiesFrom(result.data).map((e) => cleanEntity(e, kind)),
  };
}
