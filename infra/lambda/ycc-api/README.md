# YCC API Lambda

This Lambda is the backend contract, Phase 3 persistence handler, and Phase 4/4.5 Bedrock Agent Runtime entry point for the live YCC AWS stack.

It is deployed to the existing `ycyyy` function behind API Gateway `ycc-api`.

## Commerce Direction

Stripe is the production payment and billing platform for launch. The static Next.js storefront must call this Lambda for secret-bearing commerce work instead of creating Stripe sessions or orders in the browser.

Stripe owns payment processing, hosted Checkout, Billing/subscriptions, Products, Prices, invoices, receipts, refunds, disputes, Customer Portal, and customer payment records. Yuzu owns inventory, catalog publishing state, age verification, destination and shipping eligibility, adult-signature requirements, tobacco tax/excise workflow, order records, membership entitlements, fulfillment status, support history, compliance holds, and audit logs.

## Routes

- `GET /health`
- `GET /health?deep=1`
- `GET /content/pages`
- `GET /account/me`
- `PATCH /account/me`
- `POST /content/pages`
- `POST /concierge/chat`
- `POST /support/contact`
- `POST /support/email-draft`
- `POST /support/email-send`
- `POST /newsletter/subscribe`
- `GET /news/stories`
- `POST /news/story-drafts`
- `POST /news/stories`
- `GET /admin/members`
- `PATCH /admin/members/{id}/access`
- `DELETE /admin/members/{id}`
- `GET /humidor/items`
- `POST /humidor/items`
- `POST /humidor/identify-cigar`
- `GET /humidor/alerts`
- `POST /humidor/alerts`
- `POST /humidor/alerts/dispatch`

`GET /health`, `GET /content/pages`, `GET /news/stories`, `POST /newsletter/subscribe`, and `POST /support/contact` are public. All other routes expect API Gateway to provide Cognito JWT claims at `requestContext.authorizer.jwt.claims`; the handler also checks this defensively. `POST /content/pages`, `POST /news/story-drafts`, and `POST /news/stories` additionally require an `admin` or `concierge_operator` group.

`DELETE /admin/members/{id}` is admin-only, writes an audit row, and refuses members with commerce orders or subscription records.

## Commerce Routes

These routes are the Phase 5/6 commerce contract. The handler registers them and reads live commerce settings from Secrets Manager. Product checkout is allowed only when Stripe Tax, age verification, shipping, catalog, and Stripe readiness are all present; the backend intentionally rejects checkout when tax readiness is unavailable.

- `POST /commerce/checkout-session`
- `POST /commerce/age-verification-token`
- `POST /commerce/membership-session`
- `POST /commerce/customer-portal-session`
- `POST /commerce/webhook/stripe`
- `GET /commerce/checkout-session/{id}`
- `GET /commerce/orders`
- `GET /commerce/orders/{id}`
- `GET /commerce/membership`
- `POST /admin/commerce/stripe-sync-products`
- `GET /admin/commerce/webhook-events`
- `GET /admin/commerce/compliance-holds`

Expected access model:

- `POST /commerce/age-verification-token` is public checkout support. It validates an AgeChecker.Net verification UUID server-side and returns a short-lived signed checkout token.
- `POST /commerce/checkout-session` and `POST /commerce/membership-session` are public guest-checkout starts, but they return `stripe_not_ready`/`commerce_not_configured` until Stripe keys and launch catalog readiness are configured.
- `POST /commerce/webhook/stripe` is public ingress but must verify the Stripe signature with `STRIPE_WEBHOOK_SECRET`; unsigned events are rejected before Cognito auth.
- Checkout-session creation must validate cart, price, inventory, age verification, destination, shipping, tax, and adult-signature requirements before returning a Stripe Checkout URL.
- Member order/subscription reads require Cognito JWT claims.
- Stripe webhooks link matched `members.stripe_customer_id` values from Checkout/subscription customer IDs. Customer Portal sessions use that member link first, then fall back to subscription/order history for older rows.
- Admin commerce routes require Cognito admin or concierge/operator groups and durable audit logging.

Production commerce secrets should be stored in AWS Secrets Manager and exposed to Lambda with `COMMERCE_PROVIDER_SECRET_ARN` or `COMMERCE_PROVIDER_SECRET_ID`. Direct environment variables remain supported for local development and smoke tests only.

Operator helper:

```powershell
.\scripts\configure-ycc-commerce-secret.ps1 -CommerceSecretJsonPath .\secure\commerce-prod.json
```

Required commerce secret shape:

```json
{
  "stripe": {
    "secretKey": "sk_live_replace_me",
    "webhookSecret": "whsec_replace_me",
    "apiVersion": "2026-02-25.clover",
    "customerPortalConfigurationId": "bpc_replace_me",
    "launchCatalogReady": true,
    "launchCatalogS3Uri": "s3://classroom2/ycc/commerce/stripe-launch-catalog.json",
    "launchCatalog": [
      {
        "sku": "APPROVED-BOX",
        "name": "Approved Box",
        "price": 120,
        "publishStatus": "published",
        "inventoryPolicy": "track",
        "sourceQuantity": 5,
        "shippable": true,
        "adultSignatureRequired": true,
        "stripePriceId": "price_replace_me"
      }
    ],
    "priceIds": {
      "SENSEI_MONTHLY": "price_replace_me"
    }
  },
  "ageVerification": {
    "vendor": "AgeChecker.Net",
    "apiKey": "replace_me",
    "accountSecret": "replace_me",
    "signingSecret": "replace_me"
  },
  "tax": {
    "provider": "Stripe Tax",
    "ready": true,
    "status": "ready",
    "headOffice": {
      "line1": "951 South Coral Key Ct",
      "city": "Gilbert",
      "state": "AZ",
      "postalCode": "85233",
      "country": "US"
    },
    "activeRegistrationIds": ["taxreg_replace_me"],
    "defaultTaxCode": "txcd_99999999",
    "defaultTaxBehavior": "exclusive"
  },
  "shipping": {
    "provider": "USPS",
    "adultSignatureCarrierApproved": true,
    "adultSignature": {
      "carrier": "USPS",
      "service": "USPS Adult Signature Required",
      "ready": true,
      "accountConfigured": true
    }
  },
  "membership": {
    "entitlementSigningSecret": "replace_me"
  }
}
```

Use `launchCatalogS3Uri` for the full production catalog; inline `launchCatalog` is only suitable for small smoke-test catalogs that fit under the Secrets Manager value limit. Keep `tax.ready=true` only after live Stripe Tax settings are active, the verified head-office address is configured, required Tax registrations are reviewed, and the account default tax code/behavior are set.

Local fallback environment:

```env
# Leave this unset to use direct local/dev fallback values.
COMMERCE_PROVIDER_SECRET_ARN=
STRIPE_SECRET_KEY=sk_test_replace_me
STRIPE_WEBHOOK_SECRET=whsec_replace_me
STRIPE_API_VERSION=2026-02-25.clover
STRIPE_CUSTOMER_PORTAL_CONFIGURATION_ID=bpc_replace_me
STRIPE_LAUNCH_CATALOG_READY=1
STRIPE_LAUNCH_CATALOG_JSON=[{"sku":"APPROVED-BOX","name":"Approved Box","price":120,"publishStatus":"published","inventoryPolicy":"track","sourceQuantity":5,"shippable":true,"adultSignatureRequired":true,"stripePriceId":"price_replace_me"}]
# or STRIPE_LAUNCH_CATALOG_PATH=./launch-catalog.json
FEATURE_STRIPE_TAX=ready
SHIPPING_PROVIDER=USPS
STRIPE_PRICE_SENSEI_MONTHLY=price_replace_me
AGE_VERIFICATION_SIGNING_SECRET=replace_me
AGE_VERIFICATION_API_KEY=replace_me
AGE_VERIFICATION_API_SECRET=replace_me
MEMBERSHIP_ENTITLEMENT_SIGNING_SECRET=replace_me
```

Supporting modules:

- `commerce-rules.js`: server-side compliance validation.
- `stripe-commerce.js`: Stripe client creation, Checkout Session params, Billing subscription sessions, Customer Portal params, webhook verification, and event-action mapping.
- `index.js`: API Gateway route registration, Cognito/RBAC checks, and launch-safe not-ready responses when secrets/catalog readiness are missing.

## Persistence

When `FEATURE_DB_WRITES=schema_ready`, protected routes write through RDS Proxy into the Phase 3 PostgreSQL schema:

- `GET /account/me` upserts the Cognito member row and reads the saved member profile.
- `PATCH /account/me` persists the Cognito member display name, phone, shipping profile, and audit row.
- Cognito `PostConfirmation_ConfirmSignUp` upserts the confirmed user into `public.members`; when Stripe is configured it creates and links the canonical Stripe Customer immediately. Friends & Family confirmation metadata grants the 1-year Box Access Pass and links the Friends & Family Stripe Customer without depending on a later browser claim call.
- `POST /concierge/chat` stores the member, conversation, user message, assistant reply, and audit row.
- `POST /support/contact` sends the public contact form to the configured YCC support recipient only when the outbound mail provider is ready, stores an inbound support case/email row when DB writes are enabled, and uses the visitor email as Reply-To.
- `POST /support/email-draft` stores the member, support case, outbound draft email, and audit row.
- `POST /support/email-send` remains guarded unless the selected outbound provider is ready. AWS SES production access was final-denied under case `177809591700724`, so keep `FEATURE_SES` non-ready; the no-new-spend path is the existing GoDaddy/Microsoft 365 mailbox SMTP provider, enabled only after SMTP AUTH, a secure credential, and internal smoke sends are verified.
- `POST /newsletter/subscribe` upserts a public newsletter subscriber, monthly membership interest, preferred tier, selected cigar brands, matched promoted cigars, source, and audit row. Subscriber follow-up email remains guarded until the selected outbound provider is ready; do not use the GoDaddy/Microsoft 365 mailbox path for bulk newsletter campaigns. Replies should go to `SUPPORT_EMAIL_INBOUND_RECIPIENT`.
- `POST /content/pages` stores published public-page edits and an audit row.
- `POST /news/story-drafts` creates a review-required YCCNewsAgent story draft from official or operator-verified primary source URLs.
- `POST /news/stories` stores an operator-approved story in `news_stories` and writes an audit row.
- `GET /news/stories` reads published stories for the public static storefront without Cognito.
- `POST /humidor/identify-cigar` uses Bedrock Runtime vision to identify a member-uploaded cigar image, returns editable humidor fields plus richer cigar-reference details, and writes a safe field-coverage log without image bytes or raw member notes.
- `POST /humidor/items` stores the member, humidor item, and audit row after the member confirms the fields.
- `GET /humidor/alerts` reads stored humidor notification preference settings from `member_profiles.preferences`.
- `POST /humidor/alerts` writes humidor alert preference settings (including push subscription details) to `member_profiles.preferences` and writes an audit row.
- AWS IoT Core can invoke the Lambda with `source=ycc.humidor.iot.telemetry` or a `ycc/humidor/{thingName}/telemetry` topic payload. The handler matches `{thingName}` or `deviceId`/`identifier` to saved `pairedDevices`, updates humidity, temperature, status, and `lastSyncedAt` in `member_profiles.preferences`, and writes a `humidor_device.telemetry_ingested` audit row.
- `POST /humidor/alerts/dispatch` sends reorder reminder pushes for due items after checking `HUMIDOR_ALERT_DISPATCH_SECRET`, writes `humidorReorderReminderDispatchedOn` into item metadata for sent items, and disables invalid push subscriptions when web-push returns 404/410.
- `POST /concierge/voice` accepts a short member voice message, uses Amazon Transcribe for speech-to-text when `FEATURE_CONCIERGE_VOICE=ready`, routes the transcript through the same concierge exchange, and uses Amazon Polly for spoken replies.
- Stripe Checkout and subscription webhooks write order/subscription rows and backfill the canonical Stripe Customer ID onto `members.stripe_customer_id` when the event email matches a member.
- Stripe `checkout.session.completed` webhooks now send a Yuzu order-confirmation email only after the paid checkout has been recorded and the outbound provider is ready. Stripe still sends its own payment receipt; the Yuzu email confirms fulfillment/compliance review and stores the provider message id in `processing.orderEmail`.
- Member welcome email is intentionally sent after membership activation, not after Cognito account confirmation. Friends & Family Box Pass claims send the branded benefits/tips welcome after the entitlement is granted; Stripe `customer.subscription.created` webhooks send it after an active subscription is stored. The response includes `memberWelcomeEmail.status` as `sent`, `pending_ses`, `pending_email_provider`, `failed`, or `skipped`.
- Do not create per-customer SES recipient identities from signup, post-confirmation, membership activation, order confirmation, or newsletter flows. In SES sandbox, recipient identity verification sends an AWS-branded verification message to the customer and is not a Yuzu onboarding experience. It is only a temporary operator/test exception for known inboxes. Customer account confirmation must use the branded Cognito verification template; support, low-volume welcome, and order email use the guarded selected provider once it is configured and smoke-tested.

If schema writes are not enabled, the same routes keep returning the contract response with persistence marked as pending. The handler reads the RDS credentials from Secrets Manager at runtime and never exposes database credentials in API responses.

## Push dispatch settings

- `HUMIDOR_ALERT_DISPATCH_SECRET` authorizes `POST /humidor/alerts/dispatch` calls.
- `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, and `VAPID_SUBJECT` are required for web-push VAPID signing.
- The static storefront build must set `NEXT_PUBLIC_VAPID_PUBLIC_KEY` to the same value as Lambda's `VAPID_PUBLIC_KEY`; otherwise browsers cannot create deliverable mobile push subscriptions.
- A scheduled dispatcher can invoke the live Lambda alias with `routeKey=POST /humidor/alerts/dispatch` and the dispatch secret header so due reorder and climate alerts are evaluated without a browser session.

## Humidor AWS IoT

Run `scripts/setup-ycc-humidor-iot.ps1` after packaging/publishing a Lambda version to create or update:

- IoT policy `YccHumidorDeviceTelemetryPolicy`
- Thing type `YccHumidorDevice`
- Topic rule `YccHumidorTelemetryToLambda`
- Lambda invoke permission scoped to the IoT rule

Pass `-SampleThingName <thing-name> -ProvisionSampleCertificate` to create a sample Thing certificate and store the generated certificate/private key files under the gitignored `secure/humidor-iot/<thing-name>/` directory. Do not copy those private keys into source control, tickets, logs, or chat.

Devices should connect with an IoT Thing certificate and publish JSON telemetry to `ycc/humidor/{thingName}/telemetry`, for example:

```json
{
  "humidity": 68.4,
  "temperature": 70.2,
  "batteryPercent": 94,
  "recordedAt": "2026-05-27T15:00:00.000Z"
}
```

The member pairing identifier in `pairedDevices` should equal the IoT Thing name unless a payload supplies a matching `deviceId` or `identifier`.

## Schema Migrations

Direct Lambda migration invokes are guarded and intended for operator use from the scoped AWS profile:

- `source=ycc.phase3.migration`, `action=apply_phase3_schema`, confirm `APPLY_YCC_PHASE3_SCHEMA`
- `source=ycc.phase3.migration`, `action=verify_phase3_schema`
- `source=ycc.commerce.migration`, `action=apply_commerce_schema`, confirm `APPLY_YCC_COMMERCE_SCHEMA`
- `source=ycc.commerce.migration`, `action=verify_commerce_schema`
- `source=ycc.site_content.migration`, `action=apply_site_content_schema`, confirm `APPLY_YCC_SITE_CONTENT_SCHEMA`
- `source=ycc.site_content.migration`, `action=verify_site_content_schema`
- `source=ycc.newsroom.migration`, `action=apply_newsroom_schema`, confirm `APPLY_YCC_NEWSROOM_SCHEMA`
- `source=ycc.newsroom.migration`, `action=verify_newsroom_schema`
- `source=ycc.phase3.migration`, `action=apply_member_stripe_customer_link_schema`, confirm `APPLY_YCC_MEMBER_STRIPE_CUSTOMER_LINK_SCHEMA`
- `source=ycc.phase3.migration`, `action=verify_member_stripe_customer_link_schema`

## AI Runtime

When `FEATURE_LEX_ROUTER=ready`, `POST /concierge/chat` first calls Amazon Lex V2 `RecognizeText` using `LEX_ROUTER_BOT_ID`, `LEX_ROUTER_BOT_ALIAS_ID`, and `LEX_ROUTER_LOCALE_ID` to detect intent and collect required slots. If Lex returns a guided prompt such as `ElicitSlot`, the API returns that prompt without invoking Bedrock. Once Lex has enough context, Lambda maps the recognized intent to the existing YCC agent layer. If Lex is not configured or unavailable, the handler falls back to the local keyword router.

When `FEATURE_BEDROCK=runtime_ready`, `POST /concierge/chat` invokes Bedrock for the selected YCC agent. Cigar-guide requests use direct Bedrock Runtime with the shared knowledge base. Other specialist agents can still use published Bedrock Agent Runtime aliases when they need action groups. The route passes authenticated member session attributes into those agent calls so Lambda action groups can safely persist support drafts and humidor updates.

- `YCCConcierge` for general member routing.
- `YCCCigarGuide` for wrapper, vitola, tasting, storage, and pairing guidance.
- `YCCSupportAgent` for support triage and operator-ready drafts.
- `YCCHumidorAgent` for inventory, storage, aging, tasting logs, and reorder guidance.
- `YCCAdminAgent` for internal admin/operator reasoning.
- `YCCNewsAgent` for authorized cigar-news drafts based on official brand, company, distributor, event, regulator, or wire sources. The website newsroom workflow keeps generated stories in draft review until a Cognito admin or concierge operator approves publication.

The live agents share Knowledge Base `48GFMCLSTG` and the `YCCOperations` action-group executor, but each agent has a least-privilege function schema from `infra/bedrock/ycc-agent-action-group-config.json`. Agent aliases are rebuilt on guardrail version `8`; direct Runtime guardrails are enabled when the serving Lambda version has `BEDROCK_ENABLE_GUARDRAILS=1`. `YCCAdminAgent` and `YCCNewsAgent` require a Cognito `admin` or `concierge_operator` group claim.

If Agent Runtime fails, the route logs the fallback and tries direct Bedrock Runtime `Converse` with `BEDROCK_MODEL_ID`. If that also fails, it returns the scaffolded assistant contract rather than failing the member request.

`POST /humidor/identify-cigar` powers the AI Cigar Adder. When `FEATURE_REKOGNITION=detect_text_ready`, Lambda first runs Amazon Rekognition `DetectText` against member-uploaded PNG/JPEG bytes, filters line detections by `REKOGNITION_MIN_TEXT_CONFIDENCE`, and passes those OCR candidates into the Bedrock Nova Vision prompt as visual evidence. When `FEATURE_REKOGNITION=image_understanding_ready`, Lambda also runs `DetectLabels`, filters visual labels by `REKOGNITION_MIN_LABEL_CONFIDENCE`, and passes cigar, box, band, receipt, or humidor-scene cues into the same prompt as supplemental visual context. `PATCH /humidor/items/{id}/enrich` uses the same Rekognition path for saved member-uploaded humidor images before asking `YCCHumidorAgent` to fill missing info, image, or MSRP fields. Rekognition failures, unsupported GIF/WebP images, disabled feature flags, or missing permissions degrade back to the existing Bedrock-only image identification/enrichment flow, and the routes still require member confirmation before saving anything to the humidor.

## Concierge Voice

Amazon Chime SDK is not used for concierge speech recognition or speech synthesis. Voice input is handled by Amazon Transcribe, and voice output is handled by Amazon Polly. Browser speech recognition can pass a transcript hint so local/static previews can still submit a voice message while AWS speech services are pending.

Server-only settings:

- `FEATURE_CONCIERGE_VOICE=ready` enables Transcribe and Polly.
- `CONCIERGE_VOICE_BUCKET` and `CONCIERGE_VOICE_PREFIX` define the S3 location for short-lived voice inputs and transcript JSON output.
- `CONCIERGE_TRANSCRIBE_LANGUAGE_CODE` defaults to `en-US`.
- `CONCIERGE_POLLY_ENGINE` defaults to `neural`; `CONCIERGE_POLLY_VOICE_ID` defaults to `Joanna`.

## Outbound Transactional Email

`POST /newsletter/subscribe`, member welcome, Stripe order confirmation, `POST /support/contact`, and `POST /support/email-send` all use the same guarded outbound mail path. SES remains supported for local/operator compatibility only when `EMAIL_PROVIDER` is unset or `ses` and `FEATURE_SES=ready`; live Yuzu production should keep `FEATURE_SES=pending_production_access` because AWS SES production access was final-denied under case `177809591700724`.

For the no-new-spend replacement path, set `EMAIL_PROVIDER=godaddy_m365_smtp` and set `FEATURE_EMAIL_PROVIDER=ready` only after the existing GoDaddy/Microsoft 365 mailbox has SMTP AUTH enabled, an app password or equivalent mailbox credential is available, and an internal smoke send succeeds. The default SMTP host is `smtp.office365.com` on port `587` with STARTTLS. Store credentials in Secrets Manager via `EMAIL_PROVIDER_SECRET_ARN` or `EMAIL_PROVIDER_SECRET_ID` when possible; root secret values such as `{ "username": "support@yuzucigarclub.com", "password": "...", "host": "smtp.office365.com", "port": 587 }` or nested values such as `{ "godaddy_m365_smtp": { "username": "...", "password": "..." } }` are supported. Direct env fallback is also supported through `M365_SMTP_USERNAME`, `M365_SMTP_PASSWORD`, `M365_SMTP_HOST`, and `M365_SMTP_PORT`.

Dormant API-provider compatibility remains available with `EMAIL_PROVIDER=brevo`, `mailgun`, `postmark`, or `sendgrid`, but those integrations are not required for the current-tools path. Use SendGrid only if Twilio reverses the current account denial in writing.

`POST /newsletter/subscribe` still succeeds when outbound mail is pending and reports `pending_ses` or `pending_email_provider`. Do not use the GoDaddy/Microsoft 365 mailbox path for bulk newsletter campaigns; it is for low-volume transactional/support/welcome/order email. The selected-cigar promotion email includes text and branded HTML bodies so clients can render product images, public costs, member costs, and shop links while preserving a plain-text fallback. Member welcome email and order confirmation use the same provider-neutral path and return `provider` plus `providerMessageId` for non-SES sends. Per-customer SES recipient verification must not be used as an onboarding step because it sends AWS-branded verification email and does not solve production delivery. `POST /support/contact` is public but only sends to the configured YCC support recipient (`SUPPORT_CONTACT_EMAIL_TO`, falling back to `SUPPORT_EMAIL_FROM`) when outbound mail is ready and sets Reply-To to the visitor. `POST /support/email-send` is restricted to Cognito `admin` and `concierge_operator` groups. SES receipt events are still accepted directly from the active receipt rule set for inbound processing; the handler reads raw email from `SUPPORT_EMAIL_RAW_BUCKET` and `SUPPORT_EMAIL_RAW_PREFIX`, routes every inbound email through `YCCSupportAgent`, then persists the inbound support case, received email, and an operator-review outbound draft.

## Bedrock Action Group

Bedrock invokes this same Lambda directly for `YCCOperations` events. Those events bypass API Gateway JWT parsing but use Bedrock session attributes to rebuild the actor context.

Supported function catalog:

- `GetMemberProfile`
- `DraftSupportReply`
- `AddHumidorItem`
- `GetAdminQueueSummary`
- `UpdateAdminOrder`
- `UpdateAdminMemberAccess`
- `DraftWeeklyNews`

Live per-agent schemas:

| Agent | Functions |
| --- | --- |
| `YCCConcierge` | `GetMemberProfile`, `DraftSupportReply` |
| `YCCCigarGuide` | `GetMemberProfile` |
| `YCCSupportAgent` | `GetMemberProfile`, `DraftSupportReply` |
| `YCCHumidorAgent` | `GetMemberProfile`, `AddHumidorItem` |
| `YCCAdminAgent` | `GetMemberProfile`, `DraftSupportReply`, `GetAdminQueueSummary`, `UpdateAdminOrder`, `UpdateAdminMemberAccess` |
| `YCCNewsAgent` | `DraftWeeklyNews` |

`UpdateAdminOrder`, `UpdateAdminMemberAccess`, and `AddHumidorItem` are confirmation-gated in the Bedrock function schema. Admin functions also validate the calling agent surface inside Lambda; if a stale or misconfigured action group asks a non-admin specialist to run an admin function, Lambda returns `wrong_agent_tool` before reaching any database write path. Admin order fixes allow `admin` and `concierge_operator`; member-access fixes require `admin`.
