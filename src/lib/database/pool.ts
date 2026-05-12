import { readFileSync } from "node:fs";
import { isAbsolute, resolve } from "node:path";

import { Pool, type PoolConfig, type QueryResultRow } from "pg";

import { getDatabaseConfig, type DatabaseConfig } from "@/lib/database/config";

let pool: Pool | null = null;

export function getNodePostgresPool() {
  if (!pool) {
    pool = new Pool(toPgPoolConfig(getDatabaseConfig()));
  }

  return pool;
}

export async function queryNodePostgres<T extends QueryResultRow = QueryResultRow>(
  text: string,
  values?: unknown[]
) {
  return getNodePostgresPool().query<T>(text, values);
}

export async function closeNodePostgresPool() {
  if (!pool) {
    return;
  }

  await pool.end();
  pool = null;
}

export function toPgPoolConfig(config: DatabaseConfig): PoolConfig {
  const poolConfig: PoolConfig = {
    application_name: config.applicationName,
    connectionTimeoutMillis: 10_000,
    database: config.database,
    host: config.host,
    password: config.password,
    port: config.port,
    ssl: toPgSslConfig(config),
    user: config.user,
  };

  if (config.connectionString) {
    poolConfig.connectionString = config.connectionString;
  }

  return poolConfig;
}

function toPgSslConfig(config: DatabaseConfig): PoolConfig["ssl"] {
  if (config.sslMode === "disable") {
    return false;
  }

  const ca = config.sslRootCert ? readRootCert(config.sslRootCert) : undefined;

  return {
    ca,
    rejectUnauthorized: true,
  };
}

function readRootCert(path: string) {
  const certPath = isAbsolute(path) ? path : resolve(process.cwd(), path);

  return readFileSync(certPath, "utf8");
}
