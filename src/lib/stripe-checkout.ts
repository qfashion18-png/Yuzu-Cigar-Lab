import type { ShoppingCart } from "@/lib/shopping-cart";

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
  items: Array<{ sku: string; quantity: number }>;
  customer: CheckoutCustomerInput;
  shippingAddress: Required<CheckoutShippingAddressInput>;
  shippingMethodId: string;
  compliance: {
    ageVerificationToken: string;
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
}): CheckoutSessionRequest {
  return {
    cartId: input.cart.id,
    items: input.cart.items.map((item) => ({
      sku: item.sku,
      quantity: item.quantity,
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
  };
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

export async function getCheckoutSessionStatus(sessionId: string) {
  return getCommerce<CheckoutSessionStatus>(`/commerce/checkout-session/${encodeURIComponent(sessionId)}`);
}

export function getCheckoutErrorMessage(error: unknown) {
  const code = getCommerceErrorCode(error);
  const fallback = error instanceof Error ? error.message : "Checkout is temporarily unavailable. Please try again.";
  const messages: Record<string, string> = {
    age_verification_required: "Please verify your age before continuing to secure checkout.",
    age_verification_untrusted: "Your age verification session expired. Verify your age again before continuing.",
    restricted_destination: "Yuzu cannot ship this order to the selected destination.",
    adult_signature_required: "Choose an adult-signature delivery method before checkout.",
    insufficient_inventory: "One or more items no longer have enough stock. Refresh the cart and adjust quantity.",
    stale_price: "A product price changed. Refresh the cart before continuing.",
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

async function postCommerce<T>(path: string, body: unknown) {
  const apiBaseUrl = getCommerceApiBaseUrl();

  if (!apiBaseUrl) {
    throw createCommerceError("commerce_not_configured", "NEXT_PUBLIC_YCC_API_BASE_URL is not configured.");
  }

  const response = await fetch(`${apiBaseUrl}${path}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });

  return parseCommerceResponse<T>(response);
}

async function getCommerce<T>(path: string) {
  const apiBaseUrl = getCommerceApiBaseUrl();

  if (!apiBaseUrl) {
    throw createCommerceError("commerce_not_configured", "NEXT_PUBLIC_YCC_API_BASE_URL is not configured.");
  }

  const response = await fetch(`${apiBaseUrl}${path}`, {
    method: "GET",
    headers: {
      accept: "application/json",
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
