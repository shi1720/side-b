import { z } from "zod";
import {
  apiError,
  assertSameOrigin,
  getWorkspaceContext,
  json,
  publishCampaign,
  readBody,
} from "@/lib/store";
export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const input = await readBody(
      request,
      z
        .object({
          runId: z.string().uuid(),
          title: z.string().trim().min(1).max(120).optional(),
          description: z.string().trim().min(1).max(2000).optional(),
        })
        .strict(),
    );
    const context = await getWorkspaceContext(request);
    const campaign = await publishCampaign(context.ownerId, input);
    return json(
      {
        campaign,
        url: `${process.env.APP_ORIGIN || new URL(request.url).origin}/c/${campaign.id}`,
      },
      context.cookie,
      201,
    );
  } catch (error) {
    return apiError(error);
  }
}
