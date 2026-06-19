"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import { useOptionalBackupAuth } from "@/components/backup-auth-provider";
import { repriceCartForAccount } from "@/lib/cart-price-reconciliation";
import {
  addCartItem,
  applyPromotionCode,
  calculateCartTotals,
  createLineId,
  createEmptyShoppingCart,
  checkoutPaymentMethods,
  defaultDeliveryMethods,
  defaultPaymentMethods,
  getDeliveryMethodsForState,
  isAdultSignatureRequiredState,
  removeCartItem,
  updateCartItemQuantity,
  type CartTotals,
  type ShoppingCart,
  type ShoppingCartItemInput,
} from "@/lib/shopping-cart";

const cartStorageKey = "yuzu-shopping-cart-v1";

type CartContextValue = {
  cart: ShoppingCart;
  hydrated: boolean;
  statusMessage: string;
  itemCount: number;
  totals: CartTotals;
  addItem: (item: ShoppingCartItemInput, quantity?: number) => void;
  updateQuantity: (lineId: string, quantity: number) => void;
  removeItem: (lineId: string) => void;
  applyPromotion: (code: string) => boolean;
  clearPromotion: () => void;
  clearCart: () => void;
  dismissStatus: () => void;
};

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const auth = useOptionalBackupAuth();
  const [cart, setCart] = useState(() => createEmptyShoppingCart());
  const [hydrated, setHydrated] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");

  useEffect(() => {
    const hydrationTimer = window.setTimeout(() => {
      const storedCart = readJson<ShoppingCart>(cartStorageKey);

      if (storedCart) {
        setCart(normalizeStoredShoppingCart(storedCart));
      }

      setHydrated(true);
    }, 0);

    return () => window.clearTimeout(hydrationTimer);
  }, []);

  useEffect(() => {
    if (!hydrated) {
      return;
    }

    window.localStorage.setItem(cartStorageKey, JSON.stringify(cart));
  }, [cart, hydrated]);

  useEffect(() => {
    if (!hydrated || !auth?.isReady) {
      return;
    }

    const isMember = auth.isMember;
    const repricingTimer = window.setTimeout(() => {
      setCart((currentCart) => {
        const nextCart = repriceCartForAccount(currentCart, isMember);

        if (nextCart !== currentCart) {
          window.queueMicrotask(() => setStatusMessage("Cart pricing refreshed for your current account."));
        }

        return nextCart;
      });
    }, 0);

    return () => window.clearTimeout(repricingTimer);
  }, [auth?.isMember, auth?.isReady, hydrated]);

  const totals = useMemo(() => calculateCartTotals(cart), [cart]);
  const itemCount = totals.itemCount;

  const addItem = useCallback((item: ShoppingCartItemInput, quantity = 1) => {
    setCart((currentCart) => addCartItem(currentCart, item, quantity));
    setStatusMessage(`${item.name} added to cart.`);
  }, []);

  const updateQuantity = useCallback((lineId: string, quantity: number) => {
    setCart((currentCart) => updateCartItemQuantity(currentCart, lineId, quantity));
    setStatusMessage("Cart quantity updated.");
  }, []);

  const removeItem = useCallback((lineId: string) => {
    setCart((currentCart) => removeCartItem(currentCart, lineId));
    setStatusMessage("Item removed from cart.");
  }, []);

  const applyPromotion = useCallback((code: string) => {
    let accepted = false;

    setCart((currentCart) => {
      const nextCart = applyPromotionCode(currentCart, code);
      accepted = Boolean(nextCart.promotionCode);
      return nextCart;
    });

    setStatusMessage(accepted ? "Promotion applied." : "That promotion code is not eligible.");
    return accepted;
  }, []);

  const clearPromotion = useCallback(() => {
    setCart((currentCart) => ({
      ...currentCart,
      promotionCode: null,
      updatedAt: Math.max(Date.now(), currentCart.updatedAt + 1),
    }));
    setStatusMessage("Promotion removed.");
  }, []);

  const clearCart = useCallback(() => {
    const nextCart = createEmptyShoppingCart();
    setCart(nextCart);
    setStatusMessage("Cart cleared.");
  }, []);

  const value = useMemo<CartContextValue>(
    () => ({
      cart,
      hydrated,
      statusMessage,
      itemCount,
      totals,
      addItem,
      updateQuantity,
      removeItem,
      applyPromotion,
      clearPromotion,
      clearCart,
      dismissStatus: () => setStatusMessage(""),
    }),
    [
      addItem,
      applyPromotion,
      cart,
      clearCart,
      clearPromotion,
      hydrated,
      itemCount,
      removeItem,
      statusMessage,
      totals,
      updateQuantity,
    ]
  );

  return (
    <CartContext.Provider value={value}>
      {children}
      <span className="sr-only" aria-live="polite">
        {statusMessage}
      </span>
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);

  if (!context) {
    throw new Error("useCart must be used within a CartProvider");
  }

  return context;
}

export {
  checkoutPaymentMethods,
  defaultDeliveryMethods,
  defaultPaymentMethods,
  getDeliveryMethodsForState,
  isAdultSignatureRequiredState,
};

function readJson<T>(key: string): T | null {
  try {
    const storedValue = window.localStorage.getItem(key);

    return storedValue ? (JSON.parse(storedValue) as T) : null;
  } catch {
    return null;
  }
}

function normalizeStoredShoppingCart(value: unknown): ShoppingCart {
  const now = Date.now();

  if (!isRecord(value)) {
    return createEmptyShoppingCart(now);
  }

  const items = Array.isArray(value.items)
    ? value.items.flatMap((item) => {
        const normalizedItem = normalizeStoredCartItem(item);
        return normalizedItem ? [normalizedItem] : [];
      })
    : [];
  const createdAt = normalizeStoredTimestamp(value.createdAt, now);
  const updatedAt = normalizeStoredTimestamp(value.updatedAt, createdAt);
  const promotionCode = typeof value.promotionCode === "string" && value.promotionCode.trim() ? value.promotionCode.trim().toUpperCase() : null;

  return {
    id: normalizeStoredString(value.id) || `local-cart-${now}`,
    items,
    promotionCode,
    createdAt,
    updatedAt: Math.max(createdAt, updatedAt),
  };
}

function normalizeStoredCartItem(value: unknown): ShoppingCart["items"][number] | null {
  if (!isRecord(value)) {
    return null;
  }

  const productId = normalizeStoredString(value.productId);
  const variantId = normalizeStoredString(value.variantId);
  const slug = normalizeStoredString(value.slug);
  const name = normalizeStoredString(value.name);
  const sku = normalizeStoredString(value.sku);
  const image = normalizeStoredString(value.image);
  const packageLabel = normalizeStoredString(value.packageLabel);
  const category = normalizeStoredString(value.category);
  const unitPrice = normalizeStoredCurrency(value.unitPrice);
  const maxQuantity = normalizeStoredQuantity(value.maxQuantity, Number.MAX_SAFE_INTEGER);

  if (!productId || !variantId || !slug || !name || !sku || !image || !packageLabel || !category || unitPrice === null) {
    return null;
  }

  return {
    productId,
    variantId,
    slug,
    name,
    sku,
    image,
    imagePosition: normalizeStoredString(value.imagePosition) || "center",
    packageLabel,
    category,
    brand: normalizeOptionalStoredString(value.brand),
    wrapper: normalizeOptionalStoredString(value.wrapper),
    vitola: normalizeOptionalStoredString(value.vitola),
    strength: normalizeOptionalStoredString(value.strength),
    unitPrice,
    maxQuantity,
    memberOnly: value.memberOnly === true,
    lineId: normalizeStoredString(value.lineId) || createLineId(variantId),
    quantity: normalizeStoredQuantity(value.quantity, maxQuantity),
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function normalizeStoredString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeOptionalStoredString(value: unknown) {
  const normalized = normalizeStoredString(value);
  return normalized || undefined;
}

function normalizeStoredCurrency(value: unknown) {
  const amount = Number(value);
  return Number.isFinite(amount) && amount >= 0 ? Math.round((amount + Number.EPSILON) * 100) / 100 : null;
}

function normalizeStoredQuantity(value: unknown, maxQuantity: number) {
  const quantity = Math.floor(Number(value));
  const safeMax = Math.max(1, Math.floor(maxQuantity || 1));
  return Math.min(Math.max(Number.isFinite(quantity) ? quantity : 1, 1), safeMax);
}

function normalizeStoredTimestamp(value: unknown, fallback: number) {
  const timestamp = Number(value);
  return Number.isFinite(timestamp) && timestamp > 0 ? timestamp : fallback;
}
