# Application API contract

The browser uses same-origin JSON APIs with cookies. Types live in `lib/types.ts`; route validation is authoritative. Error responses have the shape `{ "error": "human-readable message" }` with an appropriate HTTP status. Public response types are intentionally redacted and are not full private `AgentRun` or `InventoryItem` objects.

All mutations require the exact configured `APP_ORIGIN` and reject cross-site requests. JSON APIs expect `application/json` when a body is supplied; the native sign-out form endpoint is the explicit form-based exception. JSON bodies are limited to 80,000 bytes. Requests cannot choose an owner ID or provide replacement stock to the planning endpoint. The server derives ownership from its session cookie.

Money uses decimal currency units in API fields. Inputs have at most two decimal places; financial calculations use integer cents. One workspace uses one currency from USD, GBP, INR or EUR. `minMargin` and `minFit` use fractions, for example `0.30` means 30%. The UI converts percentages for display.

## Workspace and inventory

| Method and path         | Input                                      | Successful response                                                                   |
| ----------------------- | ------------------------------------------ | ------------------------------------------------------------------------------------- |
| `GET /api/workspace`    | None                                       | `Workspace`; creates a private sample workspace when needed                           |
| `POST /api/workspace`   | `{name?, currency?, pickupInstructions?}`  | Updated `Workspace`                                                                   |
| `DELETE /api/workspace` | None                                       | `{ok:true}` after deleting owned application records and clearing the browser session |
| `PUT /api/inventory`    | `{items:InventoryItem[], sample?:boolean}` | `{inventory:InventoryItem[]}`                                                         |

Workspace names are 1 to 80 trimmed characters. Pickup instructions have at most 500 characters and are published on customer pages. Currency cannot change after a collection has been published. Replacing inventory requires 1 to 50 valid records with unique SKUs and is blocked while active holds exist. Available quantities already exclude held units.

Stock fields include `sku`, `artist`, `title`, `price`, `cost`, `quantity`, `daysOnShelf` and `genre`, with optional validated display and entity metadata. The browser parses CSV before submitting the entire replacement list; the server validates it independently. Switching from sample stock to real stock clears sample-only pickup instructions. Real-stock publication requires usable shop pickup details.

## Cultural search and planning

| Method and path                  | Input                                                                    | Successful response        |
| -------------------------------- | ------------------------------------------------------------------------ | -------------------------- |
| `GET /api/search?q=...&kind=...` | Query of 2 to 80 characters; kind `artist`, `movie`, `book` or `tv_show` | `{entities:TasteEntity[]}` |
| `POST /api/agent`                | `{anchors:TasteEntity[], constraints:Constraints}`                       | A saved private `AgentRun` |

Planning accepts one to three different verified entity IDs. Constraints include integer `count` from 1 to 8, `maxPrice` from 1 to 10,000, `minMargin` from 0 to 0.95, `minFit` from 0 to 1, and boolean `prioritizeAge`. The server uses inventory belonging to the current workspace, revalidates cultural identities and saves the run with its owner and workspace generation.

A run contains selected and excluded stock, evidence, trace steps, warnings, baselines, and a one-unit-of-each economics scenario. `mode` is `live`, including runs using timestamped cached live Qloo responses. `calls` counts uncached logical Qloo queries; upstream retry attempts may consume additional allowance. Rank fit is comparative within the stocked artist pool, not a purchase probability. Optional Qloo joint-input contribution describes relative influence, not demand.

## Publication and public collection

| Method and path             | Input                             | Successful response                                                                                 |
| --------------------------- | --------------------------------- | --------------------------------------------------------------------------------------------------- |
| `POST /api/campaigns`       | `{runId, title?, description?}`   | Status 201, `{campaign:Campaign, url:string}`                                                       |
| `GET /api/campaigns/[id]`   | None; public                      | `{campaign:PublicCampaign, shop:{name,currency,sample,pickupInstructions}, inventory:PublicItem[]}` |
| `PATCH /api/campaigns/[id]` | Owner only, `{published:boolean}` | `{campaign:Campaign}`                                                                               |

Publication resolves an owned saved run on the server. Titles allow 1 to 120 trimmed characters; descriptions allow 1 to 2,000. Selected stock must still match artist, title, retail price and available units. The collection stores the decision snapshot and sample designation at publication.

Public responses expose only allowlisted collection/shop/record data and current available quantities. They omit costs, private economics, stock age, internal traces, customer names and owner identity. A paused, deleted or unavailable collection returns 404. Pausing stops new public holds while preserving existing owner-managed holds. Resuming restores public availability.

## Pickup lifecycle

| Method and path                    | Input                                                          | Successful response                               |
| ---------------------------------- | -------------------------------------------------------------- | ------------------------------------------------- | --------------------------- |
| `POST /api/campaigns/[id]/reserve` | Public, `{sku, customerName, quantity:1, idempotencyKey:uuid}` | Status 201, `{reservation:{id,reference,status}}` |
| `PATCH /api/reservations/[id]`     | Owner only, `{status:'collected'                               | 'cancelled'}`                                     | `{reservation:Reservation}` |

Pickup names are 1 to 60 trimmed characters with no control characters. No email or payment data is accepted. A hold transaction checks current publication, ownership generation, selected identity and available quantity, then decrements one unit and creates the reservation atomically.

A repeated successful reservation request with the same key returns the same reservation without another decrement. A reused key with changed name or SKU fails. Cancellation restores stock only once. Collection does not restore stock. Conflicting completed transitions fail.

Holds expire after 48 hours. Reconciliation occurs lazily on a related workspace, collection or reservation request. Expired holds are recorded as cancelled and restore their stock once. No email, shipping, payment or reminder service is implied.

## Authentication

| Method and path            | Input                                                    | Successful response                                                                          |
| -------------------------- | -------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| `GET /api/auth/config`     | None                                                     | Public Firebase web configuration                                                            |
| `POST /api/auth/session`   | `{idToken:string}` from a recent verified Google sign-in | `{ok:true}` and an HttpOnly server session cookie                                            |
| `POST /api/auth/signout`   | Native browser form; no application payload              | Status 303 redirect to `/`, restoring the retained guest cookie or clearing the session      |
| `DELETE /api/auth/session` | None                                                     | `{ok:true}`; restores the previous guest session when retained, otherwise clears the session |

`/signin` uses a same-tab Firebase Google redirect. Its auth domain is the canonical Hosting domain, with the authorized callback at `/__/auth/handler`. `/signout` is a server-rendered confirmation page with a native POST form to `/api/auth/signout`, so signing out does not depend on client hydration. The JSON DELETE session endpoint remains available. Authentication uses Firebase Google sign-in, not a private hosting-platform identity. Firebase Hosting forwards the HttpOnly `__session` cookie. Guest values are opaque 64-character hexadecimal tokens with a 30-day lifetime. Account values contain a five-day Firebase JWT and, when available, the original guest-token suffix. The suffix preserves guest access without transferring guest data into the account. The account JWT alone is verified for signed-in access.

Google and guest workspaces remain separate. Browser Firestore access is denied by rules; the server uses Admin SDK IAM. Same-origin checks also apply to authentication mutations. No Qloo key or service-account credential is returned to the browser.

## Persistence boundary

`lib/store.ts` is the current Firestore persistence layer. `getWorkspaceContext(request)` resolves owner, workspace generation and any guest cookie to attach. `saveAgentRun(ownerId, run, generation)` rejects obsolete workspace generations. Transactional writes protect stock and counters across Cloud Run instances. There is no SQL migration step in the canonical runtime.

See [architecture](docs/ARCHITECTURE.md) for invariants and [deployment](docs/DEPLOYMENT.md) for configuration and operational limits.

## Browser bootstrap and cache behavior

The root layout is force-dynamic. Firebase Hosting applies `Cache-Control: no-store` to all paths, including HTML, through both checked-in configuration and the Hosting REST deployment helper. This prevents cached HTML from referring to JavaScript chunk URLs removed by a later container release. The HTTP smoke requires successful HTML, a no-store/no-cache policy and status 200 for every referenced Next.js boot asset before testing the API workflow.
