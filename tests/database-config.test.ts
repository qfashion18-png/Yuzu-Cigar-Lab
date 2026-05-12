import assert from "node:assert/strict";
import test from "node:test";

import {
  describeDatabaseConfig,
  getDatabaseConfig,
} from "../src/lib/database/config";

test("builds an RDS/Aurora config from discrete environment variables", () => {
  const config = getDatabaseConfig({
    RDS_HOST: "database-1.example.us-east-1.rds.amazonaws.com",
    RDS_USERNAME: "postgresycc",
    RDS_PASSWORD: "secret",
    RDS_SSLROOTCERT: "./global-bundle.pem",
  });

  assert.equal(config.host, "database-1.example.us-east-1.rds.amazonaws.com");
  assert.equal(config.port, 5432);
  assert.equal(config.database, "postgres");
  assert.equal(config.user, "postgresycc");
  assert.equal(config.password, "secret");
  assert.equal(config.sslMode, "verify-full");
  assert.equal(config.sslRootCert, "./global-bundle.pem");
  assert.equal(config.source, "discrete");
});

test("supports psql-compatible PG aliases", () => {
  const config = getDatabaseConfig({
    PGHOST: "database-1.example.us-east-1.rds.amazonaws.com",
    PGPORT: "15432",
    PGDATABASE: "yuzu",
    PGUSER: "postgresycc",
    PGPASSWORD: "secret",
    PGSSLMODE: "require",
    PGSSLROOTCERT: "./rds.pem",
  });

  assert.equal(config.host, "database-1.example.us-east-1.rds.amazonaws.com");
  assert.equal(config.port, 15432);
  assert.equal(config.database, "yuzu");
  assert.equal(config.user, "postgresycc");
  assert.equal(config.sslMode, "require");
  assert.equal(config.sslRootCert, "./rds.pem");
});

test("prefers DATABASE_URL while preserving RDS TLS defaults", () => {
  const config = getDatabaseConfig({
    DATABASE_URL: "postgresql://postgresycc:secret@database-1.example.us-east-1.rds.amazonaws.com:5432/postgres",
    RDS_SSLROOTCERT: "./global-bundle.pem",
  });

  assert.equal(config.connectionString?.startsWith("postgresql://"), true);
  assert.equal(config.host, "database-1.example.us-east-1.rds.amazonaws.com");
  assert.equal(config.port, 5432);
  assert.equal(config.database, "postgres");
  assert.equal(config.sslMode, "verify-full");
  assert.equal(config.sslRootCert, "./global-bundle.pem");
  assert.equal(config.source, "DATABASE_URL");
});

test("summarizes the database target without exposing credentials", () => {
  const summary = describeDatabaseConfig(
    getDatabaseConfig({
      RDS_HOST: "database-1.example.us-east-1.rds.amazonaws.com",
      RDS_USERNAME: "postgresycc",
      RDS_PASSWORD: "secret",
    })
  );

  assert.deepEqual(summary, {
    source: "discrete",
    host: "database-1.example.us-east-1.rds.amazonaws.com",
    port: 5432,
    database: "postgres",
    user: "postgresycc",
    sslMode: "verify-full",
    sslRootCert: null,
    hasPassword: true,
  });
});

test("throws a focused error when required database settings are missing", () => {
  assert.throws(
    () =>
      getDatabaseConfig({
        RDS_HOST: "database-1.example.us-east-1.rds.amazonaws.com",
      }),
    /Missing database environment variables: RDS_USERNAME\/PGUSER, RDS_PASSWORD\/PGPASSWORD/
  );
});
