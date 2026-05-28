import type { Metadata } from "next";
import Link from "@/components/static-link";
import { Clock, Headphones, Mail, MessageCircle, PackageCheck, ShieldCheck } from "lucide-react";

import { ContactUsForm } from "@/components/contact-us-form";
import { ReferenceImage } from "@/components/reference-image";
import { Button } from "@/components/ui/button";
import { buildPageMetadata, jsonLdScriptProps, absoluteUrl, siteName, supportEmail } from "@/lib/seo";

const responseCards = [
  {
    title: "Orders and delivery",
    copy: "Include your order number so support can trace age-verification, shipping, and adult-signature status.",
    icon: PackageCheck,
  },
  {
    title: "Membership",
    copy: "Ask about box access, tier benefits, renewals, or member-drop allocation rules.",
    icon: ShieldCheck,
  },
  {
    title: "Humidor and concierge",
    copy: "Send storage, aging, account, or recommendation questions and we will route them to the right desk.",
    icon: Headphones,
  },
];

const contactJsonLd = {
  "@context": "https://schema.org",
  "@type": "ContactPage",
  "@id": `${absoluteUrl("/contact/")}#contact`,
  name: "Contact Yuzu Cigar Club",
  url: absoluteUrl("/contact/"),
  description: "Contact Yuzu Cigar Club for order support, membership questions, events, and digital humidor help.",
  mainEntity: {
    "@type": "Organization",
    name: siteName,
    url: absoluteUrl("/"),
    email: supportEmail,
    contactPoint: [
      {
        "@type": "ContactPoint",
        contactType: "customer support",
        email: supportEmail,
        availableLanguage: "en-US",
      },
    ],
  },
};

export const metadata: Metadata = buildPageMetadata({
  title: "Contact Us | Yuzu Cigar Club",
  description:
    "Contact Yuzu Cigar Club for order support, membership questions, event inquiries, digital humidor help, and concierge routing.",
  path: "/contact",
  image: "/assets/about-lounge.png",
  imageAlt: "Yuzu Cigar Club lounge prepared for member support and concierge help",
  keywords: ["Yuzu contact", "cigar club support", "membership support", "cigar concierge"],
});

export default function ContactPage() {
  return (
    <>
      <script {...jsonLdScriptProps(contactJsonLd)} />

      <section className="relative overflow-hidden border-b border-yuzu-line">
        <ReferenceImage
          src="/assets/about-lounge.png"
          alt="Yuzu cigar lounge with premium boxes and seating"
          className="absolute inset-y-0 right-0 w-full opacity-72"
          objectPosition="center"
          priority
        />
        <div className="absolute inset-0 bg-[linear-gradient(90deg,#030504_0%,rgba(3,5,4,0.93)_39%,rgba(3,5,4,0.5)_76%)]" />
        <div className="relative mx-auto grid min-h-[540px] max-w-[1520px] items-center gap-8 px-5 py-16 lg:grid-cols-[0.95fr_0.65fr] lg:px-10">
          <div>
            <p className="fine-label">Contact Us</p>
            <h1 className="mt-4 max-w-3xl font-heading text-5xl leading-[1.04] text-yuzu-cream md:text-6xl">
              Contact Yuzu Cigar Club.
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-7 text-yuzu-muted">
              Questions about orders, memberships, member drops, events, age verification, or your digital humidor can all start here. We will route the details to the right support or concierge queue.
            </p>
            <div className="mt-7 flex flex-col gap-3 sm:flex-row">
              <Button className="h-12 bg-yuzu-gold px-7 text-yuzu-ink hover:bg-yuzu-gold-light" render={<Link href="#contact-form-title" />}>
                <Mail data-icon="inline-start" />
                Contact Form
              </Button>
              <Button className="h-12 border-yuzu-gold px-7 text-yuzu-gold" variant="outline" render={<Link href="/account" />}>
                <MessageCircle data-icon="inline-start" />
                Member Concierge
              </Button>
            </div>
          </div>

          <aside className="border border-yuzu-line/75 bg-yuzu-night/78 p-6 shadow-[0_24px_70px_rgba(0,0,0,0.3)] backdrop-blur">
            <div className="flex items-center gap-3 text-yuzu-gold">
              <Clock className="size-5" />
              <p className="text-xs font-bold uppercase tracking-[0.16em]">Response Window</p>
            </div>
            <dl className="mt-5 grid gap-4 text-sm">
              <div>
                <dt className="font-bold text-yuzu-cream">Support email</dt>
                <dd className="mt-1">
                  <a className="text-yuzu-gold underline-offset-4 hover:underline" href={`mailto:${supportEmail}`}>
                    {supportEmail}
                  </a>
                </dd>
              </div>
              <div>
                <dt className="font-bold text-yuzu-cream">Hours</dt>
                <dd className="mt-1 text-yuzu-muted">Monday-Friday, 9 AM-5 PM Arizona time</dd>
              </div>
              <div>
                <dt className="font-bold text-yuzu-cream">Typical reply</dt>
                <dd className="mt-1 text-yuzu-muted">Within one business day for account, order, and membership requests.</dd>
              </div>
            </dl>
          </aside>
        </div>
      </section>

      <section className="mx-auto grid max-w-[1520px] gap-6 px-5 py-12 lg:grid-cols-[0.72fr_1.28fr] lg:px-10">
        <div className="grid content-start gap-5">
          {responseCards.map((item) => {
            const Icon = item.icon;

            return (
              <article key={item.title} className="border border-yuzu-line/70 bg-yuzu-forest/45 p-5">
                <Icon className="text-yuzu-gold" />
                <h2 className="mt-4 font-heading text-2xl text-yuzu-cream">{item.title}</h2>
                <p className="mt-2 text-sm leading-6 text-yuzu-muted">{item.copy}</p>
              </article>
            );
          })}
        </div>

        <section className="luxury-panel p-5 md:p-7" aria-labelledby="contact-form-title">
          <p className="fine-label">Send The Details</p>
          <h2 id="contact-form-title" className="mt-3 font-heading text-4xl text-yuzu-cream">
            Tell us what you need.
          </h2>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-yuzu-muted">
            This static storefront sends your message to the Yuzu support queue with the context support needs. For signed-in member account history, use the concierge entry in your account.
          </p>
          <div className="mt-7">
            <ContactUsForm />
          </div>
        </section>
      </section>
    </>
  );
}
