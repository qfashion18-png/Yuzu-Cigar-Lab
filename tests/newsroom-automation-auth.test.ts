import assert from "node:assert/strict";
import test from "node:test";

import { resolveNewsroomAutomationAuth } from "../src/lib/newsroom-automation-auth";

const cognitoEnv = {
  NEXT_PUBLIC_COGNITO_HOSTED_UI_BASE: "https://ycc-members-374587466106.auth.us-east-1.amazoncognito.com",
  NEXT_PUBLIC_COGNITO_USER_POOL_CLIENT_ID: "2i2nvtt41l94n0mivc4tu4f9ms",
  NEXT_PUBLIC_COGNITO_ISSUER: "https://cognito-idp.us-east-1.amazonaws.com/us-east-1_63U9PflAX",
  NEXT_PUBLIC_YCC_API_BASE_URL: "https://13710cp67l.execute-api.us-east-1.amazonaws.com",
};

test("newsroom automation auth signs in through Cognito when service-account credentials are configured", async () => {
  const idToken = createJwt({
    sub: "operator-123",
    email: "codex-newsroom-operator@yuzucigarclub.com",
    name: "Codex Newsroom Operator",
    "cognito:groups": ["concierge_operator"],
    exp: 1_900_000_000,
    iat: 1_800_000_000,
  });
  const accessToken = createJwt({ sub: "operator-123", exp: 1_900_000_000 });
  let requestedUrl = "";
  let requestedInit: RequestInit | undefined;

  const auth = await resolveNewsroomAutomationAuth(
    {
      ...cognitoEnv,
      YCC_NEWSROOM_COGNITO_USERNAME: "codex-newsroom-operator@yuzucigarclub.com",
      YCC_NEWSROOM_COGNITO_PASSWORD: "Secret123!",
      YCC_NEWSROOM_BEARER_TOKEN: "stale-bearer-should-not-win",
    },
    async (url: string, init: RequestInit) => {
      requestedUrl = url;
      requestedInit = init;

      return {
        ok: true,
        async json() {
          return {
            AuthenticationResult: {
              IdToken: idToken,
              AccessToken: accessToken,
              RefreshToken: "refresh-token-123",
              ExpiresIn: 3600,
              TokenType: "Bearer",
            },
          };
        },
      };
    },
  );

  assert.equal(requestedUrl, "https://cognito-idp.us-east-1.amazonaws.com/");
  assert.equal(requestedInit?.method, "POST");
  assert.equal(auth.source, "cognito_password");
  assert.equal(auth.username, "codex-newsroom-operator@yuzucigarclub.com");
  assert.match(auth.authorizationHeader, /^Bearer /);
  assert.ok(auth.expiresAt);
});

test("newsroom automation auth falls back to a configured bearer token", async () => {
  const auth = await resolveNewsroomAutomationAuth({
    YCC_NEWSROOM_BEARER_TOKEN: "plain-bearer-token",
  });

  assert.deepEqual(auth, {
    authorizationHeader: "Bearer plain-bearer-token",
    source: "bearer_env",
    expiresAt: null,
    username: null,
  });
});

test("newsroom automation auth uses bearer fallback when Cognito sign-in fails", async () => {
  const auth = await resolveNewsroomAutomationAuth(
    {
      ...cognitoEnv,
      YCC_NEWSROOM_COGNITO_USERNAME: "codex-newsroom-operator@yuzucigarclub.com",
      YCC_NEWSROOM_COGNITO_PASSWORD: "expired-password",
      YCC_NEWSROOM_BEARER_TOKEN: "fresh-bearer-token",
    },
    async () => ({
      ok: false,
      async json() {
        return {
          __type: "NotAuthorizedException",
          message: "Incorrect username or password.",
        };
      },
    }),
  );

  assert.deepEqual(auth, {
    authorizationHeader: "Bearer fresh-bearer-token",
    source: "bearer_env",
    expiresAt: null,
    username: null,
  });
});

test("newsroom automation auth requires both Cognito username and password", async () => {
  await assert.rejects(
    () =>
      resolveNewsroomAutomationAuth({
        ...cognitoEnv,
        YCC_NEWSROOM_COGNITO_USERNAME: "codex-newsroom-operator@yuzucigarclub.com",
      }),
    /Set both YCC_NEWSROOM_COGNITO_USERNAME and YCC_NEWSROOM_COGNITO_PASSWORD/i,
  );
});

test("newsroom automation auth surfaces Cognito sign-in failures clearly", async () => {
  await assert.rejects(
    () =>
      resolveNewsroomAutomationAuth(
        {
          ...cognitoEnv,
          YCC_NEWSROOM_COGNITO_USERNAME: "codex-newsroom-operator@yuzucigarclub.com",
          YCC_NEWSROOM_COGNITO_PASSWORD: "wrong-password",
        },
        async () => ({
          ok: false,
          async json() {
            return {
              __type: "NotAuthorizedException",
              message: "Incorrect username or password.",
            };
          },
        }),
      ),
    /Cognito newsroom sign-in failed: Incorrect username or password\./i,
  );
});

function createJwt(payload: Record<string, unknown>) {
  const header = { alg: "none", typ: "JWT" };
  return `${toBase64Url(header)}.${toBase64Url(payload)}.signature`;
}

function toBase64Url(value: unknown) {
  return Buffer.from(JSON.stringify(value))
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}
