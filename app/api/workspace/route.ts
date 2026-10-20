import { z } from "zod";
import {
  apiError,
  assertSameOrigin,
  deleteWorkspace,
  getWorkspaceContext,
  json,
  readBody,
  updateWorkspace,
} from "@/lib/store";
export async function GET(request: Request) {
  try {
    const ctx = await getWorkspaceContext(request);
    return json(ctx.workspace, ctx.cookie);
  } catch (error) {
    return apiError(error);
  }
}
export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const input = await readBody(
      request,
      z
        .object({
          name: z.string().trim().min(1).max(80).optional(),
          currency: z.enum(["USD", "GBP", "INR", "EUR"]).optional(),
          pickupInstructions: z.string().trim().max(500).optional(),
        })
        .strict(),
    );
    const ctx = await getWorkspaceContext(request);
    const updated = await updateWorkspace(ctx.ownerId, input);
    return json({ ...ctx.workspace, ...updated }, ctx.cookie);
  } catch (error) {
    return apiError(error);
  }
}
export async function DELETE(request: Request) {
  try {
    assertSameOrigin(request);
    const ctx = await getWorkspaceContext(request);
    await deleteWorkspace(ctx.ownerId);
    return json(
      { ok: true },
      `__session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${process.env.NODE_ENV === "production" || (process.env.APP_ORIGIN || new URL(request.url).origin).startsWith("https:") ? "; Secure" : ""}`,
    );
  } catch (error) {
    return apiError(error);
  }
}
