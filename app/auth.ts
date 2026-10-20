import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/firebase-admin";
import { parseSessionCookie, safeReturnPath } from "@/lib/session";
export { safeReturnPath } from "@/lib/session";

export type ShopUser = {
  userId: string;
  displayName: string;
  email: string;
  fullName: string | null;
};
export async function getCurrentUser(): Promise<ShopUser | null> {
  const { sessionToken: session } = parseSessionCookie(
    (await cookies()).get("__session")?.value,
  );
  if (!session) return null;
  try {
    const claims = await auth().verifySessionCookie(session, true);
    if (!claims.email || !claims.email_verified) return null;
    return {
      userId: claims.uid,
      displayName: claims.name || claims.email,
      email: claims.email,
      fullName: claims.name || null,
    };
  } catch {
    return null;
  }
}
export async function requireUser(returnTo: string): Promise<ShopUser> {
  const user = await getCurrentUser();
  if (user) return user;
  redirect(signInPath(returnTo));
}
export function signInPath(returnTo: string) {
  return "/signin?return_to=" + encodeURIComponent(safeReturnPath(returnTo));
}
export function signOutPath() {
  return "/signout";
}
