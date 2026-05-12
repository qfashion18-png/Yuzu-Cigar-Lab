import assert from "node:assert/strict";
import test from "node:test";

import {
  buildCognitoAuthorizeUrl,
  buildCognitoLogoutUrl,
  buildCognitoPasswordAuthRequest,
  buildCognitoTokenRequestBody,
  createCognitoApiHeaders,
  createCognitoSessionFromTokens,
  getCognitoTokenResponse,
  resolveCognitoConfig,
  shouldShowInlineCognitoSignIn,
  signInWithCognitoPassword,
  updateCognitoSessionProfile,
} from "../src/lib/cognito-auth";

const config = {
  hostedUiBase: "https://ycc-members-374587466106.auth.us-east-1.amazoncognito.com",
  clientId: "2i2nvtt41l94n0mivc4tu4f9ms",
  issuer: "https://cognito-idp.us-east-1.amazonaws.com/us-east-1_63U9PflAX",
  apiBaseUrl: "https://13710cp67l.execute-api.us-east-1.amazonaws.com",
  redirectPath: "/auth/callback",
  logoutPath: "/auth/logout",
  scopes: ["openid", "email", "profile"],
};

test("Cognito hosted UI authorize URL uses code flow with PKCE and the current origin", () => {
  const url = new URL(
    buildCognitoAuthorizeUrl(config, {
      origin: "https://staging.d2yxcklt245wh0.amplifyapp.com",
      state: "state-123",
      codeChallenge: "challenge-123",
    })
  );

  assert.equal(url.origin, config.hostedUiBase);
  assert.equal(url.pathname, "/oauth2/authorize");
  assert.equal(url.searchParams.get("client_id"), config.clientId);
  assert.equal(url.searchParams.get("response_type"), "code");
  assert.equal(url.searchParams.get("redirect_uri"), "https://staging.d2yxcklt245wh0.amplifyapp.com/auth/callback");
  assert.equal(url.searchParams.get("scope"), "openid email profile");
  assert.equal(url.searchParams.get("state"), "state-123");
  assert.equal(url.searchParams.get("code_challenge"), "challenge-123");
  assert.equal(url.searchParams.get("code_challenge_method"), "S256");
});

test("Cognito token request exchanges the code with PKCE and no client secret", () => {
  const body = buildCognitoTokenRequestBody(config, {
    code: "auth-code-123",
    codeVerifier: "verifier-123",
    redirectUri: "https://www.yuzucigarclub.com/auth/callback",
  });

  assert.equal(body.get("grant_type"), "authorization_code");
  assert.equal(body.get("client_id"), config.clientId);
  assert.equal(body.get("code"), "auth-code-123");
  assert.equal(body.get("code_verifier"), "verifier-123");
  assert.equal(body.get("redirect_uri"), "https://www.yuzucigarclub.com/auth/callback");
  assert.equal(body.has("client_secret"), false);
});

test("Cognito token response parser accepts Hosted UI OAuth token payloads", () => {
  assert.deepEqual(
    getCognitoTokenResponse({
      id_token: "id-token-123",
      access_token: "access-token-123",
      refresh_token: "refresh-token-123",
      expires_in: 3600,
      token_type: "Bearer",
    }),
    {
      id_token: "id-token-123",
      access_token: "access-token-123",
      refresh_token: "refresh-token-123",
      expires_in: 3600,
      token_type: "Bearer",
    }
  );
});

test("Cognito password auth uses InitiateAuth without leaving the app", () => {
  const request = buildCognitoPasswordAuthRequest(config, {
    username: " member@yuzucigarclub.com ",
    password: "Secret123!",
  });
  const body = JSON.parse(String(request.init.body));

  assert.equal(request.url, "https://cognito-idp.us-east-1.amazonaws.com/");
  assert.equal(request.init.method, "POST");
  assert.deepEqual(request.init.headers, {
    "content-type": "application/x-amz-json-1.1",
    "x-amz-target": "AWSCognitoIdentityProviderService.InitiateAuth",
  });
  assert.deepEqual(body, {
    AuthFlow: "USER_PASSWORD_AUTH",
    ClientId: config.clientId,
    AuthParameters: {
      USERNAME: "member@yuzucigarclub.com",
      PASSWORD: "Secret123!",
    },
  });
});

test("Cognito password auth stores a storefront session from AuthenticationResult", async () => {
  const idToken = createJwt({
    sub: "member-123",
    email: "member@yuzucigarclub.com",
    name: "Yuzu Member",
    phone_number: "+16025550101",
    "cognito:groups": ["member", "sensei"],
    "custom:membership_tier": "Sensei",
    "custom:member_status": "member",
    exp: 1_900_000_000,
    iat: 1_800_000_000,
  });
  const accessToken = createJwt({ sub: "member-123", exp: 1_900_000_000 });
  let requestedUrl = "";
  let requestedInit: RequestInit | undefined;
  const fetchImpl = async (url: string, init: RequestInit) => {
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
  };

  const result = await signInWithCognitoPassword(
    config,
    { username: "member@yuzucigarclub.com", password: "Secret123!" },
    fetchImpl,
    1_800_000_000_000
  );

  assert.equal(requestedUrl, "https://cognito-idp.us-east-1.amazonaws.com/");
  assert.equal(requestedInit?.method, "POST");
  assert.equal(result.status, "signed_in");

  if (result.status !== "signed_in") {
    throw new Error("Expected signed_in result");
  }

  assert.equal(result.session.user.email, "member@yuzucigarclub.com");
  assert.equal(result.session.user.phone, "+16025550101");
  assert.equal(result.session.user.membership.tier, "Sensei");
  assert.equal(result.session.tokens.refreshToken, "refresh-token-123");
});

test("Cognito password auth surfaces service errors without changing screens", async () => {
  const result = await signInWithCognitoPassword(
    config,
    { username: "member@yuzucigarclub.com", password: "wrong-password" },
    async () => ({
      ok: false,
      async json() {
        return {
          __type: "NotAuthorizedException",
          message: "Incorrect username or password.",
        };
      },
    })
  );

  assert.equal(result.status, "error");
  assert.equal(result.message, "Incorrect username or password.");
});

test("Cognito password auth explains when the app client blocks in-app sign-in", async () => {
  const result = await signInWithCognitoPassword(
    config,
    { username: "member@yuzucigarclub.com", password: "Secret123!" },
    async () => ({
      ok: false,
      async json() {
        return {
          message: "USER_PASSWORD_AUTH flow not enabled for this client",
        };
      },
    })
  );

  assert.equal(result.status, "error");
  assert.equal(
    result.message,
    "Cognito is not configured for in-app sign-in yet. Enable USER_PASSWORD_AUTH on the app client and try again."
  );
});

test("Cognito session maps JWT claims to the storefront auth view", () => {
  const idToken = createJwt({
    sub: "admin-123",
    email: "admin@yuzucigarclub.com",
    name: "Yuzu Admin",
    phone_number: "+14805550188",
    "cognito:groups": ["admin", "concierge_operator", "daimyo"],
    "custom:membership_tier": "Daimyo",
    "custom:member_status": "member",
    exp: 1_900_000_000,
    iat: 1_800_000_000,
  });
  const accessToken = createJwt({
    sub: "admin-123",
    client_id: config.clientId,
    scope: "openid email profile",
    exp: 1_900_000_000,
  });

  const session = createCognitoSessionFromTokens(
    {
      id_token: idToken,
      access_token: accessToken,
      refresh_token: "refresh-token-123",
      expires_in: 3600,
      token_type: "Bearer",
    },
    1_800_000_000_000
  );

  assert.equal(session.user.email, "admin@yuzucigarclub.com");
  assert.equal(session.user.phone, "+14805550188");
  assert.equal(session.user.role, "admin");
  assert.equal(session.user.membership.status, "member");
  assert.equal(session.user.membership.tier, "Daimyo");
  assert.deepEqual(session.claims.groups, ["admin", "concierge_operator", "daimyo"]);
});

test("Cognito account profile edits update the stored storefront session", () => {
  const session = createCognitoSessionFromTokens(
    {
      id_token: createJwt({
        sub: "member-123",
        email: "member@yuzucigarclub.com",
        name: "Original Name",
        exp: 1_900_000_000,
      }),
      access_token: createJwt({ sub: "member-123", exp: 1_900_000_000 }),
      expires_in: 3600,
      token_type: "Bearer",
    },
    1_800_000_000_000
  );

  const updated = updateCognitoSessionProfile(session, {
    name: "  Updated Member  ",
    phone: "  602-555-0101  ",
  });

  assert.equal(updated.user.name, "Updated Member");
  assert.equal(updated.user.phone, "602-555-0101");
  assert.equal(updated.claims.name, "Updated Member");
  assert.equal(updated.claims.phoneNumber, "602-555-0101");
  assert.equal(updated.user.email, "member@yuzucigarclub.com");
});

test("Cognito account profile keeps a saved shipping address for checkout prefill", () => {
  const session = createCognitoSessionFromTokens(
    {
      id_token: createJwt({
        sub: "member-123",
        email: "member@yuzucigarclub.com",
        name: "Yuzu Member",
        "custom:shipping_address1": "111 W Boston St",
        "custom:shipping_address2": "Suite 200",
        "custom:shipping_city": "Chandler",
        "custom:shipping_state": "AZ",
        "custom:shipping_postal_code": "85225",
        "custom:shipping_country": "US",
        exp: 1_900_000_000,
      }),
      access_token: createJwt({ sub: "member-123", exp: 1_900_000_000 }),
      expires_in: 3600,
      token_type: "Bearer",
    },
    1_800_000_000_000
  );

  assert.deepEqual(session.user.shippingAddress, {
    address1: "111 W Boston St",
    address2: "Suite 200",
    city: "Chandler",
    state: "AZ",
    postalCode: "85225",
    country: "US",
  });

  const updated = updateCognitoSessionProfile(session, {
    name: "Yuzu Member",
    phone: "602-555-0101",
    shippingAddress: {
      address1: "  5041 N 44th Street  ",
      address2: "",
      city: " Phoenix ",
      state: " arizona ",
      postalCode: " 85018 ",
      country: " us ",
    },
  });

  assert.deepEqual(updated.user.shippingAddress, {
    address1: "5041 N 44th Street",
    address2: "",
    city: "Phoenix",
    state: "Arizona",
    postalCode: "85018",
    country: "US",
  });
});

test("inline Cognito sign-in shows for a ready unsigned account view", () => {
  assert.equal(
    shouldShowInlineCognitoSignIn({
      isReady: true,
      isSignedIn: false,
      isCognitoConfigured: true,
    }),
    true
  );
  assert.equal(
    shouldShowInlineCognitoSignIn({
      isReady: false,
      isSignedIn: false,
      isCognitoConfigured: true,
    }),
    false
  );
  assert.equal(
    shouldShowInlineCognitoSignIn({
      isReady: true,
      isSignedIn: true,
      isCognitoConfigured: true,
    }),
    false
  );
  assert.equal(
    shouldShowInlineCognitoSignIn({
      isReady: true,
      isSignedIn: false,
      isCognitoConfigured: false,
    }),
    false
  );
});

test("Cognito API headers send the ID token to the Yuzu API authorizer", () => {
  const idToken = createJwt({ sub: "member-123", email: "member@yuzucigarclub.com", exp: 1_900_000_000 });
  const session = createCognitoSessionFromTokens(
    {
      id_token: idToken,
      access_token: createJwt({ sub: "member-123", exp: 1_900_000_000 }),
      expires_in: 3600,
      token_type: "Bearer",
    },
    1_800_000_000_000
  );

  assert.deepEqual(createCognitoApiHeaders(session), {
    Authorization: `Bearer ${idToken}`,
  });
});

test("Cognito logout URL returns through the configured logout route", () => {
  const url = new URL(
    buildCognitoLogoutUrl(config, {
      origin: "https://www.yuzucigarclub.com",
      state: "signed-out",
    })
  );

  assert.equal(url.origin, config.hostedUiBase);
  assert.equal(url.pathname, "/logout");
  assert.equal(url.searchParams.get("client_id"), config.clientId);
  assert.equal(url.searchParams.get("logout_uri"), "https://www.yuzucigarclub.com/auth/logout");
  assert.equal(url.searchParams.get("state"), "signed-out");
});

test("Cognito config is enabled only when all public values are present", () => {
  assert.equal(
    resolveCognitoConfig({
      NEXT_PUBLIC_COGNITO_HOSTED_UI_BASE: config.hostedUiBase,
      NEXT_PUBLIC_COGNITO_USER_POOL_CLIENT_ID: config.clientId,
      NEXT_PUBLIC_COGNITO_ISSUER: config.issuer,
      NEXT_PUBLIC_YCC_API_BASE_URL: config.apiBaseUrl,
    })?.clientId,
    config.clientId
  );

  assert.equal(
    resolveCognitoConfig({
      NEXT_PUBLIC_COGNITO_HOSTED_UI_BASE: config.hostedUiBase,
      NEXT_PUBLIC_COGNITO_USER_POOL_CLIENT_ID: "",
      NEXT_PUBLIC_COGNITO_ISSUER: config.issuer,
    }),
    null
  );
});

function createJwt(payload: Record<string, unknown>) {
  return `${base64Url({ alg: "RS256", typ: "JWT" })}.${base64Url(payload)}.signature`;
}

function base64Url(value: Record<string, unknown>) {
  return Buffer.from(JSON.stringify(value), "utf8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}
