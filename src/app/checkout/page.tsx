import type { Metadata } from "next";

import { CheckoutExperience } from "@/components/checkout-experience";
import { privatePageMetadata } from "@/lib/seo";

export const metadata: Metadata = privatePageMetadata({
  title: "Checkout | Yuzu Cigar Club",
  description: "Complete Yuzu Cigar Club shipping, payment, compliance review, and order confirmation.",
  path: "/checkout",
});

export default function CheckoutPage() {
  return <CheckoutExperience />;
}
