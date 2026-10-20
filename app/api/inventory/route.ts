import {
  apiError,
  assertSameOrigin,
  getWorkspaceContext,
  inventorySchema,
  json,
  readBody,
  replaceInventory,
} from "@/lib/store";
export async function PUT(request: Request) {
  try {
    assertSameOrigin(request);
    const input = await readBody(request, inventorySchema);
    const ctx = await getWorkspaceContext(request);
    await replaceInventory(ctx.ownerId, input.items, input.sample ?? false);
    return json({ inventory: input.items }, ctx.cookie);
  } catch (error) {
    return apiError(error);
  }
}
