# Repo Audit and Launch Report - 2026-05-08

## Scope

Audited the Next.js 16 static-export storefront, local launch scripts, build/test gates, static export output, deploy artifact shape, environment readiness, and obvious static-export incompatibilities.

## Fixed During This Pass

### 1. Production start command was incompatible with static export

- Finding: `next.config.ts` uses `output: "export"`, but `package.json` used `next start`.
- Evidence: `npx next start -p 3007` failed with `Error: "next start" does not work with "output: export" configuration. Use "npx serve@latest out" instead.`
- Fix: added `serve` as a dev dependency, changed `npm run start` to `serve out`, and added `npm run preview` for rebuild-then-serve local production preview.
- Files changed:
  - `package.json`
  - `package-lock.json`
  - `README.md`

### 2. Local npm cache was corrupt during dependency install

- Finding: the first `npm install --save-dev serve` failed with an `ENOENT` under the local npm `_cacache`.
- Fix: installed using a clean temporary npm cache, then ran `npm cache verify`.
- Evidence: `npm cache verify` completed successfully, garbage-collected stale cache content, and reported only one missing cache item.

### 3. Remaining launch gates were prose-only

- Finding: Stripe approval, live Stripe settings, compliance providers, staging QA, and AWS risk acceptance were documented but not machine-checkable.
- Fix: added `scripts/launch-readiness.ts`, `npm run launch:ops-check`, and `npm run launch:go-live-check`.
- Behavior: local ops mode reports external gates as warnings; strict go-live mode exits nonzero until the approvals, live secrets, provider confirmations, staging QA, and AWS risk gates are actually confirmed.
- Coverage: added `tests/launch-readiness.test.ts`.

### 4. Generated artifacts were consuming local workspace space

- Finding: old root deploy zips plus `output/` consumed about 2.3 GB.
- Fix: preserved the newest validated Amplify zip and removed 12 older root zips plus `output/`.
- Preserved artifact: `yuzu-cigar-club-amplify-deploy-live-page-editor-update-2026-05-08-105935.zip`.

### 5. Port 3000 was blocked by a stale repo-owned Next dev server

- Finding: a Next dev server from this repo was still listening on port 3000.
- Fix: stopped the stale process and verified a fresh Next dev server can start on port 3000.

## Verification Results

- `npm run launch:check`: passed.
  - `npm run lint`: passed.
  - `npx tsc --noEmit`: passed inside the launch check.
  - `npm test`: passed, 213 tests.
  - `npm run build`: passed, generated 1,076 static pages into `out/`.
  - `npm audit --omit=dev`: passed, 0 vulnerabilities.
- Static preview smoke: passed.
  - Served `out/` on a free local port.
  - `/`: HTTP 200.
  - `/shop/`: HTTP 200.
  - A real `/_next/static/*.js` asset referenced by the home page: HTTP 200.
- `npm run start -- --version`: passed, resolves `serve` 14.2.6.
- `npm run db:check`: passed through the live API deep health check. Direct database TCP is unavailable from this machine, but the API reported database health successfully.
- `npm run launch:ops-check`: passed in local ops mode and reports remaining external go-live gates as warnings.
- `npm run launch:go-live-check`: intentionally fails until external go-live gates are confirmed.
- Static export compatibility scan:
  - No `src/app/**/route.*` files found.
  - Dynamic app routes have `generateStaticParams()`.
  - No `next/headers`, cookies, server actions, middleware, or proxy files found in the app source.
- Fresh dev launch check:
  - Started Next dev on port 3000.
  - `/`: HTTP 200.
  - Stopped the test server afterward.
- Command-level static preview smoke:
  - `/`: HTTP 200.
  - `/shop/`: HTTP 200.
  - `/shop/curated-padron-1964-anniversary-box/`: HTTP 200.
  - `/robots.txt`: HTTP 200.
  - `/sitemap.xml`: HTTP 200.
  - A real `/_next/static/*.js` asset: HTTP 200.
- Browser plugin QA:
  - Attempted twice through the in-app Browser plugin.
  - Blocked by `Page.enable` timeout in the Browser runtime before page inspection could begin.
- Latest Amplify zip shape check:
  - Latest zip inspected: `yuzu-cigar-club-amplify-deploy-live-page-editor-update-2026-05-08-105935.zip`.
  - Entries: 9,861.
  - No backslash paths and no nested `out/`, `.next/`, `node_modules/`, `output/`, or `.git/` entries found.
- Secret pattern scan:
  - Matches found were placeholders or test fixtures, not live-looking Stripe/AWS secrets.

## Current Launch Status

The static storefront now builds and serves locally with the corrected static-export start command. The repo-local launch gate is green, generated artifacts are cleaned up, and a stale local dev server no longer blocks port 3000.

AWS live checks through `CodexMcpYccOperatorRole` confirmed:

- API Gateway `13710cp67l` has detailed metrics enabled and default route throttling set to burst 100 / rate 50.
- Lambda `ycyyy` is active, in VPC, and configured for Cognito, RDS Proxy, Bedrock, SES pending mode, and schema writes.
- RDS `database-1ycc` is private, encrypted, deletion-protected, backed up for 7 days, and has Performance Insights enabled.
- RDS Proxy `proxy-1778040454500-database-1ycc` requires TLS.
- YCC CloudWatch alarms exist for Lambda errors/throttles, API 4xx/5xx, RDS CPU/storage/connections, and RDS Proxy client connections.
- SES production access is still denied under AWS case `177809591700724`.
- A regional WAF ACL exists in the account, but it is not associated with the YCC API; API Gateway throttling is the current rate-limit control.

## Remaining Launch Work

These cannot be completed from the repo without the actual provider approvals and live credentials:

1. Stripe approval and live/test Stripe configuration
   - Written approval for cigar/tobacco commerce must be in place.
   - Live and test Stripe secrets, webhook secret, recurring price IDs, and portal configuration should live in the AWS backend or Secrets Manager, not in the static frontend.

2. Regulated commerce providers
   - Age verification, tax/excise, shipping, and adult-signature provider credentials are still operational requirements.
   - The local `.env.local` intentionally does not contain many server-only values from `.env.example`; verify those are configured in the backend deployment environment.

3. AWS production hardening
   - SES production access is externally denied and must be approved by AWS before live customer email sends.
   - WAF remains open unless the team accepts API Gateway throttling as the interim control.
   - A point-in-time restore drill still needs an operator-run proof before strict production commerce.

4. Staging and browser QA
   - Run a staging smoke test against the deployed Amplify artifact.
   - Browser plugin QA was attempted locally but blocked by the Browser runtime; run browser smoke in Amplify staging or retry after the in-app Browser runtime is healthy.
   - Run checkout, account auth, admin handoff, cart, product detail, sitemap, robots, and service-worker checks in a browser.
   - Run Lighthouse or equivalent performance/accessibility checks and document any accepted risks.

## Recommended Commands

```bash
npm run launch:check
npm run launch:ops-check
npm run launch:go-live-check
npm run preview
npm run db:check
```

## References

- Stripe go-live checklist: https://docs.stripe.com/get-started/checklist/go-live
- Stripe account checklist for restricted-industry review: https://docs.stripe.com/get-started/account/checklist
