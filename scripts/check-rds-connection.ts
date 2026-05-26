import { loadEnvConfig } from "@next/env";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

import { describeDatabaseConfig, getDatabaseConfig } from "../src/lib/database/config";
import {
  closeNodePostgresPool,
  queryNodePostgres,
} from "../src/lib/database/pool";
import { getDatabaseHealthEndpoint, isDatabaseNetworkError } from "../src/lib/database/readiness";

loadEnvConfig(process.cwd());

const execFileAsync = promisify(execFile);

type ConnectionCheckRow = {
  current_database: string;
  current_user: string;
  server_version: string;
};

async function main() {
  const summary = describeDatabaseConfig(getDatabaseConfig());

  console.log(
    `Checking PostgreSQL ${summary.user}@${summary.host}:${summary.port}/${summary.database} ` +
      `(sslmode=${summary.sslMode}, sslrootcert=${summary.sslRootCert ?? "system trust"})`
  );

  const result = await queryNodePostgres<ConnectionCheckRow>(`
    select
      current_database() as current_database,
      current_user as current_user,
      version() as server_version
  `);
  const row = result.rows[0];

  console.log(`Connected as ${row.current_user} to ${row.current_database}.`);
  console.log(row.server_version);
}

async function checkApiHealthFallback(error: unknown) {
  const endpoint = getDatabaseHealthEndpoint();
  if (!endpoint || !isDatabaseNetworkError(error)) {
    throw error;
  }

  console.log("Direct database TCP is unavailable from this machine; checking private VPC reachability through the live API.");
  const health = await fetchApiHealth(endpoint);
  if (!health.ok || health.body?.status !== "ok" || health.body?.db?.proxyReachable !== true) {
    throw new Error(`API database health check failed with status ${health.status}: ${JSON.stringify(health.body)}`);
  }

  console.log(`API database health check passed via ${endpoint}.`);
}

async function fetchApiHealth(endpoint: string) {
  try {
    const response = await fetch(endpoint);
    return {
      ok: response.ok,
      status: response.status,
      body: await response.json(),
    };
  } catch (error) {
    if (process.platform !== "win32") {
      throw error;
    }

    console.log("Node HTTPS could not validate the API certificate locally; retrying with Windows system trust.");
    return fetchApiHealthWithWindowsSystemTrust(endpoint);
  }
}

async function fetchApiHealthWithWindowsSystemTrust(endpoint: string) {
  const command = [
    "$ProgressPreference = 'SilentlyContinue'",
    "$response = Invoke-WebRequest -UseBasicParsing -Uri $env:YCC_HEALTH_ENDPOINT",
    "@{ StatusCode = $response.StatusCode; Body = $response.Content } | ConvertTo-Json -Compress",
  ].join("; ");
  const { stdout } = await execFileAsync(
    "powershell.exe",
    ["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", command],
    {
      env: {
        ...process.env,
        YCC_HEALTH_ENDPOINT: endpoint,
      },
      timeout: 20000,
      windowsHide: true,
    }
  );
  const payload = JSON.parse(stdout) as { StatusCode?: number; Body?: string };
  return {
    ok: Number(payload.StatusCode) >= 200 && Number(payload.StatusCode) < 300,
    status: Number(payload.StatusCode) || 0,
    body: payload.Body ? JSON.parse(payload.Body) : null,
  };
}

main()
  .catch((error: unknown) => {
    return checkApiHealthFallback(error).catch((fallbackError: unknown) => {
      const message = fallbackError instanceof Error ? fallbackError.message : String(fallbackError);

      console.error(`Database connection check failed: ${message}`);
      process.exitCode = 1;
    });
  })
  .finally(async () => {
    await closeNodePostgresPool();
  });
