import type { AccountShippingAddress, BackupMembership, BackupMembershipTier, BackupUserRole } from "@/lib/backup-auth";
import { normalizeAccountShippingAddress } from "@/lib/backup-auth";

export type CognitoPublicEnv = Partial<Record<string, string | undefined>>;

export type CognitoAuthConfig = {
  hostedUiBase: string;
  clientId: string;
  issuer: string;
  apiBaseUrl: string;
  redirectPath: string;
  logoutPath: string;
  scopes: string[];
};

export type CognitoTokenResponse = {
  id_token: string;
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  token_type?: string;
};

export type CognitoPendingLogin = {
  state: string;
  codeVerifier: string;
  redirectPath: string;
  origin: string;
  createdAt: string;
};

export type CognitoAuthSession = {
  source: "cognito";
  tokens: {
    idToken: string;
    accessToken: string;
    refreshToken: string | null;
  };
  user: {
    id: string;
    email: string;
    name: string;
    phone: string;
    shippingAddress: AccountShippingAddress;
    role: BackupUserRole;
    membership: BackupMembership;
  };
  claims: {
    sub: string;
    email: string;
    name: string;
    phoneNumber: string | null;
    shippingAddress: AccountShippingAddress;
    groups: string[];
    membershipTier: string | null;
    memberStatus: string | null;
  };
  issuedAt: string;
  expiresAt: string;
};

export type CognitoPasswordSignInInput = {
  username: string;
  password: string;
};

export type CognitoPasswordSignInResult =
  | {
      status: "signed_in";
      message: string;
      session: CognitoAuthSession;
    }
  | {
      status: "challenge_required";
      message: string;
      challengeName: string;
      challengeSession: string | null;
    }
  | {
      status: "error";
      message: string;
    };

export const cognitoPendingLoginStorageKey = "yuzu-cognito-pkce-login-v1";
export const cognitoSessionStorageKey = "yuzu-cognito-auth-session-v1";
export const cognitoProfileCacheStorageKey = "yuzu-cognito-auth-profile-cache-v1";

const defaultRedirectPath = "/auth/callback";
const defaultLogoutPath = "/auth/logout";
const defaultScopes = ["openid", "email", "profile", "phone"];
const expirationSkewMs = 60_000;
const cognitoInitiateAuthTarget = "AWSCognitoIdentityProviderService.InitiateAuth";
type CognitoProfileSnapshot = {
  name: string;
  phone: string;
  shippingAddress: AccountShippingAddress;
};

type CognitoFetch = (
  url: string,
  init: RequestInit
) => Promise<{
  ok: boolean;
  json: () => Promise<unknown>;
}>;

export function resolveCognitoConfig(env: CognitoPublicEnv = getPublicEnv()): CognitoAuthConfig | null {
  const hostedUiBase = trimTrailingSlash(env.NEXT_PUBLIC_COGNITO_HOSTED_UI_BASE);
  const clientId = trimValue(env.NEXT_PUBLIC_COGNITO_USER_POOL_CLIENT_ID);
  const issuer = trimTrailingSlash(env.NEXT_PUBLIC_COGNITO_ISSUER);

  if (!hostedUiBase || !clientId || !issuer) {
    return null;
  }

  return {
    hostedUiBase,
    clientId,
    issuer,
    apiBaseUrl: trimTrailingSlash(env.NEXT_PUBLIC_YCC_API_BASE_URL) ?? "",
    redirectPath: normalizeAbsolutePath(env.NEXT_PUBLIC_COGNITO_REDIRECT_PATH, defaultRedirectPath),
    logoutPath: normalizeAbsolutePath(env.NEXT_PUBLIC_COGNITO_LOGOUT_PATH, defaultLogoutPath),
    scopes: parseScopes(env.NEXT_PUBLIC_COGNITO_SCOPES),
  };
}

export function buildCognitoAuthorizeUrl(
  config: CognitoAuthConfig,
  input: {
    origin: string;
    state: string;
    codeChallenge: string;
  }
) {
  const url = new URL("/oauth2/authorize", config.hostedUiBase);

  url.searchParams.set("client_id", config.clientId);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", config.scopes.join(" "));
  url.searchParams.set("redirect_uri", resolveRedirectUri(config, input.origin));
  url.searchParams.set("state", input.state);
  url.searchParams.set("code_challenge", input.codeChallenge);
  url.searchParams.set("code_challenge_method", "S256");

  return url.toString();
}

export function buildCognitoLogoutUrl(
  config: CognitoAuthConfig,
  input: {
    origin: string;
    state?: string;
  }
) {
  const url = new URL("/logout", config.hostedUiBase);

  url.searchParams.set("client_id", config.clientId);
  url.searchParams.set("logout_uri", resolveLogoutUri(config, input.origin));

  if (input.state) {
    url.searchParams.set("state", input.state);
  }

  return url.toString();
}

export function buildCognitoTokenRequestBody(
  config: CognitoAuthConfig,
  input: {
    code: string;
    codeVerifier: string;
    redirectUri: string;
  }
) {
  const body = new URLSearchParams();

  body.set("grant_type", "authorization_code");
  body.set("client_id", config.clientId);
  body.set("code", input.code);
  body.set("code_verifier", input.codeVerifier);
  body.set("redirect_uri", input.redirectUri);

  return body;
}

export function buildCognitoPasswordAuthRequest(config: CognitoAuthConfig, input: CognitoPasswordSignInInput) {
  return {
    url: getCognitoIdentityProviderEndpoint(config),
    init: {
      method: "POST",
      headers: {
        "content-type": "application/x-amz-json-1.1",
        "x-amz-target": cognitoInitiateAuthTarget,
      },
      body: JSON.stringify({
        AuthFlow: "USER_PASSWORD_AUTH",
        ClientId: config.clientId,
        AuthParameters: {
          USERNAME: input.username.trim(),
          PASSWORD: input.password,
        },
      }),
    } satisfies RequestInit,
  };
}

export async function signInWithCognitoPassword(
  config: CognitoAuthConfig,
  input: CognitoPasswordSignInInput,
  fetchImpl: CognitoFetch = globalThis.fetch.bind(globalThis) as CognitoFetch,
  nowMs = Date.now()
): Promise<CognitoPasswordSignInResult> {
  if (!input.username.trim() || !input.password) {
    return {
      status: "error",
      message: "Enter your email and password.",
    };
  }

  try {
    const request = buildCognitoPasswordAuthRequest(config, input);
    const response = await fetchImpl(request.url, request.init);
    const payload = await readCognitoJson(response);

    if (!response.ok) {
      return {
        status: "error",
        message: getCognitoErrorMessage(payload),
      };
    }

    const challengeName = stringClaim(payload.ChallengeName);

    if (challengeName) {
      return {
        status: "challenge_required",
        message: getCognitoChallengeMessage(challengeName),
        challengeName,
        challengeSession: stringClaim(payload.Session),
      };
    }

    const tokenResponse = getCognitoTokenResponse(payload.AuthenticationResult);

    if (!tokenResponse) {
      return {
        status: "error",
        message: "Cognito did not return a complete sign-in session.",
      };
    }

    return {
      status: "signed_in",
      message: "Signed in with Cognito.",
      session: createCognitoSessionFromTokens(tokenResponse, nowMs),
    };
  } catch {
    return {
      status: "error",
      message: "Cognito sign-in is unavailable. Please try again.",
    };
  }
}

export function buildCognitoRefreshRequestBody(config: CognitoAuthConfig, refreshToken: string) {
  const body = new URLSearchParams();

  body.set("grant_type", "refresh_token");
  body.set("client_id", config.clientId);
  body.set("refresh_token", refreshToken);

  return body;
}

export function createCognitoSessionFromTokens(tokens: CognitoTokenResponse, nowMs = Date.now()): CognitoAuthSession {
  const idClaims = decodeJwtPayload(tokens.id_token);
  const groups = parseGroups(idClaims["cognito:groups"]);
  const sub = stringClaim(idClaims.sub) || "cognito-user";
  const email = stringClaim(idClaims.email) || "";
  const name =
    stringClaim(idClaims.name) ||
    buildDisplayNameFromPersonClaims(idClaims.given_name, idClaims.family_name) ||
    stringClaim(idClaims["cognito:username"]) ||
    email ||
    "Yuzu Member";
  const phone = stringClaim(idClaims.phone_number) || stringClaim(idClaims.phone) || "";
  const shippingAddress = getCognitoShippingAddress(idClaims);
  const membershipTier = stringClaim(idClaims["custom:membership_tier"]);
  const memberStatus = stringClaim(idClaims["custom:member_status"]);
  const role: BackupUserRole = groups.some((group) => ["admin", "concierge_operator"].includes(group.toLowerCase()))
    ? "admin"
    : "customer";
  const membership = createMembership(groups, membershipTier, memberStatus, role);
  const tokenExpiry = typeof tokens.expires_in === "number" ? nowMs + tokens.expires_in * 1000 : numericClaim(idClaims.exp) * 1000;
  const issuedAt = numericClaim(idClaims.iat) ? new Date(numericClaim(idClaims.iat) * 1000).toISOString() : new Date(nowMs).toISOString();

  return {
    source: "cognito",
    tokens: {
      idToken: tokens.id_token,
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token ?? null,
    },
    user: {
      id: sub,
      email,
      name,
      phone,
      shippingAddress,
      role,
      membership,
    },
    claims: {
      sub,
      email,
      name,
      phoneNumber: phone || null,
      shippingAddress,
      groups,
      membershipTier,
      memberStatus,
    },
    issuedAt,
    expiresAt: new Date(tokenExpiry).toISOString(),
  };
}

export function createCognitoApiHeaders(session: CognitoAuthSession | null, nowMs = Date.now()): Record<string, string> {
  if (!session || isCognitoSessionExpired(session, nowMs)) {
    return {};
  }

  return {
    Authorization: `Bearer ${session.tokens.idToken}`,
  };
}

export function updateCognitoSessionProfile(
  session: CognitoAuthSession,
  input: {
    name: string;
    phone: string;
    shippingAddress?: Partial<AccountShippingAddress> | null;
  }
): CognitoAuthSession {
  const name = normalizeProfileText(input.name) || session.user.name;
  const phone = normalizeProfileText(input.phone);
  const shippingAddress = normalizeAccountShippingAddress(input.shippingAddress ?? session.user.shippingAddress);

  return {
    ...session,
    user: {
      ...session.user,
      name,
      phone,
      shippingAddress,
    },
    claims: {
      ...session.claims,
      name,
      phoneNumber: phone || null,
      shippingAddress,
    },
  };
}

export function hydrateCognitoSessionFromProfile(session: CognitoAuthSession, snapshot: CognitoProfileSnapshot | null): CognitoAuthSession {
  if (!snapshot) {
    return session;
  }

  const name = snapshot.name || session.user.name;
  const phone = snapshot.phone || session.user.phone;
  const hasSavedShippingAddress = hasProfileShippingAddress(snapshot.shippingAddress);
  const shippingAddress = normalizeAccountShippingAddress({
    address1: snapshot.shippingAddress.address1 || session.user.shippingAddress.address1,
    address2: snapshot.shippingAddress.address2 || session.user.shippingAddress.address2,
    city: snapshot.shippingAddress.city || session.user.shippingAddress.city,
    state: snapshot.shippingAddress.state || session.user.shippingAddress.state,
    postalCode: snapshot.shippingAddress.postalCode || session.user.shippingAddress.postalCode,
    country: hasSavedShippingAddress ? snapshot.shippingAddress.country : session.user.shippingAddress.country,
  });

  return {
    ...session,
    user: {
      ...session.user,
      name,
      phone,
      shippingAddress,
    },
    claims: {
      ...session.claims,
      name,
      phoneNumber: phone || null,
      shippingAddress,
    },
  };
}

export function readStoredCognitoProfile(storage: Storage, subject: string): CognitoProfileSnapshot | null {
  const cache = normalizeCognitoProfileCache(readJson(storage, cognitoProfileCacheStorageKey));
  if (!cache) {
    return null;
  }

  return cache[subject] ? cache[subject] : null;
}

export function writeStoredCognitoProfile(storage: Storage, session: CognitoAuthSession) {
  const cache = normalizeCognitoProfileCache(readJson(storage, cognitoProfileCacheStorageKey)) ?? {};
  const nextCache = {
    ...cache,
    [session.user.id]: {
      name: session.user.name,
      phone: session.user.phone,
      shippingAddress: session.user.shippingAddress,
    },
  };

  storage.setItem(cognitoProfileCacheStorageKey, JSON.stringify(nextCache));
}

export function shouldStartSeamlessCognitoLogin(input: {
  isReady: boolean;
  isSignedIn: boolean;
  isCognitoConfigured: boolean;
  hasStarted: boolean;
}) {
  return input.isReady && input.isCognitoConfigured && !input.isSignedIn && !input.hasStarted;
}

export function shouldShowInlineCognitoSignIn(input: {
  isReady: boolean;
  isSignedIn: boolean;
  isCognitoConfigured: boolean;
}) {
  return input.isReady && input.isCognitoConfigured && !input.isSignedIn;
}

export function isCognitoSessionExpired(session: CognitoAuthSession, nowMs = Date.now()) {
  return Date.parse(session.expiresAt) - expirationSkewMs <= nowMs;
}

export function readStoredCognitoSession(storage: Storage, nowMs = Date.now()) {
  const value = readJson(storage, cognitoSessionStorageKey);

  if (!isCognitoAuthSession(value) || isCognitoSessionExpired(value, nowMs)) {
    return null;
  }

  return normalizeCognitoAuthSession(value);
}

export function writeStoredCognitoSession(storage: Storage, session: CognitoAuthSession) {
  storage.setItem(cognitoSessionStorageKey, JSON.stringify(session));
}

export function clearStoredCognitoSession(storage: Storage) {
  storage.removeItem(cognitoSessionStorageKey);
}

export function clearStoredCognitoProfile(storage: Storage, subject: string | null) {
  if (!subject) {
    return;
  }

  const cache = normalizeCognitoProfileCache(readJson(storage, cognitoProfileCacheStorageKey));
  if (!cache) {
    return;
  }

  delete cache[subject];
  storage.setItem(cognitoProfileCacheStorageKey, JSON.stringify(cache));
}

export function readPendingCognitoLogin(storage: Storage) {
  const value = readJson(storage, cognitoPendingLoginStorageKey);

  return isCognitoPendingLogin(value) ? value : null;
}

export function writePendingCognitoLogin(storage: Storage, pending: CognitoPendingLogin) {
  storage.setItem(cognitoPendingLoginStorageKey, JSON.stringify(pending));
}

export function clearPendingCognitoLogin(storage: Storage) {
  storage.removeItem(cognitoPendingLoginStorageKey);
}

export async function createPkceChallenge(codeVerifier: string) {
  const digest = await globalThis.crypto.subtle.digest("SHA-256", new TextEncoder().encode(codeVerifier));

  return base64UrlFromBytes(new Uint8Array(digest));
}

export function createRandomOAuthValue(byteLength = 32) {
  const bytes = new Uint8Array(byteLength);
  globalThis.crypto.getRandomValues(bytes);

  return base64UrlFromBytes(bytes);
}

export function resolveRedirectUri(config: CognitoAuthConfig, origin: string) {
  return new URL(config.redirectPath, origin).toString();
}

export function resolveLogoutUri(config: CognitoAuthConfig, origin: string) {
  return new URL(config.logoutPath, origin).toString();
}

export function getTokenEndpoint(config: CognitoAuthConfig) {
  return new URL("/oauth2/token", config.hostedUiBase).toString();
}

function getCognitoIdentityProviderEndpoint(config: CognitoAuthConfig) {
  return new URL("/", new URL(config.issuer).origin).toString();
}

async function readCognitoJson(response: { json: () => Promise<unknown> }) {
  try {
    const payload = await response.json();

    return payload && typeof payload === "object" ? (payload as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

export function getCognitoTokenResponse(value: unknown): CognitoTokenResponse | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const result = value as Record<string, unknown>;
  const idToken = stringClaim(result.IdToken) ?? stringClaim(result.id_token);
  const accessToken = stringClaim(result.AccessToken) ?? stringClaim(result.access_token);

  if (!idToken || !accessToken) {
    return null;
  }

  return {
    id_token: idToken,
    access_token: accessToken,
    refresh_token: stringClaim(result.RefreshToken) ?? stringClaim(result.refresh_token) ?? undefined,
    expires_in: numericClaim(result.ExpiresIn) || numericClaim(result.expires_in) || undefined,
    token_type: stringClaim(result.TokenType) ?? stringClaim(result.token_type) ?? undefined,
  };
}

function getCognitoErrorMessage(payload: Record<string, unknown>) {
  const message = stringClaim(payload.message) || stringClaim(payload.Message);

  if (message?.includes("USER_PASSWORD_AUTH flow not enabled")) {
    return "Cognito is not configured for in-app sign-in yet. Enable USER_PASSWORD_AUTH on the app client and try again.";
  }

  return message || "Cognito could not sign you in. Check your email and password.";
}

function getCognitoChallengeMessage(challengeName: string) {
  if (challengeName === "NEW_PASSWORD_REQUIRED") {
    return "A new Cognito password is required. Continue with hosted Cognito sign-in so AWS can complete the password challenge securely.";
  }

  return "Additional Cognito verification is required. Continue with hosted Cognito sign-in so AWS can complete the challenge securely.";
}

function createMembership(
  groups: string[],
  membershipTier: string | null,
  memberStatus: string | null,
  role: BackupUserRole
): BackupMembership {
  const tier = normalizeMembershipTier(membershipTier) ?? normalizeMembershipTier(groups.find((group) => group !== "member"));
  const status = memberStatus?.toLowerCase() === "member" || Boolean(tier) || groups.includes("member") || role === "admin" ? "member" : "non_member";

  return {
    status,
    tier,
  };
}

function normalizeMembershipTier(value: string | null | undefined): BackupMembershipTier | null {
  const normalized = value?.trim().toLowerCase();

  if (!normalized) {
    return null;
  }

  if (normalized === "box access pass" || normalized === "box_access_pass") {
    return "Box Access Pass";
  }

  if (normalized === "kisha") {
    return "Kisha";
  }

  if (normalized === "sensei") {
    return "Sensei";
  }

  if (normalized === "daimyo" || normalized === "admin") {
    return "Daimyo";
  }

  return null;
}

function getCognitoShippingAddress(claims: Record<string, unknown>) {
  const structuredAddress = parseCognitoAddressClaim(claims.address);

  return normalizeAccountShippingAddress({
    address1:
      stringClaim(claims["custom:shipping_address1"]) ||
      stringClaim(claims["custom:address_line1"]) ||
      structuredAddress.address1,
    address2:
      stringClaim(claims["custom:shipping_address2"]) ||
      stringClaim(claims["custom:address_line2"]) ||
      structuredAddress.address2,
    city:
      stringClaim(claims["custom:shipping_city"]) ||
      stringClaim(claims["custom:address_city"]) ||
      structuredAddress.city,
    state:
      stringClaim(claims["custom:shipping_state"]) ||
      stringClaim(claims["custom:address_state"]) ||
      structuredAddress.state,
    postalCode:
      stringClaim(claims["custom:shipping_postal_code"]) ||
      stringClaim(claims["custom:postal_code"]) ||
      structuredAddress.postalCode,
    country:
      stringClaim(claims["custom:shipping_country"]) ||
      stringClaim(claims["custom:address_country"]) ||
      structuredAddress.country,
  });
}

function parseCognitoAddressClaim(value: unknown): Partial<AccountShippingAddress> {
  const address = typeof value === "string" ? parseAddressJson(value) : value;

  if (!address || typeof address !== "object") {
    return {};
  }

  const claim = address as Record<string, unknown>;
  const streetLines = splitStreetAddress(stringClaim(claim.street_address) || stringClaim(claim.address1) || "");

  return {
    address1: streetLines[0] || stringClaim(claim.address1) || "",
    address2: streetLines[1] || stringClaim(claim.address2) || "",
    city: stringClaim(claim.locality) || stringClaim(claim.city) || "",
    state: stringClaim(claim.region) || stringClaim(claim.state) || "",
    postalCode: stringClaim(claim.postal_code) || stringClaim(claim.postalCode) || "",
    country: stringClaim(claim.country) || "",
  };
}

function parseAddressJson(value: string) {
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return null;
  }
}

function splitStreetAddress(value: string) {
  return value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 2);
}

function decodeJwtPayload(token: string) {
  const [, payload] = token.split(".");

  if (!payload) {
    return {};
  }

  try {
    return JSON.parse(decodeBase64Url(payload)) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function parseGroups(value: unknown) {
  if (Array.isArray(value)) {
    return value.map(String);
  }

  if (typeof value === "string" && value.trim()) {
    return value.split(",").map((item) => item.trim()).filter(Boolean);
  }

  return [];
}

function stringClaim(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function numericClaim(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function normalizeProfileText(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

function buildDisplayNameFromPersonClaims(givenName: unknown, familyName: unknown) {
  const firstName = stringClaim(givenName);
  const lastName = stringClaim(familyName);
  const displayName = `${firstName || ""} ${lastName || ""}`.trim();

  return displayName || null;
}

function normalizeCognitoProfileCache(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const snapshotIndex = value as Record<string, unknown>;
  const result: Record<string, CognitoProfileSnapshot> = {};

  for (const [subject, snapshotValue] of Object.entries(snapshotIndex)) {
    if (typeof subject !== "string" || !subject.trim()) {
      continue;
    }

    if (!snapshotValue || typeof snapshotValue !== "object") {
      continue;
    }

    const snapshot = snapshotValue as {
      name?: unknown;
      phone?: unknown;
      shippingAddress?: Partial<AccountShippingAddress>;
    };

    result[subject] = {
      name: normalizeProfileText(stringClaim(snapshot.name) || ""),
      phone: normalizeProfileText(stringClaim(snapshot.phone) || ""),
      shippingAddress: normalizeAccountShippingAddress(snapshot.shippingAddress),
    };
  }

  return result;
}

function hasProfileShippingAddress(address: AccountShippingAddress) {
  return Boolean(address.address1 || address.address2 || address.city || address.state || address.postalCode || address.country !== "US");
}

function isCognitoAuthSession(value: unknown): value is CognitoAuthSession {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as CognitoAuthSession;

  return candidate.source === "cognito" && Boolean(candidate.tokens?.idToken) && Boolean(candidate.tokens?.accessToken);
}

function normalizeCognitoAuthSession(session: CognitoAuthSession): CognitoAuthSession {
  const savedAddress = normalizeAccountShippingAddress(
    (session.user as CognitoAuthSession["user"] & { shippingAddress?: Partial<AccountShippingAddress> }).shippingAddress ??
      (session.claims as CognitoAuthSession["claims"] & { shippingAddress?: Partial<AccountShippingAddress> }).shippingAddress
  );

  return {
    ...session,
    user: {
      ...session.user,
      shippingAddress: savedAddress,
    },
    claims: {
      ...session.claims,
      shippingAddress: savedAddress,
    },
  };
}

function isCognitoPendingLogin(value: unknown): value is CognitoPendingLogin {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as CognitoPendingLogin;

  return Boolean(candidate.state && candidate.codeVerifier && candidate.origin);
}

function readJson(storage: Storage, key: string) {
  try {
    const value = storage.getItem(key);

    return value ? JSON.parse(value) : null;
  } catch {
    return null;
  }
}

function trimValue(value: string | undefined) {
  const trimmed = value?.trim();

  return trimmed ? trimmed : null;
}

function trimTrailingSlash(value: string | undefined) {
  const trimmed = trimValue(value);

  return trimmed ? trimmed.replace(/\/+$/g, "") : null;
}

function normalizeAbsolutePath(value: string | undefined, fallback: string) {
  const trimmed = trimValue(value) ?? fallback;

  return trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
}

function parseScopes(value: string | undefined) {
  const scopes = value?.split(/\s+/).map((scope) => scope.trim()).filter(Boolean);

  return scopes?.length ? scopes : defaultScopes;
}

function base64UrlFromBytes(bytes: Uint8Array) {
  let value = "";

  for (const byte of bytes) {
    value += String.fromCharCode(byte);
  }

  return encodeBase64Url(value);
}

function encodeBase64Url(binary: string) {
  const encoded =
    typeof btoa === "function"
      ? btoa(binary)
      : Buffer.from(binary, "binary").toString("base64");

  return encoded.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function decodeBase64Url(value: string) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=");

  if (typeof atob === "function") {
    const binary = atob(normalized);
    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));

    return new TextDecoder().decode(bytes);
  }

  return Buffer.from(normalized, "base64").toString("utf8");
}

function getPublicEnv(): CognitoPublicEnv {
  return {
    NEXT_PUBLIC_COGNITO_HOSTED_UI_BASE: process.env.NEXT_PUBLIC_COGNITO_HOSTED_UI_BASE,
    NEXT_PUBLIC_COGNITO_USER_POOL_CLIENT_ID: process.env.NEXT_PUBLIC_COGNITO_USER_POOL_CLIENT_ID,
    NEXT_PUBLIC_COGNITO_ISSUER: process.env.NEXT_PUBLIC_COGNITO_ISSUER,
    NEXT_PUBLIC_YCC_API_BASE_URL: process.env.NEXT_PUBLIC_YCC_API_BASE_URL,
    NEXT_PUBLIC_COGNITO_REDIRECT_PATH: process.env.NEXT_PUBLIC_COGNITO_REDIRECT_PATH,
    NEXT_PUBLIC_COGNITO_LOGOUT_PATH: process.env.NEXT_PUBLIC_COGNITO_LOGOUT_PATH,
    NEXT_PUBLIC_COGNITO_SCOPES: process.env.NEXT_PUBLIC_COGNITO_SCOPES,
  };
}
