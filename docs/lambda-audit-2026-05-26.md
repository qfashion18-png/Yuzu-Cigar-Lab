# Lambda Audit - 2026-05-26 America/Phoenix

Audit window: 2026-05-26 16:00-17:20 America/Phoenix, crossing 2026-05-27 UTC.

## Scope

- Live AWS account access used profile `ycc-mcp` in `us-east-1`.
- Audited Lambda `ycyyy`, HTTP API Gateway `ycc-api` (`13710cp67l`), execution role, Lambda resource policy, API routes/authorizer/integration, VPC endpoints, security groups, RDS Proxy, log groups, alarms, secrets metadata, S3 public/encryption posture, recent CloudWatch metrics, and the local Lambda source under `infra/lambda/ycc-api/`.
- Reviewed official AWS documentation for Lambda best practices, Secrets Manager integration, Lambda versions/aliases, API Gateway HTTP API CORS/JWT authorization, VPC endpoint policies, CloudWatch Logs retention, and Lambda structured logging.
- No secret values were read. Lambda environment inspection was limited to key names and configuration metadata.

## Executive Summary

The production Lambda is healthy and guarded by several good controls: Node.js 22.x, VPC placement, RDS Proxy TLS, scoped Lambda resource policy conditions for API Gateway/Bedrock/SES, JWT authorization on authenticated API routes, Stripe webhook signature verification, S3 public access block, API access logs, detailed API metrics, and CloudWatch alarms.

The highest-priority gaps are deployment/configuration drift rather than an obvious code exploit:

1. Production API CORS currently allows `http://localhost:3000`, while the CloudFormation template restricts local CORS overrides to non-production stacks.
2. API Gateway invokes the unqualified Lambda ARN, so production traffic runs against `$LATEST` instead of an immutable version/alias.
3. Secrets rotation, Lambda log retention, endpoint policies, reserved concurrency, and route-level OAuth scopes are not yet hardened.
4. The app audit helper drops `beforeData` even though callers pass it and the database schema has `before_data`.

## Live Inventory

Lambda `ycyyy`:

- Runtime: `nodejs22.x`
- Handler: `index.handler`
- Memory: 512 MB
- Timeout: 60 seconds
- Ephemeral storage: 512 MB
- Architecture: `x86_64`
- State: `Active`
- Last update: `Successful`
- Last modified: `2026-05-26T23:40:43.000+0000`
- Version serving configuration query: `$LATEST`
- Package type: Zip
- Code size: 7,979,116 bytes
- Runtime management: `Auto`
- Function URL: none
- Event source mappings: none
- Async invoke config: none
- Reserved concurrency: not configured

Network and data path:

- Lambda is attached to VPC `vpc-0d5c8ea6e5be2ad0b`, subnets `subnet-06116a5414f29c8bb` and `subnet-067af6ad21ff85cc2`, security group `sg-00c3d67ac62d92ae7`.
- Lambda security group has no ingress.
- Egress is constrained to PostgreSQL 5432 for the RDS Proxy security group, HTTPS 443 to VPC endpoint security groups, S3 gateway prefix list, plus HTTPS 443 to `0.0.0.0/0` for Stripe/NAT.
- RDS Proxy `proxy-1778040454500-database-1ycc` is available, PostgreSQL, `RequireTLS=true`, Secrets auth, IAM auth disabled.
- S3 bucket `classroom2` has public access block enabled, policy status not public, and AES256 default encryption.

API Gateway `ycc-api`:

- Endpoint: `https://13710cp67l.execute-api.us-east-1.amazonaws.com`
- HTTP API default stage with auto deploy.
- Stage metrics enabled.
- Stage throttles: burst 100, rate 50.
- Access logs go to `/aws/apigateway/ycc-api-access` with JSON fields including request id, method, route key, status, response length, and integration error.
- One Lambda AWS_PROXY integration targets the unqualified function ARN `arn:aws:lambda:us-east-1:374587466106:function:ycyyy`.
- JWT authorizer issuer: Cognito user pool `us-east-1_63U9PflAX`; audience `2i2nvtt41l94n0mivc4tu4f9ms`.
- JWT routes have no `AuthorizationScopes`.

Route posture:

- Public (`NONE`) routes: `GET /health`, `GET /content/pages`, `GET /news/stories`, `POST /newsletter/subscribe`, commerce checkout/status/age/membership/webhook routes, and `POST /humidor/alerts/dispatch`.
- Authenticated (`JWT`) routes cover account, admin, member, concierge, humidor, support, and authenticated commerce operations.
- API Gateway returned `401` for an authenticated route with no bearer token, before Lambda handler execution.

Recent metrics, 7-day window:

- Lambda invocations: 307
- Lambda errors: 2
- Lambda throttles: 0
- Lambda duration average: about 788 ms
- Lambda duration p95: about 2,578 ms
- Lambda duration max: about 12,835 ms
- API Gateway count: 932
- API Gateway 4xx: 22
- API Gateway 5xx: 4
- API Gateway latency average: about 331 ms
- API Gateway latency max: about 13,642 ms

## Findings

### P1 - Production CORS Allows Localhost And Has Drift

Live API Gateway CORS allows:

- `https://yuzucigarclub.com`
- `https://www.yuzucigarclub.com`
- `https://admin.yuzucigarclub.com`
- `https://staging.d2yxcklt245wh0.amplifyapp.com`
- `http://localhost:3000`

The local CloudFormation template restricts `LocalCorsOrigin` to non-production stacks at `infra/ycc-phase1-edge.yaml:59`, and the committed `AllowOrigins` list includes the public/staging origins plus only the conditional local origin at `infra/ycc-phase1-edge.yaml:268`.

Live probes:

- `Origin: http://localhost:3000` returned `access-control-allow-origin: http://localhost:3000`.
- `Origin: https://admin.yuzucigarclub.com` returned `access-control-allow-origin: https://admin.yuzucigarclub.com`.
- `Origin: https://unknown-origin.example` returned no allow-origin header.

Impact: CORS is not authorization, and JWT still protects authenticated routes, but the live production browser trust boundary is broader than the IaC model. A local development origin can make browser calls to production when it has a token, and future operators may incorrectly assume the template matches production.

Recommendation: remove `http://localhost:3000` from the live production API CORS config. Decide whether `https://admin.yuzucigarclub.com` is intentional; if yes, codify it in IaC. Add a drift check that asserts production CORS excludes local origins.

### P1 - Production Traffic Uses `$LATEST` Instead Of An Alias

The API integration targets the unqualified Lambda ARN, and live Lambda aliases are empty. AWS Lambda invokes `$LATEST` when an unqualified ARN is used, while published versions are immutable snapshots.

Impact: deployments overwrite the code that production invokes, making rollback, canarying, auditability, and scoped permissions weaker than they would be with a `prod` alias.

Recommendation: publish a version for each deploy, create/update a `prod` alias, point API Gateway integration at the alias ARN, and where feasible scope `lambda:AddPermission` source permissions to the alias. Keep a rollback runbook that shifts `prod` back to the previous version.

### P2 - Secrets Are Not Rotated

Secrets metadata showed no rotation enabled for:

- `ycc/commerce/prod`
- `rds-db-credentials/database-1ycc/postgresycc/1778040454500`

The Lambda correctly references secret ARNs instead of storing secret values directly in environment variables, but automatic rotation is not enabled.

Impact: stale database or commerce credentials remain valid until manually changed.

Recommendation: enable rotation where supported and document manual rotation for provider secrets that need coordinated external updates. Add a periodic check for `RotationEnabled`.

### P2 - Hot Paths Recreate AWS Clients And Re-fetch The DB Secret

`getDatabaseSecret()` calls Secrets Manager for each database client creation at `infra/lambda/ycc-api/index.js:5105`, and `readJsonSecretFromSecretsManager()` constructs a new `SecretsManagerClient` at `infra/lambda/ycc-api/index.js:5158`. Several AWS service helpers also create SDK clients inside request paths, including Bedrock, S3, and Agent Runtime clients.

AWS Lambda guidance recommends reusing SDK clients and database connections across execution environment reuse. AWS's Lambda/Secrets Manager guidance also recommends local secret caching through the Parameters and Secrets Lambda extension or Powertools.

Impact: extra latency, extra Secrets Manager/API calls, and a larger dependency on control-plane availability during normal request traffic. This aligns with observed p95 duration around 2.6 seconds and max duration around 12.8 seconds, though the metric does not prove this is the only cause.

Recommendation: move stable AWS SDK clients to module scope and add a short TTL cache for the DB secret, or adopt the AWS Parameters and Secrets Lambda extension. Keep user/request-specific state out of globals.

### P2 - VPC Endpoint Policies Are Broad

Several VPC endpoint policies are still effectively full access (`Principal: *`, `Action: *`, `Resource: *`), including Secrets Manager, Bedrock Runtime, Polly, and Transcribe. The S3 and Bedrock Agent Runtime endpoint policies are more scoped.

Identity policies and security group egress already constrain practical access, so this is defense-in-depth rather than a currently demonstrated privilege bypass.

Recommendation: restrict endpoint policies to the Lambda execution role and the required service actions/resources. For gateway endpoints, use condition keys such as `aws:PrincipalArn` because gateway endpoint policies require `Principal: *`.

### P2 - Lambda Logs Retain Indefinitely And Use Text Format

The Lambda log group `/aws/lambda/ycyyy` has no retention policy and no customer managed KMS key. The API access log group has 30-day retention.

The Lambda logging config is `Text`, while the application already emits many JSON-shaped log strings. AWS recommends JSON log format when workflow compatibility allows it because it improves filtering and analysis.

Impact: indefinite retention can increase cost and keep operational data longer than intended. Text platform logs are harder to query consistently.

Recommendation: set an explicit retention window for `/aws/lambda/ycyyy`, such as 30/90/180 days depending on compliance needs. Evaluate a customer managed KMS key if logs include sensitive operational metadata. Test `LoggingConfig.LogFormat=JSON` before enabling it because embedded metric format compatibility can matter.

### P2 - JWT Routes Do Not Require Authorization Scopes

Every JWT route currently has `AuthorizationScopes=null`. The handler still applies group/role checks, for example admin/concierge checks in code, and API Gateway validates issuer/audience/signature before invoking Lambda.

AWS API Gateway documentation recommends route scopes unless the API intentionally requires ID tokens. The frontend tests indicate Cognito ID tokens are sent to the API.

Impact: API Gateway is currently only the token validation layer, while fine-grained authorization lives in Lambda. That can be intentional, but it removes a useful outer authorization boundary.

Recommendation: either document ID-token authorization as an explicit design decision, or move API calls to OAuth access tokens with resource server scopes and configure scopes per route.

### P2 - Reserved Concurrency Is Not Configured

`get-function-concurrency` returned no reserved concurrency. API Gateway stage throttling is configured, but direct Lambda invokes from allowed services such as Bedrock agents and SES are not governed by API Gateway stage throttles.

Impact: runaway invokes or downstream slowness could pressure RDS Proxy, Stripe, Bedrock, or other dependencies.

Recommendation: choose a reserved concurrency ceiling based on RDS Proxy capacity, external API limits, and expected Bedrock/SES flows. Keep the emergency procedure to set reserved concurrency to `0` during runaway recursion or abuse.

### P3 - `audit_log.before_data` Is Not Written

The schema has `before_data` at `infra/database/migrations/0001_phase3_app_schema.sql:291`. Callers pass `beforeData`, for example the humidor item update path at `infra/lambda/ycc-api/index.js:3590`. The helper `insertAuditLog()` inserts only `after_data` at `infra/lambda/ycc-api/index.js:6802`.

Impact: mutation audit records lose before-state even when the caller collected it.

Recommendation: update `insertAuditLog()` to include `before_data`, add tests that assert before/after payloads are persisted, and backfill only if business/audit requirements need it.

### P3 - Production Dependency Audit Has One Moderate Finding

`npm audit --omit=dev` reports one moderate advisory for `qs@6.15.1`, reachable through `@medusajs/js-sdk` and also a dev-tool path through `shadcn`/MCP. This is not proven to be in the Lambda deployment package, but it is in the production dependency audit.

Recommendation: run `npm audit fix` or update the relevant dependency chain once the compatible fixed `qs` version resolves cleanly.

## Positive Controls Confirmed

- No Lambda Function URL is configured.
- No Lambda event source mappings are configured.
- Lambda resource policy scopes API Gateway, Bedrock agents, and SES with `SourceArn` and/or `SourceAccount`.
- API Gateway JWT authorizer blocks unauthenticated requests before Lambda on protected routes.
- Stripe webhook handling delegates signature verification to the Stripe SDK.
- Public checkout status route uses a server-minted status token in Stripe metadata.
- RDS Proxy requires TLS.
- Lambda security group has no ingress and constrained service/database egress.
- S3 bucket public access block is fully enabled and the policy status is not public.
- API Gateway access logs, detailed metrics, and CloudWatch alarms exist for API/Lambda/RDS health.
- Live deep health returned `status=ok`, `environment=prod`, `db.proxyReachable=true`, `bedrock=runtime_ready`, and `ses=pending_production_access`.

## Suggested Fix Order

1. Remove live production localhost CORS and reconcile the admin origin with IaC.
2. Introduce a Lambda `prod` alias and update API Gateway to invoke the alias.
3. Set Lambda log retention and decide on JSON logging after a short compatibility test.
4. Add DB secret caching/module-scope AWS clients.
5. Enable or document rotation for commerce and RDS secrets.
6. Tighten VPC endpoint policies.
7. Decide whether ID-token group auth remains intentional, or add OAuth scopes.
8. Set reserved concurrency and document emergency throttling.
9. Persist `audit_log.before_data`.
10. Resolve the `qs` audit advisory.

## Verification

- `npm test` - passed, 397/397 tests.
- `npm run lint` - passed.
- `npx tsc --noEmit --pretty false` - passed.
- `npm audit --omit=dev` - failed with one moderate `qs@6.15.1` advisory.
- `npm ls qs` - traced `qs@6.15.1` through `@medusajs/js-sdk` and `shadcn`/MCP dev tooling.
- Live `GET /health?deep=1` - HTTP 200, `status=ok`, `environment=prod`, `db.proxyReachable=true`, `bedrock=runtime_ready`.
- Live CORS probe `Origin: http://localhost:3000` - HTTP 200 with allow-origin set to localhost.
- Live CORS probe `Origin: https://unknown-origin.example` - HTTP 200 with no allow-origin header.

## Official AWS Sources Used

- Lambda best practices: https://docs.aws.amazon.com/lambda/latest/dg/best-practices.html
- Secrets Manager in Lambda: https://docs.aws.amazon.com/lambda/latest/dg/with-secrets-manager.html
- Lambda versions: https://docs.aws.amazon.com/lambda/latest/dg/configuration-versions.html
- API Gateway HTTP API JWT authorizers: https://docs.aws.amazon.com/apigateway/latest/developerguide/http-api-jwt-authorizer.html
- API Gateway HTTP API CORS: https://docs.aws.amazon.com/apigateway/latest/developerguide/http-api-cors.html
- VPC endpoint policies: https://docs.aws.amazon.com/vpc/latest/privatelink/vpc-endpoints-access.html
- CloudWatch Logs retention: https://docs.aws.amazon.com/AmazonCloudWatch/latest/logs/Working-with-log-groups-and-streams.html
- Lambda JSON/Text log formats: https://docs.aws.amazon.com/lambda/latest/dg/monitoring-cloudwatchlogs-logformat.html
