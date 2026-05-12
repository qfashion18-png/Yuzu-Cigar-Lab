import { createRequire } from "node:module";
import assert from "node:assert/strict";
import test from "node:test";

const require = createRequire(import.meta.url);
const { handler } = require("../infra/lambda/ycc-api/index.js") as {
  handler: (event: Record<string, unknown>, context?: Record<string, unknown>) => Promise<{
    statusCode: number;
    headers: Record<string, string>;
    body: string;
  }>;
};

const baseHealthEvent = {
  routeKey: "GET /health",
  rawPath: "/health",
  requestContext: {
    requestId: "req-cors-health",
    http: { method: "GET", sourceIp: "198.51.100.42" },
  },
};

function withCorsEnv(
  values: { CORS_ALLOW_ORIGIN?: string; CORS_ALLOW_ORIGINS?: string },
  fn: () => Promise<void>
) {
  const previous = {
    CORS_ALLOW_ORIGIN: process.env.CORS_ALLOW_ORIGIN,
    CORS_ALLOW_ORIGINS: process.env.CORS_ALLOW_ORIGINS,
  };

  if (values.CORS_ALLOW_ORIGIN === undefined) {
    delete process.env.CORS_ALLOW_ORIGIN;
  } else {
    process.env.CORS_ALLOW_ORIGIN = values.CORS_ALLOW_ORIGIN;
  }

  if (values.CORS_ALLOW_ORIGINS === undefined) {
    delete process.env.CORS_ALLOW_ORIGINS;
  } else {
    process.env.CORS_ALLOW_ORIGINS = values.CORS_ALLOW_ORIGINS;
  }

  return fn().finally(() => {
    if (previous.CORS_ALLOW_ORIGIN === undefined) {
      delete process.env.CORS_ALLOW_ORIGIN;
    } else {
      process.env.CORS_ALLOW_ORIGIN = previous.CORS_ALLOW_ORIGIN;
    }

    if (previous.CORS_ALLOW_ORIGINS === undefined) {
      delete process.env.CORS_ALLOW_ORIGINS;
    } else {
      process.env.CORS_ALLOW_ORIGINS = previous.CORS_ALLOW_ORIGINS;
    }
  });
}

test("CORS echoes an allowed request origin when defaults are used", async () => {
  await withCorsEnv({}, async () => {
    const response = await handler({
      ...baseHealthEvent,
      headers: {
        origin: "https://www.yuzucigarclub.com",
      },
    });

    assert.equal(response.statusCode, 200);
    assert.equal(response.headers["access-control-allow-origin"], "https://www.yuzucigarclub.com");
  });
});

test("CORS falls back to the first configured origin when request origin is not allowed", async () => {
  await withCorsEnv(
    {
      CORS_ALLOW_ORIGINS: "https://app.yuzucigarclub.com,https://admin.yuzucigarclub.com",
    },
    async () => {
      const response = await handler({
        ...baseHealthEvent,
        headers: {
          origin: "https://unknown-origin.example",
        },
      });

      assert.equal(response.statusCode, 200);
      assert.equal(response.headers["access-control-allow-origin"], "https://app.yuzucigarclub.com");
    }
  );
});

test("CORS supports wildcard origin configuration", async () => {
  await withCorsEnv(
    {
      CORS_ALLOW_ORIGINS: "*",
    },
    async () => {
      const response = await handler({
        ...baseHealthEvent,
        headers: {
          origin: "https://preview.example.com",
        },
      });

      assert.equal(response.statusCode, 200);
      assert.equal(response.headers["access-control-allow-origin"], "https://preview.example.com");
    }
  );
});
