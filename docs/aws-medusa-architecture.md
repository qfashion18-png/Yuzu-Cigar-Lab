# Yuzu Cigar Club Commerce Architecture Notes

## Production Direction

Yuzu Cigar Club is moving forward with Stripe as the payment and billing platform, not Medusa as the production commerce backend for launch.

The storefront remains a static-exported Next.js app hosted by AWS Amplify. All secret-bearing commerce work runs through the AWS API Gateway/Lambda backend because static export cannot safely host runtime payment routes, webhook handlers, Cognito server checks, or database writes.

## Responsibility Split

Stripe owns:

- Hosted Checkout for one-time purchases.
- Billing and subscriptions for membership tiers.
- Products and Prices used by Checkout and Billing.
- Customer payment records.
- PaymentIntents created under Checkout.
- Invoices, receipts, refunds, disputes, and Customer Portal.
- Stripe Tax where it applies to standard sales-tax calculation.

The Yuzu backend owns:

- Catalog publishing state and launch-approved SKU selection.
- Inventory and allocation decisions.
- Cart validation and stale-price protection.
- Age-verification status and vendor decision records.
- Destination legality, PO box blocking, and shipping-method eligibility.
- Adult-signature delivery requirements.
- Tobacco tax/excise review with the selected compliance provider or operator workflow.
- Order records, order items, fulfillment status, compliance holds, and audit logs.
- Membership entitlements derived from Stripe subscription state.
- Support cases, refund/cancellation audit trails, and chargeback evidence records.
- Humidor item creation after approved fulfillment or membership events.

## Static Frontend

The static frontend should only:

- Render product, membership, cart, account, and checkout-start screens.
- Send checkout requests to `NEXT_PUBLIC_YCC_API_BASE_URL`.
- Redirect customers to Stripe-hosted Checkout or Customer Portal URLs returned by the backend.
- Read checkout success state through a backend order/session status endpoint.
- Clear the cart only after the backend confirms the Stripe session has been verified and recorded.

The static frontend must never contain:

- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- Database credentials
- Age-verification vendor secrets
- Tax-provider secrets
- Admin-only order/refund logic

## Backend Commerce API

The existing `infra/lambda/ycc-api/index.js` handler remains the production backend entry point for launch. Commerce routes should be added behind API Gateway in later phases:

- `POST /commerce/checkout-session`
- `POST /commerce/membership-session`
- `POST /commerce/customer-portal-session`
- `POST /commerce/webhook/stripe`
- `GET /commerce/checkout-session/{id}`
- `GET /commerce/orders/{id}`
- `GET /commerce/membership`
- `POST /admin/commerce/stripe-sync-products`
- `GET /admin/commerce/webhook-events`
- `GET /admin/commerce/compliance-holds`

Public routes should be limited to health, newsletter signup, and Stripe webhook ingress. Member/admin commerce routes should require Cognito JWT claims and server-side group checks where appropriate.

## Compliance

The site includes a 21+ browsing gate, but that is only a user-experience warning. Production checkout must enforce real server-side checks before creating or fulfilling a paid order:

- Age verification through the selected provider, currently documented as AgeChecker.Net in `.env.example`.
- Destination and state shipping restrictions.
- PO box blocking where tobacco shipment is not supported.
- Adult-signature delivery on every eligible tobacco shipment.
- Tax and tobacco excise workflow through Avalara Tobacco & Vape or an approved operator/legal process.
- Compliance holds for paid orders that cannot yet be released for fulfillment.
- Durable order and compliance audit logs.

## Digital Humidor

Version one remains PWA-first and manual-entry plus QR-ready. The PostgreSQL backend should own:

- members
- age_verifications
- products
- inventory
- orders
- subscriptions
- humidor_items
- smoke_logs
- humidors
- sensor_devices
- sensor_readings
- events
- allocations
- compliance_logs

Post-purchase humidor item creation should happen after a verified backend order/subscription event, not from the client redirect alone.

## Smart Humidor Later

AWS IoT Core can receive humidity and temperature readings over MQTT. A backend worker can store readings in Timestream or TimescaleDB, trigger EventBridge rules, and notify users through SES/SNS when humidity or temperature crosses thresholds.

## AWS Launch Shape

- Amplify Hosting: static Next.js export.
- API Gateway: public API edge and Cognito JWT authorizer.
- Lambda: Yuzu API backend, Stripe Checkout Session creation, webhook handling, compliance orchestration, support, and AI action groups.
- RDS PostgreSQL: members, orders, subscriptions, compliance holds, humidor data, support cases, and audit logs.
- RDS Proxy: database access for Lambda.
- Cognito: member and operator authentication.
- Secrets Manager: Stripe, age-verification, tax-provider, and database secrets.
- EventBridge/SQS: payment, compliance, support, and fulfillment workflows.
- SES/SNS: support email and operational notifications.
- S3: media, raw inbound support mail, and knowledge-base assets.
- Bedrock: concierge, cigar guide, support, humidor, admin, and news agents behind the backend boundary.
- WAF/CloudWatch: public-edge protection, alarms, logs, and launch monitoring.

## Historical Medusa Notes

Earlier drafts planned a MedusaJS commerce backend. Those notes are preserved only as historical context and possible future migration reference.

If Medusa is revisited later, useful concepts include customer groups, member-only allocations, adult-signature shipping class, order hold states, fulfillment status, and post-purchase hooks. Do not treat the historical Medusa setup docs as the launch architecture while Stripe is the chosen commerce provider.
