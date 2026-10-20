# Internal rubric review and release gates

This is an internal assessment, not an independent judge's score. It describes the current product and separates demonstrated implementation from commercial hypotheses. The app's canonical target is [sideb-records.web.app](https://sideb-records.web.app), with native Next.js, Firebase Google authentication and server-side Firestore transactions.

[CI run 39412428378](https://github.com/shi1720/side-b/actions/runs/39412428378) passed both jobs, including all 51 cases with zero skips in the complete emulator run: 41 module/security/session/agent cases and ten Firestore integration cases. Hosted commit `d58be20`, revision `side-b-00007-mxx`, passed its HTTP smoke at `2026-10-20T11:08:43.990Z`, covering uncached HTML, reachable boot assets, live Qloo, pickup transitions and fixture cleanup. Browser Google sign-in succeeded, and native form sign-out restored `SideBGuestQA` with zero collections, distinct from the account's two. Phone inventory containment passed at 320 and 390 pixels. A second-account browser isolation check and cross-device persistence remain unverified. Details are in [the QA checklist](QA-CHECKLIST.md).

| Criterion                    | Provisional internal score | Evidence to show                                                                                                                                              | Remaining gap                                                                    |
| ---------------------------- | -------------------------: | ------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| Technological implementation |                       8/10 | Verified Qloo entities, stock-restricted Insights, rank fusion, native joint-input attribution, enforced constraints, saved decisions and transactional holds | Second Google account isolation and cross-device checks                          |
| Design                       |                       8/10 | A coherent merchant studio, editable inventory, inspectable reasons, public collection and pickup loop                                                        | Full keyboard audit and a real merchant pilot              |
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
4. **Can concurrent requests oversell?** Firestore emulator tests exercise final-copy contention, repeated keys and inventory/hold races. The hosted workflow smoke passed; final-copy contention is established by the emulator test rather than a claim of hosted load testing.
5. **Are the economics credible?** Arithmetic uses entered costs and retail prices, assuming one of each selected record sells. It excludes overhead, fees and tax, and predicts no uplift.
6. **Has anyone paid?** No paying customer or traction is claimed. Pricing and pilot targets are hypotheses.
7. **What makes it agentic?** It orchestrates verified identity resolution, evidence retrieval, stock analysis and constrained selection, producing a saved decision and human-approved publish action. It is deterministic and uses no LLM. The composable tool interface is in `docs/agent-tool.schema.json`.
8. **Is the account flow complete?** The implementation uses Google authentication and server-issued Firebase sessions, with separate account and guest workspaces. Hosted Google redirect into a saved account workspace was verified. Native sign-out restored the original distinct guest workspace. Cross-device persistence and a different Google account isolation check remain unverified.

## Release gate

Do not equate a successful compile or polished UI with complete production readiness. A release needs a usable public URL, accessible licensed source, verified runtime configuration, transaction and isolation tests, successful hosted authentication, usable critical flows and clear limitations. Record actual results rather than upgrading historical checks to migrated pass claims.

Before commercial rollout, validate merchant demand and costs, define data-retention/backup procedures, establish Qloo production terms and reconcile stock against the shop's operational system. Payments, subscriptions, notifications and POS synchronization are future integrations, not existing capabilities.

## Presentation and submission state

The [public walkthrough](https://youtu.be/5lAPCRtPbU4) is published with verified 1080p playback, and English captions were published separately. Devpost project `1247896` (Side B) is saved at four of five sections as an intentional draft. It has not been submitted. Phone inventory, result, sign-in, public hold and confirmation layouts were subsequently checked. Cross-device verification remains open.

Additional verified browser checks: deployed source `d58be20`, revision `side-b-00007-mxx`, passed the hosted workflow at `2026-10-20T11:08:43.990Z`. CI run 39412428378 passed both jobs. Phone inventory containment passed 320/390px, results passed 390/768/1280px, and the 390px customer confirmation plus owner cancellation restored stock. Google re-entry restored the saved account collections. Printed shelf cards were rendered and checked. Cross-device and second-account browser checks remain unclaimed.
