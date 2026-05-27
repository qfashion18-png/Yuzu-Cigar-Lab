import { AccountExperience } from "@/components/account-experience";
import { featuredLuxuryProducts } from "@/lib/catalog";

export const metadata = {
  title: "Account | Yuzu Cigar Club",
  description: "Sign in to manage your Yuzu Cigar Club profile, orders, shipping details, membership, and concierge access.",
};

export default function AccountPage() {
  return <AccountExperience featuredProducts={featuredLuxuryProducts} />;
}
