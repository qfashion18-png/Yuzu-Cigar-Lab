import type { Metadata } from "next";
import Link from "@/components/static-link";
import { CircleAlert, Mail } from "lucide-react";

import { buildPageMetadata } from "@/lib/seo";

export const metadata: Metadata = buildPageMetadata({
  title: "Terms of Service | Yuzu Cigar Club",
  description:
    "Yuzu Cigar Club terms for adult-only membership, cigar storefront access, checkout, subscriptions, support, digital humidor tools, and compliance obligations.",
  path: "/terms",
  image: "/assets/yuzu-logo.png",
  imageAlt: "Yuzu Cigar Club logo",
  keywords: ["Yuzu terms of service", "adult cigar ecommerce terms", "cigar membership terms"],
});

const sections = [
  {
    title: "Adult-Only Access",
    copy:
      "Yuzu Cigar Club is intended only for adults who are at least 21 years old or the legal tobacco age in their location, whichever is higher. By using the site, creating an account, joining a membership, submitting support requests, or attempting checkout, you confirm that you meet the applicable age requirement.",
  },
  {
    title: "Membership And Storefront",
    copy:
      "Membership benefits, pricing, allocations, welcome kits, box availability, digital humidor features, and storefront access may vary by tier, location, inventory, provider readiness, compliance review, and operational availability. Product details and availability can change before checkout is completed.",
  },
  {
    title: "Checkout And Compliance",
    copy:
      "Orders may require age verification, destination eligibility checks, tobacco tax or excise review, adult-signature delivery, payment authorization, inventory allocation, and manual compliance review. We may reject, cancel, hold, or refund orders that cannot be lawfully or safely fulfilled.",
  },
  {
    title: "Email, Support, And Account Notices",
    copy:
      "We may send transactional account, support, order, membership, billing, security, and compliance communications related to your use of Yuzu Cigar Club. Marketing or newsletter emails require consent and may be unsubscribed from without affecting required transactional notices.",
  },
  {
    title: "Responsible Use",
    copy:
      "You agree not to misuse the site, bypass age gates, submit false information, interfere with platform security, scrape content, abuse support systems, resell restricted benefits where prohibited, or use the service in a way that violates law, carrier rules, provider policies, or platform requirements.",
  },
  {
    title: "Changes And Availability",
    copy:
      "We may update these terms, adjust features, pause services, or change operational providers as the business, compliance environment, and production systems evolve. Continued use of Yuzu Cigar Club after changes means you accept the updated terms.",
  },
];

export default function TermsPage() {
  return (
    <>
      <section className="border-b border-yuzu-line bg-[linear-gradient(180deg,#07110d_0%,#030504_100%)]">
        <div className="mx-auto max-w-[1120px] px-5 py-16 lg:px-10">
          <p className="fine-label">Yuzu Cigar Club</p>
          <h1 className="mt-4 max-w-4xl font-heading text-5xl text-yuzu-cream md:text-6xl">Terms of Service</h1>
          <p className="mt-5 max-w-3xl text-sm leading-7 text-yuzu-muted">
            Effective May 20, 2026. These terms govern use of the Yuzu Cigar Club website, member accounts, cigar storefront, membership features, checkout flow, support tools, and digital humidor experience.
          </p>
        </div>
      </section>

      <section className="mx-auto grid max-w-[1120px] gap-5 px-5 py-12 lg:grid-cols-[0.72fr_1.28fr] lg:px-10">
        <aside className="h-fit border border-yuzu-line/70 bg-yuzu-night/60 p-6">
          <CircleAlert className="text-yuzu-gold" />
          <h2 className="mt-4 font-heading text-2xl text-yuzu-cream">Adults 21+ Only</h2>
          <p className="mt-3 text-sm leading-6 text-yuzu-muted">
            Tobacco products are for adults only. Verification, destination, payment, tax, and shipping checks may apply before fulfillment.
          </p>
        </aside>

        <div className="grid gap-5">
          {sections.map((section) => (
            <article key={section.title} className="border border-yuzu-line/70 bg-yuzu-forest/45 p-6">
              <h2 className="font-heading text-3xl text-yuzu-gold">{section.title}</h2>
              <p className="mt-3 text-sm leading-7 text-yuzu-muted">{section.copy}</p>
            </article>
          ))}

          <article className="border border-yuzu-line/70 bg-yuzu-night/70 p-6">
            <div className="flex items-center gap-3">
              <Mail className="text-yuzu-gold" />
              <h2 className="font-heading text-3xl text-yuzu-cream">Contact</h2>
            </div>
            <p className="mt-3 text-sm leading-7 text-yuzu-muted">
              Questions about these terms, account access, or support communications can be sent to{" "}
              <a className="text-yuzu-gold underline-offset-4 hover:underline" href="mailto:support@yuzucigarclub.com">
                support@yuzucigarclub.com
              </a>
              . Review how we handle data in the{" "}
              <Link className="text-yuzu-gold underline-offset-4 hover:underline" href="/privacy">
                Privacy Policy
              </Link>
              .
            </p>
          </article>
        </div>
      </section>
    </>
  );
}
