import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const accountId = "374587466106";
const region = "us-east-1";
const lambdaRoleArn = `arn:aws:iam::${accountId}:role/service-role/ycyyy-1778040454500`;
const knowledgeBaseArn = `arn:aws:bedrock:${region}:${accountId}:knowledge-base/48GFMCLSTG`;
const guardrailArn = `arn:aws:bedrock:${region}:${accountId}:guardrail/xczjnv3f1wzs`;
const novaLiteModelArn = `arn:aws:bedrock:${region}::foundation-model/amazon.nova-lite-v1:0`;
const novaMicroModelArn = `arn:aws:bedrock:${region}::foundation-model/amazon.nova-micro-v1:0`;
const nova2LiteModelArn = `arn:aws:bedrock:${region}::foundation-model/amazon.nova-2-lite-v1:0`;
const nova2LiteInferenceProfileArn =
  `arn:aws:bedrock:${region}:${accountId}:inference-profile/us.amazon.nova-2-lite-v1:0`;
const nova2LiteDestinationModelArns = [
  `arn:aws:bedrock:us-east-1::foundation-model/amazon.nova-2-lite-v1:0`,
  `arn:aws:bedrock:us-east-2::foundation-model/amazon.nova-2-lite-v1:0`,
  `arn:aws:bedrock:us-west-2::foundation-model/amazon.nova-2-lite-v1:0`,
];
const nova2MultimodalEmbeddingArn =
  `arn:aws:bedrock:${region}::foundation-model/amazon.nova-2-multimodal-embeddings-v1:0`;
const cohereRerankArn = `arn:aws:bedrock:${region}::foundation-model/cohere.rerank-v3-5:0`;
const novaGroundingSystemToolArn = `arn:aws:bedrock::${accountId}:system-tool/amazon.nova_grounding`;
const lexBotAliasWildcardArn = `arn:aws:lex:${region}:${accountId}:bot-alias/*/*`;
const emailProviderSecretArn =
  `arn:aws:secretsmanager:${region}:${accountId}:secret:ycc/email/godaddy-m365-smtp/prod-*`;
const productionAgentArns = [
  `arn:aws:bedrock:${region}:${accountId}:agent/NDIEDXNZAV`,
  `arn:aws:bedrock:${region}:${accountId}:agent/EJI2VA7AVF`,
  `arn:aws:bedrock:${region}:${accountId}:agent/SJJ2DVNYES`,
  `arn:aws:bedrock:${region}:${accountId}:agent/XLN9JKVRDA`,
  `arn:aws:bedrock:${region}:${accountId}:agent/UQWB6AKMBT`,
  `arn:aws:bedrock:${region}:${accountId}:agent/TUVBTVKNXG`,
];

function readJson(relativePath: string) {
  return JSON.parse(readFileSync(new URL(`../${relativePath}`, import.meta.url), "utf8"));
}

function readText(relativePath: string) {
  return readFileSync(new URL(`../${relativePath}`, import.meta.url), "utf8");
}

function statementsForAction(policy: unknown, actionName: string) {
  const statements = Array.isArray((policy as { Statement?: unknown }).Statement)
    ? (policy as { Statement: Array<Record<string, unknown>> }).Statement
    : [];

  return statements.filter((statement) => {
    const actions = Array.isArray(statement.Action) ? statement.Action : [statement.Action];
    return actions.includes(actionName);
  });
}

function resources(statement: Record<string, unknown>) {
  return Array.isArray(statement.Resource) ? statement.Resource : [statement.Resource];
}

function assertNova2LiteInferenceProfileAccess(policy: unknown, policyLabel: string) {
  for (const actionName of ["bedrock:InvokeModel", "bedrock:InvokeModelWithResponseStream"]) {
    const statements = statementsForAction(policy, actionName);
    assert.ok(
      statements.some((statement) => resources(statement).includes(nova2LiteInferenceProfileArn)),
      `${policyLabel} ${actionName} should allow the us.amazon.nova-2-lite-v1:0 inference profile`,
    );
    assert.ok(
      statements.some((statement) => {
        const condition = statement.Condition as { StringEquals?: Record<string, unknown> } | undefined;
        return (
          nova2LiteDestinationModelArns.every((modelArn) => resources(statement).includes(modelArn)) &&
          condition?.StringEquals?.["bedrock:InferenceProfileArn"] === nova2LiteInferenceProfileArn
        );
      }),
      `${policyLabel} ${actionName} destinations should require the Nova 2 Lite inference-profile ARN`,
    );
  }
}

test("Lambda runtime policy allows explicit YCC knowledge base retrieval", () => {
  const policy = readJson("infra/ycc-phase2-lambda-runtime-policy.json");
  const retrieveStatements = statementsForAction(policy, "bedrock:Retrieve");
  const retrieveAndGenerateStatements = statementsForAction(policy, "bedrock:RetrieveAndGenerate");

  assert.ok(retrieveStatements.length > 0, "bedrock:Retrieve should be granted to the Lambda role policy");
  assert.ok(retrieveAndGenerateStatements.length > 0, "bedrock:RetrieveAndGenerate should be granted to the Lambda role policy");
  assert.ok(
    retrieveStatements.some((statement) => resources(statement).includes(knowledgeBaseArn)),
    "bedrock:Retrieve should be scoped to the active YCC knowledge base",
  );
});

test("Lambda runtime policy allows tagged Amazon Lex router aliases", () => {
  const policy = readJson("infra/ycc-phase2-lambda-runtime-policy.json");
  const recognizeTextStatements = statementsForAction(policy, "lex:RecognizeText");

  assert.ok(recognizeTextStatements.length > 0, "lex:RecognizeText should be granted to the Lambda role policy");
  assert.ok(
    recognizeTextStatements.some((statement) => resources(statement).includes(lexBotAliasWildcardArn)),
    "lex:RecognizeText should be scoped to Lex V2 bot aliases in the YCC account",
  );
  assert.ok(
    recognizeTextStatements.some((statement) => {
      const condition = JSON.stringify(statement.Condition);
      return condition.includes("aws:ResourceTag/Project") && condition.includes('"YCC"');
    }),
    "lex:RecognizeText should require the tagged YCC bot alias",
  );
});

test("Lambda runtime policy allows Rekognition text and label analysis for AI Cigar Adder images", () => {
  const policy = readJson("infra/ycc-phase2-lambda-runtime-policy.json");
  const detectTextStatements = statementsForAction(policy, "rekognition:DetectText");
  const detectLabelsStatements = statementsForAction(policy, "rekognition:DetectLabels");

  assert.ok(detectTextStatements.length > 0, "rekognition:DetectText should be granted for OCR evidence");
  assert.ok(detectLabelsStatements.length > 0, "rekognition:DetectLabels should be granted for visual label evidence");
  assert.ok(
    [...detectTextStatements, ...detectLabelsStatements].every((statement) => resources(statement).includes("*")),
    "Rekognition byte-image APIs should use Resource=* because uploaded bytes are not resource-scoped",
  );
});

test("Lambda runtime policy allows transactional SNS SMS owner alerts", () => {
  const policy = readJson("infra/ycc-phase2-lambda-runtime-policy.json");
  const publishStatements = statementsForAction(policy, "sns:Publish");

  assert.ok(publishStatements.length > 0, "sns:Publish should be granted for owner SMS alerts");
  assert.ok(
    publishStatements.some((statement) => resources(statement).includes("*")),
    "direct SMS publishes to phone numbers require Resource=*",
  );
});

test("Lambda runtime policy preserves the production support email secret permission", () => {
  const policy = readJson("infra/ycc-phase2-lambda-runtime-policy.json");
  for (const action of ["secretsmanager:DescribeSecret", "secretsmanager:GetSecretValue"]) {
    assert.ok(
      statementsForAction(policy, action).some((statement) => resources(statement).includes(emailProviderSecretArn)),
      `${action} should preserve access to the production support email secret`,
    );
  }
});

test("Bedrock Agent Runtime endpoint policy allows Lambda to invoke aliases and retrieve KB context", () => {
  const policy = readJson("infra/ycc-phase45-bedrock-agent-runtime-vpce-policy.json");
  const invokeAgentStatements = statementsForAction(policy, "bedrock:InvokeAgent");
  const retrieveStatements = statementsForAction(policy, "bedrock:Retrieve");

  assert.ok(
    invokeAgentStatements.every((statement) => JSON.stringify(statement.Principal).includes(lambdaRoleArn)),
    "InvokeAgent endpoint access should be scoped to the Lambda role",
  );
  assert.ok(retrieveStatements.length > 0, "agent-runtime endpoint should allow explicit KB retrieval");
  assert.ok(
    retrieveStatements.every((statement) => JSON.stringify(statement.Principal).includes(lambdaRoleArn)),
    "Retrieve endpoint access should be scoped to the Lambda role",
  );
  assert.ok(
    retrieveStatements.some((statement) => resources(statement).includes(knowledgeBaseArn)),
    "Retrieve endpoint access should be scoped to the active YCC knowledge base",
  );
});

test("Bedrock Runtime endpoint policy is least privilege for Lambda models and guardrail", () => {
  const policy = readJson("infra/ycc-phase45-bedrock-runtime-vpce-policy.json");
  const invokeStatements = statementsForAction(policy, "bedrock:InvokeModel");
  const streamStatements = statementsForAction(policy, "bedrock:InvokeModelWithResponseStream");
  const guardrailStatements = statementsForAction(policy, "bedrock:ApplyGuardrail");

  for (const statement of [...invokeStatements, ...streamStatements, ...guardrailStatements]) {
    assert.ok(JSON.stringify(statement.Principal).includes(lambdaRoleArn), "endpoint access should be scoped to the Lambda role");
  }

  assert.ok(invokeStatements.some((statement) => resources(statement).includes(novaLiteModelArn)));
  assert.ok(invokeStatements.some((statement) => resources(statement).includes(novaMicroModelArn)));
  assert.ok(invokeStatements.some((statement) => resources(statement).includes(nova2LiteModelArn)));
  assert.ok(guardrailStatements.some((statement) => resources(statement).includes(guardrailArn)));
  assertNova2LiteInferenceProfileAccess(policy, "Bedrock Runtime VPCE policy");
});

test("Bedrock direct Runtime guardrails are enabled by default in environment examples", () => {
  const envExample = readText(".env.example");

  assert.match(envExample, /^BEDROCK_ENABLE_GUARDRAILS=1$/m);
  assert.match(envExample, /^BEDROCK_MODEL_ID=us\.amazon\.nova-2-lite-v1:0$/m);
  assert.match(envExample, /^BEDROCK_VISION_MODEL_ID=us\.amazon\.nova-2-lite-v1:0$/m);
  assert.match(envExample, /^BEDROCK_CIGAR_IMAGE_KNOWLEDGE_BASE_ID=$/m);
  assert.match(envExample, /^BEDROCK_KNOWLEDGE_BASE_SEARCH_TYPE=SEMANTIC$/m);
  assert.match(envExample, /^FEATURE_LEX_ROUTER=pending_bot$/m);
  assert.match(envExample, /^LEX_ROUTER_LOCALE_ID=en_US$/m);
});

test("Bedrock runtime and KB policies cover Nova 2 vision, multimodal retrieval, and optional reranking", () => {
  const runtimePolicy = readJson("infra/ycc-phase2-lambda-runtime-policy.json");
  const runtimeInvocations = statementsForAction(runtimePolicy, "bedrock:InvokeModel");
  assert.ok(runtimeInvocations.some((statement) => resources(statement).includes(nova2LiteModelArn)));
  assertNova2LiteInferenceProfileAccess(runtimePolicy, "Lambda IAM runtime policy");

  const kbPolicy = readJson("infra/ycc-phase45-kb-service-policy.json");
  const kbInvocations = statementsForAction(kbPolicy, "bedrock:InvokeModel");
  const rerankStatements = statementsForAction(kbPolicy, "bedrock:Rerank");
  assert.ok(kbInvocations.some((statement) => resources(statement).includes(nova2MultimodalEmbeddingArn)));
  assert.ok(kbInvocations.some((statement) => resources(statement).includes(cohereRerankArn)));
  assert.ok(rerankStatements.some((statement) => resources(statement).includes("*")));
});

test("Lambda IAM and Bedrock Runtime endpoint policies allow only the Nova grounding system tool", () => {
  const policies = [
    ["Lambda IAM runtime policy", readJson("infra/ycc-phase2-lambda-runtime-policy.json")],
    ["Bedrock Runtime VPCE policy", readJson("infra/ycc-phase45-bedrock-runtime-vpce-policy.json")],
  ] as const;

  for (const [policyLabel, policy] of policies) {
    const invokeToolStatements = statementsForAction(policy, "bedrock:InvokeTool");
    assert.ok(invokeToolStatements.length > 0, `${policyLabel} should allow Bedrock system-tool invocation`);
    assert.ok(
      invokeToolStatements.some((statement) => resources(statement).includes(novaGroundingSystemToolArn)),
      `${policyLabel} should scope InvokeTool to amazon.nova_grounding`,
    );
    assert.deepEqual(
      [...new Set(invokeToolStatements.flatMap((statement) => resources(statement)))],
      [novaGroundingSystemToolArn],
      `${policyLabel} must not grant access to any other Bedrock system tool`,
    );
  }
});

test("operator prepare-agent policy covers all production YCC Bedrock agents", () => {
  const policy = readJson("infra/ycc-phase4-operator-prepare-agent-policy.json");
  const prepareStatements = statementsForAction(policy, "bedrock:PrepareAgent");
  const allowedResources = new Set(
    prepareStatements.flatMap(resources).filter((resource): resource is string => typeof resource === "string"),
  );

  for (const agentArn of productionAgentArns) {
    assert.ok(allowedResources.has(agentArn), `${agentArn} should be covered by the operator prepare-agent policy`);
  }
});

test("Bedrock Runtime endpoint setup applies the least-privilege endpoint policy", () => {
  const script = readText("scripts/setup-ycc-bedrock-runtime-vpce.ps1");

  assert.match(script, /ycc-phase45-bedrock-runtime-vpce-policy\.json/);
  assert.match(script, /modify-vpc-endpoint/);
  assert.match(script, /--policy-document/);
});

test("AI endpoint policy apply script discovers Runtime, Agent Runtime, and Rekognition endpoints", () => {
  const script = readText("scripts/apply-ycc-bedrock-vpce-policies.ps1");

  assert.match(script, /describe-vpc-endpoints/);
  assert.match(script, /com\.amazonaws\.\$Region\.bedrock-runtime/);
  assert.match(script, /ycc-phase45-bedrock-runtime-vpce-policy\.json/);
  assert.match(script, /com\.amazonaws\.\$Region\.bedrock-agent-runtime/);
  assert.match(script, /ycc-phase45-bedrock-agent-runtime-vpce-policy\.json/);
  assert.match(script, /com\.amazonaws\.\$Region\.rekognition/);
  assert.match(script, /ycc-phase45-rekognition-vpce-policy\.json/);
  assert.match(script, /modify-vpc-endpoint/);
  assert.match(script, /--policy-document/);
});

test("Rekognition endpoint policy only permits YCC Lambda cigar image analysis", () => {
  const policy = readJson("infra/ycc-phase45-rekognition-vpce-policy.json");
  for (const action of ["rekognition:DetectText", "rekognition:DetectLabels"]) {
    const statements = statementsForAction(policy, action);
    assert.equal(statements.length, 1);
    assert.deepEqual(statements[0].Principal, { AWS: lambdaRoleArn });
    assert.deepEqual(resources(statements[0]), ["*"]);
  }
});

test("phase 2 permissions helper merges Lambda environment with a revision guard", () => {
  const script = readText("scripts/apply-ycc-phase2-permissions.ps1");

  assert.match(script, /get-function-configuration/);
  assert.match(script, /Environment\.Variables\.PSObject\.Properties/);
  assert.match(script, /--revision-id/);
  assert.doesNotMatch(script, /\"FEATURE_BEDROCK\":\s*\"pending_agent\"/);
  assert.doesNotMatch(script, /\"DB_SECRET_ARN\"\s*:/);
});
