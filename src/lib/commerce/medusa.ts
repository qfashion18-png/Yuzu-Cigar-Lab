import type { CatalogProduct } from "@/lib/catalog";

export type MedusaProductProjection = {
  id: string;
  title: string;
  handle: string;
  metadata: {
    age_restricted: true;
    cigar_brand: string;
    cigar_line: string;
    vitola: string;
    wrapper: string;
    origin: string;
    strength: string;
    length: string;
    ring_gauge: string;
    filler: string;
    binder: string;
    box_count: number;
    member_only: boolean;
    shipping_class: "adult_signature_required";
  };
  variants: Array<{
    id: string;
    title: string;
    prices: Array<{ currency_code: "usd"; amount: number }>;
  }>;
};

export const medusaRoadmap = [
  "Create age-restricted cigar product type and adult-signature shipping class.",
  "Attach membership tier metadata to customer groups for Kisha, Sensei, and Daimyo pricing.",
  "Use allocations for member-only drops and club subscriptions.",
  "Write purchased boxes into humidor_items after payment capture.",
  "Hold orders until age verification and shipping-rule checks pass.",
  "Emit order events to EventBridge for audit, fulfillment, email, and tax workflows.",
];

export function toMedusaProduct(product: CatalogProduct): MedusaProductProjection {
  return {
    id: product.id,
    title: product.name,
    handle: product.slug,
    metadata: {
      age_restricted: true,
      cigar_brand: product.brand,
      cigar_line: product.name,
      vitola: product.vitola ?? product.packageLabel,
      wrapper: product.wrapper ?? "Not listed",
      origin: product.origin ?? "Not listed",
      strength: product.strength ?? "Not listed",
      length: product.length ?? "Not listed",
      ring_gauge: product.gauge ?? "Not listed",
      filler: product.filler ?? "Not listed",
      binder: product.binder ?? "Not listed",
      box_count: product.packageCount,
      member_only: product.memberOnly,
      shipping_class: "adult_signature_required",
    },
    variants: [
      {
        id: `${product.id}_box`,
        title: product.packageLabel,
        prices: [{ currency_code: "usd", amount: product.price }],
      },
    ],
  };
}
