# Medusa Cloud Develop Setup

Research date: 2026-05-05

## Develop Tier Snapshot

Medusa Cloud's Develop plan starts at $29/month and is selected by default during Cloud signup. Medusa describes it as the minimal plan for deploying a single Medusa application for development and testing.

Useful Develop limits from the current pricing page:

- 0% GMV platform fee; unlimited orders, products, sales channels, regions, and currencies.
- GitHub integration, push-to-deploy, previews, environment variables, advanced logs, SSL/TLS, and 50 Bloom credits/month.
- Auto configuration for Medusa App, Admin, Storefront, Postgres, S3, and Medusa Cache. Redis-backed KV is not included on Develop.
- Storefront hosting on the global CDN with previews, DDoS protection, 1M edge requests/month, and no custom storefront domain on Develop.
- 1 shared app server, 1 long-lived environment included, 1 preview environment included, 150 compute hours/month capped, 10 GB data transfer/month, 10 GB object storage/month, 1 GB database storage/month, and 300 build minutes/month.
- 1 Cloud seat included, then paid add-on seats.

Sources:

- https://docs.medusajs.com/cloud/pricing
- https://docs.medusajs.com/cloud/sign-up

## Recommended Yuzu Setup

Use Medusa Cloud Develop as the backend/admin environment and keep this repository as the storefront until the backend is added. This repo already has Medusa-ready product projections in `src/lib/commerce/medusa.ts` and a static storefront deployment path.

For a full one-platform Cloud deployment, Medusa requires a monorepo containing both:

- Medusa application/backend.
- Storefront.

Cloud then asks for the project root directory and storefront root directory during project creation. This repository is currently only the storefront, so the immediate Develop-tier setup is:

1. Sign up for Medusa Cloud and keep the default Develop plan.
2. Create or import the Medusa backend project from GitHub.
3. Choose a subdomain, for example `yuzu-cigar-club-dev`.
4. Choose the closest region. For Phoenix/US customers, start with `us-east-1` unless there is a stronger operational reason.
5. In Medusa Admin, create or copy the publishable API key for the storefront sales channel.
6. Set the storefront environment variables from `.env.example`.
7. In the backend environment, set CORS values for whichever storefront URL is active.

Sources:

- https://docs.medusajs.com/cloud/projects
- https://docs.medusajs.com/cloud/projects/prerequisites
- https://docs.medusajs.com/cloud/storefront
- https://docs.medusajs.com/cloud/connect-storefront

## Environment Variables

For this storefront, use these values locally and in hosting:

```env
MEDUSA_BACKEND_URL=https://yuzu-cigar-club-dev.medusajs.app
NEXT_PUBLIC_MEDUSA_BACKEND_URL=https://yuzu-cigar-club-dev.medusajs.app
NEXT_PUBLIC_BASE_URL=https://yuzu-cigar-club-dev.medusajs.site
NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY=pk_dev_replace_me
NEXT_PUBLIC_MEDUSA_REGION_ID=reg_us
```

For an externally hosted storefront, set these on the Medusa backend environment and redeploy:

```env
STORE_CORS=https://yuzu-cigar-club-dev.medusajs.site
AUTH_CORS=https://yuzu-cigar-club-dev.medusajs.site
```

If the storefront remains on Amplify during the Develop phase, set `STORE_CORS` and `AUTH_CORS` to the Amplify URL instead. Multiple storefront URLs are comma-separated.

Medusa Cloud reserves infrastructure variables such as `DATABASE_URL`, `REDIS_URL`, `PORT`, `NODE_ENV`, AWS credentials, and `MEDUSA_CLOUD_API_KEY`; do not define those manually in Cloud.

Source:

- https://docs.medusajs.com/cloud/environments/environment-variables

## Repo Notes

`src/lib/commerce/medusa.ts` reads both Cloud/Starter-compatible names:

- `NEXT_PUBLIC_MEDUSA_BACKEND_URL`
- `MEDUSA_BACKEND_URL`
- `NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY`
- `NEXT_PUBLIC_BASE_URL`
- `BASE_URL`

This keeps the current custom storefront compatible with Cloud-style values while the actual backend is still external to this repo.

## Develop Tier Caveats

- Develop is for development/testing, not launch traffic.
- Develop does not include custom storefront domains; expect the storefront URL to use `medusajs.site` while on Cloud.
- Develop has a capped 150 compute hours/month and only one included long-lived environment and one included preview environment.
- Storefront deployment on Cloud requires a monorepo if you want backend/admin/storefront hosted together.
- This project uses Next.js 16. Medusa Cloud supports Next.js 16 storefronts when not using a Next.js proxy, which this repo does not currently use.
