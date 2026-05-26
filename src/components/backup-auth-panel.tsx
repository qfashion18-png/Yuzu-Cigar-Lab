"use client";

import Link from "@/components/static-link";
import { BadgeCheck, ExternalLink, KeyRound, LoaderCircle, LogIn, LogOut, ShieldCheck, UserPlus } from "lucide-react";
import { FormEvent, useState } from "react";

import { useBackupAuth } from "@/components/backup-auth-provider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { resolveAdminAppUrl } from "@/lib/admin-access";
import { isBackupAdminAllowedForEnvironment, isLiveAuthRequiredForEnvironment, type SocialSignupProvider } from "@/lib/backup-auth";
import { cn } from "@/lib/utils";

type BackupAuthPanelProps = {
  intent?: "account" | "admin";
  className?: string;
  adminAppUrl?: string | null;
  requireCognito?: boolean;
};

const socialProviders: Array<{ id: SocialSignupProvider; label: string }> = [
  { id: "google", label: "Google" },
  { id: "instagram", label: "Instagram" },
  { id: "facebook", label: "Facebook" },
];

export function BackupAuthPanel({ intent = "account", className, adminAppUrl: adminAppUrlProp, requireCognito = false }: BackupAuthPanelProps) {
  const auth = useBackupAuth();
  const isAdminAccess = intent === "admin";
  const adminAppUrl = isAdminAccess ? (adminAppUrlProp ?? resolveAdminAppUrl()) : null;
  const backupAdminAllowed = isBackupAdminAllowedForEnvironment({
    nodeEnv: process.env.NODE_ENV,
    featureFlag: process.env.NEXT_PUBLIC_ENABLE_BACKUP_ADMIN,
  });
  const liveAuthRequired = isLiveAuthRequiredForEnvironment({
    nodeEnv: process.env.NODE_ENV,
    featureFlag: process.env.NEXT_PUBLIC_REQUIRE_LIVE_AUTH,
  });
  const requiresLiveCognito = liveAuthRequired || requireCognito;
  const [email, setEmail] = useState(intent === "admin" ? auth.adminEmail : "");
  const [password, setPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [socialName, setSocialName] = useState("");
  const [socialEmail, setSocialEmail] = useState("");
  const [setupMode, setSetupMode] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [isCognitoSubmitting, setIsCognitoSubmitting] = useState(false);
  const [cognitoChallenge, setCognitoChallenge] = useState<{ name: string; message: string } | null>(null);
  const cognitoAvailable = auth.isCognitoConfigured;

  async function handleCognitoPasswordLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsCognitoSubmitting(true);
    setStatusMessage("Signing in with Cognito...");

    try {
      const result = await auth.signInWithCognitoPassword({ username: email, password });
      setStatusMessage(result.message);

      if (result.status === "signed_in") {
        setPassword("");
        setCognitoChallenge(null);
      } else if (result.status === "challenge_required") {
        setCognitoChallenge({ name: result.challengeName, message: result.message });
      } else {
        setCognitoChallenge(null);
      }
    } finally {
      setIsCognitoSubmitting(false);
    }
  }

  async function handleHostedCognitoLogin() {
    setIsCognitoSubmitting(true);
    setStatusMessage("Opening hosted Cognito sign-in...");

    try {
      const result = await auth.startCognitoLogin();
      setStatusMessage(result.message);
    } finally {
      setIsCognitoSubmitting(false);
    }
  }

  function handlePasswordLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const result = auth.signIn({ email, password });

    setStatusMessage(result.message);
    setSetupMode(result.status === "password_setup_required");
  }

  function handlePasswordSetup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const result = auth.completeFirstLoginPassword({
      email,
      password: newPassword,
      confirmPassword,
    });

    setStatusMessage(result.message);

    if (result.status === "signed_in") {
      setSetupMode(false);
      setPassword("");
      setNewPassword("");
      setConfirmPassword("");
    }
  }

  function handleSocialSignup(provider: SocialSignupProvider) {
    const result = auth.signUpWithSocial({
      provider,
      email: socialEmail,
      name: socialName,
    });

    setStatusMessage(result.message);
  }

  if (isAdminAccess && !backupAdminAllowed && auth.authSource !== "cognito") {
    return (
      <Card className={cn("luxury-card", className)}>
        <CardHeader>
          <CardTitle className="flex items-center gap-3 text-sm uppercase tracking-[0.16em] text-yuzu-gold">
            <ShieldCheck />
            Cognito Admin Required
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-5">
          <p className="text-sm leading-6 text-yuzu-muted">
            Production builds do not accept local backup admin credentials. Sign in here with a Cognito admin account so the Yuzu API can verify RBAC.
          </p>
          {cognitoAvailable ? renderCognitoForm() : null}
          <p className="min-h-5 text-sm text-yuzu-gold" aria-live="polite">
            {statusMessage || auth.authError}
          </p>
        </CardContent>
      </Card>
    );
  }

  if (requiresLiveCognito && auth.authSource !== "cognito") {
    return (
      <Card className={cn("luxury-card", className)}>
        <CardHeader>
          <CardTitle className="flex items-center gap-3 text-sm uppercase tracking-[0.16em] text-yuzu-gold">
            {isAdminAccess ? <ShieldCheck /> : <KeyRound />}
            {isAdminAccess ? "Cognito Admin Required" : "Cognito Member Required"}
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-5">
          <p className="text-sm leading-6 text-yuzu-muted">
            This deployment requires live Cognito authentication. Sign in here to load live member, order, admin, or humidor API records.
          </p>
          {cognitoAvailable ? renderCognitoForm() : null}
          {auth.isSignedIn ? (
            <Button className="h-11 w-fit border-yuzu-line text-yuzu-cream" variant="outline" onClick={auth.signOut}>
              <LogOut data-icon="inline-start" />
              Sign Out
            </Button>
          ) : null}
          <p className="min-h-5 text-sm text-yuzu-gold" aria-live="polite">
            {statusMessage || auth.authError}
          </p>
        </CardContent>
      </Card>
    );
  }

  if (auth.isSignedIn) {
    return (
      <Card className={cn("luxury-card", className)}>
        <CardHeader>
          <CardTitle className="flex items-center gap-3 text-sm uppercase tracking-[0.16em] text-yuzu-gold">
            <BadgeCheck />
            {auth.authSource === "cognito" ? "Cognito Access Active" : "Backup Access Active"}
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-5">
          <div className="grid gap-2">
            <p className="font-heading text-3xl text-yuzu-cream">{auth.session?.name}</p>
            <p className="text-sm text-yuzu-muted">{auth.session?.email}</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <StatusTile label={isAdminAccess ? "Role" : "Account"} value={isAdminAccess && auth.isAdmin ? "Admin" : "Active"} />
            <StatusTile label="View" value={auth.isMember ? "Member" : "Non-member"} />
            <StatusTile label="Tier" value={auth.session?.membership.tier ?? "No paid tier"} />
          </div>
          {auth.authSource === "cognito" ? (
            <div className="border border-yuzu-line bg-yuzu-night/60 p-4 text-sm leading-6 text-yuzu-muted">
              Signed in through Cognito. Requests to the Yuzu API use the verified Cognito token.
            </div>
          ) : null}
          {auth.authSource !== "cognito" && cognitoAvailable ? (
            <div className="grid gap-4 border border-yuzu-line bg-yuzu-night/60 p-4">
              <p className="text-sm leading-6 text-yuzu-muted">
                Live account data needs a Cognito token. Sign in here to replace backup access with a verified API session.
              </p>
              {renderCognitoForm()}
            </div>
          ) : null}
          {!auth.isMember && (
            <div className="border border-yuzu-line bg-yuzu-night/60 p-4 text-sm leading-6 text-yuzu-muted">
              This social account can browse as a non-member. Join a plan to unlock direct member-cost boxes, member drops, and digital humidor features.
            </div>
          )}
          <div className="flex flex-col gap-3 sm:flex-row">
            {!auth.isMember && (
              <Button className="h-11 bg-yuzu-gold text-yuzu-ink hover:bg-yuzu-gold-light" render={<Link href="/membership" />}>
                Choose Membership
              </Button>
            )}
            {isAdminAccess && auth.isAdmin && adminAppUrl ? (
              <Button
                className="h-11 border-yuzu-gold text-yuzu-gold hover:bg-yuzu-gold hover:text-yuzu-ink"
                render={<a href={adminAppUrl} rel="noreferrer" target="_blank" />}
                variant="outline"
              >
                <ExternalLink data-icon="inline-start" />
                Open Admin
              </Button>
            ) : null}
            {isAdminAccess ? (
              <Button className="h-11 border-yuzu-line text-yuzu-cream" variant="outline" render={<Link href="/admin/newsroom" />}>
                Open Newsroom Agent
              </Button>
            ) : null}
            <Button className="h-11 border-yuzu-line text-yuzu-cream" variant="outline" onClick={auth.signOut}>
              <LogOut data-icon="inline-start" />
              Sign Out
            </Button>
          </div>
          {isAdminAccess && auth.isAdmin && !adminAppUrl ? (
            <div className="border border-yuzu-line bg-yuzu-night/60 p-4 text-sm leading-6 text-yuzu-muted">
              Backend admin URL is not configured for this deployment. Set NEXT_PUBLIC_ADMIN_APP_URL before using this static admin hand-off.
              You can still use editorial newsroom workflows at <Link href="/admin/newsroom">/admin/newsroom</Link>.
            </div>
          ) : null}
        </CardContent>
      </Card>
    );
  }

  if (cognitoAvailable) {
    return (
      <Card className={cn("luxury-card", className)}>
        <CardHeader>
          <CardTitle className="flex items-center gap-3 text-sm uppercase tracking-[0.16em] text-yuzu-gold">
            {isAdminAccess ? <ShieldCheck /> : <KeyRound />}
            {isAdminAccess ? "Secure Admin Access" : "Secure Member Access"}
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-5">
          <p className="text-sm leading-6 text-yuzu-muted">
            Sign in with your Yuzu Cognito credentials. The app stays on this page while Cognito issues the token used for member, concierge, and admin API access.
          </p>
          {renderCognitoForm()}
          <p className="min-h-5 text-sm text-yuzu-gold" aria-live="polite">
            {statusMessage || auth.authError}
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cn("luxury-card", className)}>
      <CardHeader>
        <CardTitle className="flex items-center gap-3 text-sm uppercase tracking-[0.16em] text-yuzu-gold">
          {isAdminAccess ? <ShieldCheck /> : <KeyRound />}
          {isAdminAccess ? "Admin Backup Access" : "Backup Member Access"}
        </CardTitle>
      </CardHeader>
      <CardContent className="grid gap-6">
        <div className="grid gap-2 text-sm leading-6 text-yuzu-muted">
          {isAdminAccess ? (
            <>
              <p>
                Admin seed email: <span className="font-semibold text-yuzu-cream">{auth.adminEmail}</span>
              </p>
              <p>
                This local-only backup login stores accounts on this device so development builds can reach the backend admin hand-off without rendering seeded operations data.
              </p>
              <p>
                For in-app editorial workflows, open <Link href="/admin/newsroom">the newsroom route</Link> and publish official stories.
              </p>
            </>
          ) : (
            <>
              <p>Use your email to continue, or create a social sign-up on this device.</p>
              <p>Backup member access keeps local account status available in the static storefront.</p>
            </>
          )}
        </div>

        {!setupMode ? (
          <form className="grid gap-3" onSubmit={handlePasswordLogin}>
            <Input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.currentTarget.value)}
              placeholder="Email"
              required
              className="h-11 rounded-sm border-yuzu-line bg-yuzu-night text-yuzu-cream"
            />
            <Input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.currentTarget.value)}
              placeholder="Password"
              className="h-11 rounded-sm border-yuzu-line bg-yuzu-night text-yuzu-cream"
            />
            <Button type="submit" className="h-11 bg-yuzu-gold text-yuzu-ink hover:bg-yuzu-gold-light">
              Continue
            </Button>
          </form>
        ) : (
          <form className="grid gap-3" onSubmit={handlePasswordSetup}>
            <p className="text-sm leading-6 text-yuzu-muted">
              First login detected. Create the new password for <span className="text-yuzu-cream">{email}</span>.
            </p>
            <Input
              type="password"
              value={newPassword}
              onChange={(event) => setNewPassword(event.currentTarget.value)}
              placeholder="New password"
              required
              className="h-11 rounded-sm border-yuzu-line bg-yuzu-night text-yuzu-cream"
            />
            <Input
              type="password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.currentTarget.value)}
              placeholder="Confirm new password"
              required
              className="h-11 rounded-sm border-yuzu-line bg-yuzu-night text-yuzu-cream"
            />
            <Button type="submit" className="h-11 bg-yuzu-gold text-yuzu-ink hover:bg-yuzu-gold-light">
              Set Password and Sign In
            </Button>
          </form>
        )}

        {intent === "account" && (
          <div className="grid gap-3 border-t border-yuzu-line pt-5">
            <div className="flex items-center gap-3 text-sm uppercase tracking-[0.18em] text-yuzu-gold">
              <UserPlus />
              Social Sign-up
            </div>
            <Input
              value={socialName}
              onChange={(event) => setSocialName(event.currentTarget.value)}
              placeholder="Name"
              className="h-11 rounded-sm border-yuzu-line bg-yuzu-night text-yuzu-cream"
            />
            <Input
              type="email"
              value={socialEmail}
              onChange={(event) => setSocialEmail(event.currentTarget.value)}
              placeholder="Email"
              className="h-11 rounded-sm border-yuzu-line bg-yuzu-night text-yuzu-cream"
            />
            <div className="grid gap-2 sm:grid-cols-3">
              {socialProviders.map((provider) => (
                <Button
                  key={provider.id}
                  type="button"
                  className="h-11 border-yuzu-line text-yuzu-cream"
                  variant="outline"
                  onClick={() => handleSocialSignup(provider.id)}
                >
                  {provider.label}
                </Button>
              ))}
            </div>
          </div>
        )}

        <p className="min-h-5 text-sm text-yuzu-gold" aria-live="polite">
          {statusMessage}
        </p>
      </CardContent>
    </Card>
  );

  function renderCognitoForm() {
    return (
      <form className="grid gap-3" onSubmit={handleCognitoPasswordLogin}>
        <label className="grid gap-2 text-xs font-bold uppercase tracking-[0.14em] text-yuzu-muted">
          Email
          <Input
            autoComplete="email"
            className="h-11 rounded-sm border-yuzu-line bg-yuzu-night text-sm normal-case tracking-normal text-yuzu-cream"
            onChange={(event) => setEmail(event.currentTarget.value)}
            required
            type="email"
            value={email}
          />
        </label>
        <label className="grid gap-2 text-xs font-bold uppercase tracking-[0.14em] text-yuzu-muted">
          Password
          <Input
            autoComplete="current-password"
            className="h-11 rounded-sm border-yuzu-line bg-yuzu-night text-sm normal-case tracking-normal text-yuzu-cream"
            onChange={(event) => setPassword(event.currentTarget.value)}
            required
            type="password"
            value={password}
          />
        </label>
        <Button className="h-11 bg-yuzu-gold text-yuzu-ink hover:bg-yuzu-gold-light" disabled={isCognitoSubmitting} type="submit">
          {isCognitoSubmitting ? <LoaderCircle className="animate-spin" data-icon="inline-start" /> : <LogIn data-icon="inline-start" />}
          {isCognitoSubmitting ? "Signing In" : "Sign In"}
        </Button>
        {cognitoChallenge ? (
          <div className="grid gap-3 border border-yuzu-line bg-yuzu-night/60 p-4 text-sm leading-6 text-yuzu-muted">
            <p>
              {cognitoChallenge.message} Challenge: <span className="font-semibold text-yuzu-cream">{cognitoChallenge.name}</span>.
            </p>
            <Button className="h-11 border-yuzu-gold text-yuzu-gold hover:bg-yuzu-gold hover:text-yuzu-ink" type="button" variant="outline" onClick={handleHostedCognitoLogin}>
              <ExternalLink data-icon="inline-start" />
              Continue with Hosted Cognito
            </Button>
          </div>
        ) : null}
      </form>
    );
  }
}

function StatusTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-yuzu-line/65 bg-yuzu-night/60 p-4">
      <p className="text-xs uppercase tracking-[0.16em] text-yuzu-muted">{label}</p>
      <p className="mt-2 font-heading text-xl text-yuzu-cream">{value}</p>
    </div>
  );
}
