import { getCatalogProductBySkuOrId } from "@/lib/catalog";
import { calculateCartTotals, isMemberOnlyCart, type ShoppingCart } from "@/lib/shopping-cart";

export type CheckoutCustomerInput = {
  email: string;
  phone?: string;
  fullName?: string;
};

export type CheckoutShippingAddressInput = {
  address1: string;
  address2?: string;
  city: string;
  state: string;
  postalCode: string;
  country?: string;
};

export type CheckoutSessionRequest = {
  cartId: string;
  items: Array<{ sku: string; quantity: number; unitPrice: number }>;
  customer: CheckoutCustomerInput;
  shippingAddress: Required<CheckoutShippingAddressInput>;
  shippingMethodId: string;
  compliance: {
    ageVerificationToken: string;
  };
  quote: {
    subtotal: number;
    handling: number;
    total: number;
    currency: "USD";
  };
  membership?: {
    entitlementToken: string;
  };
};

export type CheckoutSessionResponse = {
  id: string;
  url: string;
};

export type CheckoutSessionStatus = {
  id: string;
  paymentStatus: "paid" | "unpaid" | "processing" | "failed" | string;
  fulfillmentStatus: "not_started" | "pending" | "ready" | "fulfilled" | string;
  orderRecorded: boolean;
  orderId: string | null;
  message?: string;
};

export type MembershipCheckoutInput = {
  tierName: string;
  billingPeriod: string;
  customer: CheckoutCustomerInput;
  membershipOffer?: {
    code: string;
    source: string;
    campaign: string;
    landingPath: string;
    access: string;
    trialPeriodDays: number;
  };
};

export type CommerceMembershipResponse = {
  membership?: {
    tier: string | null;
    status: string | null;
    role: string | null;
    groups?: string[];
  };
  subscription?: {
    status: string | null;
    stripeCustomerId: string | null;
    stripeSubscriptionId: string | null;
  };
  membershipEntitlementToken?: string | null;
};

type CommerceErrorPayload = {
  error?: string;
  message?: string;
};

export function buildCheckoutSessionRequest(input: {
  cart: ShoppingCart;
  customer: CheckoutCustomerInput;
  shippingAddress: CheckoutShippingAddressInput;
  shippingMethodId: string;
  complianceToken: string;
  isMember?: boolean;
  membershipEntitlementToken?: string;
}): CheckoutSessionRequest {
  const hasMemberOnlyItems = isCartMemberOnlyLocked(input.cart);
  const isMember = Boolean(input.isMember);

  if (hasMemberOnlyItems && !isMember) {
    throw createCommerceError(
      "membership_required",
      "Sign in with an active membership before checking out member-only products."
    );
  }

  if (hasMemberOnlyItems && !input.membershipEntitlementToken) {
    throw createCommerceError(
      "membership_entitlement_required",
      "A server membership entitlement is required before checking out member-only products."
    );
  }

  if (isMember && !input.membershipEntitlementToken) {
    throw createCommerceError(
      "membership_entitlement_required",
      "A server membership entitlement is required before checking out as a member."
    );
  }

  const totals = calculateCartTotals(input.cart, {
    isMember,
  });

  const request: CheckoutSessionRequest = {
    cartId: input.cart.id,
    items: input.cart.items.map((item) => ({
      sku: item.sku,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
    })),
    customer: input.customer,
    shippingAddress: {
      address1: input.shippingAddress.address1,
      address2: input.shippingAddress.address2 ?? "",
      city: input.shippingAddress.city,
      state: input.shippingAddress.state,
      postalCode: input.shippingAddress.postalCode,
      country: input.shippingAddress.country ?? "US",
    },
    shippingMethodId: input.shippingMethodId,
    compliance: {
      ageVerificationToken: input.complianceToken,
    },
    quote: {
      subtotal: totals.subtotal,
      handling: totals.handling,
      total: totals.total,
      currency: "USD",
    },
  };

  if (input.membershipEntitlementToken) {
    request.membership = {
      entitlementToken: input.membershipEntitlementToken,
    };
  }

  return request;
}

function isCartMemberOnlyLocked(cart: ShoppingCart) {
  const membershipMismatchLocked = cart.items.find((item) => {
    if (item.category === "Membership") {
      return false;
    }

    const catalogProduct = getCatalogProductBySkuOrId(item.sku);
    const catalogMemberOnly = catalogProduct?.memberOnly;

    if (typeof catalogMemberOnly !== "boolean") {
      return false;
    }

    if (item.memberOnly) {
      return catalogMemberOnly === false;
    }

    return catalogMemberOnly === true;
  });

  return Boolean(membershipMismatchLocked) || isMemberOnlyCart(cart);
}

export async function createCheckoutSession(input: Parameters<typeof buildCheckoutSessionRequest>[0]) {
  return postCommerce<CheckoutSessionResponse>("/commerce/checkout-session", buildCheckoutSessionRequest(input));
}

export async function createMembershipCheckoutSession(input: MembershipCheckoutInput) {
  return postCommerce<CheckoutSessionResponse>("/commerce/membership-session", input);
}

export async function createCustomerPortalSession() {
  return postCommerce<{ url: string }>("/commerce/customer-portal-session", {});
}

export async function getCommerceMembership(headers: Record<string, string> = {}) {
  return getCommerce<CommerceMembershipResponse>("/commerce/membership", headers);
}

export async function getCheckoutSessionStatus(sessionId: string, statusToken: string) {
  const tokenQuery = encodeURIComponent(statusToken);
  return getCommerce<CheckoutSessionStatus>(`/commerce/checkout-session/${encodeURIComponent(sessionId)}?status_token=${tokenQuery}`);
}

export function shouldClearCartAfterCheckoutStatus(status: CheckoutSessionStatus) {
  return status.orderRecorded || status.paymentStatus.toLowerCase() === "paid";
}

export function getCheckoutErrorMessage(error: unknown) {
  const code = getCommerceErrorCode(error);
  const fallback = error instanceof Error ? error.message : "Checkout is temporarily unavailable. Please try again.";
  const messages: Record<string, string> = {
    membership_required: "Sign in as a member before checking out member-only products.",
    membership_entitlement_required: "Sign in with Cognito so Yuzu can verify your active membership before checkout.",
    age_verification_required: "Please verify your age before continuing to secure checkout.",
    age_verification_untrusted: "Your age verification session expired. Verify your age again before continuing.",
    restricted_destination: "Yuzu cannot ship this order to the selected destination.",
    adult_signature_required: "Choose an adult-signature delivery method before checkout.",
    shipping_method_unavailable: "Choose a USPS delivery method before checkout.",
    shipping_provider_unavailable: "USPS delivery is required before checkout.",
    insufficient_inventory: "One or more items no longer have enough stock. Refresh the cart and adjust quantity.",
    price_snapshot_required: "Refresh the cart before continuing so Yuzu can verify the latest product prices.",
    stale_price: "A product price changed. Refresh the cart before continuing.",
    quote_mismatch: "Cart totals changed. Refresh the cart before continuing.",
    checkout_status_forbidden: "Checkout session status could not be verified. Return from Stripe Checkout or contact support with your receipt.",
    missing_customer_email: "Add a valid email address before checkout.",
    missing_shipping_address: "Complete the required shipping address fields before checkout.",
    payment_failed: "The payment could not be completed. Please try another payment method in Stripe Checkout.",
    stripe_not_ready: "Secure checkout is not configured for this environment yet.",
    commerce_not_configured: "Secure checkout is not configured for this environment yet.",
  };

  return code ? messages[code] ?? fallback : fallback;
}

export function getCommerceApiBaseUrl() {
  return (process.env.NEXT_PUBLIC_YCC_API_BASE_URL || "").replace(/\/$/, "");
}

async function postCommerce<T>(path: string, body: unknown, headers: Record<string, string> = {}) {
  const apiBaseUrl = getCommerceApiBaseUrl();

  if (!apiBaseUrl) {
    throw createCommerceError("commerce_not_configured", "NEXT_PUBLIC_YCC_API_BASE_URL is not configured.");
  }

  const response = await fetch(`${apiBaseUrl}${path}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...headers,
    },
    body: JSON.stringify(body),
  });

  return parseCommerceResponse<T>(response);
}

async function getCommerce<T>(path: string, headers: Record<string, string> = {}) {
  const apiBaseUrl = getCommerceApiBaseUrl();

  if (!apiBaseUrl) {
    throw createCommerceError("commerce_not_configured", "NEXT_PUBLIC_YCC_API_BASE_URL is not configured.");
  }

  const response = await fetch(`${apiBaseUrl}${path}`, {
    method: "GET",
    headers: {
      accept: "application/json",
      ...headers,
    },
  });

  return parseCommerceResponse<T>(response);
}

async function parseCommerceResponse<T>(response: Response) {
  const payload = (await response.json().catch(() => ({}))) as CommerceErrorPayload | T;

  if (!response.ok) {
    const payloadRecord = payload && typeof payload === "object" ? (payload as CommerceErrorPayload) : {};

    throw createCommerceError(
      payloadRecord.error || "commerce_error",
      payloadRecord.message || "Commerce request failed."
    );
  }

  return payload as T;
}

function createCommerceError(code: string, message: string) {
  const error = new Error(message);
  Object.assign(error, { code, error: code });
  return error;
}

function getCommerceErrorCode(error: unknown) {
  if (error && typeof error === "object") {
    const value = error as { code?: unknown; error?: unknown };
    return String(value.code || value.error || "");
  }

  return "";
}
