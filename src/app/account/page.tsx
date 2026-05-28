import type { Metadata } from "next";

import { AccountExperience } from "@/components/account-experience";
import { featuredLuxuryProducts } from "@/lib/catalog";
import { privatePageMetadata } from "@/lib/seo";

export const metadata: Metadata = privatePageMetadata({
  title: "Account | Yuzu Cigar Club",
  description: "Sign in to manage your Yuzu Cigar Club profile, orders, shipping details, membership, and concierge access.",
  path: "/account",
});

export default function AccountPage() {
  return <AccountExperience featuredProducts={featuredLuxuryProducts} />;
}
