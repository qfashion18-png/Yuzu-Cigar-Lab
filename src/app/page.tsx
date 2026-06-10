import type { Metadata } from "next";
import Link from "@/components/static-link";
import {
  ArrowRight,
  BellRing,
  ClipboardCheck,
  Crown,
  Droplets,
  LibraryBig,
  LockKeyhole,
  Package,
  Radio,
  Rss,
  ShieldCheck,
  Smartphone,
  Thermometer,
  TicketCheck,
} from "lucide-react";

import { AdminHostRedirect } from "@/components/admin/admin-host-redirect";
import { BenefitStrip } from "@/components/benefit-strip";
import { HomeEventFeature } from "@/components/home-event-feature";
import { HumidorDemoVideo } from "@/components/humidor-demo-video";
import { MembershipCard } from "@/components/membership-card";
import { MemberViewBanner } from "@/components/member-view-banner";
import { AmbientPulse, Cascade, CascadeItem, HoverLift, Reveal } from "@/components/motion-primitives";
import { ProductCard } from "@/components/product-card";
import { ReferenceImage } from "@/components/reference-image";
import { SectionHeading } from "@/components/section-heading";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { featuredLuxuryProducts } from "@/lib/catalog";
import { cigarFlowItems, cigarFlowStats } from "@/lib/cigar-flow";
import { events, heroProof, humidorFeatureList, tiers } from "@/lib/data";
import { buildEditorialImageAlt } from "@/lib/image-seo";
import { buildOrganizationJsonLd, buildPageMetadata, buildWebsiteJsonLd, jsonLdScriptProps } from "@/lib/seo";

export const metadata: Metadata = {
  ...buildPageMetadata({
    title: "Yuzu Cigar Club | Premium Cigar Boxes, Memberships, Digital Humidor",
    description:
      "Join Yuzu Cigar Club for premium cigar boxes, curated monthly selection windows, member pricing, private allocations, adult-compliant checkout, and a digital humidor.",
    path: "/",
    image: "/assets/hero-boxes.png",
    imageAlt: "Yuzu Cigar Club cigar boxes and membership experience",
    keywords: ["premium cigar boxes", "cigar club membership", "member-priced cigars"],
  }),
};

const humidorReadings = [
  { label: "Humidity", value: "69%", detail: "Stable", icon: Droplets },
  { label: "Temp", value: "70 F", detail: "Ideal", icon: Thermometer },
  { label: "Boxes", value: "5", detail: "Aging", icon: Package },
];

const memberPlatformHighlights = [
  {
    title: "Verified checkout",
    copy: "Age-restricted ordering and adult-signature delivery are handled before your box ships.",
    icon: ShieldCheck,
  },
  {
    title: "Member pricing",
    copy: "Your active tier unlocks the right box access, discounts, and monthly selection-list benefits automatically.",
    icon: Crown,
  },
  {
    title: "Private allocations",
    copy: "Monthly cigar windows, limited drops, and reservation rules are clearly tied to your membership level.",
    icon: TicketCheck,
  },
  {
    title: "Humidor history",
    copy: "Purchased boxes can stay connected to aging dates, tasting notes, ratings, and reorder reminders.",
    icon: LibraryBig,
  },
  {
    title: "Order confidence",
    copy: "Verification, shipping, tax, and fulfillment checks happen behind the scenes before delivery.",
    icon: ClipboardCheck,
  },
  {
    title: "Helpful updates",
    copy: "Selection, order, shipment, club, and reminder messages keep you informed without chasing support.",
    icon: BellRing,
  },
];

const homeCigarFlowItems = cigarFlowItems.slice(0, 3);
const featuredCigarFlowItem = cigarFlowItems[0];

function HeroHumidorWidget() {
  return (
    <div className="relative overflow-hidden rounded-md border border-yuzu-gold/45 bg-yuzu-forest/90 shadow-[0_26px_70px_rgba(0,0,0,0.48)] backdrop-blur-md">
      <AmbientPulse className="absolute inset-0 border border-yuzu-gold/35" />
      <div
        className="absolute inset-0 bg-cover bg-center opacity-50"
        style={{ backgroundImage: "url('/assets/membership-boxes.png')" }}
      />
      <div className="absolute inset-0 bg-[linear-gradient(115deg,rgba(5,18,13,0.98)_0%,rgba(5,18,13,0.88)_48%,rgba(5,18,13,0.62)_100%)]" />
      <div className="relative">
        <Cascade className="grid grid-cols-3 border-b border-yuzu-gold/25" stagger={0.05}>
          {humidorReadings.map((reading) => {
            const Icon = reading.icon;
            return (
              <CascadeItem key={reading.label} className="min-w-0 border-r border-yuzu-gold/20 px-2 py-2 last:border-r-0 sm:px-4 sm:py-3">
                <div className="flex items-center gap-1 whitespace-nowrap text-[0.48rem] font-black uppercase tracking-[0.04em] text-yuzu-muted sm:gap-1.5 sm:text-[0.62rem] sm:tracking-[0.1em]">
                  <Icon className="size-3 text-yuzu-gold sm:size-3.5" />
                  <span>{reading.label}</span>
                </div>
                <div className="mt-3 font-heading text-2xl leading-none text-yuzu-cream sm:mt-4 sm:text-3xl">{reading.value}</div>
                <div className="mt-1 text-[0.52rem] font-bold uppercase tracking-[0.1em] text-yuzu-gold sm:text-[0.64rem] sm:tracking-[0.18em]">{reading.detail}</div>
              </CascadeItem>
            );
          })}
        </Cascade>
        <div className="grid items-center gap-3 px-3 py-3 sm:grid-cols-[1fr_auto] sm:gap-4 sm:px-4 sm:py-4">
          <div>
            <p className="text-[0.58rem] font-black uppercase tracking-[0.16em] text-yuzu-gold sm:text-[0.66rem] sm:tracking-[0.24em]">Smart Humidor</p>
            <p className="mt-1 text-xs leading-5 text-yuzu-cream/82">Live conditions, aging windows, and reorder notes in one view.</p>
          </div>
          <Button
            className="h-9 w-full shrink-0 border-yuzu-gold bg-yuzu-night/65 px-3 text-[0.72rem] text-yuzu-gold hover:bg-yuzu-gold hover:text-yuzu-ink sm:h-10 sm:w-auto sm:px-4 sm:text-sm"
            variant="outline"
            render={<Link href="/humidor" />}
          >
            <Package data-icon="inline-start" />
            View Humidor
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function Home() {
  const initialNowIso = new Date().toISOString();

  return (
    <>
      <AdminHostRedirect />
      <script {...jsonLdScriptProps(buildOrganizationJsonLd())} />
      <script {...jsonLdScriptProps(buildWebsiteJsonLd())} />
      <section className="overflow-hidden border-b border-yuzu-line bg-yuzu-night">
        <div className="mx-auto grid max-w-[1760px] lg:min-h-[560px] lg:grid-cols-[minmax(0,0.44fr)_minmax(0,0.56fr)]">
          <div className="relative z-10 flex items-center bg-[radial-gradient(circle_at_0%_15%,rgba(31,84,56,0.32),transparent_24rem),linear-gradient(90deg,#06120d_0%,#06120d_72%,rgba(6,18,13,0.92)_100%)] px-5 py-12 sm:px-8 lg:min-h-[560px] lg:px-10">
            <Reveal className="max-w-[700px]" y={22}>
              <p className="fine-label" data-yuzu-editable="home.hero.kicker">Premium cigars. Curated for you.</p>
              <h1 className="mt-4 max-w-[700px] font-heading text-4xl leading-[1.05] text-yuzu-cream sm:text-[3.25rem] xl:text-[3.35rem] 2xl:text-[3.5rem]" data-yuzu-editable="home.hero.title">
                Premium Cigars by the Box. Curated Membership. Smart Digital Humidor.
              </h1>
              <p className="mt-5 max-w-xl text-base leading-7 text-yuzu-cream/86 sm:text-lg sm:leading-8" data-yuzu-editable="home.hero.copy">
                We sell by the box, not by the stick, because every great cigar experience deserves more than one.
              </p>
            <div className="mt-7 flex flex-col gap-3 sm:flex-row">
              <HoverLift className="sm:w-auto" hoverY={-2} hoverScale={1.02}>
                <Button className="h-12 w-full bg-yuzu-gold px-8 text-yuzu-ink hover:bg-yuzu-gold-light sm:w-auto" render={<Link href="/shop" />}>
                  <Package data-icon="inline-start" />
                  <span data-yuzu-editable="home.hero.primaryCta">Shop Boxes</span>
                </Button>
              </HoverLift>
              <HoverLift className="sm:w-auto" hoverY={-2} hoverScale={1.02}>
                <Button className="h-12 w-full border-yuzu-gold px-8 text-yuzu-gold hover:bg-yuzu-gold hover:text-yuzu-ink sm:w-auto" variant="outline" render={<Link href="/humidor" />}>
                  <LockKeyhole data-icon="inline-start" />
                  <span data-yuzu-editable="home.hero.secondaryCta">Explore Humidor</span>
                </Button>
              </HoverLift>
            </div>
            <Cascade className="mt-8 hidden gap-x-5 gap-y-4 sm:grid sm:grid-cols-2 xl:grid-cols-4" delay={0.08}>
              {heroProof.map((item) => {
                const Icon = item.icon;
                return (
                  <CascadeItem key={item.label} className="flex min-w-0 items-start gap-3 border-yuzu-line/70 py-3 xl:border-r xl:pr-4 last:xl:border-r-0">
                    <Icon className="size-6 shrink-0 text-yuzu-gold" />
                    <div className="flex flex-col gap-1">
                    <span className="text-xs font-bold uppercase tracking-[0.14em] text-yuzu-cream">{item.label}</span>
                      <span className="text-sm text-yuzu-muted">{item.detail}</span>
                    </div>
                  </CascadeItem>
                );
              })}
            </Cascade>
          </Reveal>
        </div>
          <div className="relative min-h-[380px] border-t border-yuzu-line bg-yuzu-ink lg:min-h-full lg:border-l lg:border-t-0">
            <ReferenceImage
              src="/assets/hero-boxes.png"
              alt="Yuzu cigar boxes on a polished lounge table"
              className="absolute inset-0"
              imageClassName="opacity-95"
              objectPosition="46% 50%"
              priority
            />
            <div className="pointer-events-none absolute inset-y-0 left-0 hidden w-28 bg-gradient-to-r from-yuzu-night to-transparent lg:block" />
            <div className="absolute inset-x-4 top-5 z-10 sm:inset-x-auto sm:right-6 sm:top-6 sm:w-[360px] xl:right-8 xl:top-8 xl:w-[390px]">
              <Reveal delay={0.16} y={18}>
                <HeroHumidorWidget />
              </Reveal>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-[1520px] px-5 pt-6 lg:px-10">
        <MemberViewBanner context="site" />
      </section>

      <section data-home-cigar-flow="feature" className="mx-auto max-w-[1520px] px-5 pt-10 lg:px-10">
        <Reveal className="overflow-hidden rounded-md border border-yuzu-line bg-[radial-gradient(circle_at_8%_8%,rgba(220,169,58,0.13),transparent_25rem),linear-gradient(135deg,rgba(8,19,14,0.98)_0%,rgba(4,9,7,0.98)_48%,rgba(16,33,24,0.92)_100%)] shadow-[0_24px_70px_rgba(0,0,0,0.22)]">
          <div className="grid lg:grid-cols-[1.04fr_0.96fr]">
            <div className="relative min-h-[25rem] border-b border-yuzu-line bg-yuzu-ink lg:min-h-[34rem] lg:border-b-0 lg:border-r">
              <ReferenceImage
                src={featuredCigarFlowItem.image}
                alt={buildEditorialImageAlt({ title: featuredCigarFlowItem.title, sourceName: featuredCigarFlowItem.sourceName })}
                className="absolute inset-0"
                imageClassName="opacity-92"
                objectPosition={featuredCigarFlowItem.imagePosition}
              />
              <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(3,5,4,0.05)_0%,rgba(3,5,4,0.24)_46%,rgba(3,5,4,0.88)_100%)]" />
              <div className="absolute inset-x-5 bottom-5 sm:inset-x-7 sm:bottom-7">
                <div className="max-w-2xl border border-yuzu-gold/40 bg-yuzu-night/78 p-5 backdrop-blur-md sm:p-6">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge className="bg-yuzu-gold text-yuzu-ink">Live-style feed</Badge>
                    <span className="text-[0.68rem] font-bold uppercase tracking-[0.2em] text-yuzu-muted">{featuredCigarFlowItem.sourceName}</span>
                  </div>
                  <h2 className="mt-4 font-heading text-3xl leading-tight text-yuzu-cream sm:text-4xl">{featuredCigarFlowItem.title}</h2>
                  <p className="mt-3 text-sm leading-6 text-yuzu-muted">{featuredCigarFlowItem.excerpt}</p>
                </div>
              </div>
            </div>

            <div className="flex flex-col justify-center p-6 sm:p-8 lg:p-10">
              <SectionHeading
                kicker="Cigar Flow"
                title="A visual feed for cigar news, drops, and member smokes."
                copy="Cigar Flow brings manufacturer announcements, trusted cigar RSS coverage, short video signals, and Yuzu member posts into one scrollable lounge feed."
              />
              <Cascade className="mt-7 grid gap-3 sm:grid-cols-3">
                {cigarFlowStats.map((stat) => (
                  <CascadeItem key={stat.label} className="border border-yuzu-line/75 bg-yuzu-night/48 p-4">
                    <p className="font-heading text-3xl leading-none text-yuzu-cream">{stat.value}</p>
                    <p className="mt-2 text-[0.68rem] font-bold uppercase tracking-[0.16em] text-yuzu-gold">{stat.label}</p>
                    <p className="mt-2 text-xs leading-5 text-yuzu-muted">{stat.detail}</p>
                  </CascadeItem>
                ))}
              </Cascade>

              <Cascade className="mt-7 grid gap-3" stagger={0.06}>
                {homeCigarFlowItems.map((item) => (
                  <CascadeItem key={item.id}>
                    <HoverLift hoverY={-3} hoverScale={1.005}>
                      <Link
                        href="/cigar-flow"
                        className="group grid gap-4 border border-yuzu-line/75 bg-yuzu-night/40 p-3 transition hover:border-yuzu-gold/70 hover:bg-yuzu-forest/70 sm:grid-cols-[5.75rem_1fr]"
                      >
                        <ReferenceImage
                          src={item.image}
                          alt={buildEditorialImageAlt({ title: item.title, sourceName: item.sourceName })}
                          className="h-24 sm:h-full"
                          imageClassName="transition duration-700 group-hover:scale-[1.05]"
                          objectPosition={item.imagePosition}
                        />
                        <div className="min-w-0 py-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="grid size-8 place-items-center rounded-md border border-yuzu-gold/35 bg-yuzu-gold/10 text-yuzu-gold">
                              {item.kind === "rss" ? <Rss className="size-4" /> : <Radio className="size-4" />}
                            </span>
                            <span className="text-[0.66rem] font-black uppercase tracking-[0.18em] text-yuzu-gold">
                              {item.kind === "rss" ? "RSS News" : item.kind === "manufacturer" ? "Maker Drop" : "Member Post"}
                            </span>
                            <span className="text-[0.66rem] font-bold uppercase tracking-[0.14em] text-yuzu-muted">{item.publishedAt}</span>
                          </div>
                          <h3 className="mt-3 line-clamp-2 font-heading text-xl leading-tight text-yuzu-cream transition group-hover:text-yuzu-gold">
                            {item.title}
                          </h3>
                          <p className="mt-2 line-clamp-2 text-sm leading-6 text-yuzu-muted">{item.excerpt}</p>
                        </div>
                      </Link>
                    </HoverLift>
                  </CascadeItem>
                ))}
              </Cascade>

              <div className="mt-7 flex flex-col gap-3 sm:flex-row">
                <Button className="h-11 bg-yuzu-gold px-7 text-yuzu-ink hover:bg-yuzu-gold-light" render={<Link href="/cigar-flow" />}>
                  Open Cigar Flow
                  <ArrowRight data-icon="inline-end" />
                </Button>
                <Button className="h-11 border-yuzu-gold px-7 text-yuzu-gold hover:bg-yuzu-gold hover:text-yuzu-ink" variant="outline" render={<Link href="/humidor?section=tools&intent=cigar-flow" />}>
                  Prepare Smoke Note
                </Button>
              </div>
            </div>
          </div>
        </Reveal>
      </section>

      <section data-home-events="featured" className="mx-auto max-w-[1520px] px-5 pt-10 lg:px-10">
        <HomeEventFeature events={events} initialNowIso={initialNowIso} />
      </section>

      <section className="mx-auto grid max-w-[1520px] gap-8 px-5 py-12 lg:grid-cols-[1.1fr_0.9fr] lg:px-10">
        <div>
          <div className="mb-6 flex items-end justify-between gap-5">
            <SectionHeading kicker="Featured Boxes" title="Boxes worth making room for." />
            <Link href="/shop" className="hidden items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-yuzu-gold md:flex">
              View all boxes <ArrowRight />
            </Link>
          </div>
          <Cascade className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" stagger={0.05}>
            {featuredLuxuryProducts.map((product) => (
              <CascadeItem key={product.id}>
                <ProductCard product={product} compact />
              </CascadeItem>
            ))}
          </Cascade>
        </div>

        <div className="grid content-start gap-4 lg:grid-cols-1">
          <Card className="luxury-card">
            <CardHeader>
              <CardTitle className="text-sm uppercase tracking-[0.22em] text-yuzu-gold">Membership Tiers</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3">
              {tiers.map((tier) => (
                <HoverLift key={tier.name} hoverY={-3} hoverScale={1.004}>
                  <div className="grid grid-cols-[1fr_auto] items-center gap-4 border border-yuzu-line/65 bg-yuzu-night/50 p-4 transition hover:border-yuzu-gold/70">
                    <div>
                      <h3 className="font-heading text-2xl uppercase tracking-[0.12em] text-yuzu-cream">Yuzu {tier.name}</h3>
                      <p className="text-sm text-yuzu-muted">${tier.price} / month / {tier.monthlyCigars} cigars / {tier.discount}</p>
                    </div>
                    {tier.featured && <Badge className="bg-yuzu-gold text-yuzu-ink">Most Popular</Badge>}
                  </div>
                </HoverLift>
              ))}
              <Button className="mt-2 h-11 bg-yuzu-gold text-yuzu-ink hover:bg-yuzu-gold-light" render={<Link href="/membership" />}>
                Compare Tiers
              </Button>
            </CardContent>
          </Card>

          <Card className="luxury-card grid overflow-hidden md:grid-cols-[1fr_190px]">
            <CardContent className="flex flex-col justify-center gap-5 p-6">
              <div>
                <h3 className="text-sm font-bold uppercase tracking-[0.16em] text-yuzu-gold">Your cigar collection, perfectly managed.</h3>
                <p className="mt-3 text-sm leading-6 text-yuzu-muted">
                  Track purchase dates, aging windows, ratings, tasting notes, pairings, humidity, temperature, and reorder reminders.
                </p>
              </div>
              <div className="grid grid-cols-3 gap-3 text-center">
                {["69% humidity", "70 F temp", "128 cigars"].map((stat) => (
                  <div key={stat} className="border border-yuzu-line/65 bg-yuzu-night/35 py-3 text-xs uppercase tracking-[0.14em] text-yuzu-cream">
                    {stat}
                  </div>
                ))}
              </div>
              <Button className="h-11 border-yuzu-gold text-yuzu-gold hover:bg-yuzu-gold hover:text-yuzu-ink" variant="outline" render={<Link href="/humidor" />}>
                <Smartphone data-icon="inline-start" />
                Explore Humidor
              </Button>
            </CardContent>
            <ReferenceImage src="/refs/mobile-layout.png" alt="Yuzu digital humidor mobile screen" className="min-h-80" objectPosition="50% 50%" />
          </Card>
        </div>
      </section>

      <BenefitStrip />

      <section id="member-experience" data-home-member-platform="experience" className="mx-auto max-w-[1520px] px-5 py-14 lg:px-10">
        <div className="overflow-hidden rounded-md border border-yuzu-line bg-[radial-gradient(circle_at_12%_0%,rgba(220,169,58,0.14),transparent_26rem),linear-gradient(135deg,rgba(16,24,18,0.98)_0%,rgba(7,17,13,0.98)_48%,rgba(10,28,20,0.9)_100%)] shadow-[0_24px_70px_rgba(0,0,0,0.22)]">
          <div className="grid lg:grid-cols-[0.86fr_1.14fr]">
            <div className="border-b border-yuzu-line/70 p-6 sm:p-8 lg:border-b-0 lg:border-r lg:p-10">
              <p className="fine-label">Member Experience</p>
              <h2 className="mt-3 max-w-2xl font-heading text-4xl leading-tight text-yuzu-cream md:text-5xl">
                Everything your membership unlocks, in one place.
              </h2>
              <p className="mt-4 max-w-2xl text-base leading-7 text-yuzu-muted">
                Shop member-priced boxes, choose monthly cigars from the online list, reserve limited drops, track your orders, and keep every purchase connected to your digital humidor.
              </p>
              <div className="mt-8 grid gap-2 sm:grid-cols-2">
                {tiers.map((tier) => (
                  <div key={tier.name} className="border border-yuzu-line/80 bg-yuzu-night/45 p-3">
                    <p className="text-[0.72rem] font-bold uppercase tracking-[0.14em] text-yuzu-gold">{tier.name}</p>
                    <p className="mt-1 text-xs leading-5 text-yuzu-muted">{tier.cadence}</p>
                  </div>
                ))}
              </div>
            </div>

            <Cascade className="grid gap-px bg-yuzu-line/55 sm:grid-cols-2" stagger={0.05}>
              {memberPlatformHighlights.map((item, index) => {
                const Icon = item.icon;

                return (
                  <CascadeItem key={item.title} className="min-h-56 bg-yuzu-night/60 p-5 transition hover:bg-yuzu-forest/80 lg:p-6">
                    <div className="flex items-start justify-between gap-4">
                      <span className="grid size-11 shrink-0 place-items-center rounded-md border border-yuzu-gold/45 bg-yuzu-gold/10 text-yuzu-gold">
                        <Icon className="size-5" />
                      </span>
                      <span className="text-[0.68rem] font-bold uppercase tracking-[0.24em] text-yuzu-gold/80">
                        {String(index + 1).padStart(2, "0")}
                      </span>
                    </div>
                    <h3 className="mt-6 font-heading text-2xl leading-tight text-yuzu-cream">{item.title}</h3>
                    <p className="mt-3 text-sm leading-6 text-yuzu-muted">{item.copy}</p>
                  </CascadeItem>
                );
              })}
            </Cascade>
          </div>
        </div>
      </section>

      <section className="border-y border-yuzu-line bg-yuzu-forest/80">
        <div className="mx-auto grid max-w-[1520px] gap-8 px-5 py-14 lg:grid-cols-[0.8fr_1.2fr] lg:px-10">
          <div className="flex flex-col gap-5">
            <SectionHeading
              kicker="Digital Humidor"
              title="Start with your real collection. QR scans and sensor pairing can come next."
              copy="Version one helps members save cigars, aging dates, ratings, tasting notes, and reorder reminders in a private Yuzu humidor."
            />
            <Card className="luxury-card max-w-xl">
              <CardHeader>
                <CardTitle className="flex items-center gap-3 text-sm uppercase tracking-[0.16em] text-yuzu-gold">
                  <ShieldCheck />
                  Private Member Humidor
                </CardTitle>
              </CardHeader>
              <CardContent className="grid gap-3 text-sm leading-6 text-yuzu-muted">
                <p>Sign in to keep your collection saved across visits and devices.</p>
                <p>The live site only shows cigars you add, with no sample cigars, climate readings, or smoke logs mixed into your account.</p>
              </CardContent>
            </Card>
            <div data-home-humidor-video="explainer" className="max-w-xl">
              <HumidorDemoVideo />
            </div>
          </div>
          <Cascade className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" stagger={0.045}>
            {humidorFeatureList.map((feature) => {
              const Icon = feature.icon;
              return (
                <CascadeItem key={feature.title}>
                  <HoverLift hoverY={-3} hoverScale={1.005}>
                    <div className="flex items-center gap-3 border border-yuzu-line bg-yuzu-night/50 p-4 transition hover:border-yuzu-gold/70 hover:bg-yuzu-night/80">
                      <Icon className="text-yuzu-gold" />
                      <span className="text-sm font-bold uppercase tracking-[0.16em] text-yuzu-cream">{feature.title}</span>
                    </div>
                  </HoverLift>
                </CascadeItem>
              );
            })}
          </Cascade>
        </div>
      </section>

      <section className="mx-auto max-w-[1520px] px-5 py-14 lg:px-10">
        <Cascade className="grid gap-5 lg:grid-cols-2 xl:grid-cols-4" stagger={0.05}>
          {tiers.map((tier) => (
            <CascadeItem key={tier.name}>
              <MembershipCard tier={tier} />
            </CascadeItem>
          ))}
        </Cascade>
      </section>
    </>
  );
}
