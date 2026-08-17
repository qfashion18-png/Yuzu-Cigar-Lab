import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, isAbsolute, join, relative, resolve } from "node:path";
import { performance } from "node:perf_hooks";
import { fileURLToPath } from "node:url";

type ImageRole =
  | "band_front"
  | "band_back"
  | "secondary_band"
  | "box_front"
  | "box_back"
  | "box_label"
  | "barcode"
  | "whole_cigar"
  | "other";

type RightsStatus = "owned" | "licensed" | "public_domain";
type IdentificationStatus = "identified" | "ambiguous" | "insufficient_evidence";
type Transport = "endpoint" | "lambda";

export type BenchmarkGates = {
  minTop1Accuracy?: number;
  minTop3Accuracy?: number;
  minSelectiveAccuracy?: number;
  maxAbstentionRate?: number;
  maxConfidentlyWrongRate?: number;
  maxP95LatencyMs?: number;
};

export type BenchmarkManifest = {
  schemaVersion: 1;
  name: string;
  description?: string;
  gates?: BenchmarkGates;
  samples: Array<{
    id: string;
    photoType: "real_photo";
    images: Array<{
      path: string;
      role?: ImageRole;
      mimeType?: string;
      fileName?: string;
      sha256?: string;
    }>;
    expected: {
      brand: string;
      canonicalName: string;
      acceptedNames?: string[];
    };
    rights: {
      status: RightsStatus;
      owner: string;
      evidence?: string;
    };
    notes?: string;
  }>;
};

type PreparedImage = {
  bytes: Buffer;
  displayPath: string;
  fileName: string;
  height: number;
  mimeType: string;
  role: ImageRole;
  sha256: string;
  width: number;
};

type PreparedSample = {
  id: string;
  images: PreparedImage[];
  expected: {
    brand: string;
    canonicalName: string;
    acceptedNames: string[];
  };
  rights: {
    status: RightsStatus;
    owner: string;
  };
  notes: string;
};

type PreparedManifest = {
  schemaVersion: 1;
  name: string;
  description: string;
  gates: BenchmarkGates;
  samples: PreparedSample[];
};

type Candidate = {
  name: string;
  brand: string;
  line: string;
  vitola: string;
  wrapper: string;
  confidence: string;
  matchScore: number | null;
};

type TransportResponse = {
  statusCode: number;
  body: Record<string, unknown> | null;
  errorCode?: string;
};

export type BenchmarkSampleResult = {
  id: string;
  outcome: "evaluated" | "operational_error";
  latencyMs: number;
  httpStatus: number | null;
  identificationStatus: IdentificationStatus | null;
  expectedName: string;
  topCandidateName: string | null;
  topCandidateConfidence: string | null;
  topCandidateMatchScore: number | null;
  candidateCount: number;
  top1Correct: boolean;
  top3Correct: boolean;
  abstained: boolean;
  confidentlyWrong: boolean;
  errorCode?: string;
};

export type BenchmarkMetrics = {
  totalSamples: number;
  evaluatedSamples: number;
  operationalErrors: number;
  operationalErrorRate: number;
  attemptedSamples: number;
  selectionRate: number | null;
  top1Correct: number;
  top1Accuracy: number | null;
  top3Correct: number;
  top3Accuracy: number | null;
  selectiveAccuracy: number | null;
  abstentions: number;
  abstentionRate: number | null;
  confidentlyWrong: number;
  confidentlyWrongRate: number | null;
  latencyMs: {
    mean: number | null;
    p50: number | null;
    p95: number | null;
    p99: number | null;
    max: number | null;
  };
};

type GateResult = {
  name: keyof BenchmarkGates | "operationalErrors";
  passed: boolean;
  actual: number | null;
  threshold: number;
  comparison: ">=" | "<=" | "=";
};

type CliOptions = {
  mode: "dry-run" | "live";
  json: boolean;
  transport: Transport;
  endpointUrl: string;
  tokenEnvName: string;
  lambdaFunction: string;
  profile: string;
  region: string;
  concurrency: number;
  timeoutMs: number;
  manifest: PreparedManifest;
};

const maxSamples = 1_000;
const maxImagesPerSample = 4;
const maxImageBytes = Math.floor(3.75 * 1024 * 1024);
const maxCombinedImageBytes = 4 * 1024 * 1024;
const maxImageDimension = 8_000;
const confidentlyWrongScore = 75;
const defaultRegion = "us-east-1";
const defaultTokenEnvName = "YCC_AI_CIGAR_BENCHMARK_TOKEN";
const imageRoles = new Set<ImageRole>([
  "band_front",
  "band_back",
  "secondary_band",
  "box_front",
  "box_back",
  "box_label",
  "barcode",
  "whole_cigar",
  "other",
]);
const rightsStatuses = new Set<RightsStatus>(["owned", "licensed", "public_domain"]);

export function loadBenchmarkManifest(manifestPath: string, workspaceRoot = process.cwd()): PreparedManifest {
  const absoluteManifestPath = resolve(manifestPath);
  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(absoluteManifestPath, "utf8"));
  } catch (error) {
    throw new Error(`Unable to read benchmark manifest: ${safeErrorMessage(error)}`);
  }

  return prepareManifest(parsed, dirname(absoluteManifestPath), workspaceRoot);
}

export function calculateBenchmarkMetrics(results: BenchmarkSampleResult[]): BenchmarkMetrics {
  const evaluated = results.filter((result) => result.outcome === "evaluated");
  const operationalErrors = results.length - evaluated.length;
  const attempted = evaluated.filter((result) => !result.abstained);
  const top1Correct = evaluated.filter((result) => result.top1Correct).length;
  const top3Correct = evaluated.filter((result) => result.top3Correct).length;
  const abstentions = evaluated.filter((result) => result.abstained).length;
  const confidentlyWrong = evaluated.filter((result) => result.confidentlyWrong).length;
  const latencies = results.map((result) => result.latencyMs).sort((left, right) => left - right);

  return {
    totalSamples: results.length,
    evaluatedSamples: evaluated.length,
    operationalErrors,
    operationalErrorRate: ratio(operationalErrors, results.length) ?? 0,
    attemptedSamples: attempted.length,
    selectionRate: ratio(attempted.length, evaluated.length),
    top1Correct,
    top1Accuracy: ratio(top1Correct, evaluated.length),
    top3Correct,
    top3Accuracy: ratio(top3Correct, evaluated.length),
    selectiveAccuracy: ratio(top1Correct, attempted.length),
    abstentions,
    abstentionRate: ratio(abstentions, evaluated.length),
    confidentlyWrong,
    confidentlyWrongRate: ratio(confidentlyWrong, evaluated.length),
    latencyMs: {
      mean: latencies.length ? roundMilliseconds(latencies.reduce((sum, value) => sum + value, 0) / latencies.length) : null,
      p50: percentile(latencies, 0.5),
      p95: percentile(latencies, 0.95),
      p99: percentile(latencies, 0.99),
      max: latencies.length ? roundMilliseconds(latencies.at(-1) || 0) : null,
    },
  };
}

export function evaluateBenchmarkResponse(
  sample: Pick<PreparedSample, "id" | "expected">,
  response: TransportResponse,
  latencyMs: number,
): BenchmarkSampleResult {
  if (response.statusCode !== 200 || !response.body) {
    return {
      id: sample.id,
      outcome: "operational_error",
      latencyMs: roundMilliseconds(latencyMs),
      httpStatus: response.statusCode || null,
      identificationStatus: null,
      expectedName: sample.expected.canonicalName,
      topCandidateName: null,
      topCandidateConfidence: null,
      topCandidateMatchScore: null,
      candidateCount: 0,
      top1Correct: false,
      top3Correct: false,
      abstained: false,
      confidentlyWrong: false,
      errorCode: response.errorCode || (response.statusCode ? `http_${response.statusCode}` : "invalid_response"),
    };
  }

  const suggestion = asRecord(response.body.suggestion);
  const candidateValues = Array.isArray(response.body.candidates)
    ? response.body.candidates
    : Array.isArray(suggestion?.candidates)
      ? suggestion.candidates
      : [];
  const candidates = candidateValues.map(parseCandidate).filter((candidate): candidate is Candidate => Boolean(candidate));
  if (candidates.length === 0) {
    const fallbackCandidate = parseCandidate(suggestion);
    if (fallbackCandidate) {
      candidates.push(fallbackCandidate);
    }
  }

  const rawIdentificationStatus = getString(response.body, "identificationStatus") || getString(suggestion, "identificationStatus");
  const identificationStatus = normalizeIdentificationStatus(rawIdentificationStatus, candidates.length);
  const abstained = identificationStatus === "insufficient_evidence" || candidates.length === 0;
  const top1Correct = !abstained && Boolean(candidates[0] && candidateMatchesExpected(candidates[0], sample.expected));
  const top3Correct = !abstained && candidates.slice(0, 3).some((candidate) => candidateMatchesExpected(candidate, sample.expected));
  const topCandidate = candidates[0] || null;
  const confidentlyWrong =
    !abstained &&
    !top1Correct &&
    Boolean(
      identificationStatus === "identified" ||
        topCandidate?.confidence === "high" ||
        (topCandidate?.matchScore !== null && topCandidate?.matchScore !== undefined && topCandidate.matchScore >= confidentlyWrongScore),
    );

  return {
    id: sample.id,
    outcome: "evaluated",
    latencyMs: roundMilliseconds(latencyMs),
    httpStatus: response.statusCode,
    identificationStatus,
    expectedName: sample.expected.canonicalName,
    topCandidateName: topCandidate?.name || null,
    topCandidateConfidence: topCandidate?.confidence || null,
    topCandidateMatchScore: topCandidate?.matchScore ?? null,
    candidateCount: candidates.length,
    top1Correct,
    top3Correct,
    abstained,
    confidentlyWrong,
  };
}

async function main() {
  const args = process.argv.slice(2);
  if (args.includes("--help")) {
    process.stdout.write(usageText());
    return;
  }

  const options = parseCliOptions(args);
  if (options.mode === "dry-run") {
    emit(buildDryRunReport(options), options.json);
    return;
  }

  const invoker = buildTransportInvoker(options);
  const results = await mapWithConcurrency(options.manifest.samples, options.concurrency, async (sample) => {
    const startedAt = performance.now();
    try {
      const response = await invoker(sample);
      return evaluateBenchmarkResponse(sample, response, performance.now() - startedAt);
    } catch (error) {
      return evaluateBenchmarkResponse(
        sample,
        { statusCode: 0, body: null, errorCode: safeErrorCode(error) },
        performance.now() - startedAt,
      );
    }
  });
  const metrics = calculateBenchmarkMetrics(results);
  const gates = evaluateGates(metrics, options.manifest.gates);
  const report = {
    schemaVersion: 1,
    mode: "live",
    benchmark: benchmarkSummary(options.manifest),
    execution: executionSummary(options),
    privacy: privacySummary(),
    results,
    metrics,
    gates: {
      passed: gates.every((gate) => gate.passed),
      results: gates,
    },
  };
  emit(report, options.json);

  if (metrics.operationalErrors > 0 || gates.some((gate) => !gate.passed)) {
    process.exitCode = 1;
  }
}

function parseCliOptions(args: string[]): CliOptions {
  const live = args.includes("--live");
  const explicitDryRun = args.includes("--dry-run");
  if (live && explicitDryRun) {
    throw new Error("Choose either --live or --dry-run, not both.");
  }

  const manifestPath = getArgValue(args, "--manifest");
  const customImagePaths = getArgValues(args, "--image");
  if (Boolean(manifestPath) === Boolean(customImagePaths.length)) {
    throw new Error("Provide exactly one labeled --manifest or one or more --image arguments.");
  }

  const manifest = manifestPath
    ? loadBenchmarkManifest(manifestPath)
    : prepareCustomSample(args, customImagePaths);
  const endpointUrl = getArgValue(args, "--endpoint") || process.env.YCC_AI_CIGAR_BENCHMARK_ENDPOINT || "";
  const lambdaFunction = getArgValue(args, "--function-name") || process.env.YCC_AI_CIGAR_BENCHMARK_LAMBDA_FUNCTION || "";
  const requestedTransport = getArgValue(args, "--transport") || (lambdaFunction && !endpointUrl ? "lambda" : "endpoint");
  if (!(["endpoint", "lambda"] as string[]).includes(requestedTransport)) {
    throw new Error("--transport must be endpoint or lambda.");
  }

  const concurrency = boundedInteger(getArgValue(args, "--concurrency") || "1", 1, 8, "--concurrency");
  const timeoutMs = boundedInteger(getArgValue(args, "--timeout-ms") || "90000", 1_000, 180_000, "--timeout-ms");
  const tokenEnvName = getArgValue(args, "--token-env") || defaultTokenEnvName;
  if (!/^[A-Z][A-Z0-9_]{2,80}$/.test(tokenEnvName)) {
    throw new Error("--token-env must name an uppercase environment variable.");
  }

  const options: CliOptions = {
    mode: live ? "live" : "dry-run",
    json: args.includes("--json"),
    transport: requestedTransport as Transport,
    endpointUrl,
    tokenEnvName,
    lambdaFunction,
    profile: getArgValue(args, "--profile") || process.env.AWS_PROFILE || "",
    region: getArgValue(args, "--region") || process.env.AWS_REGION || defaultRegion,
    concurrency,
    timeoutMs,
    manifest,
  };

  if (options.mode === "live" && options.transport === "endpoint") {
    validateEndpointUrl(options.endpointUrl);
    if (!process.env[options.tokenEnvName]) {
      throw new Error(`Live endpoint execution requires an auth token in ${options.tokenEnvName}; inline token arguments are not accepted.`);
    }
  }
  if (options.mode === "live" && options.transport === "lambda" && !options.lambdaFunction) {
    throw new Error("Live Lambda execution requires --function-name or YCC_AI_CIGAR_BENCHMARK_LAMBDA_FUNCTION.");
  }

  return options;
}

function prepareCustomSample(args: string[], imagePaths: string[]): PreparedManifest {
  const expectedBrand = getArgValue(args, "--expected-brand");
  const expectedName = getArgValue(args, "--expected-name");
  if (!expectedBrand || !expectedName) {
    throw new Error("Custom images fail closed unless both --expected-brand and --expected-name labels are provided.");
  }

  const rightsStatus = getArgValue(args, "--rights-status") as RightsStatus;
  const rightsOwner = getArgValue(args, "--rights-owner");
  if (!rightsStatuses.has(rightsStatus) || !rightsOwner) {
    throw new Error("Custom images require --rights-status owned|licensed|public_domain and --rights-owner.");
  }

  const rawManifest: BenchmarkManifest = {
    schemaVersion: 1,
    name: getArgValue(args, "--name") || "custom-real-photo-benchmark",
    samples: [
      {
        id: getArgValue(args, "--sample-id") || "custom-sample",
        photoType: "real_photo",
        images: imagePaths.map((path, index) => ({
          path,
          role: index === 0 ? "band_front" : "other",
        })),
        expected: {
          brand: expectedBrand,
          canonicalName: expectedName,
          acceptedNames: getArgValues(args, "--accepted-name"),
        },
        rights: {
          status: rightsStatus,
          owner: rightsOwner,
          evidence: getArgValue(args, "--rights-evidence") || undefined,
        },
      },
    ],
  };
  return prepareManifest(rawManifest, process.cwd(), process.cwd());
}

function prepareManifest(rawValue: unknown, baseDirectory: string, workspaceRoot: string): PreparedManifest {
  const raw = requireRecord(rawValue, "manifest");
  if (raw.schemaVersion !== 1) {
    throw new Error("Benchmark manifest schemaVersion must be 1.");
  }
  const name = requiredText(raw.name, "manifest.name", 160);
  if (!Array.isArray(raw.samples) || raw.samples.length === 0) {
    throw new Error("Benchmark manifest must contain at least one labeled real-photo sample.");
  }
  if (raw.samples.length > maxSamples) {
    throw new Error(`Benchmark manifest exceeds the ${maxSamples}-sample safety limit.`);
  }

  const seenIds = new Set<string>();
  const samples = raw.samples.map((sampleValue, sampleIndex) => {
    const sample = requireRecord(sampleValue, `samples[${sampleIndex}]`);
    const id = requiredText(sample.id, `samples[${sampleIndex}].id`, 120);
    if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,119}$/.test(id)) {
      throw new Error(`Sample id ${id} must use only letters, numbers, dots, underscores, or hyphens.`);
    }
    if (seenIds.has(id)) {
      throw new Error(`Duplicate benchmark sample id: ${id}`);
    }
    seenIds.add(id);
    if (sample.photoType !== "real_photo") {
      throw new Error(`Sample ${id} must declare photoType=real_photo; generated renders are not part of this benchmark.`);
    }

    const expected = requireRecord(sample.expected, `sample ${id}.expected`);
    const brand = requiredText(expected.brand, `sample ${id}.expected.brand`, 160);
    const canonicalName = requiredText(expected.canonicalName, `sample ${id}.expected.canonicalName`, 240);
    const acceptedNames = Array.isArray(expected.acceptedNames)
      ? expected.acceptedNames.map((value, index) => requiredText(value, `sample ${id}.expected.acceptedNames[${index}]`, 240))
      : [];

    const rights = requireRecord(sample.rights, `sample ${id}.rights`);
    const rightsStatus = requiredText(rights.status, `sample ${id}.rights.status`, 40) as RightsStatus;
    const rightsOwner = requiredText(rights.owner, `sample ${id}.rights.owner`, 240);
    const rightsEvidence = optionalText(rights.evidence, 1_000);
    if (!rightsStatuses.has(rightsStatus)) {
      throw new Error(`Sample ${id} rights.status must be owned, licensed, or public_domain.`);
    }
    if (rightsStatus !== "owned" && !rightsEvidence) {
      throw new Error(`Sample ${id} requires rights.evidence for ${rightsStatus} media.`);
    }

    if (!Array.isArray(sample.images) || sample.images.length === 0 || sample.images.length > maxImagesPerSample) {
      throw new Error(`Sample ${id} must contain between 1 and ${maxImagesPerSample} local images.`);
    }
    const images = sample.images.map((imageValue, imageIndex) => {
      const image = requireRecord(imageValue, `sample ${id}.images[${imageIndex}]`);
      const configuredPath = requiredText(image.path, `sample ${id}.images[${imageIndex}].path`, 2_000);
      if (/^[a-z][a-z0-9+.-]*:\/\//i.test(configuredPath)) {
        throw new Error(`Sample ${id} image ${imageIndex + 1} must be a local file, not a remote URL.`);
      }
      const imagePath = resolve(isAbsolute(configuredPath) ? configuredPath : join(baseDirectory, configuredPath));
      if (!existsSync(imagePath)) {
        throw new Error(`Sample ${id} image ${imageIndex + 1} is missing: ${safeDisplayPath(imagePath, workspaceRoot)}`);
      }
      const bytes = readFileSync(imagePath);
      const sha256 = createHash("sha256").update(bytes).digest("hex");
      const declaredSha256 = optionalText(image.sha256, 64).toLowerCase();
      if (declaredSha256 && (!/^[a-f0-9]{64}$/.test(declaredSha256) || declaredSha256 !== sha256)) {
        throw new Error(`Sample ${id} image ${imageIndex + 1} does not match its declared sha256.`);
      }
      const inspectedImage = inspectImageBytes(bytes);
      if (!inspectedImage) {
        throw new Error(`Sample ${id} image ${imageIndex + 1} is not a structurally valid PNG, JPEG, GIF, or WebP.`);
      }
      const { height, mimeType, width } = inspectedImage;
      const declaredMimeType = optionalText(image.mimeType, 80);
      if (declaredMimeType && declaredMimeType !== mimeType) {
        throw new Error(`Sample ${id} image ${imageIndex + 1} MIME does not match its file signature.`);
      }
      if (bytes.length > maxImageBytes) {
        throw new Error(`Sample ${id} image ${imageIndex + 1} exceeds the ${maxImageBytes}-byte per-image limit.`);
      }
      if (width > maxImageDimension || height > maxImageDimension) {
        throw new Error(`Sample ${id} image ${imageIndex + 1} exceeds ${maxImageDimension}px in width or height.`);
      }
      const defaultRole: ImageRole = imageIndex === 0 ? "band_front" : "other";
      const role = (optionalText(image.role, 80) || defaultRole) as ImageRole;
      if (!imageRoles.has(role)) {
        throw new Error(`Sample ${id} image ${imageIndex + 1} uses unsupported role ${role}.`);
      }
      const fileName = optionalText(image.fileName, 240) || basename(imagePath);
      return {
        bytes,
        displayPath: safeDisplayPath(imagePath, workspaceRoot),
        fileName: basename(fileName),
        height,
        mimeType,
        role,
        sha256,
        width,
      };
    });
    const combinedBytes = images.reduce((sum, image) => sum + image.bytes.length, 0);
    if (combinedBytes > maxCombinedImageBytes) {
      throw new Error(`Sample ${id} exceeds the ${maxCombinedImageBytes}-byte combined image limit.`);
    }

    return {
      id,
      images,
      expected: { brand, canonicalName, acceptedNames },
      rights: { status: rightsStatus, owner: rightsOwner },
      notes: optionalText(sample.notes, 1_000),
    };
  });

  return {
    schemaVersion: 1,
    name,
    description: optionalText(raw.description, 1_000),
    gates: parseGates(raw.gates),
    samples,
  };
}

function parseGates(value: unknown): BenchmarkGates {
  if (value === undefined || value === null) {
    return {};
  }
  const raw = requireRecord(value, "manifest.gates");
  const gates: BenchmarkGates = {};
  for (const key of [
    "minTop1Accuracy",
    "minTop3Accuracy",
    "minSelectiveAccuracy",
    "maxAbstentionRate",
    "maxConfidentlyWrongRate",
  ] as const) {
    if (raw[key] !== undefined) {
      const numeric = Number(raw[key]);
      if (!Number.isFinite(numeric) || numeric < 0 || numeric > 1) {
        throw new Error(`manifest.gates.${key} must be between 0 and 1.`);
      }
      gates[key] = numeric;
    }
  }
  if (raw.maxP95LatencyMs !== undefined) {
    const numeric = Number(raw.maxP95LatencyMs);
    if (!Number.isFinite(numeric) || numeric <= 0) {
      throw new Error("manifest.gates.maxP95LatencyMs must be a positive number.");
    }
    gates.maxP95LatencyMs = numeric;
  }
  return gates;
}

function buildTransportInvoker(options: CliOptions) {
  if (options.transport === "endpoint") {
    const endpointUrl = validateEndpointUrl(options.endpointUrl);
    const authToken = process.env[options.tokenEnvName] || "";
    return (sample: PreparedSample) => invokeEndpoint(sample, endpointUrl, authToken, options.timeoutMs);
  }
  return (sample: PreparedSample) => invokeLambda(sample, options);
}

async function invokeEndpoint(
  sample: PreparedSample,
  endpointUrl: string,
  authToken: string,
  timeoutMs: number,
): Promise<TransportResponse> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(endpointUrl, {
      method: "POST",
      headers: {
        authorization: `Bearer ${authToken}`,
        "content-type": "application/json",
        "user-agent": "ycc-ai-cigar-real-photo-benchmark/1.0",
      },
      body: JSON.stringify(buildIdentifyRequest(sample)),
      signal: controller.signal,
    });
    const responseText = await response.text();
    return {
      statusCode: response.status,
      body: parseJsonRecord(responseText),
      ...(response.status === 200 ? {} : { errorCode: `http_${response.status}` }),
    };
  } finally {
    clearTimeout(timeout);
  }
}

async function invokeLambda(sample: PreparedSample, options: CliOptions): Promise<TransportResponse> {
  const tempDirectory = mkdtempSync(join(tmpdir(), "ycc-ai-cigar-benchmark-"));
  const eventPath = join(tempDirectory, "event.json");
  const responsePath = join(tempDirectory, "response.json");
  try {
    const event = {
      routeKey: "POST /humidor/identify-cigar",
      rawPath: "/humidor/identify-cigar",
      headers: {
        "content-type": "application/json",
        "user-agent": "ycc-ai-cigar-real-photo-benchmark/1.0",
      },
      body: JSON.stringify(buildIdentifyRequest(sample)),
      requestContext: {
        requestId: `ai-cigar-benchmark-${Date.now()}-${sample.id}`,
        http: { method: "POST", sourceIp: "198.51.100.42" },
        authorizer: {
          jwt: {
            claims: {
              sub: "ai-cigar-benchmark-member",
              email: "ai-cigar-benchmark@yuzucigarclub.com",
              email_verified: "true",
              name: "AI Cigar Benchmark",
              "cognito:groups": "member",
              "custom:member_status": "active",
              "custom:membership_tier": "Sensei",
            },
          },
        },
      },
    };
    writeFileSync(eventPath, JSON.stringify(event), "utf8");
    const args = [
      "--cli-connect-timeout",
      "10",
      "--cli-read-timeout",
      String(Math.ceil(options.timeoutMs / 1_000)),
      "lambda",
      "invoke",
      "--function-name",
      options.lambdaFunction,
      "--payload",
      `fileb://${eventPath}`,
      responsePath,
      "--region",
      options.region,
      "--output",
      "json",
    ];
    if (options.profile) {
      args.push("--profile", options.profile);
    }
    execFileSync("aws", args, {
      encoding: "utf8",
      maxBuffer: 2 * 1024 * 1024,
      stdio: ["ignore", "pipe", "pipe"],
      timeout: options.timeoutMs + 15_000,
    });
    const payload = parseJsonRecord(readFileSync(responsePath, "utf8"));
    const statusCode = Number(payload?.statusCode) || 0;
    const bodyText = typeof payload?.body === "string" ? payload.body : "";
    return {
      statusCode,
      body: parseJsonRecord(bodyText),
      ...(statusCode === 200 ? {} : { errorCode: statusCode ? `lambda_http_${statusCode}` : "invalid_lambda_payload" }),
    };
  } finally {
    rmSync(tempDirectory, { force: true, recursive: true });
  }
}

function buildIdentifyRequest(sample: PreparedSample) {
  return {
    contractVersion: 2,
    images: sample.images.map((image) => ({
      imageBase64: image.bytes.toString("base64"),
      mimeType: image.mimeType,
      fileName: image.fileName,
      role: image.role,
    })),
    notes: sample.notes || "Benchmark identification only. Do not persist or add this cigar to a humidor.",
  };
}

function parseCandidate(value: unknown): Candidate | null {
  const candidate = asRecord(value);
  if (!candidate) {
    return null;
  }
  const brand = getString(candidate, "brand");
  const line = getString(candidate, "line");
  const vitola = getString(candidate, "vitola");
  const wrapper = getString(candidate, "wrapper");
  const name = getString(candidate, "name") || [brand, line, vitola, wrapper].filter(Boolean).join(" ");
  if (!name) {
    return null;
  }
  const rawScore = Number(candidate.matchScore);
  return {
    name: sanitizeText(name, 240),
    brand: sanitizeText(brand, 160),
    line: sanitizeText(line, 160),
    vitola: sanitizeText(vitola, 160),
    wrapper: sanitizeText(wrapper, 160),
    confidence: ["high", "medium", "low"].includes(getString(candidate, "confidence").toLowerCase())
      ? getString(candidate, "confidence").toLowerCase()
      : "low",
    matchScore: Number.isFinite(rawScore) ? Math.max(0, Math.min(100, rawScore)) : null,
  };
}

function candidateMatchesExpected(candidate: Candidate, expected: PreparedSample["expected"]) {
  const expectedNames = [expected.canonicalName, `${expected.brand} ${expected.canonicalName}`, ...expected.acceptedNames]
    .map(normalizeIdentity)
    .filter(Boolean);
  const candidateNames = [
    candidate.name,
    `${candidate.brand} ${candidate.name}`,
    [candidate.brand, candidate.line, candidate.vitola, candidate.wrapper].filter(Boolean).join(" "),
  ]
    .map(normalizeIdentity)
    .filter(Boolean);
  return expectedNames.some((expectedName) => candidateNames.includes(expectedName));
}

function normalizeIdentificationStatus(value: string, candidateCount: number): IdentificationStatus {
  if (value === "identified" || value === "ambiguous" || value === "insufficient_evidence") {
    return value;
  }
  return candidateCount > 0 ? "ambiguous" : "insufficient_evidence";
}

function evaluateGates(metrics: BenchmarkMetrics, gates: BenchmarkGates): GateResult[] {
  const results: GateResult[] = [
    {
      name: "operationalErrors",
      passed: metrics.operationalErrors === 0,
      actual: metrics.operationalErrors,
      threshold: 0,
      comparison: "=",
    },
  ];
  const definitions: Array<{
    name: keyof BenchmarkGates;
    actual: number | null;
    comparison: ">=" | "<=";
  }> = [
    { name: "minTop1Accuracy", actual: metrics.top1Accuracy, comparison: ">=" },
    { name: "minTop3Accuracy", actual: metrics.top3Accuracy, comparison: ">=" },
    { name: "minSelectiveAccuracy", actual: metrics.selectiveAccuracy, comparison: ">=" },
    { name: "maxAbstentionRate", actual: metrics.abstentionRate, comparison: "<=" },
    { name: "maxConfidentlyWrongRate", actual: metrics.confidentlyWrongRate, comparison: "<=" },
    { name: "maxP95LatencyMs", actual: metrics.latencyMs.p95, comparison: "<=" },
  ];
  for (const definition of definitions) {
    const threshold = gates[definition.name];
    if (threshold === undefined) {
      continue;
    }
    results.push({
      name: definition.name,
      passed:
        definition.actual !== null &&
        (definition.comparison === ">=" ? definition.actual >= threshold : definition.actual <= threshold),
      actual: definition.actual,
      threshold,
      comparison: definition.comparison,
    });
  }
  return results;
}

function buildDryRunReport(options: CliOptions) {
  return {
    schemaVersion: 1,
    mode: "dry-run",
    benchmark: benchmarkSummary(options.manifest),
    execution: executionSummary(options),
    privacy: privacySummary(),
    inventory: options.manifest.samples.map((sample) => ({
      id: sample.id,
      expected: {
        brand: sample.expected.brand,
        canonicalName: sample.expected.canonicalName,
        acceptedNames: sample.expected.acceptedNames,
      },
      rights: sample.rights,
      imageCount: sample.images.length,
      combinedBytes: sample.images.reduce((sum, image) => sum + image.bytes.length, 0),
      images: sample.images.map((image) => ({
        path: image.displayPath,
        fileName: image.fileName,
        mimeType: image.mimeType,
        role: image.role,
        sha256: image.sha256,
        sizeBytes: image.bytes.length,
        width: image.width,
        height: image.height,
      })),
    })),
    metrics: null,
    nextCommand:
      options.transport === "endpoint"
        ? "npm run ai:cigar-benchmark -- --manifest <path> --live --transport endpoint --endpoint <url> --json"
        : "npm run ai:cigar-benchmark -- --manifest <path> --live --transport lambda --function-name <name> --json",
  };
}

function benchmarkSummary(manifest: PreparedManifest) {
  return {
    name: manifest.name,
    description: manifest.description,
    sampleCount: manifest.samples.length,
    imageCount: manifest.samples.reduce((sum, sample) => sum + sample.images.length, 0),
    gates: manifest.gates,
  };
}

function executionSummary(options: CliOptions) {
  return {
    transport: options.transport,
    target:
      options.transport === "endpoint"
        ? options.endpointUrl
          ? safeEndpointDisplay(options.endpointUrl)
          : "not-configured"
        : options.lambdaFunction || "not-configured",
    region: options.transport === "lambda" ? options.region : null,
    profileConfigured: options.transport === "lambda" ? Boolean(options.profile) : null,
    authTokenEnv: options.transport === "endpoint" ? options.tokenEnvName : null,
    concurrency: options.concurrency,
    timeoutMs: options.timeoutMs,
  };
}

function privacySummary() {
  return {
    imagePayloadsLogged: false,
    authTokensLogged: false,
    rawProviderResponsesLogged: false,
    modelTokenUsageLogged: false,
    outputContainsOnlyLabelsPredictionsMetricsAndSafeOperationalMetadata: true,
  };
}

async function mapWithConcurrency<T, R>(values: T[], concurrency: number, worker: (value: T) => Promise<R>) {
  const results = new Array<R>(values.length);
  let nextIndex = 0;
  async function runWorker() {
    while (nextIndex < values.length) {
      const index = nextIndex;
      nextIndex += 1;
      results[index] = await worker(values[index]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, values.length) }, () => runWorker()));
  return results;
}

function inspectImageBytes(bytes: Buffer): { mimeType: string; width: number; height: number } | null {
  if (!Buffer.isBuffer(bytes) || bytes.length < 10) {
    return null;
  }
  if (bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    if (bytes.length < 24 || bytes.toString("ascii", 12, 16) !== "IHDR") {
      return null;
    }
    return normalizeInspectedImage("image/png", bytes.readUInt32BE(16), bytes.readUInt32BE(20));
  }
  const gifHeader = bytes.toString("ascii", 0, 6);
  if (gifHeader === "GIF87a" || gifHeader === "GIF89a") {
    return normalizeInspectedImage("image/gif", bytes.readUInt16LE(6), bytes.readUInt16LE(8));
  }
  if (bytes.length >= 16 && bytes.toString("ascii", 0, 4) === "RIFF" && bytes.toString("ascii", 8, 12) === "WEBP") {
    return inspectWebpImageBytes(bytes);
  }
  if (bytes[0] === 0xff && bytes[1] === 0xd8) {
    return inspectJpegImageBytes(bytes);
  }
  return null;
}

function inspectJpegImageBytes(bytes: Buffer) {
  const startOfFrameMarkers = new Set([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf]);
  let offset = 2;
  while (offset + 3 < bytes.length) {
    if (bytes[offset] !== 0xff) {
      offset += 1;
      continue;
    }
    while (offset < bytes.length && bytes[offset] === 0xff) {
      offset += 1;
    }
    const marker = bytes[offset];
    offset += 1;
    if (marker === 0xd9 || marker === 0xda || offset + 1 >= bytes.length) {
      break;
    }
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      continue;
    }
    const segmentLength = bytes.readUInt16BE(offset);
    if (segmentLength < 2 || offset + segmentLength > bytes.length) {
      return null;
    }
    if (startOfFrameMarkers.has(marker) && segmentLength >= 7) {
      return normalizeInspectedImage("image/jpeg", bytes.readUInt16BE(offset + 5), bytes.readUInt16BE(offset + 3));
    }
    offset += segmentLength;
  }
  return null;
}

function inspectWebpImageBytes(bytes: Buffer) {
  const chunkType = bytes.toString("ascii", 12, 16);
  if (chunkType === "VP8X" && bytes.length >= 30) {
    return normalizeInspectedImage("image/webp", 1 + readUInt24LE(bytes, 24), 1 + readUInt24LE(bytes, 27));
  }
  if (chunkType === "VP8 " && bytes.length >= 30 && bytes[23] === 0x9d && bytes[24] === 0x01 && bytes[25] === 0x2a) {
    return normalizeInspectedImage("image/webp", bytes.readUInt16LE(26) & 0x3fff, bytes.readUInt16LE(28) & 0x3fff);
  }
  if (chunkType === "VP8L" && bytes.length >= 25 && bytes[20] === 0x2f) {
    const width = 1 + bytes[21] + ((bytes[22] & 0x3f) << 8);
    const height = 1 + ((bytes[22] >> 6) | (bytes[23] << 2) | ((bytes[24] & 0x0f) << 10));
    return normalizeInspectedImage("image/webp", width, height);
  }
  return null;
}

function readUInt24LE(bytes: Buffer, offset: number) {
  return bytes[offset] | (bytes[offset + 1] << 8) | (bytes[offset + 2] << 16);
}

function normalizeInspectedImage(mimeType: string, width: number, height: number) {
  return Number.isInteger(width) && width > 0 && Number.isInteger(height) && height > 0
    ? { mimeType, width, height }
    : null;
}

function validateEndpointUrl(value: string) {
  if (!value) {
    throw new Error("Live endpoint execution requires --endpoint or YCC_AI_CIGAR_BENCHMARK_ENDPOINT.");
  }
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error("Benchmark endpoint must be a valid HTTP(S) URL.");
  }
  if (!(["http:", "https:"] as string[]).includes(url.protocol) || url.username || url.password) {
    throw new Error("Benchmark endpoint must be an HTTP(S) URL without embedded credentials.");
  }
  return url.toString();
}

function safeEndpointDisplay(value: string) {
  try {
    const url = new URL(value);
    return `${url.origin}${url.pathname}`;
  } catch {
    return "configured-endpoint";
  }
}

function safeDisplayPath(value: string, workspaceRoot: string) {
  const relativePath = relative(resolve(workspaceRoot), resolve(value));
  if (relativePath && !relativePath.startsWith("..") && !isAbsolute(relativePath)) {
    return relativePath.replace(/\\/g, "/");
  }
  return `<external>/${basename(value)}`;
}

function parseJsonRecord(value: string) {
  try {
    return asRecord(JSON.parse(value));
  } catch {
    return null;
  }
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function requireRecord(value: unknown, label: string) {
  const record = asRecord(value);
  if (!record) {
    throw new Error(`${label} must be an object.`);
  }
  return record;
}

function requiredText(value: unknown, label: string, maxLength: number) {
  const text = optionalText(value, maxLength);
  if (!text) {
    throw new Error(`${label} is required.`);
  }
  return text;
}

function optionalText(value: unknown, maxLength: number) {
  return typeof value === "string" ? value.replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, maxLength) : "";
}

function getString(record: Record<string, unknown> | null, key: string) {
  return typeof record?.[key] === "string" ? sanitizeText(record[key], 240) : "";
}

function sanitizeText(value: unknown, maxLength: number) {
  return String(value || "")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

function normalizeIdentity(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function ratio(numerator: number, denominator: number) {
  return denominator > 0 ? Math.round((numerator / denominator) * 10_000) / 10_000 : null;
}

function percentile(sortedValues: number[], percentileValue: number) {
  if (sortedValues.length === 0) {
    return null;
  }
  const index = Math.max(0, Math.ceil(sortedValues.length * percentileValue) - 1);
  return roundMilliseconds(sortedValues[index]);
}

function roundMilliseconds(value: number) {
  return Math.round(value * 10) / 10;
}

function boundedInteger(value: string, minimum: number, maximum: number, label: string) {
  const numeric = Number(value);
  if (!Number.isInteger(numeric) || numeric < minimum || numeric > maximum) {
    throw new Error(`${label} must be an integer between ${minimum} and ${maximum}.`);
  }
  return numeric;
}

function getArgValue(args: string[], name: string) {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] || "" : "";
}

function getArgValues(args: string[], name: string) {
  const values: string[] = [];
  args.forEach((value, index) => {
    if (value === name && args[index + 1]) {
      values.push(args[index + 1]);
    }
  });
  return values;
}

function safeErrorCode(error: unknown) {
  if (error instanceof Error && error.name === "AbortError") {
    return "timeout";
  }
  const name = error instanceof Error ? error.name : "error";
  return `transport_${name.toLowerCase().replace(/[^a-z0-9]+/g, "_").slice(0, 60) || "error"}`;
}

function safeErrorMessage(error: unknown) {
  const value = error instanceof Error ? error.message : String(error);
  return value
    .replace(/(bearer\s+)[^\s]+/gi, "$1[REDACTED]")
    .replace(/([?&](?:access_token|api_key|auth|key|signature|token)=)[^&\s]+/gi, "$1[REDACTED]")
    .replace(/[A-Za-z0-9+/_=-]{96,}/g, "[REDACTED_BLOB]")
    .slice(0, 1_000);
}

function emit(value: unknown, json: boolean) {
  if (json) {
    process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
    return;
  }
  const report = value as {
    mode?: string;
    benchmark?: { name?: string; sampleCount?: number };
    execution?: { transport?: string; target?: string };
    metrics?: BenchmarkMetrics | null;
    gates?: { passed?: boolean };
  };
  process.stdout.write(
    `AI Cigar real-photo benchmark ${report.mode || "unknown"}: ${report.benchmark?.name || "unnamed"} (${report.benchmark?.sampleCount || 0} samples)\n`,
  );
  process.stdout.write(`Transport: ${report.execution?.transport || "unknown"} -> ${report.execution?.target || "not-configured"}\n`);
  if (report.metrics) {
    process.stdout.write(
      `Top-1=${formatRate(report.metrics.top1Accuracy)} Top-3=${formatRate(report.metrics.top3Accuracy)} Selective=${formatRate(report.metrics.selectiveAccuracy)} Abstention=${formatRate(report.metrics.abstentionRate)} Confidently-wrong=${formatRate(report.metrics.confidentlyWrongRate)} P95=${report.metrics.latencyMs.p95 ?? "n/a"}ms\n`,
    );
    process.stdout.write(`Operational errors: ${report.metrics.operationalErrors}; gates: ${report.gates?.passed ? "PASS" : "FAIL"}\n`);
  }
}

function formatRate(value: number | null) {
  return value === null ? "n/a" : `${Math.round(value * 10_000) / 100}%`;
}

function usageText() {
  return [
    "AI Cigar real-photo benchmark",
    "",
    "Dry-run a labeled manifest:",
    "  npm run ai:cigar-benchmark -- --manifest <manifest.json> --dry-run --json",
    "",
    "Run against the authenticated endpoint (token is read only from an environment variable):",
    "  npm run ai:cigar-benchmark -- --manifest <manifest.json> --live --transport endpoint --endpoint <url> --json",
    "",
    "Run by invoking Lambda directly:",
    "  npm run ai:cigar-benchmark -- --manifest <manifest.json> --live --transport lambda --function-name <name> --profile <profile> --json",
    "",
    "Manifest samples require id, photoType=real_photo, 1-4 local images, expected.brand, expected.canonicalName, and rights.status/owner.",
    "Optional manifest gates: minTop1Accuracy, minTop3Accuracy, minSelectiveAccuracy, maxAbstentionRate, maxConfidentlyWrongRate, maxP95LatencyMs.",
    "Custom images require --expected-brand, --expected-name, --rights-status, and --rights-owner.",
    "No image bytes, auth tokens, raw model responses, or model token usage are written to output.",
    "",
  ].join("\n");
}

const currentFile = fileURLToPath(import.meta.url);
const invokedFile = resolve(process.argv[1] || "");

if (currentFile === invokedFile) {
  main().catch((error: unknown) => {
    process.stderr.write(`AI Cigar benchmark failed: ${safeErrorMessage(error)}\n`);
    process.exitCode = 1;
  });
}
