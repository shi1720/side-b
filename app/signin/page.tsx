"use client";
import { useEffect, useRef, useState } from "react";
import { initializeApp, getApps, type FirebaseOptions } from "firebase/app";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithRedirect,
  getRedirectResult,
  browserSessionPersistence,
  setPersistence,
  signOut,
  type Auth,
  type User,
} from "firebase/auth";
import Link from "next/link";
import { safeReturnPath } from "@/lib/session";
export default function SignIn() {
  const [busy, setBusy] = useState(true),
    [error, setError] = useState("");
  const authRef = useRef<Auth | null>(null);
  async function complete(user: User, auth: Auth) {
    const response = await fetch("/api/auth/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idToken: await user.getIdToken() }),
    });
    const body = (await response.json()) as { error?: string };
    if (!response.ok)
      throw new Error(
        body.error || "Sign-in could not be completed. Please try again.",
      );
    await signOut(auth);
    window.location.assign(
      safeReturnPath(
        new URLSearchParams(window.location.search).get("return_to"),
      ),
    );
  }
  useEffect(() => {
    let active = true;
    async function prepare() {
      try {
        const response = await fetch("/api/auth/config");
        if (!response.ok)
          throw new Error(
            "Sign-in is temporarily unavailable. Please try again.",
          );
        const config = (await response.json()) as FirebaseOptions;
        if (!config.apiKey)
          throw new Error(
            "Sign-in has not been configured. You can still explore with a guest workspace.",
          );
        const app = getApps()[0] || initializeApp(config),
          auth = getAuth(app);
        authRef.current = auth;
        await setPersistence(auth, browserSessionPersistence);
        const result = await getRedirectResult(auth);
        if (result) {
          await complete(result.user, auth);
          return;
        }
        if (active) setBusy(false);
      } catch (e) {
        if (active) {
          setError(
            e instanceof Error ? e.message : "Sign-in could not be completed.",
          );
          setBusy(false);
        }
      }
    }
    void prepare();
    return () => {
      active = false;
    };
  }, []);
  async function login() {
    const auth = authRef.current;
    if (!auth) return;
    setBusy(true);
    setError("");
    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: "select_account" });
      await signInWithRedirect(auth, provider);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Sign-in could not be completed.",
      );
      setBusy(false);
    }
  }
  return (
    <main className="auth-page">
      <Link href="/" className="auth-brand">
        Side B<span>RECORD SHOP STUDIO</span>
      </Link>
      <section className="auth-card">
        <span className="eyebrow">YOUR SHOP, IN SYNC</span>
        <h1>A home for your next great edit.</h1>
        <p>
          Save your inventory and collections in a private account workspace,
          ready whenever you return.
        </p>
        <button
          className="button primary"
          onClick={login}
          disabled={busy}
          aria-busy={busy}
        >
          {busy ? "Connecting to Google..." : "Continue with Google"}
        </button>
        {error && (
          <p role="alert" className="auth-error">
            {error}
          </p>
        )}
        <p className="auth-note">
          Signing in opens a separate account workspace. Your guest inventory is
          not transferred. Sign out to return to this browser’s guest workspace.
        </p>
        <Link href="/">Continue as a guest</Link>
      </section>
      <p className="auth-footer">Your stock. Their next obsession.</p>
    </main>
  );
}
