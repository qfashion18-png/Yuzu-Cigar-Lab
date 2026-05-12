type Env = Record<string, string | undefined>;

const networkErrorCodes = new Set(["ETIMEDOUT", "ETIMEOUT", "ENETUNREACH", "EHOSTUNREACH", "ECONNREFUSED"]);

export function isDatabaseNetworkError(error: unknown) {
  const code = typeof error === "object" && error && "code" in error ? String(error.code) : "";
  if (networkErrorCodes.has(code)) {
    return true;
  }

  const message = error instanceof Error ? error.message : String(error);
  return /connection.*timeout|timed?out|network.*unreachable|host.*unreachable|connection refused/i.test(message);
}

export function getDatabaseHealthEndpoint(env: Env = process.env) {
  const baseUrl = (env.YCC_API_BASE_URL || env.NEXT_PUBLIC_YCC_API_BASE_URL || "").trim().replace(/\/+$/, "");
  return baseUrl ? `${baseUrl}/health?deep=1` : null;
}
