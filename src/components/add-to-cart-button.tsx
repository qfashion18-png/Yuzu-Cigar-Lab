"use client";

import { Plus, ShoppingBag } from "lucide-react";
import { useMemo, useState } from "react";

import { useOptionalBackupAuth } from "@/components/backup-auth-provider";
import { useCart } from "@/components/cart-provider";
import { Button } from "@/components/ui/button";
import type { ProductCardItem } from "@/components/product-card";
import { resolveVisibleProductPrice } from "@/lib/catalog-pricing";
import type { ShoppingCartItemInput } from "@/lib/shopping-cart";

type AddToCartButtonProps = {
  product: ProductCardItem;
  label?: string;
  className?: string;
  variant?: "default" | "outline";
  icon?: "plus" | "bag";
  showInlineStatus?: boolean;
};

export function AddToCartButton({
  product,
  label = "Add",
  className,
  variant = "outline",
  icon = "plus",
  showInlineStatus = false,
}: AddToCartButtonProps) {
  const { addItem } = useCart();
  const auth = useOptionalBackupAuth();
  const [added, setAdded] = useState(false);
  const isMember = Boolean(auth?.isReady && auth.isMember);
  const cartItem = useMemo(() => toShoppingCartItemInput(product, isMember), [isMember, product]);
  const isAvailable = product.availability !== "Out of stock" && product.status !== "Out of stock" && cartItem.unitPrice > 0;
  const isMembersOnlyProduct = product.memberOnly && !isMember;
  const Icon = icon === "bag" ? ShoppingBag : Plus;

  function handleAddToCart() {
    if (isMembersOnlyProduct) {
      return;
    }

    if (!isAvailable) {
      return;
    }

    addItem(cartItem, 1);
    setAdded(true);
    window.setTimeout(() => setAdded(false), 1800);
  }

  return (
    <div className="grid gap-2">
      <Button
        type="button"
        className={className}
        variant={variant}
        disabled={!isAvailable || isMembersOnlyProduct}
        onClick={handleAddToCart}
        aria-label={`Add ${product.name} to cart`}
      >
        <Icon data-icon="inline-start" />
        {isMembersOnlyProduct ? "Members only" : isAvailable ? label : "Unavailable"}
      </Button>
      {showInlineStatus && (
        <p className="min-h-5 text-xs font-bold uppercase tracking-[0.16em] text-yuzu-gold" aria-live="polite">
          {isMembersOnlyProduct ? "Members only item. Join now to add this product." : added ? "Added to cart" : ""}
        </p>
      )}
    </div>
  );
}

export function toShoppingCartItemInput(product: ProductCardItem, isMember = false): ShoppingCartItemInput {
  const packageLabel = product.packageLabel ?? `Box of ${product.boxCount ?? 1}`;
  const category = product.category ?? product.tags[0] ?? "Catalog";
  const stockLimit = product.availability === "Low stock" || product.status === "Low stock" ? 3 : 12;
  const unitPrice = resolveVisibleProductPrice(product, isMember);

  return {
    productId: product.id,
    variantId: `${product.id}-catalog-item`,
    slug: product.slug,
    name: product.name,
    sku: product.sku ?? product.id,
    image: product.image,
    imagePosition: product.imagePosition,
    packageLabel,
    category,
    brand: product.brand,
    wrapper: product.wrapper,
    vitola: product.vitola,
    strength: product.strength,
    memberOnly: product.memberOnly,
    unitPrice,
    maxQuantity: stockLimit,
  };
}
