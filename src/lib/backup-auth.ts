export const backupAdminEmail = "quon@thecompanyq.com";

export type BackupUserRole = "admin" | "customer";
export type BackupMembershipTier = "Box Access Pass" | "Kisha" | "Sensei" | "Daimyo";
export type BackupMembershipStatus = "member" | "non_member";
export type SocialSignupProvider = "google" | "instagram" | "facebook";
export type BackupUserView = "non_member" | "non_member_account" | "member" | "admin_member";

export type BackupMembership = {
  status: BackupMembershipStatus;
  tier: BackupMembershipTier | null;
};

export type AccountShippingAddress = {
  address1: string;
  address2: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
};

export type BackupAuthUser = {
  id: string;
  email: string;
  name: string;
  phone: string;
  shippingAddress: AccountShippingAddress;
  role: BackupUserRole;
  membership: BackupMembership;
  passwordHash: string | null;
  passwordSetupRequired: boolean;
  socialProvider: SocialSignupProvider | null;
  createdAt: string;
  updatedAt: string;
};

export type BackupAuthSession = {
  userId: string;
  email: string;
  name: string;
  phone: string;
  shippingAddress: AccountShippingAddress;
  role: BackupUserRole;
  membership: BackupMembership;
  signedInAt: string;
};

export type BackupAuthDatabase = {
  version: 1;
  users: BackupAuthUser[];
};

export type BackupAuthDatabaseOptions = {
  includeAdminSeed?: boolean;
};

export type BackupAdminEnvironmentInput = {
  nodeEnv?: string;
  featureFlag?: string;
};

export type LiveAuthEnvironmentInput = {
  nodeEnv?: string;
  featureFlag?: string;
};

export type PasswordLoginInput = {
  email: string;
  password: string;
};

export type FirstLoginPasswordInput = PasswordLoginInput & {
  confirmPassword: string;
};

export type SocialSignupInput = {
  provider: SocialSignupProvider;
  email: string;
  name: string;
};

export type BackupAuthResultStatus =
  | "signed_in"
  | "invalid_credentials"
  | "password_setup_required"
  | "password_mismatch"
  | "weak_password";

export type BackupAuthResult = {
  status: BackupAuthResultStatus;
  database: BackupAuthDatabase;
  session: BackupAuthSession | null;
  message: string;
};

export type AccountProfileInput = {
  name: string;
  phone: string;
  shippingAddress?: Partial<AccountShippingAddress> | null;
};

export type AccountProfileUpdateStatus = "updated" | "invalid_profile" | "not_signed_in";

export type AccountProfileUpdateResult = {
  status: AccountProfileUpdateStatus;
  database: BackupAuthDatabase;
  session: BackupAuthSession | null;
  message: string;
};

const defaultTimestamp = "2026-05-06T00:00:00.000Z";

export const emptyAccountShippingAddress: AccountShippingAddress = {
  address1: "",
  address2: "",
  city: "",
  state: "",
  postalCode: "",
  country: "US",
};

export function createBackupAuthDatabase(now = defaultTimestamp, options: BackupAuthDatabaseOptions = {}): BackupAuthDatabase {
  const includeAdminSeed = options.includeAdminSeed !== false;

  return {
    version: 1,
    users: includeAdminSeed
      ? [
          {
            id: "backup-user-admin-quon",
            email: backupAdminEmail,
            name: "Quon Admin",
            phone: "",
            shippingAddress: emptyAccountShippingAddress,
            role: "admin",
            membership: {
              status: "member",
              tier: "Daimyo",
            },
            passwordHash: null,
            passwordSetupRequired: true,
            socialProvider: null,
            createdAt: now,
            updatedAt: now,
          },
        ]
      : [],
  };
}

export function signInWithPassword(
  database: BackupAuthDatabase,
  input: PasswordLoginInput,
  now = new Date().toISOString()
): BackupAuthResult {
  const email = normalizeEmail(input.email);
  const user = findUserByEmail(database, email);

  if (!user) {
    return failure("invalid_credentials", database, "No backup account matches that email.");
  }

  if (user.passwordSetupRequired) {
    return failure("password_setup_required", database, "Set a new password before signing in.");
  }

  if (!user.passwordHash || user.passwordHash !== hashBackupCredential(input.password, user.email)) {
    return failure("invalid_credentials", database, "Email or password is incorrect.");
  }

  return {
    status: "signed_in",
    database,
    session: createSession(user, now),
    message: "Signed in.",
  };
}

export function completeFirstLoginPasswordSetup(
  database: BackupAuthDatabase,
  input: FirstLoginPasswordInput,
  now = new Date().toISOString()
): BackupAuthResult {
  const email = normalizeEmail(input.email);
  const user = findUserByEmail(database, email);

  if (!user || !user.passwordSetupRequired) {
    return failure("invalid_credentials", database, "This account is not ready for first-login password setup.");
  }

  if (input.password !== input.confirmPassword) {
    return failure("password_mismatch", database, "Passwords do not match.");
  }

  if (!isStrongPassword(input.password)) {
    return failure("weak_password", database, "Use at least 10 characters with letters, numbers, and a symbol.");
  }

  const updatedUser: BackupAuthUser = {
    ...user,
    passwordHash: hashBackupCredential(input.password, user.email),
    passwordSetupRequired: false,
    updatedAt: now,
  };
  const nextDatabase = replaceUser(database, updatedUser);

  return {
    status: "signed_in",
    database: nextDatabase,
    session: createSession(updatedUser, now),
    message: "Password created and admin signed in.",
  };
}

export function signUpWithSocialProvider(
  database: BackupAuthDatabase,
  input: SocialSignupInput,
  now = new Date().toISOString()
): BackupAuthResult {
  const email = normalizeEmail(input.email);

  if (!isValidEmail(email)) {
    return failure("invalid_credentials", database, "Enter a valid email to use social sign-up.");
  }

  const existingUser = findUserByEmail(database, email);

  if (existingUser) {
    const updatedUser: BackupAuthUser = {
      ...existingUser,
      name: input.name.trim() || existingUser.name,
      socialProvider: input.provider,
      updatedAt: now,
    };
    const nextDatabase = replaceUser(database, updatedUser);

    return {
      status: "signed_in",
      database: nextDatabase,
      session: createSession(updatedUser, now),
      message: `Signed in with ${formatProvider(input.provider)}.`,
    };
  }

  const user: BackupAuthUser = {
    id: `backup-user-${slugify(email)}`,
    email,
    name: input.name.trim() || "Yuzu Guest",
    phone: "",
    shippingAddress: emptyAccountShippingAddress,
    role: "customer",
    membership: {
      status: "non_member",
      tier: null,
    },
    passwordHash: null,
    passwordSetupRequired: false,
    socialProvider: input.provider,
    createdAt: now,
    updatedAt: now,
  };
  const nextDatabase = {
    ...database,
    users: [...database.users, user],
  };

  return {
    status: "signed_in",
    database: nextDatabase,
    session: createSession(user, now),
    message: `Signed up with ${formatProvider(input.provider)}.`,
  };
}

export function getUserView(session: BackupAuthSession | null): BackupUserView {
  if (!session) {
    return "non_member";
  }

  if (session.role === "admin" && session.membership.status === "member") {
    return "admin_member";
  }

  if (session.membership.status === "member") {
    return "member";
  }

  return "non_member_account";
}

export function updateBackupAccountProfile(
  database: BackupAuthDatabase,
  session: BackupAuthSession | null,
  input: AccountProfileInput,
  now = new Date().toISOString()
): AccountProfileUpdateResult {
  if (!session) {
    return {
      status: "not_signed_in",
      database,
      session: null,
      message: "Sign in before updating account details.",
    };
  }

  const user = getSessionUser(database, session);

  if (!user) {
    return {
      status: "not_signed_in",
      database,
      session: null,
      message: "Sign in before updating account details.",
    };
  }

  const name = normalizeProfileText(input.name);

  if (!name) {
    return {
      status: "invalid_profile",
      database,
      session,
      message: "Enter a display name.",
    };
  }

  const updatedUser: BackupAuthUser = {
    ...user,
    name,
    phone: normalizeProfileText(input.phone),
    shippingAddress: normalizeAccountShippingAddress(input.shippingAddress ?? user.shippingAddress),
    updatedAt: now,
  };
  const nextDatabase = replaceUser(database, updatedUser);

  return {
    status: "updated",
    database: nextDatabase,
    session: createSession(updatedUser, session.signedInAt),
    message: "Account details saved.",
  };
}

export function normalizeBackupDatabase(value: unknown, options: BackupAuthDatabaseOptions = {}): BackupAuthDatabase {
  if (!isBackupAuthDatabase(value)) {
    return createBackupAuthDatabase(defaultTimestamp, options);
  }

  const seed = createBackupAuthDatabase(defaultTimestamp, options);
  const usersByEmail = new Map(seed.users.map((user) => [user.email, user]));

  for (const user of value.users) {
    usersByEmail.set(user.email, normalizeBackupUser(user));
  }

  if (!usersByEmail.has(backupAdminEmail)) {
    usersByEmail.set(backupAdminEmail, seed.users[0]);
  }

  return {
    version: 1,
    users: [...usersByEmail.values()].map(normalizeBackupUser),
  };
}

export function getSessionUser(database: BackupAuthDatabase, session: BackupAuthSession | null) {
  if (!session) {
    return null;
  }

  return database.users.find((user) => user.id === session.userId) ?? null;
}

export function createBackupAuthSession(user: BackupAuthUser, now: string): BackupAuthSession {
  return {
    userId: user.id,
    email: user.email,
    name: user.name,
    phone: user.phone,
    shippingAddress: normalizeAccountShippingAddress(user.shippingAddress),
    role: user.role,
    membership: user.membership,
    signedInAt: now,
  };
}

export function normalizeAccountShippingAddress(value: Partial<AccountShippingAddress> | null | undefined): AccountShippingAddress {
  return {
    address1: normalizeProfileText(value?.address1 ?? ""),
    address2: normalizeProfileText(value?.address2 ?? ""),
    city: normalizeProfileText(value?.city ?? ""),
    state: normalizeStateLabel(value?.state ?? ""),
    postalCode: normalizeProfileText(value?.postalCode ?? ""),
    country: normalizeCountryCode(value?.country ?? ""),
  };
}

export function hasCompleteAccountShippingAddress(address: Partial<AccountShippingAddress> | null | undefined) {
  const normalized = normalizeAccountShippingAddress(address);

  return Boolean(normalized.address1 && normalized.city && normalized.state && normalized.postalCode && normalized.country);
}

export function isBackupAdminAllowedForEnvironment(input: BackupAdminEnvironmentInput = {}) {
  if (input.featureFlag === "true") {
    return true;
  }

  return input.nodeEnv !== "production";
}

export function isLiveAuthRequiredForEnvironment(input: LiveAuthEnvironmentInput = {}) {
  return input.featureFlag === "true" || input.nodeEnv === "production";
}

function createSession(user: BackupAuthUser, now: string): BackupAuthSession {
  return createBackupAuthSession(user, now);
}

function failure(status: Exclude<BackupAuthResultStatus, "signed_in">, database: BackupAuthDatabase, message: string) {
  return {
    status,
    database,
    session: null,
    message,
  };
}

function findUserByEmail(database: BackupAuthDatabase, email: string) {
  return database.users.find((user) => user.email === normalizeEmail(email)) ?? null;
}

function replaceUser(database: BackupAuthDatabase, updatedUser: BackupAuthUser): BackupAuthDatabase {
  return {
    ...database,
    users: database.users.map((user) => (user.id === updatedUser.id ? updatedUser : user)),
  };
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function normalizeProfileText(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

function normalizeStateLabel(value: string) {
  const normalized = normalizeProfileText(value);

  if (normalized.length === 2) {
    return normalized.toUpperCase();
  }

  return normalized === normalized.toLowerCase()
    ? normalized.replace(/\b[a-z]/g, (letter) => letter.toUpperCase())
    : normalized;
}

function normalizeCountryCode(value: string) {
  const normalized = normalizeProfileText(value);

  return normalized.length === 2 ? normalized.toUpperCase() : normalized || "US";
}

function isStrongPassword(password: string) {
  return password.length >= 10 && /[a-z]/i.test(password) && /\d/.test(password) && /[^a-z0-9]/i.test(password);
}

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function hashBackupCredential(password: string, email: string) {
  const value = `${normalizeEmail(email)}::${password}`;
  let hash = 2166136261;

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return `backup_${(hash >>> 0).toString(36)}`;
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function formatProvider(provider: SocialSignupProvider) {
  return provider.charAt(0).toUpperCase() + provider.slice(1);
}

function isBackupAuthDatabase(value: unknown): value is BackupAuthDatabase {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as BackupAuthDatabase;

  return candidate.version === 1 && Array.isArray(candidate.users);
}

function normalizeBackupUser(user: BackupAuthUser): BackupAuthUser {
  return {
    ...user,
    phone: typeof user.phone === "string" ? user.phone : "",
    shippingAddress: normalizeAccountShippingAddress(
      (user as BackupAuthUser & { shippingAddress?: Partial<AccountShippingAddress> }).shippingAddress
    ),
  };
}
