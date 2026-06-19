# Yuzu Email Operating Process

Date: 2026-06-18

## Decision

Use a three-lane email process:

1. Cognito auth email for signup, password reset, MFA, temporary passwords, and resend-confirmation flows.
2. Human mailbox provider for direct support/concierge inboxes.
3. Pre-cleared transactional email provider for app-driven support, member welcome, order, billing, and opt-in newsletter email.

Do not use SES recipient verification as customer onboarding. Do not use WorkMail. Do not use SendGrid unless Twilio reverses ticket `27589567`.

## Current Facts

- Cognito branded verification email is live and verified end to end.
- AWS SES production access is final-denied under case `177809591700724`.
- SES sandbox recipient verification sends an AWS-branded message and is not acceptable for customer signup.
- Twilio SendGrid activation was denied for Yuzu's attempted account.
- Amazon WorkMail is ending support on 2027-03-31, stopped accepting new customers on 2026-04-30, and no Yuzu WorkMail organization exists in checked regions.
- Root-domain MX currently points to SES inbound capture, so root mail routing should not be changed casually.

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

- Do not route Lambda/app transactional email through a human mailbox by default.
- Do not use mailbox SMTP for newsletter or automated customer mail at scale.
- Do not move root MX until the SES inbound-capture replacement path is designed.
- If a mailbox provider is adopted, plan DNS carefully:
  - either move root MX deliberately and replace SES inbound capture,
  - or keep app/inbound automation on subdomains until support routing is redesigned.

## Lane 3: Automated App Email

Use a pre-cleared transactional email provider for:

- member welcome after membership activation
- support replies generated/sent by admin tools
- order and billing notices
- membership status notices
- opt-in newsletter follow-ups

Provider selection order:

1. Brevo after support pre-clearance for legal cigar/tobacco use.
2. Mailgun after sales/support pre-clearance for legal cigar/tobacco use.
3. Another provider only if it gives written approval for Yuzu's 21+ legal cigar use case.

Rules:

- Get written provider approval before DNS/API integration.
- Use a dedicated sending subdomain such as `tx.yuzucigarclub.com` or `mg.yuzucigarclub.com`.
- Keep transactional and marketing sends separated by domain, stream, tag, or provider pool.
- Store API keys in AWS Secrets Manager only.
- Add SPF, DKIM, and DMARC alignment before any production sends.
- Wire bounce, complaint, unsubscribe, and suppression webhooks before enabling newsletter or promotional sends.
- Keep `FEATURE_SES=pending_production_access`; introduce a provider-neutral flag such as `FEATURE_EMAIL_PROVIDER=mailgun` or `FEATURE_EMAIL_PROVIDER=brevo` after approval.

Brevo policy:

- https://www.brevo.com/legal/antispampolicy/

Mailgun policy:

- https://www.mailgun.com/legal/aup/

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

Automated transactional email after provider approval:

- provider account approved in writing
- sending domain verified
- API key stored in Secrets Manager
- Lambda health shows provider ready
- support/contact smoke sends to an internal verified mailbox
- member welcome smoke sends to an internal verified mailbox
- webhook smoke records bounce/complaint/suppression events
- app audit row stores provider message id
- no sends to real customer lists until unsubscribe/suppression is verified

## Immediate Next Steps

1. Keep Cognito for signup. This is already working.
2. Choose a human mailbox provider for `support@` and `concierge@` if manual inboxes are needed.
3. Send Brevo and Mailgun pre-clearance requests before creating production DNS/API integration.
4. After one provider approves Yuzu in writing, implement a provider-neutral Lambda mailer and smoke it against internal addresses.
5. Replay pending member welcome emails only after the provider is live and suppression handling is working.

## Hard No List

- No SES recipient verification as customer onboarding.
- No automated customer email through GoDaddy/Microsoft 365 mailbox SMTP.
- No WorkMail setup.
- No SendGrid unless Twilio explicitly reverses account denial.
- No purchased, rented, scraped, appended, or cold outreach lists.
- No root MX changes without an inbound support-routing migration plan.
