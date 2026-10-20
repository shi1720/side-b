# Architecture

Side B combines a cultural evidence pipeline with a constrained merchandising planner and a small record-shop workflow. The canonical runtime is native Next.js on Node.js, hosted through Firebase Hosting and Cloud Run. Firestore is the production database.

## Request path

```text
Merchant studio / public collection / account pages
                     |
             Firebase Hosting
                     |
         Cloud Run: native Next.js
                     |
         same-origin route handlers
          /          |           \
  Firebase Auth   Qloo API      Firestore
  session check   taste graph  operational state
```

The browser calls same-origin APIs. It uses the Firebase web SDK only for Google sign-in. It does not read or write Firestore directly, and it never receives the Qloo API key. The server accesses Firestore through the Admin SDK and its runtime service account.

`next.config.ts` enables standalone output. The multi-stage `Dockerfile` builds the app, copies the standalone server and static files, and runs it as a non-root user. Firebase Hosting rewrites application paths to the `side-b` Cloud Run service in `us-central1`; reserved Firebase authentication paths remain Hosting-managed. The root layout is force-dynamic and Hosting applies `Cache-Control: no-store` to all paths. This avoids cached HTML referencing JavaScript chunks from an earlier container release. The HTTP smoke checks HTML cache policy and fetches its referenced Next.js boot assets before exercising APIs.

## Identity and ownership

Both session forms use the HttpOnly `__session` cookie because Firebase Hosting forwards this cookie name to the backend.

| Session        | Value and lifetime                                                                        | Ownership                                              |
| -------------- | ----------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| Guest          | Random 32-byte token encoded as 64 hexadecimal characters; 30 days                        | An isolated guest workspace                            |
| Google account | Firebase session JWT, valid for five days, plus the browser’s original guest-token suffix | A workspace derived from the verified Firebase user ID |

Production cookies are Secure, SameSite=Lax and scoped to `/`. Account creation verifies a recent ID token and a verified email before issuing a session cookie. Server identity checks verify Firebase session cookies with revocation checking. The web SDK uses browser-session persistence to complete a same-tab Google redirect, then signs out its temporary client session after the server cookie is created. The canonical auth domain is `sideb-records.web.app`, with an authorized `/__/auth/handler` callback.

Google sign-in issues a compound `__session` value containing the Firebase JWT and the browser’s original opaque guest token. Only the JWT is used for account verification. Signing out restores the guest token, returning to this browser’s previous guest workspace. An expired account session can fall back to the original guest token. Account and guest workspaces remain separate; there is no automatic claim or merge. Clearing cookies loses access to an anonymous workspace. Signing out does not delete account data.

`app/auth.ts` implements `getCurrentUser` by verifying Firebase sessions. It does not trust browser-supplied display names or hosting identity headers. The sign-out confirmation is a server-rendered native POST form; its same-origin endpoint restores the retained guest cookie and returns a 303 redirect, even before client JavaScript hydrates.

## Data model

The named Firestore database contains:

| Collection or path                       | Purpose                                                                             |
| ---------------------------------------- | ----------------------------------------------------------------------------------- |
| `workspaces/{ownerId}`                   | Name, currency, pickup instructions, sample status, inventory and bounded counters  |
| `workspaces/{ownerId}/reservations/{id}` | Private pickup name, record identity, status, expiry, reference and idempotency key |
| `agent_runs/{runId}`                     | Saved decision, owner and workspace generation                                      |
| `campaigns/{campaignId}`                 | Public collection snapshot, owner, generation, publication flag and hold counters   |
| `api_cache/{digest}`                     | Serialized Qloo response, retrieval time and validity expiry                        |
| `rate_limits/{digest}`                   | Shared request allowance counters and validity windows                              |

Inventory is bounded to 50 SKUs and stored in the workspace document. This makes stock, hold counters and reservation transitions manageable inside a single Firestore transaction. The system also bounds active holds, saved decisions and published collections. It is designed for small independent-shop inventories, not an unbounded warehouse catalog.

The browser-facing Firestore rules deny all reads and writes. The Admin SDK bypasses these rules, so route validation, owner checks and service-account permissions remain essential boundaries.

## Cultural planning

1. Search for and verify exact audience entities across supported categories.
2. Resolve stocked artists, reusing verified identities where available.
3. Ask Qloo for artist affinity while restricting the result pool to stocked artists.
4. Retain per-anchor retrieval evidence and, when available, Qloo joint-input contribution.
5. Convert within-stock ordering into comparative rank-fit values. Missing evidence contributes zero. Raw affinity and attribution values remain distinct.
6. Apply hard stock, price, gross-margin, minimum-fit and count constraints. Avoid selecting multiple releases from one resolved artist. An optional bounded shelf-age preference affects ranking within the rules.
7. Save the complete decision, alternative baselines, rejections and one-of-each economics scenario for the merchant to inspect.

The planner does not infer that a film guarantees album-level preference. Rank fit is not a conversion probability. Economics is a gross-profit scenario assuming one copy of each selected record sells; it excludes taxes, fees and overhead. No sales prediction or sales uplift is asserted.

Qloo calls use a server-only key, timeouts, a bounded retry, shared quotas, timestamped Firestore caching and per-process request coalescing. Cache failures do not turn fabricated data into evidence. Invalid or unknown signals fail visibly instead of being replaced by generic recommendations.

## Publication and pickup invariants

A collection is published from a saved decision owned by the current workspace generation. Before publication, the server checks that each selected SKU still matches its artist, title, price and available stock. Real inventory requires meaningful pickup instructions.

A public response is an allowlist. It exposes the shop, pickup instructions, selected record details and available quantities. It excludes stock costs, private economics, customer names and internal decision traces.

A pickup hold executes in a Firestore transaction:

- Check the public collection is published and belongs to the current workspace generation.
- Check the selected record still matches available stock and a copy remains.
- Create a reservation keyed by collection and idempotency key.
- Decrement available quantity and increment shop and collection hold counters together.

A repeat of the same successful request returns the original reservation. Reusing the key for another name or SKU fails. Cancellation restores stock only from the held state; collection ends the hold without restoring stock. Conflicting final transitions are rejected. Transaction retries protect against concurrent last-copy requests.

Expiry is lazy: a subsequent workspace, collection or reservation operation processes elapsed 48-hour holds transactionally and restores their stock once. The implementation records expired holds as cancelled. There is no scheduled email or expiry notification.

Pausing hides the public page and rejects new holds. It preserves existing reservations so the merchant can collect or cancel them. Workspace deletion first marks the workspace as deleting and rotates its generation, then removes owned records, preventing concurrent new writes from recreating old public collections.

## Deployment and capacity

The deployed Cloud Run service is configured with zero minimum instances, a maximum of two instances, concurrency 40 and 512 MiB memory. These are cost controls, not a throughput guarantee. Scale-to-zero can add cold-start latency. Firestore transactions preserve stock invariants across instances; process-local locks are not relied on for inventory correctness.

The canonical instance uses the named `side-b` database. A self-hosted deployment must set its own Google Cloud project, Firebase web app, origin, service account, secrets and hosting identity. See [deployment instructions](DEPLOYMENT.md).

Cached and quota entries have application-level validity expiries plus a timestamp `cleanupAt` field suitable for Firestore TTL. Enable TTL policies on that field for both `api_cache` and `rate_limits` collection groups. TTL deletion is asynchronous; application expiry checks remain authoritative even before physical cleanup. Configure cost alerts for ongoing use. Account records and abandoned guest workspaces also need an explicit retention policy before a wider commercial rollout.

## Verification boundaries

Pure tests check planner and evidence logic. Emulator tests check the Firestore implementation and transaction invariants. The live smoke test exercises Qloo and the public workflow. Browser checks are still needed for Google redirect authentication, narrow screens, keyboard use and printing. Consult actual test output and deployment checks rather than treating this document as a passing test report.

Payments, customer messaging, POS reconciliation, merchant subscriptions and account-data migration are outside the current product. Those should be explicit future integrations rather than implied behavior.
