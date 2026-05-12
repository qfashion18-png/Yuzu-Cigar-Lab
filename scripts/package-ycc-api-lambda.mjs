import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptPath = fileURLToPath(import.meta.url);
const workspace = resolve(scriptPath, "..", "..");
const outputRoot = join(workspace, "output");
const label = sanitizeLabel(process.argv[2] || `ycc-api-lambda-${new Date().toISOString().replace(/[:.]/g, "").slice(0, 15)}`);
const stageDir = join(outputRoot, label);
const zipPath = `${stageDir}.zip`;

const lambdaFiles = [
  ["infra/lambda/ycc-api/index.js", "index.js"],
  ["infra/lambda/ycc-api/commerce-rules.js", "commerce-rules.js"],
  ["infra/lambda/ycc-api/stripe-commerce.js", "stripe-commerce.js"],
  ["global-bundle.pem", "global-bundle.pem"],
];

const migrationFiles = [
  "0001_phase3_app_schema.sql",
  "0002_commerce_schema.sql",
  "0003_site_content_schema.sql",
  "0004_newsroom_schema.sql",
];

const lambdaDependencies = [
  "@aws-sdk/client-bedrock-agent-runtime",
  "@aws-sdk/client-bedrock-runtime",
  "@aws-sdk/client-polly",
  "@aws-sdk/client-s3",
  "@aws-sdk/client-secrets-manager",
  "@aws-sdk/client-sesv2",
  "@aws-sdk/client-transcribe",
  "pg",
  "stripe",
];

main();

function main() {
  ensureInsideOutput(stageDir);
  ensureInsideOutput(zipPath);

  mkdirSync(outputRoot, { recursive: true });
  rmSync(stageDir, { recursive: true, force: true });
  rmSync(zipPath, { force: true });
  mkdirSync(join(stageDir, "migrations"), { recursive: true });

  for (const [source, target] of lambdaFiles) {
    copyRequired(join(workspace, source), join(stageDir, target));
  }

  for (const migrationFile of migrationFiles) {
    copyRequired(
      join(workspace, "infra", "database", "migrations", migrationFile),
      join(stageDir, "migrations", migrationFile),
    );
  }

  writeLambdaPackageJson();
  installProductionDependencies();
  validateStage();
  zipStage();

  const sha256 = createHash("sha256").update(readFileSync(zipPath)).digest("base64");
  console.log(JSON.stringify({ zipPath, codeSha256: sha256 }, null, 2));
}

function writeLambdaPackageJson() {
  const rootPackage = JSON.parse(readFileSync(join(workspace, "package.json"), "utf8"));
  const dependencies = {};
  for (const dependency of lambdaDependencies) {
    const version = rootPackage.dependencies?.[dependency];
    if (!version) {
      throw new Error(`Missing Lambda dependency in root package.json: ${dependency}`);
    }

    dependencies[dependency] = version;
  }

  writeFileSync(
    join(stageDir, "package.json"),
    `${JSON.stringify({ private: true, dependencies }, null, 2)}\n`,
    "utf8",
  );
}

function installProductionDependencies() {
  const result = spawnSync("npm", ["install", "--omit=dev", "--no-audit", "--no-fund", "--package-lock=false"], {
    cwd: stageDir,
    encoding: "utf8",
    shell: process.platform === "win32",
    stdio: "inherit",
  });

  if (result.status !== 0) {
    throw new Error(`npm install failed while preparing ${stageDir}`);
  }
}

function validateStage() {
  const requiredEntries = [
    "index.js",
    "commerce-rules.js",
    "stripe-commerce.js",
    "global-bundle.pem",
    ...migrationFiles.map((file) => `migrations/${file}`),
    "node_modules/pg/package.json",
    "node_modules/stripe/package.json",
    "node_modules/@aws-sdk/client-secrets-manager/package.json",
  ];
  const missing = requiredEntries.filter((entry) => !existsSync(join(stageDir, ...entry.split("/"))));

  if (missing.length) {
    throw new Error(`Lambda package stage is missing required entries: ${missing.join(", ")}`);
  }
}

function zipStage() {
  const python = findPythonCommand();
  const script = [
    "import pathlib, sys, zipfile",
    "stage = pathlib.Path(sys.argv[1])",
    "zip_path = pathlib.Path(sys.argv[2])",
    "with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_DEFLATED) as archive:",
    "    for path in sorted(stage.rglob('*')):",
    "        if path.is_file():",
    "            archive.write(path, path.relative_to(stage).as_posix())",
  ].join("\n");
  const result = spawnSync(python, ["-c", script, stageDir, zipPath], {
    cwd: workspace,
    encoding: "utf8",
    stdio: "inherit",
  });

  if (result.status !== 0) {
    throw new Error(`Python zipfile packaging failed for ${stageDir}`);
  }
}

function findPythonCommand() {
  for (const candidate of ["python", "python3", "py"]) {
    const result = spawnSync(candidate, ["--version"], {
      encoding: "utf8",
      shell: process.platform === "win32",
    });

    if (result.status === 0) {
      return candidate;
    }
  }

  throw new Error("Python is required to create a forward-slash Lambda zip archive.");
}

function copyRequired(source, target) {
  if (!existsSync(source)) {
    throw new Error(`Required Lambda package source is missing: ${source}`);
  }

  cpSync(source, target, { recursive: true });
}

function ensureInsideOutput(targetPath) {
  const resolvedOutput = `${resolve(outputRoot)}${process.platform === "win32" ? "\\" : "/"}`;
  const resolvedTarget = resolve(targetPath);

  if (!resolvedTarget.startsWith(resolvedOutput)) {
    throw new Error(`Refusing to write outside output directory: ${targetPath}`);
  }
}

function sanitizeLabel(value) {
  const sanitized = String(value)
    .trim()
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "");

  if (!sanitized || sanitized === "." || sanitized === ".." || sanitized.includes("..")) {
    throw new Error(`Invalid Lambda package label: ${value}`);
  }

  return sanitized;
}
