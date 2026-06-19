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

function setProcessEnvValue(key: string, value: string | undefined) {
  const env = process.env as Record<string, string | undefined>;
  if (value === undefined) {
    delete env[key];
  } else {
    env[key] = value;
  }
}

function withCorsEnv(
  values: {
    BASE_URL?: string;
    CORS_ALLOW_ORIGIN?: string;
    CORS_ALLOW_ORIGINS?: string;
    NEXT_PUBLIC_BASE_URL?: string;
    NODE_ENV?: string;
    PUBLIC_SITE_URL?: string;
  },
  fn: () => Promise<void>
) {
  const previous = {
    BASE_URL: process.env.BASE_URL,
    CORS_ALLOW_ORIGIN: process.env.CORS_ALLOW_ORIGIN,
    CORS_ALLOW_ORIGINS: process.env.CORS_ALLOW_ORIGINS,
    NEXT_PUBLIC_BASE_URL: process.env.NEXT_PUBLIC_BASE_URL,
    NODE_ENV: process.env.NODE_ENV,
    PUBLIC_SITE_URL: process.env.PUBLIC_SITE_URL,
  };

  for (const key of Object.keys(previous) as Array<keyof typeof previous>) {
    setProcessEnvValue(key, values[key]);
  }

  return fn().finally(() => {
    for (const [key, value] of Object.entries(previous)) {
      setProcessEnvValue(key, value);
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

test("CORS ignores wildcard origin configuration in production runtime", async () => {
  await withCorsEnv(
    {
      CORS_ALLOW_ORIGINS: "*",
      PUBLIC_SITE_URL: "https://www.yuzucigarclub.com",
    },
    async () => {
      const response = await handler({
        ...baseHealthEvent,
        headers: {
          origin: "https://preview.example.com",
        },
      });

      assert.equal(response.statusCode, 200);
      assert.equal(response.headers["access-control-allow-origin"], "https://yuzucigarclub.com");
    }
  );
});
