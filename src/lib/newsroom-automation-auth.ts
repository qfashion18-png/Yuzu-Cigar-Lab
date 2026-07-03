import { request as httpRequest, type OutgoingHttpHeaders } from "node:http";
import { request as httpsRequest } from "node:https";

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
  fetchImpl?: NewsroomAuthFetch,
): Promise<NewsroomAutomationAuth> {
  const username = readEnv(env, "YCC_NEWSROOM_COGNITO_USERNAME");
  const password = readEnv(env, "YCC_NEWSROOM_COGNITO_PASSWORD");
  const bearerToken = readEnv(env, "YCC_NEWSROOM_BEARER_TOKEN");

  if (username || password) {
    if (!username || !password) {
      if (bearerToken) {
        console.warn("Newsroom Cognito auth is partially configured; falling back to YCC_NEWSROOM_BEARER_TOKEN.");
        return buildBearerAuth(bearerToken);
      }

      throw new Error("Set both YCC_NEWSROOM_COGNITO_USERNAME and YCC_NEWSROOM_COGNITO_PASSWORD for newsroom automation.");
    }

    const config = resolveCognitoConfig(env as CognitoPublicEnv);
    if (!config) {
      if (bearerToken) {
        console.warn("Cognito public environment is not configured for newsroom automation sign-in; falling back to YCC_NEWSROOM_BEARER_TOKEN.");
        return buildBearerAuth(bearerToken);
      }

      throw new Error("Cognito public environment is not configured for newsroom automation sign-in.");
    }

    const result = await signInWithCognitoPassword(config, { username, password }, fetchImpl ?? buildCognitoFetch(env));
    if (result.status !== "signed_in") {
      if (bearerToken) {
        console.warn(`Cognito newsroom sign-in failed: ${result.message}. Falling back to YCC_NEWSROOM_BEARER_TOKEN.`);
        return buildBearerAuth(bearerToken);
      }

      throw new Error(`Cognito newsroom sign-in failed: ${result.message}`);
    }

    return {
      authorizationHeader: `Bearer ${result.session.tokens.idToken}`,
      source: "cognito_password",
      expiresAt: result.session.expiresAt,
      username: result.session.user.email,
    };
  }

  if (bearerToken) {
    return buildBearerAuth(bearerToken);
  }

  throw new Error(
    "Missing newsroom auth. Set YCC_NEWSROOM_COGNITO_USERNAME and YCC_NEWSROOM_COGNITO_PASSWORD, or provide YCC_NEWSROOM_BEARER_TOKEN.",
  );
}

function buildBearerAuth(bearerToken: string): NewsroomAutomationAuth {
  return {
    authorizationHeader: bearerToken.startsWith("Bearer ") ? bearerToken : `Bearer ${bearerToken}`,
    source: "bearer_env",
    expiresAt: null,
    username: null,
  };
}

function readEnv(env: NewsroomAutomationEnv, name: string) {
  const value = env[name];
  return value?.trim() ? value.trim() : "";
}

function readBooleanEnv(env: NewsroomAutomationEnv, name: string) {
  return readEnv(env, name).toLowerCase() === "true";
}

function buildCognitoFetch(env: NewsroomAutomationEnv): NewsroomAuthFetch {
  if (!readBooleanEnv(env, "YCC_NEWSROOM_COGNITO_TLS_INSECURE")) {
    return globalThis.fetch.bind(globalThis) as NewsroomAuthFetch;
  }

  return async (url: string, init: RequestInit) => {
    const target = new URL(url);
    const requestImpl = target.protocol === "https:" ? httpsRequest : httpRequest;
    const headers: OutgoingHttpHeaders | undefined = init.headers
      ? Object.fromEntries(new Headers(init.headers))
      : undefined;

    return await new Promise((resolve, reject) => {
      const request = requestImpl(
        target,
        {
          method: init.method || "GET",
          headers,
          ...(target.protocol === "https:" ? { rejectUnauthorized: false } : {}),
        },
        (response) => {
          const chunks: Buffer[] = [];
          response.on("data", (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
          response.on("end", () => {
            const text = Buffer.concat(chunks).toString("utf8");
            resolve({
              ok: (response.statusCode || 500) >= 200 && (response.statusCode || 500) < 300,
              async json() {
                try {
                  return text ? JSON.parse(text) : {};
                } catch {
                  return {};
                }
              },
            });
          });
        },
      );

      request.on("error", reject);

      if (typeof init.body === "string" || Buffer.isBuffer(init.body)) {
        request.write(init.body);
      } else if (init.body) {
        request.write(String(init.body));
      }

      request.end();
    });
  };
}
