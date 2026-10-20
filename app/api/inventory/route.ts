import { apiError, assertSameOrigin, database, getWorkspaceContext, insertInventory, inventorySchema, json, readBody } from '@/lib/store';
export async function PUT(request: Request) {
  try {
    assertSameOrigin(request); const input = await readBody(request, inventorySchema); const context = await getWorkspaceContext(request);
    const db = database();
    // Trigger rejects replacement during active holds. D1 batch rolls everything back.
    await db.batch([db.prepare('DELETE FROM inventory WHERE owner_id=?').bind(context.ownerId), ...input.items.map(item => insertInventory(db,context.ownerId,item)), db.prepare("UPDATE workspaces SET sample=?, pickup_instructions=CASE WHEN sample=1 AND ?=0 AND pickup_instructions='Demo collection only — no real stock or pickup.' THEN '' ELSE pickup_instructions END WHERE owner_id=?").bind(input.sample ? 1 : 0,input.sample ? 1 : 0,context.ownerId)]);
    return json({ inventory: input.items },context.cookie);
  } catch (error) { return apiError(error); }
}
