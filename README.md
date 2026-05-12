# Yuzu Cigar Club

Next.js + TypeScript + Tailwind + shadcn/ui storefront and digital humidor PWA for AWS Amplify.

## Launch State

This repo now includes the production-launch scaffolding for Phases 0-12: Stripe Checkout/Billing client and Lambda helpers, commerce schema migration, compliance validation, production backup-admin lockout, product SEO, release checks, and launch operations docs.

Live production commerce is still blocked until external launch gates are completed: written Stripe approval for cigar/tobacco commerce, live/test Stripe secrets and webhook secret in AWS, age/tax/shipping provider credentials, adult-signature carrier approval, AWS hardening, and staging smoke tests.

Current launch gates:

- Phase 1: `npm run lint`, `npm test`, `npx tsc --noEmit`, and `npm run build` must pass from the current source.
- Phase 4: tobacco age verification, destination rules, adult-signature shipping, tax/excise review, and compliance holds must be enforced server-side.
- Phase 5: Stripe must approve the cigar/tobacco business model before live payments, and Stripe Checkout/Billing/webhooks must pass test-mode verification.
- Phase 9: RDS, VPC, WAF, secrets, SES, alarms, backups, and IAM hardening must be complete.
- Phase 10: automated QA, security triage, browser smoke tests, and performance checks must pass or have documented risk acceptance.

Use `npm run launch:check` for the local CI-equivalent sequence. `npm audit --omit=dev` is expected to report 0 production vulnerabilities; treat any new finding as launch-blocking unless a documented risk acceptance is approved.

## Local Commands

```bash
npm install
npm run dev
npm run lint
npm run build
npm run start
npm run preview
npm run launch:ops-check
npm run launch:go-live-check
npm run db:check
```

`npm run build` exports the site to `out/` for Amplify static hosting.
`npm run start` serves the existing static export from `out/`; use `npm run preview` to rebuild first and then serve it locally.
`npm run launch:ops-check` reports production-readiness gaps without blocking local work; `npm run launch:go-live-check` runs the same checks in strict mode and fails until external approvals, live Stripe/provider settings, staging QA, and AWS risk gates are confirmed.

## Database

RDS/Aurora PostgreSQL is configured with server-only `RDS_*` environment variables in `.env.local`.
The app expects TLS verification with `global-bundle.pem` from the AWS RDS trust store.

Use `npm run db:check` to verify local connectivity. The script prints only a redacted target summary before running a simple PostgreSQL version query.

## Amplify Upload

Generate a fresh static export before every upload. The deploy zip must contain the contents of `out/` at the archive root, with POSIX forward-slash paths for entries such as `_next/static/...` and `assets/...`.

Do not zip the project source folder, `out/` as a parent folder, `.next`, `node_modules`, `output`, old zip files, `.git`, or local environment files.

If you connect a repo instead of uploading the static artifact, use the included `amplify.yml`.

## Included Routes

- `/` home
- `/membership`
- `/shop`
- `/new-arrivals`
- `/member-drops`
- `/education`
- `/events`
- `/humidor`
- `/account`
- `/cart`
- `/checkout`
- `/admin`
- `/about`

## Commerce + Compliance Notes

The current build is a polished front-end MVP with local catalog data and legacy MedusaJS-ready product projections. The chosen production path is Stripe for payment processing, billing, hosted Checkout, Products, Prices, invoices, receipts, and customer payment records.

Stripe is not the full commerce backend. Production still needs the Yuzu AWS backend to own inventory, product publishing state, age verification, destination legality, shipping eligibility, tobacco tax/excise decisions, fulfillment status, membership entitlements, support records, and audit history.

Production checkout should use the AWS API backend for Stripe Checkout Session creation and webhook handling. The static frontend must never hold Stripe secret keys, webhook secrets, database credentials, age-verification secrets, or tax-provider secrets.

Current commerce implementation files:

- `infra/database/migrations/0002_commerce_schema.sql`
- `infra/lambda/ycc-api/commerce-rules.js`
- `infra/lambda/ycc-api/stripe-commerce.js`
- `src/lib/stripe-checkout.ts`
- `src/app/checkout/success/page.tsx`
- `src/app/checkout/cancel/page.tsx`

More architecture detail is in `docs/aws-medusa-architecture.md`, live AWS status is in `docs/aws-live-architecture-setup.md`, and the launch operations runbook is in `docs/production-launch-runbook.md`.

For historical Medusa Cloud Develop setup notes, use `docs/medusa-cloud-develop-setup.md`.
