import type { Metadata } from "next";

import type { CatalogProduct, CatalogProductDetails } from "@/lib/catalog";
import type { EventExperience } from "@/lib/data";
import { buildProductPageCopy } from "@/lib/product-page-content";
import { siteUrl } from "@/lib/site";

export const siteName = "Yuzu Cigar Club";
export const siteDescription =
  "Premium cigar boxes, curated memberships, adult-compliant checkout, member events, and a digital humidor for serious collectors.";
export const defaultShareImage = "/assets/hero-boxes.png";
export const defaultShareImageAlt = "Yuzu Cigar Club premium cigar boxes arranged for members";
export const supportEmail = "support@yuzucigarclub.com";

const defaultKeywords = [
  "Yuzu Cigar Club",
  "premium cigars",
  "cigar boxes",
  "cigar membership",
  "digital humidor",
  "adult signature cigar delivery",
];

export type JsonLdPrimitive = string | number | boolean | null;
export type JsonLdValue = JsonLdPrimitive | JsonLdValue[] | { [key: string]: JsonLdValue };

type PageMetadataInput = {
  title: string;
  description: string;
  path: string;
  image?: string;
  imageAlt?: string;
  keywords?: string[];
  noIndex?: boolean;
};

type BreadcrumbItem = {
  name: string;
  path: string;
};

type FaqItem = {
  question: string;
  answer: string;
};

type ArticleJsonLdInput = {
  title: string;
  description: string;
  path: string;
  image?: string;
  datePublished?: string;
  dateModified?: string;
};

type CollectionPageJsonLdInput = {
  title: string;
  description: string;
  path: string;
  image?: string;
  items?: BreadcrumbItem[];
};

export function buildRootMetadata(): Metadata {
  const imageUrl = absoluteUrl(defaultShareImage);

  return {
    metadataBase: new URL(siteUrl),
    applicationName: siteName,
    title: `${siteName} | Membership, Storefront, Digital Humidor`,
    description: siteDescription,
    keywords: defaultKeywords,
    authors: [{ name: siteName, url: siteUrl }],
    creator: siteName,
    publisher: siteName,
    referrer: "origin-when-cross-origin",
    category: "adult ecommerce",
    formatDetection: {
      address: false,
      email: false,
      telephone: false,
    },
    robots: publicRobotsMetadata(),
    openGraph: {
      title: `${siteName} | Membership, Storefront, Digital Humidor`,
      description: siteDescription,
      url: "/",
      siteName,
      images: [
        {
          url: imageUrl,
          width: 1200,
          height: 630,
          alt: defaultShareImageAlt,
        },
      ],
      locale: "en_US",
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: `${siteName} | Membership, Storefront, Digital Humidor`,
      description: siteDescription,
      images: [imageUrl],
    },
    manifest: "/manifest.webmanifest",
    icons: {
      icon: "/assets/yuzu-logo-192.png",
      apple: "/assets/yuzu-logo-180.png",
    },
    appleWebApp: {
      capable: true,
      title: siteName,
      statusBarStyle: "black-translucent",
    },
  };
}

export function buildPageMetadata(input: PageMetadataInput): Metadata {
  const canonical = canonicalPath(input.path);
  const imageUrl = absoluteUrl(input.image ?? defaultShareImage);
  const imageAlt = input.imageAlt ?? defaultShareImageAlt;

  return {
    title: input.title,
    description: input.description,
    keywords: [...defaultKeywords, ...(input.keywords ?? [])],
    alternates: {
      canonical,
    },
    robots: input.noIndex ? privateRobotsMetadata() : publicRobotsMetadata(),
    openGraph: {
      title: input.title,
      description: input.description,
      url: canonical,
      siteName,
      images: [
        {
          url: imageUrl,
          width: 1200,
          height: 630,
          alt: imageAlt,
        },
      ],
      locale: "en_US",
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: input.title,
      description: input.description,
      images: [imageUrl],
    },
  };
}

export function privatePageMetadata(input: Omit<PageMetadataInput, "noIndex">): Metadata {
  return buildPageMetadata({ ...input, noIndex: true });
}

export function absoluteUrl(value: string) {
  if (/^https?:\/\//i.test(value)) {
    return value;
  }

  return new URL(canonicalPath(value), siteUrl).toString();
}

export function canonicalPath(value: string) {
  const input = value.trim() || "/";
  const target = /^https?:\/\//i.test(input)
    ? new URL(input)
    : new URL(input.startsWith("/") ? input : `/${input}`, siteUrl);

  if (!target.pathname.endsWith("/") && !hasFileExtension(target.pathname)) {
    target.pathname = `${target.pathname}/`;
  }

  if (/^https?:\/\//i.test(input)) {
    return target.toString();
  }

  return `${target.pathname}${target.search}${target.hash}`;
}

export function jsonLdScriptProps(value: JsonLdValue) {
  return {
    type: "application/ld+json",
    dangerouslySetInnerHTML: {
      __html: serializeJsonLd(value),
    },
  };
}

export function buildOrganizationJsonLd(): JsonLdValue {
  return withSchemaContext({
    "@type": "Organization",
    "@id": `${absoluteUrl("/")}#organization`,
    name: siteName,
    url: absoluteUrl("/"),
    logo: absoluteUrl("/assets/yuzu-logo.png"),
    email: supportEmail,
    contactPoint: [
      {
        "@type": "ContactPoint",
        contactType: "customer support",
        email: supportEmail,
        availableLanguage: "en-US",
      },
    ],
  });
}

export function buildWebsiteJsonLd(): JsonLdValue {
  return withSchemaContext({
    "@type": "WebSite",
    "@id": `${absoluteUrl("/")}#website`,
    name: siteName,
    url: absoluteUrl("/"),
    description: siteDescription,
    inLanguage: "en-US",
    publisher: {
      "@id": `${absoluteUrl("/")}#organization`,
    },
  });
}

export function buildBreadcrumbJsonLd(items: BreadcrumbItem[]): JsonLdValue {
  return withSchemaContext({
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: absoluteUrl(item.path),
    })),
  });
}

export function buildFaqPageJsonLd(faqs: FaqItem[]): JsonLdValue {
  return withSchemaContext({
    "@type": "FAQPage",
    mainEntity: faqs.map((faq) => ({
      "@type": "Question",
      name: faq.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: faq.answer,
      },
    })),
  });
}

export function buildArticleJsonLd(input: ArticleJsonLdInput): JsonLdValue {
  return withSchemaContext({
    "@type": "Article",
    headline: input.title,
    description: input.description,
    image: [absoluteUrl(input.image ?? defaultShareImage)],
    datePublished: input.datePublished ?? "2026-05-28",
    dateModified: input.dateModified ?? "2026-05-28",
    author: {
      "@id": `${absoluteUrl("/")}#organization`,
    },
    publisher: {
      "@id": `${absoluteUrl("/")}#organization`,
    },
    mainEntityOfPage: absoluteUrl(input.path),
    inLanguage: "en-US",
  });
}

export function buildCollectionPageJsonLd(input: CollectionPageJsonLdInput): JsonLdValue {
  return withSchemaContext({
    "@type": "CollectionPage",
    name: input.title,
    description: input.description,
    url: absoluteUrl(input.path),
    image: absoluteUrl(input.image ?? defaultShareImage),
    isPartOf: {
      "@id": `${absoluteUrl("/")}#website`,
    },
    ...(input.items?.length
      ? {
          mainEntity: {
            "@type": "ItemList",
            itemListElement: input.items.map((item, index) => ({
              "@type": "ListItem",
              position: index + 1,
              name: item.name,
              url: absoluteUrl(item.path),
            })),
          },
        }
      : {}),
  });
}

export function buildProductJsonLd(product: CatalogProduct, details: CatalogProductDetails): JsonLdValue {
  const productUrl = absoluteUrl(`/shop/${product.slug}/`);
  const description = buildProductPageCopy(details.summary, product.sku).narrative;

  return withSchemaContext({
    "@type": "Product",
    "@id": `${productUrl}#product`,
    name: product.name,
    description,
    image: [absoluteUrl(product.image)],
    sku: product.sku,
    mpn: product.sku,
    brand: {
      "@type": "Brand",
      name: product.brand,
    },
    category: product.category,
    url: productUrl,
    offers: {
      "@type": "Offer",
      "@id": `${productUrl}#offer`,
      url: productUrl,
      price: product.nonMemberPrice,
      priceCurrency: "USD",
      availability: getSchemaAvailability(product.availability),
      priceValidUntil: "2027-12-31",
      itemCondition: "https://schema.org/NewCondition",
      seller: {
        "@id": `${absoluteUrl("/")}#organization`,
      },
    },
  });
}

export function buildEventJsonLd(event: EventExperience): JsonLdValue {
  const eventUrl = absoluteUrl(`/events/${event.slug}/`);

  return withSchemaContext({
    "@type": "Event",
    "@id": `${eventUrl}#event`,
    name: event.title,
    description: event.description,
    startDate: event.startsAt,
    endDate: event.endsAt,
    eventStatus: "https://schema.org/EventScheduled",
    eventAttendanceMode: event.location.toLowerCase().includes("digital")
      ? "https://schema.org/MixedEventAttendanceMode"
      : "https://schema.org/OfflineEventAttendanceMode",
    image: [absoluteUrl(event.image)],
    url: eventUrl,
    inLanguage: "en-US",
    organizer: {
      "@id": `${absoluteUrl("/")}#organization`,
    },
    location: {
      "@type": "Place",
      name: event.location,
      address: event.location,
    },
    audience: {
      "@type": "PeopleAudience",
      suggestedMinAge: 21,
    },
  });
}

function publicRobotsMetadata(): Metadata["robots"] {
  return {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  };
}

function privateRobotsMetadata(): Metadata["robots"] {
  return {
    index: false,
    follow: false,
    googleBot: {
      index: false,
      follow: false,
    },
  };
}

function getSchemaAvailability(availability: CatalogProduct["availability"]) {
  if (availability === "Out of stock") {
    return "https://schema.org/OutOfStock";
  }

  if (availability === "Low stock") {
    return "https://schema.org/LimitedAvailability";
  }

  return "https://schema.org/InStock";
}

function withSchemaContext(value: { [key: string]: JsonLdValue }): JsonLdValue {
  return {
    "@context": "https://schema.org",
    ...value,
  };
}

function serializeJsonLd(value: JsonLdValue) {
  return JSON.stringify(value)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026");
}

function hasFileExtension(pathname: string) {
  return /\.[a-z0-9]+$/i.test(pathname.split("/").at(-1) ?? "");
}
