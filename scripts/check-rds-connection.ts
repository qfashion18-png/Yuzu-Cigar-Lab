import { loadEnvConfig } from "@next/env";

import { describeDatabaseConfig, getDatabaseConfig } from "../src/lib/database/config";
import {
  closeNodePostgresPool,
  queryNodePostgres,
} from "../src/lib/database/pool";
import { getDatabaseHealthEndpoint, isDatabaseNetworkError } from "../src/lib/database/readiness";

loadEnvConfig(process.cwd());

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
  const response = await fetch(endpoint);
  const body = await response.json();
  if (!response.ok || body?.status !== "ok" || body?.db?.proxyReachable !== true) {
    throw new Error(`API database health check failed with status ${response.status}: ${JSON.stringify(body)}`);
  }

  console.log(`API database health check passed via ${endpoint}.`);
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
