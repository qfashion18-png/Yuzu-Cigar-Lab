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
| Products with sourced review coverage | 5 |
| Products without sourced review coverage | 829 |

## Current Sourced Review Coverage

| Product | Coverage |
| --- | --- |
| `ACID 20 TORO MADURO 24/BX` | Review profile from Cigar Coop, Cigar World, and Holt's Cigar Co. |
| `ACID 20 TWENTY YEAR 24/BX` | Review profile from Cigar World, CIGAR.com, and Cigar Coop |
| `H UPMANN HERITAGE ROBUSTO` | Cigar Aficionado expert review |
| `H UPMANN NICARAGUAN TORO 20/BX AJ FERNANDEZ` | Cigar Aficionado expert review |
| `H UPMANN THE BANKER DAYTRADER TORO 10/BX` | Cigar Aficionado expert review |

## Storefront Behavior After Customer-Facing Correction

- Product detail pages no longer render internal review audit prompts, research queries, source-priority instructions, or capture-field checklists.
- Products without verified publication or customer review coverage render a neutral empty review state.
- `Catalog Signals` no longer includes `Review audit queued`.
- Sourced review products still render their sourced review profile or expert review.
- Product JSON-LD still omits aggregate rating fields until a real aggregate review model is added.

## Correction Source Notes

- `ACID 20 TORO MADURO 24/BX` now uses the exact Cigar Coop ACID 20 Toro review, the Cigar World ACID 20 line/community page, and the Holt's Acid 20 customer-review page.
- Cigar Coop reviewed the 6 x 50 Toro and scored it 87.
- Cigar World provides a line-level 4.63 community rating and lists Toro as an available size.
- Holt's lists Acid 20 Toro 6 x 50, box of 24, and a 5/5 customer-review aggregate for the Acid 20 line.

## Largest Brands Without Sourced Review Coverage

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
| Factory | 22 |
| ACID | 21 |
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
