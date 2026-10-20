# Submission QA checklist

Status on creation: **verification pending**. Unchecked items are release requirements, not claims of failure. Record the actual result and evidence before checking an item.

## Eligibility and access

- [ ] The demo URL opens without private access and completes the core workflow.
- [ ] The public repository opens while signed out and includes source, assets, setup instructions, and LICENSE.
- [ ] The repository About section shows the detected open-source license.
- [ ] README setup works from a clean checkout with documented configuration.
- [ ] Qloo credential is absent from client bundles, source history, screenshots, receipts, and documents.

## Evidence and selection

- [ ] Search returns real selectable Qloo entities and supports empty/error states.
- [ ] A film or book anchor produces a real stock-constrained Qloo Insights run.
- [ ] Each selected SKU exists in the server's workspace inventory and has available units.
- [ ] Price, gross margin, fit floor, size, and one-per-artist constraints hold.
- [ ] An impossible brief returns fewer or zero picks with a clear explanation.
- [ ] Unresolved artists receive no fabricated evidence.
- [ ] Evidence includes anchor, candidate-pool rank, fetch time, and cached/live provenance.
- [ ] Raw Qloo affinities remain distinct from combined rank fit.
- [ ] The user sees the artist-level and non-predictive limitations.
- [ ] The stock-age and gross-profit comparisons use correctly labeled candidate rules.
- [ ] Economics reconcile to one unit of each selected record, with no uplift claim.

## Inventory and privacy

- [ ] Valid CSV imports with quoted commas, escaped quotes, CRLF, and a BOM work.
- [ ] Missing headers, bad numbers, duplicate SKUs, too many rows, and invalid fields fail clearly.
- [ ] Import does not partially replace stock after validation failure.
- [ ] Inventory replacement is blocked with active holds.
- [ ] Independent guest browsers cannot access each other's private workspaces.
- [ ] Signed-in accounts preserve and isolate their own data.
- [ ] Guest and signed-in workspaces remain separate with a clear account-transition notice.
- [ ] Public campaign responses omit cost, private economics, customer names, and owner data.
- [ ] Workspace deletion removes the relevant saved data and public campaigns.

## Publish and pickup lifecycle

- [ ] Editing copy changes the published collection after the owner clicks publish.
- [ ] Real shop publishing requires usable pickup instructions.
- [ ] Published sample campaigns retain their illustrative-data label after workspace changes.
- [ ] Expired 48-hour holds reconcile on the next request and restore stock exactly once.
- [ ] Public availability reflects current stock, including changes after publication.
- [ ] Reserving a unit decreases available stock exactly once.
- [ ] Retrying with the same idempotency key does not create another hold.
- [ ] Competing requests for the last unit permit only one successful reservation.
- [ ] Cancelling restores the unit exactly once, even on retries.
- [ ] Marking collected does not restore stock.
- [ ] Invalid or unauthorized reservation transitions fail.
- [ ] Same-origin protections reject unauthorized write origins.
- [ ] The public page says that no payment is taken and collection happens in the shop.

## Usability and final presentation

- [ ] Studio, inventory, results, campaign, and reservation flows work at mobile and desktop widths.
- [ ] Critical controls have keyboard focus and accessible names.
- [ ] Loading, empty, API-failure, and validation states are clear.
- [ ] Printed shelf cards show customer-relevant information clearly.
- [ ] Downloaded JSON contains the actual run and no credential.
- [ ] Demo contains obvious sample-stock disclosure.
- [ ] Submission description matches the implemented build.
- [ ] Founder script has been rehearsed against the actual app.
- [ ] PDF and every PPTX slide render without clipping or overflow.
- [ ] Final submission links are verified and preparation-only notes removed where appropriate.

## Verification log

The build owner reports 15 local behavior tests and 21 local HTTP-flow checks passed. The owner also reports a desktop and 390-pixel mobile browser walkthrough of exact search, generation, publication, public hold and reference confirmation without horizontal overflow. This is coordination evidence, not an external deployment certification. Retain final commands, outputs and browser evidence in the release record.

| Date and environment | Check | Result | Evidence |
|---|---|---|---|
| Pending | External end-to-end flow | Pending | Add browser and server evidence |
| Pending | Automated build and behavior checks | Pending | Add command and observed result |
| Pending | Public repository and license | Pending | Add verified URL |
