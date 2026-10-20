/** Shared browser/server helpers. These parse cookie syntax; Firebase Admin must verify every account JWT. */
export const SESSION_COOKIE_NAME = "__session";
export const GUEST_COOKIE_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;
export const ACCOUNT_SESSION_DURATION_MS = 5 * 24 * 60 * 60 * 1000;
const GUEST = /^[a-f0-9]{64}$/;
const JWT = /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/;
const MAX_COOKIE_BYTES = 3800;
export type ParsedSession = { sessionToken?: string; guestToken?: string };
export function parseSessionCookie(value: unknown): ParsedSession {
  if (typeof value !== "string" || !value || value.length > MAX_COOKIE_BYTES)
    return {};
  if (GUEST.test(value)) return { guestToken: value };
  const parts = value.split("~");
  if (
    parts.length > 2 ||
    !JWT.test(parts[0]) ||
    (parts.length === 2 && !GUEST.test(parts[1]))
  )
    return {};
  return {
    sessionToken: parts[0],
    ...(parts.length === 2 ? { guestToken: parts[1] } : {}),
  };
}
export function buildSessionCookie(
  sessionToken: string,
  guestToken?: string,
): string {
  if (
    !JWT.test(sessionToken) ||
    (guestToken !== undefined && !GUEST.test(guestToken))
  )
    throw new Error("Invalid session-cookie format.");
  const value = sessionToken + (guestToken ? "~" + guestToken : "");
  if (value.length > MAX_COOKIE_BYTES)
    throw new Error("Session-cookie value is too large.");
  return value;
}
/** A retained guest survives 30 days; account access still expires at the verified JWT’s 5-day expiry. */
export function sessionCookieMaxAgeSeconds(value: string): number {
  const parsed = parseSessionCookie(value);
  return parsed.guestToken
    ? GUEST_COOKIE_MAX_AGE_SECONDS
    : parsed.sessionToken
      ? ACCOUNT_SESSION_DURATION_MS / 1000
      : 0;
}
export function safeReturnPath(value: unknown = "/"): string {
  if (
    typeof value !== "string" ||
    !value.startsWith("/") ||
    value.startsWith("//") ||
    /[\\\u0000-\u001f\u007f]/.test(value)
  )
    return "/";
  try {
    const url = new URL(value, "https://sideb.local");
    const decoded = decodeURIComponent(url.pathname);
    if (
      url.origin !== "https://sideb.local" ||
      decoded.startsWith("//") ||
      /[\\\u0000-\u001f\u007f]/.test(decoded) ||
      /^\/(signin|signout|api\/auth)(?:\/|$)/i.test(decoded)
    )
      return "/";
    return url.pathname + url.search;
  } catch {
    return "/";
  }
}
