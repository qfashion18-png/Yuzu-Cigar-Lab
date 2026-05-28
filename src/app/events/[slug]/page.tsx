import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ArrowLeft, CalendarDays, CheckCircle2, Clock3, MapPin, Ticket, Users } from "lucide-react";

import { LocalActionButton } from "@/components/local-action-button";
import { ReferenceImage } from "@/components/reference-image";
import Link from "@/components/static-link";
import { Button } from "@/components/ui/button";
import { events, getEventBySlug } from "@/lib/data";
import { buildBreadcrumbJsonLd, buildEventJsonLd, buildPageMetadata, jsonLdScriptProps } from "@/lib/seo";

type EventDetailPageProps = {
  params: Promise<{ slug: string }>;
};

export const dynamicParams = false;

export function generateStaticParams() {
  return events.map((event) => ({ slug: event.slug }));
}

export async function generateMetadata({ params }: EventDetailPageProps): Promise<Metadata> {
  const { slug } = await params;
  const event = getEventBySlug(slug);

  if (!event) {
    return {
      title: "Event Not Found | Yuzu Cigar Club",
    };
  }

  return buildPageMetadata({
    title: `${event.title} | Yuzu Cigar Club Events`,
    description: event.deck,
    path: `/events/${event.slug}/`,
    image: event.image,
    imageAlt: `${event.title} event setting`,
    keywords: [event.title, "cigar event", event.location, event.access],
  });
}

export default async function EventDetailPage({ params }: EventDetailPageProps) {
  const { slug } = await params;
  const event = getEventBySlug(slug);

  if (!event) {
    notFound();
  }

  const reservationKey = `yuzu-event-rsvp-${event.slug}`;
  const eventJsonLd = buildEventJsonLd(event);
  const breadcrumbJsonLd = buildBreadcrumbJsonLd([
    { name: "Home", path: "/" },
    { name: "Events", path: "/events/" },
    { name: event.title, path: `/events/${event.slug}/` },
  ]);

  return (
    <div className="mx-auto flex max-w-[1520px] flex-col gap-8 px-5 py-8 lg:px-10">
      <script {...jsonLdScriptProps(eventJsonLd)} />
      <script {...jsonLdScriptProps(breadcrumbJsonLd)} />
      <Link href="/events" className="inline-flex w-fit items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-yuzu-muted transition hover:text-yuzu-gold">
        <ArrowLeft className="size-4" />
        Back to events
      </Link>

      <section className="grid overflow-hidden border border-yuzu-line bg-yuzu-panel shadow-[0_28px_80px_rgba(0,0,0,0.32)] lg:grid-cols-[1.08fr_0.92fr]">
        <div className="relative min-h-[22rem] border-b border-yuzu-line bg-yuzu-ink lg:min-h-[40rem] lg:border-b-0 lg:border-r">
          <ReferenceImage
            src={event.image}
            alt={`${event.title} event setting`}
            className="absolute inset-0 h-full"
            imageClassName="opacity-92"
            objectPosition={event.imagePosition}
            priority
          />
          <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(3,5,4,0.08)_0%,rgba(3,5,4,0.18)_42%,rgba(3,5,4,0.88)_100%)]" />
          <div className="absolute inset-x-5 bottom-5 max-w-xl border border-yuzu-gold/45 bg-yuzu-night/82 p-5 backdrop-blur">
            <p className="text-xs font-black uppercase tracking-[0.26em] text-yuzu-gold">Featured Event</p>
            <p className="mt-3 text-sm leading-6 text-yuzu-cream/86">{event.deck}</p>
          </div>
        </div>

        <div className="flex flex-col justify-between gap-8 p-6 md:p-8 lg:p-10">
          <div className="grid gap-6">
            <div className="flex flex-wrap items-center gap-3 text-xs font-bold uppercase tracking-[0.22em] text-yuzu-gold">
              <span>{event.access} access</span>
              <span className="h-px w-8 bg-yuzu-line" />
              <span>{event.capacity}</span>
            </div>

            <div className="space-y-4">
              <h1 className="font-heading text-4xl leading-tight text-yuzu-cream md:text-6xl">{event.title}</h1>
              <p className="max-w-2xl text-base leading-8 text-yuzu-muted md:text-lg">{event.description}</p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <EventSpec icon={CalendarDays} label="Date" value={event.date} />
              <EventSpec icon={Clock3} label="Time" value={event.time} />
              <EventSpec icon={MapPin} label="Location" value={event.location} />
              <EventSpec icon={Users} label="Host" value={event.host} />
            </div>
          </div>

          <div className="border-t border-yuzu-line pt-6">
            <LocalActionButton
              storageKey={reservationKey}
              idleLabel="Reserve Seat"
              completedLabel="Seat Reserved"
              statusText="Event RSVP saved on this device."
              className="h-12 w-full bg-yuzu-gold px-8 text-yuzu-ink hover:bg-yuzu-gold-light sm:w-fit"
              variant="default"
            />
          </div>
        </div>
      </section>

      <section className="grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
        <DetailPanel title="What to expect" icon={Ticket}>
          <ul className="grid gap-3">
            {event.includes.map((item) => (
              <li key={item} className="flex items-start gap-3 text-sm leading-6 text-yuzu-muted">
                <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-yuzu-gold" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </DetailPanel>

        <DetailPanel title="Event flow" icon={Clock3}>
          <div className="grid gap-4">
            {event.agenda.map((item) => (
              <div key={`${item.time}-${item.label}`} className="grid grid-cols-[5.5rem_1fr] gap-4 border-b border-yuzu-line/60 pb-4 last:border-b-0 last:pb-0">
                <span className="text-xs font-black uppercase tracking-[0.16em] text-yuzu-gold">{item.time}</span>
                <span className="text-sm leading-6 text-yuzu-muted">{item.label}</span>
              </div>
            ))}
          </div>
        </DetailPanel>
      </section>

      <section className="grid gap-5 border border-yuzu-line bg-yuzu-forest/70 p-6 md:grid-cols-[1fr_auto] md:items-center md:p-8">
        <div>
          <h2 className="font-heading text-3xl text-yuzu-cream">Best fit for</h2>
          <div className="mt-4 flex flex-wrap gap-2">
            {event.goodFor.map((item) => (
              <span key={item} className="border border-yuzu-line bg-yuzu-night px-3 py-2 text-sm text-yuzu-cream">
                {item}
              </span>
            ))}
          </div>
        </div>
        <Button className="h-11 border-yuzu-gold px-8 text-yuzu-gold hover:bg-yuzu-gold hover:text-yuzu-ink" variant="outline" render={<Link href="/membership" />}>
          Membership Access
        </Button>
      </section>
    </div>
  );
}

function EventSpec({ icon: Icon, label, value }: { icon: typeof CalendarDays; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 border border-yuzu-line bg-yuzu-night p-4">
      <Icon className="size-5 text-yuzu-gold" />
      <div>
        <p className="text-[0.7rem] font-bold uppercase tracking-[0.18em] text-yuzu-muted">{label}</p>
        <p className="font-heading text-lg text-yuzu-cream">{value}</p>
      </div>
    </div>
  );
}

function DetailPanel({ title, icon: Icon, children }: { title: string; icon: typeof CalendarDays; children: React.ReactNode }) {
  return (
    <div className="border border-yuzu-line bg-yuzu-panel p-5 md:p-6">
      <div className="mb-4 flex items-center gap-3">
        <Icon className="size-5 text-yuzu-gold" />
        <h2 className="text-xs font-bold uppercase tracking-[0.22em] text-yuzu-gold">{title}</h2>
      </div>
      {children}
    </div>
  );
}
