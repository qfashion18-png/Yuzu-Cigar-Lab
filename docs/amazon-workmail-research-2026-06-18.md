# Amazon WorkMail Research

Date: 2026-06-18

## Executive Conclusion

Amazon WorkMail should not be used for Yuzu Cigar Club.

The decisive blocker is service lifecycle: AWS says WorkMail no longer accepts new customers beginning 2026-04-30 and ends support on 2027-03-31. Live AWS checks on 2026-06-18 found no WorkMail organizations in `us-east-1`, `us-west-2`, or `eu-west-1` for account `374587466106`, so Yuzu should be treated as a new/non-existing WorkMail customer.

Even if WorkMail were available, it is a managed mailbox/calendar service, not an API-first transactional email sender. It is better compared with Microsoft 365 or Google Workspace than with SES, Mailgun, Brevo, or Postmark.

## Live Account Verification

Commands run with `AWS_PROFILE=ycc-mcp`:

```powershell
aws workmail list-organizations --region us-east-1 --output json
aws workmail list-organizations --region us-west-2 --output json
aws workmail list-organizations --region eu-west-1 --output json
```

Result:

```json
{
  "OrganizationSummaries": []
}
```

The empty result was returned in all three regions.

## AWS Service Lifecycle

AWS announced Amazon WorkMail end of support:

- New customers are no longer accepted beginning 2026-04-30.
- Existing customers can continue using WorkMail only until 2027-03-31.
- After 2027-03-31, customers will no longer be able to access the WorkMail console or WorkMail resources.
- AWS recommends migration to third-party mailbox solutions such as Kopano Cloud, Zoho Mail, and Zoom Mail.

Source: https://docs.aws.amazon.com/workmail/latest/adminguide/workmail-end-of-support.html

## What WorkMail Is

WorkMail is a managed business email and calendar service. It supports:

- Mailboxes
- Calendar
- Contacts
- Tasks
- Outlook clients
- Native iOS/Android clients
- IMAP clients
- Web browser access
- Corporate directory integration
- KMS encryption at rest
- Data locality by AWS Region
- Email journaling
- Microsoft Exchange interoperability for some migration/coexistence scenarios

Source: https://aws.amazon.com/workmail/

## What WorkMail Is Not

WorkMail is not a good replacement for:

- SES production transactional sending
- Lambda-driven support reply automation
- Member welcome automation
- Newsletter automation
- API-first bounce/complaint/suppression handling
- Bulk or marketing email

AWS's WorkMail FAQ explicitly says WorkMail is a business email service and is not intended for bulk email services. It points bulk email use cases to SES.

Source: https://aws.amazon.com/workmail/faqs/

## Regions And Endpoints

The official WorkMail endpoint page lists WorkMail service endpoints in:

- `us-east-1`
- `us-west-2`
- `eu-west-1`

WorkMail also has Message Flow SDK endpoints for message flow integrations.

Source: https://docs.aws.amazon.com/general/latest/gr/workmail.html

## Pricing

AWS lists WorkMail pricing as:

- `$4` per user per month
- 50 GB storage per user

AWS also advertised a 30-day trial for up to 25 users, but the new-customer cutoff makes this irrelevant for new Yuzu setup after 2026-04-30.

Source: https://aws.amazon.com/workmail/

## Core Quotas And Limits

Important published limits:

- 50 GB mailbox storage per user
- 29 MB unencoded incoming/outgoing message size
- 40 MB maximum MIME message size
- 1,000 users per WorkMail organization by default
- 100 WorkMail organizations per AWS account by default
- 100,000 external recipients addressed per AWS account per day
- 200 recipients per day for test domains
- No hard quota on internal recipients
- WorkMail is not intended for bulk email

Sources:

- https://aws.amazon.com/workmail/faqs/
- https://docs.aws.amazon.com/workmail/latest/adminguide/workmail_limits.html

## Client And SMTP Details

WorkMail supports IMAP and SMTP for mailbox users:

- IMAP over SSL on port `993`
- SMTP over SSL/TLS on port `465`
- STARTTLS is not supported for WorkMail SMTP
- Authentication uses the WorkMail email address and password

Regional SMTP endpoints include:

- `smtp.mail.us-east-1.awsapps.com`
- `smtp.mail.us-west-2.awsapps.com`
- `smtp.mail.eu-west-1.awsapps.com`

Source: https://docs.aws.amazon.com/workmail/latest/userguide/using_IMAP.html

## Domain Setup

WorkMail requires an organization first, then domain setup. Domain ownership/use is verified with DNS records:

- TXT record for ownership verification
- MX record for inbound mail

WorkMail's domain verification docs involve SES domain verification records and say verification can take up to 72 hours.

Source: https://docs.aws.amazon.com/workmail/latest/adminguide/domain_verification.html

Important Yuzu-specific note:

The Yuzu root MX currently points at SES inbound capture. Moving root-domain MX to WorkMail would disrupt that path. If WorkMail were available, it should use a subdomain or require a deliberate root-mail migration plan.

## Organization And User Setup

To use WorkMail, an AWS account must create a WorkMail organization. The organization selects:

- Email domain
- Organization alias
- User directory
- Encryption configuration

Directory options include:

- New Amazon WorkMail directory
- Existing on-premises Microsoft Active Directory through AD Connector
- AWS Managed Microsoft AD
- Simple AD

Adding a user automatically creates a mailbox unless the user is created as a remote user.

Sources:

- https://docs.aws.amazon.com/workmail/latest/adminguide/add_new_organization.html
- https://docs.aws.amazon.com/workmail/latest/adminguide/add_user.html

## Email Flow Rules

WorkMail has organization-level inbound and outbound email flow rules.

Inbound actions include:

- Drop email
- Send bounce response
- Deliver to junk folder
- Default handling
- Never deliver to junk folder

Outbound rules can:

- Route messages through SMTP gateways
- Block certain sends
- Invoke Lambda after email is sent

SMTP gateways configured for outbound WorkMail rules must support TLS 1.2 with trusted CA certificates and basic authentication.

Sources:

- https://docs.aws.amazon.com/workmail/latest/adminguide/email-flows.html
- https://docs.aws.amazon.com/workmail/latest/adminguide/create-email-rules.html
- https://docs.aws.amazon.com/workmail/latest/adminguide/smtp-gateway.html

## Relationship To SES

AWS states WorkMail uses SES to send outgoing email. WorkMail production domains are visible/manageable in the SES console. This matters for Yuzu because SES production access is final-denied for this AWS account.

Source: https://aws.amazon.com/workmail/faqs/

Because WorkMail itself is backed by SES and is being discontinued, it should not be treated as a clean workaround for Yuzu's SES production-access denial.

## E2E Feasibility For Yuzu

A true WorkMail e2e test would require:

1. Existing WorkMail customer status before 2026-04-30 or a currently available WorkMail organization.
2. Active WorkMail organization.
3. Verified domain.
4. Enabled mailbox user such as `support@...`.
5. SMTP credentials for that mailbox.
6. A test recipient.
7. Send through the regional WorkMail SMTP endpoint.
8. Verify delivery and any bounce/flow-rule evidence.

Current Yuzu state:

- No WorkMail organization exists in any checked WorkMail region.
- WorkMail no longer accepts new customers.
- Therefore no valid WorkMail mailbox exists for SMTP e2e.
- A live send e2e is blocked before code.

## Recommendation For Yuzu

Do not use WorkMail.

Use this split instead:

- Cognito branded email: account signup verification, password reset, MFA, resend confirmation.
- Human mailbox provider: GoDaddy/Microsoft 365, Google Workspace, Zoho Mail, or similar for `support@` and `concierge@`.
- Automated app email: a pre-cleared transactional sender such as Brevo or Mailgun after written legal-tobacco approval.

If full control of Cognito auth emails is needed later, use Cognito `CustomEmailSender` Lambda with the approved transactional provider.
