import { z } from "zod";
import {
  apiError,
  assertSameOrigin,
  getWorkspaceContext,
  json,
  publicCampaign,
  readBody,
  setCampaignPublished,
} from "@/lib/store";
export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    return json(await publicCampaign(id));
  } catch (error) {
    return apiError(error);
  }
}
export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    assertSameOrigin(request);
    const { id } = await context.params;
    const input = await readBody(
      request,
      z.object({ published: z.boolean() }).strict(),
    );
    const owner = await getWorkspaceContext(request);
    const campaign = await setCampaignPublished(
      owner.ownerId,
      id,
      input.published,
    );
    return json({ campaign }, owner.cookie);
  } catch (error) {
    return apiError(error);
  }
}
