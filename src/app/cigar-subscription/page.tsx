import { SeoLandingPage, buildSeoContentMetadata } from "@/components/seo-landing-page";
import { getSeoLandingPage } from "@/lib/seo-content";

const page = getSeoLandingPage("cigar-subscription")!;

export const metadata = buildSeoContentMetadata(page);

export default function CigarSubscriptionPage() {
  return <SeoLandingPage page={page} />;
}
