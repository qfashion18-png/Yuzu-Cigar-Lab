"use client";

import { useRouter } from "next/navigation";

import { toShoppingCartItemInput } from "@/components/add-to-cart-button";
import { useCart } from "@/components/cart-provider";
import type { ProductCardItem } from "@/components/product-card";
import { Button } from "@/components/ui/button";

type ReorderFavoriteButtonProps = {
  product: ProductCardItem;
};

export function ReorderFavoriteButton({ product }: ReorderFavoriteButtonProps) {
  const { addItem } = useCart();
  const router = useRouter();

  function reorder() {
    addItem(toShoppingCartItemInput(product), 1);
    window.setTimeout(() => router.push("/cart"), 120);
  }

  return (
    <Button type="button" className="h-11 w-fit bg-yuzu-gold text-yuzu-ink hover:bg-yuzu-gold-light" onClick={reorder}>
      Reorder Favorites
    </Button>
  );
}
