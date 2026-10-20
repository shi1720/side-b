# Release QA checklist

Canonical target: [sideb-records.web.app](https://sideb-records.web.app).

**Current migration status:** all 51 unique active tests passed together against the Firestore emulator with Node.js 24.22, with zero skips: 41 module/security/session/agent cases and ten Firestore integration cases. A first Firebase-hosted HTTP smoke also passed at `2026-10-20T10:15:58Z`. Google sign-in was subsequently verified in the hosted browser through the Google account chooser and redirect back to a saved account workspace on the latest image. Final release HTTP smoke and restoration of the retained guest workspace are tracked separately below.

This checklist separates current implementation tests from earlier hosting-platform results. A checked automated gate applies only to the behavior its test exercises. It does not imply every UI or deployed configuration has been checked.

## Current automated evidence

| Area                            | Verified behavior                                                                                                                                                                         | Evidence                                                    |
| ------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| Cultural evidence               | Unknown signals and missing affinities cannot create recommendations; duplicate rows and malformed payloads are handled; stocked pool and optional attribution are bounded                | `tests/evidence.test.mjs`                                   |
| Planning                        | Hard commercial rules, missing-anchor penalties, artist diversity, no-evidence rejection, exact-cent economics and infeasible briefs                                                      | `tests/optimizer.test.mjs`                                  |
| CSV                             | BOM/CRLF, quoted text, escaped quotes, malformed fields, missing/duplicate headers, numeric limits, row limits, formula-safe export and ordinary round trips                              | `tests/csv.test.mjs`                                        |
| Request boundaries              | Canonical origin behind Cloud Run, missing production origin rejection, cross-site rejection, streamed body limit, content type, malformed JSON and safe server errors                    | `tests/request-security.test.mjs`                           |
| Session and agent orchestration | Strict guest/account cookie parsing, safe return paths, session selection and bounded artist-resolution work queues                                                                       | `tests/session.test.mjs`, `tests/agent-work-queue.test.mjs` |
| Firestore transactions          | Last-copy contention, concurrent duplicate keys, cancellation/expiry races, collection, owner isolation, stock replacement races, pause/resume, public redaction, reset and shared quotas | `tests/firestore.test.mjs`, emulator opt-in                 |

The Firestore suite was reported passing 10/10 against `127.0.0.1:8085`, project `demo-side-b-audit`, database `side-b`. Its fixture guard requires a `demo-` project and an emulator. Its current cases also cover operational-entry TTL cleanup/reset and migration of the legacy sample pickup sentinel. These checks target the current persistence layer; the removed SQLite tests are not counted as Firestore evidence.

The CI workflow defines a module/type/build job and a separate complete-suite job using Node.js 24.22, Java 21 and pinned Firebase CLI 15.34.0. The latter launches an isolated `demo-side-b-ci` Firestore emulator and executes `npm test` without production credentials. Workflow configuration is not a claim that a particular remote CI run has passed.

## Reproduce the checks

```sh
npm ci
npm run lint
npm run typecheck
npm test
npm run build
```

With the emulator already running:

```sh
FIRESTORE_EMULATOR_HOST=127.0.0.1:8085 \
GOOGLE_CLOUD_PROJECT=demo-side-b-audit FIRESTORE_DATABASE_ID=side-b \
  npm run test:firestore
```

With a configured app and live Qloo key:

```sh
node scripts/smoke-test.mjs http://127.0.0.1:3000
```

The HTTP smoke creates and deletes its own guest fixtures and consumes upstream Qloo allowance. It is separate from browser authentication. See [deployment](DEPLOYMENT.md) for a self-contained emulator invocation and production configuration.

## Hosted release gates

Record the deployment revision, origin, command result and evidence artifact for the current revision.

- [x] Native Next.js build completed for a deployed image; final image publication is tracked separately.
- [x] Canonical Firebase Hosting URL opens without private access, verified by the build owner.
- [x] First migrated hosted live Qloo search and stock-constrained planning complete; rerun after final image.
- [ ] Final-image merchant-to-public pickup smoke passes, including fixture cleanup, no-store HTML and boot-asset status 200.
- [ ] Public code repository and recognized MIT license are accessible while signed out.
- [ ] Secrets scan excludes Qloo keys, service-account keys and session tokens from source, bundles, screenshots, receipts and documents.
- [ ] Runtime origin, named database, service account and Secret Manager version match the canonical deployment.
- [ ] Public Firestore browser rules deny direct reads and writes.
- [ ] Current remote CI completes the new module/type/build job and complete-suite Firestore emulator job.

## Google authentication and guest return

These use the deployed Firebase configuration. The build owner verified the complete Google redirect into a saved account workspace on the latest image. Earlier hosting-platform sign-in results are not counted as Firebase evidence.

- [x] Same-tab Google redirect opens account selection and returns to an authenticated saved account workspace, verified by the build owner.
- [ ] Redirect cancellation, provider configuration failure and failed session verification display a useful retry message.
- [ ] A guest workspace and account workspace remain distinct.
- [ ] Signing out restores the same browser's original guest inventory and collections when its token was retained.
- [ ] Signing in again restores the same account data.
- [ ] A different Google account cannot access the first account's private stock, runs or customer holds.
- [ ] Account data persists in another authorized browser/device after authentication.
- [ ] Session cookies are HttpOnly and Secure in production; expired/invalid account tokens do not become authenticated access.
- [ ] Native form sign-out works before client hydration and has a distinct outcome from workspace deletion.

## Merchant workflow

- [ ] Exact Qloo search returns selectable identities and useful empty/error states.
- [ ] Evidence shows the anchor, stocked candidate-pool rank, retrieval time and cached/live provenance.
- [ ] Artist-level evidence and non-predictive rank-fit limitations are visible.
- [ ] Baselines are labeled as oldest-stock and highest-margin heuristics, not an LLM benchmark.
- [ ] One-of-each economics reconcile to the entered retail and cost values without a forecast claim.
- [ ] CSV errors do not partially replace stock; duplicates, excessive rows and invalid numbers fail clearly.
- [ ] Existing pickup holds block inventory replacement with an actionable message.
- [ ] Editing the title/story affects the newly published collection only after explicit publication.
- [ ] Real-stock publication requires practical pickup address/contact/opening details.
- [ ] Sample collections preserve their illustrative-data designation after later workspace changes.
- [ ] Workspace deletion removes owned private records and makes associated public collections unavailable.

## Public pickup workflow

- [ ] Available units reflect current server stock after publication.
- [ ] The customer page clearly states pickup only, no payment collection, no shipping, 48-hour hold and no reminders.
- [ ] A successful hold shows its real reference and pickup instructions.
- [ ] A connection failure after successful reservation does not mislabel the completed hold as failed.
- [ ] Retry uses the same idempotency key rather than consuming another record.
- [ ] Another browser taking the final copy results in an honest unavailable/conflict state.
- [ ] Merchant collection consumes the unit; cancellation restores it once.
- [ ] Expired holds reconcile on the next related operation and restore stock once.
- [ ] Pause hides the public page and stops new holds while existing holds remain manageable.
- [ ] Public JSON omits private costs, economics, customer names and owner identity.

## Accessibility and presentation

- [ ] Studio, inventory, campaign, public collection, authentication and hold confirmation work at desktop and 390-pixel width.
- [ ] Narrow screens have no page-wide horizontal overflow; wide data tables remain locally scrollable.
- [ ] All key actions have visible keyboard focus and descriptive accessible names.
- [ ] Dialogs trap focus, support Escape when idle, return focus on closing and keep the background from scrolling.
- [ ] Loading and search status, validation errors and success states are announced.
- [ ] Mobile inputs avoid unintended zoom and essential buttons have usable touch targets.
- [ ] Print-to-PDF shelf cards remain readable and exclude private costs/margins.
- [ ] Exported decision JSON matches the actual run and contains no credential.
- [ ] App and walkthrough wording contain no event references or em dashes.
- [ ] The founder walkthrough has been rehearsed against this exact deployed build.

## Verification ledger

| Environment                                  | Check                                                                           | Current status                                                                                |
| -------------------------------------------- | ------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| Current source, complete emulator run        | 51 unique cases: 41 module/security/session/agent and ten Firestore integration | Passed together, zero skips, Node.js 24.22; reported by build owner                           |
| Current source, Firestore integration subset | Ten persistence/concurrency/cleanup cases                                       | Passed 10/10; included in the complete run                                                    |
| Current source, TypeScript                   | Typechecking                                                                    | Passed, reported by implementation agent; rerun after final edits                             |
| Native Next.js / Firebase Hosting            | First migrated public HTTP smoke and cleanup                                    | Passed at `2026-10-20T10:15:58Z`; evidence: `outputs/submission-kit/evidence/firebase-first/` |
| Final Firebase release                       | Public HTTP smoke after final image publication                                 | Pending final revision evidence                                                               |
| Firebase Google auth                         | Same-tab Google chooser and redirect into saved account workspace               | Passed in hosted browser on latest image, reported by build owner                             |
| Retained guest return                        | Native sign-out and original guest restoration                                  | In progress; not yet claimed                                                                  |
| Current UI / desktop and mobile              | Final post-migration walkthrough and print output                               | Pending browser evidence                                                                      |
| Commercial validation                        | Merchant interviews, paid pilots, sales uplift                                  | Not performed; no traction claim                                                              |

## Historical checks

Before the Firebase migration, an earlier hosted version passed a live Qloo merchant-to-storefront HTTP smoke and a hosting-platform authentication walkthrough. Earlier desktop/mobile screenshots and CI results belong to that previous runtime. They are historical evidence of the product workflow, not verification of Firebase Authentication, Firestore transactions or the final native Next.js deployment.

A previous test harness also had a multi-cookie handling defect that was corrected. Its old latency figure covered a cached multi-request workflow, not a fresh-agent latency benchmark. Neither the earlier number nor the earlier SQL tests should be presented as current-runtime performance or correctness evidence.

Passing technical checks does not establish commercial demand, sales lift, regulatory compliance for every merchant, or complete operational coverage. Pilot and founder rehearsal results should be reported only after they happen.
