export const checkoutAgeVerificationStorageKey = "yuzu-checkout-age-verification-token";
export const checkoutAgeVerificationIdentityStorageKey = "yuzu-checkout-age-verification-identity";

const invalidCheckoutAgeVerificationTokens = new Set(["checkout_identity_verification_required"]);

type TokenStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export type CheckoutAgeVerificationTokenRequest = {
  vendorTransactionId: string;
  customer: {
    email: string;
    phone?: string;
    fullName?: string;
  };
  shippingAddress: {
    address1: string;
    address2?: string;
    city: string;
    state: string;
    postalCode: string;
    country?: string;
  };
};

export type CheckoutAgeVerificationTokenResponse = {
  ageVerificationToken: string;
  vendor?: string;
  vendorTransactionId?: string;
  verifiedAt?: string;
};

export function writeCheckoutAgeVerificationToken(
  storage: TokenStorage | null | undefined = globalThis.sessionStorage,
  token = "",
) {
  if (!storage) {
    return;
  }

  try {
    if (!token) {
      storage.removeItem(checkoutAgeVerificationStorageKey);
    } else {
      storage.setItem(checkoutAgeVerificationStorageKey, token);
    }
  } catch {
    // Ignore storage failures; checkout will re-check as needed.
  }
}

export function clearCheckoutAgeVerificationToken(storage: TokenStorage | null | undefined = globalThis.sessionStorage) {
  writeCheckoutAgeVerificationToken(storage);
}

export function readCheckoutAgeVerificationToken(storage: TokenStorage | null | undefined = globalThis.sessionStorage) {
  if (!storage) {
    return "";
  }

  return normalizeCheckoutAgeVerificationToken(storage.getItem(checkoutAgeVerificationStorageKey));
}

export function normalizeCheckoutAgeVerificationToken(value: unknown) {
  const token = String(value || "").trim();
  if (!token || invalidCheckoutAgeVerificationTokens.has(token)) {
    return "";
  }

  const normalized = token.slice(0, 600);
  if (isSignedCheckoutAgeVerificationToken(normalized) || isLegacyProviderAgeVerificationToken(normalized)) {
    return normalized;
  }

  return "";
}

export function isSignedCheckoutAgeVerificationToken(token: string) {
  return /^yccav1\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{16,}$/.test(token);
}

export function isLegacyProviderAgeVerificationToken(token: string) {
  return /^age_txn_[A-Za-z0-9_-]{8,160}$/.test(token);
}

export async function createCheckoutAgeVerificationToken(input: CheckoutAgeVerificationTokenRequest) {
  const apiBaseUrl = getCommerceApiBaseUrl();

  if (!apiBaseUrl) {
    throw createAgeVerificationError("commerce_not_configured", "NEXT_PUBLIC_YCC_API_BASE_URL is not configured.");
  }

  const response = await fetch(`${apiBaseUrl}/commerce/age-verification-token`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({
      vendorTransactionId: input.vendorTransactionId,
      customer: {
        email: input.customer.email,
        phone: input.customer.phone ?? "",
        fullName: input.customer.fullName ?? "",
      },
      shippingAddress: {
        address1: input.shippingAddress.address1,
        address2: input.shippingAddress.address2 ?? "",
        city: input.shippingAddress.city,
        state: input.shippingAddress.state,
        postalCode: input.shippingAddress.postalCode,
        country: input.shippingAddress.country ?? "US",
      },
    }),
  });
  const payload = (await response.json().catch(() => ({}))) as Partial<CheckoutAgeVerificationTokenResponse> & {
    error?: string;
    message?: string;
  };

  if (!response.ok) {
    throw createAgeVerificationError(payload.error || "age_verification_error", payload.message || "Age verification failed.");
  }

  const ageVerificationToken = normalizeCheckoutAgeVerificationToken(payload.ageVerificationToken);
  if (!ageVerificationToken) {
    throw createAgeVerificationError("age_verification_untrusted", "Age verification could not be trusted.");
  }

  return {
    ...payload,
    ageVerificationToken,
  } as CheckoutAgeVerificationTokenResponse;
}

function getCommerceApiBaseUrl() {
  return (process.env.NEXT_PUBLIC_YCC_API_BASE_URL || "").replace(/\/$/, "");
}

function createAgeVerificationError(code: string, message: string) {
  const error = new Error(message);
  Object.assign(error, { code, error: code });
  return error;
}
