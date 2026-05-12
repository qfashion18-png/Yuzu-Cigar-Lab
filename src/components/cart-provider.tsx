"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  addCartItem,
  applyPromotionCode,
  calculateCartTotals,
  createEmptyShoppingCart,
  checkoutPaymentMethods,
  defaultDeliveryMethods,
  defaultPaymentMethods,
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
  const [cart, setCart] = useState(() => createEmptyShoppingCart());
  const [hydrated, setHydrated] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");

  useEffect(() => {
    const hydrationTimer = window.setTimeout(() => {
      const storedCart = readJson<ShoppingCart>(cartStorageKey);

      if (storedCart) {
        setCart(storedCart);
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

export { checkoutPaymentMethods, defaultDeliveryMethods, defaultPaymentMethods };

function readJson<T>(key: string): T | null {
  try {
    const storedValue = window.localStorage.getItem(key);

    return storedValue ? (JSON.parse(storedValue) as T) : null;
  } catch {
    return null;
  }
}
