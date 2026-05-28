import type { MetadataRoute } from "next";

import { storefrontProducts } from "@/lib/catalog";
import { events } from "@/lib/data";
import { absoluteUrl } from "@/lib/seo";
import { getSeoContentSitemapEntries } from "@/lib/seo-content";

export const dynamic = "force-static";

const routes = [
  "",
  "/membership",
  "/shop",
  "/new-arrivals",
  "/member-drops",
  "/cigar-flow",
  "/news",
  "/education",
  "/events",
  "/humidor",
  "/about",
  "/contact",
  "/privacy",
  "/terms",
];

export default function sitemap(): MetadataRoute.Sitemap {
  const staticRoutes = routes.map((route) => ({
    url: absoluteUrl(route || "/"),
    lastModified: new Date("2026-05-07T00:00:00.000Z"),
    changeFrequency: route === "" || route === "/shop" ? ("weekly" as const) : ("monthly" as const),
    priority: route === "" ? 1 : 0.7,
  }));

  const productRoutes = storefrontProducts.map((product) => ({
    url: absoluteUrl(`/shop/${product.slug}/`),
    lastModified: new Date("2026-05-07T00:00:00.000Z"),
    changeFrequency: "weekly" as const,
    priority: 0.8,
    images: [absoluteUrl(product.image)],
  }));

  const eventRoutes = events.map((event) => ({
    url: absoluteUrl(`/events/${event.slug}/`),
    lastModified: new Date(`${event.date} 00:00:00`),
    changeFrequency: "weekly" as const,
    priority: 0.75,
    images: [absoluteUrl(event.image)],
  }));

  return [...staticRoutes, ...getSeoContentSitemapEntries(), ...productRoutes, ...eventRoutes];
}
