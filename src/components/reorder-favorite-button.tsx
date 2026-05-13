"use client";

import { useRouter } from "next/navigation";

import { toShoppingCartItemInput } from "@/components/add-to-cart-button";
import { useOptionalBackupAuth } from "@/components/backup-auth-provider";
import { useCart } from "@/components/cart-provider";
import type { ProductCardItem } from "@/components/product-card";
import { Button } from "@/components/ui/button";

type ReorderFavoriteButtonProps = {
  product: ProductCardItem;
};

export function ReorderFavoriteButton({ product }: ReorderFavoriteButtonProps) {
  const { addItem } = useCart();
  const auth = useOptionalBackupAuth();
  const router = useRouter();
  const isMember = Boolean(auth?.isReady && auth.isMember);
  const isMembersOnlyProduct = product.memberOnly && !isMember;

  function reorder() {
    if (isMembersOnlyProduct) {
      return;
    }

    addItem(toShoppingCartItemInput(product, isMember), 1);
    window.setTimeout(() => router.push("/cart"), 120);
  }

  return (
    <Button
      type="button"
      className="h-11 w-fit bg-yuzu-gold text-yuzu-ink hover:bg-yuzu-gold-light"
      onClick={reorder}
      disabled={isMembersOnlyProduct}
    >
      {isMembersOnlyProduct ? "Members only" : "Reorder Favorites"}
    </Button>
  );
}
