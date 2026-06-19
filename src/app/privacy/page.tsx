import type { Metadata } from "next";
import Link from "@/components/static-link";
import { Mail, ShieldCheck } from "lucide-react";

import { buildPageMetadata } from "@/lib/seo";

export const metadata: Metadata = buildPageMetadata({
  title: "Privacy Policy | Yuzu Cigar Club",
  description:
    "Yuzu Cigar Club's privacy policy for member accounts, newsletter signups, support requests, checkout, age verification, and digital humidor tools.",
  path: "/privacy",
  image: "/assets/yuzu-logo.png",
  imageAlt: "Yuzu Cigar Club logo",
  keywords: ["Yuzu privacy policy", "cigar membership privacy", "age verification privacy"],
});

const sections = [
  {
    title: "Information We Collect",
    copy:
      "We collect the information needed to operate an adult-only membership and storefront experience, including account profile details, email address, phone number when provided, shipping and billing context, support messages, newsletter preferences, membership activity, checkout status, age-verification status, and digital humidor records you choose to save.",
  },
  {
    title: "How We Use Information",
    copy:
      "We use this information to provide member access, process orders and subscriptions, verify age eligibility, respond to support requests, manage digital humidor features, prevent abuse, maintain audit records, improve the site, and send only the updates or support replies connected to your account, purchases, memberships, or explicit newsletter consent.",
  },
  {
    title: "Email And Communications",
    copy:
      "Transactional support emails are sent in response to member, billing, order, humidor, or account support needs. Newsletter and promotional updates require opt-in consent, include a clear unsubscribe path, and are not sent to purchased, rented, scraped, or third-party lists.",
  },
  {
    title: "Mobile Opt-In And SMS Privacy",
    copy:
      "Mobile numbers and SMS opt-in records are used only to operate the specific Yuzu Cigar Club text message program the recipient chose, such as owner or authorized-admin operational alerts. Mobile opt-in data, consent records, and phone numbers are not sold, rented, or shared with third parties or affiliates for marketing or promotional purposes.",
  },
  {
    title: "Service Providers",
    copy:
      "We use trusted service providers for hosting, authentication, payments, age verification, shipping, analytics, email handling, support operations, and data storage. These providers process information only as needed to support Yuzu Cigar Club services and compliance obligations.",
  },
  {
    title: "Retention And Security",
    copy:
      "We retain account, order, support, compliance, and audit records for operational, legal, fraud-prevention, and tax purposes. We use access controls, encrypted transport, scoped infrastructure permissions, event logging, and provider-side suppression controls to protect production systems.",
  },
  {
    title: "Your Choices",
    copy:
      "You can unsubscribe from marketing email, update account information, request support, or ask about privacy choices by contacting support@yuzucigarclub.com. Some compliance, order, tax, fraud-prevention, and audit records may need to be retained where required by law or business operations.",
  },
];

export default function PrivacyPage() {
  return (
    <>
      <section className="border-b border-yuzu-line bg-[linear-gradient(180deg,#07110d_0%,#030504_100%)]">
        <div className="mx-auto max-w-[1120px] px-5 py-16 lg:px-10">
          <p className="fine-label">Yuzu Cigar Club</p>
          <h1 className="mt-4 max-w-4xl font-heading text-5xl text-yuzu-cream md:text-6xl">Privacy Policy</h1>
          <p className="mt-5 max-w-3xl text-sm leading-7 text-yuzu-muted">
            Effective May 20, 2026. Yuzu Cigar Club is an adult-only cigar membership and storefront. This policy explains how we handle information across the website, member accounts, support, checkout, newsletter, age verification, and digital humidor tools.
          </p>
        </div>
      </section>

      <section className="mx-auto grid max-w-[1120px] gap-5 px-5 py-12 lg:grid-cols-[0.72fr_1.28fr] lg:px-10">
        <aside className="h-fit border border-yuzu-line/70 bg-yuzu-night/60 p-6">
          <ShieldCheck className="text-yuzu-gold" />
          <h2 className="mt-4 font-heading text-2xl text-yuzu-cream">Production Data Promise</h2>
          <p className="mt-3 text-sm leading-6 text-yuzu-muted">
            We keep adult compliance, account security, support auditability, and consent records at the center of production operations.
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
              For privacy, support, or email-preference requests, contact{" "}
              <a className="text-yuzu-gold underline-offset-4 hover:underline" href="mailto:support@yuzucigarclub.com">
                support@yuzucigarclub.com
              </a>
              . You can also review our{" "}
              <Link className="text-yuzu-gold underline-offset-4 hover:underline" href="/terms">
                Terms of Service
              </Link>
              .
            </p>
          </article>
        </div>
      </section>
    </>
  );
}
