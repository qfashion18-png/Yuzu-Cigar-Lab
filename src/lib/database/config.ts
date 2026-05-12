export type DatabaseConfigSource = "DATABASE_URL" | "discrete";

export type DatabaseConfig = {
  source: DatabaseConfigSource;
  connectionString: string | null;
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
  sslMode: string;
  sslRootCert: string | null;
  applicationName: string;
};

export type DatabaseConfigSummary = Omit<DatabaseConfig, "applicationName" | "connectionString" | "password"> & {
  hasPassword: boolean;
};

type DatabaseEnv = Record<string, string | undefined>;

export function getDatabaseConfig(env: DatabaseEnv = process.env): DatabaseConfig {
  if (env.DATABASE_URL) {
    return getDatabaseUrlConfig(env);
  }

  return getDiscreteDatabaseConfig(env);
}

export function describeDatabaseConfig(config: DatabaseConfig): DatabaseConfigSummary {
  return {
    source: config.source,
    host: config.host,
    port: config.port,
    database: config.database,
    user: config.user,
    sslMode: config.sslMode,
    sslRootCert: config.sslRootCert,
    hasPassword: Boolean(config.password),
  };
}

function getDatabaseUrlConfig(env: DatabaseEnv): DatabaseConfig {
  const connectionString = requireValue(env.DATABASE_URL, "DATABASE_URL");
  const url = new URL(connectionString);

  return {
    source: "DATABASE_URL",
    connectionString,
    host: url.hostname,
    port: parsePort(url.port, 5432),
    database: decodeURIComponent(url.pathname.replace(/^\//, "")) || "postgres",
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    sslMode: getFirstValue(env.RDS_SSLMODE, env.PGSSLMODE, url.searchParams.get("sslmode")) || "verify-full",
    sslRootCert: getFirstValue(env.RDS_SSLROOTCERT, env.PGSSLROOTCERT, url.searchParams.get("sslrootcert")) || null,
    applicationName: getApplicationName(env),
  };
}

function getDiscreteDatabaseConfig(env: DatabaseEnv): DatabaseConfig {
  const host = getFirstValue(env.RDS_HOST, env.PGHOST);
  const user = getFirstValue(env.RDS_USERNAME, env.PGUSER);
  const password = getFirstValue(env.RDS_PASSWORD, env.PGPASSWORD);

  if (!host || !user || !password) {
    const missing: string[] = [];

    if (!host) {
      missing.push("RDS_HOST/PGHOST");
    }

    if (!user) {
      missing.push("RDS_USERNAME/PGUSER");
    }

    if (!password) {
      missing.push("RDS_PASSWORD/PGPASSWORD");
    }

    throw new Error(`Missing database environment variables: ${missing.join(", ")}`);
  }

  return {
    source: "discrete",
    connectionString: null,
    host: host,
    port: parsePort(getFirstValue(env.RDS_PORT, env.PGPORT), 5432),
    database: getFirstValue(env.RDS_DATABASE, env.PGDATABASE) || "postgres",
    user: user,
    password: password,
    sslMode: getFirstValue(env.RDS_SSLMODE, env.PGSSLMODE) || "verify-full",
    sslRootCert: getFirstValue(env.RDS_SSLROOTCERT, env.PGSSLROOTCERT) || null,
    applicationName: getApplicationName(env),
  };
}

function getApplicationName(env: DatabaseEnv) {
  return getFirstValue(env.PGAPPNAME, env.RDS_APPLICATION_NAME, env.DATABASE_APPLICATION_NAME) || "yuzu-cigar-club";
}

function getFirstValue(...values: Array<string | null | undefined>) {
  return values.find((value) => typeof value === "string" && value.trim().length > 0)?.trim();
}

function requireValue(value: string | undefined, label: string) {
  if (!value) {
    throw new Error(`Missing database environment variables: ${label}`);
  }

  return value;
}

function parsePort(value: string | undefined, fallback: number) {
  if (!value) {
    return fallback;
  }

  const port = Number(value);

  if (!Number.isInteger(port) || port <= 0 || port > 65535) {
    throw new Error(`Invalid database port: ${value}`);
  }

  return port;
}
