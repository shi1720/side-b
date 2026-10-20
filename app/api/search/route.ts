import { errorResponse } from "@/lib/errors";
import { quota, searchEntities } from "@/lib/qloo";
import { getWorkspaceContext } from "@/lib/store";
import type { EntityKind } from "@/lib/types";
export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const ctx = await getWorkspaceContext(request);
    await quota("search-hour:" + ctx.ownerId, 80, 3600);
    const result = await searchEntities(
      url.searchParams.get("q") ?? "",
      (url.searchParams.get("kind") ?? "artist") as EntityKind,
    );
    return Response.json(
      { entities: result.entities },
      {
        headers: {
          "Cache-Control": "no-store",
          ...(ctx.cookie ? { "Set-Cookie": ctx.cookie } : {}),
        },
      },
    );
  } catch (error) {
    return errorResponse(error);
  }
}
