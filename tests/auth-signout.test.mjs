import test from "node:test";
import assert from "node:assert/strict";
import { POST } from "../app/api/auth/signout/route.ts";
const origin = "https://sideb-records.web.app",
  guest = "a".repeat(64);
process.env.APP_ORIGIN = origin;
const request = (cookie, source = origin) =>
  new Request(origin + "/api/auth/signout?return_to=https://evil.example", {
    method: "POST",
    headers: { origin: source, cookie: "__session=" + cookie },
  });
test("native sign-out works without client JavaScript and restores the original guest", async () => {
  const r = await POST(request("aaa.bbb.ccc~" + guest));
  assert.equal(r.status, 303);
  assert.equal(r.headers.get("location"), origin + "/");
  const cookie = r.headers.get("set-cookie");
  assert.ok(cookie.includes("__session=" + guest));
  assert.match(cookie, /HttpOnly/i);
  assert.match(cookie, /SameSite=lax/i);
  assert.match(cookie, /Max-Age=2592000/i);
  assert.equal(r.headers.get("cache-control"), "no-store");
});
test("native sign-out expires account-only or malformed cookies without trusting claims", async () => {
  for (const cookie of ["aaa.bbb.ccc", "aaa.bbb.ccc~bad"]) {
    const r = await POST(request(cookie));
    assert.equal(r.status, 303);
    assert.match(r.headers.get("set-cookie"), /Max-Age=0/i);
  }
});
test("cross-origin form sign-out cannot change the session", async () => {
  const r = await POST(request("aaa.bbb.ccc~" + guest, "https://evil.example"));
  assert.equal(r.status, 403);
  assert.equal(r.headers.get("set-cookie"), null);
});
