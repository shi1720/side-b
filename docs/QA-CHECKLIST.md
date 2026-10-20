# Submission QA checklist

Status: **published with passing CI and local browser verification**. Production HTTP smoke found a stock-decrement defect; repair and re-test are in progress. Unchecked items need further evidence; they are not claims of failure.

## Eligibility and access

- [ ] The demo URL opens without private access and completes the core workflow.
- [x] The public repository opens while signed out and includes source, assets, setup instructions, and LICENSE.
- [x] The repository About section shows the detected open-source license.
- [ ] README setup works from a clean checkout with documented configuration.
- [ ] Qloo credential is absent from client bundles, source history, screenshots, receipts, and documents.

## Evidence and selection

- [ ] Search returns real selectable Qloo entities and supports empty/error states.
- [x] A film or book anchor produces a real stock-constrained Qloo Insights run.
- [ ] Each selected SKU exists in the server's workspace inventory and has available units.
- [x] Price, gross margin, fit floor, size, and one-per-artist constraints hold.
- [x] An impossible brief returns fewer or zero picks with a clear explanation.
- [x] Unresolved artists receive no fabricated evidence.
- [ ] Evidence includes anchor, candidate-pool rank, fetch time, and cached/live provenance.
- [x] Raw Qloo affinities remain distinct from combined rank fit.
- [ ] The user sees the artist-level and non-predictive limitations.
- [ ] The stock-age and gross-profit comparisons use correctly labeled candidate rules.
- [x] Economics reconcile to one unit of each selected record, with no uplift claim.

## Inventory and privacy

- [ ] Valid CSV imports with quoted commas, escaped quotes, CRLF, and a BOM work.
- [ ] Missing headers, bad numbers, duplicate SKUs, too many rows, and invalid fields fail clearly.
- [ ] Import does not partially replace stock after validation failure.
- [x] Inventory replacement is blocked with active holds.
- [ ] Independent guest browsers cannot access each other's private workspaces.
- [ ] Signed-in accounts preserve and isolate their own data.
- [ ] Guest and signed-in workspaces remain separate with a clear account-transition notice.
- [ ] Public campaign responses omit cost, private economics, customer names, and owner data.
- [ ] Workspace deletion removes the relevant saved data and public campaigns.

## Publish and pickup lifecycle

- [ ] Editing copy changes the published collection after the owner clicks publish.
- [ ] Real shop publishing requires usable pickup instructions.
- [x] Published sample campaigns retain their illustrative-data label after workspace changes.
- [x] Expired 48-hour holds reconcile on the next request and restore stock exactly once.
- [ ] Public availability reflects current stock, including changes after publication.
- [x] Reserving a unit decreases available stock exactly once.
- [x] Retrying with the same idempotency key does not create another hold.
- [ ] Competing requests for the last unit permit only one successful reservation.
- [x] Cancelling restores the unit exactly once, even on retries.
- [x] Marking collected does not restore stock.
- [ ] Invalid or unauthorized reservation transitions fail.
- [ ] Same-origin protections reject unauthorized write origins.
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

CI passed 18 automated tests, TypeScript checks and a production build. The build owner reports a local HTTP-flow run plus a desktop and 390-pixel mobile browser walkthrough of exact search, generation, publication, public hold and reference confirmation without horizontal overflow. Browser screenshots are saved in the submission kit. Checked items below reflect those observations or specific automated cases, not production certification. Founder rehearsal, customer interviews, pilots, real sales and commercial uplift remain unverified.

| Date and environment | Check | Result | Evidence |
|---|---|---|---|
| October 20, 2026 / GitHub Actions | 18 automated tests, TypeScript checks, production build | Passed | [CI run 39401939877](https://github.com/shi1720/side-b/actions/runs/39401939877) |
| October 20, 2026 / local browser | Exact film search, generation, publish, hold reference | Passed, reported by build owner | `outputs/submission-kit/screenshots/` |
| October 20, 2026 / desktop and 390px mobile | Critical walkthrough and horizontal overflow | Passed, reported by build owner | `side-b-studio.png`, `side-b-mobile.png`, `side-b-hold-confirmation.png` |
| October 20, 2026 / public repository | Public source and recognized MIT license | Verified by build owner | [Repository](https://github.com/shi1720/side-b) |
| October 20, 2026 / external deployment | Native deployment | Published | [Demo](https://side-b-records.sg127977958.chatgpt.site) |
| October 20, 2026 / production HTTP | End-to-end production smoke | Stock-decrement defect found; repair in progress | Build-owner hosted smoke found availability unchanged after a hold. Keep the production gate open until repaired and re-tested. |
| Not yet run | Founder rehearsal, shop pilot, real commercial outcomes | Unverified | No claim of traction or uplift |
