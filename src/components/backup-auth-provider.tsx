"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

import {
  type BackupAuthDatabase,
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
  buildCognitoLogoutUrl,
  buildCognitoTokenRequestBody,
  buildCognitoRefreshRequestBody,
  clearPendingCognitoLogin,
  clearStoredCognitoSession,
  createCognitoApiHeaders,
  isCognitoSessionExpired,
  createCognitoSessionFromTokens,
  getTokenEndpoint,
  readPendingCognitoLogin,
  readStoredCognitoSession,
  resolveCognitoConfig,
  resolveRedirectUri,
  signInWithCognitoPassword as signInWithCognitoPasswordRequest,
  getCognitoTokenResponse,
  updateCognitoSessionProfile,
  writeStoredCognitoSession,
  type CognitoAuthConfig,
  type CognitoAuthSession,
  type CognitoPasswordSignInInput,
  type CognitoPasswordSignInResult,
} from "@/lib/cognito-auth";

type CognitoCallbackResult = {
  status: "signed_in" | "error";
  message: string;
  redirectPath?: string;
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
  completeCognitoCallback: (url?: string) => Promise<CognitoCallbackResult>;
  updateAccountProfile: (input: AccountProfileInput) => AccountProfileUpdateResult;
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
    const nextCognitoSession = readStoredCognitoSession(window.localStorage);

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

    return createCognitoSessionFromTokens({
      ...nextTokenResponse,
      refresh_token: nextTokenResponse.refresh_token ?? cognitoSession.tokens.refreshToken,
    });
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
        writeStoredCognitoSession(window.localStorage, result.session);
        clearPendingCognitoLogin(window.sessionStorage);
        window.localStorage.removeItem(sessionStorageKey);
        setSession(null);
        setCognitoSession(result.session);
        setAuthError("");
        return result;
      }

      setAuthError(result.message);
      return result;
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

      const nextCognitoSession = createCognitoSessionFromTokens(tokenResponse);

      writeStoredCognitoSession(window.localStorage, nextCognitoSession);
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
      completeCognitoCallback,
      updateAccountProfile,
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
      signOut,
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
