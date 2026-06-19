# AWS 21+ Brand Audit - Yuzu Cigar Club

Date: 2026-06-18

Scope: initial read-only audit of AWS account `374587466106` with profile `ycc-mcp`, primarily `us-east-1`, plus official AWS documentation research for a legal adult cigar / tobacco brand. A follow-up remediation pass later on 2026-06-18 changed AWS resources as documented below.

This is an operational readiness audit, not legal advice. For tobacco retail law, state shipping restrictions, tax/excise obligations, and advertising warning language, keep counsel and fulfillment-provider review in the loop.

## Executive Summary

Yuzu is not fully launch-clean from an AWS posture standpoint yet. The application stack has several strong pieces in place: Cognito signup email is branded, checkout requires AgeChecker.Net validation, the database is private and backed up, API logs/alarms exist, and the Bedrock guardrail includes minor/tobacco-health-claim protections.

The main launch blockers are:

1. Root/account security and detective controls are incomplete.
2. Customer outbound email is still blocked by SES production denial.
3. SMS is not production-ready and tobacco/SHAFT messaging is a carrier-sensitive category.
4. The WAF created for Amplify is not attached to the live Amplify app.
5. Mail DNS is mixed between SES inbound, GoDaddy/Microsoft traces, and future transactional-provider needs.

## Remediation Update - 2026-06-18

Fixed end to end:

- Deleted the root access key. Readback now reports `AccountAccessKeysPresent=0` and `AccountMFAEnabled=1`.
- Added narrow `lambda:GetAlias`, `lambda:ListAliases`, and `lambda:UpdateAlias` permission to `CodexMcpYccOperatorRole` for `ycyyy`, then verified the operator can update `ycyyy:live` without root while preserving version `42`.
- Enabled account-level S3 Block Public Access with all four settings true.
- Created multi-region CloudTrail `ycc-security-trail` with log-file validation, S3 delivery bucket `ycc-cloudtrail-logs-374587466106-us-east-1`, CloudWatch Logs delivery to `/aws/cloudtrail/ycc-security`, and live logging/delivery verified.
- Enabled AWS Config recorder `default`, delivery bucket `ycc-config-recordings-374587466106-us-east-1`, and seven YCC managed rules for CloudTrail, root MFA, IAM password policy, S3 account public access, RDS encryption, and RDS public access.
- Enabled GuardDuty detector `9bf00e4ceaa941cc8f499eaa0a6d8e40`.
- Enabled Security Hub; AWS Foundational Security Best Practices and CIS AWS Foundations Benchmark v1.2.0 are `READY`.
- Enabled Inspector v2 scanning for EC2, ECR, Lambda, and Lambda code.
- Created IAM Access Analyzer `ycc-account-external-access`, status `ACTIVE`.
- Added IAM account password policy: 14-character minimum, upper/lower/number/symbol required, 90-day expiry, 24-password reuse prevention, hard expiry.
- Added alternate security, operations, and billing account contacts pointing to `support@yuzucigarclub.com`.
- Created monthly AWS cost budget `YCC Monthly AWS Cost Guardrail` at `$250`, with 80% actual, 100% actual, and 100% forecasted notifications.
- Associated WAF web ACL `ycc-amplify-edge` to Amplify app `d2yxcklt245wh0`; WAFv2 readback confirms the association.
- Disabled the default API Gateway execute-api endpoint for API `13710cp67l`; custom domain `https://api.yuzucigarclub.com/health?deep=1` returns `200`, while the raw execute-api health URL no longer serves the route.
- Ran CloudFormation drift detection on active stacks. `SlimHarpoPlatformStack`, `CreatorPrintAi-dev`, `CreatorPrintCore-dev`, and `CDKToolkit` are `IN_SYNC`; `CreatorPrintWeb-dev`, `PhantomAgents-prod`, and `retail-stack` are `DRIFTED` and need owner review.
- Hardened newsletter consent so consent starts unchecked in both compact and full forms; deployed Amplify job `162` and browser-verified the live education-page form starts unchecked/disabled and enables only after opt-in.

Remaining blockers or owner decisions:

- SES production access is still denied under case `177809591700724`; outbound customer email still needs a pre-cleared third-party transactional provider.
- SMS remains blocked on AWS/carrier review: SNS sandbox destination pending, toll-free originator pending, registration version `3` reviewing.
- Mail DNS still needs a final lane decision for human inbox, SES inbound, transactional subdomain, SPF/DKIM/DMARC, and DMARC reporting.
- Backup Vault Lock was not enabled because retention/immutability decisions are intentionally irreversible-sensitive.
- Config rule `ycc-s3-account-public-access-blocks` temporarily reported `INSUFFICIENT_DATA` immediately after setup even though direct S3Control readback shows all four account-level block settings are true; it should evaluate on the next Config cycle.

## Documentation Basis

Official AWS docs checked:

- AWS Acceptable Use Policy: no illegal, harmful, fraudulent, offensive, security-violating, or unsolicited mass-message use: https://aws.amazon.com/aup/
- AWS End User Messaging SMS age-restricted opt-in: full date-of-birth age gate must appear before SMS consent: https://docs.aws.amazon.com/sms-voice/latest/userguide/registration-help-optin-agegate.html
- AWS End User Messaging SMS best practices and SHAFT categories: https://docs.aws.amazon.com/sms-voice/latest/userguide/best-practices.html
- AWS SMS rejection reasons for SHAFT and age-restricted review: https://docs.aws.amazon.com/sms-voice/latest/userguide/understanding-rejection-reasons.html
- Amazon SES enforcement and reputation thresholds: https://docs.aws.amazon.com/ses/latest/dg/faqs-enforcement.html
- Cognito user-pool email defaults and production-volume guidance: https://docs.aws.amazon.com/cognito/latest/developerguide/user-pool-email.html
- CloudTrail security best practices: https://docs.aws.amazon.com/awscloudtrail/latest/userguide/best-practices-security.html
- AWS Config resource recording: https://docs.aws.amazon.com/config/latest/developerguide/select-resources.html
- Security Hub Foundational Security Best Practices: https://docs.aws.amazon.com/securityhub/latest/userguide/fsbp-standard.html
- S3 account-level Block Public Access: https://docs.aws.amazon.com/AmazonS3/latest/userguide/configuring-block-public-access-account.html
- Amplify WAF integration: https://docs.aws.amazon.com/amplify/latest/userguide/amplify-waf-configuration.html
- API Gateway default endpoint disabling: https://docs.aws.amazon.com/apigatewayv2/latest/api-reference/apis.html
- WorkMail end of support: https://docs.aws.amazon.com/workmail/latest/adminguide/workmail-end-of-support.html
- Pinpoint end of support: https://docs.aws.amazon.com/pinpoint/latest/userguide/migrate.html

Non-AWS compliance references checked because they matter for a 21+ cigar brand:

- FTC CAN-SPAM business guide: https://www.ftc.gov/business-guidance/resources/can-spam-act-compliance-guide-business
- FDA retail tobacco rules for cigars: https://www.fda.gov/tobacco-products/retail-sales-tobacco-products/selling-tobacco-products-retail-stores

## High-Priority Gaps

### Critical: root access key exists

Live IAM account summary reports:

- `AccountMFAEnabled=1`
- `AccountAccessKeysPresent=1`
- `AccountPasswordPresent=1`

Root MFA being enabled is good. A root access key being present is still a critical cleanup item. AWS best practice is to avoid root access keys entirely and use IAM roles/users with least privilege.

Remediation:

1. Sign in as root.
2. Confirm whether the root access key is still needed.
3. Deactivate and delete the root access key after confirming no active automation depends on it.
4. Keep root MFA enabled.
5. Use role-based operator/deployment access for all automation.

### Critical: core detective security services are not enabled

Live findings:

- CloudTrail trails: none.
- AWS Config recorders: none.
- GuardDuty detectors: none.
- Security Hub: not subscribed.
- Inspector v2: disabled for EC2, ECR, Lambda, Lambda code, and code repository scanning.
- IAM Access Analyzer: no analyzers.
- Account-level S3 Public Access Block: missing.

This leaves the account without a durable control-plane audit trail, drift/compliance timeline, threat detections, Security Hub FSBP findings, unused-access analysis, or account-wide S3 public-access backstop.

Remediation:

1. Create a multi-region CloudTrail trail with management events, log-file validation, encrypted S3 storage, and CloudWatch Logs integration.
2. Enable AWS Config in the home region, record supported resources, and add managed rules for multi-region CloudTrail, root MFA, S3 account public access block, encrypted volumes/buckets, and RDS public access.
3. Enable GuardDuty, Security Hub FSBP, Inspector v2, and IAM Access Analyzer.
4. Turn on account-level S3 Block Public Access with all four settings enabled.

### Critical: production customer email is not ready

Live SES status:

- `ProductionAccessEnabled=false`
- SES review status: `DENIED`
- Case ID: `177809591700724`
- Sending quota remains sandbox-like: 200/day and 1/sec.
- SES configuration set `ycc-support-email-events` exists and publishes bounce/complaint/delay/reject events to SNS/SQS, but production send access is denied.

Per-recipient SES identities now exist for the two test Gmail users, but that path sends AWS-branded verification email and must not be used for real customer onboarding.

Current correct behavior:

- Cognito signup verification uses a branded `support@yuzucigarclub.com` message.
- Lambda keeps `FEATURE_SES=pending_production_access`, so member welcome/newsletter/support sends remain guarded instead of sending.

Remediation:

1. Keep Cognito default/branded email for signup verification, password reset, MFA, and auth notices.
2. Choose and pre-clear a transactional provider outside SES, such as Brevo or Mailgun, with written approval for legal cigar/tobacco transactional and consented marketing email.
3. Use a dedicated subdomain, for example `mg.yuzucigarclub.com`, for transactional sending.
4. Add SPF, DKIM, DMARC alignment, bounce/complaint webhooks, suppression handling, and unsubscribe handling before enabling app sends.
5. Do not create SES recipient identities for customers during signup.
6. Consider deleting the temporary Gmail SES identities after testing so future operators do not mistake them for a valid production path.

### Critical: SMS is not production-ready

Live SMS findings:

- SNS SMS sandbox: `IsInSandbox=true`.
- Sandbox destination `+1 ***7369`: `Pending`.
- Toll-free originator ending `8058`: `PENDING`.
- Toll-free registration `registration-8720a85d3f2c40d88dae52872699079a`: `REVIEWING`, current version `3`, latest denied version `2`.
- Registration history includes a prior denial for tobacco/SHAFT content.

AWS documentation says full date-of-birth age gate must happen before age-restricted SMS consent. AWS SMS documentation also lists SHAFT, including tobacco/vape, as restricted or disallowed by mobile operators.

Current correct behavior:

- The code wording was narrowed to owner/admin operational alerts.
- Public terms/privacy pages include SMS disclosures.
- No production customer SMS should be sent yet.

Remediation:

1. Do not launch customer SMS marketing or cigar promotion texts through AWS SMS.
2. Keep AWS SMS limited to owner/admin operational alerts only, if AWS approves the registration.
3. Do not send tobacco product/promotion language by SMS.
4. Preserve full DOB age-gate evidence before any SMS consent collection.
5. Require explicit, unchecked SMS opt-in if any future recipient-facing SMS program is added.
6. Wait for toll-free registration and sandbox destination readiness before any live SMS e2e send.

## High-Risk Gaps

### WAF exists but is not attached to Amplify

Live findings:

- CloudFront-scope web ACL exists: `ycc-amplify-edge`.
- Rules include AWS managed common rules, known bad inputs, IP reputation, and a per-IP rate limit.
- Amplify app `d2yxcklt245wh0` has `wafWebAclArn=null`.

AWS Amplify docs say WAF can be enabled for Amplify apps and attaches to branches/domains once associated. The current live app is not associated according to the Amplify API.

Remediation:

1. Associate `ycc-amplify-edge` to Amplify app `d2yxcklt245wh0`.
2. Verify Amplify readback returns the web ACL ARN.
3. Verify managed-rule metrics and sampled requests.
4. Consider restricting direct `*.amplifyapp.com` access if the public custom domains are the only intended entrypoints.

### API Gateway default endpoint remains enabled

Live finding:

- HTTP API `13710cp67l` has custom domain `api.yuzucigarclub.com`.
- `DisableExecuteApiEndpoint=false`.

AWS API Gateway docs support disabling the default `execute-api` endpoint so clients must use the custom domain. This should be tightened after confirming all live clients use `api.yuzucigarclub.com`.

Remediation:

1. Inventory all frontend/backend clients for the API base URL.
2. Disable the default execute-api endpoint.
3. Smoke `https://api.yuzucigarclub.com/health?deep=1`.
4. Confirm the default execute-api endpoint returns `403`.

### API WAF coverage is unclear for HTTP API

AWS docs explicitly point REST APIs to WAF stage association and API Gateway docs say REST APIs support WAF integration; HTTP APIs are lower-cost with fewer features. The current Yuzu API is an HTTP API.

Remediation options:

1. Put CloudFront with WAF in front of the HTTP API.
2. Migrate to REST API if direct API Gateway WAF integration is required.
3. Keep stage throttling and JWT authorizers, but do not count them as WAF coverage.

### Mail DNS is mixed

Current DNS posture:

- Root MX: SES inbound.
- Root SPF: `include:secureserver.net -all`.
- Root DMARC: `p=quarantine`, relaxed alignment, aggregate reports to `dmarc_rua@onsecureserver.net`.
- Root SES DKIM CNAMEs exist.
- `bounce.yuzucigarclub.com` has SES bounce MX/TXT.
- GoDaddy/Microsoft traces exist in DNS.

This is understandable during migration, but it is not a clean mail architecture for a production sender.

Remediation:

1. Decide final human inbox provider for `support@` / `concierge@`.
2. Keep SES inbound only if it remains part of the support workflow.
3. Put app transactional mail on a dedicated subdomain.
4. Align SPF/DKIM/DMARC for each sender domain or subdomain.
5. Move DMARC reporting to a monitored destination controlled by Yuzu.
6. Document which provider owns inbound, human outbound, transactional outbound, and marketing outbound.

### CloudFormation drift has not been checked

All active stacks report `DriftInformation.StackDriftStatus=NOT_CHECKED`.

Remediation:

1. Run drift detection on YCC-related stacks.
2. Record drift results in the deployment runbook.
3. Fold manual AWS console changes back into IaC or document them as intentional exceptions.

### Backup vault is not locked

Good findings:

- Backup plan `ycc-prod-rds-daily` exists.
- Backup selection covers `database-1ycc`.
- Recent recovery points are `COMPLETED`.
- Recovery points delete after 35 days.

Gap:

- Backup vault `ycc-prod-backup-vault` reports `Locked=false`.

Remediation:

1. Decide retention and immutability requirements.
2. Enable AWS Backup Vault Lock after testing restore process and retention settings.
3. Keep a restore drill schedule.

## Medium-Risk Gaps

### Secrets Manager rotation and KMS hardening

YCC-related secrets exist for RDS, commerce, and social providers. They use the default AWS-managed Secrets Manager key and have rotation disabled.

Remediation:

1. Move high-value production secrets to customer-managed KMS keys if compliance requires key separation.
2. Enable rotation where the provider and application support it.
3. Keep manual rotation runbooks for third-party tokens that cannot be automatically rotated.

### Lambda observability can improve

Live Lambda `ycyyy:live`:

- Version `42`, runtime `nodejs22.x`.
- In VPC private subnets.
- Logs retained for 90 days.
- X-Ray tracing mode: `PassThrough`, not active.
- No event invoke config.
- No event source mappings.
- No reserved concurrency returned.

Remediation:

1. Enable Lambda active tracing or ADOT/OpenTelemetry if request tracing matters.
2. Set reserved concurrency if runaway cost or downstream DB protection is a concern.
3. Add explicit async failure destinations only if async invocation paths are introduced.

### Lambda IAM policy has broad service permissions

The Lambda role is mostly scoped to specific secrets, event bus, S3 prefixes, Bedrock models, guardrail, KB, and tagged Bedrock agent aliases. Broader statements remain:

- `sns:Publish` on `*`
- Transcribe, Polly, and Rekognition on `*`

Some AWS services require resource-level `*`, but `sns:Publish` should be narrowed if possible.

Remediation:

1. Restrict SMS publish behavior with conditions and dedicated origination/destination flow where AWS supports it.
2. Keep broad service permissions only when the AWS service cannot be resource-scoped.
3. Add IAM Access Analyzer and Security Hub unused-access findings to tune over time.

### Account contacts and budgets are incomplete

Live findings:

- Primary account contact exists.
- Alternate `SECURITY`, `OPERATIONS`, and `BILLING` contacts are not configured.
- Budgets readback returned no budgets.
- Cost Explorer access is not enabled for the audited identity.
- Trusted Advisor checks are unavailable because of support level.
- AWS Health API requires subscription.

Remediation:

1. Add alternate account contacts.
2. Create at least monthly cost and anomaly budgets.
3. Enable Cost Explorer access for the billing/audit role.
4. Consider AWS Business Support or equivalent monitoring if production revenue depends on AWS availability notices.

### IAM user scope needs cleanup

Live findings:

- IAM user `codex-mcp-ycc` has an active access key and can assume YCC operator/deployment roles.
- The same user is also in unrelated group `rainbow-uploaders`, which can assume `rainbow/deployment/rainbow-amplify-uploader`.
- IAM user `yuzu-amplify-deployer` has an active access key and can assume `role/yuzu-amplify-deployer`.
- No account password policy is configured; the listed IAM users do not show console password use.

Remediation:

1. Separate YCC automation credentials from unrelated project groups.
2. Rotate access keys on a schedule.
3. Prefer IAM Identity Center or short-lived role sessions where possible.
4. Add an account password policy even if current users are key-only.

### Event bus has no rules

Live finding:

- Event bus `ycc-events` exists.
- No EventBridge rules are attached.

If the bus is intended as an audit/event backbone, it currently has no consumers.

Remediation:

1. Decide whether `ycc-events` is audit-only, integration, or future-reserved.
2. If audit events matter, add rules to archive, SQS, Firehose, or analytics storage.
3. If unused, document that it is reserved infrastructure.

### Amplify custom-domain verification looks odd

Live Amplify domain association:

- Domain status: `AVAILABLE`.
- Update status: `UPDATE_COMPLETE`.
- Subdomains for wildcard, `www`, and `admin` show `verified=false`.

Because public DNS is manually pointing to the Amplify CloudFront distribution, the site may work while Amplify's subdomain verification fields still look false. This needs console/API reconciliation so future certificate/domain renewals do not surprise the team.

Remediation:

1. Confirm Amplify console domain health.
2. Confirm managed certificate renewal health.
3. Decide whether wildcard mapping is intentional.
4. Keep Route 53 records aligned with Amplify's expected DNS records.

### Newsletter consent defaults checked

The newsletter UI requires consent on the backend and includes the text `I am 21+ and agree to receive Yuzu Cigar Club email updates`, but the checkbox defaults to checked in the UI.

For a 21+ brand using providers that care about consent quality, this should be hardened.

Remediation:

1. Default newsletter consent to unchecked.
2. Store consent timestamp, page, source, IP hash, user agent hash, and consent text version.
3. Keep unsubscribe/suppression records independent from provider-specific lists.

## Positive Controls Already In Place

### Cognito

- User pool `YCCMembers` has deletion protection active.
- Email is auto-verified.
- Signup email uses branded Cognito default email from `support@yuzucigarclub.com`.
- Password policy: 12 characters, uppercase, lowercase, numbers, and symbols.
- MFA is optional.
- Post-confirmation trigger invokes `ycyyy:live`.
- App client uses OAuth code flow, token revocation, and `PreventUserExistenceErrors=ENABLED`.
- Identity pool has `AllowUnauthenticatedIdentities=false`.

Recommended hardening:

- Enforce MFA for admin/concierge operators at the app or user-pool policy layer.
- Keep Cognito default email for auth until a third-party sender is approved and a custom sender Lambda is deliberately built.

### API Gateway

- Custom domain `api.yuzucigarclub.com` is `AVAILABLE`.
- TLS policy is `TLS_1_2`.
- Stage access logs are enabled to `/aws/apigateway/ycc-api-access`.
- Default route throttling is configured at 50 rps / 100 burst.
- Detailed metrics are enabled.
- CORS is restricted to Yuzu origins.

Recommended hardening:

- Disable the default execute-api endpoint after client inventory.
- Add WAF in front of the API path through CloudFront or REST API migration if API-layer WAF is required.

### Lambda

- Lambda is in VPC private subnets.
- API invoke permission is scoped to API `13710cp67l`.
- SES inbound invoke permission is scoped to the YCC SES receipt rule.
- CloudWatch log retention is 90 days.
- YCC CloudWatch alarms for API, Lambda, RDS, and RDS Proxy are `OK`.

Recommended hardening:

- Enable tracing.
- Review `sns:Publish` wildcard.
- Move high-value env secrets to Secrets Manager where practical.

### Database And Backups

- RDS instance `database-1ycc` is private.
- Storage encrypted.
- Deletion protection enabled.
- 7-day RDS automated backup retention.
- Enhanced monitoring at 60 seconds.
- Performance Insights enabled.
- RDS Proxy is available and `RequireTLS=true`.
- AWS Backup has completed daily recovery points with 35-day retention.

Recommended hardening:

- Consider Multi-AZ if availability requirements justify cost.
- Enable Backup Vault Lock once restore drills are proven.

### Storage

- Account-level S3 Public Access Block is missing.
- Checked YCC-relevant bucket `classroom2` has bucket-level public access block enabled, encryption enabled, and versioning enabled.

Recommended hardening:

- Enable account-level S3 Public Access Block so future buckets inherit the safety net.

### Bedrock / AI

- Six YCC agents are `PREPARED`.
- YCC Concierge prod alias is `PREPARED`.
- Guardrail version `8` is `READY`.
- Guardrail blocks explicit underage tobacco bypass requests.
- Guardrail denies tobacco health claims and blocks credit-card, SSN, AWS key, address, phone, and email exposure according to configured policy.
- Knowledge base `YCCKnowledgeBaseV2` is active with a completed ingestion job.

Recommended hardening:

- Keep a recurring AI safety e2e test set for minor-bypass, health claims, payment collection, PII, and prompt-attack cases.
- Keep human approval for public news/email drafts.

### 21+ Commerce Flow

- Global age gate asks for month/day/year and verifies age 21+ client-side.
- Checkout requires a server-validated AgeChecker.Net token.
- Checkout token includes vendor transaction ID, verified timestamp, and identity hash.
- Shipping compliance requires adult-signature delivery method before checkout.
- Stripe checkout status retrieval requires a status token.

Recommended hardening:

- Preserve AgeChecker verification evidence and token metadata for compliance review.
- Continue enforcing adult-signature shipping and restricted-destination logic server-side.

## Recommended Remediation Order

1. Delete root access key and add alternate security/operations/billing contacts.
2. Enable CloudTrail, Config, GuardDuty, Security Hub, Inspector, IAM Access Analyzer, account-level S3 Public Access Block, and budgets.
3. Attach WAF to Amplify and verify the live app readback.
4. Disable API Gateway default endpoint after client inventory.
5. Freeze AWS SMS to owner/admin operational alerts only until toll-free registration and sandbox destination are active.
6. Move transactional email to a pre-cleared third-party provider; keep Cognito auth email as-is.
7. Clean up mail DNS and DMARC reporting by sender lane.
8. Run CloudFormation drift detection and fold manual changes back into IaC/docs.
9. Harden consent capture and unsubscribe/suppression persistence.
10. Add tracing, secret rotation, backup vault lock, and IAM tuning as second-wave hardening.

## Not Fully Audited In This Pass

- No destructive or mutating checks were run.
- Cost Explorer denied access for this identity.
- Trusted Advisor was unavailable due to support level.
- AWS Health API was unavailable due to subscription requirement.
- Bucket-by-bucket audit timed out after verifying several buckets, including YCC-relevant `classroom2`; account-level S3 Public Access Block remains the main storage gap.
- This pass did not perform a live checkout, SMS send, or email send.
