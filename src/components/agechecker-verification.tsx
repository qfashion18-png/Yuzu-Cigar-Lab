"use client";

import { useEffect, useRef, useState } from "react";
import Script from "next/script";
import { ShieldCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  checkoutAgeVerificationIdentityStorageKey,
  clearCheckoutAgeVerificationToken,
  createCheckoutAgeVerificationToken,
  readCheckoutAgeVerificationToken,
  writeCheckoutAgeVerificationToken,
} from "@/lib/age-verification";

const ageCheckerScriptUrl = "https://cdn.agechecker.net/static/popup/v1/popup.js";
const ageCheckerApiKey = process.env.NEXT_PUBLIC_AGECHECKER_API_KEY || process.env.NEXT_PUBLIC_AGE_VERIFICATION_API_KEY || "";

type AgeCheckerVerificationProps = {
  email: string;
  phone?: string;
  fullName: string;
  address1: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
};

type AgeCheckerInstance = {
  show: () => void;
};

type AgeCheckerCreatedPayload = {
  uuid?: string;
};

declare global {
  interface Window {
    AgeCheckerAPI?: {
      createInstance: (config: Record<string, unknown>) => AgeCheckerInstance;
    };
  }
}

export function AgeCheckerVerification(props: AgeCheckerVerificationProps) {
  const pendingUuidRef = useRef("");
  const [scriptReady, setScriptReady] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [verifiedIdentityKey, setVerifiedIdentityKey] = useState("");
  const [statusMessage, setStatusMessage] = useState("");
  const identityKey = createIdentityKey(props);
  const hasRequiredDetails = Boolean(props.email && props.fullName && props.address1 && props.city && props.state && props.postalCode);
  const identityDetailsChanged = Boolean(verifiedIdentityKey && verifiedIdentityKey !== identityKey);
  const isVerified = Boolean(verifiedIdentityKey && verifiedIdentityKey === identityKey);
  const displayedStatusMessage =
    identityDetailsChanged
      ? "Verify again after changing checkout identity details."
      : statusMessage || (isVerified ? "AgeChecker.Net verification is ready for checkout." : scriptReady ? "AgeChecker.Net is ready." : "Loading AgeChecker.Net.");

  useEffect(() => {
    let isCurrent = true;

    queueMicrotask(() => {
      if (!isCurrent) {
        return;
      }

      const storedIdentityKey = readStoredVerifiedIdentityKey();

      if (!storedIdentityKey) {
        setVerifiedIdentityKey("");
        return;
      }

      if (storedIdentityKey === identityKey) {
        setVerifiedIdentityKey(storedIdentityKey);
        return;
      }

      clearStoredVerification();
      setVerifiedIdentityKey("");
      setStatusMessage("Verify again after changing checkout identity details.");
    });

    return () => {
      isCurrent = false;
    };
  }, [identityKey]);

  async function exchangeVerificationUuid(uuid: string) {
    try {
      const result = await createCheckoutAgeVerificationToken({ vendorTransactionId: uuid });
      persistStoredVerification(result.ageVerificationToken, identityKey);
      setVerifiedIdentityKey(identityKey);
      setStatusMessage("AgeChecker.Net verification is ready for checkout.");
    } catch (error) {
      clearStoredVerification();
      setVerifiedIdentityKey("");
      setStatusMessage(error instanceof Error ? error.message : "AgeChecker.Net verification is still pending.");
    } finally {
      setIsVerifying(false);
    }
  }

  function startVerification() {
    if (!ageCheckerApiKey) {
      setStatusMessage("AgeChecker.Net is not configured for this environment yet.");
      return;
    }

    if (!hasRequiredDetails) {
      setStatusMessage("Complete the required shipping fields before age verification.");
      return;
    }

    if (!scriptReady || !window.AgeCheckerAPI?.createInstance) {
      setStatusMessage("AgeChecker.Net is still loading. Try again in a moment.");
      return;
    }

    const { firstName, lastName } = splitFullName(props.fullName);
    pendingUuidRef.current = "";
    setIsVerifying(true);
    setVerifiedIdentityKey("");
    setStatusMessage("Opening AgeChecker.Net verification.");

    const instance = window.AgeCheckerAPI.createInstance({
      key: ageCheckerApiKey,
      mode: "manual",
      autoload: false,
      name: "Yuzu Cigar Club",
      disable_ga: true,
      ada: false,
      data: {
        first_name: firstName,
        last_name: lastName,
        address: props.address1,
        city: props.city,
        state: props.state,
        zip: props.postalCode,
        country: props.country || "US",
        phone: props.phone || "",
        email: props.email,
      },
      oncreated: (payload: AgeCheckerCreatedPayload) => {
        pendingUuidRef.current = String(payload.uuid || "");
        setStatusMessage("AgeChecker.Net review started.");
      },
      onclosed: () => {
        const uuid = pendingUuidRef.current;
        if (!uuid) {
          setIsVerifying(false);
          setStatusMessage("AgeChecker.Net did not return a verification reference.");
          return;
        }

        void exchangeVerificationUuid(uuid);
      },
    });

    instance.show();
  }

  return (
    <div className="grid gap-3 border border-yuzu-line bg-yuzu-night p-4 text-sm leading-6 text-yuzu-muted">
      <Script
        id="agechecker-net-popup"
        src={ageCheckerScriptUrl}
        strategy="afterInteractive"
        onReady={() => setScriptReady(true)}
        onError={() => setStatusMessage("AgeChecker.Net could not load. Try again or contact support.")}
      />
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <ShieldCheck className="mt-0.5 size-5 shrink-0 text-yuzu-gold" />
          <div>
            <p className="font-bold text-yuzu-cream">AgeChecker.Net identity review</p>
            <p>Required before Stripe Checkout opens for tobacco orders.</p>
          </div>
        </div>
        <Button
          type="button"
          className="h-11 border-yuzu-gold text-yuzu-gold hover:bg-yuzu-gold hover:text-yuzu-ink"
          variant="outline"
          disabled={isVerifying || !hasRequiredDetails}
          onClick={startVerification}
        >
          <ShieldCheck data-icon="inline-start" />
          {isVerified ? "Verified" : isVerifying ? "Verifying" : "Verify age"}
        </Button>
      </div>
      <p className="min-h-5 text-xs text-yuzu-muted" aria-live="polite">
        {displayedStatusMessage}
      </p>
    </div>
  );
}

function readStoredVerifiedIdentityKey() {
  if (typeof window === "undefined") {
    return "";
  }

  try {
    const token = readCheckoutAgeVerificationToken(window.sessionStorage);
    return token ? window.sessionStorage.getItem(checkoutAgeVerificationIdentityStorageKey) || "" : "";
  } catch {
    return "";
  }
}

function persistStoredVerification(token: string, identityKey: string) {
  try {
    writeCheckoutAgeVerificationToken(window.sessionStorage, token);
    window.sessionStorage.setItem(checkoutAgeVerificationIdentityStorageKey, identityKey);
  } catch {
    throw new Error("Browser storage is unavailable for checkout age verification.");
  }
}

function clearStoredVerification() {
  try {
    clearCheckoutAgeVerificationToken(window.sessionStorage);
    window.sessionStorage.removeItem(checkoutAgeVerificationIdentityStorageKey);
  } catch {
    // Storage can be unavailable in strict browser privacy modes.
  }
}

function splitFullName(fullName: string) {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  return {
    firstName: parts[0] || "",
    lastName: parts.slice(1).join(" ") || parts[0] || "",
  };
}

function createIdentityKey(input: AgeCheckerVerificationProps) {
  return [
    input.email,
    input.fullName,
    input.address1,
    input.city,
    input.state,
    input.postalCode,
    input.country || "US",
  ]
    .join("|")
    .toLowerCase();
}
