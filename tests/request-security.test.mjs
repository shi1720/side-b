import test from "node:test";
import assert from "node:assert/strict";
import { z } from "zod";
import { assertSameOrigin, readBody } from "../lib/store.ts";
import { errorResponse, AppError } from "../lib/errors.ts";
test("write origin follows canonical app rather than internal Cloud Run host", () => {
  const old = process.env.APP_ORIGIN;
  process.env.APP_ORIGIN = "https://sideb.example";
  try {
    assert.doesNotThrow(() =>
      assertSameOrigin(
        new Request("http://internal:8080/api/workspace", {
          headers: { origin: "https://sideb.example" },
        }),
      ),
    );
    assert.throws(
      () =>
        assertSameOrigin(
          new Request("https://attacker.example/api/workspace", {
            headers: { origin: "https://attacker.example" },
          }),
        ),
      (e) => e.status === 403,
    );
    assert.throws(
      () =>
        assertSameOrigin(
          new Request("http://internal:8080/api/workspace", {
            headers: {
              origin: "https://sideb.example",
              "sec-fetch-site": "cross-site",
            },
          }),
        ),
      (e) => e.status === 403,
    );
  } finally {
    if (old === undefined) delete process.env.APP_ORIGIN;
    else process.env.APP_ORIGIN = old;
  }
});
test("production refuses writes without configured canonical origin", () => {
  const origin = process.env.APP_ORIGIN,
    node = process.env.NODE_ENV;
  delete process.env.APP_ORIGIN;
  process.env.NODE_ENV = "production";
  try {
    assert.throws(
      () =>
        assertSameOrigin(
          new Request("https://attacker.example/api/workspace", {
            headers: { origin: "https://attacker.example" },
          }),
        ),
      (e) => e.status === 403,
    );
  } finally {
    if (origin !== undefined) process.env.APP_ORIGIN = origin;
    process.env.NODE_ENV = node;
  }
});
test("JSON reader rejects oversized streamed body without trusting Content-Length", async () => {
  const request = new Request("https://sideb.example/api/workspace", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ text: "x".repeat(80000) }),
  });
  await assert.rejects(
    () => readBody(request, z.object({ text: z.string() })),
    (e) => e.status === 413,
  );
});
test("JSON reader accepts parameterized JSON but rejects JSONP and malformed JSON", async () => {
  assert.deepEqual(
    await readBody(
      new Request("https://sideb.example", {
        method: "POST",
        headers: { "content-type": "application/json; charset=utf-8" },
        body: '{"name":"Shop"}',
      }),
      z.object({ name: z.string() }).strict(),
    ),
    { name: "Shop" },
  );
  await assert.rejects(
    () =>
      readBody(
        new Request("https://sideb.example", {
          method: "POST",
          headers: { "content-type": "application/jsonp" },
          body: "{}",
        }),
        z.object({}),
      ),
    (e) => e.status === 415,
  );
  await assert.rejects(
    () =>
      readBody(
        new Request("https://sideb.example", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: "{broken",
        }),
        z.object({}),
      ),
    (e) => e.status === 400,
  );
});
test("unexpected SDK status errors do not expose internal error messages", async () => {
  const error = Object.assign(
    new Error("private credentials and service configuration"),
    { status: 503 },
  );
  const response = errorResponse(error);
  assert.equal(response.status, 500);
  assert.ok(!(await response.text()).includes("private credentials"));
  const expected = errorResponse(new AppError("Safe validation error", 409));
  assert.equal(expected.status, 409);
  assert.equal((await expected.json()).error, "Safe validation error");
});
const { visitorIdentity } = await import("../lib/qloo.ts");
test("anonymous visitor quotas use a stable opaque cookie rather than forged forwarding or user headers", () => {
  const token = "b".repeat(64);
  const a = visitorIdentity(
    new Request("https://sideb.example", {
      headers: {
        cookie: "__session=" + token,
        "x-forwarded-for": "attacker,shared-lb",
        "x-user-id": "admin",
      },
    }),
  );
  const b = visitorIdentity(
    new Request("https://sideb.example", {
      headers: {
        cookie: "__session=" + token,
        "x-forwarded-for": "different,other-lb",
      },
    }),
  );
  assert.equal(a.identity, b.identity);
  assert.equal(a.cookie, undefined);
  const fresh = visitorIdentity(new Request("https://sideb.example"));
  assert.match(fresh.cookie, /^__session=[a-f0-9]{64};/);
  assert.match(fresh.cookie, /HttpOnly/);
  assert.match(fresh.cookie, /Secure/);
  assert.ok(!fresh.identity.includes(token));
});
test("visitor quota handling never overwrites an existing account JWT cookie", () => {
  const jwt = "header.payload.signature";
  assert.equal(
    visitorIdentity(
      new Request("https://sideb.example", {
        headers: { cookie: "__session=" + jwt },
      }),
    ).cookie,
    undefined,
  );
});
