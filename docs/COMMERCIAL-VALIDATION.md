# Commercial validation plan

Status: a product and pricing hypothesis. No retailer interviews, paying customers, revenue, or sales uplift claimed.

## Buyer and recurring job

The first buyer is the owner or manager of an independent record shop that can export a small selection of stock. The recurring job is preparing a useful cultural edit for the window, a newsletter, or the shop counter without recommending records that are unavailable or commercially unsuitable.

Focus on one repeatable weekly edit. A full inventory suite, payment system, or distributor marketplace would expand the product before proving that job.

## Pricing hypothesis

Test $29 and $49 per shop per month. Offer a small, time-boxed pilot before a paid commitment. Confirm Qloo production licensing, allowed caching, attribution, and usage costs before quoting a production plan. Hackathon API access does not establish a sustainable commercial API price.

Contribution per shop must account for hosting, database operations, Qloo calls, customer support, acquisition, and payment processing for the subscription. Record pricing inside the app is unrelated to subscription revenue.

Illustrative unit-economics model, not observed economics:

`monthly subscription - API usage - hosting allocation - support time cost - payment fees = contribution before acquisition and overhead`

Use measured call counts per run and cache-hit rates from a pilot. Do not assume infrastructure or Qloo usage remains free at commercial scale.

## Discovery before selling

Interview five to eight shopkeepers. Ask them to show the last collection or promotional post they prepared, their stock export, and how they knew whether it worked. Record current preparation time, inventory friction, how often stock changes, and who makes the final recommendation. Ask what they already pay for and what this workflow would replace. Avoid leading questions about whether they “like AI.”

Recruit three shops for a four-week pilot only after understanding those workflows. These are proposed recruitment targets, not existing participants. Each shop chooses its own anchor and reviews every edit before publishing.

## Pilot design

Use comparable campaign opportunities within the same shop. Alternate Side B edits with that shop's usual curation, or randomize matched campaign slots where operationally sensible. Record price, availability, channel, exposure, seasonality, and staff involvement. A small pilot supports directional learning, not a causal revenue claim.

| Question                    | Measure                                                | Proposed decision rule                                                             |
| --------------------------- | ------------------------------------------------------ | ---------------------------------------------------------------------------------- |
| Does it save useful time?   | Minutes from stock export to owner-approved edit       | At least half of pilot shops repeat the workflow and report meaningful time saved  |
| Is the stock trustworthy?   | Published items with incorrect availability            | Zero oversold holds in controlled QA; investigate every pilot mismatch             |
| Do customers act?           | Unique storefront visits, valid holds, collected holds | Assess collection rate and incremental gross profit against the shop's usual edits |
| Does it help older stock?   | Units collected from stock aged 90+ days               | Compare against matched baseline without discounting away gross profit             |
| Will the shop pay?          | Actual continuation at a stated price                  | Seek at least two paid continuations before assuming demand                        |
| Can the service earn money? | Measured cost per run and support per shop             | Positive contribution at observed usage under confirmed API terms                  |

The thresholds above are management choices for a small pilot. They are not industry benchmarks or statistically proven targets.

## Stock reconciliation

The current CSV import replaces inventory and is blocked while active holds exist. A shop must reconcile sales and holds manually before importing a fresh export. Holds last 48 hours and expiration reconciles on the next request. Side B does not run a background expiry service. Side B is not a live point-of-sale integration. Begin with a small, clearly managed stock selection and a named staff owner. Test imports in a private workspace before publishing. Side B’s schema needs manual mapping from existing retailer exports, including Discogs.

Use ordinary inventory for the pilot. Shops must respect any release-specific restrictions, such as Record Store Day rules on advance reservations. The product has no Record Store Day affiliation.

## Competition and advantage

Inventory and marketplace tools already help retailers list and sell records. Human curation is an essential part of the customer experience. Side B's narrow value is joining cross-domain cultural evidence with current stock and commercial constraints, then taking that edit through a pickup hold. It must fit an existing workflow rather than demand a new catalog-maintenance burden.

Qloo itself is a licensed dependency, not a proprietary moat. Any future advantage would need to come from workflow adoption, reliable point-of-sale reconciliation, retailer relationships, and consented evidence about which edits led to useful outcomes. None of those advantages is claimed as established today.

## Risks that can invalidate the idea

Artist-level affinity may be too broad for specific albums and pressings. Cold-start stock matching may require human correction. Shopkeepers may prefer their own curation and reject another monthly tool. Cultural affinity may not improve commercial outcomes. Manual CSV updates may cost more time than the tool saves. API production terms may make the proposed price unworkable.

The pilot should answer these questions before expansion to bookstores or other independent retailers.
