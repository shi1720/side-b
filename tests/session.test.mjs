import test from "node:test";
import assert from "node:assert/strict";
import {
  parseSessionCookie,
  buildSessionCookie,
  sessionCookieMaxAgeSeconds,
  safeReturnPath,
  ACCOUNT_SESSION_DURATION_MS,
  GUEST_COOKIE_MAX_AGE_SECONDS,
} from "../lib/session.ts";
const guest = "a".repeat(64),
  jwt = "header.payload.signature";
test("one cookie retains guest on login and restores it independently of account JWT verification", () => {
  const compound = buildSessionCookie(jwt, guest);
  assert.deepEqual(parseSessionCookie(compound), {
    sessionToken: jwt,
    guestToken: guest,
  });
  assert.deepEqual(parseSessionCookie(guest), { guestToken: guest });
  assert.deepEqual(parseSessionCookie(jwt), { sessionToken: jwt });
});
test("account token remains 5 days while compound guest persistence is 30 days", () => {
  assert.equal(ACCOUNT_SESSION_DURATION_MS, 432000000);
  assert.equal(sessionCookieMaxAgeSeconds(jwt), 432000);
  assert.equal(
    sessionCookieMaxAgeSeconds(buildSessionCookie(jwt, guest)),
    2592000,
  );
  assert.equal(sessionCookieMaxAgeSeconds(guest), GUEST_COOKIE_MAX_AGE_SECONDS);
  assert.equal(sessionCookieMaxAgeSeconds("invalid"), 0);
});
test("malformed cookie suffixes, controls, truncation and oversize values never become an account identity", () => {
  for (const value of [
    undefined,
    null,
    "",
    jwt + "~bad",
    jwt + "~" + guest + "~" + guest,
    guest + "~" + guest,
    "bad~" + guest,
    "header.payload.signature\n",
    "x".repeat(4000),
    { cookie: guest },
  ])
    assert.deepEqual(parseSessionCookie(value), {}, String(value));
  assert.throws(() => buildSessionCookie(jwt, "BAD"));
  assert.throws(() => buildSessionCookie("not a JWT"));
});
test("parsing a JWT shape does not pretend to verify or trust its claims", () => {
  const forged = "eyJhbGciOiJub25lIn0.eyJ1aWQiOiJhZG1pbiJ9.ZmFrZQ";
  assert.equal(parseSessionCookie(forged).sessionToken, forged);
  assert.equal(parseSessionCookie(forged).userId, undefined);
});
test("return path rejects external URLs, control normalization, encoded authority and auth loops", () => {
  for (const path of [
    "https://evil.example",
    "//evil.example",
    "/\\evil.example",
    "/\n/evil.example",
    "/\t/evil.example",
    "/%0a/evil.example",
    "/%2f%2fevil.example",
    "/%5cevil.example",
    "/signin",
    "/signout?return_to=/",
    "/api/auth/session",
    "/a/../signin",
    "/%73ignin",
    "/%zz",
    null,
  ])
    assert.equal(safeReturnPath(path), "/", String(path));
});
test("return path preserves legitimate local destinations and query while removing fragment", () => {
  assert.equal(
    safeReturnPath("/c/abc?mode=pickup#record"),
    "/c/abc?mode=pickup",
  );
  assert.equal(
    safeReturnPath("/inventory?search=Nick%20Drake"),
    "/inventory?search=Nick%20Drake",
  );
  assert.equal(safeReturnPath("/signing-records"), "/signing-records");
});
