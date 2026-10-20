# Rubric self-assessment and release gates

This is an internal review, not an independent judge's score. Scores below are provisional assessments of the implementation read on October 20, 2026. The external demo and public MIT-licensed repository are published. Actual customer pilots and commercial outcomes remain unvalidated. The build owner reports passing local behavior and HTTP-flow checks, plus a desktop and 390-pixel mobile browser walkthrough of exact search, generation, publication, public hold, and reference confirmation. This is not independent commercial validation.

| Criterion | Provisional score | Evidence to show | Main gap |
|---|---:|---|---|
| Technological implementation | 8/10 | Server-side Qloo search, stock-restricted per-anchor Insights, rank fusion, enforced constraints, persisted runs and reservation lifecycle | Complete externally hosted end-to-end QA, malformed-input and concurrency checks, account isolation |
| Design | 8/10 | A coherent shop studio, editable stock, reasons for picks, public storefront and pickup loop | Confirm mobile behavior, keyboard access, real error states, readable print output |
| Potential impact | 7/10 | A concrete buyer and recurring merchandising task, transparent gross profit scenario, realistic pricing experiment | No retailer interviews, paid usage, or measured time savings yet |
| Quality of idea | 8/10 | Cultural discovery constrained by sellable stock and margin, with a complete action loop | Show the cross-domain connection clearly and explain the album-level limitation |

## Strongest demonstration

Use a film or book as the anchor, not only a music artist. Let Qloo rank the shop's actual artist universe. Open one item's evidence and one exclusion. Change a commercial constraint and rebuild. Publish a collection, reserve a real available unit on the customer page, and close or cancel the hold in the owner workspace.

This makes the cultural graph, constrained decisions, and action loop visible in one visit.

## Questions a skeptical judge should ask

1. Would the same picks appear if Qloo were removed? The baseline comparison should make the role of cultural ranking inspectable. Baselines are stock-age and gross-profit heuristics, not an LLM benchmark.
2. Does the app understand albums? No. It uses artist-level affinities and carries album stock through commercial rules. That limitation must remain visible.
3. Is rank fit a sales prediction? No. It combines within-pool relative ranks. A higher score does not mean a higher measured probability of purchase.
4. Can a customer reserve stock twice? Reservation idempotency and atomic availability checks must be verified, including competing requests for the final unit.
5. Are economics real? The arithmetic uses entered stock prices and costs. The outcome assumes one of each selected record sells and excludes overhead, fees, and tax.
6. Has anyone paid? No traction is claimed. Pricing and pilot targets are explicit hypotheses.
7. What makes this agentic? It performs an inspectable sequence of tool-backed identity resolution, evidence retrieval, stock analysis, selection, and preparation for a human-approved publish action. It uses deterministic orchestration and no LLM. The tool schema is documented in `docs/agent-tool.schema.json`.

## Release gate

Do not describe the build as production-ready solely because it compiles or has a polished interface. Release requires a functional external URL, public licensed source, verified server configuration, stock lifecycle tests, isolation checks, accessible critical flows, and clear limitations. The separate QA checklist records the final evidence.
