# Mailgun Transactional Email Setup

Date: 2026-06-18

## Recommendation

Use Mailgun only after Sinch/Mailgun pre-clears Yuzu Cigar Club's 21+ legal cigar use case in writing.

Do not replace Cognito signup verification with Mailgun at first. Keep Cognito's branded verification email for account confirmation and use Mailgun for non-Cognito app email only after approval:

- member welcome after activation
- support replies
- newsletter follow-ups for opted-in subscribers
- account, billing, and membership notices outside Cognito auth flows

## Sending Domain

Use a dedicated transactional subdomain:

```text
mg.yuzucigarclub.com
```

Keep root-domain mail and human inboxes separate. Do not move the root MX while SES inbound capture is still part of the support-email path.

## Pre-Clearance Message

Send this before relying on the account:

```text
We operate Yuzu Cigar Club, a US-based 21+ age-gated cigar membership and ecommerce site.

We are seeking pre-clearance to use Mailgun for transactional email only at first:
- account and membership notices
- member activation/welcome emails
- customer support replies
- order, billing, and compliance notices
- opt-in newsletter follow-ups only after explicit consent

We will not send purchased, rented, scraped, appended, or cold outreach lists. Marketing email will be opt-in only, with unsubscribe handling and suppression management. Our signup and shopping flows are age-gated, and our site has privacy/terms pages and tobacco compliance language.

Can Sinch/Mailgun approve this legal cigar/tobacco use case for transactional email sending before we configure DNS and API integration?
```

## Account Setup Checklist

1. Create the account at `https://signup.mailgun.com/` with the real business owner email and billing details.
2. Open a support or sales ticket with the pre-clearance message above before sending production customer email.
3. Add sending domain `mg.yuzucigarclub.com`.
4. Copy Mailgun's DNS records for that domain.
5. Add the DNS records in Route 53:
   - SPF TXT for `mg.yuzucigarclub.com`
   - DKIM TXT or CNAME records from Mailgun
   - tracking CNAME if click/open tracking is enabled
   - MX records only for the Mailgun subdomain if inbound routing is needed there
6. Verify the domain in Mailgun.
7. Create a restricted API key for sending only.
8. Store the key in AWS Secrets Manager; do not put it in `.env.local`, source files, tickets, or chat.
9. Wire Lambda to a provider-neutral mail setting, for example `FEATURE_EMAIL_PROVIDER=mailgun`, while keeping `FEATURE_SES=pending_production_access`.
10. Send a smoke test only after written provider approval and verified DNS.

## DNS Notes

- Do not create a second SPF TXT record at a hostname that already has one. Merge SPF includes if Mailgun is ever configured on an existing hostname.
- Do not use the root domain for Mailgun until a separate inbound-mail decision is made.
- Keep transactional, newsletter/marketing, and corporate mail on separate domains or subdomains.
