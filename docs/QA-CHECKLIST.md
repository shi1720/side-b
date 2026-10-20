# Submission QA checklist

Status: **published with passing CI, local browser verification, and hosted end-to-end HTTP smoke**. The hosted verification passed on October 20, 2026 at 15:16 IST (09:46:48.707 UTC). Unchecked items need further evidence; they are not claims of failure.

## Eligibility and access

- [x] The demo URL opens without private access and completes the core workflow.
- [x] The public repository opens while signed out and includes source, assets, setup instructions, and LICENSE.
- [x] The repository About section shows the detected open-source license.
- [ ] README setup works from a clean checkout with documented configuration.
- [ ] Qloo credential is absent from client bundles, source history, screenshots, receipts, and documents.

## Evidence and selection

- [ ] Search returns real selectable Qloo entities and supports empty/error states.
- [x] A film or book anchor produces a real stock-constrained Qloo Insights run.
- [x] Each selected SKU exists in the server's workspace inventory and has available units.
- [x] Price, gross margin, fit floor, size, and one-per-artist constraints hold.
- [x] An impossible brief returns fewer or zero picks with a clear explanation.
- [x] Unresolved artists receive no fabricated evidence.
- [ ] Evidence includes anchor, candidate-pool rank, fetch time, and cached/live provenance.
- [x] Raw Qloo affinities remain distinct from combined rank fit.
- [ ] The user sees the artist-level and non-predictive limitations.
- [ ] The stock-age and gross-profit comparisons use correctly labeled candidate rules.
- [x] Economics reconcile to one unit of each selected record, with no uplift claim.

## Inventory and privacy

- [x] Valid CSV imports with quoted commas, escaped quotes, CRLF, and a BOM work.
- [ ] Missing headers, bad numbers, duplicate SKUs, too many rows, and invalid fields fail clearly.
- [ ] Import does not partially replace stock after validation failure.
- [x] Inventory replacement is blocked with active holds.
- [x] Independent guest sessions cannot access each other's private workspaces.
- [x] Hosted sign-in completes account selection, consent, callback, and return to an authenticated Side B workspace.
- [ ] Signed-in account isolation and cross-device persistence receive a separate end-to-end test.
- [ ] Guest and signed-in workspaces remain separate with a clear account-transition notice.
- [x] Public campaign responses omit cost, private economics, customer names, and owner data.
- [x] Workspace deletion removes the relevant saved data and public campaigns.

## Publish and pickup lifecycle

- [ ] Editing copy changes the published collection after the owner clicks publish.
- [x] Campaign pause/resume changes public access while preserving existing holds.
- [ ] Real shop publishing requires usable pickup instructions.
- [x] Published sample campaigns retain their illustrative-data label after workspace changes.
- [x] Expired 48-hour holds reconcile on the next request and restore stock exactly once.
- [x] Public availability reflects current stock, including changes after publication.
- [x] Reserving a unit decreases available stock exactly once.
- [x] Retrying with the same idempotency key does not create another hold.
- [x] Competing requests for the last unit permit only one successful reservation.
- [x] Cancelling restores the unit exactly once, even on retries.
- [x] Marking collected does not restore stock.
- [x] Invalid or unauthorized reservation transitions fail.
- [x] Same-origin protections reject unauthorized write origins.
- [x] The public page says that no payment is taken and collection happens in the shop.

## Usability and final presentation

- [ ] Studio, inventory, results, campaign, and reservation flows work at mobile and desktop widths.
- [ ] Critical controls have keyboard focus and accessible names.
- [ ] Loading, empty, API-failure, and validation states are clear.
- [ ] Printed shelf cards show customer-relevant information clearly.
- [ ] Downloaded JSON contains the actual run and no credential.
- [x] Demo contains obvious sample-stock disclosure.
- [x] Submission description matches the implemented build.
- [ ] Founder script has been rehearsed against the actual app.
- [x] PDF and every PPTX slide render without clipping or overflow.
- [x] Final submission links are verified and preparation-only notes removed where appropriate.

## Verification log

Current CI passed 27 automated tests, TypeScript checks and a production build. The hosted merchant-to-storefront smoke passed with real Qloo responses, including hold, cancellation, collection, pause/resume, owner isolation, and workspace deletion. The build owner reports a local HTTP-flow run plus a desktop and 390-pixel mobile browser walkthrough of exact search, generation, publication, public hold and reference confirmation without horizontal overflow. Browser screenshots are saved in the submission kit. Checked items reflect those observations or specific automated cases. Passing these checks does not establish commercial demand or complete all possible operational testing. Founder rehearsal, customer interviews, pilots, real sales and commercial uplift remain unverified.

| Date and environment | Check | Result | Evidence |
|---|---|---|---|
| October 20, 2026 / GitHub Actions | 27 automated tests, TypeScript checks, production build | Passed | [CI run 39402806210](https://github.com/shi1720/side-b/actions/runs/39402806210) |
| October 20, 2026 / local browser | Exact film search, generation, publish, hold reference | Passed, reported by build owner | `outputs/submission-kit/screenshots/` |
| October 20, 2026 / desktop and 390px mobile | Critical walkthrough and horizontal overflow | Passed, reported by build owner | `side-b-studio.png`, `side-b-mobile.png`, `side-b-hold-confirmation.png` |
| October 20, 2026 / public repository | Public source and recognized MIT license | Verified by build owner | [Repository](https://github.com/shi1720/side-b) |
| October 20, 2026 / external deployment | Native deployment | Published | [Demo](https://side-b-records.sg127977958.chatgpt.site) |
| October 20, 2026 at 15:16 IST / production HTTP | Merchant-to-storefront end-to-end smoke | Passed | `outputs/submission-kit/evidence/production/integration-report.json`, result `passed`, timestamp `2026-10-20T09:46:48.707Z` |
| October 20, 2026 / hosted browser | OpenAI account chooser, consent, callback and return to Side B | Passed, reported by build owner | Workspace settings displayed “Signed in and saved to your account.” |
| Not yet run | Cross-device persistence and signed-in account isolation | Unverified end-to-end | Durable server storage exists; no cross-device test claimed |
| Not yet run | Founder rehearsal, shop pilot, real commercial outcomes | Unverified | No claim of traction or uplift |

### Hosted-test correction

An earlier smoke-test client replaced the merchant guest cookie when Cloudflare supplied an additional `__cf_bm` cookie. Its next inventory read opened a fresh guest workspace, which produced a misleading stock-count comparison. The corrected cookie jar preserves all cookie names and checks that the merchant workspace persists. The hosted workflow then passed. This was a test-harness session-loss issue.

The reported 9,761 ms covers the full workflow with many HTTP calls and cached Qloo data. It is not an agent-analysis latency benchmark. Current behavior tests also exercise trigger-free stock transactions through concurrent SQLite connections and CSV parsing/export.

Campaign pause/resume preserves existing holds. The production smoke covers the public-link lifecycle. The hosted browser sign-in completed the OpenAI account chooser, consent, callback and return to Side B. Workspace settings displayed “Signed in and saved to your account.” Cross-device persistence and signed-in account isolation remain separate end-to-end checks.
