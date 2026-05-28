import { SeoLandingPage, buildSeoContentMetadata } from "@/components/seo-landing-page";
import { getSeoLandingPage } from "@/lib/seo-content";

const page = getSeoLandingPage("cigar-gifts")!;

export const metadata = buildSeoContentMetadata(page);

export default function CigarGiftsPage() {
  return <SeoLandingPage page={page} />;
}
