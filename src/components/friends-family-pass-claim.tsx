"use client";

import Link from "@/components/static-link";
import { ArrowRight, CheckCircle2, LoaderCircle, LogIn, MailCheck, UserPlus } from "lucide-react";
import { type FormEvent, type ReactNode, useEffect, useState } from "react";

import { useBackupAuth } from "@/components/backup-auth-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createMembershipCheckoutSession, getCheckoutErrorMessage } from "@/lib/stripe-checkout";
import { cn } from "@/lib/utils";

const friendsFamilyMembershipOffer = {
  code: "friends-family-box-pass",
  source: "friends-family-page",
  campaign: "friends-family-1-year-box-pass",
  landingPath: "/friends-family",
  access: "box_access_pass_1_year",
  trialPeriodDays: 365,
} as const;

const friendsFamilyClientMetadata = {
  ycc_invite_code: friendsFamilyMembershipOffer.code,
  ycc_offer_source: friendsFamilyMembershipOffer.source,
  ycc_offer_campaign: friendsFamilyMembershipOffer.campaign,
  ycc_offer_access: friendsFamilyMembershipOffer.access,
  ycc_landing_path: friendsFamilyMembershipOffer.landingPath,
};
const confirmationEmailHelpText =
  'Look for an email with the subject "Yuzu Cigar Club verification code." Open its Yuzu confirmation link to fill in the code, or paste the code here. Check spam or promotions, then use Send a new code if needed.';
const pendingConfirmationEmailStorageKey = "yuzu-friends-family-pending-confirmation-email";

function normalizePendingEmail(value: string) {
  return value.trim().toLowerCase();
}

function normalizeConfirmationCode(value: string) {
  return value.trim().replace(/\s+/g, "");
}

function rememberPendingConfirmationEmail(value: string) {
  const normalizedEmail = normalizePendingEmail(value);

  if (!normalizedEmail || typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(pendingConfirmationEmailStorageKey, normalizedEmail);
  } catch {
    // Confirmation still works if browser storage is unavailable.
  }
}

function readPendingConfirmationEmail() {
  if (typeof window === "undefined") {
    return "";
  }

  try {
    return window.localStorage.getItem(pendingConfirmationEmailStorageKey)?.trim() ?? "";
  } catch {
    return "";
  }
}

function forgetPendingConfirmationEmail() {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.removeItem(pendingConfirmationEmailStorageKey);
  } catch {
    // The pending email is only a convenience for the return-link flow.
  }
}

function createBearerHeaders(idToken: string | undefined): Record<string, string> {
  return idToken ? { Authorization: `Bearer ${idToken}` } : {};
}

export function FriendsFamilyPassClaim() {
  const auth = useBackupAuth();
  const [statusMessage, setStatusMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [authMode, setAuthMode] = useState<"signup" | "signin">("signup");
  const [needsConfirmation, setNeedsConfirmation] = useState(false);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmationCode, setConfirmationCode] = useState("");
  const signedInEmail = auth.session?.email ?? "";

  /* eslint-disable react-hooks/set-state-in-effect -- Hydrates browser-only return-link state from URL/localStorage after mount. */
  useEffect(() => {
    const storedEmail = readPendingConfirmationEmail();

    if (storedEmail) {
      setEmail((currentEmail) => currentEmail || storedEmail);
    }

    const returnUrl = new URL(window.location.href);
    const urlConfirmationCode = returnUrl.searchParams.get("confirmation_code") ?? returnUrl.searchParams.get("code") ?? "";
    const normalizedCode = normalizeConfirmationCode(urlConfirmationCode);

    if (!normalizedCode) {
      return;
    }

    setConfirmationCode(normalizedCode);
    setNeedsConfirmation(true);
    setStatusMessage(
      storedEmail
        ? "Your confirmation code is ready. Click Confirm and Claim Pass to finish."
        : "Your confirmation code is ready. Enter the email you used to sign up, then click Confirm and Claim Pass."
    );

    returnUrl.searchParams.delete("confirmation_code");
    returnUrl.searchParams.delete("code");
    window.history.replaceState(null, "", `${returnUrl.pathname}${returnUrl.search}${returnUrl.hash}`);
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

  async function claimPass(customer = { email: signedInEmail, fullName: auth.session?.name ?? "" }) {
    setIsSubmitting(true);

    try {
      return await activateFriendsFamilyPass(customer, await auth.createApiHeaders());
    } finally {
      setIsSubmitting(false);
    }
  }

  async function activateFriendsFamilyPass(customer: { email: string; fullName?: string }, headers: Record<string, string> = {}) {
    if (!customer.email) {
      setStatusMessage("Create or sign in to your Yuzu account first so the pass can attach to the right email.");
      return false;
    }

    setStatusMessage("Activating your Friends & Family Box Pass...");

    try {
      const session = await createMembershipCheckoutSession(
        {
          tierName: "Box Access Pass",
          billingPeriod: "yearly",
          customer,
          membershipOffer: friendsFamilyMembershipOffer,
        },
        headers
      );

      if (session.membershipClaim) {
        auth.applyMembershipAccess({ tier: "Box Access Pass", status: "member" });
        setStatusMessage("Your 1-year Box Access Pass is active. Welcome into the box room.");
        return true;
      }

      window.location.assign(session.url);
      return true;
    } catch (error) {
      setStatusMessage(getCheckoutErrorMessage(error));
      return false;
    }
  }

  async function handleSignIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setStatusMessage("Signing in to your Yuzu account...");

    try {
      const result = await auth.signInWithCognitoPassword({ username: email, password });
      setStatusMessage(result.message);

      if (result.status === "signed_in") {
        forgetPendingConfirmationEmail();
        setPassword("");
        await activateFriendsFamilyPass(
          {
            email: result.session.user.email,
            fullName: result.session.user.name,
          },
          createBearerHeaders(result.session.tokens.idToken)
        );
      } else if (result.status === "confirmation_required") {
        rememberPendingConfirmationEmail(email);
        setNeedsConfirmation(true);
        const resend = await auth.resendCognitoSignUpCode({
          email,
          clientMetadata: friendsFamilyClientMetadata,
        });
        if (resend.status === "confirmation_required") {
          setStatusMessage(resend.destination ? `${result.message} New code sent to ${resend.destination}.` : `${result.message} ${resend.message}`);
        } else if (resend.status === "signed_up") {
          setConfirmationCode("");
          setNeedsConfirmation(false);
          setAuthMode("signin");
          setStatusMessage(resend.message);
        } else {
          setStatusMessage(`${result.message} ${resend.message}`);
        }
      } else if (result.status === "challenge_required") {
        setStatusMessage("This account needs an extra security step before the pass can be claimed. Contact concierge support and mention Friends & Family Box Pass.");
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleSignUp(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setStatusMessage("Creating your Yuzu account...");

    try {
      const result = await auth.signUpWithCognitoPassword({
        email,
        password,
        fullName,
        clientMetadata: friendsFamilyClientMetadata,
      });

      if (result.status === "confirmation_required") {
        rememberPendingConfirmationEmail(email);
        setStatusMessage(result.destination ? `${result.message} Sent to ${result.destination}.` : result.message);
        setNeedsConfirmation(true);
      } else if (result.status === "signed_up") {
        forgetPendingConfirmationEmail();
        setStatusMessage(result.message);
        setAuthMode("signin");
      } else {
        setStatusMessage(result.message);
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleConfirmSignUp(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setStatusMessage("Confirming your Yuzu account...");

    try {
      const confirmation = await auth.confirmCognitoSignUp({
        email,
        confirmationCode,
        clientMetadata: friendsFamilyClientMetadata,
      });
      setStatusMessage(confirmation.message);

      if (confirmation.status !== "confirmed") {
        return;
      }

      forgetPendingConfirmationEmail();
      setConfirmationCode("");
      setNeedsConfirmation(false);

      if (!password) {
        setAuthMode("signin");
        setStatusMessage("Your Yuzu account is confirmed. Sign in below to claim the pass.");
        return;
      }

      const signIn = await auth.signInWithCognitoPassword({ username: email, password });
      setStatusMessage(signIn.message);

      if (signIn.status === "signed_in") {
        forgetPendingConfirmationEmail();
        setPassword("");
        await activateFriendsFamilyPass(
          {
            email: signIn.session.user.email,
            fullName: signIn.session.user.name,
          },
          createBearerHeaders(signIn.session.tokens.idToken)
        );
      } else {
        setAuthMode("signin");
        setStatusMessage(signIn.message);
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  async function resendConfirmationCode() {
    setIsSubmitting(true);
    setStatusMessage("Sending a new Yuzu code...");

    try {
      rememberPendingConfirmationEmail(email);
      const result = await auth.resendCognitoSignUpCode({
        email,
        clientMetadata: friendsFamilyClientMetadata,
      });
      if (result.status === "confirmation_required") {
        setStatusMessage(result.destination ? `${result.message} Sent to ${result.destination}.` : result.message);
      } else if (result.status === "signed_up") {
        forgetPendingConfirmationEmail();
        setConfirmationCode("");
        setNeedsConfirmation(false);
        setAuthMode("signin");
        setStatusMessage(result.message);
      } else {
        setStatusMessage(result.message);
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  function openConfirmationRecovery() {
    rememberPendingConfirmationEmail(email);
    setConfirmationCode("");
    setNeedsConfirmation(true);
    setStatusMessage("Enter the code from your Yuzu email, or send a new code.");
  }

  return (
    <div id="claim-pass" className="scroll-mt-24 grid gap-6 border border-yuzu-gold/70 bg-yuzu-panel/90 p-5 shadow-[0_28px_80px_rgba(0,0,0,0.34)] sm:p-6">
      <div className="flex items-start justify-between gap-4 border-b border-yuzu-line/70 pb-5">
        <div className="grid gap-2">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-yuzu-gold">Annual Box Access</p>
          <p className="font-heading text-4xl leading-none text-yuzu-cream">$179</p>
          <p className="text-sm leading-6 text-yuzu-muted">Friends & Family invitation applies 1 year of Box Access Pass access to your Yuzu account.</p>
        </div>
        <div className="grid size-14 place-items-center border border-yuzu-gold/60 bg-yuzu-gold/10 text-yuzu-gold" aria-hidden="true">
          <CheckCircle2 className="size-6" />
        </div>
      </div>

      <div className="grid gap-3 text-sm leading-6 text-yuzu-muted">
        <div className="flex items-center justify-between gap-4 border border-yuzu-line/65 bg-yuzu-night/55 p-4">
          <span className="font-bold uppercase tracking-[0.14em] text-yuzu-gold">Account</span>
          <span className="min-w-0 truncate text-right text-yuzu-cream">{signedInEmail || "Create or sign in below"}</span>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="border border-yuzu-line/65 bg-yuzu-night/45 p-4">
            <p className="font-bold uppercase tracking-[0.14em] text-yuzu-gold">Access</p>
            <p className="mt-2 text-yuzu-cream">Member-cost cigar boxes</p>
          </div>
          <div className="border border-yuzu-line/65 bg-yuzu-night/45 p-4">
            <p className="font-bold uppercase tracking-[0.14em] text-yuzu-gold">Term</p>
            <p className="mt-2 text-yuzu-cream">1 year Box Access Pass</p>
          </div>
        </div>
      </div>

      {signedInEmail ? (
        <div className="grid gap-3">
          <Button type="button" className="h-12 bg-yuzu-gold px-6 text-yuzu-ink hover:bg-yuzu-gold-light" onClick={() => claimPass()} disabled={isSubmitting}>
            {isSubmitting ? <LoaderCircle className="animate-spin" data-icon="inline-start" /> : null}
            {isSubmitting ? "Activating pass" : "Claim 1-Year Pass"}
            {!isSubmitting ? <ArrowRight data-icon="inline-end" /> : null}
          </Button>
          <Button type="button" className="h-11 border-yuzu-line text-yuzu-cream" onClick={auth.signOut} variant="outline">
            Use a different Yuzu account
          </Button>
        </div>
      ) : (
        <div className="grid gap-5">
          <div className="grid grid-cols-2 border border-yuzu-line/70 bg-yuzu-night/55 p-1">
            <AuthModeButton active={authMode === "signup"} icon={<UserPlus className="size-4" />} label="Create account" onClick={() => setAuthMode("signup")} />
            <AuthModeButton active={authMode === "signin"} icon={<LogIn className="size-4" />} label="Sign in" onClick={() => setAuthMode("signin")} />
          </div>

          {!auth.isCognitoConfigured ? (
            <div className="border border-yuzu-line/70 bg-yuzu-night/60 p-4 text-sm leading-6 text-yuzu-muted">
              Yuzu account signup is not configured in this build. <Link href="/contact" className="text-yuzu-gold underline-offset-4 hover:underline">Contact concierge support</Link> to activate this invite.
            </div>
          ) : needsConfirmation ? (
            <form className="grid gap-3" onSubmit={handleConfirmSignUp}>
              <div className="flex items-center gap-3 text-sm font-bold uppercase tracking-[0.14em] text-yuzu-gold">
                <MailCheck className="size-4" />
                Confirm your Yuzu account
              </div>
              <p className="text-xs leading-5 text-yuzu-muted">{confirmationEmailHelpText}</p>
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
              <Input
                autoComplete="one-time-code"
                className="h-11 rounded-sm border-yuzu-line bg-yuzu-night text-yuzu-cream"
                onChange={(event) => setConfirmationCode(event.currentTarget.value)}
                placeholder="Email confirmation code"
                required
                value={confirmationCode}
              />
              <Button type="submit" className="h-12 bg-yuzu-gold text-yuzu-ink hover:bg-yuzu-gold-light" disabled={isSubmitting}>
                {isSubmitting ? <LoaderCircle className="animate-spin" data-icon="inline-start" /> : <CheckCircle2 data-icon="inline-start" />}
                Confirm and Claim Pass
              </Button>
              <Button type="button" className="h-10 border-yuzu-line text-yuzu-cream" onClick={resendConfirmationCode} variant="outline" disabled={isSubmitting}>
                Send a new code
              </Button>
            </form>
          ) : authMode === "signup" ? (
            <form className="grid gap-3" onSubmit={handleSignUp}>
              <label className="grid gap-2 text-xs font-bold uppercase tracking-[0.14em] text-yuzu-muted">
                Name
                <Input
                  autoComplete="name"
                  className="h-11 rounded-sm border-yuzu-line bg-yuzu-night text-sm normal-case tracking-normal text-yuzu-cream"
                  onChange={(event) => setFullName(event.currentTarget.value)}
                  required
                  value={fullName}
                />
              </label>
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
                  autoComplete="new-password"
                  className="h-11 rounded-sm border-yuzu-line bg-yuzu-night text-sm normal-case tracking-normal text-yuzu-cream"
                  minLength={12}
                  onChange={(event) => setPassword(event.currentTarget.value)}
                  required
                  type="password"
                  value={password}
                />
              </label>
              <p className="text-xs leading-5 text-yuzu-muted">Use at least 12 characters with upper and lower case letters, a number, and a symbol.</p>
              <Button type="submit" className="h-12 bg-yuzu-gold text-yuzu-ink hover:bg-yuzu-gold-light" disabled={isSubmitting}>
                {isSubmitting ? <LoaderCircle className="animate-spin" data-icon="inline-start" /> : <UserPlus data-icon="inline-start" />}
                Create Yuzu Account
              </Button>
              <Button type="button" className="h-10 border-yuzu-line text-yuzu-cream" onClick={openConfirmationRecovery} variant="outline" disabled={isSubmitting}>
                I already have a confirmation code
              </Button>
            </form>
          ) : (
            <form className="grid gap-3" onSubmit={handleSignIn}>
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
              <Button type="submit" className="h-12 bg-yuzu-gold text-yuzu-ink hover:bg-yuzu-gold-light" disabled={isSubmitting}>
                {isSubmitting ? <LoaderCircle className="animate-spin" data-icon="inline-start" /> : <LogIn data-icon="inline-start" />}
                Sign In and Claim Pass
              </Button>
              <Button type="button" className="h-10 border-yuzu-line text-yuzu-cream" onClick={openConfirmationRecovery} variant="outline" disabled={isSubmitting}>
                I already have a confirmation code
              </Button>
            </form>
          )}
        </div>
      )}

      <p className="min-h-5 text-sm font-semibold text-yuzu-gold" aria-live="polite" role="status">
        {statusMessage || auth.authError}
      </p>
      <p className="text-xs leading-5 text-yuzu-muted">
        Already have an account issue or need help? <Link href="/contact" className="text-yuzu-gold underline-offset-4 hover:underline">Contact concierge support</Link>.
      </p>
    </div>
  );
}

function AuthModeButton({ active, icon, label, onClick }: { active: boolean; icon: ReactNode; label: string; onClick: () => void }) {
  return (
    <button
      aria-pressed={active}
      className={cn(
        "flex h-11 items-center justify-center gap-2 text-sm font-bold uppercase tracking-[0.12em] transition",
        active ? "bg-yuzu-gold text-yuzu-ink" : "text-yuzu-muted hover:bg-yuzu-panel/80 hover:text-yuzu-cream",
      )}
      onClick={onClick}
      type="button"
    >
      {icon}
      {label}
    </button>
  );
}
