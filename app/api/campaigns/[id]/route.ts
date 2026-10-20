import { z } from 'zod';
import { apiError, ApiError, assertSameOrigin, database, getWorkspaceContext, json, publicCampaign, readBody } from '@/lib/store';
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try { const { id } = await context.params; return json(await publicCampaign(id)); } catch (error) { return apiError(error); }
}
export async function PATCH(request: Request, context: {params:Promise<{id:string}>}) {
 try {
  assertSameOrigin(request);
  const {id}=await context.params;
  const input=await readBody(request,z.object({published:z.boolean()}).strict());
  const owner=await getWorkspaceContext(request);
  const campaign=owner.workspace.campaigns.find(c=>c.id===id);
  if(!campaign)throw new ApiError(404,'Collection not found.');
  await database().prepare('UPDATE campaigns SET published=? WHERE id=? AND owner_id=?').bind(input.published?1:0,id,owner.ownerId).run();
  return json({campaign:{...campaign,published:input.published}},owner.cookie);
 }catch(error){return apiError(error);}
}
