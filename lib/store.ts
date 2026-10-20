import { createHash, randomBytes, randomUUID } from "node:crypto";
import type { Query } from "firebase-admin/firestore";
import { getCurrentUser } from "@/app/auth";
import { firestore } from "./firebase-admin";
import { SAMPLE_INVENTORY } from "./seed";
import type {
  AgentRun,
  Campaign,
  InventoryItem,
  Reservation,
  Workspace,
} from "./types";
import { z } from "zod";
import { AppError } from "./errors";
import { quota, UUID } from "./qloo";
import { parseSessionCookie } from "./session";

export class ApiError extends AppError {
  constructor(status: number, message: string) {
    super(message, status);
  }
}
export const SAMPLE_PICKUP = "Sample collection only. No real stock or pickup.";
export function isSamplePickup(value: unknown) {
  return (
    typeof value === "string" &&
    [
      SAMPLE_PICKUP,
      "Demo collection only " +
        String.fromCharCode(8212) +
        " no real stock or pickup.",
    ].includes(value.trim())
  );
}
const HOLD_MS = 48 * 60 * 60 * 1000;
const MAX_ACTIVE_HOLDS = 200;
type WorkspaceRecord = {
  name: string;
  currency: Workspace["currency"];
  sample: boolean;
  pickupInstructions: string;
  inventory: InventoryItem[];
  generation: string;
  activeHolds: number;
  campaignCount: number;
  runCount: number;
  createdAt: string;
  deleting?: boolean;
  deleteToken?: string;
};
type CampaignRecord = Campaign & {
  ownerId: string;
  generation: string;
  sample: boolean;
  activeHolds: number;
  collected: number;
};
type ReservationRecord = Reservation & {
  artist: string;
  title: string;
  priceCents: number;
  idempotencyKey: string;
  expiresAt: number;
};
const workspaceRef = (ownerId: string) =>
  firestore().collection("workspaces").doc(ownerId);
const campaignRef = (id: string) => firestore().collection("campaigns").doc(id);
const runRef = (id: string) => firestore().collection("agent_runs").doc(id);
const plain = <T>(value: T): T => JSON.parse(JSON.stringify(value));
function liveWorkspace(value: WorkspaceRecord | undefined) {
  if (!value || value.deleting)
    throw new ApiError(
      409,
      "This workspace changed or is being deleted. Refresh before trying again.",
    );
  return value;
}
function validateId(id: string) {
  if (!UUID.test(id)) throw new ApiError(404, "Collection not found.");
}
export function assertSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  const expected =
    process.env.APP_ORIGIN ||
    (process.env.NODE_ENV !== "production"
      ? new URL(request.url).origin
      : undefined);
  if (
    !expected ||
    !origin ||
    origin !== expected ||
    request.headers.get("sec-fetch-site") === "cross-site"
  )
    throw new ApiError(
      403,
      "Please make this change from the Side B application.",
    );
}
export async function readBody<T>(
  request: Request,
  schema: z.ZodType<T>,
): Promise<T> {
  if (
    !/^application\/json(?:\s*;|$)/i.test(
      request.headers.get("content-type") ?? "",
    )
  )
    throw new ApiError(415, "Send application/json.");
  const limit = 80_000;
  if (Number(request.headers.get("content-length")) > limit)
    throw new ApiError(413, "Request is too large.");
  const reader = request.body?.getReader();
  if (!reader) throw new ApiError(400, "A JSON body is required.");
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const r = await reader.read();
    if (r.done) break;
    size += r.value.byteLength;
    if (size > limit) {
      await reader.cancel();
      throw new ApiError(413, "Request is too large.");
    }
    chunks.push(r.value);
  }
  const joined = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    joined.set(chunk, offset);
    offset += chunk.length;
  }
  let input: unknown;
  try {
    input = JSON.parse(new TextDecoder().decode(joined));
  } catch {
    throw new ApiError(400, "Invalid JSON.");
  }
  const parsed = schema.safeParse(input);
  if (!parsed.success)
    throw new ApiError(
      400,
      parsed.error.issues
        .map((i) => `${i.path.join(".") || "request"}: ${i.message}`)
        .slice(0, 3)
        .join("; "),
    );
  return parsed.data;
}
export function json(data: unknown, cookie?: string, status = 200) {
  return Response.json(data, {
    status,
    headers: {
      "Cache-Control": "no-store",
      ...(cookie ? { "Set-Cookie": cookie } : {}),
    },
  });
}
export function apiError(error: unknown) {
  if (error instanceof AppError)
    return json({ error: error.message }, undefined, error.status);
  console.error(
    "Workspace operation failed",
    error instanceof Error ? error.name : "unknown",
  );
  return json(
    { error: "This change could not be saved. Please try again." },
    undefined,
    500,
  );
}
function toCampaign(value: CampaignRecord): Campaign {
  return {
    id: value.id,
    title: value.title,
    description: value.description,
    createdAt: value.createdAt,
    published: value.published,
    run: value.run,
    reservations: value.activeHolds,
    sales: value.collected,
  };
}
function toReservation(value: ReservationRecord): Reservation {
  return {
    id: value.id,
    campaignId: value.campaignId,
    sku: value.sku,
    itemTitle: value.itemTitle,
    customerName: value.customerName,
    quantity: 1,
    status: value.status,
    createdAt: value.createdAt,
    reference: value.reference,
  };
}

/** One transaction restores each expired hold exactly once and updates all counters. */
export async function expireHolds(ownerId: string, now = Date.now()) {
  const ref = workspaceRef(ownerId);
  await firestore().runTransaction(async (tx) => {
    const ws = (await tx.get(ref)).data() as WorkspaceRecord | undefined;
    if (!ws || ws.deleting) return;
    const held = await tx.get(
      ref.collection("reservations").where("status", "==", "held"),
    );
    const expired = held.docs.filter((d) => Number(d.data().expiresAt) <= now);
    if (!expired.length) return;
    const counts = new Map<string, number>();
    for (const doc of expired) {
      const r = doc.data() as ReservationRecord;
      counts.set(r.campaignId, (counts.get(r.campaignId) ?? 0) + 1);
    }
    const refs = [...counts.keys()].map(campaignRef);
    const campaigns = refs.length ? await tx.getAll(...refs) : [];
    const inventory = ws.inventory.map((item) => ({ ...item }));
    for (const doc of expired) {
      const r = doc.data() as ReservationRecord;
      const item = inventory.find(
        (i) => i.sku === r.sku && i.artist === r.artist && i.title === r.title,
      );
      if (item) item.quantity++;
      tx.update(doc.ref, { status: "cancelled" });
    }
    tx.update(ref, {
      inventory,
      activeHolds: Math.max(0, ws.activeHolds - expired.length),
    });
    for (const doc of campaigns) {
      if (doc.exists)
        tx.update(doc.ref, {
          activeHolds: Math.max(
            0,
            Number(doc.data()?.activeHolds ?? 0) - (counts.get(doc.id) ?? 0),
          ),
        });
    }
  });
}
export async function getWorkspaceContext(
  request: Request,
): Promise<{
  ownerId: string;
  workspace: Workspace;
  generation: string;
  cookie?: string;
}> {
  const user = await getCurrentUser();
  // Firebase Hosting forwards only __session. Guest tokens and signed-in JWTs share this cookie name.
  const existing = request.headers
    .get("cookie")
    ?.split(";")
    .map((v) => v.trim())
    .find((v) => v.startsWith("__session="))
    ?.slice("__session=".length);
  const token = parseSessionCookie(existing).guestToken ?? null;
  let ownerId: string;
  let cookie: string | undefined;
  if (user)
    ownerId =
      "user_" +
      createHash("sha256")
        .update("sideb:user:" + user.userId)
        .digest("hex");
  else {
    const next = token ?? randomBytes(32).toString("hex");
    ownerId = "guest_" + next;
    if (!token)
      cookie = `__session=${next}; Path=/; HttpOnly; SameSite=Lax; Max-Age=2592000${process.env.NODE_ENV === "production" || (process.env.APP_ORIGIN || new URL(request.url).origin).startsWith("https:") ? "; Secure" : ""}`;
  }
  const ref = workspaceRef(ownerId);
  if (!(await ref.get()).exists) {
    await quota("workspace-create:global", 500, 86400);
    if (user) await quota("workspace-create-user:" + ownerId, 10, 86400);
    await firestore().runTransaction(async (tx) => {
      if ((await tx.get(ref)).exists) return;
      tx.create(ref, {
        name: "Side B Records",
        currency: "USD",
        sample: true,
        pickupInstructions: SAMPLE_PICKUP,
        inventory: SAMPLE_INVENTORY,
        generation: randomUUID(),
        activeHolds: 0,
        campaignCount: 0,
        runCount: 0,
        createdAt: new Date().toISOString(),
      });
    });
  }
  await expireHolds(ownerId);
  const [doc, campaigns, reservations] = await Promise.all([
    ref.get(),
    firestore().collection("campaigns").where("ownerId", "==", ownerId).get(),
    ref
      .collection("reservations")
      .orderBy("createdAt", "desc")
      .limit(500)
      .get(),
  ]);
  const ws = liveWorkspace(doc.data() as WorkspaceRecord | undefined);
  return {
    ownerId,
    generation: ws.generation,
    cookie,
    workspace: {
      name: ws.name,
      currency: ws.currency,
      sample: ws.sample,
      pickupInstructions: isSamplePickup(ws.pickupInstructions)
        ? SAMPLE_PICKUP
        : ws.pickupInstructions,
      inventory: ws.inventory,
      campaigns: campaigns.docs
        .map((d) => toCampaign(d.data() as CampaignRecord))
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
      reservations: reservations.docs.map((d) =>
        toReservation(d.data() as ReservationRecord),
      ),
      user: user ? { displayName: user.displayName, email: user.email } : null,
    },
  };
}
export async function updateWorkspace(
  ownerId: string,
  input: {
    name?: string;
    currency?: Workspace["currency"];
    pickupInstructions?: string;
  },
) {
  const ref = workspaceRef(ownerId);
  return firestore().runTransaction(async (tx) => {
    const ws = liveWorkspace(
      (await tx.get(ref)).data() as WorkspaceRecord | undefined,
    );
    if (input.currency && input.currency !== ws.currency && ws.campaignCount)
      throw new ApiError(
        409,
        "Currency is fixed after publishing a collection.",
      );
    const previousPickup = isSamplePickup(ws.pickupInstructions)
      ? SAMPLE_PICKUP
      : ws.pickupInstructions;
    const pickup = input.pickupInstructions ?? previousPickup;
    if (
      !ws.sample &&
      ws.campaignCount &&
      (!pickup.trim() || isSamplePickup(pickup))
    )
      throw new ApiError(
        409,
        "Published real-stock collections need pickup instructions.",
      );
    const updated = {
      name: input.name ?? ws.name,
      currency: input.currency ?? ws.currency,
      pickupInstructions: pickup,
    };
    tx.update(ref, updated);
    return updated;
  });
}
export const inventorySchema = z
  .object({
    items: z
      .array(
        z
          .object({
            sku: z
              .string()
              .trim()
              .min(1)
              .max(60)
              .regex(
                /^[\w .-]+$/,
                "Use letters, digits, spaces, dots, hyphens or underscores.",
              ),
            artist: z.string().trim().min(1).max(160),
            title: z.string().trim().min(1).max(200),
            price: z.number().finite().min(0.01).max(10000).multipleOf(0.01),
            cost: z.number().finite().min(0).max(10000).multipleOf(0.01),
            quantity: z.number().int().min(0).max(10000),
            daysOnShelf: z.number().int().min(0).max(36500),
            genre: z.string().trim().max(80),
            color: z
              .string()
              .regex(/^#[a-fA-F0-9]{6}$/)
              .optional(),
            entityId: z.string().uuid().optional(),
            image: z
              .string()
              .url()
              .max(2000)
              .refine((v) => v.startsWith("https:"), "Image must use HTTPS.")
              .optional(),
          })
          .strict(),
      )
      .min(1)
      .max(50),
    sample: z.boolean().optional(),
  })
  .strict()
  .refine(
    (v) => new Set(v.items.map((i) => i.sku)).size === v.items.length,
    "Each SKU must be unique.",
  );
export async function replaceInventory(
  ownerId: string,
  items: InventoryItem[],
  sample = false,
) {
  const ref = workspaceRef(ownerId);
  await firestore().runTransaction(async (tx) => {
    const ws = liveWorkspace(
      (await tx.get(ref)).data() as WorkspaceRecord | undefined,
    );
    if (ws.activeHolds > 0)
      throw new ApiError(
        409,
        "Active holds must be collected or cancelled before replacing inventory.",
      );
    tx.update(ref, {
      inventory: plain(items),
      sample,
      pickupInstructions:
        !sample && isSamplePickup(ws.pickupInstructions)
          ? ""
          : ws.pickupInstructions,
    });
  });
}
export async function saveAgentRun(
  ownerId: string,
  run: AgentRun,
  generation?: string,
) {
  const ref = workspaceRef(ownerId);
  await firestore().runTransaction(async (tx) => {
    const ws = liveWorkspace(
      (await tx.get(ref)).data() as WorkspaceRecord | undefined,
    );
    if (generation && ws.generation !== generation)
      throw new ApiError(
        409,
        "The workspace was reset. Generate a fresh collection.",
      );
    if (ws.runCount >= 200)
      throw new ApiError(
        409,
        "This demo workspace has reached its saved-run allowance. Delete the workspace to start fresh.",
      );
    tx.create(runRef(run.id), {
      ownerId,
      generation: ws.generation,
      run: plain(run),
    });
    tx.update(ref, { runCount: ws.runCount + 1 });
  });
}
export async function publishCampaign(
  ownerId: string,
  input: { runId: string; title?: string; description?: string },
) {
  validateId(input.runId);
  const ref = workspaceRef(ownerId);
  const id = randomUUID();
  return firestore().runTransaction(async (tx) => {
    const [workspace, stored] = await Promise.all([
      tx.get(ref),
      tx.get(runRef(input.runId)),
    ]);
    const ws = liveWorkspace(workspace.data() as WorkspaceRecord | undefined);
    const saved = stored.data();
    if (
      !saved ||
      saved.ownerId !== ownerId ||
      saved.generation !== ws.generation
    )
      throw new ApiError(
        404,
        "Run not found. Generate a collection in this workspace first.",
      );
    if (ws.campaignCount >= 100)
      throw new ApiError(
        409,
        "This demo workspace has reached its collection allowance. Delete the workspace to start fresh.",
      );
    if (
      !ws.sample &&
      (!ws.pickupInstructions.trim() || isSamplePickup(ws.pickupInstructions))
    )
      throw new ApiError(
        409,
        "Add your shop address and pickup instructions in workspace settings before publishing real inventory.",
      );
    const run = saved.run as AgentRun;
    if (!run.selected.length)
      throw new ApiError(409, "A campaign needs at least one selected record.");
    if (
      run.selected.some(
        (i) =>
          !ws.inventory.some(
            (v) =>
              v.sku === i.sku &&
              v.artist === i.artist &&
              v.title === i.title &&
              v.price === i.price &&
              v.quantity > 0,
          ),
      )
    )
      throw new ApiError(
        409,
        "Selected stock has changed. Generate a fresh collection before publishing.",
      );
    const campaign: CampaignRecord = {
      id,
      ownerId,
      generation: ws.generation,
      sample: ws.sample,
      title: input.title ?? run.title,
      description: input.description ?? run.description,
      createdAt: new Date().toISOString(),
      published: true,
      run,
      activeHolds: 0,
      collected: 0,
    };
    tx.create(campaignRef(id), plain(campaign));
    tx.update(ref, { campaignCount: ws.campaignCount + 1 });
    return toCampaign(campaign);
  });
}
export async function setCampaignPublished(
  ownerId: string,
  id: string,
  published: boolean,
) {
  validateId(id);
  return firestore().runTransaction(async (tx) => {
    const [c, w] = await Promise.all([
      tx.get(campaignRef(id)),
      tx.get(workspaceRef(ownerId)),
    ]);
    const ws = liveWorkspace(w.data() as WorkspaceRecord | undefined);
    const campaign = c.data() as CampaignRecord | undefined;
    if (
      !campaign ||
      campaign.ownerId !== ownerId ||
      campaign.generation !== ws.generation
    )
      throw new ApiError(404, "Collection not found.");
    tx.update(c.ref, { published });
    return toCampaign({ ...campaign, published });
  });
}
function redactItem(item: InventoryItem & Record<string, unknown>) {
  return plain({
    sku: item.sku,
    artist: item.artist,
    title: item.title,
    price: item.price,
    quantity: item.quantity,
    genre: item.genre,
    color: item.color,
    entityId: item.entityId,
    image: item.image,
    fit: item.fit,
    evidence: item.evidence,
    selected: item.selected,
  });
}
export async function publicCampaign(id: string) {
  validateId(id);
  const initial = await campaignRef(id).get();
  const ownerId = initial.data()?.ownerId;
  if (!ownerId) throw new ApiError(404, "This collection is not available.");
  await expireHolds(String(ownerId));
  return firestore().runTransaction(async (tx) => {
    const [c, w] = await Promise.all([
      tx.get(campaignRef(id)),
      tx.get(workspaceRef(ownerId)),
    ]);
    const campaign = c.data() as CampaignRecord | undefined;
    const ws = w.data() as WorkspaceRecord | undefined;
    if (
      !campaign?.published ||
      !ws ||
      ws.deleting ||
      campaign.generation !== ws.generation
    )
      throw new ApiError(404, "This collection is not available.");
    const selected = campaign.run.selected.map((item) => {
      const current = ws.inventory.find(
        (v) =>
          v.sku === item.sku &&
          v.artist === item.artist &&
          v.title === item.title &&
          v.price === item.price,
      );
      return redactItem({ ...item, quantity: current?.quantity ?? 0 });
    });
    return {
      campaign: {
        id: campaign.id,
        title: campaign.title,
        description: campaign.description,
        createdAt: campaign.createdAt,
        published: true,
        run: {
          id: campaign.run.id,
          mode: campaign.run.mode,
          createdAt: campaign.run.createdAt,
          anchors: campaign.run.anchors,
          selected,
          items: selected,
        },
      },
      shop: {
        name: ws.name,
        currency: ws.currency,
        sample: campaign.sample,
        pickupInstructions:
          campaign.sample || isSamplePickup(ws.pickupInstructions)
            ? SAMPLE_PICKUP
            : ws.pickupInstructions,
      },
      inventory: selected,
    };
  });
}
export async function reserveRecord(
  campaignId: string,
  input: {
    sku: string;
    customerName: string;
    quantity: number;
    idempotencyKey: string;
  },
  identity: string,
) {
  validateId(campaignId);
  const initial = (await campaignRef(campaignId).get()).data() as
    CampaignRecord | undefined;
  if (!initial?.published) throw new ApiError(404, "Collection not found.");
  const ref = workspaceRef(initial.ownerId);
  await expireHolds(initial.ownerId);
  const id = createHash("sha256")
    .update(campaignId + "\0" + input.idempotencyKey)
    .digest("hex");
  const reservationRef = ref.collection("reservations").doc(id);
  const existing = (await reservationRef.get()).data() as
    ReservationRecord | undefined;
  function checked(r: ReservationRecord) {
    if (r.sku !== input.sku || r.customerName !== input.customerName)
      throw new ApiError(409, "This request key was already used.");
    if (r.status === "cancelled")
      throw new ApiError(
        409,
        "This hold has expired or was cancelled. Refresh the collection and create a new hold.",
      );
    return toReservation(r);
  }
  if (existing) return checked(existing);
  await quota(`reserve-hour:${identity}:${campaignId}`, 10, 3600);
  return firestore().runTransaction(async (tx) => {
    const [workspace, campaignDoc, reservation] = await Promise.all([
      tx.get(ref),
      tx.get(campaignRef(campaignId)),
      tx.get(reservationRef),
    ]);
    const ws = liveWorkspace(workspace.data() as WorkspaceRecord | undefined);
    const campaign = campaignDoc.data() as CampaignRecord | undefined;
    if (
      !campaign?.published ||
      campaign.ownerId !== initial.ownerId ||
      campaign.generation !== ws.generation
    )
      throw new ApiError(404, "Collection not found.");
    if (reservation.exists)
      return checked(reservation.data() as ReservationRecord);
    if (ws.activeHolds >= MAX_ACTIVE_HOLDS || campaign.activeHolds >= 100)
      throw new ApiError(
        409,
        "This shop has reached its active pickup-hold allowance. Contact the shop directly.",
      );
    const selected = campaign.run.selected.find((i) => i.sku === input.sku);
    if (!selected)
      throw new ApiError(400, "This record is not in the collection.");
    const inventory = ws.inventory.map((i) => ({ ...i }));
    const item = inventory.find(
      (i) =>
        i.sku === input.sku &&
        i.artist === selected.artist &&
        i.title === selected.title &&
        i.price === selected.price,
    );
    if (!item || item.quantity < 1)
      throw new ApiError(
        409,
        "This record has sold out or changed. Refresh the collection.",
      );
    item.quantity--;
    const createdAt = new Date().toISOString();
    const record: ReservationRecord = {
      id,
      campaignId,
      sku: input.sku,
      itemTitle: selected.title,
      artist: selected.artist,
      title: selected.title,
      priceCents: Math.round(selected.price * 100),
      customerName: input.customerName,
      quantity: 1,
      status: "held",
      createdAt,
      expiresAt: Date.now() + HOLD_MS,
      reference: "SB-" + id.slice(0, 12).toUpperCase(),
      idempotencyKey: input.idempotencyKey,
    };
    tx.create(reservationRef, record);
    tx.update(ref, { inventory, activeHolds: ws.activeHolds + 1 });
    tx.update(campaignDoc.ref, { activeHolds: campaign.activeHolds + 1 });
    return toReservation(record);
  });
}
export async function transitionReservation(
  ownerId: string,
  id: string,
  status: "cancelled" | "collected",
) {
  if (!/^[a-f0-9]{64}$/.test(id))
    throw new ApiError(404, "Reservation not found.");
  await expireHolds(ownerId);
  const ref = workspaceRef(ownerId);
  const reservationRef = ref.collection("reservations").doc(id);
  return firestore().runTransaction(async (tx) => {
    const [w, r] = await Promise.all([tx.get(ref), tx.get(reservationRef)]);
    const ws = liveWorkspace(w.data() as WorkspaceRecord | undefined);
    const reservation = r.data() as ReservationRecord | undefined;
    if (!reservation) throw new ApiError(404, "Reservation not found.");
    const c = await tx.get(campaignRef(reservation.campaignId));
    const campaign = c.data() as CampaignRecord | undefined;
    if (reservation.status === status) return toReservation(reservation);
    if (reservation.status !== "held")
      throw new ApiError(409, "This reservation has already been completed.");
    const inventory = ws.inventory.map((i) => ({ ...i }));
    if (status === "cancelled") {
      const item = inventory.find(
        (i) =>
          i.sku === reservation.sku &&
          i.artist === reservation.artist &&
          i.title === reservation.title,
      );
      if (!item)
        throw new ApiError(
          409,
          "Reserved stock is unavailable. Contact the shop.",
        );
      item.quantity++;
    }
    tx.update(r.ref, { status });
    tx.update(ref, { inventory, activeHolds: Math.max(0, ws.activeHolds - 1) });
    if (campaign)
      tx.update(c.ref, {
        activeHolds: Math.max(0, campaign.activeHolds - 1),
        collected: campaign.collected + (status === "collected" ? 1 : 0),
      });
    return toReservation({ ...reservation, status });
  });
}
async function deleteQuery(query: Query) {
  const results = await query.get();
  for (let start = 0; start < results.docs.length; start += 400) {
    const batch = firestore().batch();
    for (const doc of results.docs.slice(start, start + 400))
      batch.delete(doc.ref);
    await batch.commit();
  }
}
export async function deleteWorkspace(ownerId: string) {
  const ref = workspaceRef(ownerId);
  const deleteToken = randomUUID();
  const shouldDelete = await firestore().runTransaction(async (tx) => {
    const doc = await tx.get(ref);
    if (!doc.exists) return false;
    if (doc.data()?.deleting)
      throw new ApiError(409, "Workspace deletion is already in progress.");
    tx.update(ref, {
      deleting: true,
      deleteToken,
      generation: randomUUID(),
      inventory: [],
      activeHolds: 0,
    });
    return true;
  });
  if (!shouldDelete) return;
  // Tombstone blocks concurrent new writes; all children and global owner records are removed before the workspace itself.
  await Promise.all([
    deleteQuery(
      firestore().collection("campaigns").where("ownerId", "==", ownerId),
    ),
    deleteQuery(
      firestore().collection("agent_runs").where("ownerId", "==", ownerId),
    ),
    deleteQuery(ref.collection("reservations")),
  ]);
  await firestore().runTransaction(async (tx) => {
    const doc = await tx.get(ref);
    if (doc.data()?.deleteToken === deleteToken) tx.delete(ref);
  });
}
