import type { MetadataRoute } from "next";

import { storefrontProducts } from "@/lib/catalog";
import { events } from "@/lib/data";
import { absoluteUrl } from "@/lib/seo";
import { getSeoContentSitemapEntries } from "@/lib/seo-content";

export const dynamic = "force-static";

const routes = [
  { path: "", image: "/assets/hero-boxes.png" },
  { path: "/membership", image: "/assets/membership-boxes.png" },
  { path: "/shop", image: "/assets/shop-hero.png" },
  { path: "/new-arrivals", image: "/assets/shop-hero.png" },
  { path: "/member-drops", image: "/assets/shop-hero.png" },
  { path: "/cigar-flow", image: "/assets/about-lounge.png" },
  { path: "/news", image: "/assets/about-lounge.png" },
  { path: "/education", image: "/assets/hero-boxes.png" },
  { path: "/events", image: "/assets/about-lounge.png" },
  { path: "/humidor", image: "/refs/mobile-layout.png" },
  { path: "/about", image: "/assets/about-lounge.png" },
  { path: "/contact", image: "/assets/about-lounge.png" },
  { path: "/privacy", image: "/assets/yuzu-logo.png" },
  { path: "/terms", image: "/assets/yuzu-logo.png" },
];

export default function sitemap(): MetadataRoute.Sitemap {
  const staticRoutes = routes.map((route) => ({
    url: absoluteUrl(route.path || "/"),
    lastModified: new Date("2026-05-07T00:00:00.000Z"),
    changeFrequency: route.path === "" || route.path === "/shop" ? ("weekly" as const) : ("monthly" as const),
    priority: route.path === "" ? 1 : 0.7,
    images: [absoluteUrl(route.image)],
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
