export type ShoppingCartItemInput = {
  productId: string;
  variantId: string;
  slug: string;
  name: string;
  sku: string;
  image: string;
  imagePosition: string;
  packageLabel: string;
  category: string;
  brand?: string;
  wrapper?: string;
  vitola?: string;
  strength?: string;
  unitPrice: number;
  maxQuantity: number;
  memberOnly?: boolean;
};

export type ShoppingCartItem = ShoppingCartItemInput & {
  lineId: string;
  quantity: number;
};

export type ShoppingCart = {
  id: string;
  items: ShoppingCartItem[];
  promotionCode: string | null;
  createdAt: number;
  updatedAt: number;
};

export type CartTotals = {
  itemCount: number;
  subtotal: number;
  discount: number;
  shipping: number;
  handling: number;
  tax: number;
  total: number;
};

export type DeliveryMethod = {
  id: string;
  title: string;
  estimate: string;
  price: number;
  carrier: "USPS";
  adultSignatureRequired: boolean;
  medusaOptionId: string;
};

export type PaymentMethod = {
  id: string;
  title: string;
  note: string;
  medusaProviderId: string;
  stripeMode?: "checkout" | "invoice";
};

export const defaultDeliveryCarrier = "USPS";
export const nonMemberShippingHandlingFee = 10;
export const adultSignatureRequiredStates = ["AR", "CA", "DE", "FL", "GA", "MA", "MN", "ND", "RI", "SC", "WY"] as const;

export const defaultDeliveryMethods: DeliveryMethod[] = [
  {
    id: "usps-ground-advantage",
    title: "USPS Ground Advantage",
    estimate: "3-5 business days",
    price: 9,
    carrier: defaultDeliveryCarrier,
    adultSignatureRequired: false,
    medusaOptionId: "so_usps_ground_advantage",
  },
  {
    id: "usps-priority-mail",
    title: "USPS Priority Mail",
    estimate: "2-3 business days",
    price: 15,
    carrier: defaultDeliveryCarrier,
    adultSignatureRequired: false,
    medusaOptionId: "so_usps_priority_mail",
  },
  {
    id: "usps-adult-signature-ground",
    title: "USPS Adult Signature Ground",
    estimate: "3-5 business days",
    price: 18,
    carrier: defaultDeliveryCarrier,
    adultSignatureRequired: true,
    medusaOptionId: "so_usps_adult_signature_ground",
  },
  {
    id: "usps-adult-signature-priority",
    title: "USPS Adult Signature Priority",
    estimate: "2-3 business days",
    price: 32,
    carrier: defaultDeliveryCarrier,
    adultSignatureRequired: true,
    medusaOptionId: "so_usps_adult_signature_priority",
  },
];

const usStateCodeByName: Record<string, string> = {
  ALABAMA: "AL",
  ALASKA: "AK",
  ARIZONA: "AZ",
  ARKANSAS: "AR",
  CALIFORNIA: "CA",
  COLORADO: "CO",
  CONNECTICUT: "CT",
  DELAWARE: "DE",
  FLORIDA: "FL",
  GEORGIA: "GA",
  HAWAII: "HI",
  IDAHO: "ID",
  ILLINOIS: "IL",
  INDIANA: "IN",
  IOWA: "IA",
  KANSAS: "KS",
  KENTUCKY: "KY",
  LOUISIANA: "LA",
  MAINE: "ME",
  MARYLAND: "MD",
  MASSACHUSETTS: "MA",
  MICHIGAN: "MI",
  MINNESOTA: "MN",
  MISSISSIPPI: "MS",
  MISSOURI: "MO",
  MONTANA: "MT",
  NEBRASKA: "NE",
  NEVADA: "NV",
  "NEW HAMPSHIRE": "NH",
  "NEW JERSEY": "NJ",
  "NEW MEXICO": "NM",
  "NEW YORK": "NY",
  "NORTH CAROLINA": "NC",
  "NORTH DAKOTA": "ND",
  OHIO: "OH",
  OKLAHOMA: "OK",
  OREGON: "OR",
  PENNSYLVANIA: "PA",
  "RHODE ISLAND": "RI",
  "SOUTH CAROLINA": "SC",
  "SOUTH DAKOTA": "SD",
  TENNESSEE: "TN",
  TEXAS: "TX",
  UTAH: "UT",
  VERMONT: "VT",
  VIRGINIA: "VA",
  WASHINGTON: "WA",
  "WEST VIRGINIA": "WV",
  WISCONSIN: "WI",
  WYOMING: "WY",
};

export function normalizeUsStateCode(value: string) {
  const normalizedValue = value.trim().toUpperCase().replace(/\s+/g, " ");

  if (normalizedValue.length === 2) {
    return normalizedValue;
  }

  return usStateCodeByName[normalizedValue] ?? normalizedValue;
}

export function isAdultSignatureRequiredState(state: string) {
  return adultSignatureRequiredStates.includes(normalizeUsStateCode(state) as (typeof adultSignatureRequiredStates)[number]);
}

export function getDeliveryMethodsForState(state: string) {
  if (!isAdultSignatureRequiredState(state)) {
    return defaultDeliveryMethods;
  }

  return defaultDeliveryMethods.filter((method) => method.adultSignatureRequired);
}

export const defaultPaymentMethods: PaymentMethod[] = [
  {
    id: "stripe-checkout",
    title: "Credit or debit card",
    note: "Handled by Stripe-hosted Checkout after backend compliance review.",
    medusaProviderId: "pp_system_default",
    stripeMode: "checkout",
  },
  {
    id: "concierge-invoice",
    title: "Concierge invoice",
    note: "Reserved for approved operator-assisted invoices after launch.",
    medusaProviderId: "pp_system_manual",
    stripeMode: "invoice",
  },
];

export const checkoutPaymentMethods = defaultPaymentMethods.filter((method) => method.stripeMode === "checkout");

const promotionRates: Record<string, number> = {
  KISHA5: 0.05,
  SENSEI10: 0.1,
  DAIMYO15: 0.15,
  SENSEI5: 0.05,
  YUZU10: 0.1,
};

export function createEmptyShoppingCart(now = Date.now()): ShoppingCart {
  return {
    id: `local-cart-${now}`,
    items: [],
    promotionCode: null,
    createdAt: now,
    updatedAt: now,
  };
}

export function addCartItem(
  cart: ShoppingCart,
  input: ShoppingCartItemInput,
  quantity = 1,
  now = Date.now()
): ShoppingCart {
  const nextQuantity = normalizeQuantity(quantity, input.maxQuantity);
  const lineId = createLineId(input.variantId);
  const existingItem = cart.items.find((item) => item.lineId === lineId);
  const nextItems = existingItem
    ? cart.items.map((item) =>
        item.lineId === lineId
          ? {
              ...item,
              quantity: normalizeQuantity(item.quantity + nextQuantity, item.maxQuantity),
            }
          : item
      )
    : [
        ...cart.items,
        {
          ...input,
          lineId,
          quantity: nextQuantity,
        },
      ];

  return touchCart(cart, nextItems, now);
}

export function isMemberOnlyCartItem(item: ShoppingCartItem) {
  return Boolean(item.memberOnly);
}

export function isMemberOnlyCart(cart: ShoppingCart) {
  return cart.items.some(isMemberOnlyCartItem);
}

export function updateCartItemQuantity(
  cart: ShoppingCart,
  lineId: string,
  quantity: number,
  now = Date.now()
): ShoppingCart {
  const nextItems = cart.items.flatMap((item) => {
    if (item.lineId !== lineId) {
      return [item];
    }

    const nextQuantity = Math.floor(quantity);

    if (nextQuantity <= 0) {
      return [];
    }

    return [
      {
        ...item,
        quantity: normalizeQuantity(nextQuantity, item.maxQuantity),
      },
    ];
  });

  return touchCart(cart, nextItems, now);
}

export function removeCartItem(cart: ShoppingCart, lineId: string, now = Date.now()): ShoppingCart {
  return touchCart(
    cart,
    cart.items.filter((item) => item.lineId !== lineId),
    now
  );
}

export function applyPromotionCode(cart: ShoppingCart, code: string, now = Date.now()): ShoppingCart {
  const normalizedCode = code.trim().toUpperCase();

  return {
    ...cart,
    promotionCode: promotionRates[normalizedCode] ? normalizedCode : null,
    updatedAt: getNextTimestamp(cart.updatedAt, now),
  };
}

export function calculateCartTotals(
  cart: ShoppingCart,
  options: { deliveryPrice?: number; handlingFee?: number; isMember?: boolean; taxRate?: number } = {}
): CartTotals {
  const subtotal = roundCurrency(cart.items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0));
  const discountRate = cart.promotionCode ? promotionRates[cart.promotionCode] ?? 0 : 0;
  const eligibleSubtotal = roundCurrency(
    cart.items.reduce((sum, item) => {
      return isMemberStorePerkEligible(item) ? sum + item.unitPrice * item.quantity : sum;
    }, 0)
  );
  const discount = roundCurrency(eligibleSubtotal * discountRate);
  const shipping = roundCurrency(options.deliveryPrice ?? 0);
  const handling = roundCurrency(
    options.handlingFee ?? (cart.items.length > 0 && options.isMember === false ? nonMemberShippingHandlingFee : 0)
  );
  const taxableAmount = Math.max(subtotal - discount, 0);
  const tax = roundCurrency(taxableAmount * (options.taxRate ?? 0));
  const total = roundCurrency(taxableAmount + shipping + handling + tax);

  return {
    itemCount: cart.items.reduce((sum, item) => sum + item.quantity, 0),
    subtotal,
    discount,
    shipping,
    handling,
    tax,
    total,
  };
}

export function createLineId(variantId: string) {
  return `line-${variantId}`;
}

export function formatCurrency(amount: number, currency = "USD") {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
  }).format(amount);
}

function touchCart(cart: ShoppingCart, items: ShoppingCartItem[], now: number): ShoppingCart {
  return {
    ...cart,
    items,
    updatedAt: getNextTimestamp(cart.updatedAt, now),
  };
}

function getNextTimestamp(currentTimestamp: number, nextTimestamp: number) {
  return Math.max(nextTimestamp, currentTimestamp + 1);
}

function normalizeQuantity(quantity: number, maxQuantity: number) {
  const floored = Number.isFinite(quantity) ? Math.floor(quantity) : 1;
  const safeMax = Math.max(1, Math.floor(maxQuantity || 1));

  return Math.min(Math.max(floored, 1), safeMax);
}

function isMemberStorePerkEligible(item: ShoppingCartItemInput) {
  const category = item.category.toLowerCase();
  const merchText = `${item.name} ${item.packageLabel}`.toLowerCase();

  if (category === "membership") {
    return false;
  }

  if (/\b(single|sampler|event|add[- ]?on)\b/.test(`${category} ${merchText}`)) {
    return true;
  }

  if (category.includes("accessor") || category.includes("cutter") || category.includes("lighter")) {
    return true;
  }

  if (category.includes("humid") || category.includes("merch") || category.includes("event")) {
    return true;
  }

  if (category.includes("cigar")) {
    return false;
  }

  return !/\b(box|boxes|bx)\b|\/bx\b/.test(merchText);
}

function roundCurrency(amount: number) {
  return Math.round((amount + Number.EPSILON) * 100) / 100;
}
