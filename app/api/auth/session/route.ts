import { cookies } from "next/headers";
import { auth } from "@/lib/firebase-admin";
import { assertSameOrigin, readBody, apiError, ApiError } from "@/lib/store";
import { z } from "zod";
import {
  parseSessionCookie,
  buildSessionCookie,
  sessionCookieMaxAgeSeconds,
  ACCOUNT_SESSION_DURATION_MS,
  GUEST_COOKIE_MAX_AGE_SECONDS,
} from "@/lib/session";
export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const { idToken } = await readBody(
      request,
      z.object({ idToken: z.string().min(100).max(10000) }).strict(),
    );
    let claims;
    try {
      claims = await auth().verifyIdToken(idToken, true);
    } catch (error) {
      const code = (error as { code?: string }).code;
      if (
        code &&
        /auth\/(argument-error|invalid-id-token|id-token-expired|id-token-revoked|user-disabled|user-not-found)/.test(
          code,
        )
      )
        throw new ApiError(
          401,
          "Your sign-in has expired. Please sign in again.",
        );
      throw new ApiError(
        503,
        "Sign-in verification is temporarily unavailable. Please try again.",
      );
    }
    if (
      !claims.email_verified ||
      !claims.email ||
      Date.now() / 1000 - claims.auth_time > 300
    )
      throw new ApiError(
        401,
        "Please sign in again with a verified Google account.",
      );
    const expiresIn = ACCOUNT_SESSION_DURATION_MS;
    const jwt = await auth().createSessionCookie(idToken, { expiresIn });
    const jar = await cookies();
    const { guestToken } = parseSessionCookie(jar.get("__session")?.value);
    const value = buildSessionCookie(jwt, guestToken);
    (await cookies()).set("__session", value, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: sessionCookieMaxAgeSeconds(value),
    });
    return Response.json(
      { ok: true },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    return apiError(e);
  }
}
export async function DELETE(request: Request) {
  try {
    assertSameOrigin(request);
    const jar = await cookies();
    const { guestToken } = parseSessionCookie(jar.get("__session")?.value);
    if (guestToken) {
      jar.set("__session", guestToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: GUEST_COOKIE_MAX_AGE_SECONDS,
      });
    } else {
      jar.delete("__session");
    }
    return Response.json(
      { ok: true },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    return apiError(e);
  }
}
