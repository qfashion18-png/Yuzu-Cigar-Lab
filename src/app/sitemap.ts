import type { MetadataRoute } from "next";

import { storefrontCategories, storefrontProducts } from "@/lib/catalog";
import { events } from "@/lib/data";
import { siteUrl } from "@/lib/site";

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
  "/account",
  "/cart",
  "/checkout",
  "/about",
];

export default function sitemap(): MetadataRoute.Sitemap {
  const categoryRoutes = storefrontCategories.map((category) => {
    const params = new URLSearchParams({ category });

    return `/shop?${params.toString()}`;
  });

  const staticRoutes = [...routes, ...categoryRoutes].map((route) => ({
    url: `${siteUrl}${route}`,
    lastModified: new Date("2026-05-07T00:00:00.000Z"),
    changeFrequency: route === "" || route === "/shop" ? ("weekly" as const) : ("monthly" as const),
    priority: route === "" ? 1 : 0.7,
  }));

  const productRoutes = storefrontProducts.map((product) => ({
    url: `${siteUrl}/shop/${product.slug}/`,
    lastModified: new Date("2026-05-07T00:00:00.000Z"),
    changeFrequency: "weekly" as const,
    priority: 0.8,
    images: [toAbsoluteUrl(product.image)],
  }));

  const eventRoutes = events.map((event) => ({
    url: `${siteUrl}/events/${event.slug}/`,
    lastModified: new Date(`${event.date} 00:00:00`),
    changeFrequency: "weekly" as const,
    priority: 0.75,
    images: [toAbsoluteUrl(event.image)],
  }));

  return [...staticRoutes, ...productRoutes, ...eventRoutes];
}

function toAbsoluteUrl(value: string) {
  if (/^https?:\/\//i.test(value)) {
    return value;
  }

  return `${siteUrl}${value.startsWith("/") ? value : `/${value}`}`;
}
