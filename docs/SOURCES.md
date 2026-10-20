# Research and claim boundaries

Primary sources checked October 20, 2026. Source facts support the product context, not proof of Side B's demand or commercial results.

## Physical music context

[RIAA, 2025 Year-End Recorded Music Revenue Report](https://www.riaa.com/wp-content/uploads/2026/03/RIAA-Year-End-Revenue-2025.pdf), page 2, reports United States vinyl wholesale value of $1,042.9 million in 2025, up 9.3%, and 46.8 million units. These are industry wholesale figures. They do not measure independent-shop revenue, software budgets, or Side B's addressable market.

## Existing retailer workflows

[Discogs, Import and Export Your Inventory (CSV)](https://support.discogs.com/hc/en-us/articles/360007622373-Import-and-Export-Your-Inventory-CSV) documents bulk listing changes and inventory export. This supports CSV as an existing workflow, but the Discogs schema differs from Side B's. Side B requires manual field mapping and stock reconciliation. No automatic Discogs integration is claimed.

[NewPoint Software](https://www.newpointsoftware.com/) was identified as a record-retail software reference. The site did not load during this documentation pass, so no detailed feature or pricing comparison relies on it.

## Ordinary inventory and release restrictions

[Record Store Day UK, FAQ](https://www.recordstoreday.co.uk/faq) describes the role of independent shops and states that participating shops cannot reserve or pre-sell Record Store Day releases before the day. Side B's example is ordinary stock merchandising. Shops must respect any release-specific rules before enabling pickup holds. Side B has no Record Store Day affiliation or integration.

## Qloo implementation and interpretation

- [Official Search reference](https://github.com/qloo/docs-public/blob/main/reference/get-search.md): entity search for exact selectable cultural anchors.
- [Official Insights reference](https://github.com/qloo/docs-public/blob/main/reference/insights-api-deep-dive.md): entity signals and `filter.results.entities` to restrict candidates to stocked artists. Per-query maximum `take` is 50.
- [Official score interpretation](https://github.com/qloo/docs-public/blob/main/docs/interpreting-affinity-scores.md): scores depend on query context and are normalized per query. Side B keeps raw scores separate and combines within-pool ranks.
- [Official FAQ](https://github.com/qloo/docs-public/blob/main/docs/faqs.md): affinity is a relationship measure, not a percentage of survey respondents or demonstrated buyer intent.

The product implementation is the source for workflow details: `lib/agent.ts`, `lib/optimizer.ts`, and `API-CONTRACT.md`. An implementation claim does not establish that every deployment path has passed QA. Use the verification log for observed results.

## Visual credit

The record-shop illustration in the founder brief and deck is an original AI-generated fictional scene, created using the built-in ImageGen tool. It is not a photograph of a customer, partner, pilot, or real shop. No album cover or brand logo is depicted. Product screenshots, where included, show the actual Side B interface.
