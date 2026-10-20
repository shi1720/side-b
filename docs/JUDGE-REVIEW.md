# Internal rubric review and release gates

This is an internal assessment, not an independent judge's score. It describes the current product and separates demonstrated implementation from commercial hypotheses. The app's canonical target is [sideb-records.web.app](https://sideb-records.web.app), with native Next.js, Firebase Google authentication and server-side Firestore transactions.

Current automated evidence comprises 51 unique passing cases run together with Node.js 24.22 and a Firestore emulator, with zero skips: 41 module/security/session/agent cases and ten Firestore integration cases. The first migrated Firebase-hosted HTTP smoke passed at `2026-10-20T10:15:58Z`. Hosted Google redirect sign-in into a saved account workspace also passed, as reported by the build owner. A smoke against the final release image and the original guest-workspace restoration still require fresh evidence in [the QA checklist](QA-CHECKLIST.md). Earlier platform-authentication and screenshot results are historical.

| Criterion                    | Provisional internal score | Evidence to show                                                                                                                                              | Remaining gap                                                                    |
| ---------------------------- | -------------------------: | ------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| Technological implementation |                       8/10 | Verified Qloo entities, stock-restricted Insights, rank fusion, native joint-input attribution, enforced constraints, saved decisions and transactional holds | Fresh hosted regression, Google account isolation and cross-device checks        |
| Design                       |                       8/10 | A coherent merchant studio, editable inventory, inspectable reasons, public collection and pickup loop                                                        | Final post-migration mobile/keyboard/auth walkthrough and print verification     |
| Potential impact             |                       7/10 | A concrete independent-shop buyer, recurring task and transparent economics scenario                                                                          | No merchant interviews, paying usage or measured time savings                    |
| Quality of idea              |                       8/10 | Cross-domain cultural discovery constrained to sellable stock and margin, followed by an actionable collection                                                | Demonstrate the cultural bridge plainly and keep album-level limitations visible |

These scores are prioritization aids, not a prediction of judging or a claim that the release is complete.

## Strongest demonstration

Start with a film or book so the cultural bridge is visible. Resolve its exact Qloo identity, let the agent rank the shop's stocked artist universe and open one item's evidence. Show an excluded record and the commercial rule it fails. Change a constraint or an audience, then rebuild.

Publish a collection, make a sample pickup hold on the customer page and use its actual reference to complete or cancel the hold in the owner workspace. Clearly label illustrative inventory. Show pause/resume as a practical merchant control rather than implying the agent publishes without oversight.

## Questions a skeptical reviewer should ask

1. **Would the selection work the same without Qloo?** No cultural evidence means no qualifying recommendations. Stock-age and highest-margin baselines make the different decision rules inspectable. They are not an LLM benchmark.
2. **Does the app understand individual albums?** It uses artist-level affinities. Album, pressing and condition remain inventory facts, not inferred taste matches.
3. **Is rank fit a sales prediction?** No. It combines relative positions within the stocked candidate pool. Higher rank fit is not a measured purchase probability.
4. **Can concurrent requests oversell?** Firestore emulator tests exercise final-copy contention, repeated keys and inventory/hold races. The hosted deployment still needs its own integration check.
5. **Are the economics credible?** Arithmetic uses entered costs and retail prices, assuming one of each selected record sells. It excludes overhead, fees and tax, and predicts no uplift.
6. **Has anyone paid?** No paying customer or traction is claimed. Pricing and pilot targets are hypotheses.
7. **What makes it agentic?** It orchestrates verified identity resolution, evidence retrieval, stock analysis and constrained selection, producing a saved decision and human-approved publish action. It is deterministic and uses no LLM. The composable tool interface is in `docs/agent-tool.schema.json`.
8. **Is the account flow complete?** The implementation uses Google authentication and server-issued Firebase sessions, with separate account and guest workspaces. Hosted Google redirect into a saved account workspace was verified. Original guest restoration and cross-device isolation require separate final verification.

## Release gate

Do not equate a successful compile or polished UI with complete production readiness. A release needs a usable public URL, accessible licensed source, verified runtime configuration, transaction and isolation tests, successful hosted authentication, usable critical flows and clear limitations. Record actual results rather than upgrading historical checks to migrated pass claims.

Before commercial rollout, validate merchant demand and costs, define data-retention/backup procedures, establish Qloo production terms and reconcile stock against the shop's operational system. Payments, subscriptions, notifications and POS synchronization are future integrations, not existing capabilities.
