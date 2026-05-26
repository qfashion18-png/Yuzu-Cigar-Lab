# Price Scheme Audit - 2026-05-26

## Scope

Audited the full imported inventory pricing path:

- `src/lib/imported-inventory.ts` supplier/current member prices.
- `src/lib/imported-market-prices.ts` public market/non-member prices.
- `src/lib/catalog-pricing.ts` price calculation.
- `src/lib/catalog.ts` publishability and storefront projection.
- Product, category, and commerce tests that assert storefront catalog shape.

## Pricing Rules Confirmed

- Cigar box and sampler rows: `importedInventory.price` is member/current cost, and an explicit `importedMarketPricesBySku[sku]` value is required for the public/non-member price.
- Butane and lighter-fluid rows: public/non-member price equals the researched retailer price; member price is 10% below that researched price.
- Requested lighter rows: public price must remain at least 30% below the researched retailer reference while still not undercutting member price.
- No published item may have `nonMemberPrice < memberPrice`.
- No published item may silently fall back to `memberPrice` as the public price just because a market price is missing.

## Audit Result

| Check | Result |
| --- | ---: |
| Imported inventory rows | 1146 |
| Published catalog rows after fix | 921 |
| Published rows missing explicit public market price after fix | 0 |
| Explicit market prices below member/current price | 0 |
| Inventory rows missing public market price | 58 |
| Missing-price rows with non-positive source price | 14 |
| Missing-price rows now held unpublished or otherwise excluded | 44 |
| Duplicate SKU groups in imported inventory | 20 |

## Incorrect Published Rows Found

Before the fix, these 40 rows were published with public/non-member price equal to member/current price because no explicit public market price existed. They are now held out of `catalogProducts` until researched public market pricing is added.

| SKU | Member/current | Product |
| --- | ---: | --- |
| 29177 | 69 | DEADWOOD CRAZY ALICE 10/BX |
| 67529 | 37.65 | OLD MAN RED HABANO CIGARS |
| 67530 | 37.65 | OLD MAN BLACK HABANO CIGARS |
| 67531 | 37.65 | OLD MAN NATURAL HABANO CIGARS |
| 777275 | 77 | DEADWOOD DOMINICANA NOCHES ROBUSTO 10/BX |
| 777276 | 81 | DEADWOOD DOMINICANA NOCHES TORO 10/BX |
| 777277 | 87 | DEADWOOD DOMINICANA NOCHES GORDO 10/BX |
| 777278 | 137 | OLIVA SERIE V MELANIO MADURO DBL TORO 10/BX |
| 777279 | 175 | H UPMANN NICARAGUA SUNRISE ROBUSTO 20/BOX |
| 777280 | 195 | H UPMANN NICARAGUA SUNRISE TORO 20/BX |
| 777281 | 205 | H UPMANN NICARAGUA SUNRISE MAGNUM 20/BX |
| 777287 | 75 | PLASENCIA EXPLORER SAMPLER 6/BX |
| 777292 | 450 | OLIVA SERIE V MELANIO SOCCER EDITION 24/BX |
| 777146 | 124 | MY FATHER BLUE PETIT ROBUSTO 20/BX |
| 777147 | 143 | MY FATHER BLUE ROBUSTO 20/BX |
| 777148 | 163 | MY FATHER BLUE TORO 20/BX |
| 777149 | 176 | MY FATHER BLUE TORO GORDO 20/BX |
| 113887 | 122 | FLOR DE LAS ANTILLAS TORO 20/BX |
| 113886 | 145 | FLOR DE LAS ANTILLAS ROBUSTO 20/BX |
| 572685 | 155 | FONSECA MX EDITION ROBUSTO 20/BX |
| 572686 | 170 | FONSECA MX EDITION TORO 20/BX |
| 572409 | 145 | NICA RUSTICA ADOBE TORO 25/BX |
| 572410 | 150 | NICA RUSTICA ADOBE GORDO 25/BX |
| 572356 | 146 | NICA RUSTICA TORO 25/BX |
| MISSING-SKU-NICA-RUSTICA-GORDO | 152 | NICA RUSTICA GORDO 25/BX |
| 777199 | 132 | NICA RUSTICA CONNECTICUT SHORT ROBUSTO 25/BX |
| MISSING-SKU-UNDERCROWN-SHADE-GORDITO | 175 | UNDERCROWN SHADE GORDITO |
| 572493 | 156 | LIGA UNDERCROWN SHADE ROBUSTO 25/BX |
| 572429 | 168 | UNDERCROWN MADURO ROBUSTO 25/BX |
| MISSING-SKU-UNDERCROWN-MADURO-TORO | 172 | UNDERCROWN MADURO TORO |
| 572749 | 180 | DEADWOOD DIA DE LOS MUERTOS 20/BX |
| 572753 | 160 | DEADWOOD GIRL WITH NO NAME LONSDALE 20/BX |
| 777229 | 107 | AGING ROOM NICARAGUA SONATA MAESTRO 10/BX |
| 572305 | 107 | AGING ROOM QUATTRO NICARAGUA MAESTRO 10/BX |
| 777230 | 107 | AGING ROOM NICARAGUA CONCERTO MAESTRO 10/BX |
| 777242 | 130 | CAO FLATHEAD SPEED SHOP V554 24/BX |
| 777243 | 144 | CAO FLATHEAD SPEED SHOP V660 24/BX |
| 777141 | 87 | DEADWOOD DOMINICANA GORDO 10/BX |
| 572744 | 128 | LIGA PRIVADA H99 PAPAS FRITAS 10/BX |
| 572745 | 137 | LIGA PRIVADA H99 PAPAS FRITAS 10/BX - ALTERNATE VARIANT |

## Fix Applied

- `src/lib/catalog.ts` now requires a finite, positive explicit public market price before a row can publish.
- `tests/product-pricing.test.ts` now fails if any published catalog row uses member-cost fallback as public market pricing.
- `tests/product-detail.test.ts` now expects price-pending cigar rows to remain unpublished until public market prices are researched.
- `tests/commerce-schema.test.ts` now reflects the audited 921-row public catalog scale.

## Verification

- Red regression before fix: `node --import tsx --test --test-name-pattern "explicit public market pricing" tests/product-pricing.test.ts` failed with the 40 fallback-priced SKUs.
- Green focused verification: `node --import tsx --test tests/product-pricing.test.ts tests/product-detail.test.ts tests/commerce-schema.test.ts tests/shop-categories.test.ts`.
- Type check: `npx tsc --noEmit`.

## Follow-Up Queue

Research explicit public/non-member market prices for the 40 held rows before republishing them. Do not invent public prices; add sourced values to `src/lib/imported-market-prices.ts`, then rerun the pricing and product-detail suites.
