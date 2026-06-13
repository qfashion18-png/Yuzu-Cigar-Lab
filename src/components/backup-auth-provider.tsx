"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

import {
  type BackupAuthDatabase,
  type BackupMembershipTier,
  type BackupAuthResult,
  type BackupAuthSession,
  type BackupAuthUser,
  type BackupUserView,
  type AccountProfileInput,
  type AccountProfileUpdateResult,
  type FirstLoginPasswordInput,
  type PasswordLoginInput,
  type SocialSignupInput,
  backupAdminEmail,
  completeFirstLoginPasswordSetup,
  createBackupAuthSession,
  createBackupAuthDatabase,
  getSessionUser,
  getUserView,
  isLiveAuthRequiredForEnvironment,
  normalizeBackupDatabase,
  signInWithPassword,
  signUpWithSocialProvider,
  updateBackupAccountProfile,
} from "@/lib/backup-auth";
import {
  buildCognitoAuthorizeUrl,
  buildCognitoLogoutUrl,
  buildCognitoTokenRequestBody,
  buildCognitoRefreshRequestBody,
  clearPendingCognitoLogin,
  clearStoredCognitoSession,
  createPkceChallenge,
  createRandomOAuthValue,
  createCognitoApiHeaders,
  isCognitoSessionExpired,
  hydrateCognitoSessionFromProfile,
  createCognitoSessionFromTokens,
  getTokenEndpoint,
  readPendingCognitoLogin,
  readStoredCognitoSession,
  readStoredCognitoProfile,
  resolveCognitoConfig,
  resolveRedirectUri,
  signInWithCognitoPassword as signInWithCognitoPasswordRequest,
  signUpWithCognitoPassword as signUpWithCognitoPasswordRequest,
  confirmCognitoSignUp as confirmCognitoSignUpRequest,
  resendCognitoSignUpCode as resendCognitoSignUpCodeRequest,
  getCognitoTokenResponse,
  writeStoredCognitoProfile,
  updateCognitoSessionProfile,
  writePendingCognitoLogin,
  writeStoredCognitoSession,
  type CognitoAuthConfig,
  type CognitoAuthSession,
  type CognitoConfirmSignUpInput,
  type CognitoConfirmSignUpResult,
  type CognitoPasswordSignInInput,
  type CognitoPasswordSignInResult,
  type CognitoPasswordSignUpInput,
  type CognitoPasswordSignUpResult,
} from "@/lib/cognito-auth";

type CognitoCallbackResult = {
  status: "signed_in" | "error";
  message: string;
  redirectPath?: string;
};

type CognitoLoginStartResult = {
  status: "redirecting" | "error";
  message: string;
};

type BackupAuthContextValue = {
  adminEmail: string;
  database: BackupAuthDatabase;
  session: BackupAuthSession | null;
  userView: BackupUserView;
  authSource: "cognito" | "backup" | null;
  cognitoConfig: CognitoAuthConfig | null;
  cognitoSession: CognitoAuthSession | null;
  authError: string;
  isReady: boolean;
  isCognitoConfigured: boolean;
  isCognitoSignedIn: boolean;
  isSignedIn: boolean;
  isAdmin: boolean;
  isMember: boolean;
  currentUser: BackupAuthUser | CognitoAuthSession["user"] | null;
  signIn: (input: PasswordLoginInput) => BackupAuthResult;
  completeFirstLoginPassword: (input: FirstLoginPasswordInput) => BackupAuthResult;
  signUpWithSocial: (input: SocialSignupInput) => BackupAuthResult;
  signInWithCognitoPassword: (input: CognitoPasswordSignInInput) => Promise<CognitoPasswordSignInResult>;
  signUpWithCognitoPassword: (input: CognitoPasswordSignUpInput) => Promise<CognitoPasswordSignUpResult>;
  confirmCognitoSignUp: (input: CognitoConfirmSignUpInput) => Promise<CognitoConfirmSignUpResult>;
  resendCognitoSignUpCode: (input: { email: string; clientMetadata?: Record<string, string> }) => Promise<CognitoPasswordSignUpResult>;
  startCognitoLogin: (input?: { redirectPath?: string }) => Promise<CognitoLoginStartResult>;
  completeCognitoCallback: (url?: string) => Promise<CognitoCallbackResult>;
  updateAccountProfile: (input: AccountProfileInput) => AccountProfileUpdateResult;
  applyMembershipAccess: (input: { tier: BackupMembershipTier; status?: "member" | "non_member" }) => void;
  clearCognitoSession: () => void;
  createApiHeaders: () => Promise<Record<string, string>>;
  signOut: () => void;
};

const databaseStorageKey = "yuzu-backup-auth-database-v1";
const sessionStorageKey = "yuzu-backup-auth-session-v1";
const BackupAuthContext = createContext<BackupAuthContextValue | null>(null);

export function BackupAuthProvider({ children }: { children: React.ReactNode }) {
  const liveAuthRequired = useMemo(
    () =>
      isLiveAuthRequiredForEnvironment({
        nodeEnv: process.env.NODE_ENV,
        featureFlag: process.env.NEXT_PUBLIC_REQUIRE_LIVE_AUTH,
      }),
    [],
  );
  const [database, setDatabase] = useState<BackupAuthDatabase>(() => createBackupAuthDatabase(undefined, { includeAdminSeed: !liveAuthRequired }));
  const [session, setSession] = useState<BackupAuthSession | null>(null);
  const [cognitoSession, setCognitoSession] = useState<CognitoAuthSession | null>(null);
  const [authError, setAuthError] = useState("");
  const [isReady, setIsReady] = useState(false);
  const cognitoConfig = useMemo(() => resolveCognitoConfig(), []);

  useEffect(() => {
    let cancelled = false;
    const storedDatabase = liveAuthRequired ? null : readStorage(databaseStorageKey);
    const nextDatabase = normalizeBackupDatabase(storedDatabase, { includeAdminSeed: !liveAuthRequired });
    const storedSession = liveAuthRequired ? null : (readStorage(sessionStorageKey) as BackupAuthSession | null);
    const storedSessionUser = getSessionUser(nextDatabase, storedSession);
    const nextSession = storedSessionUser && storedSession ? createBackupAuthSession(storedSessionUser, storedSession.signedInAt) : null;
    const nextCognitoSession = (() => {
      const cachedSession = readStoredCognitoSession(window.localStorage);
      if (!cachedSession) {
        return null;
      }

      const cachedProfile = readStoredCognitoProfile(window.localStorage, cachedSession.user.id);
      return hydrateCognitoSessionFromProfile(cachedSession, cachedProfile);
    })();

    window.queueMicrotask(() => {
      if (cancelled) {
        return;
      }

      setDatabase(nextDatabase);
      setSession(nextSession);
      setCognitoSession(nextCognitoSession);
      setIsReady(true);
    });

    return () => {
      cancelled = true;
    };
  }, [liveAuthRequired]);

  useEffect(() => {
    if (!isReady) {
      return;
    }

    writeStorage(databaseStorageKey, database);
  }, [database, isReady]);

  useEffect(() => {
    if (!isReady) {
      return;
    }

    if (session && !cognitoSession) {
      writeStorage(sessionStorageKey, session);
      return;
    }

    window.localStorage.removeItem(sessionStorageKey);
  }, [cognitoSession, isReady, session]);

  const commitAuthResult = useCallback((result: BackupAuthResult) => {
    setDatabase(result.database);

    if (result.session) {
      clearStoredCognitoSession(window.localStorage);
      setCognitoSession(null);
      setSession(result.session);
    }

    return result;
  }, []);

  const signIn = useCallback(
    (input: PasswordLoginInput) => commitAuthResult(signInWithPassword(database, input)),
    [commitAuthResult, database]
  );

  const completeFirstLoginPassword = useCallback(
    (input: FirstLoginPasswordInput) => commitAuthResult(completeFirstLoginPasswordSetup(database, input)),
    [commitAuthResult, database]
  );

  const signUpWithSocial = useCallback(
    (input: SocialSignupInput) => commitAuthResult(signUpWithSocialProvider(database, input)),
    [commitAuthResult, database]
  );

  const clearCognitoSession = useCallback(() => {
    setCognitoSession(null);
    clearStoredCognitoSession(window.localStorage);
    clearPendingCognitoLogin(window.sessionStorage);
  }, []);

  const refreshCognitoSession = useCallback(async () => {
    if (!cognitoConfig || !cognitoSession?.tokens.refreshToken) {
      return null;
    }

    const response = await fetch(getTokenEndpoint(cognitoConfig), {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded",
      },
      body: buildCognitoRefreshRequestBody(cognitoConfig, cognitoSession.tokens.refreshToken),
    });

    if (!response.ok) {
      return null;
    }

    const tokenPayload = await response.json().catch(() => ({}));
    const nextTokenResponse = getCognitoTokenResponse(tokenPayload);

    if (!nextTokenResponse) {
      return null;
    }

    const refreshedSession = createCognitoSessionFromTokens({
      ...nextTokenResponse,
      refresh_token: nextTokenResponse.refresh_token ?? cognitoSession.tokens.refreshToken,
    });

    return hydrateCognitoSessionFromProfile(
      refreshedSession,
      readStoredCognitoProfile(window.localStorage, refreshedSession.user.id)
    );
  }, [cognitoConfig, cognitoSession]);

  const signInWithCognitoPassword = useCallback(
    async (input: CognitoPasswordSignInInput): Promise<CognitoPasswordSignInResult> => {
      if (!cognitoConfig) {
        const result = {
          status: "error",
          message: "Cognito sign-in is not configured for this deployment.",
        } satisfies CognitoPasswordSignInResult;

        setAuthError(result.message);
        return result;
      }

      const result = await signInWithCognitoPasswordRequest(cognitoConfig, input);

      if (result.status === "signed_in") {
        const nextCognitoSession = hydrateCognitoSessionFromProfile(
          result.session,
          readStoredCognitoProfile(window.localStorage, result.session.user.id)
        );

        writeStoredCognitoSession(window.localStorage, nextCognitoSession);
        writeStoredCognitoProfile(window.localStorage, nextCognitoSession);
        clearPendingCognitoLogin(window.sessionStorage);
        window.localStorage.removeItem(sessionStorageKey);
        setSession(null);
        setCognitoSession(nextCognitoSession);
        setAuthError("");
        return result;
      }

      setAuthError(result.message);
      return result;
    },
    [cognitoConfig]
  );

  const signUpWithCognitoPassword = useCallback(
    async (input: CognitoPasswordSignUpInput): Promise<CognitoPasswordSignUpResult> => {
      if (!cognitoConfig) {
        const result = {
          status: "error",
          message: "Yuzu account signup is not configured for this deployment.",
        } satisfies CognitoPasswordSignUpResult;

        setAuthError(result.message);
        return result;
      }

      const result = await signUpWithCognitoPasswordRequest(cognitoConfig, input);

      if (result.status === "error") {
        setAuthError(result.message);
      } else {
        setAuthError("");
      }

      return result;
    },
    [cognitoConfig]
  );

  const confirmCognitoSignUp = useCallback(
    async (input: CognitoConfirmSignUpInput): Promise<CognitoConfirmSignUpResult> => {
      if (!cognitoConfig) {
        const result = {
          status: "error",
          message: "Yuzu account confirmation is not configured for this deployment.",
        } satisfies CognitoConfirmSignUpResult;

        setAuthError(result.message);
        return result;
      }

      const result = await confirmCognitoSignUpRequest(cognitoConfig, input);

      if (result.status === "error") {
        setAuthError(result.message);
      } else {
        setAuthError("");
      }

      return result;
    },
    [cognitoConfig]
  );

  const resendCognitoSignUpCode = useCallback(
    async (input: { email: string; clientMetadata?: Record<string, string> }): Promise<CognitoPasswordSignUpResult> => {
      if (!cognitoConfig) {
        const result = {
          status: "error",
          message: "Yuzu account confirmation is not configured for this deployment.",
        } satisfies CognitoPasswordSignUpResult;

        setAuthError(result.message);
        return result;
      }

      const result = await resendCognitoSignUpCodeRequest(cognitoConfig, input);

      if (result.status === "error") {
        setAuthError(result.message);
      } else {
        setAuthError("");
      }

      return result;
    },
    [cognitoConfig]
  );

  const startCognitoLogin = useCallback(
    async (input: { redirectPath?: string } = {}): Promise<CognitoLoginStartResult> => {
      if (!cognitoConfig) {
        const result = {
          status: "error",
          message: "Cognito sign-in is not configured for this deployment.",
        } satisfies CognitoLoginStartResult;

        setAuthError(result.message);
        return result;
      }

      const state = createRandomOAuthValue();
      const codeVerifier = createRandomOAuthValue(64);
      const codeChallenge = await createPkceChallenge(codeVerifier);
      const origin = window.location.origin;

      writePendingCognitoLogin(window.sessionStorage, {
        state,
        codeVerifier,
        redirectPath: input.redirectPath || `${window.location.pathname}${window.location.search}` || "/account",
        origin,
        createdAt: new Date().toISOString(),
      });

      window.location.href = buildCognitoAuthorizeUrl(cognitoConfig, {
        origin,
        state,
        codeChallenge,
      });

      return {
        status: "redirecting",
        message: "Opening hosted Cognito sign-in.",
      };
    },
    [cognitoConfig]
  );

  const completeCognitoCallback = useCallback(
    async (url?: string): Promise<CognitoCallbackResult> => {
      if (!cognitoConfig) {
        return { status: "error", message: "Cognito sign-in is not configured for this deployment." };
      }

      const callbackUrl = new URL(url ?? window.location.href);
      const error = callbackUrl.searchParams.get("error");

      if (error) {
        return {
          status: "error",
          message: callbackUrl.searchParams.get("error_description") || error,
        };
      }

      const code = callbackUrl.searchParams.get("code");
      const state = callbackUrl.searchParams.get("state");
      const pending = readPendingCognitoLogin(window.sessionStorage);

      if (!code || !state || !pending || pending.state !== state) {
        return {
          status: "error",
          message: "The Cognito sign-in response did not match this browser session.",
        };
      }

      const response = await fetch(getTokenEndpoint(cognitoConfig), {
        method: "POST",
        headers: {
          "content-type": "application/x-www-form-urlencoded",
        },
        body: buildCognitoTokenRequestBody(cognitoConfig, {
          code,
          codeVerifier: pending.codeVerifier,
          redirectUri: resolveRedirectUri(cognitoConfig, pending.origin),
        }),
      });

      if (!response.ok) {
        return {
          status: "error",
          message: "Cognito could not finish sign-in. Please try again.",
        };
      }

      let tokenPayload: unknown = {};
      try {
        tokenPayload = await response.json();
      } catch {
        return {
          status: "error",
          message: "Cognito returned an unreadable sign-in response. Please try again.",
        };
      }

      const tokenResponse = getCognitoTokenResponse(tokenPayload);
      if (!tokenResponse) {
        return {
          status: "error",
          message: "Cognito did not return a complete sign-in session.",
        };
      }

      const tokenSession = createCognitoSessionFromTokens(tokenResponse);
      const nextCognitoSession = hydrateCognitoSessionFromProfile(
        tokenSession,
        readStoredCognitoProfile(window.localStorage, tokenSession.user.id)
      );

      writeStoredCognitoSession(window.localStorage, nextCognitoSession);
      writeStoredCognitoProfile(window.localStorage, nextCognitoSession);
      clearPendingCognitoLogin(window.sessionStorage);
      window.localStorage.removeItem(sessionStorageKey);
      setSession(null);
      setCognitoSession(nextCognitoSession);
      setAuthError("");

      return {
        status: "signed_in",
        message: "Signed in with Cognito.",
        redirectPath: pending.redirectPath || "/account",
      };
    },
    [cognitoConfig]
  );

  const updateAccountProfile = useCallback(
    (input: AccountProfileInput): AccountProfileUpdateResult => {
      if (cognitoSession) {
        if (!input.name.trim()) {
          return {
            status: "invalid_profile",
            database,
            session: createBackupSessionFromCognito(cognitoSession),
            message: "Enter a display name.",
          };
        }

        const nextCognitoSession = updateCognitoSessionProfile(cognitoSession, input);

        writeStoredCognitoSession(window.localStorage, nextCognitoSession);
        writeStoredCognitoProfile(window.localStorage, nextCognitoSession);
        setCognitoSession(nextCognitoSession);
        setAuthError("");

        return {
          status: "updated",
          database,
          session: createBackupSessionFromCognito(nextCognitoSession),
          message: "Account details saved.",
        };
      }

      const result = updateBackupAccountProfile(database, session, input);

      setDatabase(result.database);

      if (result.session) {
        setSession(result.session);
      }

      return result;
    },
    [cognitoSession, database, session]
  );

  const applyMembershipAccess = useCallback((input: { tier: BackupMembershipTier; status?: "member" | "non_member" }) => {
    const membership = {
      status: input.status ?? "member",
      tier: input.tier,
    };

    setSession((current) => (current ? { ...current, membership } : current));
    setCognitoSession((current) => {
      if (!current) {
        return current;
      }

      const nextSession: CognitoAuthSession = {
        ...current,
        user: {
          ...current.user,
          membership,
        },
        claims: {
          ...current.claims,
          membershipTier: input.tier,
          memberStatus: membership.status,
          groups: [...new Set([...current.claims.groups, "member", normalizeMembershipGroup(input.tier)])],
        },
      };

      writeStoredCognitoSession(window.localStorage, nextSession);
      writeStoredCognitoProfile(window.localStorage, nextSession);
      return nextSession;
    });
    setAuthError("");
  }, []);

  const createApiHeaders = useCallback(async () => {
    if (!cognitoConfig || !cognitoSession) {
      return {};
    }

    if (!isCognitoSessionExpired(cognitoSession)) {
      return createCognitoApiHeaders(cognitoSession);
    }

    const nextSession = await refreshCognitoSession();

    if (!nextSession) {
      clearCognitoSession();
      setAuthError("Cognito session expired. Please sign in again.");
      return {};
    }

    writeStoredCognitoSession(window.localStorage, nextSession);
    writeStoredCognitoProfile(window.localStorage, nextSession);
    setCognitoSession(nextSession);
    setAuthError("");
    return createCognitoApiHeaders(nextSession);
  }, [cognitoConfig, cognitoSession, refreshCognitoSession, clearCognitoSession]);

  const signOut = useCallback(() => {
    if (cognitoSession) {
      clearCognitoSession();

      if (cognitoConfig) {
        window.location.href = buildCognitoLogoutUrl(cognitoConfig, {
          origin: window.location.origin,
          state: "signed-out",
        });
        return;
      }
      return;
    }

    setSession(null);
  }, [clearCognitoSession, cognitoConfig, cognitoSession]);

  const activeSession = cognitoSession ? createBackupSessionFromCognito(cognitoSession) : session;
  const currentUser = cognitoSession?.user ?? getSessionUser(database, session);
  const userView = getUserView(activeSession);
  const authSource = cognitoSession ? "cognito" : session ? "backup" : null;
  const value = useMemo<BackupAuthContextValue>(
    () => ({
      adminEmail: backupAdminEmail,
      database,
      session: activeSession,
      userView,
      authSource,
      cognitoConfig,
      cognitoSession,
      authError,
      isReady,
      isCognitoConfigured: Boolean(cognitoConfig),
      isCognitoSignedIn: Boolean(cognitoSession),
      isSignedIn: Boolean(activeSession),
      isAdmin: userView === "admin_member",
      isMember: userView === "member" || userView === "admin_member",
      currentUser,
      signIn,
      completeFirstLoginPassword,
      signUpWithSocial,
      signInWithCognitoPassword,
      signUpWithCognitoPassword,
      confirmCognitoSignUp,
      resendCognitoSignUpCode,
      startCognitoLogin,
      completeCognitoCallback,
      updateAccountProfile,
      applyMembershipAccess,
      clearCognitoSession,
      createApiHeaders,
      signOut,
    }),
    [
      activeSession,
      authError,
      authSource,
      clearCognitoSession,
      cognitoConfig,
      cognitoSession,
      completeCognitoCallback,
      completeFirstLoginPassword,
      createApiHeaders,
      currentUser,
      database,
      isReady,
      signIn,
      signInWithCognitoPassword,
      signUpWithCognitoPassword,
      signOut,
      startCognitoLogin,
      confirmCognitoSignUp,
      resendCognitoSignUpCode,
      applyMembershipAccess,
      signUpWithSocial,
      updateAccountProfile,
      userView,
    ]
  );

  return <BackupAuthContext.Provider value={value}>{children}</BackupAuthContext.Provider>;
}

export function useBackupAuth() {
  const context = useContext(BackupAuthContext);

  if (!context) {
    throw new Error("useBackupAuth must be used inside BackupAuthProvider");
  }

  return context;
}

export function useOptionalBackupAuth() {
  return useContext(BackupAuthContext);
}

function readStorage(key: string) {
  try {
    const value = window.localStorage.getItem(key);

    return value ? JSON.parse(value) : null;
  } catch {
    return null;
  }
}

function writeStorage(key: string, value: unknown) {
  window.localStorage.setItem(key, JSON.stringify(value));
}

function createBackupSessionFromCognito(session: CognitoAuthSession): BackupAuthSession {
  return {
    userId: session.user.id,
    email: session.user.email,
    name: session.user.name,
    phone: session.user.phone,
    shippingAddress: session.user.shippingAddress,
    role: session.user.role,
    membership: session.user.membership,
    signedInAt: session.issuedAt,
  };
}

function normalizeMembershipGroup(tier: BackupMembershipTier) {
  return tier.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}
