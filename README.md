# Side B

**Your best unsold record hasn’t met its listener yet.**

A cultural merchandising tool for independent record shops, created by **Shivam Gupta** for the Qloo Agentic Hackathon 2026 with AI-assisted development.

[Open the public app](https://side-b-records.sg127977958.chatgpt.site) · [Try a published sample collection](https://side-b-records.sg127977958.chatgpt.site/c/f2bb515f-f123-41fc-be66-067a8f798fc1) · [Submission](docs/SUBMISSION.md) · [Founder walkthrough](docs/FOUNDER-WALKTHROUGH.md) · [Commercial plan](docs/COMMERCIAL-VALIDATION.md) · [MIT license](LICENSE)

## The problem

A shop already paid for the records on its shelves. Its inventory system knows their cost and age, but cannot tell it which overlooked record might resonate with fans of a film, book or artist. A generic recommendation list often contains stock it does not have.

Side B turns an audience’s cultural anchors into a small collection **from actual available inventory**, protects the shop’s economics, and publishes a storefront with free pickup holds. The starting inventory contains real release names and **fictional quantities, costs and prices**. Demo holds do not reserve real-world records.

## Try it in two minutes

1. Open the app; a private guest workspace needs no login.
2. Choose **The Past Lives crowd**, then select the exact film returned by Qloo.
3. Keep the four-record/$40/30% gross-margin defaults and click **Build my shop edit**.
4. Open **Why this record**, the decision trail and excluded-stock panel. Compare with the oldest-stock and contribution baselines.
5. Edit the title/story, then **Publish shop edit**. Open the public collection and make a sample hold using a test name.
6. Return to **Campaigns**, refresh holds, then mark it collected or cancel it. Available stock changes safely.

Try a second anchor or a different film. These are live API queries, with durable caching clearly labeled. No score or selection is hardcoded. Cached artist IDs for the supplied stock were resolved against Qloo on 20 October 2026; an unrecognized artist is never assigned a fabricated ID.

**Sign in with ChatGPT** enables a durable account workspace across browsers. Guest and account workspaces are separate; sign-in does not transfer guest work. Guest sessions use an opaque HttpOnly cookie. For real stock, import the CSV and enter your shop’s pickup instructions in settings before publication.

## What makes it Qloo-powered

| Tool step | Implementation |
|---|---|
| Resolve audience | `/search` with typed artist/movie/book/TV requests; the selected ID is verified again server-side. |
| Inspect stock | Resolve stocked artists exactly; up to 50SKUs; aliases sharing one verified artist ID count as one artist. |
| Query cultural affinity | `/v2/insights` with the audience as `signal.interests.entities`, `filter.type=urn:entity:artist`, and **`filter.results.entities` restricted to stocked artists**. |
| Attribute multiple anchors | A joint audience query retains Qloo’s native input contribution where available. Missing attribution remains unknown. |
| Fuse evidence | Within-pool rank scores are averaged across anchors. Raw Qloo affinities are retained separately, never averaged. Missing evidence contributes zero. |
| Choose an edit | Hard stock, per-record price, gross-margin, collection-size and minimum-fit constraints; at most one release per resolved artist. A bounded preference favors older stock. |
| Execute | Publish an immutable collection, create an atomic inventory hold, then record collection/cancellation. |

This is a **deterministic, composable agentic tool**, with an explicit decision trace. It does not use or claim an LLM. Qloo supplies cultural knowledge; the constrained planner makes operational decisions; template copy remains editable. Removing Qloo leaves no cultural evidence and therefore no qualifying selections. A live controlled check with identical stock and constraints changed the four-record edit when the audience changed from Past Lives to Khruangbin; two selections differed. This establishes that cultural signals affect the decision, not that sales will improve. See [agent tool schema](docs/agent-tool.schema.json) for integration into an external agent.

Rank-fit is a comparative merchandising heuristic **within this shop’s resolved artist pool**, not a purchase probability or a global score. Artist affinity does not establish affinity for a particular album, pressing or condition. Upstream unknown-signal warnings and unscored generic lists are rejected. The UI reports fewer selections when the brief is infeasible, rather than silently relaxing limits.

## Architecture

```text
React storefront + merchant studio
        │ same-origin JSON APIs
Vinext / Cloudflare Worker
        ├── Qloo adapter: timeouts, bounded retries, durable cache, shared quotas
        ├── inventory-constrained planner + immutable decision receipts
        ├── ChatGPT identity / opaque guest session
        └── D1: workspaces, inventory, runs, campaigns, reservations
                       └── explicit atomic batches enforce stock and transition invariants
```

Server source: `lib/agent.ts`, `lib/qloo.ts`, `lib/evidence.ts`, `lib/optimizer.ts`, `lib/store.ts`. API contracts: [API-CONTRACT.md](API-CONTRACT.md). UI: `app/page.tsx`, `app/c/[id]/page.tsx`, `app/globals.css`.

Reservations hold one copy. Their 48-hour expiry is processed lazily on the next workspace, collection or reservation request; cancellation releases stock exactly once. A collected hold is an operator-recorded outcome, not independently verified payment. Side B does not take payments, ship records, send email, or reconcile an external POS automatically.

## Run locally

Requires Node.js 22.16+ and npm. No Qloo key is needed for the unit/database tests. Live search and planning require a Qloo key.

```sh
npm ci
cp .env.example .dev.vars
# Edit .dev.vars and add your own server-side QLOO_API_KEY.
npm run build
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_spicy_magus.sql
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0001_spotty_black_panther.sql
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0002_remove_legacy_triggers.sql
npm run dev
```

Open the printed local URL, normally `http://127.0.0.1:5173`. Apply migrations **once**, in order; do not replay them. The local D1 database is separate from the hosted database. The starter simulates sign-in only for loopback development; production uses platform authentication. A process-level `QLOO_API_KEY` is also supported for local development without a credential file.

```sh
npm run typecheck
npm test
npm run build
# Optional live end-to-end test (creates and deletes its own guest workspaces):
node scripts/smoke-test.mjs http://127.0.0.1:5173
```

Tests cover cultural-evidence rejection, optimizer boundaries, price/margin constraints, missing anchors, artist diversity, exact-cent economics, no overselling, idempotency, cancellation, expiry and owner isolation. GitHub Actions runs tests, typechecking and a production build. See [QA checklist](docs/QA-CHECKLIST.md) for manual/browser cases and verification limits.

## Inventory CSV

Download the template from **Your inventory**. Required headers:

```csv
sku,artist,title,price,cost,quantity,daysOnShelf,genre
SHOP001,Radiohead,In Rainbows,32,20,4,124,Alternative
```

Up to 50SKUs per workspace, unique SKU, decimal currency prices with at most two places, integer quantities and shelf age. Quoted commas are supported. All stock uses the workspace currency. Set currency before publishing. Import replaces the stock list and is blocked while active holds exist. Reconcile quantities with your actual stock before using it with customers. Discogs-style exports need manual column mapping; there is no direct Discogs integration.

## Deployment and operating limits

The published app runs on Sites using Cloudflare Workers and D1. The tracked `.openai/hosting.json` identifies this deployment; forked deployments must obtain their **own** Site identity and runtime secrets. The source contains no API credentials. Use Sites’ source/version/deploy workflow with D1 binding `DB` and set `QLOO_API_KEY` as a secret plus `QLOO_API_BASE` as a server variable. Production migrations are applied by the platform.

Server-side protections include same-origin mutations, body/field limits, owner checks, public data allowlists, atomic SQL stock checks, idempotency, signed-in/guest workspace separation, and durable API quotas. Defaults: 80 search requests/IP/hour, 15 agent runs/IP/hour, 30 new workspaces/IP/day, 10 new holds/IP/campaign/hour, 100 active holds/campaign, 250 uncached Qloo attempts/day across the demo. These are application limits, **not claimed Qloo plan entitlements**. Search results cache for 7 days; affinity responses for 24 hours. A 16-second upstream timeout and one bounded retry protect failures. Cached evidence always exposes its original timestamp.

A judge can use the sample end-to-end without credentials. If a quota is exhausted or Qloo is unavailable, the app reports the problem and saved collections remain accessible; it does not substitute fabricated live data. Bring a supported Qloo license/key for continued operation after hackathon access expires. The free infrastructure tier and Qloo allowance are not assumed to be unlimited or permanent.

## Commercial hypothesis and next validation

The initial buyer is an independent record-shop owner with slow-moving stock and an audience channel. A proposed $29–49/shop/month plan needs merchant interviews and paid-pilot validation; no paying customers or sales uplift are claimed. The useful outcome to test is incremental gross contribution and sell-through against matched control inventory, after the owner’s time and subscription costs. Full assumptions, competitors and experiment design are in [the commercial plan](docs/COMMERCIAL-VALIDATION.md).

## Privacy and attribution

Only selected cultural entities and stocked artist names go to Qloo. Inventory cost/quantity and customer names stay in the application database; the public API excludes costs, margins, stock age, private traces and customer names. Raw IPs are not stored in quota keys. Owners can delete their workspace in settings; this deletes its campaigns, stock, runs and customer holds. Use test names for the demo. Guest data remains private to its cookie, account data to its platform identity. There is no automatic analytics, ad targeting or third-party email integration.

Original Side B source and graphic sleeve designs are MIT-licensed. Sleeve graphics are illustrative and are not original album artwork. Qloo data and APIs remain subject to their own terms; this code license does not relicense them. Third-party starter/library licenses remain with their files. Project author: Shivam Gupta.
