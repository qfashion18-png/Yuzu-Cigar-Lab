import {
  resolveCognitoConfig,
  signInWithCognitoPassword,
  type CognitoPublicEnv,
} from "./cognito-auth";

export type NewsroomAutomationEnv = Partial<Record<string, string | undefined>>;

export type NewsroomAutomationAuth = {
  authorizationHeader: string;
  source: "cognito_password" | "bearer_env";
  expiresAt: string | null;
  username: string | null;
};

type NewsroomAuthFetch = (
  url: string,
  init: RequestInit
) => Promise<{
  ok: boolean;
  json: () => Promise<unknown>;
}>;

export async function resolveNewsroomAutomationAuth(
  env: NewsroomAutomationEnv = process.env,
  fetchImpl: NewsroomAuthFetch = globalThis.fetch.bind(globalThis) as NewsroomAuthFetch,
): Promise<NewsroomAutomationAuth> {
  const username = readEnv(env, "YCC_NEWSROOM_COGNITO_USERNAME");
  const password = readEnv(env, "YCC_NEWSROOM_COGNITO_PASSWORD");

  if (username || password) {
    if (!username || !password) {
      throw new Error("Set both YCC_NEWSROOM_COGNITO_USERNAME and YCC_NEWSROOM_COGNITO_PASSWORD for newsroom automation.");
    }

    const config = resolveCognitoConfig(env as CognitoPublicEnv);
    if (!config) {
      throw new Error("Cognito public environment is not configured for newsroom automation sign-in.");
    }

    const result = await signInWithCognitoPassword(config, { username, password }, fetchImpl);
    if (result.status !== "signed_in") {
      throw new Error(`Cognito newsroom sign-in failed: ${result.message}`);
    }

    return {
      authorizationHeader: `Bearer ${result.session.tokens.idToken}`,
      source: "cognito_password",
      expiresAt: result.session.expiresAt,
      username: result.session.user.email,
    };
  }

  const bearerToken = readEnv(env, "YCC_NEWSROOM_BEARER_TOKEN");
  if (bearerToken) {
    return {
      authorizationHeader: bearerToken.startsWith("Bearer ") ? bearerToken : `Bearer ${bearerToken}`,
      source: "bearer_env",
      expiresAt: null,
      username: null,
    };
  }

  throw new Error(
    "Missing newsroom auth. Set YCC_NEWSROOM_COGNITO_USERNAME and YCC_NEWSROOM_COGNITO_PASSWORD, or provide YCC_NEWSROOM_BEARER_TOKEN.",
  );
}

function readEnv(env: NewsroomAutomationEnv, name: string) {
  const value = env[name];
  return value?.trim() ? value.trim() : "";
}
