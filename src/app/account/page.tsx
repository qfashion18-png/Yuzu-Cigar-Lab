import { AccountExperience } from "@/components/account-experience";
import { featuredLuxuryProducts } from "@/lib/catalog";

export default function AccountPage() {
  return <AccountExperience featuredProducts={featuredLuxuryProducts} />;
}
