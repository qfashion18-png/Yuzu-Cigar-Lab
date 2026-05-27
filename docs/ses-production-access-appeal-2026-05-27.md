# SES Production Access Appeal Packet

Date: 2026-05-27
Region: us-east-1
Account: 374587466106
Existing SES case: 177809591700724

## Current Status

- `ProductionAccessEnabled=false`
- `SendingEnabled=true`
- `EnforcementStatus=HEALTHY`
- `ReviewStatus=DENIED`
- `yuzucigarclub.com` domain identity is verified for sending and DKIM is `SUCCESS`.
- `ses-support.yuzucigarclub.com` domain identity is verified for sending and DKIM is `SUCCESS`.
- `yuzucigarclub.com` now uses custom MAIL FROM `bounce.yuzucigarclub.com` with status `SUCCESS`.
- AWS SES sent the custom MAIL FROM success confirmation email for `bounce.yuzucigarclub.com` in `us-east-1`.
- `bounce.yuzucigarclub.com` has the SES-required MX and SPF records:
  - MX: `10 feedback-smtp.us-east-1.amazonses.com`
  - TXT: `v=spf1 include:amazonses.com ~all`
- The SES account now only contains verified Yuzu identities. Failed standalone identities were removed because the verified domain identity already covers Yuzu sender addresses.
- Configuration set `ycc-support-email-events` has an enabled SNS event destination for `BOUNCE`, `COMPLAINT`, `DELIVERY_DELAY`, and `REJECT`.

## Appeal Text

Hello AWS Trust & Safety team,

Please reopen or re-review Amazon SES production access for Yuzu Cigar Club in `us-east-1`.

Yuzu Cigar Club is requesting production access only for legitimate transactional and opt-in customer communication. The mail stream is limited to account, membership, billing, order, support, humidor-alert, and explicit opt-in newsletter messages for adult customers or members who already have a relationship with Yuzu Cigar Club. We do not use purchased lists, scraped addresses, cold outreach, or third-party lead lists.

The public site is `https://www.yuzucigarclub.com/`. Privacy and terms pages are live at:

- `https://www.yuzucigarclub.com/privacy/`
- `https://www.yuzucigarclub.com/terms/`

Sending identities are already configured:

- `yuzucigarclub.com` is verified for sending with DKIM `SUCCESS`.
- `ses-support.yuzucigarclub.com` is verified for sending with DKIM `SUCCESS`.
- `bounce.yuzucigarclub.com` is configured as the custom MAIL FROM domain for `yuzucigarclub.com`; its MX and SPF records are published and SES reports custom MAIL FROM `SUCCESS`.
- AWS SES has also sent the confirmation email that it detected the required MX record for `bounce.yuzucigarclub.com` in US East (N. Virginia).

Compliance and reputation controls in place:

- Account-level suppression is configured for bounces and complaints.
- The `ycc-support-email-events` configuration set sends bounce, complaint, delivery-delay, and reject events to SNS for monitoring.
- Newsletter traffic is opt-in only.
- Support messages are sent only in response to inbound customer/support activity or authenticated account workflows.
- Tobacco commerce is age-gated and checkout requires AgeChecker-backed 21+ verification before payment.
- Transactional support and order emails are tied to authenticated users, order records, or explicit customer support interactions.
- We will monitor bounce/complaint metrics and immediately suppress problem recipients.

Requested mail type: `TRANSACTIONAL`.
Initial expected volume: low launch volume, under the current sandbox quota pattern while reputation is established.
Requested production access is needed so order, support, account, and opt-in newsletter flows can reach real customers instead of only pre-verified test recipients.

Thank you for reviewing the corrected compliance posture and verified-domain setup.

## Console Submission Steps

1. Open the Amazon SES console in `us-east-1`.
2. Go to Account dashboard.
3. Open the production access review/case linked to `177809591700724`.
4. If the case can be reopened, paste the appeal text above.
5. If reopening is unavailable, use the SES production access/Get set up workflow or AWS Support Center case path that routes to AWS Trust & Safety, and include the existing case ID.

## API Attempts Already Made

`sesv2 put-account-details --production-access-enabled` returns `ConflictException` even with root credentials because the latest review status is `DENIED`.

The AWS Support API cannot append to the case from the current support plan. `support:DescribeCases` returns `SubscriptionRequiredException`, which matches AWS documentation for accounts without Business, Enterprise On-Ramp, Enterprise, or Unified Operations support plans.

## Likely Denial Factors Remediated

AWS does not disclose the exact Trust & Safety denial reason through SES APIs or Support APIs on this support plan. Based on the account posture visible after the denial, these issues were remediated before appeal:

- Failed SES identities were present in the account; only verified Yuzu domain identities remain now.
- The sending domain had DKIM but did not have custom MAIL FROM/SPF alignment for SES; custom MAIL FROM is now configured and verified.
- The appeal evidence now explicitly documents opt-in scope, transactional-only use, bounce/complaint handling, age-gated tobacco compliance, and low initial volume.
