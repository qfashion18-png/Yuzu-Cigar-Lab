import { SeoLandingPage, buildSeoContentMetadata } from "@/components/seo-landing-page";
import { getSeoLandingPage } from "@/lib/seo-content";

const page = getSeoLandingPage("humidor-guide")!;

export const metadata = buildSeoContentMetadata(page);

export default function HumidorGuidePage() {
  return <SeoLandingPage page={page} />;
}
