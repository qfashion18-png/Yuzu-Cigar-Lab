# SES Production Access Appeal - 2026-06-13

## Official AWS Docs Findings

- Amazon SES sandbox restrictions are Region-specific. In sandbox, SES can only send to verified identities or the mailbox simulator, with a 200 messages per 24 hours quota and 1 message per second send rate.
- AWS says production access can be requested from the SES console or with `sesv2 put-account-details`.
- `put-account-details` accepts `MailType`, `WebsiteURL`, `ContactLanguage`, `UseCaseDescription`, `AdditionalContactEmailAddresses`, and `ProductionAccessEnabled`.
- `get-account` review statuses are `PENDING`, `GRANTED`, `DENIED`, and `FAILED`. AWS describes `FAILED` as the status where the appeal was not received and can be submitted again.
- The SESv2 API documents `ConflictException` for `PutAccountDetails` as: there is already an ongoing account details update under review.
- Service Quotas exposes SES sending quota and sending rate, but it does not expose sandbox removal / production access as a separate adjustable quota.

Official references:

- https://docs.aws.amazon.com/ses/latest/dg/request-production-access.html
- https://docs.aws.amazon.com/cli/latest/reference/sesv2/put-account-details.html
- https://docs.aws.amazon.com/ses/latest/APIReference-V2/API_PutAccountDetails.html
- https://docs.aws.amazon.com/cli/latest/reference/sesv2/get-account.html
- https://docs.aws.amazon.com/ses/latest/dg/manage-sending-quotas-request-increase.html

## Current Yuzu SES State

- Region: `us-east-1`
- Account: `374587466106`
- Production access: `false`
- Sending enabled: `true`
- Enforcement status: `HEALTHY`
- Review status: `DENIED`
- Case ID: `177809591700724`
- Current quota: `200` messages per 24 hours, `1` message per second
- Sent last 24 hours at last check: `1`
- Account-level suppression reasons: `BOUNCE`, `COMPLAINT`
- Domain identity: `yuzucigarclub.com`, verified, DKIM `SUCCESS`
- Custom MAIL FROM: `bounce.yuzucigarclub.com`, status `SUCCESS`
- Sender identity: `support@yuzucigarclub.com`, verified
- Event destination: configuration set `ycc-support-email-events` publishes `BOUNCE`, `COMPLAINT`, `DELIVERY_DELAY`, and `REJECT` to SNS topic `arn:aws:sns:us-east-1:374587466106:ycc-ses-email-events`

## CLI Submission Result

Attempted the official `sesv2 put-account-details` appeal submission with both `ycc-mcp` and `phantom-root`.

Both attempts returned:

```text
ConflictException
```

Because both profiles hit the same service-state error, this is not a local permission or root-key issue. The appeal text below should be submitted through the AWS SES console/account review path or an AWS Support Center case if the console does not show a resubmit button.

## Support Case Route

CloudTrail shows one accepted `PutAccountDetails` production-access request on 2026-05-06 at 19:31:50 UTC. All later `PutAccountDetails` attempts returned `ConflictException`, including attempts made with root credentials. The live `get-account` status is `DENIED`, not `PENDING`.

This means the next practical step is not another CLI/API production-access submission. A new Support Center interaction can be attempted from the AWS console, preferably from the root/admin account, referencing SES case `177809591700724` and asking AWS to manually review or unlock the denied/stuck SES production access review. The AWS Support API cannot be used from the current account/support plan, and AWS documents that service limit increase requests are not created through `CreateCase` API anyway.

If AWS Support Center does not allow a technical case under the current support plan, use the console's account/service-limit path or temporarily upgrade to Developer Support long enough to open/reopen the SES review case.

## Root Console Submission Result

On 2026-06-12 at 23:46:30 MST, case `177809591700724` was reopened through a root-derived AWS console session. The SES `Get set up` page showed `Status: More information needed` and explicitly linked this case ID as the place to provide the missing information. The reopened correspondence submitted a tighter low-volume transactional-only request and clarified that Yuzu is not requesting a high sending quota increase.

Immediate SES API readback after submission still showed `ProductionAccessEnabled=false` and `ReviewDetails.Status=DENIED`. That is expected until AWS reviews the reopened case.

## Appeal Text

```text
Yuzu Cigar Club requests Amazon SES production access in us-east-1 for transactional email only. We are not requesting marketing or bulk campaign sending.

Business and site:
Yuzu Cigar Club is an adult-only membership and ecommerce site at https://www.yuzucigarclub.com. The site uses age-gated account and membership flows. SES production access is needed so verified 21+ customers can receive account and support messages at their own email addresses.

Email types:
1. Cognito account verification codes for users who create an account on the Yuzu site.
2. Password reset and account recovery messages requested by the user.
3. Membership/account status notices related to a user's Yuzu account.
4. Order, billing, and concierge support replies only after a customer contacts Yuzu or has an existing Yuzu account/order.

Recipient consent and list source:
All recipients are first-party users who register on the website, request password/account recovery, place an order, hold a Yuzu account, or contact support directly. We will not send to purchased, rented, scraped, harvested, or third-party lists. We will not use SES for cold outreach. We will not use SES for promotional tobacco marketing campaigns.

Expected volume:
Initial production volume is low: normally under 50 transactional messages per day, with an expected near-term maximum under 200 per day. We are not requesting a high quota increase. We are requesting removal from sandbox so Cognito/account emails can reach legitimate customer addresses that are not individually pre-verified.

Sender authentication and identities:
The domain yuzucigarclub.com is verified in SES. DKIM signing is enabled and successful. Custom MAIL FROM is configured and successful on bounce.yuzucigarclub.com. The support sender support@yuzucigarclub.com is verified. Public DNS includes DMARC for yuzucigarclub.com and SPF/MX for the custom MAIL FROM domain.

Bounce, complaint, and reputation handling:
Account-level suppression is enabled for BOUNCE and COMPLAINT. The SES configuration set ycc-support-email-events publishes BOUNCE, COMPLAINT, DELIVERY_DELAY, and REJECT events to SNS topic arn:aws:sns:us-east-1:374587466106:ycc-ses-email-events. Bounced or complained addresses will not be retried for outbound support/account email unless the customer corrects the address and explicitly requests a resend.

Current implementation:
Cognito currently uses the verified support@yuzucigarclub.com SourceArn on the default Cognito sender path. We have already improved the verification email template so the code is clear, branded, and non-promotional. We want SES production access to move Cognito and support mail to the normal SES transactional sending path with the same verified domain controls and event monitoring.

Compliance commitments:
We agree to send only to recipients who requested or triggered the transactional message, to monitor bounces and complaints, to maintain suppression handling, and to keep SES usage limited to legitimate account, membership, order, and support communications.
```
