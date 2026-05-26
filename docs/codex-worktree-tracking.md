# Codex Worktree Tracking

Last updated: 2026-05-26

Purpose: track the dirty worktree I encounter while expanding and verifying the Yuzu admin/backend. This file is Codex-owned working notes, so future passes have a stable place to record what was changed, verified, and still needs audit.

Project memory: `AGENTS.md` now requires Codex to use this file as the persistent worktree ledger. Every meaningful update, fix, audit, verification pass, or newly discovered dirty/untracked area should be recorded here in the same turn.

## 2026-05-26 Deploy All Updates And Clean Worktree

- Goal: deploy the current update set and clean the working tree.
- Skill used:
  - `deploy-yuzu-amplify`
  - `superpowers/finishing-a-development-branch`
- Deployment:
  - Fresh `npm run build` had already passed after the pricing audit, generating 953 static pages.
  - The first deploy-script attempt failed before deployment because Python could not resolve `npm` directly on Windows.
  - Reran the deploy script with `--skip-build` against the fresh `out/` export.
  - Created POSIX-path deploy zip: `yuzu-cigar-club-amplify-deploy-all-updates-2026-05-26-2026-05-26-134010.zip`.
  - Amplify app `d2yxcklt245wh0`, branch `staging`, job `120` reached `SUCCEED`.
  - Smoke checks passed: staging home returned HTTP 200 and `_next/static/chunks/0tptpu9plx21o.css` returned HTTP 200.
- Cleanup:
  - Added `.gitignore` coverage for generated `*.log`, `/tmp/`, and `.waveform-cache/` artifacts.
  - Removed root generated log files that were not locked and removed local `tmp/` render evidence after verifying resolved paths stayed under the repo.
  - Some root static-preview logs were locked by running preview processes; they remain on disk but are ignored and will not dirty git status.
- Verification before cleanup commit:
  - `npm run lint`
  - `npm test` - 372 tests passing.
  - `npm run build` - Next.js 16.2.6 static export generated 953 pages.

## 2026-05-26 E2E Inventory Price Scheme Audit

- Goal: audit the full imported inventory price scheme after incorrect prices were noticed in the storefront.
- Local Next.js 16.2.6 docs checked before editing:
  - `node_modules/next/dist/docs/01-app/02-guides/static-exports.md`
  - `node_modules/next/dist/docs/01-app/01-getting-started/03-layouts-and-pages.md`
- Storefront/Medusa pricing guidance checked:
  - `storefront-best-practices`
  - `storefront-best-practices/reference/medusa.md`
- Root cause:
  - `calculateCatalogPricing` correctly treats `importedInventory.price` as member/current price and `importedMarketPricesBySku` as public/non-member market price.
  - `isPublishableImportedInventoryItem` allowed rows with no explicit market price to publish, so 40 cigar/sampler rows displayed public pricing equal to member/current cost.
- Patched:
  - `src/lib/catalog.ts`
  - `tests/product-pricing.test.ts`
  - `tests/product-detail.test.ts`
  - `tests/commerce-schema.test.ts`
  - `docs/price-scheme-audit-2026-05-26.md`
  - `docs/codex-worktree-tracking.md`
- Fix:
  - Published catalog rows now require a finite, positive explicit market/non-member price before publication.
  - Added regression coverage that fails if any published product falls back to member cost as its public market price.
  - Updated catalog/detail tests so price-pending requested cigar rows remain unpublished until sourced public prices are added.
- Audit result after fix:
  - Imported inventory rows: 1146.
  - Published catalog products: 921.
  - Published rows missing explicit public market price: 0.
  - Explicit market prices below member/current price: 0.
  - Inventory rows missing public market price: 58.
  - Missing-price rows with non-positive source price: 14.
  - Duplicate SKU groups in imported inventory: 20.
  - The 40 previously published fallback-priced rows are listed in `docs/price-scheme-audit-2026-05-26.md`.
- Verification completed so far:
  - Red regression before fix: `node --import tsx --test --test-name-pattern "explicit public market pricing" tests/product-pricing.test.ts` failed with the 40 fallback-priced SKUs.
  - `node --import tsx --test tests/product-pricing.test.ts tests/product-detail.test.ts tests/commerce-schema.test.ts tests/shop-categories.test.ts` - 48 tests passing.
  - `npx tsc --noEmit`
  - `npm run lint`
  - `npm test` - 372 tests passing.
  - `npm run build` - Next.js 16.2.6 static export generated 953 pages.
- Build note:
  - The first `npm run build` attempt hit the existing Next concurrent-build guard while another build process from the workspace was still active. After waiting for that process to finish and confirming the root `.next/lock` was gone, a fresh build passed.
- Follow-up:
  - Research explicit public/non-member prices for the held rows before republishing them. No new public prices were invented in this pass.

## 2026-05-26 Ratings Review Audit De-Duplication

- Goal: make sure queued `Ratings & Reviews` audit panels show information different from the already-listed product details.
- Local Next.js 16.2.6 docs checked before editing:
  - `node_modules/next/dist/docs/01-app/01-getting-started/03-layouts-and-pages.md`
- Patched:
  - `src/lib/catalog.ts`
  - `tests/product-detail.test.ts`
  - `docs/cigar-ratings-review-audit-2026-05-26.md`
  - `docs/codex-worktree-tracking.md`
- Current audit result:
  - Published catalog products: 921.
  - Cigar and cigar-sampler products: 834.
  - Products with sourced review coverage: 4.
  - Products queued for sourced review research: 830.
- Behavior:
  - Queued review audits no longer repeat Product, Size, Strength, Country, Wrapper, Binder, Filler, Package, or Source status rows already shown elsewhere on the product page.
  - Queued audits now show review-specific guidance: Review status, Search focus, Source priority, Match rule, Capture fields, and Quality gate.
  - Tests now block product-spec labels from returning to queued `Ratings & Reviews` audit details.
- Verification completed:
  - Red regression before implementation: focused `tests/product-detail.test.ts` failed because the old queued audit did not expose review-specific details.
  - Focused `node --import tsx --test --test-name-pattern "audit prompt|queued review" tests/product-detail.test.ts` passed after the implementation.
  - `node --import tsx --test --test-name-pattern "audit prompt|queued review|product cards" tests/product-detail.test.ts`
  - `npx eslint src/lib/catalog.ts src/app/shop/[slug]/page.tsx tests/product-detail.test.ts`
  - `node --import tsx --test tests/product-detail.test.ts` - 29 tests passing.
  - `npx tsc --noEmit`
  - `git diff --check -- src/lib/catalog.ts src/app/shop/[slug]/page.tsx tests/product-detail.test.ts docs/cigar-ratings-review-audit-2026-05-26.md docs/codex-worktree-tracking.md`
  - `npm run build` - Next.js 16.2.6 static export generated 953 pages.
  - Browser QA with the in-app Browser at `http://127.0.0.1:3038/shop/acid-kuba-kuba-24-bx/`: queued review fallback rendered the research prompt plus Review status, Search focus, Source priority, Match rule, Capture fields, and Quality gate; it did not include Product, Size, Strength, Country, Wrapper, Binder, Filler, Package, Source status, Sumatra, Nicaragua, Box of 24, or Medium inside the Ratings & Reviews panel; no framework overlay or console warnings/errors appeared.
  - Browser QA at `http://127.0.0.1:3038/shop/acid-20-twenty-year-24-bx/`: sourced Cigar World/CIGAR.com/Cigar Coop profile still rendered and the queued fallback did not appear; no framework overlay or console warnings/errors appeared.
  - Desktop screenshot evidence saved outside the repo at `C:/Users/qfash/AppData/Local/Temp/codex-cigar-review-audit-deduped.png`.

## 2026-05-26 All-Cigar Ratings And Reviews Audit Fallback

- Goal: audit all cigar products for the same `Ratings & Reviews: {PRODUCT}:` update and ensure every cigar product page has review research details, without inventing unsourced ratings.
- Local Next.js 16.2.6 docs checked before editing:
  - `node_modules/next/dist/docs/01-app/01-getting-started/03-layouts-and-pages.md`
  - `node_modules/next/dist/docs/01-app/02-guides/static-exports.md`
- Storefront/product-review guidance checked:
  - `storefront-best-practices` design and product-review references.
- Patched:
  - `src/lib/catalog.ts`
  - `src/app/shop/[slug]/page.tsx`
  - `tests/product-detail.test.ts`
  - `docs/cigar-ratings-review-audit-2026-05-26.md`
  - `docs/codex-worktree-tracking.md`
- Audit result:
  - Published catalog products: 961.
  - Cigar and cigar-sampler products: 874.
  - Products with sourced review coverage: 4.
  - Products queued for sourced review research: 870.
- Behavior:
  - Added `getCatalogReviewSearchPrompt(product)` to produce `Ratings & Reviews: {PRODUCT NAME}:`.
  - Added `getCatalogReviewAudit(product)` for cigar products only.
  - All cigar products now have a review audit payload with Product, Size, Strength, Country, Wrapper, Binder, Filler, Package, Source status, and a Cigar Aficionado search URL.
  - Product detail pages now render `ReviewAuditPanel` for cigar products that do not yet have `expertReview` or `reviewProfile`, replacing the old empty Cigar Aficionado-only message.
  - `Catalog Signals` now includes `Review audit queued` for cigar products without sourced ratings.
  - Sourced review products still render their sourced review profile/expert review instead of the queued fallback.
- Verification completed:
  - Red regression before implementation: focused `tests/product-detail.test.ts` failed because `getCatalogReviewAudit`, `getCatalogReviewSearchPrompt`, and `ReviewAuditPanel` were absent.
  - Red regression before signal wiring: focused test failed because pending cigar `Catalog Signals` did not include `Review audit queued`.
  - `node --import tsx --test --test-name-pattern "audit prompt|queued review|product cards" tests/product-detail.test.ts`
  - `npx eslint src/lib/catalog.ts src/app/shop/[slug]/page.tsx tests/product-detail.test.ts`
  - `node --import tsx --test tests/product-detail.test.ts` - 29 tests passing.
  - `npx tsc --noEmit`
  - Coverage recount command returned `catalogProducts: 961`, `cigars: 874`, `sourced: 4`, `queued: 870`.
  - `npm run build` - Next.js 16.2.6 static export generated 993 pages.
  - Browser QA with the in-app Browser at `http://127.0.0.1:3038/shop/acid-kuba-kuba-24-bx/`: queued review fallback rendered the search prompt and key details, the old empty message was absent, no framework overlay appeared, and console warnings/errors were empty.
  - Browser QA at `http://127.0.0.1:3038/shop/acid-20-twenty-year-24-bx/`: sourced Cigar World/CIGAR.com/Cigar Coop profile still rendered and the queued fallback did not appear.
  - Phone-width 390x844 DOM/console QA for the queued ACID Kuba Kuba page found the prompt/details, no old empty message, no framework overlay, and no console warnings/errors.
  - Desktop screenshot evidence saved outside the repo at `C:/Users/qfash/AppData/Local/Temp/codex-cigar-review-audit-queued.png`.
- Dirty worktree note:
  - The repo remains broadly dirty. This pass observed a newer `Humidor Add Locations Navigation` ledger entry and left it intact.

## 2026-05-26 Humidor Add Locations Navigation

- Added a dedicated `Add Locations` item directly below `Add Cigars` in the Digital Humidor sidebar.
- Patched:
  - `src/components/humidor-dashboard.tsx`
  - `tests/humidor-dashboard.test.ts`
- Behavior:
  - `Add Locations` is now a first-class humidor section.
  - Signed-in members see the same saved `Humidor Location Profile` form there that Settings uses, so humidor/location info continues to feed new cigar rows and paired devices from one source.
  - Anonymous demo visitors see a sign-in prompt instead of a saveable profile form.
- Verification completed:
  - Red test: `node --import tsx --test --test-name-pattern "add locations" tests\humidor-dashboard.test.ts` failed before implementation with `missing renderLocations`.
  - Green targeted test: `node --import tsx --test --test-name-pattern "add locations" tests\humidor-dashboard.test.ts`.
  - Broader component test: `node --import tsx --test tests\humidor-dashboard.test.ts` - 17 tests passing.
  - `node --import tsx --test tests\humidor-dashboard.test.ts tests\lambda-ycc-api.test.ts` - 103 tests passing.
  - `npx tsc --noEmit`
  - `npm run lint`
  - `npm run build` - Next.js 16.2.6 static export generated 993 pages.
  - Browser plugin static-preview QA at `http://127.0.0.1:3038/humidor/`: page title matched `Digital Humidor | Yuzu Cigar Club`, sidebar order was `Add Cigars`, `Add Locations`, `My Cigars`, clicking `Add Locations` showed the Add Locations section/sign-in prompt, no framework overlay appeared, and console warnings/errors were empty.
  - Screenshot saved to `C:\Users\qfash\AppData\Local\Temp\yuzu-add-locations-qa.png`.

## 2026-05-26 ACID 20 Ratings And Reviews Details

- Goal: fill the cigar product `Ratings & Reviews` panel with searched key details for `ACID 20 TWENTY YEAR 24/BX` instead of leaving it in the Cigar Aficionado-only empty state.
- Local Next.js 16.2.6 docs checked before editing:
  - `node_modules/next/dist/docs/01-app/01-getting-started/03-layouts-and-pages.md`
  - `node_modules/next/dist/docs/01-app/02-guides/static-exports.md`
- Storefront/product-review guidance checked:
  - `storefront-best-practices` design and product-review references.
- Research sources used for the ACID 20 review profile:
  - Cigar World ACID 20 profile/reviews: `https://www.cigarworld.com/cigars/acid/acid-20/`
  - CIGAR.com ACID 20 customer profile: `https://www.cigar.com/product/acid-cigars-by-drew-estate-acid-20/AID-PM.html`
  - Cigar Coop ACID 20 Robusto review: `https://cigar-coop.com/2021/03/cigar-review-acid-20-robusto-by-drew-estate.html`
  - Cigar Coop ACID 20 Toro review: `https://cigar-coop.com/2021/05/agile-cigar-review-acid-20-toro-by-drew-estate.html`
- Patched:
  - `src/lib/catalog.ts`
  - `src/app/shop/[slug]/page.tsx`
  - `tests/product-detail.test.ts`
  - `docs/codex-worktree-tracking.md`
- Behavior:
  - Added a reusable `reviewProfile` catalog enrichment type for non-Cigar-Aficionado review snapshots.
  - Added the searched query `Ratings & Reviews: ACID 20 TWENTY YEAR 24/BX:` plus Cigar World, CIGAR.com, and Cigar Coop ratings/details to the ACID 20 Twenty Year catalog product.
  - The product detail `Ratings & Reviews` panel now renders `reviewProfile` details and still keeps the existing `expertReview` rendering path for Cigar Aficionado matches.
  - Added a dedicated review-query row so long search prompts wrap at word boundaries instead of splitting words.
- Verification completed:
  - Red regression before implementation: focused `tests/product-detail.test.ts` failed because `reviewProfile` was absent and the product detail page did not render broader review snapshots.
  - Red regression before the query-row polish: focused source test failed because `ReviewQueryRow` was absent.
  - `node --import tsx --test --test-name-pattern "ACID 20 ratings|product cards and detail" tests/product-detail.test.ts`
  - `node --import tsx --test --test-name-pattern "product cards and detail" tests/product-detail.test.ts`
  - `npx eslint src/lib/catalog.ts src/app/shop/[slug]/page.tsx tests/product-detail.test.ts`
  - `node --import tsx --test tests/product-detail.test.ts`
  - `npx tsc --noEmit`
  - `npm run build` - final rerun passed and generated 993 static pages.
  - Browser QA with the in-app Browser at `http://127.0.0.1:3038/shop/acid-20-twenty-year-24-bx/`: title matched the product page, the rendered DOM included the search query plus Cigar World/CIGAR.com/Cigar Coop details and ratings, no framework overlay was present, and console warnings/errors were empty.
  - Desktop screenshot evidence saved outside the repo at `C:/Users/qfash/AppData/Local/Temp/codex-acid-review-profile-final.png`.
  - Phone-sized viewport DOM/console check at 390x844 found the same review query/sources/ratings with no framework overlay and no console warnings/errors; mobile screenshot capture itself timed out, so DOM and console were used as the mobile proof.
- Build note:
  - One `npm run build` attempt hit the existing Next concurrent-build guard while another build process was active. After confirming no active `next build` process remained, the retry passed. No code change was made for that environmental issue.
- Dirty worktree note:
  - The repo was already broadly dirty before this pass. `src/lib/catalog.ts`, `src/app/shop/[slug]/page.tsx`, and `tests/product-detail.test.ts` already had unrelated pending edits; this pass only added the ACID 20 review-profile path and focused tests described above.

## 2026-05-26 Home Digital Humidor Customer Copy

- Rewrote the home page Digital Humidor section to avoid implementation-facing terms like API routes, Cognito, and browser-seeded data.
- Patched:
  - `src/app/page.tsx`
  - `src/lib/data.ts`
- Copy changes:
  - The section now leads with the member value proposition: real collection first, QR scans and sensor pairing later.
  - The supporting card is now `Private Member Humidor` with sign-in and saved-across-devices language.
  - Feature chips changed from `Cognito gate` / `Live inventory` to `Private access` / `Saved collection`.
- Local Next.js 16.2.6 docs checked before editing:
  - `node_modules/next/dist/docs/01-app/01-getting-started/03-layouts-and-pages.md`
- Verification completed:
  - `rg -n "Live inventory first|QR and sensors after the API routes|Cognito gate|Live Humidor Path|Member humidor data requires|No browser-seeded|Version one reads and writes|Cognito-protected humidor|Yuzu API" src/app/page.tsx src/lib/data.ts` returned no matches.
  - `npx eslint src/app/page.tsx src/lib/data.ts`
  - Browser QA at `http://127.0.0.1:3022/`: page identity matched `Yuzu Cigar Club | Membership, Storefront, Digital Humidor`, the Digital Humidor section showed the new customer-friendly copy and `Private access` / `Saved collection` chips, and the old API/Cognito wording was absent from the rendered DOM.
  - Interaction proof: clicked `Watch the Digital Humidor explainer`; the `Digital Humidor demo video` dialog opened with the expected video label and close control.
  - Console note: the rendered pass still reports an existing reduced-motion warning and React hydration mismatch tied to motion component attributes; this copy-only update left that separate issue untouched.

## 2026-05-26 Humidor Location Profile Defaults

- Added a member humidor/location profile to the Digital Humidor Settings tab so signed-in users can save a humidor name and default location.
- Patched:
  - `src/components/humidor-dashboard.tsx`
  - `src/lib/live-api.ts`
  - `infra/lambda/ycc-api/index.js`
  - `tests/humidor-dashboard.test.ts`
  - `tests/lambda-ycc-api.test.ts`
- Behavior:
  - The Settings tab now shows `Humidor Location Profile` with `Humidor name` and `Default location`.
  - The saved profile is persisted through the existing humidor preferences/member profile path as `humidorProfile`.
  - Manual Add Cigars, AI-confirmed cigar rows, bulk import rows without a location, and paired device forms pull the saved default location.
  - Changing the saved default refreshes fields that still contain the previous default, while preserving member-entered per-item or per-device location overrides.
- Verification completed:
  - Red regression runs confirmed the dashboard and Lambda profile persistence behavior failed before implementation.
  - `node --import tsx --test tests/humidor-dashboard.test.ts tests/lambda-ycc-api.test.ts` - 102 tests passing.
  - `npx tsc --noEmit`
  - `npm run lint`
  - `npm run build` - Next.js 16.2.6 static export generated 993 pages.
  - Browser plugin static-preview smoke at `http://127.0.0.1:3038/humidor/`: page loaded, Add Cigars and Settings tabs responded, and console warnings/errors were empty.
  - Playwright signed-in fallback with mocked Cognito/API state: loaded the stored `Walk-in Humidor` profile, saved `Aging locker` / `Locker A / Drawer 2`, confirmed the POST `/humidor/alerts` payload carried the profile, and verified both the Add Cigars Location field and Device Settings Humidor location field updated to `Locker A / Drawer 2`; console warnings/errors were empty.
- Tooling note: the in-app Browser page evaluation scope could not seed localStorage for a signed-in Cognito session, so signed-in state verification used a Python Playwright fallback after the Browser smoke check.

## 2026-05-26 Shop Sidebar Categories Copy

- Changed the desktop shop sidebar copy from the `Catalog Controls` heading and explanatory controls paragraph to a direct `Categories` heading above the category links.
- Patched:
  - `src/app/shop/page.tsx`
- Local Next.js 16.2.6 docs checked before editing:
  - `node_modules/next/dist/docs/01-app/01-getting-started/03-layouts-and-pages.md`
  - `node_modules/next/dist/docs/01-app/01-getting-started/04-linking-and-navigating.md`
- Verification completed:
  - `npx eslint src/app/shop/page.tsx`
  - `rg -n "Catalog Controls|Search, category chips|Categories" src/app/shop/page.tsx` now finds only the new `Categories` heading and no old sidebar copy.
  - Browser QA at `http://localhost:3022/shop/`: title matched `Shop Premium Cigar Boxes | Yuzu Cigar Club`, the page rendered meaningful shop content with no framework overlay, the left sidebar showed `Categories`, and the old `Catalog Controls` heading and controls paragraph were absent.
  - Interaction proof: clicking `ACID Cigars` routed to `http://localhost:3022/shop/?category=ACID+Cigars#catalog` and the old sidebar copy stayed absent.
  - Console note: initial page-load console warnings/errors were empty. After the category filter interaction, Browser logged an existing reduced-motion warning plus a React hydration mismatch in `ShopCatalog`/Framer Motion styles; this copy-only pass left that separate issue untouched.
- Dirty worktree note: `src/app/shop/page.tsx` already contained a pending Suspense/fallback change before this copy edit; it was left intact.

## 2026-05-26 AgeChecker Account Readiness And Backend Status Fix

- Goal: make sure the AgeChecker.Net account and Yuzu checkout integration are ready for launch.
- Account/dashboard checks completed in Chrome:
  - AgeChecker account is logged in and has the `yuzucigarclub.com` website entry.
  - Website settings show Online enabled, Retail enabled, Developer Mode off, `yuzucigarclub.com` as the domain, and a 21+ profile.
  - Saved the empty Site Name field as `Yuzu Cigar Club`; the dashboard confirmed the saved state.
  - Billing page shows the free trial is active, with Update Card / Cancel Trial controls and no billing history.
  - Usage page for May 2026 shows 0 accepted, 0 denied, 0 incomplete, and $0.00 charges.
- Secret/config checks completed:
  - AWS profile `ycc-mcp` can read `ycc/commerce/prod`.
  - `ageVerification.vendor` is `AgeChecker.Net`.
  - API key, account secret, and checkout signing secret are present and non-placeholder.
  - AWS AgeChecker API/account secrets match the local `.env.local` values; the signing secret is distinct.
  - Live AgeChecker API auth was validated without recording secret values: `/v1/latest` returns `not_found` with the real secret because there are no recent verifications, and `invalid_secret` with a fake secret.
- Static storefront checks completed:
  - Local `out/`, staging `https://staging.d2yxcklt245wh0.amplifyapp.com/checkout/`, and production `https://www.yuzucigarclub.com/checkout/` include the AgeChecker public key, `https://cdn.agechecker.net/static/popup/v1/popup.js`, and the Yuzu commerce API base.
- Patched:
  - `infra/lambda/ycc-api/index.js`
  - `tests/lambda-ycc-api.test.ts`
- Fix:
  - `handleCommerceAgeVerificationToken` now requires an AgeChecker account secret before minting a checkout age token.
  - `validateAgeCheckerVerification` now uses the documented AgeChecker endpoint `GET /v1/status/{uuid}` with the `X-AgeChecker-Secret` account-secret header instead of the undocumented `POST /v1/validate` path.
  - Added coverage for the status lookup shape and fail-closed behavior when the account secret is missing.
- Verification completed:
  - Red regression before the fix: focused commerce age verification tests failed because the backend still called `/v1/validate` and did not require an account secret.
  - `node --import tsx --test --test-name-pattern "commerce age verification" tests/lambda-ycc-api.test.ts`
  - `node --import tsx --test tests/checkout-flow.test.ts tests/launch-readiness.test.ts`
  - `npm test` - 367 tests passing.
  - `npm run lint` - passes with the existing humidor hook dependency warning in `src/components/humidor-dashboard.tsx`.
  - `npx tsc --noEmit`
  - `npm run build` - first attempt hit a transient Next build lock; no production `next build` process or `.next/lock` remained, and the retry passed with 993 static pages generated.
  - `npm run launch:go-live-check` - strict go-live checks pass, including `age-verification-provider`; only warning is cleanup for old/generated artifacts.
- Deployment note:
  - No Lambda or Amplify deployment was performed in this pass. Production/staging static bundles already contain public AgeChecker config, but the live backend still needs a controlled Lambda deployment before it picks up the `/v1/status/{uuid}` fix.
- Dirty worktree note:
  - Pre-existing broad dirty/untracked state remains across config, docs, infra, source, tests, generated preview logs, static assets, and `tmp/`.
  - Newly observed untracked areas beyond the older ledger snapshot include admin/static preview logs, `docs/butane-fluid-pricing-audit-2026-05-22.md`, `infra/database/migrations/0005_member_stripe_customer_link.sql`, `public/assets/inventory/cigars/`, additional lighter images, event UI helpers, additional tests, and `tmp/`.

## 2026-05-26 Humidor Live Data Boundary Copy Removal

- Removed the humidor overview boundary notice card that displayed `Live Data Boundaries` and the live API/climate telemetry explanatory copy.
- Patched:
  - `src/components/humidor-dashboard.tsx`
- Local Next.js 16.2.6 docs checked before editing:
  - `node_modules/next/dist/docs/01-app/01-getting-started/05-server-and-client-components.md`
- Verification completed:
  - `rg -n "Live Data Boundaries|Demo Data Boundaries|Inventory, aging dates|Climate telemetry and smoke-log routes" src tests docs` now finds only ledger notes, with no matches in source or tests.
  - `npx eslint src/components/humidor-dashboard.tsx`
  - Browser QA at `http://127.0.0.1:3022/humidor/`: page identity matched `Digital Humidor | Yuzu Cigar Club`, the humidor overview rendered meaningful content with no framework overlay, console warnings/errors were empty, the Add Cigars tab became active through visible-DOM interaction, and the final overview DOM/screenshot confirmed the removed boundary heading and copy were absent.

## 2026-05-26 Humidor Device Pairing And Phone Climate Alerts

- Implemented pairing support for HUMIDIFIER/sensor devices so paired climate readings can participate in phone alert routing.
- Followed the Next.js 16 project rule by reading these local docs before editing:
  - `node_modules/next/dist/docs/01-app/01-getting-started/05-server-and-client-components.md`
  - `node_modules/next/dist/docs/01-app/02-guides/static-exports.md`
  - `node_modules/next/dist/docs/01-app/02-guides/progressive-web-apps.md`
- Patched:
  - `src/lib/humidor-devices.ts`
  - `src/lib/live-api.ts`
  - `src/components/humidor-dashboard.tsx`
  - `infra/lambda/ycc-api/index.js`
  - `tests/humidor-devices.test.ts`
  - `tests/humidor-dashboard.test.ts`
  - `tests/lambda-ycc-api.test.ts`
- Frontend behavior:
  - The device settings form now submits through `handlePairDevice` and shows explicit `Pair HUMIDIFIER` / `Pair Sensor` button text.
  - Pairing requires a Cognito-backed live session for phone alert routing, validates device identifier and climate readings, tries to enable web push when VAPID/support are present, and saves `climateAlertsEnabled`, `pushEnabled`, `pushSubscription`, and `pairedDevices` with the member alert preferences.
  - Stored alert preferences hydrate the local paired-device list, and the Alerts tab now summarizes paired devices, climate reading count, phone push status, and any out-of-range climate alert messages.
  - The live Settings tab also persists a `Humidor Location Profile` with a default location through the same alert-preferences member profile record; manual adds, AI-identified cigars, bulk imports, and paired devices use that default when their location field is blank.
- Backend behavior:
  - Humidor alert preferences now normalize and persist `pairedDevices`.
  - The scheduled alert dispatcher now sends both reorder reminders and climate push notifications for paired HUMIDIFIER/sensor readings outside the target range of 65-72% RH and 64-74 F.
  - Climate dispatch writes `humidor_climate_alert.dispatched` audit records and reports climate delivery counts in the dispatch summary.
- Verification completed:
  - Red regression: `node --import tsx --test tests/humidor-devices.test.ts` failed before the climate-alert helper existed.
  - Red regression: focused dashboard/lambda tests failed before `handlePairDevice`, `pairedDevices`, and climate dispatch were implemented.
  - `node --import tsx --test tests/humidor-devices.test.ts`
  - `node --import tsx --test --test-name-pattern "settings tab exposes|humidor alert dispatch sends climate|humidor alerts GET|humidor alerts update" tests/humidor-dashboard.test.ts tests/lambda-ycc-api.test.ts`
  - `node --import tsx --test tests/humidor-dashboard.test.ts tests/humidor-devices.test.ts tests/live-page-editor.test.ts`
  - `node --import tsx --test tests/lambda-ycc-api.test.ts`
  - Fresh post-ledger regression catch: `npm test` initially failed `settings tab saves a humidor location profile that feeds add and device flows`; the profile persistence/default-location wiring was completed, then focused dashboard/lambda checks passed.
  - `npx tsc --noEmit`
  - `npm run lint`
  - `npm test` - 367 tests passing.
  - `npm run build` - Next.js 16.2.6 static export generated 993 pages.
  - Build note: one `npm run build` attempt hit Next's concurrent-build guard, and one follow-up saw an `_ssgManifest.js` build-ID mismatch while another `next build` child was still alive. Waited for that process to clear and reran `npm run build`; the captured rerun passed.
- Browser/static verification:
  - Static preview is serving `out/` at `http://localhost:3030/humidor/` from `scripts/static-preview.mjs`.
  - In-app Browser opened the humidor page, confirmed title `Digital Humidor | Yuzu Cigar Club`, opened the Settings tab in the anonymous preview, saved a screenshot at `tmp/humidor-settings-browser.png`, and reported 0 console warnings/errors. This check was repeated after the final successful static export.
  - The in-app Browser page evaluation scope is read-only, so it could not seed a fake Cognito session to visually exercise the live-only Pair controls. A Playwright CLI fallback was attempted but stopped at the fresh-context age gate; signed-in pairing remains covered by component/API tests rather than bypassing the gate.
- Dirty worktree note: pre-existing broad dirty/untracked state remains. New untracked static preview logs from this pass are `humidor-pairing-static-3030.out.log` and `humidor-pairing-static-3030.err.log`; the temporary `.playwright-cli/` fallback artifact was removed.

## 2026-05-26 Humidor Aging Production-Date Model

- Implemented the recommended Aging Records model: member-controlled humidor age drives readiness, while optional production/box date is preserved as total cigar age context.
- Patched:
  - `src/lib/humidor-aging.ts`
  - `src/lib/live-api.ts`
  - `src/lib/humidor-bulk-import.ts`
  - `src/lib/humidor-demo.ts`
  - `src/components/humidor-dashboard.tsx`
  - `infra/lambda/ycc-api/index.js`
  - `tests/humidor-aging.test.ts`
  - `tests/humidor-bulk-import.test.ts`
  - `tests/humidor-dashboard.test.ts`
  - `tests/lambda-ycc-api.test.ts`
- Behavior:
  - Added `productionDate` as the optional box/production provenance date.
  - Aging readiness now uses `agingStartDate`, then `purchaseDate`, then API `createdAt` as the member-controlled fallback.
  - Aging Records displays both `months in your humidor` and `months total age` when a production date exists.
  - Manual add and AI confirmation forms expose `Box / production date`.
  - Bulk import template accepts `productionDate` and aliases including `box date`.
  - Lambda normalizes `productionDate`/`producedDate`/`boxDate`, returns it in the humidor item contract, and persists it in `humidor_items.metadata.productionDate` without requiring a table migration.
- Verification completed:
  - Red regression run confirmed the new behavior failed before implementation.
  - `node --import tsx --test tests/humidor-aging.test.ts tests/humidor-dashboard.test.ts tests/humidor-bulk-import.test.ts tests/lambda-ycc-api.test.ts`
  - `npx tsc --noEmit`
  - `npm run lint`
  - `npm test` - 360 tests passing
  - `npm run build` - Next.js 16.2.6 static export generated 993 pages.
  - Playwright CLI static-preview smoke at `http://127.0.0.1:3034/humidor/`: passed age gate, opened the Aging tab, and confirmed demo rows render `months in your humidor` plus `months total age`; browser console reported 0 warnings/errors.
- Tooling note: in-app Browser tools were not exposed by tool discovery in this session, so rendered verification used the local Playwright CLI fallback. The generated `.playwright-cli/` artifact directory was removed afterward.
- Dirty worktree note: current status still shows the broad pre-existing dirty worktree. Newly observed untracked/dirty areas not listed in the older inventory include root docs (`AGENTS.md`, `README.md`), event/education follow-up files, `docs/butane-fluid-pricing-audit-2026-05-22.md`, `public/assets/inventory/cigars/`, `tests/daily-cigar-news-run.test.ts`, `tests/education-video-library.test.ts`, `tests/site-chrome-console-health.test.ts`, and `tmp/`; left untouched unless part of the aging model above.

## 2026-05-26 Admin User Access Roster and Agent Fix

- Investigated the admin console report that the `User Access` tile was not clickable/useful and that the Admin Agent prompt `list all users` returned a generic support queue summary.
- Local Next.js 16.2.6 docs checked before editing:
  - `node_modules/next/dist/docs/01-app/01-getting-started/05-server-and-client-components.md`
  - `node_modules/next/dist/docs/01-app/01-getting-started/06-fetching-data.md`
  - `node_modules/next/dist/docs/01-app/01-getting-started/15-route-handlers.md`
- Root causes:
  - The top `User Access` status tile was static, and the roster list was capped by the shared `AdminList` default of 8 rows even when the backend had more users.
  - `list/show all users` prompts were not recognized as an admin roster intent, so `buildConciergeExchange` could fall through to Bedrock/fallback support queue summary behavior.
  - Browser verification caught an initial targeting mistake where the new click target landed on adjacent panels before being moved to the actual `User Access` roster section.
- Patched:
  - `src/components/admin/backend-admin-console.tsx`
  - `src/lib/live-api.ts`
  - `infra/lambda/ycc-api/index.js`
  - `tests/admin-static-boundary.test.ts`
  - `tests/lambda-ycc-api.test.ts`
- Fix:
  - `fetchAdminMembers` accepts `limit`, `q`, and `status` query options, and the admin console refresh loads up to 250 members for the roster.
  - The `User Access` status tile is now a button that scrolls/focuses the actual `User Access` roster section.
  - The roster section renders all loaded members with `limit={null}` instead of the shared 8-row preview cap.
  - The Lambda admin members endpoint honors a bounded `limit` query parameter.
  - The Admin Agent now recognizes user/member/account/operator roster prompts and returns a local persisted user-access roster snapshot instead of the generic queue-health fallback.
- Verification completed:
  - Red regression: `node --import tsx --test tests/admin-static-boundary.test.ts` failed before the UI click/focus implementation.
  - Red regression: `node --import tsx --test tests/lambda-ycc-api.test.ts` failed before the admin roster prompt router returned `admin_user_list`.
  - `node --import tsx --test tests/admin-static-boundary.test.ts`
  - `node --import tsx --test tests/lambda-ycc-api.test.ts`
  - `node --import tsx --test tests/admin-backend-api.test.ts`
  - `npx tsc --noEmit`
  - `npm run lint`
  - `npm test` - 360 tests passing
  - `npm run build` - Next.js 16.2.6 static export generated 993 pages.
  - Browser QA at `http://127.0.0.1:3029/admin/console` with a mocked Cognito/admin API: signed in as a Cognito admin, clicked `Open user access list`, confirmed focus moved to `#admin-user-access`, the section heading was `User Access`, 17 distinct user emails were rendered including `member17@example.com`, the old `Showing 8 of 17 records` cap was absent, and the Admin Agent response for `list all users` contained `User access roster: 17 users` with no `support queue health` fallback. Browser console had no warnings/errors during the final agent check.

## 2026-05-26 Humidor Agent Enrichment For My Cigars

- Implemented the My Cigars humidor-agent enrichment flow for member humidor rows with missing details, image, or MSRP.
- Followed the Next.js 16 project rule by reading these local docs before editing:
  - `node_modules/next/dist/docs/01-app/01-getting-started/05-server-and-client-components.md`
  - `node_modules/next/dist/docs/01-app/01-getting-started/07-mutating-data.md`
  - `node_modules/next/dist/docs/01-app/01-getting-started/15-route-handlers.md`
- Patched:
  - `src/components/humidor-dashboard.tsx`
  - `src/lib/live-api.ts`
  - `infra/lambda/ycc-api/index.js`
  - `infra/ycc-phase1-edge.yaml`
  - `tests/humidor-dashboard.test.ts`
  - `tests/lambda-ycc-api.test.ts`
  - `tests/api-gateway-contract.test.ts`
- Backend behavior:
  - Added authenticated `PATCH /humidor/items/{id}/enrich`.
  - Loads the member-owned humidor item, detects missing info/image/MSRP fields, asks `YCCHumidorAgent` for researched enrichment, and persists only previously missing values.
  - Preserves member-entered values such as location, notes, brand, or existing image/MSRP instead of overwriting them.
  - Stores enrichment metadata and writes an audit log action `humidor_item.enriched`.
  - Supports reference image URLs in stored humidor image metadata so agent-found product images can render without base64 payloads.
- Frontend behavior:
  - My Cigars rows now label missing `Info`, `Image`, and `MSRP`.
  - The selected cigar detail card shows a `Humidor Agent Update` action when gaps exist.
  - The UI calls the live enrichment endpoint with Cognito headers, then replaces the updated item in local humidor state.
- Verification completed:
  - Red regressions failed before the implementation for the missing live API export, API Gateway route, and Lambda route.
  - `node --import tsx --test tests/humidor-dashboard.test.ts`
  - `node --import tsx --test tests/api-gateway-contract.test.ts`
  - `node --import tsx --test tests/lambda-ycc-api.test.ts`
  - `npm run lint`
  - `npx tsc --noEmit`
  - `npm test` - 360 tests passing.
  - `npm run build` - Next.js 16.2.6 static export generated 993 pages.
- Build note: the first captured `npm run build` attempt was blocked by an already-running `next build` process in this workspace. Waited for PID `32328` to finish, reran the build, and the captured build passed.

## 2026-05-26 Stripe Tax And Adult-Signature Readiness Pass

- Investigated the live Stripe account and commerce readiness after Stripe Support confirmed Company Q meets Stripe's Services Agreement on 2026-05-25.
- Stripe live findings:
  - Account `acct_1SofC90r0rWXiDV5` is `Company Q`; charges are enabled, no currently due or past-due requirements are reported, the commerce webhook is enabled, and active products/prices are present.
  - Stripe Tax remains `pending`; direct `/v1/tax/settings` shows `status_details.pending.missing_fields=["head_office"]`, no head office address, no default tax code, no default tax behavior, and zero active/scheduled/expired Tax registrations.
  - Stripe account company address is missing and the company name is currently misspelled as `The Compnay Q`; do not invent legal/tax address data.
- Live secret updates:
  - `ycc/commerce/prod` now records Stripe tobacco approval confirmation with the 2026-05-25 Stripe Support email as source.
  - `ycc/commerce/prod` now records USPS Adult Signature readiness: `shipping.provider=USPS`, `shipping.adultSignatureCarrierApproved=true`, and nested `shipping.adultSignature.ready/accountConfigured/approved=true`.
- Patched:
  - `scripts/launch-readiness.ts`: structured commerce secret parsing now recognizes nested `shipping.adultSignature.accountConfigured`, `ready`, `approved`, and carrier-approved fields for `ADULT_SIGNATURE_CARRIER_APPROVED`.
  - `tests/launch-readiness.test.ts`: added regression for nested USPS Adult Signature readiness.
  - Launch docs and knowledge copy now reflect Stripe Tax instead of stale Avalara wording and show adult signature/Stripe approval as closed.
- Verification completed:
  - Red regression: `node --import tsx --test --test-name-pattern "nested USPS adult-signature" tests/launch-readiness.test.ts` failed before the readiness parser patch.
  - `node --import tsx --test --test-name-pattern "nested USPS adult-signature" tests/launch-readiness.test.ts`
  - `node --import tsx --test tests/launch-readiness.test.ts` - 14 passing
  - `node --import tsx --test tests/commerce-rules.test.ts` - 7 passing
  - `npm run launch:go-live-check` now passes Stripe approval, live Stripe secrets/webhook/portal/prices, test-mode E2E, age verification, USPS, USPS Adult Signature, AWS restore drill, staging QA, and WAF/rate limiting; it still fails only `tax-provider`.
- Remaining product-commerce blocker:
  - Confirm and configure required Stripe Tax registrations. After the operator confirms the business is registered to collect tax in the required state(s), set `tax.ready=true`/`tax.status=ready` in `ycc/commerce/prod`, rerun the strict go-live check, and do a provider-backed checkout verification.

## 2026-05-26 Stripe Tax Head-Office Update

- Used the user-provided tax address `951 South Coral Key Ct, Gilbert, AZ 85233` to update live Stripe Tax settings.
- Rendered the IRS EIN assignment PDF locally because it had no embedded text. The notice confirms legal entity `COMPANY QUON LLC` and an EIN, but the notice address is older/different from the user-provided tax address; do not expose the EIN in chat or docs.
- Direct Stripe Tax settings update succeeded:
  - `/v1/tax/settings` changed to `status=active`.
  - `status_details.pending.missing_fields` is now empty.
  - Head office is Gilbert, AZ 85233.
- Direct Stripe Tax registration check still shows zero active, scheduled, or expired registrations.
- Attempted to update the Stripe account legal name/EIN/address through the API, but Stripe returned HTTP 403: the account update method can only be used for connected accounts, not this account itself. Legal name/EIN correction must be done in Stripe Dashboard.
- Updated `ycc/commerce/prod` tax state to `tax.status=active_pending_registration`, `tax.ready=false`, `stripeSettingsStatus=active`, active registration count `0`, and the Gilbert head-office summary.
- Verification:
  - `npm run launch:go-live-check` still fails only `tax-provider`, as intended, because the app must not mark product checkout tax-ready until Tax registrations/collection obligations are confirmed.

## 2026-05-26 Stripe Tax Registration And Checkout Smoke

- User confirmed COMPANY QUON LLC is registered with Arizona to collect the relevant transaction privilege/sales tax for the business.
- Created live Stripe Tax AZ `state_sales_tax` registration `taxreg_1TbQiD0r0rWXiDV5IKP7bReS`; `/v1/tax/settings` remains `status=active` with no missing fields.
- Set Stripe Tax account defaults to tax code `txcd_99999999` and tax behavior `exclusive` after the first live Checkout smoke failed because Stripe required a tax code on line items or an account default.
- Updated Secrets Manager secret `ycc/commerce/prod` to `tax.provider=Stripe Tax`, `tax.ready=true`, `tax.status=ready`, active registration count `1`, the Gilbert head-office address, default tax code `txcd_99999999`, and default tax behavior `exclusive`.
- Verification completed:
  - `npm run launch:go-live-check` passes every strict go-live gate, including `tax-provider`; only the old/generated artifact cleanup warning remains.
  - Direct Stripe Tax calculation `taxcalc_1TbQxC0r0rWXiDV5Rpo2gl8e` for a $3.39 Gilbert, AZ line item returned live `amount_tax=28`, `tax_code=txcd_99999999`, and `tax_behavior=exclusive`.
  - Direct Lambda `POST /commerce/checkout-session` smoke selected SKU `11738` (`NEWPORT LIGHTER FLUID`), created live Checkout Session `cs_live_b1WFLmMXyD18cXDWoKyzCrHEnc3qqmObwhTkHBplTGUR1j2oljQKbqocsK`, confirmed `automatic_tax.enabled=true`, expired the session, and verified it remained unpaid.
  - Follow-up Stripe lookup found `session.customer=null` and zero smoke Customers for `codex-stripe-tax-smoke@yuzucigarclub.example`, so no cleanup customer remained.
  - Final live Stripe account check returned `charges_enabled=true`, `payouts_enabled=false`, Tax `status=active`, no Tax missing fields, one active registration, and zero first-page Customers.
- Remaining Stripe Dashboard/operator item:
  - Direct API update for own-account legal name/EIN/address is not allowed; Stripe Dashboard must be used for any legal-name/EIN correction, and payout status still needs operator review before public launch.

## 2026-05-26 Member Stripe Customer Link

- Added and deployed canonical DB member-to-Stripe Customer linking.
- Live Stripe check found no current Customers, so there were no existing Stripe Customer records to backfill.
- Patched:
  - `infra/database/migrations/0005_member_stripe_customer_link.sql`: adds `members.stripe_customer_id`, backfills from `member_subscriptions`/`commerce_orders`, and creates `members_stripe_customer_id_uidx`.
  - `infra/lambda/ycc-api/index.js`: `upsertMember` preserves Cognito/actor Stripe Customer IDs; Checkout and subscription webhooks backfill matched member rows; Customer Portal sessions read `members.stripe_customer_id` before falling back to subscription/order history; guarded apply/verify actions for migration `0005` were added.
  - `scripts/package-ycc-api-lambda.mjs` and `scripts/launch-readiness.ts`: Lambda packaging/readiness now include migration `0005`.
  - `tests/lambda-ycc-api.test.ts`, `tests/member-stripe-customer-link-schema.test.ts`, and `tests/launch-readiness.test.ts`: added red/green coverage for schema, webhook member linking, portal lookup precedence, and package validation.
  - Launch docs/README updated to record the live member-link deployment.
- Live deployment:
  - Packaged `output/ycc-api-lambda-member-stripe-customer-link-20260526.zip` with code hash `1XVby3Y9TTUf3I8hF5DHhHQJhRG/DE4ZHzMaY9QgoEE=`.
  - Deployed to Lambda `ycyyy`; AWS reported `LastModified=2026-05-26T19:23:53Z`.
  - Guarded migration `apply_member_stripe_customer_link_schema` applied to `postgresycc` at `2026-05-26T19:24:56.130Z`.
  - Verify invoke returned `missingColumns=[]`, `indexCount=1`, `linkedMemberCount=0`, and migration row `0005`.
  - Direct Lambda `GET /health?deep=1` returned HTTP `200`, `status=ok`, and `db.proxyReachable=true`.
- Verification completed:
  - Red regressions failed before implementation for missing migration, member-row portal precedence, webhook member backfill, and Lambda zip migration `0005` validation.
  - `node --import tsx --test tests/member-stripe-customer-link-schema.test.ts`
  - `node --import tsx --test --test-name-pattern "customer portal sessions prefer|signed checkout events|subscription webhook" tests/lambda-ycc-api.test.ts`
  - `node --import tsx --test tests/lambda-ycc-api.test.ts` - 85 passing
  - `node --import tsx --test tests/commerce-schema.test.ts tests/member-stripe-customer-link-schema.test.ts tests/stripe-commerce.test.ts tests/launch-readiness.test.ts tests/commerce-rules.test.ts` - 32 passing
  - `npm run launch:go-live-check` still fails only `tax-provider`; all other strict gates pass.
- Remaining product-commerce blocker:
  - Do not create Stripe Tax registrations or set `tax.ready=true` until the operator confirms COMPANY QUON LLC is registered to collect tax in the required state(s).

## 2026-05-26 Account Email Layout Fix

- Investigated the account overview email overflow shown in the screenshot for `quon@thecompanyq.com`.
- Followed the Next.js 16 project rule by reading `node_modules/next/dist/docs/01-app/01-getting-started/11-css.md` before editing the React/Tailwind surface.
- Root cause: `AccountDetailTile` used `break-words`, but the grid item/content lacked `min-w-0`, so long identity strings could keep their intrinsic width and bleed into the neighboring account card.
- Patched `src/components/account-experience.tsx`:
  - Added `min-w-0` to the account detail tile and its text container.
  - Switched the tile value text to `break-all` with a tighter line height so email-style values stay inside the card.
- Added a regression in `tests/account-auth-boundary.test.ts` requiring account overview tiles to shrink in the grid and hard-wrap long identity values.
- Verification completed:
  - Red regression: `node --import tsx --test tests/account-auth-boundary.test.ts` failed before the fix on the missing `min-w-0`/hard-wrap contract.
  - `node --import tsx --test tests/account-auth-boundary.test.ts`
  - `npm run lint`
  - `npx tsc --noEmit`
  - Browser plugin check at `http://localhost:3022/account/`: page identity loaded, meaningful account/sign-in content rendered, and no console warnings/errors before signed-in state seeding.
  - Playwright CLI fallback was used for the signed-in seeded session because the in-app Browser page evaluation scope is read-only and could not seed localStorage. With mocked account/order API responses, desktop `1194x768` and mobile `390x844` checks showed `quon@thecompanyq.com` inside the Email tile with no tile overflow, no page horizontal overflow, and no overlap with the next card.
- Broad verification blockers observed outside this layout fix:
  - `npm test` currently fails 2 unrelated humidor Lambda tests in `tests/lambda-ycc-api.test.ts`: production date metadata is missing from the normalized/persisted humidor item contract.
  - `npm run build` currently fails in `src/components/humidor-dashboard.tsx` because `getHumidorEnrichmentGaps` is not defined.
  - Rendered signed-in Playwright verification reports 0 console errors and 1 unrelated warning about the preloaded `assets/yuzu-logo.png` not being used quickly after load.

## 2026-05-26 Age Gate Navigation Pop-up Fix

- Investigated the reported intermittent age pop-up while navigating the storefront.
- Local Next.js 16.2.6 docs checked:
  - `node_modules/next/dist/docs/01-app/01-getting-started/04-linking-and-navigating.md`
  - `node_modules/next/dist/docs/01-app/01-getting-started/05-server-and-client-components.md`
  - `node_modules/next/dist/docs/01-app/02-guides/scripts.md`
  - `node_modules/next/dist/docs/01-app/03-api-reference/02-components/script.md`
  - `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/layout.md`
  - `node_modules/next/dist/docs/01-app/02-guides/static-exports.md`
- Root cause: the age-gate bootstrap was rendered through `next/script` with `strategy="beforeInteractive"`, but the emitted HTML queued it via `self.__next_s.push(...)` before the static age-gate markup. On hard/static navigations, confirmed visitors could see the server-rendered gate before the queued bootstrap hid it.
- Patched:
  - `src/app/layout.tsx`
  - `src/lib/age-gate-bootstrap.ts`
  - `tests/age-gate.test.ts`
- Fix:
  - Rendered the small first-party age-gate bootstrap as a synchronous inline script before `BackupAuthProvider`/`SiteChrome`.
  - Bootstrap now sets/removes the shared `data-yuzu-age-confirmed` document attribute before the gate markup is parsed, while keeping the existing style fallback.
  - Updated the regression test so stored confirmations require a synchronous bootstrap signal before app chrome can render.
- Verification completed:
  - Red regression: `node --import tsx --test tests/age-gate.test.ts` failed before the fix because the root layout still imported `next/script`.
  - `node --import tsx --test tests/age-gate.test.ts`
  - `node --import tsx --test tests/age-gate.test.ts tests/checkout-flow.test.ts`
  - `npm run lint`
  - `npx tsc --noEmit`
  - `npm test` - 349 tests passing
  - `npm run build` - Next.js 16.2.6 static export generated 993 pages.
  - Emitted HTML check confirmed `out/index.html` contains `<script id="yuzu-age-gate-bootstrap">` before `data-yuzu-age-gate="overlay"` and does not queue that bootstrap through `self.__next_s`.
  - Browser dev pass at `http://127.0.0.1:3022/`: confirmed visitor state kept the age overlay hidden on home, then through header navigation to `/shop/`, `/membership/`, `/humidor/`, `/cigar-flow/`, and `/education/`.
  - Static preview pass at `http://127.0.0.1:3024/`: confirmed visitor state survived reload and home -> `/shop/` navigation with `data-yuzu-age-confirmed="true"` and no visible age overlay.
- Browser console note: timestamped post-fix checks had no age-gate-related warnings/errors; the dev console still carries pre-existing reduced-motion/Framer Motion hydration warnings from shared motion components, plus one stale HMR-only raw-script warning emitted during the live code update before a fresh navigation check.

## 2026-05-24 Amplify Staging Deploy 119

- Deployed the current dirty worktree/static export to AWS Amplify staging after the Cigar Flow story-image persistence updates and other current workspace changes.
- Initial deploy helper invocation failed at its build step because local Python could not locate the Windows `npm` shim; followed the established workaround by running `npm run build` from PowerShell and rerunning the helper with `--skip-build`.
- Build completed with `npm run build`; Next.js 16.2.6 generated 993 static pages.
- Created POSIX-rooted deploy zip `yuzu-cigar-club-amplify-deploy-cigar-flow-story-images-2026-05-24-2026-05-24-171535.zip` with 9,148 entries and size 150,733,295 bytes.
- Verified deploy zip contains `index.html` and `_next/static/...` at archive root, with zero backslash paths and zero forbidden parent folders (`out/`, `.next/`, `node_modules/`, `output/`, `.git/`).
- AWS Amplify staging job `119` reached `SUCCEED`.
- Live smoke checks passed:
  - `https://staging.d2yxcklt245wh0.amplifyapp.com` returned HTTP `200`.
  - Referenced asset `/_next/static/chunks/0ebq2qcwehb8s.css` returned HTTP `200`.
  - `https://staging.d2yxcklt245wh0.amplifyapp.com/cigar-flow/` returned HTTP `200`.
- Upload/smoke checks used the deploy helper's curl fallback where local Python TLS strictness rejected the signed upload/live HTTPS checks.

## 2026-05-24 Cigar Flow Story Image Persistence Fix

- Investigated the reported Cigar Flow update cards showing generic/repeated artwork instead of images from the actual story.
- Root cause: live-published `news_stories` did not persist or return `images`, so `NewsStoryFeed` received empty story image arrays and fell back to source-derived keyword artwork; the daily Cigar Flow writer also did not submit the current feed-card images when it published an update.
- Patched:
  - `src/lib/newsroom.ts`
  - `src/lib/live-api.ts`
  - `src/components/newsroom-agent-panel.tsx`
  - `scripts/daily-cigar-news-run.ts`
  - `infra/lambda/ycc-api/index.js`
  - `tests/cigar-flow.test.ts`
  - `tests/lambda-ycc-api.test.ts`
- Fix:
  - Added normalized story image metadata to newsroom draft/publish contracts.
  - Persisted approved story images in `news_stories.metadata.images` and returned them from the public news stories API.
  - Updated the daily Cigar Flow writer to collect actual image URLs, crop positions, and source URLs from current non-member `cigarFlowItems`, then publish those images with the story.
  - Preserved story image metadata when the admin newsroom panel publishes a drafted story.
- Verification completed:
  - `node --import tsx --test tests/lambda-ycc-api.test.ts`
  - `node --import tsx --test tests/cigar-flow.test.ts`
  - `npx tsc --noEmit`
  - `npm run lint`
  - `npm test` - 346 tests passing
  - `npm run build` - Next.js 16.2.6 static export generated 993 pages
  - Browser smoke check at `http://127.0.0.1:3022/cigar-flow/#cigar-flow-news`: page loaded without framework overlay or console warnings/errors, Cigar Flow news card reported `data-news-story-images="story-provided"`, and the rendered card loaded the Matilde story image URL from the feed instead of source-derived fallback art.
- Verification note: the first `npm run build` invocation exceeded the shell timeout but continued running; reran with a longer timeout and captured a successful build.

## 2026-05-24 Console/Test Issue Fix Pass

- Rechecked the previously reported Cigar Flow/newsroom failures; fresh focused and full test runs now pass, confirming the earlier failure output was stale relative to the current dirty worktree state.
- Fixed shared browser console issues found on `/education`:
  - `src/components/site-header.tsx`: changed always-visible header and cart badge motion to hydration-stable `initial={false}`.
  - `src/components/motion-primitives.tsx`: changed `PageFade` to hydration-stable `initial={false}`.
  - `src/components/floating-concierge.tsx`: removed reduced-motion-dependent launcher initial state, kept launcher motion hydration-stable, and removed the animated box-shadow that contributed to style mismatches.
  - `src/components/reference-image.tsx`: priority images now set `loading="eager"` so above-the-fold LCP candidates do not trigger the Next.js dev warning.
- Added `tests/site-chrome-console-health.test.ts` to guard the hydration-stable motion and priority image loading behavior.
- Browser verification at `http://127.0.0.1:3022/education?console-health=2#hyperframes-videos`:
  - Page identity and meaningful content passed.
  - No framework overlay found.
  - Timestamp-filtered fresh console warnings/errors: `0`.
  - Compact video shelf still rendered with 12 videos; first video pane around `313x175`.
  - Hero image reported `loading="eager"`.
  - Browser screenshot capture still times out on the video-heavy section, so DOM/console metrics were used as rendered evidence.
- Verification completed:
  - `node --import tsx --test tests/site-chrome-console-health.test.ts tests/education-video-library.test.ts`
  - `npm run lint`
  - `npx tsc --noEmit`
  - `npm test` - 349 tests passing
  - `npm run build` - Next.js 16.2.6 static build succeeded with 993 generated pages.

## 2026-05-24 Demo Humidor Cigar Images

- Replaced the anonymous humidor demo's repeated 1x1 inline PNG placeholder with the existing generated public cigar image assets:
  - `/assets/product-padron.png`
  - `/assets/product-davidoff.png`
  - `/assets/product-liga.png`
  - `/assets/product-plasencia.png`
- Added optional `imageUrl` support to `HumidorCigarImage` and updated the humidor dashboard renderer to display either live uploaded `dataUrl` images or static public demo asset URLs.
- Added a regression in `tests/humidor-dashboard.test.ts` requiring every demo cigar to use a distinct public PNG asset with enough image detail, and to avoid inline placeholder data URLs.
- Verification completed:
  - `node --import tsx --test tests/humidor-dashboard.test.ts`
  - `npx tsc --noEmit`
  - `npm run lint`
  - `npm run build` - after waiting for another active `next build` process to clear
- Full suite note: `npm test` ran 348 tests with 346 passing and 2 unrelated failures in `tests/site-chrome-console-health.test.ts`:
  - `site chrome keeps always-visible motion styles hydration-stable` expected `src/components/site-header.tsx` to include `initial={false}`.
  - `priority reference images request eager loading for LCP candidates` expected `src/components/reference-image.tsx` to include `loading={priority ? "eager" : "lazy"}`.
- Rendered verification:
  - Static preview is running at `http://localhost:3024/humidor/`.
  - Browser DOM checks on desktop and a 390x844 mobile viewport found all four demo row thumbnails complete with the expected public asset sources and zero console warnings/errors.
  - Detail interaction proof: clicking `Signature No. 2` opened the detailed cigar card with `/assets/product-davidoff.png`.
  - Browser screenshot capture timed out via the in-app Browser CDP path; DOM, image natural-size, and interaction checks passed.

## 2026-05-24 Cigar Flow Daily Newsroom Refresh CI Fix

- Investigated the failed scheduled GitHub Actions run `26365888858` for `Cigar Flow Daily Newsroom Refresh` on branch `codex/production-launch-phase-0-2` at commit `4153ef85ba75b35a3da291c3397fc77f620ab43c`.
- Confirmed there is no open PR for the branch; this was a scheduled workflow failure, not a PR check.
- Root cause: `scripts/daily-cigar-news-run.ts` authenticated successfully, then failed on `POST /news/story-drafts` with `502 news_story_generation_failed` / `YCCNewsAgent did not return a publication-ready story draft`; the script exited after the first fixed source batch even though recent runs on the same commit showed the backend can succeed with usable source context.
- Added `tests/daily-cigar-news-run.test.ts`, an integration-style regression with a local fake newsroom API that reproduces the first-attempt `502` and requires the writer to retry with another official source batch before publishing.
- Patched `scripts/daily-cigar-news-run.ts` so daily draft generation:
  - ranks official sources toward news/press URLs for automation,
  - logs bounded draft attempts,
  - retries only draft-generation/placeholder failures with the next official source batch,
  - still fails immediately for non-draft errors such as publish failures.
- Verification completed:
  - Red regression: `node --import tsx --test tests/daily-cigar-news-run.test.ts` failed before the fix with the same first-attempt `502`.
  - `node --import tsx --test tests/daily-cigar-news-run.test.ts`
  - `node --import tsx --test tests/daily-cigar-news-run.test.ts tests/cigar-flow.test.ts tests/newsroom-agent.test.ts`
  - `npx tsc --noEmit`
  - `npm run lint`
  - `npm test` - 349 tests passing
- Follow-up: the GitHub Actions schedule will not use this local fix until the dirty worktree changes are committed and pushed; after that, rerun `Cigar Flow Daily Newsroom Refresh` or wait for the next schedule.

## 2026-05-24 Education Video Library Compact Pass

- Minimized the `Watch the Yuzu story in short cuts.` video library cards in `src/components/education-video-library.tsx`.
- Reduced the section/card footprint with narrower max width, tighter panel padding/shadows, a denser `sm`/`lg`/`2xl` grid, capped video preview height, smaller headings, and two-line descriptions while preserving video controls and accessible video labels.
- Added `tests/education-video-library.test.ts` to lock the compact shelf behavior.
- Verification completed:
  - Red/green focused TDD pass with `node --import tsx --test tests/education-video-library.test.ts`.
  - `npm run lint`
  - `npx tsc --noEmit`
  - Browser check at `http://127.0.0.1:3022/education#hyperframes-videos` showed the compact shelf rendering with 12 videos, 3 desktop columns, and first video pane around `313x175`.
  - Mobile viewport check at `390x844` showed 1 column and first video pane around `299x167`.
- Browser console still reports pre-existing site-wide warnings/errors unrelated to this component: reduced-motion warning, Framer Motion hydration style mismatch in shared chrome, and an LCP image warning.
- Full `npm test` was attempted and is currently blocked by unrelated Cigar Flow/newsroom failures, including `daily cigar flow writer submits actual feed story images`, `news story publish route stores actual story image metadata`, `public news stories route returns published stories without Cognito`, and undefined newsroom image helper references (`normalizeNewsStoryImages`, `mergeNewsStoryImages`).

## 2026-05-22 Amplify Staging Deploy 118

- Deployed the current dirty worktree/static export to AWS Amplify staging with the project deploy helper.
- Build completed with `npm run build`; Next.js 16.2.6 generated 993 static pages.
- Deploy helper note: direct script build launch failed because Python could not locate the Windows `npm` shim, so the build was run from PowerShell and the helper was rerun with `--skip-build` for packaging/upload/polling/smoke checks.
- Created POSIX-rooted deploy zip `yuzu-cigar-club-amplify-deploy-updates-2026-05-22-2026-05-22-152854.zip` with 9,148 entries and size 150,743,317 bytes.
- Verified deploy zip contains `index.html` and `_next/static/...` at archive root, with zero backslash paths and zero forbidden parent folders (`out/`, `.next/`, `node_modules/`, `output/`, `.git/`).
- AWS Amplify staging job `118` reached `SUCCEED`.
- Live smoke checks passed:
  - `https://staging.d2yxcklt245wh0.amplifyapp.com` returned HTTP `200`.
  - Referenced asset `/_next/static/chunks/00q~9ek7lf_76.css` returned HTTP `200`.
- Upload/smoke checks used the deploy helper's curl fallback for local Python TLS strictness against the signed upload URL/live HTTPS checks.

## 2026-05-22 Cohiba Riviera Inventory Removal

- Removed the requested `COHIBA RIVIERA BOX PRESS TORO 20/BX` inventory item from `src/lib/imported-inventory.ts`.
- Removed its associated imported product description and market-price entry for SKU `572603`.
- Updated catalog tests so the retired slug/SKU must remain absent from published imported inventory, catalog products, storefront products, imported descriptions, and imported market prices.
- Updated catalog count expectations after the removal: `catalogProducts.length` is now `961`, and the luxury catalog bucket is now `19`.
- Refreshed the static export with `npm run build`; the retired slug was not found in `out/`.
- Verification completed:
  - `node --import tsx --test tests/product-detail.test.ts`
  - `node --import tsx --test tests/commerce-schema.test.ts`
  - `npx tsc --noEmit`
  - `npm run lint`
  - `npm test` - 342 tests passing
  - `npm run build`
  - `rg -n -i "COHIBA RIVIERA BOX PRESS TORO 20/BX|cohiba-riviera-box-press-toro-20-bx|572603|\b962\b" src public tests infra scripts knowledge package.json out` only finds the regression-test constants for the retired slug/SKU.
- Build note: the first build attempt reported another active `next build` process. Waited for that process to exit, then reran `npm run build` successfully.

## 2026-05-22 Display Name Login Audit

- Started investigation for a reported account bug where the display name reverts to a value the user did not enter.
- Initial `git status --short` shows a broad pre-existing dirty worktree, including modified auth/account areas (`src/components/backup-auth-*`, `src/lib/cognito-auth.ts`, `tests/account-auth-boundary.test.ts`, `tests/cognito-auth.test.ts`) and the ledger itself currently untracked as `docs/codex-worktree-tracking.md`.
- Will preserve existing local changes and scope this pass to root-causing, testing, and fixing display-name persistence plus a login audit with a fresh test account where the local environment allows it.
- Root cause confirmed: `hydrateCognitoSessionFromProfile` rebuilt a Cognito session from the ID token, then preferred token claim values over the locally saved storefront profile snapshot. A stale Cognito `name` claim could overwrite the display name saved in Account Details on the next login or token refresh.
- Added a failing regression in `tests/cognito-auth.test.ts` for a test account whose token still says `Directory Member` after the storefront profile was edited to `Test Account Pilot`; the test failed before the fix with the stale token name.
- Fixed `src/lib/cognito-auth.ts` so saved storefront profile fields win during Cognito session hydration, including display name, phone, and saved shipping address fields when present.
- Verified the focused regression with `node --import tsx --test tests/cognito-auth.test.ts`.
- Created temporary Cognito audit user `codex-login-audit-20260522150135@example.com` in user pool `us-east-1_63U9PflAX`, signed in through the local account page, saved display name `Test Account Pilot`, signed out, signed back in, and confirmed the display name remained `Test Account Pilot` instead of reverting to `Directory Member`.
- Cleaned up the temporary Cognito audit user and removed the local scratch credential file after verification.
- Login audit notes from the local browser pass:
  - Cognito password sign-in succeeded and issued a browser session.
  - Account profile save showed `Account details saved.`
  - Re-login preserved the edited display name.
  - Localhost logout redirects to a Cognito `/error` page because `http://localhost:3010/auth/logout` is not an allowed logout URL for this user-pool client.
  - Live account API calls from local dev showed `Failed to fetch`, consistent with production/staging CORS allowlists not including localhost for this stack.
  - Browser console also showed a pre-existing React hydration mismatch warning tied to animated UI styles; this pass did not change animation components.

## 2026-05-22 Cigar Flow News Consolidation

- Removed the standalone public `News` navigation tab from `src/lib/data.ts` so news discovery is consolidated into Cigar Flow.
- Updated the admin newsroom publish notice to send operators to `/cigar-flow#cigar-flow-news` instead of the separate news page.
- Added optional story image metadata to `NewsStory` and wired `NewsStoryFeed` to prefer explicit story images before keyword/source fallbacks.
- Updated the fallback `Cigar Flow Update: May 14 Edition` with three actual feed-story images and source URLs for the Matilde, Rocky Patel, and Camacho cards.
- Added focused test expectations in `tests/cigar-flow.test.ts` and `tests/newsroom-ui.test.ts` for the removed tab and story-provided image path.
- Verification completed:
  - `node --import tsx --test tests/cigar-flow.test.ts tests/newsroom-ui.test.ts`
  - `npm run lint`
  - `npx tsc --noEmit`
  - `npm test` - 339 tests passing
  - Browser smoke check at `http://localhost:3010/cigar-flow/`: public nav no longer exposes `News`, `#cigar-flow-news` renders, and the Cigar Flow Update image panel reports `data-news-story-images="story-provided"` with the three configured story images loaded.
- Newly observed unrelated dirty/untracked event work during verification: modified `tests/events-experience.test.ts` plus untracked `src/lib/event-schedule.ts`, `src/components/auto-updating-event-grid.tsx`, `src/components/event-clock.ts`, and `src/components/home-event-feature.tsx`. Left untouched.

## 2026-05-22 Requested Cigar Inventory Import

- Added the requested missing cigar rows to the generated shop catalog while avoiding duplicates for products that were already present.
- Reconciled `572590` from an unrelated Romeo y Julieta placeholder into `MY FATHER LA ANTIGUEDAD SUPER TORO 20/BX`, including its market price so it publishes with the requested box price.
- Added local product imagery under `public/assets/inventory/cigars/` for the requested rows that needed shop-format images.
- Added/updated product data in:
  - `src/lib/imported-inventory.ts`
  - `src/lib/imported-market-prices.ts`
  - `src/lib/imported-product-descriptions.ts`
  - `src/lib/catalog.ts`
- Added test coverage in:
  - `tests/product-detail.test.ts`
  - `tests/commerce-schema.test.ts`
- Notable SKU handling:
  - `572722` was not reused for Nica Rustica Gordo because existing inventory and source imagery identify that SKU as a La Gloria Cubana sampler.
  - Items with no readable source SKU were added with `MISSING-SKU-*` identifiers so they can still publish and be corrected later.
  - The two Liga Privada H99 Papas Fritas rows were preserved as separate products by marking `572745` as an alternate variant.
- Verification completed:
  - `npx tsx --test tests/product-detail.test.ts`
  - `npx tsc --noEmit`
  - `npm run lint`
  - `npm test` - 337 tests passing
  - `npm run build`
  - Static preview smoke check at `http://127.0.0.1:3004/shop/my-father-blue-toro-20-bx/` returned HTTP 200 and contained the title and price text.

## 2026-05-22 Butane / Fluid Category Audit

- Reviewed the storefront `Butane / Fluid` category and confirmed the existing scheme for published fuel rows: public/non-member price equals researched online retailer price, member price is 10% below that price.
- Checked current online references for Special Blue, Neon, Ronson, Ultra Pure, Vector, Zippo, Clipper, Gold Whip, and Cartwright match rows.
- Added `docs/butane-fluid-pricing-audit-2026-05-22.md` with source notes, hidden-row decisions, and the category hygiene finding.
- Recategorized `Z-ZEUS ZERO "GREEN" DOUBLE FLAME TORCH` (`41205`) from `Butane / Fluid` to `Lighters / Torch`, preserving its Sunset source image through a catalog override.
- Tightened `tests/product-pricing.test.ts` so every published fuel product in `Butane / Fluid` must have a researched price target and member prices must equal 90% of market price.
- Left zero-price or missing-image fuel rows unpublished until a current public price, member price, and usable image are confirmed.
- Verification completed:
  - `node --import tsx --test tests/product-pricing.test.ts`
  - `node --import tsx --test tests/product-detail.test.ts`
  - `npx tsc --noEmit`
  - `npm run lint`
- Verification note: `node --import tsx --test tests/shop-categories.test.ts` is still failing on unrelated wrapper-only cigar categories (`Connecticut Wrapper`, `Corojo Wrapper`, `Gordo`, `Habano Wrapper`, `Maduro Wrapper`, `Natural Wrapper`); the new `41205` category expectation passes once that pre-existing category cleanup is addressed.

## 2026-05-22 Shop Category E2E Audit Closure

- Completed the requested end-to-end storefront category audit across published catalog data, storefront category filters, sitemap category URLs, and the built static `/shop` page.
- Patched:
  - `src/lib/catalog.ts`
  - `tests/shop-categories.test.ts`
  - `tests/product-detail.test.ts`
- Fix:
  - Added product-type category normalization for published catalog rows before falling back to source categories.
  - Routed sampler/fresh-pack rows to `Sample Packs`.
  - Routed product-name humidor rows to `Humidors` instead of luxury/premium cigar price tiers.
  - Routed fuel and match rows to `Butane / Fluid`.
  - Routed lighter/torch hardware to `Lighters / Torch`.
  - Mapped wrapper/vitola-only source buckets (`Connecticut Wrapper`, `Corojo Wrapper`, `Gordo`, `Habano Wrapper`, `Maduro Wrapper`, `Natural Wrapper`) into price-tier cigar categories so the shop no longer exposes attribute-only labels as browse categories.
  - Guarded lighter image selection so only known local lighter assets use `/assets/inventory/lighters/*-single-lighter.jpg`; other classified torch rows keep their source image URL/override.
- Audit result after fix:
  - Published storefront products: 961.
  - Storefront categories: 19.
  - Blank catalog categories: 0.
  - Blank storefront categories: 0.
  - Built `/shop?category=Humidors#catalog` static preview showed the `Humidors` filter pressed, `Showing 2 of 2 matched catalog items`, and no wrapper-only/Gordo filters.
- Verification completed:
  - `node --import tsx --test tests/shop-categories.test.ts`
  - `node --import tsx --test tests/product-detail.test.ts`
  - `node --import tsx --test tests/shop-categories.test.ts tests/product-detail.test.ts tests/product-pricing.test.ts tests/seo-metadata.test.ts`
  - `npm run lint`
  - `npx tsc --noEmit`
  - `npm test` - 342 tests passing
  - `npm run build`
  - Browser/static preview smoke check at `http://127.0.0.1:3017/shop?category=Humidors#catalog`

## 2026-05-22 Event Auto-Update Fix

- Investigated the Events page after the report that no new events were showing.
- Root cause: public Yuzu events were rendered directly from the static `events` array, and the home page featured `events[0]`, so the May 7 event could remain visible/featured after it had already passed.
- Patched:
  - `src/lib/data.ts`
  - `src/lib/event-schedule.ts`
  - `src/components/event-clock.ts`
  - `src/components/auto-updating-event-grid.tsx`
  - `src/components/home-event-feature.tsx`
  - `src/app/events/page.tsx`
  - `src/app/page.tsx`
  - `tests/events-experience.test.ts`
- Fix:
  - Added explicit `startsAt`/`endsAt` event timestamps.
  - Added shared schedule helpers to filter ended events, promote events happening now, and label events as Today/Upcoming/Happening now.
  - Moved Events page cards and home featured event to client-side date-aware components so the static export corrects itself in the browser.
  - Preserved static detail route generation for all configured event slugs.
- Verification completed:
  - `node --import tsx --test tests/events-experience.test.ts`
  - `npx tsc --noEmit`
  - `npm run lint`
  - `npm test` - 339 tests passing
  - `npm run build`
  - Static preview at `http://127.0.0.1:3005/events/` returned HTTP 200.
  - Browser DOM verification at `/events/` showed `founder-reserve-tasting` first with status `today`, upcoming cards for June 6 and June 18, and no May 7 `aire-by-puro-open-event` card.

## Current Admin Backend Scope

Implemented and verified in this pass:

- `src/components/admin/backend-admin-console.tsx`
  - Added live Customer Orders and User Access panels.
  - Added order fulfillment/compliance actions.
  - Added member role/status access actions.
  - Hardened empty or partial backend responses.
- `src/components/site-chrome.tsx`
  - Wrapped admin/auth routes in `CartProvider` without rendering public site chrome so admin routes do not crash when shared auth UI links reference cart-aware components.
- `src/lib/live-api.ts`
  - Added admin order/member response types.
  - Added `GET /admin/commerce/orders`, `PATCH /admin/commerce/orders/:id`, `GET /admin/members`, and `PATCH /admin/members/:id/access` client calls.
- `infra/lambda/ycc-api/index.js`
  - Added admin order list/update handlers.
  - Added admin member access list/update handlers.
  - Added audit logging for admin mutations.
  - Confirmed Stripe subscription webhook persistence and membership entitlement flow.
- `infra/ycc-phase1-edge.yaml`
  - Added JWT-protected admin routes.
  - Added `PATCH` support in CORS.
- Tests updated:
  - `tests/admin-backend-api.test.ts`
  - `tests/admin-static-boundary.test.ts`
  - `tests/api-gateway-contract.test.ts`
  - `tests/lambda-ycc-api.test.ts`

## Verification Already Run

All passed after the admin/backend work:

- `npx tsc --noEmit`
- `npm run lint`
- `npm test` - 333 tests passing
- `npm run build`
- Browser smoke check of static export at `http://127.0.0.1:3002/admin/console/`

## Current Dirty Inventory

Tracked modified files currently reported by `git status --short`:

- `.env.example`
- `.gitignore`
- `docs/aws-live-architecture-setup.md`
- `docs/lighter-image-sources.json`
- `docs/production-launch-runbook.md`
- `docs/superpowers/plans/2026-05-07-yuzu-production-launch-readiness.md`
- `eslint.config.mjs`
- `infra/lambda/ycc-api/README.md`
- `infra/lambda/ycc-api/commerce-rules.js`
- `infra/lambda/ycc-api/index.js`
- `infra/lambda/ycc-api/stripe-commerce.js`
- `infra/ycc-phase1-edge.yaml`
- `knowledge/ycc-kb/membership.md`
- `knowledge/ycc-kb/support-compliance.md`
- `package-lock.json`
- `package.json`
- `public/assets/inventory/lighters/31119-single-lighter.jpg`
- `public/assets/inventory/lighters/31120-single-lighter.jpg`
- `public/assets/inventory/lighters/46853-single-lighter.jpg`
- `public/assets/inventory/lighters/69493-single-lighter.jpg`
- `public/assets/inventory/lighters/69494-single-lighter.jpg`
- `public/assets/inventory/lighters/69496-single-lighter.jpg`
- `public/assets/inventory/lighters/76078-single-lighter.jpg`
- `public/assets/inventory/lighters/77086-single-lighter.jpg`
- `public/assets/inventory/lighters/85319-single-lighter.jpg`
- `public/assets/inventory/lighters/85321-single-lighter.jpg`
- `public/sw.js`
- `scripts/check-rds-connection.ts`
- `scripts/launch-readiness.ts`
- `src/app/checkout/success/page.tsx`
- `src/app/cigar-flow/page.tsx`
- `src/app/globals.css`
- `src/app/page.tsx`
- `src/app/shop/page.tsx`
- `src/app/sitemap.ts`
- `src/components/admin/backend-admin-console.tsx`
- `src/components/age-gate.tsx`
- `src/components/backup-auth-panel.tsx`
- `src/components/backup-auth-provider.tsx`
- `src/components/benefit-strip.tsx`
- `src/components/checkout-experience.tsx`
- `src/components/floating-concierge.tsx`
- `src/components/humidor-dashboard.tsx`
- `src/components/member-view-banner.tsx`
- `src/components/membership-join-button.tsx`
- `src/components/membership-tier-grid.tsx`
- `src/components/news-story-feed.tsx`
- `src/components/newsroom-agent-panel.tsx`
- `src/components/product-card.tsx`
- `src/components/shop-catalog.tsx`
- `src/components/site-chrome.tsx`
- `src/components/site-footer.tsx`
- `src/components/site-header.tsx`
- `src/lib/age-verification.ts`
- `src/lib/catalog.ts`
- `src/lib/cigar-flow.ts`
- `src/lib/cognito-auth.ts`
- `src/lib/data.ts`
- `src/lib/humidor-devices.ts`
- `src/lib/imported-inventory.ts`
- `src/lib/imported-market-prices.ts`
- `src/lib/imported-product-descriptions.ts`
- `src/lib/live-api.ts`
- `src/lib/newsroom.ts`
- `src/lib/shopping-cart.ts`
- `src/lib/stripe-checkout.ts`
- `tests/account-auth-boundary.test.ts`
- `tests/admin-backend-api.test.ts`
- `tests/admin-static-boundary.test.ts`
- `tests/api-gateway-contract.test.ts`
- `tests/checkout-flow.test.ts`
- `tests/cigar-flow.test.ts`
- `tests/cognito-auth.test.ts`
- `tests/commerce-rules.test.ts`
- `tests/commerce-schema.test.ts`
- `tests/database-readiness.test.ts`
- `tests/humidor-dashboard.test.ts`
- `tests/humidor-devices.test.ts`
- `tests/lambda-ycc-api.test.ts`
- `tests/launch-readiness.test.ts`
- `tests/live-page-editor.test.ts`
- `tests/membership-data.test.ts`
- `tests/membership-join-button.test.ts`
- `tests/newsroom-agent.test.ts`
- `tests/newsroom-ui.test.ts`
- `tests/product-detail.test.ts`
- `tests/product-pricing.test.ts`
- `tests/seo-metadata.test.ts`
- `tests/service-worker.test.ts`
- `tests/shop-categories.test.ts`
- `tests/shopping-cart.test.ts`
- `tests/stripe-commerce.test.ts`

## 2026-05-21 Unresolved-Issue Sweep

- Ran a repository-wide marker scan for unresolved-code placeholders across source/docs/tests (`TODO`, `FIXME`, `XXX`, `HACK`, `UNRESOLVED`) excluding binary/cache folders.
- Result: no code-level TODO/FIXME/HACK/XXX markers were found.
- Found one documentation-only mention at `docs/production-launch-runbook.md:132` with operational context text about checking support queue volume and unresolved launch incidents; no code TODO-like marker requiring immediate code action.

## 2026-05-21 Deeper Unresolved-Issue Sweep (Operational/Code Hygiene)

- Ran additional code-hygiene scans for: `console` debug usage in src/tests/infra, TypeScript suppression directives (`@ts-ignore`, `@ts-nocheck`, `as any`), empty catch blocks, and explicit unresolved placeholders.
- Result: no new unresolved technical debt markers were found in source or infra code.
- `console` usage found is predominantly in scripts and test/diagnostic paths (`scripts/check-rds-connection.ts`, `scripts/daily-cigar-news-run.ts`, `scripts/launch-readiness.ts`, `scripts/static-preview.mjs`) and exception logging in edge/runtime paths; these appear operational by intent and not clearly production blockers.
- No additional unresolved items discovered that clearly require code changes from this pass.

## 2026-05-21 Module-Specific Unresolved-Issue Sweep (Admin Commerce, Checkout, Age-Gate, Newsroom/Concierge)

- Focused read pass reviewed:
  - `src/components/floating-concierge.tsx`
  - `src/components/newsroom-agent-panel.tsx`
  - `src/app/checkout/success/page.tsx`
  - `src/components/checkout-experience.tsx`
  - `src/components/agechecker-verification.tsx`
  - `src/app/admin/console/page.tsx`
  - `src/components/admin/backend-admin-console.tsx`
  - `src/lib/age-verification.ts`
  - `src/lib/stripe-checkout.ts`
  - `src/lib/live-api.ts`
  - `src/lib/newsroom.ts`
  - `infra/lambda/ycc-api/index.js`
  - `infra/lambda/ycc-api/commerce-rules.js`
- Result: no new unresolved code-quality blockers found in these modules.
- No immediate follow-up implementation required from this pass.

## 2026-05-21 Follow-up Unresolved-Check (Checkout/Concierge/Commerce Hardening)

- Performed a follow-up read pass over:
  - `infra/lambda/ycc-api/index.js` around checkout status token validation, JSON parsing helpers, concierge audio parsing, and route/path helpers
  - `infra/lambda/ycc-api/stripe-commerce.js` checkout session metadata generation
  - `infra/lambda/ycc-api/commerce-rules.js` checkout readiness validation
- High-signal findings:
  - No blocking unresolved defects confirmed.
  - Resolved in the follow-up fix below: the checkout status/token path now tolerates malformed `event.rawPath` percent-encoding without throwing before request routing.

## 2026-05-21 Checkout Route Hardening Fix Applied

- Patched:
  - [infra/lambda/ycc-api/index.js:9554](C:/Users/qfash/Documents/New project/infra/lambda/ycc-api/index.js)
- Fix:
  - Wrapped `decodeURIComponent` in `extractLastPathSegment` with a safe `try/catch` fallback to prevent malformed URL path segments from throwing before request routing.
- Result:
  - The identified unresolved issue is now resolved with a defensive decode path.

## 2026-05-22 Unresolved-Issue E2E Closure

- Patched:
  - [tests/lambda-ycc-api.test.ts](C:/Users/qfash/Documents/New project/tests/lambda-ycc-api.test.ts)
- Fix:
  - Updated the malformed checkout status path test so it now expects the post-fix controlled `invalid_checkout_session` response instead of the old `internal_error` failure.
  - Confirmed the handler reaches Stripe session retrieval with the raw malformed path segment fallback, proving the defensive decode path works end-to-end through the route handler.
- Result:
  - No unresolved checkout path decode issue remains in the code or the ledger.
- Verification:
  - `node --import tsx --test tests/lambda-ycc-api.test.ts` passed with 79 tests.
  - `npm test` passed with 337 tests.
  - Final unresolved-marker scan found only historical ledger section titles and a package-lock integrity hash substring, not actionable source markers.

Untracked paths currently reported:

- `.nvmrc`
- `customHttp.yml`
- `public/assets/inventory/lighters/81274-single-lighter.jpg`
- `public/assets/inventory/lighters/85318-single-lighter.jpg`
- `scripts/configure-ycc-commerce-secret.ps1`
- `scripts/static-preview.mjs`
- `src/app/privacy/`
- `src/app/terms/`
- `src/components/agechecker-verification.tsx`
- `src/components/motion-primitives.tsx`
- `tests/static-export-runtime.test.ts`
- `yuzu-membership-explainer/`

## Audit Queue

Use this order for follow-up cleanup and fixes:

1. Backend and commerce runtime
   - `infra/lambda/ycc-api/*`
   - `infra/ycc-phase1-edge.yaml`
   - `src/lib/stripe-checkout.ts`
   - `src/lib/age-verification.ts`
   - `src/components/checkout-experience.tsx`
2. Admin/auth/account routes
   - `src/components/backup-auth-*`
   - `src/lib/cognito-auth.ts`
   - `src/components/admin/backend-admin-console.tsx`
3. Storefront and catalog presentation
   - `src/app/page.tsx`
   - `src/app/shop/page.tsx`
   - `src/components/shop-catalog.tsx`
   - `src/components/product-card.tsx`
   - imported inventory and image assets
4. Humidor/newsroom/cigar-flow
   - humidor components and tests
   - newsroom components and tests
   - cigar-flow data and UI
5. Docs, scripts, and deploy tooling
   - docs and KB files
   - `scripts/*`
   - package changes
   - static preview and deployment packaging helpers

## 2026-05-20 Deploy Certificate Trust Investigation

- Investigated Amplify deploy certificate failures from the bundled deploy script.
- Found `ycc-mcp` has `ca_bundle = C:\Users\qfash\.config\yuzu\windows-ca-bundle.pem`, but `ycc-mcp-source` is a credentials-only profile, so direct AWS CLI calls through `--profile ycc-mcp-source` need `AWS_CA_BUNDLE` or a matching config profile entry.
- Confirmed local Python is 3.13.13 with OpenSSL 3.0.19 and default `ssl.create_default_context()` enables `VERIFY_X509_STRICT`.
- Reproduced Python TLS failures against AWS endpoints without signed URLs; strict verification fails with `Basic Constraints of CA cert not marked critical`, while clearing only `VERIFY_X509_STRICT` succeeds.
- Confirmed local TLS for `s3.amazonaws.com` is being issued by `AVG Web/Mail Shield Root`, and `windows-ca-bundle.pem` includes that CA with non-critical Basic Constraints.
- `global-bundle.pem` did not contain non-critical CA entries, but it also did not trust the locally intercepted AVG-issued AWS chain.
- Configured the `ycc-mcp-source` AWS profile to use `C:\Users\qfash\.config\yuzu\windows-ca-bundle.pem` so AWS CLI calls through that profile trust the local intercepting root.
- Updated the local `deploy-yuzu-amplify` skill script to avoid printing sensitive deployment output and to retry signed URL uploads and smoke checks with `curl.exe` when Python's strict TLS verification rejects the AVG-issued chain.
- Deployed the current static build to Amplify staging after the fallback fix; job `117` succeeded and smoke checks returned HTTP `200`.
- Confirmed `https://www.yuzucigarclub.com/privacy/`, `https://www.yuzucigarclub.com/terms/`, and `https://www.yuzucigarclub.com/sitemap.xml` return HTTP `200`.
- Rechecked SES `us-east-1`: `ProductionAccessEnabled=false`, review status `DENIED`, case `177809591700724`, quota `200/day` and `1/sec`, sent last 24 hours `0`.
- Attempted SES production-access resubmission with `sesv2 put-account-details --production-access-enabled`; AWS returned `ConflictException`, so the next step is a Support Center appeal or case reopen rather than another API submission.

## Working Rules

- Do not revert unknown local changes.
- When a dirty file is touched, read its diff first and preserve intentional work.
- Add concrete fixes with focused tests where possible.
- Re-run `npm run lint`, `npm test`, and `npm run build` after any broad cleanup batch.
- Keep this file updated as areas are audited or fixed.
