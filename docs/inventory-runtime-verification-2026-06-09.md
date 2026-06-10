# Inventory Runtime Verification - 2026-06-09

Purpose: verify why the inventory updates from the 2026-06-08 shelf audit are not visible on the real website runtime.

## Result

The user report is correct: the audited inventory rows are not live as shop products.

- Checked the 27 missing/hidden items from `docs/inventory-photo-audit-2026-06-08.md`.
- `src/lib/imported-market-prices.ts` still has no market-price entries for all 27 audited SKUs/placeholders.
- The fresh local static export has 0 generated product pages for those 27 slugs.
- The live `https://www.yuzucigarclub.com/shop/{slug}/` URLs returned HTTP `404` for all 27 checked slugs.
- The deployed box image assets are live and returning HTTP `200`, but image files alone do not publish products.

## Confirmed Live Asset Checks

These image files are deployed and reachable:

- `https://www.yuzucigarclub.com/assets/inventory/cigars/fonseca-mx-edition-robusto-20-bx.jpg` -> HTTP `200`, `Content-Length: 134153`
- `https://www.yuzucigarclub.com/assets/inventory/cigars/nica-rustica-adobe-toro-25-bx.jpg` -> HTTP `200`, `Content-Length: 162599`
- `https://www.yuzucigarclub.com/assets/inventory/cigars/liga-undercrown-shade-robusto-25-bx.jpg` -> HTTP `200`, `Content-Length: 83256`
- `https://www.yuzucigarclub.com/assets/inventory/cigars/aging-room-quattro-nicaragua-maestro-10-bx.jpg` -> HTTP `200`, `Content-Length: 106851`

## Confirmed Product Page Checks

Sample live product URLs checked:

- `https://www.yuzucigarclub.com/shop/fonseca-mx-edition-robusto-20-bx/` -> HTTP `404`
- `https://www.yuzucigarclub.com/shop/nica-rustica-adobe-toro-25-bx/` -> HTTP `404`
- `https://www.yuzucigarclub.com/shop/liga-undercrown-shade-robusto-25-bx/` -> HTTP `404`
- `https://www.yuzucigarclub.com/shop/aging-room-quattro-nicaragua-maestro-10-bx/` -> HTTP `404`

Full 27-row check summary:

- Checked: 27
- Market-price entries present: 0
- Local generated product pages present in `out/shop/`: 0
- Live product URLs returning HTTP `200`: 0
- Live product URLs returning HTTP `404`: 27

## Root Cause

The audited rows exist in `src/lib/imported-inventory.ts` and several are marked `sourceStatus: "instock"`, but `src/lib/catalog.ts` excludes them in `isPublishableImportedInventoryItem`.

Current publish requirements include:

- Item price must be positive.
- SKU must have a positive market/non-member price in `src/lib/imported-market-prices.ts`.
- `isCatalogPricingPublishable` must pass.
- SKUs marked as source-missing images need a catalog image override.

The failing requirement for this audit batch is the missing market-price map. Three rows also still use placeholder SKUs and need POS/Sunset SKU reconciliation before final publishing.

## Next Fix

To make these products visible online:

1. Add verified market/non-member prices for the 24 real audited SKUs in `src/lib/imported-market-prices.ts`.
2. Resolve the 3 placeholder SKUs before publishing those rows:
   - `MISSING-SKU-NICA-RUSTICA-GORDO`
   - `MISSING-SKU-UNDERCROWN-SHADE-GORDITO`
   - `MISSING-SKU-UNDERCROWN-MADURO-TORO`
3. Rebuild and confirm the 27 target slugs generate under `out/shop/`.
4. Redeploy the static export to Amplify.
5. Recheck live product URLs for HTTP `200`.

## Follow-up Fix - 2026-06-09

The real-SKU portion of this issue has been fixed and deployed.

- Added market/non-member prices for the 24 real audited SKUs in `src/lib/imported-market-prices.ts`.
- First publish fix temporarily kept the new market prices equal to the verified shelf/imported prices so the products could publish without inventing unsourced markup.
- Left the three placeholder-SKU rows unpublished until real POS/Sunset SKUs are reconciled:
  - `MISSING-SKU-NICA-RUSTICA-GORDO`
  - `MISSING-SKU-UNDERCROWN-SHADE-GORDITO`
  - `MISSING-SKU-UNDERCROWN-MADURO-TORO`
- Added/updated catalog review coverage for the newly published Fonseca MX, Aging Room Quattro Nicaragua, and Liga Privada H99 Papas Fritas products.
- `npm test` passed with 545 tests, 545 pass, and 0 fail.
- `npm exec -- tsc --noEmit --pretty false` passed.
- `npm run build` passed and generated 1,018 static pages.
- Amplify job `150` for app `d2yxcklt245wh0`, branch `staging`, reached `SUCCEED`.
- Live smoke after deploy confirmed all 24 real audited product URLs now return HTTP `200`.
- Live smoke confirmed the three placeholder-SKU slugs still return HTTP `404`, as intended until SKU reconciliation.
- Final live recheck confirmed 24/24 real audited slugs returned HTTP `200`, with 0 non-200 responses; 3/3 placeholder-SKU slugs returned HTTP `404`.

## Pricing Scheme Follow-up - 2026-06-09

The first publish fix has been corrected to apply the normal cigar pricing scheme.

- Replaced the temporary equal public/member values for the 24 real-SKU rows with researched public/non-member prices.
- Member/source prices remain the audited shelf/imported prices in `src/lib/imported-inventory.ts`.
- Public/non-member prices now live in `src/lib/imported-market-prices.ts`.
- Source table is documented in `docs/inventory-pricing-scheme-2026-06-09.md`.
- Added focused regressions in `tests/product-detail.test.ts` and `tests/product-pricing.test.ts` so these rows cannot silently fall back to member-cost public pricing again.
- `npm test` passed with 546 tests, 546 pass, and 0 fail.
- `npm exec -- tsc --noEmit --pretty false` passed.
- `npm run build` passed and generated 1,018 static pages.
- Amplify job `151` for app `d2yxcklt245wh0`, branch `staging`, reached `SUCCEED`.
- Live smoke confirmed 24/24 real audited slugs returned HTTP `200` and 24/24 contained the corrected market/non-member/member price tokens.

## Verification Commands

- Checked live shop HTML at `https://www.yuzucigarclub.com/shop/`.
- Checked representative image assets with `curl.exe -sI`.
- Checked all 27 audited product URLs with `curl.exe -L -s -o NUL -w '%{http_code}'`.
- Checked local generated product pages under `out/shop/`.
- Checked `src/lib/imported-market-prices.ts` for all 27 audited SKUs/placeholders.
