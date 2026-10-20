import { z } from 'zod';
import { apiError, assertSameOrigin, getWorkspaceContext, json, readBody, transitionReservation } from '@/lib/store';
export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(request); const { id } = await context.params;
    const input = await readBody(request,z.object({ status: z.enum(['collected','cancelled']) }).strict());
    const owner = await getWorkspaceContext(request); const reservation = await transitionReservation(owner.ownerId,id,input.status);
    return json({ reservation },owner.cookie);
  } catch (error) { return apiError(error); }
}
