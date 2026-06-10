import type { MetadataRoute } from "next";

import { absoluteUrl } from "@/lib/seo";
import { siteUrl } from "@/lib/site";

export const dynamic = "force-static";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/admin/", "/account/", "/auth/", "/cart/", "/checkout/", "/friends-family/"],
    },
    sitemap: absoluteUrl("/sitemap.xml"),
    host: siteUrl,
  };
}
