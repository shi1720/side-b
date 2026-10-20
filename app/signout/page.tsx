import Link from "next/link";
export default function SignOut() {
  return (
    <main className="auth-page">
      <section className="auth-card">
        <span className="eyebrow">SIDE B</span>
        <h1>Sign out of your shop?</h1>
        <p>
          Your saved inventory and collections will be here when you return. You
          will return to this browser’s guest workspace, if one was saved before
          signing in.
        </p>
        <form method="post" action="/api/auth/signout">
          <button className="button primary" type="submit">
            Sign out
          </button>
        </form>
        <Link href="/">Back to studio</Link>
      </section>
    </main>
  );
}
