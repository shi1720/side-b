# Release QA checklist

Canonical target: [sideb-records.web.app](https://sideb-records.web.app).

**Verified release evidence:** source commit `d58be20`, deployed Cloud Run revision `side-b-00007-mxx`, passed the hosted HTTP smoke at `2026-10-20T11:08:43.990Z`. The 14.04-second workflow verified no-store HTML, successful browser boot assets, live Qloo, the pickup lifecycle and fixture cleanup. [GitHub CI run 39412428378](https://github.com/shi1720/side-b/actions/runs/39412428378) passed both jobs; the complete emulator run passed all 51 tests with zero skips. Google sign-in, native sign-out restoring the original guest, and sign-in restoring the account's two saved collections were verified. Inventory is locally scrollable without document overflow at 320 and 390 pixels; studio results also fit 390, 768 and 1280. The 390-pixel public hold flow, owner cancellation and stock restoration passed.

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

The CI workflow defines a module/type/build job and a separate complete-suite job using Node.js 24.22, Java 21 and pinned Firebase CLI 15.34.0. The latter launches an isolated `demo-side-b-ci` Firestore emulator and executes `npm test` without production credentials. [CI run 39412428378](https://github.com/shi1720/side-b/actions/runs/39412428378) completed both jobs successfully; its emulator job passed all 51 cases with zero skips.

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

- [x] Native Next.js production build deployed as revision `side-b-00007-mxx` from `d58be20`.
- [x] Canonical Firebase Hosting URL opens without private access, verified by the build owner.
- [x] Hosted live Qloo search and stock-constrained planning passed on revision `side-b-00007-mxx`.
- [x] Revision `side-b-00007-mxx` merchant-to-public pickup smoke passed, including fixture cleanup, no-store HTML and boot-asset status 200.
- [x] Public code repository and recognized MIT license are accessible while signed out.
- [ ] Secrets scan excludes Qloo keys, service-account keys and session tokens from source, bundles, screenshots, receipts and documents.
- [x] Runtime origin, named database, service account and Secret Manager version match the canonical deployment.
- [x] Public Firestore browser rules deny direct reads and writes.
- [x] Current remote CI completed both the module/type/build and complete-suite Firestore emulator jobs: [run 39412428378](https://github.com/shi1720/side-b/actions/runs/39412428378).

## Google authentication and guest return

These use the deployed Firebase configuration. The build owner verified the complete Google redirect into a saved account workspace on the latest image. Earlier hosting-platform sign-in results are not counted as Firebase evidence.

- [x] Same-tab Google redirect opens account selection and returns to an authenticated saved account workspace, verified by the build owner.
- [ ] Redirect cancellation, provider configuration failure and failed session verification display a useful retry message.
- [x] Guest and account workspaces remained distinct in the hosted browser: the account had two collections; the original guest had zero.
- [x] Native form sign-out restored the original guest workspace named `SideBGuestQA`, with zero collections, as verified by the build owner.
- [x] Signing in again restores the same account data.
- [ ] A different Google account cannot access the first account's private stock, runs or customer holds.
- [ ] Account data persists in another authorized browser/device after authentication.
- [ ] Session cookies are HttpOnly and Secure in production; expired/invalid account tokens do not become authenticated access.
- [x] Native server-form sign-out succeeded in the hosted browser and returned to the retained guest workspace without deleting the account workspace.

## Merchant workflow

- [x] Exact Qloo search returns selectable identities and useful empty/error states.
- [x] Evidence shows the anchor, stocked candidate-pool rank, retrieval time and cached/live provenance.
- [x] Artist-level evidence and non-predictive rank-fit limitations are visible.
- [x] Baselines are labeled as oldest-stock and highest-margin heuristics, not an LLM benchmark.
- [x] One-of-each economics reconcile to the entered retail and cost values without a forecast claim.
- [ ] CSV errors do not partially replace stock; duplicates, excessive rows and invalid numbers fail clearly.
- [ ] Existing pickup holds block inventory replacement with an actionable message.
- [ ] Editing the title/story affects the newly published collection only after explicit publication.
- [ ] Real-stock publication requires practical pickup address/contact/opening details.
- [ ] Sample collections preserve their illustrative-data designation after later workspace changes.
- [x] Workspace deletion removes owned private records and makes associated public collections unavailable.

## Public pickup workflow

- [x] Available units reflect current server stock after publication.
- [x] The customer page clearly states pickup only, no payment collection, no shipping, 48-hour hold and no reminders.
- [x] A successful hold shows its real reference and pickup instructions.
- [ ] A connection failure after successful reservation does not mislabel the completed hold as failed.
- [ ] Retry uses the same idempotency key rather than consuming another record.
- [ ] Another browser taking the final copy results in an honest unavailable/conflict state.
- [x] Merchant collection consumes the unit; cancellation restores it once.
- [x] Expired holds reconcile on the next related operation and restore stock once.
- [x] Pause hides the public page and stops new holds while existing holds remain manageable.
- [x] Public JSON omits private costs, economics, customer names and owner identity.

## Accessibility and presentation

- [x] Studio, inventory, campaign, public collection, authentication and hold confirmation work at desktop and 390-pixel width.
- [x] Narrow screens have no page-wide horizontal overflow; wide data tables remain locally scrollable.
- [ ] All key actions have visible keyboard focus and descriptive accessible names.
- [ ] Dialogs trap focus, support Escape when idle, return focus on closing and keep the background from scrolling.
- [ ] Loading and search status, validation errors and success states are announced.
- [ ] Mobile inputs avoid unintended zoom and essential buttons have usable touch targets.
- [x] Print-to-PDF shelf cards remain readable and exclude private costs/margins.
- [x] Exported decision JSON matches the actual run and contains no credential.
- [x] App and walkthrough wording contain no event references or em dashes.
- [ ] The founder walkthrough has been rehearsed against this exact deployed build.

## Verification ledger

| Environment                                  | Check                                                                                    | Current status                                                                                |
| -------------------------------------------- | ---------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| Current source, complete emulator run        | 51 unique cases: 41 module/security/session/agent and ten Firestore integration          | Passed together, zero skips, Node.js 24.22; reported by build owner                           |
| Current source, Firestore integration subset | Ten persistence/concurrency/cleanup cases                                                | Passed 10/10; included in the complete run                                                    |
| Current source, TypeScript                   | Typechecking                                                                             | Passed, reported by implementation agent; rerun after final edits                             |
| Native Next.js / Firebase Hosting            | First migrated public HTTP smoke and cleanup                                             | Passed at `2026-10-20T10:15:58Z`; evidence: `outputs/submission-kit/evidence/firebase-first/` |
| Hosted commit `d58be20`, revision `side-b-00007-mxx`    | HTML/boot assets, live Qloo, pickup lifecycle and fixture cleanup                        | Passed at `2026-10-20T11:08:43.990Z`; 14.04 seconds for the complete workflow                 |
| Firebase Google auth                         | Same-tab Google chooser and redirect into saved account workspace                        | Passed in hosted browser on latest image, reported by build owner                             |
| Retained guest return                        | Native server-form sign-out restored `SideBGuestQA`; guest zero collections, account two | Passed in hosted browser, reported by build owner                                             |
| Mobile inventory, 390 pixels                 | Recheck document overflow after positioned-scroll-container fix                          | Passed: document, body and nav 390px; inventory scroller 348px, table 733px. At 320px page remains 320px. Public modal and confirmation also fit 390px.                                |
| Commercial validation                        | Merchant interviews, paid pilots, sales uplift                                           | Not performed; no traction claim                                                              |

## Video and submission status

- [x] [Public walkthrough](https://youtu.be/5lAPCRtPbU4) published; 1080p playback verified by the build owner.
- [x] English captions published separately for the video.
- [x] Correct Devpost project `1247896` (Side B) saved as a draft at four of five sections.
- [ ] Final Devpost submission. The draft is intentionally not submitted.

The complete hosted smoke duration is a multi-request workflow measurement, not an uncached agent-latency or sales-performance benchmark. Cross-device persistence and a second Google account browser isolation check remain unclaimed.

## Historical checks

Before the Firebase migration, an earlier hosted version passed a live Qloo merchant-to-storefront HTTP smoke and a hosting-platform authentication walkthrough. Earlier desktop/mobile screenshots and CI results belong to that previous runtime. They are historical evidence of the product workflow, not verification of Firebase Authentication, Firestore transactions or the final native Next.js deployment.

A previous test harness also had a multi-cookie handling defect that was corrected. Its old latency figure covered a cached multi-request workflow, not a fresh-agent latency benchmark. Neither the earlier number nor the earlier SQL tests should be presented as current-runtime performance or correctness evidence.

Passing technical checks does not establish commercial demand, sales lift, regulatory compliance for every merchant, or complete operational coverage. Pilot and founder rehearsal results should be reported only after they happen.

Final print evidence: `outputs/submission-kit/SIDE-B-SAMPLE-SHELF-CARDS.pdf`, one A4 page rendered and visually checked. Text/source/bundle/receipt credential-pattern scan found zero matches across 114 files; this is a scoped scan, not a security certification. Invalid ID token POST returned 401 with a safe retry message.
