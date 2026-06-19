# Yuzu Production Launch Readiness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move Yuzu Cigar Club from a static storefront MVP into a production-ready, regulated ecommerce launch using Stripe for payments and billing.

**Architecture:** Keep the Next.js storefront as a static export for Amplify, and put sensitive work behind the existing AWS API Gateway/Lambda backend. Stripe handles payment processing, billing, Checkout Sessions, Products, and Prices, while the Yuzu backend remains the system of record for inventory, orders, compliance decisions, age-verification status, memberships, humidor data, support, and audit logs.

**Tech Stack:** Next.js 16.2.4 static export, React 19.2.4, Tailwind 4, Node Lambda on AWS API Gateway, RDS PostgreSQL through RDS Proxy, Cognito, SES, Bedrock, Stripe Checkout/Billing/Tax, Vitest-equivalent Node test runner via `node --import tsx --test`.

---

## Source Checks

Use these current official sources before implementing payment, tobacco, shipping, or launch changes:

- Stripe restricted businesses: https://stripe.com/en-br/legal/restricted-businesses
- Stripe Checkout: https://docs.stripe.com/payments/checkout
- Stripe fulfillment webhooks: https://docs.stripe.com/checkout/fulfillment
- Stripe Products and Prices: https://docs.stripe.com/products-prices/how-products-and-prices-work
- Stripe Tax: https://docs.stripe.com/tax
- Stripe go-live checklist: https://docs.stripe.com/get-started/checklist/go-live
- FDA Tobacco 21: https://www.fda.gov/tobacco-products/retail-sales-tobacco-products/tobacco-21
- USPS Adult Signature service: https://faq.usps.com/articles/Knowledge/Adult-Signature-Required-and-Adult-Signature-Restricted-Delivery-Services

## Current Audit Baseline

This is the starting point that must be true before execution begins:

- `npm run lint` passes.
- `npm run build` fails because `src/app/member-drops/page.tsx` and `src/app/new-arrivals/page.tsx` import `products` from `src/lib/data.ts`, but catalog products now live in `src/lib/catalog.ts`.
- `npm test` currently has 4 failing tests: product detail copy expectation, shop category data import, shop sidebar category links, and shop catalog URL query synchronization.
- `npx tsc --noEmit` fails because of the missing product export plus test typing issues.
- `npm run db:check` times out against the configured RDS/PostgreSQL target.
- `npm audit --omit=dev` reports moderate issues through `shadcn`/`@modelcontextprotocol/sdk`/`express-rate-limit`/`ip-address` and Next's internal PostCSS dependency.
- The repo has large launch artifacts at the project root and in `output/`; root zip files total roughly 2.6 GB and `output/` is roughly 927 MB.
- The app uses `output: "export"` in `next.config.ts`, so Next route handlers, cookies, server actions, middleware, and other runtime server features are not available in the deployed static frontend.
- `out/` is stale until a fresh `npm run build` succeeds.

## Launch Gate Summary

| Phase | Name | Blocks Launch? | Exit Gate |
| --- | --- | --- | --- |
| 0 | Governance and Repo Hygiene | Yes | Worktree is clean enough to trust, junk artifacts ignored, and launch-critical changes can be reviewed. |
| 1 | Build, Type, and Test Recovery | Yes | `npm run lint`, `npm run build`, `npm test`, and `npx tsc --noEmit` pass locally. |
| 2 | Production Architecture Decision | Yes | Static frontend plus AWS API contract is documented and environment variables are settled. |
| 3 | Data and Catalog Backbone | Yes | Catalog, inventory, Stripe IDs, and database order tables have a single source of truth. |
| 4 | Regulated Commerce Compliance | Yes | Age, destination, shipping, tax, and audit rules are enforced before checkout. |
| 5 | Stripe Commerce Integration | Yes | Checkout, subscriptions, webhooks, refunds, and Customer Portal work in Stripe test mode. |
| 6 | Frontend Shopping Flow | Yes | Cart, checkout redirect, success/cancel, account, and membership flows use the backend contract. |
| 7 | Auth, Admin, and Operations | Yes | Real auth/RBAC replaces local backup admin for production operations. |
| 8 | SEO, Content, and Product Discoverability | No, but launch-critical for growth | Product/event sitemap, metadata, schema, and category URLs are complete. |
| 9 | Infrastructure Hardening | Yes | RDS, VPC, WAF, secrets, SES, alarms, backups, and IAM meet production standards. |
| 10 | QA, Security, and Performance | Yes | Automated and manual smoke tests pass across desktop/mobile, security checks are triaged. |
| 11 | Deployment and Release | Yes | Amplify zip is generated correctly from `out/`, staging is validated, rollback is ready. |
| 12 | Launch Operations | Yes | Monitoring, support, refunds, chargebacks, compliance review, and incident runbooks are live. |

## File Structure And Ownership

### Existing Frontend Files

- `src/lib/catalog.ts`: Catalog product source, public storefront products, luxury featured products, product lookup by slug.
- `src/lib/data.ts`: Static site/nav/member/event content only; do not reintroduce catalog products here.
- `src/app/shop/page.tsx`: Shop shell, category navigation, product grid entry.
- `src/components/shop-catalog.tsx`: Client-side filtering, visible count, search, category state, and future URL search-param sync.
- `src/app/shop/[slug]/page.tsx`: Product detail page, product metadata, JSON-LD, static product params.
- `src/app/sitemap.ts`: Sitemap generator; must include products and events.
- `src/components/cart-provider.tsx`: Current local cart persistence; must call backend/Stripe checkout and clear after confirmed success.
- `src/lib/shopping-cart.ts`: Current local cart/order model; must stop creating production orders locally.
- `src/components/checkout-experience.tsx`: Current local checkout UI; replace production path with Stripe Checkout redirect.
- `src/app/checkout/page.tsx`: Checkout route shell.
- `src/components/membership-join-button.tsx`: Membership call-to-action; route to subscription Checkout.
- `src/lib/membership-pricing.ts`: Membership tier pricing and later Stripe recurring Price IDs.
- `src/app/account/page.tsx` and `src/components/account-experience.tsx`: Account experience; must consume backend membership/order status.
- `src/app/admin/page.tsx`, `src/components/admin/admin-access-gate.tsx`, `src/components/admin/yuzu-admin-console.tsx`: Admin entry and UI; production access must come from Cognito/RBAC.
- `src/components/age-gate.tsx`: Current client-only age gate; keep as UX friction but do not treat it as legal checkout verification.

### Existing Backend And Infra Files

- `infra/lambda/ycc-api/index.js`: Existing API Gateway Lambda handler. Add payment, order, age-verification, and admin commerce routes here first to match deployment reality.
- `infra/lambda/ycc-api/README.md`: Backend route contract. Update with every new commerce route and auth requirement.
- `infra/database/migrations/0001_phase3_app_schema.sql`: Existing application schema. Add a new migration for commerce tables rather than editing this already-applied migration.
- `scripts/check-rds-connection.ts`: RDS connectivity smoke check.
- `docs/aws-live-architecture-setup.md`: Live AWS state and hardening checklist.
- `.env.example`: Public and server-side environment contract.
- `package.json` and `package-lock.json`: Add Stripe SDK and test scripts only when implementation begins.

### New Files To Create During Execution

- `infra/database/migrations/0002_commerce_schema.sql`: Orders, order items, checkout sessions, Stripe event ledger, subscriptions, compliance holds, tax/shipping snapshots, and audit rows.
- `infra/lambda/ycc-api/stripe-commerce.js`: Stripe client creation, Checkout Session creation, webhook signature verification, fulfillment orchestration, and Customer Portal session creation.
- `infra/lambda/ycc-api/commerce-rules.js`: Cart validation, inventory checks, age-verification gate, destination restrictions, shipping method eligibility, and product policy decisions.
- `src/lib/stripe-checkout.ts`: Frontend API client for creating checkout/subscription/portal sessions through `NEXT_PUBLIC_YCC_API_BASE_URL`.
- `src/app/checkout/success/page.tsx`: Static success page that reads `session_id` in a client component and asks the backend for fulfillment/order status.
- `src/app/checkout/cancel/page.tsx`: Static cancel page that keeps cart state and lets the customer return to checkout.
- `tests/stripe-commerce.test.ts`: Backend unit tests for Stripe request construction, webhook idempotency, and event handling.
- `tests/checkout-flow.test.ts`: Frontend contract tests for redirect, success, cancel, and cart cleanup behavior.
- `docs/production-launch-runbook.md`: Launch, rollback, support, refund, compliance, and monitoring runbook.

## Execution Rules

- Before writing Next.js code, read the relevant guide in `node_modules/next/dist/docs/` because this repo uses a newer Next version with breaking changes.
- Because `next.config.ts` uses `output: "export"`, do not put production Stripe secrets, webhook handlers, Cognito server checks, or database writes inside Next route handlers.
- Use the AWS Lambda backend for every secret-bearing operation.
- Do not clear cart state on Stripe redirect alone. Clear the cart only after the backend has verified the Checkout Session and recorded fulfillment.
- Do not treat the client age gate as legal compliance. It is only a UX warning.
- Do not sync the full 1,042-item catalog into Stripe until Phase 1 passes and a small catalog seed is verified end to end.
- Keep every phase reviewable in commits. Avoid bundling unrelated UI refresh work with compliance or payment changes.

## Phase 0: Governance And Repo Hygiene

**Purpose:** Make the repo safe to reason about before production work starts.

**Files:**

- Modify: `.gitignore`
- Modify: `README.md`
- Modify: `docs/aws-live-architecture-setup.md`
- Create: `docs/production-launch-runbook.md`

- [ ] Add ignore rules for generated deployment artifacts:

```gitignore
/output/
/*.zip
/out/
/.next/
tsconfig.tsbuildinfo
```

- [ ] Keep `global-bundle.pem` tracked only if it is intentionally public AWS CA material; otherwise move it to documented setup storage and ignore local certificate material.
- [ ] Move old zip archives out of the working repo into a local archive folder outside this project.
- [ ] Add a "Launch State" section to `README.md` that says the current app is not production-launch-ready until Phases 1, 4, 5, 9, and 10 pass.
- [ ] Update `docs/aws-live-architecture-setup.md` with an owner/status line for each known hardening gap: RDS Proxy TLS, deletion protection, default VPC/default security group, SES production access, WAF, CloudWatch alarms, backup retention, and Bedrock News Agent IDs.
- [ ] Create `docs/production-launch-runbook.md` with sections for deploy, rollback, payment issue triage, refund triage, failed webhook replay, compliance hold review, age verification review, and support escalation.

**Verification:**

```powershell
git status --short
npm run lint
```

Expected: `npm run lint` passes; git status no longer lists generated zip/output artifacts after cleanup.

## Phase 1: Build, Type, And Test Recovery

**Purpose:** Restore the baseline so all later launch work sits on a passing app.

**Files:**

- Modify: `src/app/member-drops/page.tsx`
- Modify: `src/app/new-arrivals/page.tsx`
- Modify: `src/app/shop/page.tsx`
- Modify: `src/components/shop-catalog.tsx`
- Modify: `tests/product-detail.test.ts`
- Modify: `tests/shop-categories.test.ts`
- Modify: tests with TypeScript-only failures surfaced by `npx tsc --noEmit`

- [ ] Replace `products` imports from `src/lib/data.ts` with the correct catalog exports from `src/lib/catalog.ts`.
- [ ] Use `featuredLuxuryProducts` for curated/member/new-arrival display surfaces that need the four-featured-product set.
- [ ] Use `catalogProducts` or `storefrontProducts` for full catalog surfaces.
- [ ] Fix `tests/product-detail.test.ts` so expectations match the current catalog description source rather than an old "Luxury Cigars" copy string.
- [ ] Update `tests/shop-categories.test.ts` to import from `src/lib/catalog.ts`, not `src/lib/data.ts`.
- [ ] Implement SEO-friendly shop category URLs in `src/app/shop/page.tsx` and `src/components/shop-catalog.tsx` using a stable query key such as `category`.
- [ ] In `src/components/shop-catalog.tsx`, initialize category state from `window.location.search`, update it with `window.history.pushState`, and keep the no-category state shareable.
- [ ] Fix TypeScript test issues in humidor and lambda tests without weakening app types.

**Verification:**

```powershell
npm run lint
npm test
npx tsc --noEmit
npm run build
```

Expected: all four commands exit 0. Treat any failure as Phase 1 incomplete.

## Phase 2: Production Architecture Decision

**Purpose:** Lock the deployment model before adding commerce.

**Files:**

- Modify: `docs/aws-medusa-architecture.md`
- Modify: `docs/aws-live-architecture-setup.md`
- Modify: `.env.example`
- Modify: `infra/lambda/ycc-api/README.md`

- [ ] Rename the architecture direction from "Medusa-ready commerce" to "Stripe payment and billing with Yuzu compliance/order backend" wherever that is now the chosen path.
- [ ] Preserve Medusa notes only as historical context or future migration notes.
- [ ] Document that Stripe is not the full commerce backend. Stripe owns payments, billing, Checkout, Products, Prices, invoices, receipts, and customer payment records. Yuzu owns inventory, product publishing state, age verification, destination legality, shipping eligibility, tobacco tax/excise decisions, fulfillment status, membership entitlements, and support/audit history.
- [ ] Add server-side environment variables to `.env.example`:

```dotenv
STRIPE_SECRET_KEY=sk_test_replace_me
STRIPE_WEBHOOK_SECRET=whsec_replace_me
STRIPE_API_VERSION=2026-02-25.clover
STRIPE_CUSTOMER_PORTAL_CONFIGURATION_ID=bpc_replace_me
```

- [ ] Add public environment variables to `.env.example`:

```dotenv
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_replace_me
NEXT_PUBLIC_YCC_API_BASE_URL=https://api.yuzucigarclub.com
```

- [ ] Document new API routes in `infra/lambda/ycc-api/README.md`:

```text
POST /commerce/checkout-session
POST /commerce/membership-session
POST /commerce/customer-portal-session
POST /commerce/webhook/stripe
GET /commerce/checkout-session/{id}
GET /commerce/orders/{id}
GET /commerce/membership
POST /admin/commerce/stripe-sync-products
GET /admin/commerce/webhook-events
GET /admin/commerce/compliance-holds
```

**Verification:**

```powershell
npm run lint
```

Expected: docs/env edits do not break lint.

## Phase 3: Data And Catalog Backbone

**Purpose:** Give commerce one durable source of truth.

**Files:**

- Create: `infra/database/migrations/0002_commerce_schema.sql`
- Modify: `src/lib/catalog.ts`
- Modify: `src/lib/membership-pricing.ts`
- Modify: `tests/membership-data.test.ts`
- Create: `tests/commerce-schema.test.ts`

- [ ] Add stable SKU, inventory policy, publish status, shippable flag, adult signature flag, and optional Stripe Product/Price IDs to catalog data.
- [ ] Add Stripe recurring Price IDs to membership tiers after the test Stripe catalog is created.
- [ ] Add database tables:

```sql
create table if not exists stripe_events (
  id text primary key,
  type text not null,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  processing_status text not null default 'received',
  payload jsonb not null
);

create table if not exists commerce_orders (
  id uuid primary key default gen_random_uuid(),
  member_id uuid,
  email text not null,
  status text not null,
  stripe_customer_id text,
  stripe_checkout_session_id text unique,
  stripe_payment_intent_id text,
  subtotal_cents integer not null,
  tax_cents integer not null default 0,
  shipping_cents integer not null default 0,
  total_cents integer not null,
  currency text not null default 'usd',
  compliance_status text not null default 'pending',
  fulfillment_status text not null default 'not_started',
  shipping_snapshot jsonb not null default '{}'::jsonb,
  tax_snapshot jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists commerce_order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references commerce_orders(id) on delete cascade,
  sku text not null,
  product_slug text not null,
  product_name text not null,
  stripe_product_id text,
  stripe_price_id text,
  unit_amount_cents integer not null,
  quantity integer not null,
  line_total_cents integer not null
);

create table if not exists member_subscriptions (
  id uuid primary key default gen_random_uuid(),
  member_id uuid,
  email text not null,
  stripe_customer_id text not null,
  stripe_subscription_id text not null unique,
  stripe_price_id text not null,
  tier_key text not null,
  status text not null,
  current_period_end timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists commerce_compliance_holds (
  id uuid primary key default gen_random_uuid(),
  order_id uuid references commerce_orders(id) on delete cascade,
  reason text not null,
  status text not null default 'open',
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);
```

- [ ] Add indexes for `commerce_orders.email`, `commerce_orders.stripe_checkout_session_id`, `member_subscriptions.email`, and `commerce_compliance_holds.status`.
- [ ] Add schema tests that assert the migration contains required tables and idempotent `if not exists` statements.

**Verification:**

```powershell
npm test
npm run db:check
```

Expected: schema tests pass. `db:check` must connect before migration application is considered safe.

## Phase 4: Regulated Commerce Compliance

**Purpose:** Prevent illegal or unsupported tobacco sales before payment.

**Files:**

- Create: `infra/lambda/ycc-api/commerce-rules.js`
- Modify: `infra/lambda/ycc-api/index.js`
- Modify: `src/components/age-gate.tsx`
- Modify: `src/components/checkout-experience.tsx`
- Create: `tests/commerce-rules.test.ts`
- Modify: `docs/production-launch-runbook.md`

- [ ] Add server-side cart validation that rejects unknown SKUs, unpublished products, zero/negative quantities, and stale prices.
- [ ] Add age-verification status checks before creating any Checkout Session for cigars or other tobacco products.
- [ ] Integrate the selected vendor named by `NEXT_PUBLIC_AGE_VERIFICATION_VENDOR` and server-side secrets; current `.env.example` points to AgeChecker.Net as the intended vendor.
- [ ] Store age-verification decisions in the backend with timestamp, vendor transaction ID, decision status, and redacted response metadata.
- [ ] Add destination restriction checks by state and ZIP/postal code before creating a Checkout Session.
- [ ] Add shipping policy checks that require adult signature delivery for all eligible tobacco shipments.
- [ ] Add order compliance holds when an order is paid but not yet fulfillable because age, destination, tax, or shipping proof is missing.
- [ ] Add runbook steps for reviewing and releasing compliance holds.
- [ ] Update UI copy so the client age gate is clearly an access confirmation, while checkout requires verified identity.

**Verification:**

```powershell
npm test -- tests/commerce-rules.test.ts
npm test
```

Expected: server-side compliance tests reject unverified age, restricted destination, stale price, and missing adult-signature method.

## Phase 5: Stripe Commerce Integration

**Purpose:** Make Stripe the production payment and billing surface.

**Files:**

- Modify: `package.json`
- Modify: `package-lock.json`
- Create: `infra/lambda/ycc-api/stripe-commerce.js`
- Modify: `infra/lambda/ycc-api/index.js`
- Modify: `infra/lambda/ycc-api/README.md`
- Create: `tests/stripe-commerce.test.ts`
- Modify: `.env.example`

- [ ] Confirm in writing that Stripe has approved the Yuzu business model for cigar/tobacco commerce before live payments. Stripe lists restricted businesses as requiring additional due diligence, and approval can be service-specific.
- [ ] Install the official Stripe Node SDK.

```powershell
npm install stripe
```

- [ ] Pin `STRIPE_API_VERSION=2026-02-25.clover` unless Stripe's current official SDK requires a newer version at implementation time.
- [ ] Create a Stripe client only inside Lambda using `STRIPE_SECRET_KEY`.
- [ ] Implement `POST /commerce/checkout-session` for one-time product purchases using Stripe Checkout Sessions with `mode=payment`.
- [ ] Implement `POST /commerce/membership-session` for tier subscriptions using Checkout Sessions with `mode=subscription`.
- [ ] Keep physical tobacco product purchases and memberships in separate Checkout Sessions for the first launch.
- [ ] Implement `POST /commerce/customer-portal-session` so authenticated members can update payment method, cancel, and manage subscriptions through Stripe Customer Portal.
- [ ] Implement `POST /commerce/webhook/stripe` with signature verification using `STRIPE_WEBHOOK_SECRET`.
- [ ] Implement idempotent webhook handling using the `stripe_events` table.
- [ ] Handle these events in test mode:

```text
checkout.session.completed
checkout.session.async_payment_succeeded
checkout.session.async_payment_failed
invoice.paid
invoice.payment_failed
customer.subscription.created
customer.subscription.updated
customer.subscription.deleted
charge.refunded
```

- [ ] On fulfillment, retrieve the Checkout Session from Stripe with line items expanded, verify `payment_status`, record the order/subscription, and update inventory/holds.
- [ ] Do not rely only on the success redirect for fulfillment; webhooks are the source of truth.
- [ ] Add admin-only product sync route for a small seed set first: 4 featured cigars plus all membership tiers.
- [ ] After seed testing passes, expand Stripe sync to the approved launch catalog.
- [ ] Add test coverage for signature failure, duplicate webhook event, stale price, unapproved SKU, subscription event update, and refund event update.

**Verification:**

```powershell
npm test -- tests/stripe-commerce.test.ts
npm test
npx tsc --noEmit
```

Expected: Stripe tests pass without live Stripe keys by using deterministic fakes/mocks for SDK calls.

## Phase 6: Frontend Shopping Flow

**Purpose:** Replace local-only checkout with a real production purchase path.

**Files:**

- Create: `src/lib/stripe-checkout.ts`
- Modify: `src/components/checkout-experience.tsx`
- Modify: `src/components/cart-provider.tsx`
- Modify: `src/lib/shopping-cart.ts`
- Modify: `src/components/membership-join-button.tsx`
- Create: `src/app/checkout/success/page.tsx`
- Create: `src/app/checkout/cancel/page.tsx`
- Create: `tests/checkout-flow.test.ts`
- Modify: `tests/shopping-cart.test.ts`

- [ ] Replace the "Place Secure Order" local-order action with "Continue to secure checkout" that calls `POST /commerce/checkout-session`.
- [ ] Keep cart editing, quantities, and order review in the storefront before redirect.
- [ ] Send only SKU, quantity, customer email, shipping address, selected shipping method, and compliance token/reference to the backend. Let the backend compute prices, tax, shipping, and eligibility.
- [ ] Redirect the browser to the Stripe-hosted Checkout Session URL returned by the backend.
- [ ] Add subscription checkout to membership buttons through `POST /commerce/membership-session`.
- [ ] Add a success page that reads `session_id`, calls `GET /commerce/checkout-session/{id}`, displays order status, and clears the cart only after the backend says fulfillment/order recording is complete.
- [ ] Add a cancel page that preserves the cart and returns the customer to checkout.
- [ ] Show user-friendly errors for age verification required, restricted destination, out of stock, price changed, payment processing, and payment failed.
- [ ] Keep the existing cart count accessible with `aria-live="polite"` if not already present.
- [ ] Mobile-check checkout and cart controls for 44px touch targets and safe-area bottom spacing.

**Verification:**

```powershell
npm test -- tests/checkout-flow.test.ts tests/shopping-cart.test.ts
npm run build
```

Expected: static export succeeds and the checkout pages do not use unsupported server runtime features.

## Phase 7: Auth, Admin, And Operations

**Purpose:** Replace demo/local admin behavior with production operator controls.

**Files:**

- Modify: `src/components/admin/admin-access-gate.tsx`
- Modify: `src/components/backup-auth-panel.tsx`
- Modify: `src/lib/backup-auth.ts`
- Modify: `src/components/admin/yuzu-admin-console.tsx`
- Modify: `infra/lambda/ycc-api/index.js`
- Modify: `infra/lambda/ycc-api/README.md`
- Modify: `tests/backup-auth.test.ts`
- Modify: `tests/admin-console-model.test.ts`
- Modify: `tests/lambda-ycc-api.test.ts`

- [ ] Disable local backup admin for production builds or hide it behind an explicit non-production feature flag.
- [ ] Require Cognito JWT claims for admin and member routes.
- [ ] Enforce Cognito groups server-side for admin, concierge operator, support operator, and fulfillment operator actions.
- [ ] Add admin views for Stripe sync status, orders, subscriptions, refunds, failed payment states, webhook event history, and compliance holds.
- [ ] Add server-side admin routes for read-only order/subscription support first.
- [ ] Add refund/cancel actions only after audit logging and role checks are covered by tests.
- [ ] Add support queue links from paid orders to SES/support case records.
- [ ] Make account page membership status come from backend subscription state instead of static/local data.
- [ ] Make account page order history come from backend order records.

**Verification:**

```powershell
npm test -- tests/backup-auth.test.ts tests/admin-console-model.test.ts tests/lambda-ycc-api.test.ts
npm test
```

Expected: local backup auth cannot grant production admin capability; server routes enforce Cognito groups.

## Phase 8: SEO, Content, And Product Discoverability

**Purpose:** Make the storefront launchable as a public catalog, not only a working checkout.

**Files:**

- Modify: `src/app/shop/[slug]/page.tsx`
- Modify: `src/app/sitemap.ts`
- Modify: `src/app/robots.ts`
- Modify: `src/app/shop/page.tsx`
- Modify: `src/components/shop-catalog.tsx`
- Modify: `src/components/product-card.tsx`
- Create: `tests/seo-metadata.test.ts`
- Modify: `tests/shop-categories.test.ts`
- Modify: `tests/product-detail.test.ts`

- [ ] Add product JSON-LD schema to product detail pages with name, description, image, SKU, brand, offers, price, currency, and accurate availability.
- [ ] Add breadcrumb JSON-LD to product detail pages.
- [ ] Add canonical URL metadata for product pages and filtered shop URLs.
- [ ] Expand `src/app/sitemap.ts` to include all public product detail pages and event detail pages.
- [ ] Add dynamic `lastModified` values from source data where available.
- [ ] Make category filter URLs shareable with query params and stable category slugs.
- [ ] Add empty states for search/category combinations with no results.
- [ ] Audit product images for useful alt text and below-fold lazy loading.
- [ ] Confirm `robots.ts` allows public catalog indexing and excludes internal/admin paths.

**Verification:**

```powershell
npm test -- tests/seo-metadata.test.ts tests/shop-categories.test.ts tests/product-detail.test.ts
npm run build
```

Expected: sitemap includes product/event URLs and product pages include structured data.

## Phase 9: Infrastructure Hardening

**Purpose:** Make the AWS runtime safe for production traffic and regulated operations.

**Files:**

- Modify: `docs/aws-live-architecture-setup.md`
- Modify: `infra/ycc-phase3-network-permission-gap-policy.json`
- Modify: `infra/ycc-phase2-lambda-runtime-policy.json`
- Modify: `infra/lambda/ycc-api/README.md`
- Modify: `scripts/check-rds-connection.ts`
- Create or modify deployment scripts under `scripts/` only after confirming the live AWS operation manually.

- [ ] Enable RDS deletion protection.
- [ ] Require TLS on RDS Proxy.
- [ ] Remove default security group from production resources after replacement security groups are validated.
- [ ] Move production resources out of default public subnets where required by the target AWS design.
- [ ] Confirm RDS backup retention and point-in-time restore settings.
- [ ] Store Stripe secrets, age-verification secrets, tax-provider secrets, and database credentials in Secrets Manager.
- [ ] Limit Lambda IAM permissions to the secrets and AWS services it needs.
- [ ] Configure WAF/rate limiting for public API Gateway routes.
- [ ] Configure CloudWatch alarms for Lambda errors, API 4xx/5xx, Stripe webhook failures, RDS connection failures, replacement-email-provider failures, and age-verification vendor failures.
- [ ] Replace outbound SES after final denial of AWS case `177809591700724`; verify sender/domain identities, bounce/complaint handling, and support/newsletter/welcome email smoke tests with the replacement provider.
- [ ] Configure structured log fields for request ID, route key, actor hash, Stripe event ID, order ID, compliance hold ID, and duration.
- [ ] Re-run RDS connectivity from the same network path Lambda will use.

**Verification:**

```powershell
npm run db:check
npm test -- tests/lambda-ycc-api.test.ts
```

Expected: DB connectivity succeeds and backend tests still pass.

## Phase 10: QA, Security, And Performance

**Purpose:** Catch launch blockers before customers do.

**Files:**

- Modify: `package.json`
- Modify: `tests/*`
- Create: `tests/e2e/checkout-smoke.spec.ts` if Playwright is adopted for browser smoke tests.
- Modify: `docs/production-launch-runbook.md`

- [ ] Add or document a CI-equivalent command sequence:

```powershell
npm run lint
npx tsc --noEmit
npm test
npm run build
npm audit --omit=dev
```

- [ ] Triage `npm audit --omit=dev`: do not apply `npm audit fix --force` if it downgrades Next or causes breaking dependency changes.
- [ ] Add browser smoke tests for home, shop, product detail, cart, checkout start, membership checkout start, checkout success, and checkout cancel.
- [ ] Run mobile viewport checks for navigation, cart, product details, checkout, account, and admin.
- [ ] Run a Lighthouse/PageSpeed pass for Core Web Vitals after build output is current.
- [ ] Verify service worker behavior does not cache stale checkout/account/admin responses.
- [ ] Verify all forms have clear validation and no sensitive secrets in client-side bundles.
- [ ] Verify payment and account failures show user-friendly messages.
- [ ] Verify no local order can be created without backend confirmation.

**Verification:**

```powershell
npm run lint
npx tsc --noEmit
npm test
npm run build
npm audit --omit=dev
```

Expected: all quality commands pass or have a documented, approved risk acceptance for dependency audit items that cannot be patched without a bad downgrade.

## Phase 11: Deployment And Release

**Purpose:** Ship the static frontend correctly and safely.

**Files:**

- Modify: `amplify.yml`
- Modify: `README.md`
- Modify: `docs/production-launch-runbook.md`
- Do not commit generated zip files.

- [ ] Build fresh output:

```powershell
npm run build
```

- [ ] Create the Amplify/static deployment zip from the contents of `out/`, not from the project root and not with `out/` as a parent folder.
- [ ] Use a zip method that writes POSIX forward-slash entry paths.
- [ ] Exclude source files, `.next`, `node_modules`, `output`, `.git`, old zips, and local env files.
- [ ] Deploy to staging or a non-production Amplify branch first.
- [ ] Smoke test static assets, CSS, JS chunks, product pages, sitemap, robots, cart, checkout start, checkout cancel, and checkout success.
- [ ] Confirm production environment variables point to live API and live Stripe keys only after Stripe approval and end-to-end test mode is complete.
- [ ] Document rollback to the previous known-good Amplify artifact.

**Verification:**

```powershell
npm run build
```

Expected: build succeeds and the generated artifact serves CSS, JS, images, and deep links without 404s.

## Phase 12: Launch Operations

**Purpose:** Make the business able to run after launch.

**Files:**

- Modify: `docs/production-launch-runbook.md`
- Modify: `docs/aws-live-architecture-setup.md`
- Modify: `src/components/admin/yuzu-admin-console.tsx`

- [ ] Create daily launch checklist: payment events, webhook failures, compliance holds, orders awaiting fulfillment, inventory warnings, SES bounce/complaint status, and API health.
- [ ] Create weekly compliance review: age-verification vendor results, destination blocks, adult-signature shipments, tax/excise provider results, refunds, chargebacks, and support escalations.
- [ ] Create incident playbooks for Stripe outage, API outage, RDS outage, webhook replay backlog, age-verification vendor outage, and shipping provider outage.
- [ ] Create refund and cancellation workflows with roles, evidence, audit logging, and customer messaging.
- [ ] Create chargeback response workflow with Stripe evidence checklist and internal order/support records.
- [ ] Create inventory correction workflow so stock changes do not leave Stripe/product pages stale.
- [ ] Create launch-day support routing for account, payment, shipping, damaged/missing shipment, compliance hold, and membership cancellation cases.

**Verification:**

```powershell
npm run lint
```

Expected: docs/admin changes do not break lint; runbook has owners and check cadence for every launch operation.

## Recommended Execution Order

1. Complete Phase 0 and Phase 1 before any new feature work.
2. Complete Phase 2 and Phase 3 next so Stripe and compliance have a backend/database foundation.
3. Run Phase 4 and Phase 5 together only if separate workers own non-overlapping files. Compliance rules must finish before live checkout.
4. Complete Phase 6 after backend checkout/session routes have tests.
5. Complete Phase 7 before production admin access or refund/cancel actions are enabled.
6. Complete Phases 8, 9, and 10 before staging release.
7. Complete Phases 11 and 12 as launch-week work.

## Minimum Production Launch Criteria

Yuzu should not launch production commerce until all of these are true:

- `npm run lint`, `npx tsc --noEmit`, `npm test`, and `npm run build` pass from a clean working tree.
- Stripe has approved the business model for cigar/tobacco commerce in writing.
- Live Stripe keys and webhook secret are stored only in server-side secrets.
- Checkout Sessions, subscriptions, Customer Portal, refunds, and webhook replay are verified in test mode.
- Backend compliance blocks underage, unverified, restricted destination, stale price, unpublished SKU, and unsupported shipping cases.
- Adult-signature shipping requirements are enforced before fulfillment.
- Tax and tobacco excise/compliance process is documented and verified with the chosen provider or legal/accounting operator.
- Cognito/RBAC controls admin and member routes in production.
- Local backup admin cannot grant production admin access.
- RDS connectivity, TLS, deletion protection, backups, WAF, alarms, and replacement outbound email provider readiness are complete.
- Product pages have metadata, JSON-LD, canonical URLs, and sitemap entries.
- Amplify zip is built from current `out/` contents with forward-slash paths.
- Launch runbook covers rollback, support, refunds, chargebacks, compliance holds, webhook replay, and incident response.

## Self-Review

- Spec coverage: This plan covers the audit blockers, Stripe commerce, tobacco compliance, checkout, account/admin, SEO, infra, CI/security, deployment, and operations.
- Placeholder scan: No step depends on unspecified "later" behavior; every phase names concrete files, commands, and exit gates.
- Type consistency: Product data remains in `src/lib/catalog.ts`; static/nav content remains in `src/lib/data.ts`; backend commerce routes live in the existing Lambda rather than unsupported static-export Next route handlers.
