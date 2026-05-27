# Bedrock E2E Audit - 2026-05-27

## Scope

This pass audited the Yuzu Cigar Club Bedrock path end to end across local code, local tests, static export runtime, live API authorization, Lambda runtime configuration, IAM simulation, Bedrock agents, aliases, guardrails, knowledge bases, VPC endpoints, and the Lambda resource policy.

No live customer prompt was invoked during the audit. The follow-up remediation did make AWS configuration changes and used read-only/live-health probes plus non-mutating Lambda action-group smoke checks.

## Summary

The static storefront and local Bedrock contract coverage are healthy. The live API reports `bedrock=runtime_ready`, all six Bedrock agents and `prod` aliases are prepared, the active knowledge base is `ACTIVE`, and API Gateway protects Bedrock-facing HTTP routes with JWT authorization.

The initial audit found four live hardening gaps: Lambda explicit Knowledge Base retrieval was denied, direct Runtime guardrails were configured but not enabled on the serving Lambda version, Bedrock action groups invoked the unqualified Lambda ARN, and the Bedrock Runtime VPC endpoint policy was broad. Follow-up remediation fixed the Lambda role retrieval permission, both Bedrock VPC endpoint policies, live alias invoke permissions, Lambda `live` alias version, all six production Bedrock action group executors, and stale unqualified Bedrock Lambda permissions.

## Remediation Update

Repository changes:

- Added `tests/bedrock-infra-contract.test.ts` coverage for Lambda KB retrieval, Bedrock Agent Runtime endpoint retrieval, Bedrock Runtime endpoint least privilege, direct Runtime guardrail defaults, operator prepare-agent policy coverage, and runtime endpoint setup policy application.
- Updated `infra/ycc-phase2-lambda-runtime-policy.json` to allow `bedrock:Retrieve` and `bedrock:RetrieveAndGenerate` on `knowledge-base/48GFMCLSTG`.
- Updated `infra/ycc-phase45-bedrock-agent-runtime-vpce-policy.json` to scope access to the Lambda execution role and allow KB retrieval.
- Added `infra/ycc-phase45-bedrock-runtime-vpce-policy.json`, wired `scripts/setup-ycc-bedrock-runtime-vpce.ps1` to apply it, and added `scripts/apply-ycc-bedrock-vpce-policies.ps1` to re-apply both Bedrock endpoint policies.
- Updated `infra/ycc-phase1-edge.yaml` so Bedrock Lambda permissions target `ExistingLambdaLiveAliasArn` and no unqualified Bedrock action-group permissions are recreated by future stack updates.
- Set `.env.example` to `BEDROCK_ENABLE_GUARDRAILS=1` and updated direct Runtime tests to expect guardrail config.

Live AWS changes applied on 2026-05-27:

- Updated Lambda role inline policy `YccApiPhase2RuntimePolicy`; IAM simulation now allows `bedrock:Retrieve`, `bedrock:InvokeModel`, `bedrock:ApplyGuardrail`, and tagged `bedrock:InvokeAgent` for the exact YCC resources.
- Updated VPC endpoint `vpce-0eaf893d65f8ec9f5` to allow Lambda-role `InvokeAgent`, `Retrieve`, and `RetrieveAndGenerate` only on the YCC aliases/KB.
- Updated VPC endpoint `vpce-08ceae2011933db0e` to allow Lambda-role `InvokeModel`, `InvokeModelWithResponseStream`, and `ApplyGuardrail` only on the YCC models/guardrail.
- Added six Bedrock invoke permissions to the Lambda `live` alias.
- Updated `$LATEST` with `BEDROCK_ENABLE_GUARDRAILS=1`, published Lambda version `4`, and Bedrock remediation readback showed `ycyyy:live` routing to version `4` with guardrails enabled. A later account-profile deployment moved `ycyyy:live` to version `5`, also with guardrails enabled.
- Rebuilt all six production Bedrock aliases to fresh versions with guardrail version `8` and action group executor `arn:aws:lambda:us-east-1:374587466106:function:ycyyy:live`: the five pre-existing agents route to version `7`, and `YCCNewsAgent` routes to version `7`.
- Final Lambda policy readback shows the `live` alias has API Gateway plus all six Bedrock invoke statements, while the unqualified function policy no longer has Bedrock invoke statements.

## Verification

- Final connected-fix check: `node --import tsx --test tests\bedrock-infra-contract.test.ts tests\api-gateway-contract.test.ts tests\lambda-ycc-api.test.ts` - 106/106 tests passed after removing the remaining unqualified Bedrock Lambda permission resources from the template.
- `npx tsc --noEmit --pretty false` - passed.
- `git diff --check` - exited `0` with line-ending normalization warnings only.
- `node --import tsx --test --test-name-pattern "Bedrock|bedrock|concierge chat|weekly cigar news|news story draft|humidor image identification|Humidor Agent|API Gateway template allows Bedrock" tests\lambda-ycc-api.test.ts tests\api-gateway-contract.test.ts` - 21 tests passed.
- `node --import tsx --test tests\e2e-runtime-audit.test.ts` - 5 tests passed.
- First `npm run e2e:runtime-audit` was blocked because another `next build` process was already running. After that process cleared, the rerun passed.
- `npm run e2e:runtime-audit` - Next.js 16.2.6 build passed, generated 953 static pages, audited 49 routes, followed 23 internal links, checked 78 runtime assets, 404 probe passed, warnings 0.
- `npx tsx scripts\e2e-runtime-audit.ts --full` - audited 959 exported routes, followed 6 additional internal links, checked 117 runtime assets, 404 probe passed, warnings 0.
- Remediation focused check: `node --import tsx --test --test-name-pattern "Bedrock|bedrock|API Gateway integration invokes the live Lambda alias|Lambda runtime policy|endpoint policy|direct Runtime guardrails|cigar guide" tests\bedrock-infra-contract.test.ts tests\api-gateway-contract.test.ts tests\lambda-ycc-api.test.ts` - 20 tests passed.
- `npx tsc --noEmit --pretty false` is currently blocked by unrelated dirty-worktree errors in `src/components/account-experience.tsx`, `tests/live-page-editor.test.ts`, and `tests/shopping-cart.test.ts`, not by the Bedrock remediation files.
- `https://api.yuzucigarclub.com/health?deep=1` returned HTTP `200`, `status=ok`, `environment=prod`, `db.proxyReachable=true`, `bedrock=runtime_ready`, and `ses=pending_production_access`.
- Remediation live Lambda action-group smoke invoked `GetMemberProfile` through `ycyyy:live` and returned `StatusCode=200`, `ExecutedVersion=4`, and `persistence.status=identity_required` without mutating customer data.
- Unauthenticated `POST https://api.yuzucigarclub.com/concierge/chat` returned HTTP `401 Unauthorized`.
- Unauthenticated `POST https://api.yuzucigarclub.com/humidor/identify-cigar` returned HTTP `401 Unauthorized`.

## Final Live Evidence

- Lambda alias `ycyyy:live` now routes to version `5`, and the alias environment includes `BEDROCK_ENABLE_GUARDRAILS=1`.
- All six Bedrock `prod` aliases route to version `7`; every routed action group executor is `arn:aws:lambda:us-east-1:374587466106:function:ycyyy:live`.
- The unqualified Lambda function policy has no Bedrock principal statements. The Lambda `live` alias policy has API Gateway plus the six scoped Bedrock invoke statements.
- `YccPhase4PrepareAgentPermissionGapPolicy` on `CodexMcpYccOperatorRole` now covers all six production agent ARNs, including `TUVBTVKNXG`.
- IAM simulation for `CodexMcpYccOperatorRole` returns `allowed` for `bedrock:PrepareAgent` on `arn:aws:bedrock:us-east-1:374587466106:agent/TUVBTVKNXG`.
- Non-mutating Lambda action-group smoke invoke during Bedrock remediation returned `StatusCode=200`, `ExecutedVersion=4`, and `persistence.status=identity_required`; later live alias promotion to version `5` retained the same Bedrock guardrail environment.

## Initial Live Evidence

- AWS account: `374587466106`, assumed role `CodexMcpYccOperatorRole`, profile `ycc-mcp`, region `us-east-1`.
- Initial Lambda alias: `arn:aws:lambda:us-east-1:374587466106:function:ycyyy:live`, last modified `2026-05-27T03:53:41.000+0000`; remediation later moved the alias to version `4`.
- API Gateway integration `aercs6j` points to `arn:aws:lambda:us-east-1:374587466106:function:ycyyy:live`.
- Lambda Bedrock environment:
  - `FEATURE_BEDROCK=runtime_ready`
  - `BEDROCK_MODEL_ID=amazon.nova-lite-v1:0`
  - `BEDROCK_KNOWLEDGE_BASE_ID=48GFMCLSTG`
  - `BEDROCK_GUARDRAIL_ID=xczjnv3f1wzs`
  - `BEDROCK_GUARDRAIL_VERSION=8`
  - Initial finding: `BEDROCK_ENABLE_GUARDRAILS` was unset; remediation readback now shows `BEDROCK_ENABLE_GUARDRAILS=1`.
- Agents and aliases:
  - Initial finding: `YCCConcierge` `NDIEDXNZAV`, alias `XXAQKDKDC0`, `prod`, prepared, routed to version `6`; remediation now routes it to version `7`.
  - Initial finding: `YCCCigarGuide` `EJI2VA7AVF`, alias `1JO8IAN4BL`, `prod`, prepared, routed to version `6`; remediation now routes it to version `7`.
  - Initial finding: `YCCSupportAgent` `SJJ2DVNYES`, alias `LIFBQL76AE`, `prod`, prepared, routed to version `6`; remediation now routes it to version `7`.
  - Initial finding: `YCCHumidorAgent` `XLN9JKVRDA`, alias `SOHCW5780U`, `prod`, prepared, routed to version `6`; remediation now routes it to version `7`.
  - Initial finding: `YCCAdminAgent` `UQWB6AKMBT`, alias `IHCMS7T9PB`, `prod`, prepared, routed to version `6`; remediation now routes it to version `7`.
  - Initial finding: `YCCNewsAgent` `TUVBTVKNXG`, alias `G25GBEUUMG`, `prod`, prepared, routed to version `5`; remediation now routes it to version `7`.
- Knowledge base:
  - `YCCKnowledgeBaseV2` `48GFMCLSTG` is `ACTIVE`.
  - Data source `YCCKnowledgeBaseS3SourceV2` `7YMKRXKLPX` is `AVAILABLE`.
  - Storage type is `S3_VECTORS`; embedding model is `amazon.titan-embed-text-v2:0`.
- Guardrails:
  - Guardrail `xczjnv3f1wzs` version `8` is `READY`.
  - Initial finding: `YCCNewsAgent` used guardrail version `8`, while the other five agents used version `6`; remediation now has all six production aliases on guardrail version `8`.

## Initial Findings

### High: Lambda explicit Knowledge Base retrieval is denied live

Status: resolved on 2026-05-27 by updating the Lambda role policy and Bedrock Agent Runtime VPC endpoint policy for `bedrock:Retrieve` and `bedrock:RetrieveAndGenerate` on `48GFMCLSTG`.

`infra/lambda/ycc-api/index.js` calls `RetrieveCommand` in `maybeRetrieveKnowledgeBaseContext`, and that function feeds the direct Bedrock Runtime fallback path plus humidor enrichment prefetch. Focused tests assert this behavior locally.

Live IAM simulation for the Lambda role returned `implicitDeny` for:

`bedrock:Retrieve` on `arn:aws:bedrock:us-east-1:374587466106:knowledge-base/48GFMCLSTG`

The live inline policy `YccApiPhase2RuntimePolicy` allows `bedrock:InvokeModel`, `bedrock:ApplyGuardrail`, and tagged `bedrock:InvokeAgent`, but not `bedrock:Retrieve`. The repo has `infra/ycc-phase4-bedrock-agent-runtime-policy.json` with `bedrock:Retrieve` and `bedrock:RetrieveAndGenerate`, but that permission is not present in the live Lambda role policy.

The live Bedrock Agent Runtime VPC endpoint policy also allows only `bedrock:InvokeAgent` on the six aliases, so explicit `Retrieve` traffic from the VPC would still be blocked even after IAM is fixed.

Impact: alias-backed agents can still use their attached KB internally, but Lambda prefetch/direct-runtime paths can silently degrade to no retrieved context. That affects direct `YCCCigarGuide`, direct fallback after alias failures, and humidor enrichment evidence quality.

Recommendation: merge/attach the phase 4 Bedrock retrieval policy to the Lambda role and update the Bedrock Agent Runtime endpoint policy to allow `bedrock:Retrieve` on the active YCC knowledge base. Add a read-only ops check that simulates `bedrock:Retrieve` and verifies endpoint policy coverage.

### Medium: Guardrail enforcement is inconsistent across live paths

Status: resolved on 2026-05-27 by enabling direct Runtime guardrails in Lambda version `4`, moving the `live` alias to version `4`, and rebuilding all six production Bedrock aliases with guardrail version `8`.

At initial audit time, live Lambda had `BEDROCK_GUARDRAIL_ID=xczjnv3f1wzs` and `BEDROCK_GUARDRAIL_VERSION=8`, but `BEDROCK_ENABLE_GUARDRAILS` was unset. The code only sends `guardrailConfig` to direct `ConverseCommand` calls when `BEDROCK_ENABLE_GUARDRAILS === "1"`.

Agent guardrail versions also drifted at initial audit time: `YCCNewsAgent` used version `8`, while the other five prepared agents used version `6`. Version `6` was still `READY`, but the live environment and latest ready guardrail pointed at version `8`.

Impact: agent paths have Bedrock guardrails, but not all on the same version. Direct runtime paths, including fallback generation and image/news direct model paths, rely on prompts and post-processing rather than Bedrock guardrail enforcement.

Recommendation: either document the intentional direct-runtime bypass per agent, or set `BEDROCK_ENABLE_GUARDRAILS=1` after validating adult cigar content is not over-blocked. Align prepared agents to the intended guardrail version.

### Medium: Bedrock action groups still invoke unqualified Lambda

Status: resolved on 2026-05-27 by preparing and promoting all six action groups with executor `arn:aws:lambda:us-east-1:374587466106:function:ycyyy:live`, removing stale unqualified live Lambda permissions, and removing unqualified Bedrock permission resources from the CloudFormation template.

At initial audit time, API Gateway was pinned to `ycyyy:live`, but the live Lambda resource policy permitted Bedrock agents to invoke `arn:aws:lambda:us-east-1:374587466106:function:ycyyy` without a qualifier. The CloudFormation template also granted Bedrock action group invoke permissions against `ExistingLambdaName`, while API Gateway used `ExistingLambdaLiveAliasArn`.

Impact: Bedrock action groups can execute `$LATEST`, which weakens rollback and creates possible drift from the API-tested `live` alias.

Recommendation: point Bedrock action group executor ARNs and Lambda invoke permissions at the `live` alias, then verify each prepared agent/action group still invokes successfully.

### Low: Bedrock Runtime VPC endpoint policy remains broad

Status: resolved on 2026-05-27 by applying a least-privilege endpoint policy scoped to the Lambda role, the YCC Nova model ARNs, and guardrail `xczjnv3f1wzs`.

At initial audit time, the live `com.amazonaws.us-east-1.bedrock-runtime` VPC endpoint policy allowed `Principal: *`, `Action: *`, and `Resource: *`. The Agent Runtime endpoint was narrower, but missing retrieval permissions as noted above.

Impact: the runtime endpoint relies on IAM for effective control. This is acceptable as a defense layer only if IAM stays tight, but it is weaker than the surrounding least-privilege pattern.

Recommendation: scope the runtime endpoint policy to the Lambda role and the specific foundation model and guardrail resources the API uses.

## Positive Controls

- API Gateway protects `/concierge/chat`, `/concierge/voice`, `/humidor/identify-cigar`, `/humidor/items`, `/humidor/items/{id}/enrich`, `/news/story-drafts`, and admin routes with JWT authorization in the template.
- Live unauthenticated probes to Bedrock-facing HTTP routes returned `401`.
- All six live Bedrock agents are `PREPARED`, all six `prod` aliases are `PREPARED`, and all six versions have the YCC knowledge base enabled.
- Live model check confirmed `amazon.nova-lite-v1:0` is available with text, image, and video input modalities and text output.
- Lambda log retention is set to 90 days.
- Local tests cover agent routing, admin/news authorization, action group session attributes, direct fallback behavior, image identification parsing, and humidor enrichment KB prefetch.

## Remaining Follow-Up Tests

- An ops audit script that checks the Lambda role for `bedrock:Retrieve`, `bedrock:InvokeAgent`, `bedrock:InvokeModel`, and `bedrock:ApplyGuardrail` against the exact live resources.
- A live-safe Bedrock readiness check that does not mutate customer data and can prove KB retrieval is authorized without relying only on `FEATURE_BEDROCK=runtime_ready`.
