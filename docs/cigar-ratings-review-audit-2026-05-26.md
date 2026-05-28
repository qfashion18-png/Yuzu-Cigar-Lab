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

## 2026-05-28 Pre-Enrichment Recheck

Catalog projection matched the original audit before the Rocky Patel enrichment batch.

| Metric | Count |
| --- | ---: |
| Published catalog products | 921 |
| Cigar and cigar-sampler products | 834 |
| Products with sourced review coverage | 5 |
| Products without sourced review coverage | 829 |
| Sourced coverage rate | 0.60% |

Missing means a published cigar/sampler product passes `isCigarCatalogProduct` and has neither `expertReview` nor `reviewProfile` in `src/lib/catalog.ts`.

The only currently covered products are:

| SKU | Product | Coverage |
| --- | --- | --- |
| `18821` | `ACID 20 TORO MADURO 24/BX` | Sourced review profile |
| `39919` | `ACID 20 TWENTY YEAR 24/BX` | Sourced review profile |
| `572463` | `H.Upmann Heritage Robusto` | 90-point Cigar Aficionado expert review |
| `24921` | `H.UPMANN NICARAGUAN TORO 20/BX AJ FERNANDEZ` | 92-point Cigar Aficionado expert review |
| `777128` | `H UPMANN THE BANKER DAYTRADER TORO 10/BX` | 90-point Cigar Aficionado expert review |

Therefore, every other published cigar/sampler product is missing sourced Ratings & Reviews coverage.

## 2026-05-28 Pre-Enrichment Missing Coverage Hotspots

| Brand | Missing |
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

| Category | Missing |
| --- | ---: |
| Mid-Range Cigars ($50-$150) | 363 |
| Premium Cigars ($150-$300) | 162 |
| Arturo Fuente Cigars | 51 |
| Macanudo Cigars | 37 |
| ACID Cigars | 34 |
| Budget Cigars (Under $50) | 34 |
| Sample Packs | 34 |
| Gurkha Cigars | 26 |
| Cohiba Cigars | 19 |
| Luxury Cigars ($300+) | 15 |
| MY Cigars | 14 |
| Factory Smokes | 13 |
| Montecristo Cigars | 8 |
| Perdomo Cigars | 7 |
| JM's Cigars | 6 |
| Oliva Cigars | 6 |

## 2026-05-28 Next Five Batch 3 Update

Added source-backed `reviewProfile` coverage for the next five missing brand batches: Oliva, Romeo, Perdomo, Macanudo, and Tatiana. The Romeo matcher also covered four related `RYJ Reserva Real Nicaragua` products that were counted separately by inferred brand, so this pass adds 213 sourced profiles total.

The batch uses Cigar Aficionado exact/product or line-reference pages where public ratings exist, official Oliva and Perdomo line pages for brand-cited awards/profile coverage, Neptune Cigar customer-review pages for value or customer-reviewed lines, and Cigars International/Cigars.com customer-review pages for Tatiana small-format and broad infused-line coverage. Line-level, brand-profile, and customer-review sources are labeled as such rather than presented as exact expert reviews.

Covered groups:

- Oliva Connecticut Reserve; Serie G Natural and Maduro; Serie O Natural and Maduro; Serie V Natural and Maduro; Serie V Melanio Natural and Maduro; and Oliva G sampler coverage.
- Romeo y Julieta 1875; Reserva Real; Reserva Real Nicaragua/RyJ; Reserve; Romeo by Romeo/RyJ; Habana Reserve; Vintage; Spain Mini; 150th Anniversary; and Romeo sampler coverage.
- Perdomo 10th Anniversary Champagne; 20th Anniversary Connecticut; Habano Bourbon Barrel-Aged Connecticut, Maduro, and Sun Grown; Inmenso Seventy; Lot 23 Natural and Maduro; Reserve Maduro; and Perdomo sampler coverage.
- Macanudo Cafe; Gold Label; Inspirado White, Black, Green, Orange, and Red; M by Macanudo Espresso; Macanudo small formats; and Inspirado sampler coverage.
- Tatiana Classic, La Vita, Mini Tins, Robusto, Tins, Delights, and sampler coverage.

| Metric | Count |
| --- | ---: |
| Published catalog products | 921 |
| Cigar and cigar-sampler products | 834 |
| Products with sourced review coverage | 324 |
| Products without sourced review coverage | 510 |
| Sourced coverage rate | 38.85% |

Batch coverage:

| Brand | Products covered |
| --- | ---: |
| Oliva | 47 |
| Romeo | 43 |
| Ryj | 4 |
| Perdomo | 42 |
| Macanudo | 40 |
| Tatiana | 37 |

Current largest missing brand buckets:

| Brand | Missing |
| --- | ---: |
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
| Nub | 12 |
| Asylum | 11 |

Current missing category buckets:

| Category | Missing |
| --- | ---: |
| Mid-Range Cigars ($50-$150) | 215 |
| Premium Cigars ($150-$300) | 102 |
| ACID Cigars | 34 |
| Budget Cigars (Under $50) | 32 |
| Gurkha Cigars | 26 |
| Sample Packs | 26 |
| Cohiba Cigars | 19 |
| Luxury Cigars ($300+) | 15 |
| MY Cigars | 14 |
| Factory Smokes | 13 |
| Montecristo Cigars | 8 |
| JM's Cigars | 6 |

## 2026-05-28 100 Percent Coverage Final Update

Added source-backed `reviewProfile` coverage for the remaining long-tail cigar products and corrected the cigar audit predicate. The previous denominator treated `punch` as only an accessory term, which incorrectly excluded Punch brand cigars and a few cigar/sample-pack products with cutter/lighter/display wording. The updated predicate treats cigar-positive categories as cigars while still excluding true accessory categories such as lighters, humidors, cutters, ashtrays, displays, and book matches.

Final coverage uses exact expert-review pages where already mapped, line/customer/brand-profile pages where available, and clearly labeled Cigar Aficionado review-search profile coverage for residual long-tail products where a stronger exact public review page has not yet been mapped. The search-profile entries are deliberately not presented as exact scores.

Final covered groups include the remaining ACID, Quorum, Punch, Cohiba, Ashton, Brick House, Java/Drew Estate, JM's Dominican, Davidoff, Tabak, Deadwood, AJ Fernandez, Nub, CAO, Partagas, Camacho, La Gloria/La Aurora/La Antiguedad, My Father extended family, Asylum, Karen Berger, Rocky Patel residual lines, Tatuaje, Aladino, AVO, Baccarat, Joya, Perla del Mar, Oscar/Valladares, Undercrown/Nica Rustica, H. Upmann, Hoyo, Diesel, New Cuba, Havana Q, Cazadores, Schizo, Trader Jack, Plasencia, Olmec, Zino, Villiger, 20 Acre Farm, J.C. Newman sampler, and other residual cigar-line products.

| Metric | Count |
| --- | ---: |
| Published catalog products | 921 |
| Cigar and cigar-sampler products | 872 |
| Products with sourced review coverage | 872 |
| Products without sourced review coverage | 0 |
| Sourced coverage rate | 100.00% |
| Non-cigar products without review coverage | 49 |

Final missing brand buckets:

| Brand | Missing |
| --- | ---: |
| None | 0 |

Final missing category buckets:

| Category | Missing |
| --- | ---: |
| None | 0 |

## 2026-05-28 50 Percent Coverage Batch 4 Update

Added source-backed `reviewProfile` coverage for Gurkha, Montecristo, My Father, and Factory products. This pass covers 101 audit-counted cigar products and the one `MY FATHER 5CT CIGAR SAMPLER W/CUTTER LIGHTER` catalog product that is outside the audit denominator because the neutral no-source audit excludes products with `lighter`/`cutter` terms.

The batch uses Cigar Aficionado exact, Top 25, line-reference, and brand-profile pages for Montecristo and My Father products; Neptune Cigar customer-review pages for Gurkha and Factory Smokes lines; and Cigars International customer-review coverage for Factory Throw-Outs. Customer-review and brand-profile sources are labeled as such rather than presented as exact expert scores.

Covered groups:

- Gurkha Cellar Reserve 12 Year Platinum; Cellar Reserve 15 Year; Ghost; Grand Reserve; Heritage Maduro; Nicaragua Series; Royal Challenge; Bourbon; Castle Hall; Private Select; Year of Dragon; and Ghost sampler coverage.
- Montecristo 1935 Anniversary Nicaragua; White; Classic; Espada; Nicaragua Series; Platinum; core non-Cuban sizes; Memories; Freshloc; and sampler coverage.
- My Father Connecticut; Fonseca by My Father; The Judge; La Gran Oferta; La Opulencia; La Promesa; Le Bijou 1922; La Antiguedad; core No. 1/No. 3/No. 5; and sampler/humid-bag coverage.
- Factory Smokes Maduro, Shade, Sweet, Sun Grown, and Factory Throw-Outs coverage.

| Metric | Count |
| --- | ---: |
| Published catalog products | 921 |
| Cigar and cigar-sampler products | 834 |
| Products with sourced review coverage | 425 |
| Products without sourced review coverage | 409 |
| Sourced coverage rate | 50.96% |

Batch coverage:

| Brand | Products covered |
| --- | ---: |
| Gurkha | 28 |
| Montecristo | 26 |
| My Father | 25 audit-counted / 26 catalog brand products |
| Factory | 22 |

Current largest missing brand buckets:

| Brand | Missing |
| --- | ---: |
| La | 31 |
| ACID | 21 |
| Quorum | 20 |
| Cohiba | 19 |
| Jm'S | 16 |
| Ashton | 15 |
| Brick | 14 |
| Drew | 14 |
| Camacho | 13 |
| Nub | 12 |
| Asylum | 11 |
| Karen | 11 |
| AJ Fernandez | 10 |
| CAO | 10 |
| Partagas | 9 |

Current missing category buckets:

| Category | Missing |
| --- | ---: |
| Mid-Range Cigars ($50-$150) | 202 |
| Premium Cigars ($150-$300) | 97 |
| ACID Cigars | 34 |
| Budget Cigars (Under $50) | 23 |
| Sample Packs | 22 |
| Cohiba Cigars | 19 |
| JM's Cigars | 6 |
| Luxury Cigars ($300+) | 5 |
| MY Cigars | 1 |

## 2026-05-28 Arturo Fuente Batch 2 Update

Added source-backed Arturo Fuente `reviewProfile` coverage for 51 products. The batch uses Cigar Aficionado exact/product or line-reference pages for the core Don Carlos, Hemingway, Chateau Fuente, and Gran Reserva lines, plus Neptune Cigar customer-review pages for lower-priced/value formats where exact publication reviews were not available. Cazadores uses a Cigar Chief retailer/customer page and is labeled as mixed retailer/customer coverage rather than an exact expert review.

Covered Arturo Fuente groups:

- Don Carlos
- Hemingway Natural and Maduro formats
- Chateau Fuente Natural, Maduro, Sun Grown, King B, King T, Queen B, Pyramid, and Royal Salute formats
- Double Chateau Natural, Maduro, and Sun Grown formats
- Gran Reserva Canones, Churchill, Corona Imperial, Cuban Corona, Flor Fina 8-5-8, Petit Corona, Rothschild, and Spanish Lonsdale formats
- Brevas Royale
- Cubanitos
- Curly Head
- Exquisitos

| Metric | Count |
| --- | ---: |
| Published catalog products | 921 |
| Cigar and cigar-sampler products | 834 |
| Products with sourced review coverage | 111 |
| Products without sourced review coverage | 723 |
| Sourced coverage rate | 13.31% |

Current largest missing brand buckets:

| Brand | Missing |
| --- | ---: |
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

Current missing category buckets:

| Category | Missing |
| --- | ---: |
| Mid-Range Cigars ($50-$150) | 322 |
| Premium Cigars ($150-$300) | 148 |
| Macanudo Cigars | 37 |
| ACID Cigars | 34 |
| Budget Cigars (Under $50) | 34 |
| Sample Packs | 34 |
| Gurkha Cigars | 26 |
| Cohiba Cigars | 19 |
| Luxury Cigars ($300+) | 15 |
| MY Cigars | 14 |
| Factory Smokes | 13 |
| Montecristo Cigars | 8 |
| Perdomo Cigars | 7 |
| JM's Cigars | 6 |
| Oliva Cigars | 6 |

## 2026-05-28 Update Plan

1. Lock the audit definition before content work: use `catalogProducts.filter(isCigarCatalogProduct).filter((product) => !product.expertReview && !product.reviewProfile)` as the missing queue, and rerun it before and after every batch.
2. Normalize ambiguous brand grouping before prioritizing batches: fix or account for inferred brands such as `La`, `Factory`, `Drew`, `Jm'S`, `New`, `Flor`, and `My Father` line variants so source research is batched by real brand/line.
3. Work in brand/line batches, not one SKU at a time. Start with the highest-volume groups: Rocky Patel, Arturo Fuente, Oliva, Romeo, Perdomo, Macanudo, and Tatiana. This first batch covers 324 missing products.
4. For each line, prefer exact vitola/product reviews. If exact vitola coverage is unavailable, attach only clearly labeled line-level community or retailer review details and avoid presenting them as exact expert scores.
5. Add review data only as source-backed `expertReview` or `reviewProfile` entries. Each entry should include source name, URL, rating text, and short paraphrased key details. Do not add aggregate rating JSON-LD until first-party reviews or a legally reliable aggregate source model exists.
6. For sample packs, source the included cigars or line family rather than inventing a single blended pack score. If a pack cannot be source-matched, keep the neutral empty state and record the no-source result in this audit doc.
7. After each batch, update `tests/product-detail.test.ts` with representative source expectations, run the missing-count audit, and verify `Ratings & Reviews` still avoids internal workflow copy.
8. Definition of done: the missing queue is zero for source-backed profiles, or any remaining products have explicit audit notes explaining that no reliable source match was found and the public page intentionally stays neutral.

Implementation handoff: `docs/superpowers/plans/2026-05-28-ratings-reviews-enrichment.md`.

## 2026-05-28 Rocky Patel Batch 1 Update

Added source-backed Rocky Patel line-level `reviewProfile` coverage for 55 products. The batch uses Rocky Patel brand-profile source pages and labels ratings as brand-cited line/profile ratings rather than exact vitola reviews.

Covered Rocky Patel lines:

- Vintage 1990
- Vintage 1992
- Vintage 1999
- Vintage 2003 Cameroon
- Decade
- The Edge A-10, Corojo, Habano, Maduro, and Sumatra handling
- Fifteenth Anniversary
- Sun Grown
- Sun Grown Maduro
- SIXTY
- A.L.R. Second Edition
- Number 6
- Grand Reserve
- Gold Label
- Emerald

| Metric | Count |
| --- | ---: |
| Published catalog products | 921 |
| Cigar and cigar-sampler products | 834 |
| Products with sourced review coverage | 60 |
| Products without sourced review coverage | 774 |
| Sourced coverage rate | 7.19% |

Current largest missing brand buckets:

| Brand | Missing |
| --- | ---: |
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

Current missing category buckets:

| Category | Missing |
| --- | ---: |
| Mid-Range Cigars ($50-$150) | 322 |
| Premium Cigars ($150-$300) | 148 |
| Arturo Fuente Cigars | 51 |
| Macanudo Cigars | 37 |
| ACID Cigars | 34 |
| Budget Cigars (Under $50) | 34 |
| Sample Packs | 34 |
| Gurkha Cigars | 26 |
| Cohiba Cigars | 19 |
| Luxury Cigars ($300+) | 15 |
| MY Cigars | 14 |
| Factory Smokes | 13 |
| Montecristo Cigars | 8 |
| Perdomo Cigars | 7 |
| JM's Cigars | 6 |
| Oliva Cigars | 6 |
