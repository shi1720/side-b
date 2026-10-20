import { z } from 'zod';
import { apiError, assertSameOrigin, database, getWorkspaceContext, json, readBody, ApiError, SAMPLE_PICKUP } from '@/lib/store';
export async function GET(request: Request) {
  try { const context = await getWorkspaceContext(request); return json(context.workspace, context.cookie); } catch (error) { return apiError(error); }
}
export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const input = await readBody(request, z.object({ name: z.string().trim().min(1).max(80).optional(), currency: z.enum(['USD','GBP','INR','EUR']).optional(), pickupInstructions: z.string().trim().max(500).optional() }).strict());
    const context = await getWorkspaceContext(request);
    if (input.currency && input.currency !== context.workspace.currency && context.workspace.campaigns.length) throw new ApiError(409, 'Currency is fixed after publishing a collection.');
    const pickup = input.pickupInstructions ?? context.workspace.pickupInstructions ?? SAMPLE_PICKUP;
    if (!context.workspace.sample && context.workspace.campaigns.length && (!pickup.trim() || pickup === SAMPLE_PICKUP)) throw new ApiError(409, 'Published real-stock collections need pickup instructions.');
    await database().prepare('UPDATE workspaces SET name=?, currency=?, pickup_instructions=? WHERE owner_id=?').bind(input.name || context.workspace.name,input.currency || context.workspace.currency,pickup,context.ownerId).run();
    return json({ ...context.workspace, name: input.name || context.workspace.name, currency: input.currency || context.workspace.currency, pickupInstructions: pickup },context.cookie);
  } catch (error) { return apiError(error); }
}
export async function DELETE(request: Request) {
  try {
    assertSameOrigin(request); const context = await getWorkspaceContext(request);
    const db = database();
    await db.batch([
      db.prepare('DELETE FROM reservations WHERE owner_id=?').bind(context.ownerId),
      db.prepare('DELETE FROM campaigns WHERE owner_id=?').bind(context.ownerId),
      db.prepare('DELETE FROM inventory WHERE owner_id=?').bind(context.ownerId),
      db.prepare('DELETE FROM agent_runs WHERE owner_id=?').bind(context.ownerId),
      db.prepare('DELETE FROM workspaces WHERE owner_id=?').bind(context.ownerId),
    ]);
    return json({ ok: true }, `sideb_guest=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${new URL(request.url).protocol === 'https:' ? '; Secure' : ''}`);
  } catch (error) { return apiError(error); }
}
