import { z } from "zod";
import {
  apiError,
  assertSameOrigin,
  json,
  readBody,
  reserveRecord,
} from "@/lib/store";
import { visitorIdentity } from "@/lib/qloo";
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    assertSameOrigin(request);
    const { id } = await context.params;
    const input = await readBody(
      request,
      z
        .object({
          sku: z.string().min(1).max(60),
          customerName: z
            .string()
            .trim()
            .min(1)
            .max(60)
            .regex(
              /^[^\u0000-\u001f\u007f]+$/,
              "Enter a name without control characters.",
            ),
          quantity: z.literal(1),
          idempotencyKey: z.string().uuid(),
        })
        .strict(),
    );
    const visitor = visitorIdentity(request);
    const result = await reserveRecord(id, input, visitor.identity);
    return json(
      {
        reservation: {
          id: result.id,
          reference: result.reference,
          status: result.status,
        },
      },
      visitor.cookie,
      201,
    );
  } catch (error) {
    return apiError(error);
  }
}
