export type AdminAccessPublicEnv = Partial<Record<"NEXT_PUBLIC_ADMIN_APP_URL" | "NEXT_PUBLIC_BASE_URL", string | undefined>>;

export function resolveAdminAppUrl(env: AdminAccessPublicEnv = getPublicEnv()) {
  return resolveHttpUrl(env.NEXT_PUBLIC_ADMIN_APP_URL);
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

function getPublicEnv(): AdminAccessPublicEnv {
  return {
    NEXT_PUBLIC_ADMIN_APP_URL: process.env.NEXT_PUBLIC_ADMIN_APP_URL,
  };
}
