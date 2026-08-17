import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

test("cigar intelligence corpus builder inventories the catalog without claiming image readiness", () => {
  const scriptPath = fileURLToPath(new URL("../scripts/build-cigar-intelligence-corpus.ts", import.meta.url));
  const output = execFileSync(process.execPath, ["--import", "tsx", scriptPath, "--dry-run"], {
    encoding: "utf8",
    env: process.env,
  });
  const manifest = JSON.parse(output) as {
    productRecords: number;
    uniqueBrands: number;
    localCanonicalImages: number;
    productsMissingLocalCanonicalImage: number;
    readiness: { textRetrievalSeeded: boolean; multimodalCoverageReady: boolean; reason: string };
  };

  assert.ok(manifest.productRecords >= 800, "the generated text corpus should cover the broad cigar catalog");
  assert.ok(manifest.uniqueBrands >= 80, "the corpus should span many cigar brands");
  assert.ok(manifest.localCanonicalImages >= 40, "existing local catalog images should seed visual retrieval");
  assert.ok(manifest.productsMissingLocalCanonicalImage > 0, "the manifest should quantify remaining visual coverage gaps");
  assert.equal(manifest.readiness.textRetrievalSeeded, true);
  assert.equal(manifest.readiness.multimodalCoverageReady, false);
  assert.match(manifest.readiness.reason, /front\/back band and real-phone capture views/i);
});

test("cigar intelligence corpus metadata sidecars stay within the Bedrock 1024-byte limit", () => {
  const scriptPath = fileURLToPath(new URL("../scripts/build-cigar-intelligence-corpus.ts", import.meta.url));
  const outputDir = mkdtempSync(path.join(tmpdir(), "ycc-cigar-corpus-"));

  try {
    execFileSync(process.execPath, ["--import", "tsx", scriptPath, "--out", outputDir], {
      encoding: "utf8",
      env: process.env,
    });
    const metadataFiles = readdirSync(path.join(outputDir, "documents"), { withFileTypes: true })
      .filter((entry) => entry.isFile() && entry.name.endsWith(".metadata.json"))
      .map((entry) => path.join(outputDir, "documents", entry.name));

    assert.ok(metadataFiles.length >= 800);
    for (const metadataFile of metadataFiles) {
      const payload = readFileSync(metadataFile);
      assert.ok(payload.byteLength <= 1024, `${path.basename(metadataFile)} exceeds Bedrock's metadata limit`);
      const parsed = JSON.parse(payload.toString("utf8")) as { metadataAttributes?: Record<string, unknown> };
      assert.ok(parsed.metadataAttributes?.canonicalName);
      assert.ok(parsed.metadataAttributes?.sourceUrl);
      for (const attribute of Object.values(parsed.metadataAttributes || {})) {
        const value = (attribute as { value?: { stringValue?: unknown } }).value?.stringValue;
        assert.notEqual(value, "", `${path.basename(metadataFile)} contains an empty metadata string`);
      }
    }
  } finally {
    rmSync(outputDir, { recursive: true, force: true });
  }
});
