import type { Metadata } from "next";

import { CartPageClient } from "@/components/cart-page-client";
import { privatePageMetadata } from "@/lib/seo";

export const metadata: Metadata = privatePageMetadata({
  title: "Cart | Yuzu Cigar Club",
  description: "Review cart items, apply promotions, and continue to secure checkout.",
  path: "/cart",
});

export default function CartPage() {
  return <CartPageClient />;
}
