export const checkoutAgeVerificationStorageKey = "yuzu-checkout-age-verification-token";

const invalidCheckoutAgeVerificationTokens = new Set(["checkout_identity_verification_required"]);

type TokenStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export function createCheckoutAgeVerificationToken(ageConfirmationValue = "") {
  return JSON.stringify({
    ageConfirmationValue,
    issuedAt: Date.now(),
    version: "1",
    type: "checkout_age_verification",
  });
}

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

  return token.slice(0, 200);
}
