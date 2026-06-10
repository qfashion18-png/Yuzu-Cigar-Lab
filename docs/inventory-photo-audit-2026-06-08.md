# Inventory Photo Audit - 2026-06-08

Purpose: audit the shop catalog against the 11 shelf photos provided on 2026-06-08 because visible inventory is missing from the storefront.

## Source Photos

- Image #1: `C:/Users/qfash/Downloads/IMG_2764.jpeg`
- Image #2: `C:/Users/qfash/Downloads/IMG_2760.jpeg`
- Image #3: `C:/Users/qfash/Downloads/IMG_2769.jpeg`
- Image #4: `C:/Users/qfash/Downloads/IMG_2774.jpeg`
- Image #5: `C:/Users/qfash/Downloads/IMG_2768.jpeg`
- Image #6: `C:/Users/qfash/Downloads/IMG_2766.jpeg`
- Image #7: `C:/Users/qfash/Downloads/IMG_2776.jpeg`
- Image #8: `C:/Users/qfash/Downloads/IMG_2772.jpeg`
- Image #9: `C:/Users/qfash/Downloads/IMG_2771 (1).jpeg`
- Image #10: `C:/Users/qfash/Downloads/IMG_2773.jpeg`
- Image #11: `C:/Users/qfash/Downloads/IMG_2775.jpeg`

## Summary

- Raw imported inventory currently has 1,154 rows.
- Published catalog/storefront currently has 932 products.
- This photo audit found 27 visible or photo-adjacent raw inventory rows that are not published in the shop.
- All 27 audited rows have no entry in `src/lib/imported-market-prices.ts`, so `src/lib/catalog.ts` filters them out before storefront generation.
- Three of the missing rows still use placeholder SKUs and need POS/Sunset SKU reconciliation before they should be published as final products.

## Publish Blocker

The missing items are not absent from the raw import. They are being held back by the publish gate:

- `src/lib/catalog.ts` builds `publishedImportedInventory` through `getPublishedImportedInventory(importedInventory)`.
- `isPublishableImportedInventoryItem` requires a positive market price from `src/lib/imported-market-prices.ts`.
- The audited rows below all returned `market=NO_MARKET` and `published=NO`.

## Missing Or Hidden Items

| Photos | Confidence | SKU | Product | Shelf/raw price | Current blocker | Notes |
|---|---:|---|---|---:|---|---|
| #1, #2 | Medium | `113887` | FLOR DE LAS ANTILLAS TORO 20/BX | $122 | Missing market price | Toro boxes visible; shelf tag for this exact raw row is not cleanly visible. |
| #1, #2 | Medium | `113886` | FLOR DE LAS ANTILLAS ROBUSTO 20/BX | $145 | Missing market price | Robusto boxes visible; shelf tag for this exact raw row is not cleanly visible. |
| #2 | High | `777146` | MY FATHER BLUE PETIT ROBUSTO 20/BX | $124 | Missing market price | Shelf tag and blue boxes visible. |
| #2 | High | `777147` | MY FATHER BLUE ROBUSTO 20/BX | $143 | Missing market price | Shelf tag and blue boxes visible. |
| #2 | High | `777148` | MY FATHER BLUE TORO 20/BX | $163 | Missing market price | Shelf tag and blue boxes visible. |
| #2 | High | `777149` | MY FATHER BLUE TORO GORDO 20/BX | $176 | Missing market price | Shelf tag and blue boxes visible. |
| #2 | High | `572685` | FONSECA MX EDITION ROBUSTO 20/BX | $155 | Missing market price | Green Mexico Edition Robustos boxes visible. |
| #2 | Medium | `572686` | FONSECA MX EDITION TORO 20/BX | $170 | Missing market price | Same Mexico Edition shelf family visible; exact tag is cropped/partially obscured. |
| #3, #5 | High | `777199` | NICA RUSTICA CONNECTICUT SHORT ROBUSTO 25/BX | $132 | Missing market price | Shelf tag and black/orange box stack visible. |
| #3, #5 | High | `572409` | NICA RUSTICA ADOBE TORO 25/BX | $145 | Missing market price | Shelf tag and black/blue Adobe boxes visible. |
| #3, #5 | High | `572410` | NICA RUSTICA ADOBE GORDO 25/BX | $150 | Missing market price | Shelf tag and box stack visible. |
| #3, #5 | High | `572356` | NICA RUSTICA TORO 25/BX | $146 | Missing market price | Shelf tag and black/orange Toro boxes visible. |
| #3, #5 | High | `MISSING-SKU-NICA-RUSTICA-GORDO` | NICA RUSTICA GORDO 25/BX | $152 | Placeholder SKU plus missing market price | Replace placeholder with real SKU before publish. |
| #5 | High | `MISSING-SKU-UNDERCROWN-SHADE-GORDITO` | UNDERCROWN SHADE GORDITO | $175 | Placeholder SKU plus missing market price | Replace placeholder with real SKU before publish. |
| #5 | High | `572493` | LIGA UNDERCROWN SHADE ROBUSTO 25/BX | $156 | Missing market price | Shelf tag and Undercrown Shade boxes visible. |
| #5 | High | `572429` | UNDERCROWN MADURO ROBUSTO 25/BX | $168 | Missing market price | Shelf tag and blue/brown Undercrown Maduro boxes visible. |
| #5 | High | `MISSING-SKU-UNDERCROWN-MADURO-TORO` | UNDERCROWN MADURO TORO | $172 | Placeholder SKU plus missing market price | Replace placeholder with real SKU before publish. |
| #3, #6 | High | `572749` | DEADWOOD DIA DE LOS MUERTOS 20/BX | $180 | Missing market price | Red held box and shelf area visible. |
| #3 | High | `572753` | DEADWOOD GIRL WITH NO NAME LONSDALE 20/BX | $160 | Missing market price | Shelf tag and burgundy boxes visible. |
| #8, #10 | High | `777141` | DEADWOOD DOMINICANA GORDO 10/BX | $87 | Missing market price | Shelf tag visible on display table. |
| #8, #10 | High | `777229` | AGING ROOM NICARAGUA SONATA MAESTRO 10/BX | $107 | Missing market price | Yellow boxes and shelf tag visible. |
| #8, #10 | High | `572305` | AGING ROOM QUATTRO NICARAGUA MAESTRO 10/BX | $107 | Missing market price | Orange boxes and shelf tag visible. |
| #8, #10 | High | `777230` | AGING ROOM NICARAGUA CONCERTO MAESTRO 10/BX | $107 | Missing market price | Blue boxes and shelf tag visible. |
| #8, #10 | High | `777242` | CAO FLATHEAD SPEED SHOP V554 24/BX | $130 | Missing market price | White box stack and shelf tag visible. |
| #8, #10 | High | `777243` | CAO FLATHEAD SPEED SHOP V660 24/BX | $144 | Missing market price | White box stack and shelf tag visible. |
| #4, #7, #11 | High | `572744` | LIGA PRIVADA H99 PAPAS FRITAS 10/BX | $128 | Missing market price | Shelf tag and held box visible. |
| #4, #7, #11 | High | `572745` | LIGA PRIVADA H99 PAPAS FRITAS 10/BX - ALTERNATE VARIANT | $137 | Missing market price | Adjacent shelf tag visible; confirm whether this should be a separate sellable variant. |

## Already Present In Shop

These visible photo items are published already and should not be treated as missing from the storefront:

- Flor de Las Antillas Sungrown Robusto `11366`, Sungrown Toro `7702`, Sungrown Toro Gordo `11367`, Maduro Toro `13216`, Maduro Torpedo `17141`, and Toro Grande `15391`.
- My Father La Promesa Toro `41451` and Lancero `41575`.
- My Father Judge Corona Gorda `93107`, Grand Robusto `13312`, Judge Toro `13313`, and The Judge Toro `777111`.
- Undercrown Maduro Gran Toro `5364`, Undercrown Robusto Maduro `5365`, Undercrown Shade Gran Toro `13766`, Undercrown UC10 Robusto `572421`, Undercrown UC10 Toro `572422`, Undercrown Shade Fresh Pack `572358`, and Undercrown Maduro Fresh Pack `572359`.
- Deadwood Sweet Jane `21882`, Sweet Jane Tins `25005`, Leather Rose `93156`, Fat Bottom Betty `22611`, Dominicana Toro `777140`, and the Noches Robusto/Toro/Gordo rows.
- Nica Rustica Connecticut Toro `777200`, Connecticut Gordo `777201`, Adobe Robusto `572408`, and Short Robusto `572355`.

## Follow-Up Checks

- Image #9 has several Drew Estate top-shelf boxes that are too blurry to reconcile confidently from the current photo. Deadwood Sweet Jane and Leather Rose in that photo are already published.
- My Father Judge Grand Robusto and Judge Toro are published, but the photo tags appear lower than raw imported prices for `13312` and `13313`. If the shelf photo is current, review those prices separately from the missing-inventory fix.
- Confirm whether shelf/raw price is acceptable as the non-member market price for these hidden rows. If yes, add market prices to `src/lib/imported-market-prices.ts`; if not, add verified external market prices.
- Replace placeholder SKUs before publishing `MISSING-SKU-NICA-RUSTICA-GORDO`, `MISSING-SKU-UNDERCROWN-SHADE-GORDITO`, and `MISSING-SKU-UNDERCROWN-MADURO-TORO`.
- After market-price/SKU fixes, rerun a catalog publish query and then the normal project checks.

## Verification Commands Run

- Catalog/raw count query: raw inventory `1154`, catalog products `932`, storefront products `932`.
- Candidate publish query: 27 audited candidates, 27 unpublished, all 27 with `NO_MARKET`.
