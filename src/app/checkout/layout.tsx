import type { Metadata } from "next";

import { privatePageMetadata } from "@/lib/seo";

export const metadata: Metadata = privatePageMetadata({
  title: "Checkout | Yuzu Cigar Club",
  description: "Private checkout status and payment flow for Yuzu Cigar Club orders.",
  path: "/checkout",
});

export default function CheckoutLayout({ children }: { children: React.ReactNode }) {
  return children;
}
