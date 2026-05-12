"use strict";

const adultSignatureShippingMethodIds = new Set([
  "adult-signature-ground",
  "adult-signature-express",
  "ups-adult-signature-ground",
  "ups-adult-signature-air",
]);

const restrictedDestinationStates = new Set(["AR", "ME", "SD", "UT", "VT"]);
const invalidAgeVerificationTokens = new Set(["checkout_identity_verification_required"]);

function validateCheckoutReadiness(input = {}) {
  const catalogBySku = new Map((Array.isArray(input.catalog) ? input.catalog : []).map((product) => [String(product.sku), product]));
  const items = Array.isArray(input.items) ? input.items : [];
  const errors = [];
  const holdReasons = [];
  const normalizedItems = [];

  for (const item of items) {
    const sku = normalizeSku(item.sku);
    const product = catalogBySku.get(sku);
    const quantity = normalizeQuantity(item.quantity);

    if (!product) {
      pushError(errors, "unknown_sku", `SKU ${sku || "unknown"} is not approved for checkout.`);
      continue;
    }

    if (product.publishStatus !== "published") {
      pushError(errors, "unpublished_sku", `SKU ${sku} is not published for checkout.`);
      continue;
    }

    if (quantity <= 0) {
      pushError(errors, "invalid_quantity", `SKU ${sku} must have a positive quantity.`);
      continue;
    }

    const expectedPrice = Number(product.price);
    const submittedPrice = Number(item.unitPrice);
    if (Number.isFinite(submittedPrice) && Number.isFinite(expectedPrice) && roundCurrency(submittedPrice) !== roundCurrency(expectedPrice)) {
      pushError(errors, "stale_price", `SKU ${sku} price changed. Refresh the cart before checkout.`);
      continue;
    }

    if (product.inventoryPolicy === "track" && Number.isFinite(Number(product.sourceQuantity)) && quantity > Number(product.sourceQuantity)) {
      pushError(errors, "insufficient_inventory", `SKU ${sku} does not have enough available stock.`);
      continue;
    }

    if (product.shippable === false) {
      pushError(errors, "not_shippable", `SKU ${sku} is not eligible for shipping.`);
      continue;
    }

    normalizedItems.push({
      sku,
      quantity,
      unitAmountCents: currencyToCents(expectedPrice),
      productSlug: product.slug,
      name: product.name,
      stripeProductId: product.stripeProductId || null,
      stripePriceId: product.stripePriceId || null,
      adultSignatureRequired: product.adultSignatureRequired !== false,
    });
  }

  if (items.length === 0) {
    pushError(errors, "empty_cart", "Add at least one item before checkout.");
  }

  if (!isAgeVerified(input.ageVerification)) {
    pushError(errors, "age_verification_required", "Complete verified 21+ identity review before checkout.", holdReasons);
  }

  if (isRestrictedDestination(input.destination)) {
    pushError(errors, "restricted_destination", "Yuzu cannot ship tobacco products to this destination.", holdReasons);
  }

  const requiresAdultSignature = normalizedItems.some((item) => item.adultSignatureRequired);
  if (requiresAdultSignature && !adultSignatureShippingMethodIds.has(String(input.shippingMethodId || ""))) {
    pushError(errors, "adult_signature_required", "Choose an adult-signature shipping method for tobacco products.", holdReasons);
  }

  if (!isTaxReady(input.tax)) {
    pushError(errors, "tax_provider_unavailable", "Tax calculation is unavailable for this checkout.", holdReasons);
  }

  return {
    ok: errors.length === 0,
    errors,
    holdReasons,
    normalizedItems,
  };
}

function isAgeVerified(ageVerification) {
  if (!ageVerification || typeof ageVerification !== "object") {
    return false;
  }

  const vendorTransactionId = String(ageVerification.vendorTransactionId || "").trim();
  if (vendorTransactionId && invalidAgeVerificationTokens.has(vendorTransactionId)) {
    return false;
  }

  return ageVerification.status === "verified" && Boolean(ageVerification.verifiedAt || vendorTransactionId);
}

function isRestrictedDestination(destination) {
  if (!destination || typeof destination !== "object") {
    return true;
  }

  const country = String(destination.country || "US").toUpperCase();
  const state = String(destination.state || "").trim().toUpperCase();

  if (country !== "US") {
    return true;
  }

  return !state || restrictedDestinationStates.has(state);
}

function isTaxReady(tax) {
  if (!tax || typeof tax !== "object") {
    return false;
  }

  return tax.status === "ready" || tax.status === "estimated";
}

function pushError(errors, code, message, holdReasons) {
  errors.push({ code, message });

  if (holdReasons && !holdReasons.includes(code)) {
    holdReasons.push(code);
  }
}

function normalizeSku(value) {
  return String(value || "").trim().toUpperCase();
}

function normalizeQuantity(value) {
  const quantity = Math.floor(Number(value));
  return Number.isFinite(quantity) ? quantity : 0;
}

function currencyToCents(value) {
  return Math.round(roundCurrency(value) * 100);
}

function roundCurrency(value) {
  return Math.round(Number(value) * 100) / 100;
}

module.exports = {
  adultSignatureShippingMethodIds,
  invalidAgeVerificationTokens,
  restrictedDestinationStates,
  validateCheckoutReadiness,
};
