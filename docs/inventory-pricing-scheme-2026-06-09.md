# Inventory Pricing Scheme Update - 2026-06-09

Purpose: apply the existing Yuzu catalog pricing scheme to the real-SKU items from the 2026-06-08 photo inventory audit after the first publish fix used temporary public prices equal to member/source prices.

## Pricing Rule Applied

- `src/lib/imported-inventory.ts` `price` remains the member/current source price.
- `src/lib/imported-market-prices.ts` stores the explicit public/non-member market price.
- Published cigar rows must have `nonMemberPrice >= memberPrice`.
- Placeholder-SKU rows remain unpublished until real POS/Sunset SKUs are reconciled.

## Updated Real-SKU Rows

| SKU | Product | Member/source price | Public/non-member price | Public price source |
| --- | --- | ---: | ---: | --- |
| `113887` | FLOR DE LAS ANTILLAS TORO 20/BX | $122.00 | $161.95 | Cigar Country Flor de las Antillas Toro box of 20: https://cigarcountry.com/brand/my-father-cigars/flor-de-las-antillas/ |
| `113886` | FLOR DE LAS ANTILLAS ROBUSTO 20/BX | $145.00 | $155.95 | Cigar Country Flor de las Antillas Robusto box of 20: https://cigarcountry.com/brand/my-father-cigars/flor-de-las-antillas/ |
| `777146` | MY FATHER BLUE PETIT ROBUSTO 20/BX | $124.00 | $180.00 | Halfwheel My Father Blue release pricing, Petit Robusto box of 20: https://halfwheel.com/my-father-blue-the-garcias-first-honduran-cigar-heads-to-stores/452929/ |
| `777147` | MY FATHER BLUE ROBUSTO 20/BX | $143.00 | $210.00 | Halfwheel My Father Blue release pricing, Robusto box of 20: https://halfwheel.com/my-father-blue-the-garcias-first-honduran-cigar-heads-to-stores/452929/ |
| `777148` | MY FATHER BLUE TORO 20/BX | $163.00 | $240.00 | Halfwheel My Father Blue release pricing, Toro box of 20: https://halfwheel.com/my-father-blue-the-garcias-first-honduran-cigar-heads-to-stores/452929/ |
| `777149` | MY FATHER BLUE TORO GORDO 20/BX | $176.00 | $260.00 | Halfwheel My Father Blue release pricing, Toro Gordo box of 20: https://halfwheel.com/my-father-blue-the-garcias-first-honduran-cigar-heads-to-stores/452929/ |
| `572685` | FONSECA MX EDITION ROBUSTO 20/BX | $155.00 | $164.95 | CigarPlace Fonseca Mexico Edition Robusto box of 20: https://www.cigarplace.biz/all-brands/fonseca-cigars/fonseca-mexico-edition.html |
| `572686` | FONSECA MX EDITION TORO 20/BX | $170.00 | $187.95 | CigarPlace Fonseca Mexico Edition Cedros 6 1/4 x 52 box of 20, matching the internal toro-format description: https://www.cigarplace.biz/all-brands/fonseca-cigars/fonseca-mexico-edition.html |
| `572409` | NICA RUSTICA ADOBE TORO 25/BX | $145.00 | $172.99 | JR Cigars Nica Rustica Adobe Toro box of 25: https://www.jrcigars.com/cigars/handmade-cigars/drew-estate-cigars/nica-rustica-adobe/ |
| `572410` | NICA RUSTICA ADOBE GORDO 25/BX | $150.00 | $178.99 | JR Cigars Nica Rustica Adobe Gordo box of 25: https://www.jrcigars.com/cigars/handmade-cigars/drew-estate-cigars/nica-rustica-adobe/ |
| `572356` | NICA RUSTICA TORO 25/BX | $146.00 | $171.99 | Famous Smoke Nica Rustica El Brujito Toro box of 25: https://www.famous-smoke.com/brands/drew-estate-cigars/nica-rustica |
| `777199` | NICA RUSTICA CONNECTICUT SHORT ROBUSTO 25/BX | $132.00 | $152.99 | Famous Smoke Nica Rustica short robusto/shade short robusto box of 25 public price: https://www.famous-smoke.com/brands/drew-estate-cigars/nica-rustica |
| `572493` | LIGA UNDERCROWN SHADE ROBUSTO 25/BX | $156.00 | $208.95 | Cigar Country Undercrown Shade Robusto box of 25: https://cigarcountry.com/product/undercrown-shade-robusto/ |
| `572429` | UNDERCROWN MADURO ROBUSTO 25/BX | $168.00 | $208.95 | Cigar Country Undercrown Maduro Robusto box of 25: https://cigarcountry.com/brand/drew-estate/undercrown-cigars/ |
| `572749` | DEADWOOD DIA DE LOS MUERTOS 20/BX | $180.00 | $229.50 | Cigars Direct Deadwood Dia de los Muertos Toro box of 20: https://www.cigarsdirect.com/products/drew-estate-deadwood-dia-de-los-muertos |
| `572753` | DEADWOOD GIRL WITH NO NAME LONSDALE 20/BX | $160.00 | $192.99 | JR Cigars Deadwood Girl With No Name Lonsdale box of 20: https://www.jrcigars.com/item/deadwood-tobacco-co.-by-drew-estate-girl-with-no-name/lonsdale/DWGWNNL.html |
| `777141` | DEADWOOD DOMINICANA GORDO 10/BX | $87.00 | $111.99 | JR Cigars Deadwood Dominicana Gordo box of 10: https://www.jrcigars.com/item/deadwood-dominicana/gordo/DWDG.html |
| `777229` | AGING ROOM NICARAGUA SONATA MAESTRO 10/BX | $107.00 | $139.99 | Casa de Montecristo/Aging Room Quattro Nicaragua Sonata Maestro box of 10: https://www.casademontecristo.com/item/aging-room-quattro-nicaragua-sonata/maestro/ARQNSMT.html |
| `572305` | AGING ROOM QUATTRO NICARAGUA MAESTRO 10/BX | $107.00 | $134.99 | JR Cigars Aging Room Quattro Nicaragua Maestro box of 10: https://www.jrcigars.com/cigars/handmade-cigars/aging-room-cigars/aging-room-quattro-nicaragua-by-rafael-nodal/ |
| `777230` | AGING ROOM NICARAGUA CONCERTO MAESTRO 10/BX | $107.00 | $134.99 | Cigars International Aging Room Quattro Nicaragua Concerto Maestro box of 10: https://www.cigarsinternational.com/product/aging-room-quattro-nicaragua-concerto/BA4-PM.html |
| `777242` | CAO FLATHEAD SPEED SHOP V554 24/BX | $130.00 | $168.99 | JR Cigars CAO Flathead Speed Shop V654 Crankshaft box of 24; internal row appears to use `V554` where source/catalog sizing points to V654: https://www.jrcigars.com/cigars/handmade-cigars/cao-cigars/cao-flathead-speed-shop/ |
| `777243` | CAO FLATHEAD SPEED SHOP V660 24/BX | $144.00 | $191.99 | CIGAR.com CAO Flathead Speed Shop V660 box of 24: https://www.cigar.com/product/ccom/FSS-PM.html |
| `572744` | LIGA PRIVADA H99 PAPAS FRITAS 10/BX | $128.00 | $168.60 | Cigars Direct Liga Privada H99 Papas Fritas box price; internal pack count should be checked against POS copy because public retail sources list this as a 25-count box: https://www.cigarsdirect.com/products/drew-estate-liga-privada-h99-papas-fritas |
| `572745` | LIGA PRIVADA H99 PAPAS FRITAS 10/BX - ALTERNATE VARIANT | $137.00 | $168.60 | Same Cigars Direct Liga Privada H99 Papas Fritas box price used for the alternate visible inventory SKU: https://www.cigarsdirect.com/products/drew-estate-liga-privada-h99-papas-fritas |

## Items Still Not Published

These rows were not assigned prices because they still need real internal SKU reconciliation:

- `MISSING-SKU-NICA-RUSTICA-GORDO`
- `MISSING-SKU-UNDERCROWN-SHADE-GORDITO`
- `MISSING-SKU-UNDERCROWN-MADURO-TORO`

## Verification

- `tests/product-detail.test.ts` now asserts the audited real-SKU restock rows keep member/source price in `price` and `memberPrice`, while `marketPrice` and `nonMemberPrice` use the researched public price.
- `tests/product-pricing.test.ts` now has a focused regression for the 24 real audited restock SKUs and fails if public pricing slips back to member-cost fallback.
