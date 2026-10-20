import { z } from "zod";
import { AppError, errorResponse } from "@/lib/errors";
import { quota } from "@/lib/qloo";
import {
  getWorkspaceContext,
  saveAgentRun,
  readBody,
  assertSameOrigin,
} from "@/lib/store";
import { runAgent } from "@/lib/agent";
const schema = z.object({
  anchors: z
    .array(
      z.object({
        id: z.string().uuid(),
        name: z.string().trim().min(1).max(80),
        kind: z.enum(["artist", "movie", "book", "tv_show"]),
      }),
    )
    .min(1)
    .max(3),
  constraints: z.object({
    count: z.number().int().min(1).max(8),
    maxPrice: z.number().min(1).max(10000),
    minMargin: z.number().min(0).max(0.95),
    minFit: z.number().min(0).max(1),
    prioritizeAge: z.boolean(),
  }),
});
export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const input = await readBody(request, schema);
    if (
      new Set(input.anchors.map((a) => a.id.toUpperCase())).size !==
      input.anchors.length
    )
      throw new AppError("Choose different cultural anchors.");
    const ctx = await getWorkspaceContext(request);
    await quota("agent-hour:" + ctx.ownerId, 15, 3600);
    const run = await runAgent(
      ctx.workspace.inventory,
      input.anchors,
      input.constraints,
    );
    await saveAgentRun(ctx.ownerId, run, ctx.generation);
    return Response.json(run, {
      headers: {
        "Cache-Control": "no-store",
        ...(ctx.cookie ? { "Set-Cookie": ctx.cookie } : {}),
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
