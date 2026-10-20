# Side B

**Your best unsold record hasn’t met its listener yet.**

Side B is a cultural merchandising tool for independent record shops, created by **Shivam Gupta** with AI-assisted development. It connects what an audience loves to records a shop already has, then turns the selection into a shareable collection with pickup holds.

[Open Side B](https://sideb-records.web.app) · [Architecture](docs/ARCHITECTURE.md) · [Deploy your own instance](docs/DEPLOYMENT.md) · [Commercial assumptions](docs/COMMERCIAL-VALIDATION.md) · [MIT license](LICENSE)

## Why it exists

A shop’s inventory system knows what a record costs and how long it has been on the shelf. It does not know which overlooked record might resonate with fans of a film, book or artist. A generic recommendation list can suggest records the shop cannot sell.

Side B starts with actual available inventory. Qloo supplies cross-domain cultural connections; the planner applies the shop’s price, gross-margin and stock constraints. Every selection keeps its evidence. The merchant reviews the result, edits the story and decides whether to publish.

The starting stock uses real artists and releases with **illustrative prices, costs and quantities**. Sample pickup holds demonstrate the workflow; they do not reserve physical records.

## Try the complete workflow

1. [Open the studio](https://sideb-records.web.app). A private guest workspace needs no sign-in.
2. Choose **The Past Lives crowd**, then select the exact film returned by Qloo.
3. Keep four records, a maximum price of $40 per record and a 30% minimum gross margin. Select **Build my shop edit**.
4. Open **Why this record**, the decision trail and the excluded-stock panel. Compare the edit with the oldest-stock and highest-margin baselines.
5. Edit the title and story, then select **Publish shop edit**. Open the public collection and create a sample hold using a test name.
6. Return to **Campaigns**, refresh holds and mark it collected or cancel it. Cancellation restores the available copy once.
7. Pause the public collection to stop new holds. Existing holds remain manageable. Resume it when ready.

Search and planning use the live Qloo API with timestamped caching. The app does not substitute fabricated results when Qloo is unavailable. Selecting another cultural anchor can change the edit; a live controlled comparison with identical stock and constraints changed two of four selections between Past Lives and Khruangbin. This demonstrates an effect on selection, not an improvement in sales.

**Google sign-in uses a same-tab redirect and opens a separate account workspace.** Guest data is not transferred. Sign out to return to this browser’s guest workspace. Export inventory and decision receipts for a portable copy of important work. Clearing browser cookies removes access to an anonymous workspace; use an account for ongoing shop operations.

## What makes it Qloo-powered

| Step                      | Actual behavior                                                                                                                                                                                             |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Resolve an audience       | Search Qloo for a film, book, TV show or artist. The selected entity is verified again on the server.                                                                                                       |
| Inspect stock             | Resolve stocked artists to verified Qloo identities. A workspace holds up to 50 SKUs.                                                                                                                       |
| Query affinity            | Call `/v2/insights` with the audience as `signal.interests.entities`, artist results, and `filter.results.entities` restricted to stocked artists.                                                          |
| Attribute multiple inputs | Retain Qloo’s native joint-input contribution when available. Missing attribution remains unknown.                                                                                                          |
| Fuse evidence             | Average relative rank-fit values across anchors within the stocked artist pool. Missing affinity evidence contributes zero; raw affinity values remain separate.                                            |
| Plan an edit              | Enforce stock, per-record price, minimum gross margin, minimum rank fit and collection-size constraints. Select at most one release per resolved artist. An optional bounded preference favors older stock. |
| Execute with oversight    | Save the decision receipt. The merchant publishes, pauses or resumes the public collection and records collection or cancellation of holds.                                                                 |

This is a deterministic, composable agentic tool with an explicit decision trail. It does not use or claim an LLM. Qloo supplies cultural evidence, the constrained planner makes operational decisions, and editable templates provide copy. See [the tool schema](docs/agent-tool.schema.json) for integration into another agent.

Rank fit is relative to this shop’s resolved artist pool. It is **not a purchase probability or a global score**. Artist affinity does not establish affinity for a specific album, pressing or condition. An infeasible brief returns fewer selections with warnings rather than silently relaxing constraints.

## Run locally

Requires **Node.js 24.12 or later**, npm, and the Firebase CLI with its supported Java runtime for the Firestore emulator. Google sign-in is optional for the guest workflow. Qloo search and planning require a server-side Qloo key.

```sh
npm ci
```

Create an untracked `.env.local` file:

```dotenv
APP_ORIGIN=http://127.0.0.1:3000
GOOGLE_CLOUD_PROJECT=demo-side-b
FIRESTORE_DATABASE_ID=side-b
FIRESTORE_EMULATOR_HOST=127.0.0.1:8085
QLOO_API_KEY=your-own-key
QLOO_API_BASE=https://hackathon.api.qloo.com
```

In one terminal, start the local database:

```sh
npx firebase-tools emulators:start --only firestore --project demo-side-b
```

In another terminal:

```sh
npm run dev
```

Open [the local studio](http://127.0.0.1:3000). Use this exact host and port so same-origin mutation checks match `APP_ORIGIN`. The local emulator contains separate data and requires no production database credentials. Do not point development or tests at the hosted database.

To test Google sign-in locally, use your own Firebase project and web app configuration, enable Google as a provider, and authorize the local domain. The three web configuration variables are `FIREBASE_WEB_API_KEY`, `FIREBASE_AUTH_DOMAIN` and `FIREBASE_WEB_APP_ID`. Use the same project ID as that Firebase app. The Firestore emulator alone does not emulate Google authentication. See [deployment and authentication setup](docs/DEPLOYMENT.md).

## Check the implementation

```sh
npm run lint
npm run typecheck
npm test
npm run build
# With the Firestore emulator running:
FIRESTORE_EMULATOR_HOST=127.0.0.1:8085 GOOGLE_CLOUD_PROJECT=demo-side-b-audit FIRESTORE_DATABASE_ID=side-b npm run test:firestore
# With the app, emulator and live Qloo key configured:
node scripts/smoke-test.mjs http://127.0.0.1:3000
```

The current regression suite has 51 unique cases: 41 module/security/session/agent cases and ten Firestore integration cases. All 51 passed together against the emulator on Node.js 24.22 with zero skips. CI includes a separate Java 21/Firestore emulator job that executes the complete suite.

The smoke test first verifies uncached HTML and reachable browser boot assets, then creates and deletes isolated guest workspaces. It exercises live audience search, planning, publication, public redaction, reservation idempotency, stock updates, pause/resume and owner isolation. It consumes real Qloo requests. Pure module tests can run without a Qloo key. The Firestore suite refuses to run its destructive fixtures without an emulator and a `demo-` project ID. Run it against the emulator to check transaction behavior, including concurrency, idempotency, expiry, isolation and reset.

A successful build is not a substitute for Google sign-in and browser testing. Use [the QA checklist](docs/QA-CHECKLIST.md) to review keyboard navigation, narrow screens, printing and external authentication after a deployment.

## Import inventory

Download the CSV from **Your inventory** for a template. Required columns:

```csv
sku,artist,title,price,cost,quantity,daysOnShelf,genre
SHOP001,Radiohead,In Rainbows,32,20,4,124,Alternative
```

Stock uses one workspace currency. Supply unique SKUs, decimal prices with at most two places, and integer quantities and shelf days. Quoted commas and doubled quotes are supported. The server validates every row. CSV exports neutralize formula-like text so merchant input is not executed as a spreadsheet formula.

Import replaces all stock and is blocked while active holds exist. Add your shop address, opening hours and a contact in settings before publishing real inventory. Reconcile available units with your physical stock before sharing a collection. External exports may need column mapping; there is no direct Discogs or POS integration.

## Hosting and operational limits

The canonical app is [sideb-records.web.app](https://sideb-records.web.app). Firebase Hosting forwards requests to a native Next.js Node service on Cloud Run. The server uses Firestore for private workspaces, stock, saved decisions, public collections, holds, API caching and quotas. Firebase Authentication handles Google sign-in. See [architecture](docs/ARCHITECTURE.md) and [deployment](docs/DEPLOYMENT.md) for exact boundaries.

Server controls include same-origin writes, body and field limits, ownership checks, public data allowlists, transactional stock changes and idempotent holds. Defaults include 80 searches per requester per hour, 15 agent runs per requester per hour, 30 new workspaces per requester per day, 10 new holds per requester and collection per hour, 100 active holds per collection and 200 per shop. At most 250 uncached Qloo attempts are allowed per UTC day for this instance. These are application limits, not Qloo plan entitlements.

Search responses cache for seven days and affinity responses for 24 hours. Upstream requests time out after 16 seconds with at most one bounded retry. The trace distinguishes cached evidence from uncached queries and retains original retrieval timestamps. Infrastructure and Qloo allowances are not assumed to be unlimited or permanent.

Holds reserve one copy for 48 hours. Expiry is processed lazily on a later workspace, collection or reservation request, not by an exact-time background scheduler. A merchant-recorded collection is not independently verified payment. Side B does not accept payments, ship records, send notifications or synchronize with a POS.

## Commercial hypothesis

The intended buyer is an independent shop owner with slow-moving stock and an audience channel. A proposed $29 to $49 per shop per month plan still requires merchant interviews and paid-pilot validation. No paying customers or sales uplift are claimed. The outcome to test is incremental gross contribution and sell-through against matched control stock, after subscription cost and the owner’s time. Assumptions and experiment design are in [the commercial plan](docs/COMMERCIAL-VALIDATION.md).

## Privacy and attribution

Only selected cultural entities and stocked artist identities are sent to Qloo. Customer names, stock costs and quantities stay in the application database. Public collection responses exclude private economics, stock age, decision traces and customer names. Quota identities use a hash of the trusted proxy’s requester address; raw addresses are not stored in quota keys.

Owners can delete their workspace in settings, removing its collections, stock, saved runs and customer holds. Guest ownership is tied to a private cookie; account ownership is tied to a verified Firebase user. Deleting a workspace does not delete the Google or Firebase Authentication account. Public authentication configuration is not a credential for database access; browser Firestore reads and writes are denied.

Original source and graphic sleeves are MIT-licensed. Sleeves are illustrative graphics, not original album artwork. The code license does not relicense Qloo data or APIs. Third-party components retain their own licenses. Project author: **Shivam Gupta**.
