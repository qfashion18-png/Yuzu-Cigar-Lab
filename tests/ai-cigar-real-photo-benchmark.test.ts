import assert from "node:assert/strict";
import { execFile, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  calculateBenchmarkMetrics,
  evaluateBenchmarkResponse,
  type BenchmarkSampleResult,
} from "../scripts/ai-cigar-real-photo-benchmark";

const repositoryRoot = fileURLToPath(new URL("..", import.meta.url));
const benchmarkScript = "scripts/ai-cigar-real-photo-benchmark.ts";
const onePixelPng = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
  "base64",
);

test("AI Cigar benchmark dry-run inventories labeled local photos without emitting image bytes", async () => {
  const fixture = createManifestFixture();
  try {
    const { stdout, stderr } = await runBenchmarkCli([
      "--manifest",
      fixture.manifestPath,
      "--dry-run",
      "--transport",
      "endpoint",
      "--json",
    ]);
    assert.equal(stderr, "");
    const report = JSON.parse(stdout) as {
      mode: string;
      benchmark: { sampleCount: number; imageCount: number };
      execution: { transport: string; target: string; authTokenEnv: string };
      privacy: Record<string, boolean>;
      inventory: Array<{
        expected: { brand: string; canonicalName: string };
        rights: { status: string; owner: string };
        images: Array<{
          path: string;
          mimeType: string;
          role: string;
          sha256: string;
          sizeBytes: number;
          width: number;
          height: number;
        }>;
      }>;
      metrics: null;
    };

    assert.equal(report.mode, "dry-run");
    assert.equal(report.benchmark.sampleCount, 1);
    assert.equal(report.benchmark.imageCount, 1);
    assert.equal(report.execution.transport, "endpoint");
    assert.equal(report.execution.target, "not-configured");
    assert.equal(report.execution.authTokenEnv, "YCC_AI_CIGAR_BENCHMARK_TOKEN");
    assert.equal(report.privacy.imagePayloadsLogged, false);
    assert.equal(report.privacy.authTokensLogged, false);
    assert.equal(report.privacy.rawProviderResponsesLogged, false);
    assert.equal(report.privacy.modelTokenUsageLogged, false);
    assert.equal(report.inventory[0].expected.brand, "Padrón");
    assert.equal(report.inventory[0].expected.canonicalName, "Padrón 1964 Anniversary Exclusivo Maduro");
    assert.deepEqual(report.inventory[0].rights, { status: "owned", owner: "benchmark-test-suite" });
    assert.equal(report.inventory[0].images[0].mimeType, "image/png");
    assert.equal(report.inventory[0].images[0].role, "band_front");
    assert.equal(report.inventory[0].images[0].sha256, createHash("sha256").update(onePixelPng).digest("hex"));
    assert.equal(report.inventory[0].images[0].sizeBytes, onePixelPng.length);
    assert.equal(report.inventory[0].images[0].width, 1);
    assert.equal(report.inventory[0].images[0].height, 1);
    assert.equal(report.metrics, null);
    assert.doesNotMatch(stdout, new RegExp(onePixelPng.toString("base64")));
    assert.doesNotMatch(stdout, /imageBase64/);
  } finally {
    fixture.cleanup();
  }
});

test("AI Cigar benchmark dry-run selects Lambda transport without invoking AWS", async () => {
  const fixture = createManifestFixture();
  try {
    const { stdout } = await runBenchmarkCli([
      "--manifest",
      fixture.manifestPath,
      "--dry-run",
      "--transport",
      "lambda",
      "--function-name",
      "ycyyy:live",
      "--profile",
      "benchmark-test-profile",
      "--json",
    ]);
    const report = JSON.parse(stdout) as {
      execution: { transport: string; target: string; region: string; profileConfigured: boolean };
    };
    assert.deepEqual(report.execution, {
      transport: "lambda",
      target: "ycyyy:live",
      region: "us-east-1",
      profileConfigured: true,
      concurrency: 1,
      timeoutMs: 90000,
      authTokenEnv: null,
    });
  } finally {
    fixture.cleanup();
  }
});

test("AI Cigar benchmark fails closed when custom photos are missing identity labels", () => {
  const fixtureDirectory = mkdtempSync(join(tmpdir(), "ai-cigar-benchmark-unlabeled-"));
  const imagePath = join(fixtureDirectory, "unlabeled.png");
  writeFileSync(imagePath, onePixelPng);

  try {
    const result = spawnSync(
      process.execPath,
      [
        "--import",
        "tsx",
        benchmarkScript,
        "--image",
        imagePath,
        "--dry-run",
        "--rights-status",
        "owned",
        "--rights-owner",
        "benchmark-test-suite",
        "--json",
      ],
      { cwd: repositoryRoot, encoding: "utf8" },
    );

    assert.equal(result.status, 1);
    assert.match(result.stderr, /fail closed unless both --expected-brand and --expected-name/i);
    assert.equal(result.stdout, "");
    assert.doesNotMatch(result.stderr, new RegExp(onePixelPng.toString("base64")));
  } finally {
    rmSync(fixtureDirectory, { force: true, recursive: true });
  }
});

test("AI Cigar benchmark refuses remote manifest images instead of downloading third-party media", () => {
  const directory = mkdtempSync(join(tmpdir(), "ai-cigar-benchmark-remote-"));
  const manifestPath = join(directory, "manifest.json");
  writeFileSync(
    manifestPath,
    JSON.stringify({
      schemaVersion: 1,
      name: "remote media must be rejected",
      samples: [
        {
          id: "remote-photo",
          photoType: "real_photo",
          images: [{ path: "https://third-party.example/copyrighted-cigar.jpg", role: "band_front" }],
          expected: { brand: "Example", canonicalName: "Example Cigar Toro" },
          rights: { status: "licensed", owner: "Example", evidence: "license-record-123" },
        },
      ],
    }),
    "utf8",
  );

  try {
    const result = spawnSync(
      process.execPath,
      ["--import", "tsx", benchmarkScript, "--manifest", manifestPath, "--dry-run", "--json"],
      { cwd: repositoryRoot, encoding: "utf8" },
    );
    assert.equal(result.status, 1);
    assert.match(result.stderr, /must be a local file, not a remote URL/i);
    assert.equal(result.stdout, "");
  } finally {
    rmSync(directory, { force: true, recursive: true });
  }
});

test("AI Cigar benchmark rejects corrupt local image structures during dry-run", () => {
  const fixture = createManifestFixture();
  writeFileSync(fixture.imagePath, Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  try {
    const result = spawnSync(
      process.execPath,
      ["--import", "tsx", benchmarkScript, "--manifest", fixture.manifestPath, "--dry-run", "--json"],
      { cwd: repositoryRoot, encoding: "utf8" },
    );
    assert.equal(result.status, 1);
    assert.match(result.stderr, /not a structurally valid PNG, JPEG, GIF, or WebP/i);
    assert.equal(result.stdout, "");
  } finally {
    fixture.cleanup();
  }
});

test("AI Cigar benchmark calculates ranked, selective, abstention, confidently-wrong, and latency metrics", () => {
  const results: BenchmarkSampleResult[] = [
    sampleResult({ id: "top-1-a", latencyMs: 10, top1Correct: true, top3Correct: true }),
    sampleResult({ id: "top-3-only", latencyMs: 20, top3Correct: true }),
    sampleResult({ id: "abstained", latencyMs: 30, abstained: true, identificationStatus: "insufficient_evidence" }),
    sampleResult({ id: "confidently-wrong", latencyMs: 40, confidentlyWrong: true }),
    sampleResult({ id: "top-1-b", latencyMs: 50, top1Correct: true, top3Correct: true }),
    sampleResult({
      id: "transport-error",
      outcome: "operational_error",
      latencyMs: 60,
      httpStatus: 503,
      identificationStatus: null,
      errorCode: "http_503",
    }),
  ];

  assert.deepEqual(calculateBenchmarkMetrics(results), {
    totalSamples: 6,
    evaluatedSamples: 5,
    operationalErrors: 1,
    operationalErrorRate: 0.1667,
    attemptedSamples: 4,
    selectionRate: 0.8,
    top1Correct: 2,
    top1Accuracy: 0.4,
    top3Correct: 3,
    top3Accuracy: 0.6,
    selectiveAccuracy: 0.5,
    abstentions: 1,
    abstentionRate: 0.2,
    confidentlyWrong: 1,
    confidentlyWrongRate: 0.2,
    latencyMs: { mean: 35, p50: 30, p95: 60, p99: 60, max: 60 },
  });
});

test("AI Cigar benchmark evaluates correct top-3 and confidently wrong top-1 independently", () => {
  const result = evaluateBenchmarkResponse(
    {
      id: "ranked-candidates",
      expected: {
        brand: "Padrón",
        canonicalName: "Padrón 1964 Anniversary Exclusivo Maduro",
        acceptedNames: [],
      },
    },
    {
      statusCode: 200,
      body: {
        identificationStatus: "ambiguous",
        candidates: [
          {
            name: "Padrón 1926 Serie No. 35 Maduro",
            confidence: "high",
            matchScore: 91,
          },
          {
            name: "Padrón 1964 Anniversary Exclusivo Natural",
            confidence: "medium",
            matchScore: 86,
          },
          {
            name: "Padrón 1964 Anniversary Exclusivo Maduro",
            confidence: "medium",
            matchScore: 83,
          },
        ],
      },
    },
    125.45,
  );

  assert.equal(result.top1Correct, false);
  assert.equal(result.top3Correct, true);
  assert.equal(result.abstained, false);
  assert.equal(result.confidentlyWrong, true);
  assert.equal(result.latencyMs, 125.5);
});

test("AI Cigar benchmark live endpoint execution reports metrics but never emits auth, images, or raw provider data", async () => {
  const fixture = createManifestFixture({
    gates: {
      minTop1Accuracy: 1,
      minTop3Accuracy: 1,
      minSelectiveAccuracy: 1,
      maxAbstentionRate: 0,
      maxConfidentlyWrongRate: 0,
      maxP95LatencyMs: 10_000,
    },
  });
  const authToken = "benchmark-auth-token-must-never-leak";
  let receivedAuthorization = "";
  let receivedBody: Record<string, unknown> | null = null;
  const server = createServer((request, response) => {
    const chunks: Buffer[] = [];
    receivedAuthorization = String(request.headers.authorization || "");
    request.on("data", (chunk: Buffer) => chunks.push(chunk));
    request.on("end", () => {
      receivedBody = JSON.parse(Buffer.concat(chunks).toString("utf8")) as Record<string, unknown>;
      response.writeHead(200, { "content-type": "application/json" });
      response.end(
        JSON.stringify({
          identificationStatus: "identified",
          candidates: [
            {
              name: "Padrón 1964 Anniversary Exclusivo Maduro",
              brand: "Padrón",
              line: "1964 Anniversary",
              vitola: "Exclusivo",
              wrapper: "Maduro",
              confidence: "high",
              matchScore: 97,
            },
          ],
          usage: { privateMarker: "MODEL_TOKEN_USAGE_SHOULD_NOT_LEAK" },
          debug: "RAW_PROVIDER_RESPONSE_SHOULD_NOT_LEAK",
        }),
      );
    });
  });

  await new Promise<void>((resolveListen, rejectListen) => {
    server.once("error", rejectListen);
    server.listen(0, "127.0.0.1", () => resolveListen());
  });

  try {
    const address = server.address();
    assert.ok(address && typeof address === "object");
    const { stdout, stderr } = await runBenchmarkCli(
      [
        "--manifest",
        fixture.manifestPath,
        "--live",
        "--transport",
        "endpoint",
        "--endpoint",
        `http://127.0.0.1:${address.port}/humidor/identify-cigar?privateQuery=must-not-be-reported`,
        "--json",
      ],
      { YCC_AI_CIGAR_BENCHMARK_TOKEN: authToken },
    );

    assert.equal(stderr, "");
    assert.equal(receivedAuthorization, `Bearer ${authToken}`);
    const endpointRequest = receivedBody as unknown as Record<string, unknown>;
    assert.ok(endpointRequest);
    const images = endpointRequest.images as Array<{ imageBase64: string; mimeType: string; role: string }>;
    assert.equal(images.length, 1);
    assert.equal(images[0].imageBase64, onePixelPng.toString("base64"));
    assert.equal(images[0].mimeType, "image/png");
    assert.equal(images[0].role, "band_front");

    const report = JSON.parse(stdout) as {
      execution: { target: string };
      results: Array<BenchmarkSampleResult>;
      metrics: ReturnType<typeof calculateBenchmarkMetrics>;
      gates: { passed: boolean };
    };
    assert.doesNotMatch(report.execution.target, /privateQuery/);
    assert.equal(report.results[0].top1Correct, true);
    assert.equal(report.results[0].top3Correct, true);
    assert.equal(report.results[0].confidentlyWrong, false);
    assert.equal(report.metrics.top1Accuracy, 1);
    assert.equal(report.metrics.top3Accuracy, 1);
    assert.equal(report.metrics.selectiveAccuracy, 1);
    assert.equal(report.metrics.abstentionRate, 0);
    assert.equal(report.metrics.confidentlyWrongRate, 0);
    assert.equal(report.gates.passed, true);
    assert.doesNotMatch(stdout, new RegExp(authToken));
    assert.doesNotMatch(stdout, new RegExp(onePixelPng.toString("base64")));
    assert.doesNotMatch(stdout, /MODEL_TOKEN_USAGE_SHOULD_NOT_LEAK/);
    assert.doesNotMatch(stdout, /RAW_PROVIDER_RESPONSE_SHOULD_NOT_LEAK/);
    assert.doesNotMatch(stdout, /imageBase64/);
  } finally {
    await new Promise<void>((resolveClose) => server.close(() => resolveClose()));
    fixture.cleanup();
  }
});

function createManifestFixture(overrides: { gates?: Record<string, number> } = {}) {
  const directory = mkdtempSync(join(tmpdir(), "ai-cigar-real-photo-benchmark-"));
  const imagePath = join(directory, "owned-padron-sample.png");
  const manifestPath = join(directory, "manifest.json");
  writeFileSync(imagePath, onePixelPng);
  writeFileSync(
    manifestPath,
    JSON.stringify({
      schemaVersion: 1,
      name: "owned real-photo benchmark test",
      gates: overrides.gates,
      samples: [
        {
          id: "owned-padron-1964",
          photoType: "real_photo",
          images: [{ path: "owned-padron-sample.png", role: "band_front" }],
          expected: {
            brand: "Padrón",
            canonicalName: "Padrón 1964 Anniversary Exclusivo Maduro",
            acceptedNames: ["Padron 1964 Anniversary Exclusivo Maduro"],
          },
          rights: {
            status: "owned",
            owner: "benchmark-test-suite",
          },
        },
      ],
    }),
    "utf8",
  );

  return {
    imagePath,
    manifestPath,
    cleanup: () => rmSync(directory, { force: true, recursive: true }),
  };
}

function runBenchmarkCli(args: string[], extraEnvironment: Record<string, string> = {}) {
  return new Promise<{ stdout: string; stderr: string }>((resolveRun, rejectRun) => {
    execFile(
      process.execPath,
      ["--import", "tsx", benchmarkScript, ...args],
      {
        cwd: repositoryRoot,
        encoding: "utf8",
        env: { ...process.env, ...extraEnvironment },
        maxBuffer: 4 * 1024 * 1024,
        timeout: 30_000,
      },
      (error, stdout, stderr) => {
        if (error) {
          rejectRun(new Error(`benchmark CLI failed (${error.message}): ${stderr}`));
          return;
        }
        resolveRun({ stdout, stderr });
      },
    );
  });
}

function sampleResult(overrides: Partial<BenchmarkSampleResult>): BenchmarkSampleResult {
  return {
    id: "sample",
    outcome: "evaluated",
    latencyMs: 1,
    httpStatus: 200,
    identificationStatus: "ambiguous",
    expectedName: "Expected Cigar",
    topCandidateName: "Wrong Cigar",
    topCandidateConfidence: "medium",
    topCandidateMatchScore: 60,
    candidateCount: 3,
    top1Correct: false,
    top3Correct: false,
    abstained: false,
    confidentlyWrong: false,
    ...overrides,
  };
}
