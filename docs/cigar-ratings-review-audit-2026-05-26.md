# Cigar Ratings And Reviews Audit - 2026-05-26

## Scope

- Audited published storefront catalog products that are cigars or cigar sample packs.
- Excluded non-cigar products by product/category terms: lighter, torch, fluid, butane, humidor, membership, accessory, ashtray, cutter, punch, display, and book matches.
- Audit command used the local catalog projection from `src/lib/catalog.ts`.

## Coverage Summary

| Metric | Count |
| --- | ---: |
| Published catalog products | 921 |
| Cigar and cigar-sampler products | 834 |
| Products with sourced review coverage | 4 |
| Products queued for sourced review research | 830 |

## Current Sourced Review Coverage

| Product | Coverage |
| --- | --- |
| `ACID 20 TWENTY YEAR 24/BX` | Review profile from Cigar World, CIGAR.com, and Cigar Coop |
| `H UPMANN HERITAGE ROBUSTO` | Cigar Aficionado expert review |
| `H UPMANN NICARAGUAN TORO 20/BX AJ FERNANDEZ` | Cigar Aficionado expert review |
| `H UPMANN THE BANKER DAYTRADER TORO 10/BX` | Cigar Aficionado expert review |

## Storefront Behavior After This Pass

- Every cigar product now has a `Ratings & Reviews: {PRODUCT NAME}:` research prompt available through `getCatalogReviewSearchPrompt`.
- Every cigar product now gets a review audit payload through `getCatalogReviewAudit`.
- Products without sourced review data render a queued review research panel instead of the old empty Cigar Aficionado-only message.
- The queued panel avoids repeating product specs already shown in Blend Details or Catalog Intelligence.
- The queued panel now focuses on review-specific research details: review status, search focus, source priority, match rule, capture fields, quality gate, and a search link.
- Real scores remain attached only where a source URL and rating/profile were already researched.

## Largest Pending Brand Queues

| Brand | Pending |
| --- | ---: |
| Rocky Patel | 64 |
| Arturo Fuente | 51 |
| Oliva | 47 |
| Romeo | 43 |
| Perdomo | 42 |
| Macanudo | 40 |
| Tatiana | 37 |
| La | 31 |
| Gurkha | 28 |
| Montecristo | 26 |
| My Father | 25 |
| ACID | 22 |
| Factory | 22 |
| Quorum | 20 |
| Cohiba | 19 |
| Jm'S | 16 |
| Ashton | 15 |
| Brick | 14 |
| Drew | 14 |
| Camacho | 13 |

## Recommended Next Enrichment Passes

1. Prioritize high-count brands with strong public review coverage: Rocky Patel, Arturo Fuente, Oliva, Perdomo, Macanudo, My Father, and Montecristo.
2. Group by line before vitola so one researched review profile can support related sizes when the source clearly covers the same blend.
3. Keep rating claims source-bound. If only retailer/community sentiment is available, label it as community or customer ratings rather than expert review.
4. Avoid aggregate rating schema until Yuzu has first-party reviews or a legally reliable review aggregation source for each product.
