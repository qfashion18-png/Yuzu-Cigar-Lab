# Stripe Charge Enablement Escalation - 2026-06-13

## Current State

- Stripe account: `acct_1SofC90r0rWXiDV5`
- Dashboard display name: `Company Q`
- Account type: Standard
- Country/currency: `US` / `usd`
- Live app account and Stripe connector account match.
- Current live account state:
  - `charges_enabled=false`
  - `payouts_enabled=false`
  - `details_submitted=true`
  - `capabilities.card_payments=inactive`
  - `capabilities.transfers=inactive`
- Capability readback:
  - `card_payments` is already `requested=true`
  - `transfers` is already `requested=true`
  - `requirements.currently_due=[]`
  - `requirements.past_due=[]`
  - `requirements.errors=[]`
  - `requirements.disabled_reason=null`

## Disablement Evidence

- Stripe event `evt_1TgD5U0r0rWXiDV5VlkY6l4y`
  - Created: `2026-06-09T00:00:12.000Z`
  - Type: `account.updated`
  - Previous state included:
    - `charges_enabled=true`
    - `capabilities.card_payments=active`
    - `capabilities.transfers=active`
  - Current state in the event changed to:
    - `charges_enabled=false`
    - `capabilities.card_payments=inactive`
    - `capabilities.transfers=inactive`

## Prior Approval And Readiness Evidence

- Commerce secret `ycc/commerce/prod` records:
  - `stripe.tobaccoApprovalConfirmed=true`
  - `stripe.approvalConfirmedAt=2026-05-25T15:58:00-07:00`
  - `stripe.approvalSource=Stripe Support email confirming Company Q meets Stripe Services Agreement; no further action needed.`
- Stripe Tax is ready:
  - `tax.provider=Stripe Tax`
  - `tax.ready=true`
  - `tax.status=ready`
  - active registration count: `1`
- Adult-signature fulfillment is ready:
  - `shipping.provider=USPS`
  - `shipping.adultSignatureCarrierApproved=true`
  - `shipping.adultSignature.ready=true`
  - service: `USPS Adult Signature Required`
- Live integration is wired:
  - Webhook endpoint `we_1TWhGd0r0rWXiDV5NauujGL0` is enabled.
  - Webhook URL: `https://api.yuzucigarclub.com/commerce/webhook/stripe`
  - Live backend health returns `status=ok`.
  - Admin Stripe sync reports Stripe, webhook, catalog, and tax ready with `923` published products and `12` membership price keys.

## API Attempt Result

Attempted safe/idempotent capability requests:

- `POST /v1/accounts/acct_1SofC90r0rWXiDV5/capabilities/card_payments` with `requested=true`
- `POST /v1/accounts/acct_1SofC90r0rWXiDV5/capabilities/transfers` with `requested=true`

Stripe returned HTTP `400` for both:

```text
You cannot update your own account's capabilities through the API.
```

This is a Standard Stripe account, so charge enablement must be handled through Stripe Dashboard or Stripe Support rather than by the live integration.

## Paste-Ready Stripe Support Message

Subject: Please re-enable live charges for Company Q / acct_1SofC90r0rWXiDV5

Hello Stripe Support,

Please review and re-enable live card charges for Company Q, account `acct_1SofC90r0rWXiDV5`.

The account was previously charge-enabled. Stripe event `evt_1TgD5U0r0rWXiDV5VlkY6l4y` at `2026-06-09T00:00:12.000Z` changed `charges_enabled` from `true` to `false` and changed `card_payments` and `transfers` from `active` to `inactive`.

The account currently shows `details_submitted=true`, but `charges_enabled=false`, `payouts_enabled=false`, `card_payments=inactive`, and `transfers=inactive`. The API exposes no currently due requirements, no past-due requirements, no requirement errors, no pending verification, and no disabled reason for `card_payments`.

Stripe Support previously confirmed on `2026-05-25T15:58:00-07:00` that Company Q meets the Stripe Services Agreement and that no further action was needed for the Yuzu Cigar Club cigar/tobacco commerce model. The live integration includes adult-only commerce controls, AgeChecker.Net checkout verification, USPS Adult Signature Required fulfillment, Stripe Tax with an active Arizona registration, and a backend-controlled catalog/order pipeline.

Please either re-enable `card_payments`/live charges or tell us exactly what additional documentation or Dashboard action is required. If this is a restricted-business review hold, please reopen or attach this request to the prior approval review so we can provide any needed proof promptly.

Thank you.

## Owner Dashboard Path

1. Log in as the Stripe account owner or an admin for `acct_1SofC90r0rWXiDV5`.
2. Open `https://dashboard.stripe.com/acct_1SofC90r0rWXiDV5/account/onboarding`.
3. Check for any hidden identity, owner, representative, or restricted-business review prompts.
4. Open Stripe Support from the same account and paste the message above if there is no visible self-service prompt.
