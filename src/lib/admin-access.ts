export type AdminAccessPublicEnv = Partial<Record<"NEXT_PUBLIC_ADMIN_APP_URL" | "NEXT_PUBLIC_BASE_URL", string | undefined>>;

const adminHostName = "admin.yuzucigarclub.com";
const adminConsolePath = "/admin/console/";

export function resolveAdminAppUrl(env: AdminAccessPublicEnv = getPublicEnv()) {
  const url = resolveHttpUrl(env.NEXT_PUBLIC_ADMIN_APP_URL);

  if (!url) {
    return null;
  }

  return normalizeAdminConsoleUrl(url);
}

function resolveHttpUrl(value: string | undefined) {
  const trimmed = value?.trim();

  if (!trimmed) {
    return null;
  }

  try {
    const url = new URL(trimmed);

    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : null;
  } catch {
    return null;
  }
}

function normalizeAdminConsoleUrl(value: string) {
  const url = new URL(value);

  if (url.hostname.toLowerCase() === adminHostName && (url.pathname === "/" || url.pathname === "/admin/console")) {
    url.pathname = adminConsolePath;
  }

  return url.toString();
}

function getPublicEnv(): AdminAccessPublicEnv {
  return {
    NEXT_PUBLIC_ADMIN_APP_URL: process.env.NEXT_PUBLIC_ADMIN_APP_URL,
  };
}
