import { SeoLandingPage, buildSeoContentMetadata } from "@/components/seo-landing-page";
import { getSeoLandingPage } from "@/lib/seo-content";

const page = getSeoLandingPage("limited-edition-cigars")!;

export const metadata = buildSeoContentMetadata(page);

export default function LimitedEditionCigarsPage() {
  return <SeoLandingPage page={page} />;
}
