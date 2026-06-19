"use client";

import Link from "@/components/static-link";
import { CheckCircle2, MailCheck } from "lucide-react";
import { useId, useState } from "react";
import type { FormEvent } from "react";

import { Button } from "@/components/ui/button";
import {
  buildNewsletterSignupPayload,
  createLocalNewsletterStore,
  newsletterBrandOptions,
  syncNewsletterSignup,
  type NewsletterBrandPreference,
  type NewsletterSignupPayload,
} from "@/lib/newsletter-signup";
import { cn } from "@/lib/utils";

type SignupStatus = {
  kind: "idle" | "success" | "error";
  message: string;
  synced?: boolean;
};

type NewsletterSignupFormProps = {
  source: string;
  variant?: "compact" | "panel";
  defaultMonthlyInterest?: boolean;
  showNameFields?: boolean;
  className?: string;
  onSuccess?: (payload: NewsletterSignupPayload) => void;
};

const tierOptions = [
  { value: "box_access_pass", label: "Box Access Pass" },
  { value: "kisha", label: "Kisha" },
  { value: "sensei", label: "Sensei" },
  { value: "daimyo", label: "Daimyo" },
];

const marketingConsentLabel = "I am 21+ and agree to receive Yuzu Cigar Club email updates.";

export function NewsletterSignupForm({
  source,
  variant = "panel",
  defaultMonthlyInterest = false,
  showNameFields = variant === "panel",
  className,
  onSuccess,
}: NewsletterSignupFormProps) {
  const formId = useId().replaceAll(":", "");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [wantsMonthlyMembership, setWantsMonthlyMembership] = useState(defaultMonthlyInterest);
  const [preferredTier, setPreferredTier] = useState("sensei");
  const [brandPreferences, setBrandPreferences] = useState<NewsletterBrandPreference[]>([]);
  const [consent, setConsent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [status, setStatus] = useState<SignupStatus>({ kind: "idle", message: "" });

  function toggleBrandPreference(value: NewsletterBrandPreference) {
    setBrandPreferences((current) => {
      if (current.includes(value)) {
        return current.filter((item) => item !== value);
      }

      return current.length >= 5 ? current : [...current, value];
    });
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setStatus({ kind: "idle", message: "" });

    try {
      const payload = buildNewsletterSignupPayload({
        email,
        firstName,
        lastName,
        phone,
        wantsMonthlyMembership,
        preferredTier: wantsMonthlyMembership ? preferredTier : undefined,
        brandPreferences,
        source,
        consent,
        pagePath: typeof window !== "undefined" ? window.location.pathname : undefined,
      });
      const syncResult = await syncNewsletterSignup(payload);
      const store = createLocalNewsletterStore(window.localStorage);
      let successMessage = "You are on the newsletter list. Watch for journal highlights and early drop notes.";
      if (brandPreferences.length) {
        successMessage = "You are on the newsletter list. Watch for selected cigar picks with public and member pricing.";
      } else if (wantsMonthlyMembership) {
        successMessage = "You are on the newsletter list. We saved your monthly membership interest for follow-up.";
      }

      store.save(payload, syncResult.synced ? "synced" : "sync_pending");
      setStatus({
        kind: "success",
        synced: syncResult.synced,
        message: successMessage,
      });
      setEmail("");
      setFirstName("");
      setLastName("");
      setPhone("");
      setBrandPreferences([]);
      onSuccess?.(payload);
    } catch (error) {
      setStatus({
        kind: "error",
        message: error instanceof Error ? error.message : "We could not save this signup. Please try again.",
      });
    } finally {
      setSubmitting(false);
    }
  }

  if (variant === "compact") {
    return (
      <form className={cn("relative z-10 mt-5 grid gap-2", className)} onSubmit={handleSubmit}>
        <label className="sr-only" htmlFor={`${formId}-email`}>
          Email address
        </label>
        <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_max-content] xl:grid-cols-1">
          <input
            id={`${formId}-email`}
            className="h-11 min-w-0 rounded-none border border-yuzu-line bg-yuzu-night/70 px-4 text-sm text-yuzu-cream outline-none placeholder:text-yuzu-muted/70 focus:border-yuzu-gold"
            onChange={(event) => setEmail(event.currentTarget.value)}
            placeholder="Enter your email address"
            type="email"
            value={email}
            required
          />
          <button
            className="h-11 w-full rounded-none bg-yuzu-gold px-4 text-xs font-black uppercase tracking-[0.18em] text-yuzu-ink transition hover:bg-yuzu-gold-light disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto xl:w-full"
            disabled={submitting || !consent}
            type="submit"
          >
            {submitting ? "Saving" : "Subscribe"}
          </button>
        </div>
        <label className="flex items-start gap-2 text-xs leading-5 text-yuzu-muted">
          <input
            checked={consent}
            className="mt-1 size-4 accent-yuzu-gold"
            onChange={(event) => setConsent(event.currentTarget.checked)}
            type="checkbox"
          />
          <span>{marketingConsentLabel}</span>
        </label>
        <label className="flex items-start gap-2 text-xs leading-5 text-yuzu-muted">
          <input
            checked={wantsMonthlyMembership}
            className="mt-1 size-4 accent-yuzu-gold"
            onChange={(event) => setWantsMonthlyMembership(event.currentTarget.checked)}
            type="checkbox"
          />
          <span>Send monthly membership info too.</span>
        </label>
        <BrandPreferenceFieldset
          compact
          id={`${formId}-compact-brands`}
          selected={brandPreferences}
          onToggle={toggleBrandPreference}
        />
        <p
          className={cn(
            "min-h-5 text-xs font-bold uppercase tracking-[0.12em]",
            status.kind === "error" ? "text-red-300" : "text-yuzu-gold"
          )}
          aria-live="polite"
        >
          {status.message}
        </p>
      </form>
    );
  }

  return (
    <form className={cn("grid gap-4", className)} onSubmit={handleSubmit}>
      {showNameFields && (
        <div className="grid gap-3 sm:grid-cols-2">
          <FormField
            id={`${formId}-first-name`}
            label="First name"
            value={firstName}
            onChange={setFirstName}
            autoComplete="given-name"
          />
          <FormField
            id={`${formId}-last-name`}
            label="Last name"
            value={lastName}
            onChange={setLastName}
            autoComplete="family-name"
          />
        </div>
      )}
      <FormField
        id={`${formId}-email`}
        label="Email"
        value={email}
        onChange={setEmail}
        type="email"
        autoComplete="email"
        required
      />
      <FormField
        id={`${formId}-phone`}
        label="Phone"
        value={phone}
        onChange={setPhone}
        type="tel"
        autoComplete="tel"
        placeholder="Optional"
      />
      <BrandPreferenceFieldset
        id={`${formId}-brands`}
        selected={brandPreferences}
        onToggle={toggleBrandPreference}
      />
      <label className="flex items-start gap-3 border border-yuzu-line/70 bg-yuzu-night/55 p-4 text-sm leading-6 text-yuzu-muted">
        <input
          checked={wantsMonthlyMembership}
          className="mt-1 size-4 accent-yuzu-gold"
          onChange={(event) => setWantsMonthlyMembership(event.currentTarget.checked)}
          type="checkbox"
        />
        <span>
          I am interested in becoming a monthly Yuzu member and want details about the best plan.
        </span>
      </label>
      {wantsMonthlyMembership && (
        <label className="grid gap-2 text-sm text-yuzu-muted">
          <span className="text-xs font-black uppercase tracking-[0.16em] text-yuzu-gold">Preferred monthly tier</span>
          <select
            className="h-11 rounded-none border border-yuzu-line bg-yuzu-night/70 px-3 text-sm text-yuzu-cream outline-none focus:border-yuzu-gold"
            onChange={(event) => setPreferredTier(event.currentTarget.value)}
            value={preferredTier}
          >
            {tierOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      )}
      <label className="flex items-start gap-3 text-xs leading-5 text-yuzu-muted">
        <input
          checked={consent}
          className="mt-1 size-4 accent-yuzu-gold"
          onChange={(event) => setConsent(event.currentTarget.checked)}
          type="checkbox"
        />
        <span>{marketingConsentLabel}</span>
      </label>
      <Button
        className="h-12 rounded-none bg-yuzu-gold px-6 text-xs font-black uppercase tracking-[0.18em] text-yuzu-ink hover:bg-yuzu-gold-light"
        disabled={submitting || !consent}
        type="submit"
      >
        {submitting ? "Saving" : brandPreferences.length ? "Send cigar picks and pricing" : "Join the Newsletter"}
        {status.kind === "success" ? <CheckCircle2 data-icon="inline-end" /> : <MailCheck data-icon="inline-end" />}
      </Button>
      <div className="min-h-16" aria-live="polite">
        {status.message && (
          <div
            className={cn(
              "border p-4 text-sm leading-6",
              status.kind === "error"
                ? "border-red-500/50 bg-red-500/10 text-red-200"
                : "border-yuzu-gold/60 bg-yuzu-gold/10 text-yuzu-cream"
            )}
          >
            <p>{status.message}</p>
            {status.kind === "success" && wantsMonthlyMembership && (
              <Link href="/membership" className="mt-2 inline-flex text-xs font-black uppercase tracking-[0.16em] text-yuzu-gold">
                Compare monthly tiers
              </Link>
            )}
          </div>
        )}
      </div>
    </form>
  );
}

function BrandPreferenceFieldset({
  id,
  selected,
  onToggle,
  compact = false,
}: {
  id: string;
  selected: NewsletterBrandPreference[];
  onToggle: (value: NewsletterBrandPreference) => void;
  compact?: boolean;
}) {
  return (
    <fieldset className={cn("grid gap-3", compact && "gap-2")}>
      <legend className="text-xs font-black uppercase tracking-[0.16em] text-yuzu-gold">
        Favorite cigar brands
      </legend>
      <div className={cn("grid gap-2 sm:grid-cols-2", compact && "grid-cols-2 sm:grid-cols-2 xl:grid-cols-1")}>
        {newsletterBrandOptions.map((option) => {
          const checked = selected.includes(option.value);
          const disabled = !checked && selected.length >= 5;

          return (
            <label
              key={option.value}
              className={cn(
                "flex min-h-11 items-center gap-2 border border-yuzu-line/70 bg-yuzu-night/55 px-3 py-2 text-xs font-bold uppercase tracking-[0.12em] text-yuzu-muted transition",
                checked && "border-yuzu-gold bg-yuzu-gold/10 text-yuzu-cream",
                disabled && "opacity-50"
              )}
              htmlFor={`${id}-${option.value}`}
            >
              <input
                id={`${id}-${option.value}`}
                checked={checked}
                className="size-4 shrink-0 accent-yuzu-gold"
                disabled={disabled}
                onChange={() => onToggle(option.value)}
                type="checkbox"
              />
              <span className="min-w-0">{option.label}</span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

function FormField({
  id,
  label,
  value,
  onChange,
  type = "text",
  autoComplete,
  required,
  placeholder,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  autoComplete?: string;
  required?: boolean;
  placeholder?: string;
}) {
  return (
    <label className="grid gap-2 text-sm text-yuzu-muted" htmlFor={id}>
      <span className="text-xs font-black uppercase tracking-[0.16em] text-yuzu-gold">{label}</span>
      <input
        id={id}
        autoComplete={autoComplete}
        className="h-11 rounded-none border border-yuzu-line bg-yuzu-night/70 px-3 text-sm text-yuzu-cream outline-none placeholder:text-yuzu-muted/70 focus:border-yuzu-gold"
        onChange={(event) => onChange(event.currentTarget.value)}
        placeholder={placeholder}
        required={required}
        type={type}
        value={value}
      />
    </label>
  );
}
