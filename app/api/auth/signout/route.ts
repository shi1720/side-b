import { NextResponse } from "next/server";
import { assertSameOrigin, apiError } from "@/lib/store";
import {
  parseSessionCookie,
  GUEST_COOKIE_MAX_AGE_SECONDS,
} from "@/lib/session";
export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const value = request.headers
      .get("cookie")
      ?.split(";")
      .map((v) => v.trim())
      .find((v) => v.startsWith("__session="))
      ?.slice(10);
    const { guestToken } = parseSessionCookie(value);
    const response = NextResponse.redirect(
      new URL("/", process.env.APP_ORIGIN || request.url),
      303,
    );
    response.headers.set("Cache-Control", "no-store");
    response.cookies.set("__session", guestToken || "", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: guestToken ? GUEST_COOKIE_MAX_AGE_SECONDS : 0,
    });
    return response;
  } catch (e) {
    return apiError(e);
  }
}
