export const checkoutAgeVerificationStorageKey = "yuzu-checkout-age-verification-token";

const invalidCheckoutAgeVerificationTokens = new Set(["checkout_identity_verification_required"]);

type TokenStorage = Pick<Storage, "getItem">;

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
