# Yuzu Email Operating Process

Date: 2026-06-18

Updated: 2026-07-02

## Decision

Use a three-lane email process without buying another email platform:

1. Cognito auth email for signup, password reset, MFA, temporary passwords, and resend-confirmation flows.
2. Human mailbox provider for direct support/concierge inboxes.
3. Existing GoDaddy/Microsoft 365 mailbox SMTP for low-volume app-driven support, member welcome, order, and billing email.

Do not use SES recipient verification as customer onboarding. Do not use WorkMail. Do not use SendGrid unless Twilio reverses ticket `27589567`. Do not use the GoDaddy/Microsoft 365 mailbox as a bulk newsletter platform.

## Current Facts

- Cognito branded verification email is live and verified end to end.
- AWS SES production access is final-denied under case `177809591700724`.
- SES sandbox recipient verification sends an AWS-branded message and is not acceptable for customer signup.
- Twilio SendGrid activation was denied for Yuzu's attempted account.
- Amazon WorkMail is ending support on 2027-03-31, stopped accepting new customers on 2026-04-30, and no Yuzu WorkMail organization exists in checked regions.
- Root-domain MX currently points to SES inbound capture, so root mail routing should not be changed casually.
- Live recheck on 2026-07-02 still shows SES production access disabled and denied under case `177809591700724`.
- The GoDaddy API credentials checked on 2026-07-02 can see `yuzucigarclub.com` as a registered domain, but the GoDaddy DNS records API returns `UNKNOWN_DOMAIN` because there is no active GoDaddy zone file. Authoritative DNS is Route 53, so email DNS changes must be made there, not through GoDaddy DNS.
- GoDaddy/Microsoft 365 SMTP submission uses `smtp.office365.com`, port `587`, and STARTTLS. It is the no-new-spend path for low-volume app email, but it has mailbox submission limits and should not be used for bulk campaigns.
- Lambda `ycyyy:live` version `46` was deployed on 2026-07-02 with provider-neutral outbound support plus the GoDaddy/Microsoft 365 SMTP current-tools path. Health now reports `capabilities.emailProvider`, currently `pending_production_access` because no GoDaddy/Microsoft 365 SMTP credential is configured.

## Lane 1: Account/Auth Email

Use Cognito's branded email for:

- signup verification code
- resend verification code
- password reset
- MFA / OTP
- temporary password / invite flows if used later

Rules:

- Keep auth email short, branded, and focused on verification.
- Do not include heavy marketing in auth messages.
- Keep the confirmation link pointing to the Yuzu flow, currently `/friends-family/?confirmation_code={####}`.
- Keep the Cognito email E2E check as the release gate.

Current command:

```powershell
npm run cognito-email:e2e -- --live --json
```

Optional disposable live-send check:

```powershell
npm run cognito-email:e2e -- --live --send-email --json
```

AWS docs:

- https://docs.aws.amazon.com/cognito/latest/developerguide/user-pool-email.html
- https://docs.aws.amazon.com/cognito/latest/developerguide/user-pool-lambda-custom-email-sender.html

## Lane 2: Human Mailboxes

Use a mailbox provider for:

- `support@yuzucigarclub.com`
- `concierge@yuzucigarclub.com`
- direct human replies
- one-off manual customer service notes

Acceptable providers:

- Google Workspace
- Microsoft 365 / GoDaddy Microsoft 365
- Zoho Mail

Rules:

- Do not route high-volume, bulk, or marketing automation through a human mailbox.
- Do not use mailbox SMTP for newsletter/customer-list campaigns or automated mail at scale.
- GoDaddy/Microsoft 365 can be used for human inboxes and the current low-volume app email path only after the specific mailbox has SMTP AUTH enabled and current Microsoft auth requirements are satisfied.
- Do not move root MX until the SES inbound-capture replacement path is designed.
- If a mailbox provider is adopted, plan DNS carefully:
  - either move root MX deliberately and replace SES inbound capture,
  - or keep app/inbound automation on subdomains until support routing is redesigned.

## Lane 3: Automated App Email With Current Tools

Use the existing GoDaddy/Microsoft 365 mailbox SMTP path for:

- member welcome after membership activation
- support replies generated/sent by admin tools
- order and billing notices
- membership status notices

Do not use it for:

- bulk newsletter campaigns
- scraped, purchased, cold, or partner lists
- high-volume promotional blasts

Rules:

- Keep `FEATURE_SES=pending_production_access`.
- Set `EMAIL_PROVIDER=godaddy_m365_smtp`.
- Set `FEATURE_EMAIL_PROVIDER=ready` only after the mailbox has SMTP AUTH enabled, the app password or equivalent credential is stored securely, and internal smoke tests pass.
- Keep From as the authenticated mailbox unless Microsoft 365 explicitly allows the alias.
- Keep volume low and transactional.

Required credential values:

- `M365_SMTP_HOST=smtp.office365.com`
- `M365_SMTP_PORT=587`
- `M365_SMTP_USERNAME=support@yuzucigarclub.com`
- `M365_SMTP_PASSWORD=<app password or mailbox SMTP credential>`

Preferred secret shape:

```json
{
  "godaddy_m365_smtp": {
    "host": "smtp.office365.com",
    "port": 587,
    "username": "support@yuzucigarclub.com",
    "password": "..."
  }
}
```

Implemented Lambda provider values:

- `godaddy_m365_smtp`
- `m365_smtp`
- `office365_smtp`
- `brevo`
- `mailgun`
- `postmark`
- `sendgrid`, only after Twilio reverses the existing denial

Provider credentials can live in Secrets Manager through `EMAIL_PROVIDER_SECRET_ARN` or `EMAIL_PROVIDER_SECRET_ID`. To avoid incremental Secrets Manager cost, operator-managed Lambda environment variables are also supported, but do not commit real passwords to repo files.

## Compliance Rules

All customer email:

- must use accurate From, Reply-To, and subject lines
- must identify Yuzu Cigar Club clearly
- must never use purchased, rented, scraped, appended, or third-party lists
- must keep tobacco/cigar messaging lawful, age-gated, and targeted only to appropriate audiences

Commercial or promotional email:

- requires opt-in consent
- must include unsubscribe handling
- must include a valid physical postal address when required
- must honor opt-outs promptly

Transactional/relationship email:

- should put the transactional purpose first in subject and body
- should avoid turning receipts, account notices, support replies, or password flows into promotions

FTC CAN-SPAM guide:

- https://www.ftc.gov/business-guidance/resources/can-spam-act-compliance-guide-business

## DNS Process

1. Pick the lane and sending hostname.
2. Confirm no existing MX/SPF/DKIM/DMARC record will be broken.
3. Add provider records in Route 53.
4. Wait for provider verification.
5. Run DNS checks:

```powershell
Resolve-DnsName -Type TXT tx.yuzucigarclub.com
Resolve-DnsName -Type CNAME selector._domainkey.tx.yuzucigarclub.com
Resolve-DnsName -Type TXT _dmarc.yuzucigarclub.com
```

6. Send only a controlled smoke test.
7. Verify provider event logs, webhook intake, and app audit rows.

## E2E Release Gates

Auth email:

- `npm run cognito-email:e2e -- --live --json`
- optional disposable email send
- browser check that the confirmation link opens the right Yuzu flow

Automated transactional email after mailbox credential setup:

- GoDaddy/Microsoft 365 mailbox exists
- SMTP AUTH is enabled for the mailbox
- MFA app password or current Microsoft-compatible SMTP credential is available
- Lambda env sets `EMAIL_PROVIDER=godaddy_m365_smtp` and `FEATURE_EMAIL_PROVIDER=ready`
- Lambda health shows `capabilities.emailProvider=godaddy_m365_smtp_ready`
- support/contact smoke sends to an internal verified mailbox
- member welcome smoke sends to an internal verified mailbox
- Stripe checkout/order webhook smoke records `processing.orderEmail.status=sent`
- app audit row stores provider message id
- no bulk/newsletter sends through the mailbox path

## Immediate Next Steps

1. Keep Cognito for signup. This is already working.
2. In GoDaddy/Microsoft 365, enable SMTP Authentication for `support@yuzucigarclub.com`.
3. Create an app password or current Microsoft-compatible SMTP credential for that mailbox.
4. Store the credential in Lambda env or an existing approved secret, set `EMAIL_PROVIDER=godaddy_m365_smtp`, set `FEATURE_EMAIL_PROVIDER=ready`, and smoke test support/contact, member welcome, and Stripe order confirmation against internal addresses.
5. Replay pending member welcome emails only after the mailbox smoke tests pass.

## Hard No List

- No SES recipient verification as customer onboarding.
- No bulk/newsletter/customer-list campaigns through GoDaddy/Microsoft 365 mailbox SMTP.
- No WorkMail setup.
- No SendGrid unless Twilio explicitly reverses account denial.
- No purchased, rented, scraped, appended, or cold outreach lists.
- No root MX changes without an inbound support-routing migration plan.
