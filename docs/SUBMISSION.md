# Side B

**A merchandising agent that connects cultural taste to the records an independent shop can actually sell.**

Created by **Shivam Gupta** for the Qloo Agentic Hackathon.

## Inspiration

A great record shop has a particular kind of magic: you mention a film you love, and the person behind the counter finds a record you would never have searched for. That connection is personal. It is also hard to repeat across every shelf, every customer, and every quiet afternoon when an older record deserves another chance.

Side B brings that cultural connection into a practical retail workflow. The question is specific: **what should this shop put in front of this audience, using the stock, prices, and margins it has today?**

## What it does

A shopkeeper starts with one to three cultural anchors: a film, book, TV show, or musical artist. Side B resolves those choices through Qloo, maps the artists in the shop's inventory, and requests artist affinities restricted to that inventory. It then builds a collection that obeys the shopkeeper's price cap, gross margin floor, cultural rank-fit floor, available stock, and collection size. Each artist appears at most once. An optional preference gives older stock a bounded advantage without overriding those limits.

The shopkeeper can inspect the evidence behind each selection, see why other records were excluded, compare the edit with simple stock-age and highest-margin baselines, and review a transparent one-unit-of-each financial scenario. The agent prepares editable collection copy. The owner chooses whether to publish it.

Publishing creates a customer page with current availability and free pickup holds. Owners can pause and resume a campaign’s public link while preserving existing holds. The shop supplies pickup instructions before publishing. A hold reserves one unit immediately and expires after 48 hours, with expiry reconciled when the app next handles a request. The shopkeeper can mark it collected or cancel it to restore that unit. Side B takes no payment. Owners can print shelf cards and export the full decision receipt.

The app includes an end-to-end private guest demo, Google account sign-in through Firebase Authentication, inventory editing, and CSV import/export for up to 50 titles. The sample inventory uses real artists with illustrative stock, pricing, and shelf ages. Campaigns preserve the sample-data label from publication. Guest and signed-in accounts are separate workspaces. Signing out restores this browser’s guest workspace when its token is retained.

## Why Qloo changes the answer

The cultural bridge comes from Qloo's taste graph. A film or book becomes a signal for musical artist affinity. `filter.results.entities` restricts the recommendation universe to the actual stocked artists. This joins cultural relevance with a decision the shop can act on immediately.

Removing Qloo removes the evidence for the cultural connection. A spreadsheet can still sort by shelf age or gross margin, but cannot establish the cross-domain relationship that justifies a discovery edit. Side B makes this distinction inspectable rather than hiding it inside generated prose.

Qloo's raw affinities are retained separately. Because those scores are normalized per query, Side B combines positions within the same candidate pool across anchors. The resulting rank fit is a merchandising heuristic, never a probability that a customer will buy. Evidence is at artist level. It does not establish that a specific album, pressing, or condition matches a person's taste.

## How it is built

Side B uses native Next.js and TypeScript on Cloud Run, Firebase Hosting, server-side Firestore transactions, Google sign-in through Firebase Authentication, and server-side Qloo API calls. The agent verifies cultural identities, resolves stocked artists, queries Qloo with a stock-constrained candidate set, combines cultural ranks, enforces commercial constraints, and prepares a publishable collection with a decision trail.

The workflow uses deterministic orchestration and selection. No LLM is used. The tool interface is documented in [`docs/agent-tool.schema.json`](agent-tool.schema.json). Unresolved artists remain in inventory but receive no invented affinity. If too few records satisfy the brief, Side B returns fewer picks with an explanation instead of silently relaxing constraints.

Secrets stay on the server. Public storefront responses omit cost prices and private customer records. Reservation writes check availability and support idempotency. Data deletion is available in workspace settings.

## The commercial case

The first buyer is an independent record retailer with a manageable catalog and little spare time for regular merchandising campaigns. The initial pricing hypothesis is **$29-$49 per shop per month**, subject to retailer interviews, Qloo commercial terms, and usage economics. No paying users, customer interviews, or sales uplift are claimed.

The next step is a small shop pilot measuring the time to prepare an edit, stock accuracy, pickup holds that become collections, older-stock movement, and gross profit after operating costs. A shopkeeper should pay because a repeatable weekly workflow saves time and earns its place in the business, not simply because the recommendations sound clever.

## What comes next

First, validate the workflow with shopkeepers and reconcile stock against a real point-of-sale export. Then improve ambiguous artist matching, automate stock synchronization, and test whether cultural edits improve outcomes against each shop's usual merchandising. Qloo production licensing and operating costs must support the pricing before a paid launch.

## Submission links

- Demo: https://sideb-records.web.app
- Public repository: https://github.com/shi1720/side-b

The canonical app and public MIT-licensed source are linked above. Current automated regression evidence includes 51 unique passing cases: 41 module/security/session/agent tests and ten Firestore integration tests, run together with zero skips. The first Firebase-hosted HTTP smoke passed at `2026-10-20T10:15:58Z`; hosted Google redirect sign-in also passed. Final-image smoke and original guest restoration are recorded separately in the QA checklist. Earlier platform checks are historical.

## Credits and disclosure

Created by Shivam Gupta. AI-assisted research, design, implementation, and documentation. Qloo provides the cultural affinity data. Sample stock and prices are illustrative. No customer demand or performance results are fabricated.
