import { SeoLandingPage, buildSeoContentMetadata } from "@/components/seo-landing-page";
import { getSeoLandingPage } from "@/lib/seo-content";

const page = getSeoLandingPage("cigars-for-beginners")!;

export const metadata = buildSeoContentMetadata(page);

export default function CigarsForBeginnersPage() {
  return <SeoLandingPage page={page} />;
}
