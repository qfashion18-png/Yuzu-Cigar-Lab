import assert from "node:assert/strict";
import test from "node:test";

import {
  type AccountShippingAddress,
  backupAdminEmail,
  completeFirstLoginPasswordSetup,
  createBackupAuthDatabase,
  getUserView,
  isBackupAdminAllowedForEnvironment,
  isLiveAuthRequiredForEnvironment,
  signInWithPassword,
  signUpWithSocialProvider,
  updateBackupAccountProfile,
} from "../src/lib/backup-auth";

test("seeds the backup admin account with first-login password setup required", () => {
  const database = createBackupAuthDatabase();
  const admin = database.users.find((user) => user.email === backupAdminEmail);

  assert.ok(admin);
  assert.equal(admin.role, "admin");
  assert.equal(admin.membership.status, "member");
  assert.equal(admin.membership.tier, "Daimyo");
  assert.equal(admin.passwordSetupRequired, true);
  assert.equal(admin.passwordHash, null);
});

test("can initialize backup auth without seed users for live-auth deployments", () => {
  const database = createBackupAuthDatabase(undefined, { includeAdminSeed: false });

  assert.deepEqual(database.users, []);
});

test("requires the admin to set a new password before password login works", () => {
  const database = createBackupAuthDatabase();
  const blockedLogin = signInWithPassword(database, {
    email: backupAdminEmail,
    password: "YuzuBackup2026!",
  });

  assert.equal(blockedLogin.status, "password_setup_required");
  assert.equal(blockedLogin.session, null);

  const setup = completeFirstLoginPasswordSetup(database, {
    email: backupAdminEmail,
    password: "YuzuBackup2026!",
    confirmPassword: "YuzuBackup2026!",
  });

  assert.equal(setup.status, "signed_in");
  assert.equal(setup.session?.role, "admin");
  assert.equal(setup.database.users.find((user) => user.email === backupAdminEmail)?.passwordSetupRequired, false);

  const nextLogin = signInWithPassword(setup.database, {
    email: backupAdminEmail,
    password: "YuzuBackup2026!",
  });

  assert.equal(nextLogin.status, "signed_in");
  assert.equal(nextLogin.session?.email, backupAdminEmail);
});

test("rejects weak or mismatched first-login passwords", () => {
  const database = createBackupAuthDatabase();

  assert.equal(
    completeFirstLoginPasswordSetup(database, {
      email: backupAdminEmail,
      password: "short",
      confirmPassword: "short",
    }).status,
    "weak_password"
  );
  assert.equal(
    completeFirstLoginPasswordSetup(database, {
      email: backupAdminEmail,
      password: "YuzuBackup2026!",
      confirmPassword: "YuzuBackup2027!",
    }).status,
    "password_mismatch"
  );
});

test("social provider signup creates a non-member account session", () => {
  const database = createBackupAuthDatabase();
  const signup = signUpWithSocialProvider(database, {
    provider: "google",
    email: "collector@example.com",
    name: "Morgan Collector",
  });

  assert.equal(signup.status, "signed_in");
  assert.equal(signup.session?.email, "collector@example.com");
  assert.equal(signup.session?.membership.status, "non_member");
  assert.equal(signup.database.users.find((user) => user.email === "collector@example.com")?.socialProvider, "google");
});

test("social provider signup rejects invalid email addresses", () => {
  const database = createBackupAuthDatabase();
  const signup = signUpWithSocialProvider(database, {
    provider: "facebook",
    email: "not-an-email",
    name: "Bad Email",
  });

  assert.equal(signup.status, "invalid_credentials");
  assert.equal(signup.session, null);
  assert.equal(signup.database.users.length, database.users.length);
});

test("classifies member, admin, and non-member site views from the active session", () => {
  const database = createBackupAuthDatabase();
  const adminSetup = completeFirstLoginPasswordSetup(database, {
    email: backupAdminEmail,
    password: "YuzuBackup2026!",
    confirmPassword: "YuzuBackup2026!",
  });
  const socialSignup = signUpWithSocialProvider(adminSetup.database, {
    provider: "instagram",
    email: "guest@example.com",
    name: "Guest Prospect",
  });

  assert.equal(getUserView(null), "non_member");
  assert.equal(getUserView(adminSetup.session), "admin_member");
  assert.equal(getUserView(socialSignup.session), "non_member_account");
});

test("updates editable backup account profile fields for the active session", () => {
  const database = createBackupAuthDatabase();
  const signup = signUpWithSocialProvider(database, {
    provider: "google",
    email: "collector@example.com",
    name: "Morgan Collector",
  });

  assert.ok(signup.session);

  const update = updateBackupAccountProfile(
    signup.database,
    signup.session,
    {
      name: "  Morgan Aficionado  ",
      phone: "  480-555-0188  ",
    },
    "2026-05-08T10:00:00.000Z"
  );

  assert.equal(update.status, "updated");
  assert.equal(update.session?.name, "Morgan Aficionado");
  assert.equal(update.session?.phone, "480-555-0188");

  const user = update.database.users.find((candidate) => candidate.id === signup.session?.userId);
  assert.equal(user?.name, "Morgan Aficionado");
  assert.equal(user?.phone, "480-555-0188");
  assert.equal(user?.updatedAt, "2026-05-08T10:00:00.000Z");
});

test("updates saved backup account shipping address for checkout reuse", () => {
  const database = createBackupAuthDatabase();
  const signup = signUpWithSocialProvider(database, {
    provider: "google",
    email: "collector@example.com",
    name: "Morgan Collector",
  });

  assert.ok(signup.session);

  const shippingAddress: AccountShippingAddress = {
    address1: "  111 W Boston St  ",
    address2: " Suite 200 ",
    city: " Chandler ",
    state: " az ",
    postalCode: " 85225 ",
    country: " us ",
  };
  const update = updateBackupAccountProfile(
    signup.database,
    signup.session,
    {
      name: "Morgan Collector",
      phone: "480-555-0188",
      shippingAddress,
    },
    "2026-05-08T10:00:00.000Z"
  );

  assert.equal(update.status, "updated");
  assert.deepEqual(update.session?.shippingAddress, {
    address1: "111 W Boston St",
    address2: "Suite 200",
    city: "Chandler",
    state: "AZ",
    postalCode: "85225",
    country: "US",
  });

  const user = update.database.users.find((candidate) => candidate.id === signup.session?.userId);
  assert.deepEqual(user?.shippingAddress, update.session?.shippingAddress);
});

test("rejects backup account profile updates without a signed-in user or display name", () => {
  const database = createBackupAuthDatabase();

  assert.equal(
    updateBackupAccountProfile(database, null, {
      name: "Morgan",
      phone: "",
    }).status,
    "not_signed_in"
  );

  const signup = signUpWithSocialProvider(database, {
    provider: "instagram",
    email: "collector@example.com",
    name: "Morgan Collector",
  });

  assert.ok(signup.session);
  assert.equal(
    updateBackupAccountProfile(signup.database, signup.session, {
      name: "   ",
      phone: "",
    }).status,
    "invalid_profile"
  );
});

test("local backup admin cannot grant production admin access without an explicit feature flag", () => {
  assert.equal(
    isBackupAdminAllowedForEnvironment({
      nodeEnv: "production",
      featureFlag: "false",
    }),
    false
  );
  assert.equal(
    isBackupAdminAllowedForEnvironment({
      nodeEnv: "production",
      featureFlag: "true",
    }),
    true
  );
  assert.equal(
    isBackupAdminAllowedForEnvironment({
      nodeEnv: "development",
      featureFlag: undefined,
    }),
    true
  );
});

test("live auth is required in production or when the public flag is enabled", () => {
  assert.equal(
    isLiveAuthRequiredForEnvironment({
      nodeEnv: "production",
      featureFlag: "false",
    }),
    true
  );
  assert.equal(
    isLiveAuthRequiredForEnvironment({
      nodeEnv: "development",
      featureFlag: "true",
    }),
    true
  );
  assert.equal(
    isLiveAuthRequiredForEnvironment({
      nodeEnv: "development",
      featureFlag: undefined,
    }),
    false
  );
});
