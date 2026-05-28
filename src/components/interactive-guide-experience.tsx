"use client";

import { useState } from "react";
import {
  ArrowRight,
  BookOpenCheck,
  CheckCircle2,
  ChevronDown,
  Flame,
  Gauge,
  Layers3,
  Link as LinkIcon,
  ListChecks,
  NotebookPen,
  Sparkles,
  Target,
  Timer,
} from "lucide-react";

import { ReferenceImage } from "@/components/reference-image";
import Link from "@/components/static-link";
import { Button } from "@/components/ui/button";
import type { SeoContentPage } from "@/lib/seo-content";
import { cn } from "@/lib/utils";

type InteractiveGuideExperienceProps = {
  guide: Pick<
    SeoContentPage,
    | "title"
    | "description"
    | "primaryCta"
    | "secondaryCta"
    | "sections"
    | "faqs"
    | "internalLinks"
    | "atelierImage"
    | "atelierImageAlt"
    | "atelierImagePosition"
  >;
};

const chapterIcons = [Layers3, Gauge, NotebookPen, Sparkles];
const sessionIconClasses = [
  "bg-[#7f3f23]/40 text-[#f1b66a]",
  "bg-yuzu-forest text-[#80d39a]",
  "bg-yuzu-gold text-yuzu-ink",
];

export function InteractiveGuideExperience({ guide }: InteractiveGuideExperienceProps) {
  const [activeSectionIndex, setActiveSectionIndex] = useState(0);
  const [activeCueIndex, setActiveCueIndex] = useState(0);
  const [openFaqIndex, setOpenFaqIndex] = useState(0);
  const [completedActions, setCompletedActions] = useState<string[]>([]);

  const activeSection = guide.sections[activeSectionIndex] ?? guide.sections[0];
  const activeCue = activeSection?.bullets[activeCueIndex] ?? activeSection?.bullets[0] ?? "Start with one focused note.";
  const sessionActions = buildSessionActions(activeSection?.heading ?? guide.title, activeCue);
  const completion = Math.round((completedActions.length / sessionActions.length) * 100);

  function selectSection(index: number) {
    setActiveSectionIndex(index);
    setActiveCueIndex(0);
  }

  function toggleAction(actionId: string) {
    setCompletedActions((current) =>
      current.includes(actionId) ? current.filter((id) => id !== actionId) : [...current, actionId]
    );
  }

  return (
    <section
      data-guide-interactive="atelier"
      className="relative overflow-hidden border-b border-yuzu-line/70 bg-[linear-gradient(180deg,rgba(7,17,13,0.86),rgba(3,5,4,0.98))]"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[linear-gradient(115deg,rgba(248,237,215,0.04)_0_1px,transparent_1px_28px),radial-gradient(ellipse_at_18%_16%,rgba(220,169,58,0.12),transparent_28rem),radial-gradient(ellipse_at_88%_42%,rgba(34,92,62,0.2),transparent_30rem)]"
      />

      <div className="relative mx-auto grid max-w-[1520px] gap-7 px-5 py-12 lg:grid-cols-[minmax(0,1fr)_390px] lg:px-10 lg:py-14">
        <div className="grid gap-5">
          <div className="grid gap-4 lg:grid-cols-[minmax(0,0.9fr)_minmax(280px,0.44fr)]">
            <div className="border border-yuzu-line bg-yuzu-panel/78 p-5 shadow-[0_24px_70px_rgba(0,0,0,0.28)] sm:p-7">
              <div className="flex flex-wrap items-center gap-3">
                <span className="grid size-10 place-items-center border border-yuzu-gold bg-yuzu-night text-yuzu-gold">
                  <BookOpenCheck className="size-5" />
                </span>
                <p className="text-xs font-black uppercase tracking-[0.22em] text-yuzu-gold">Interactive Guide</p>
              </div>
              <h2 className="mt-5 font-heading text-4xl leading-tight text-yuzu-cream sm:text-5xl">
                {guide.title}
              </h2>
              <p className="mt-4 max-w-3xl text-base leading-8 text-yuzu-muted">{guide.description}</p>
            </div>

            <LuxuryGuideImage
              activeSectionIndex={activeSectionIndex}
              alt={guide.atelierImageAlt ?? `${guide.title} luxury cigar guide atelier`}
              sectionCount={guide.sections.length}
              src={guide.atelierImage ?? "/assets/guides/luxury-guide-atelier.png"}
              objectPosition={guide.atelierImagePosition ?? "50% 50%"}
            />
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            {guide.sections.map((section, index) => {
              const ChapterIcon = chapterIcons[index % chapterIcons.length];
              const isActive = activeSectionIndex === index;

              return (
                <button
                  key={section.heading}
                  type="button"
                  aria-pressed={isActive}
                  onClick={() => selectSection(index)}
                  className={cn(
                    "group min-h-32 border p-4 text-left transition focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-yuzu-gold/45",
                    isActive
                      ? "border-yuzu-gold bg-yuzu-gold text-yuzu-ink shadow-[0_18px_50px_rgba(220,169,58,0.16)]"
                      : "border-yuzu-line bg-yuzu-night/58 text-yuzu-cream hover:border-yuzu-gold/80 hover:bg-yuzu-panel"
                  )}
                >
                  <div className="flex items-center justify-between gap-3">
                    <span
                      className={cn(
                        "grid size-9 place-items-center border transition",
                        isActive ? "border-yuzu-ink/35 bg-yuzu-ink text-yuzu-gold" : "border-yuzu-line bg-yuzu-panel text-yuzu-gold"
                      )}
                    >
                      <ChapterIcon className="size-4" />
                    </span>
                    <span className="text-[0.66rem] font-black uppercase tracking-[0.18em]">
                      Chapter {String(index + 1).padStart(2, "0")}
                    </span>
                  </div>
                  <span className="mt-4 block font-heading text-2xl leading-tight">{section.heading}</span>
                </button>
              );
            })}
          </div>

          <article className="grid gap-5 border border-yuzu-line bg-yuzu-panel/78 p-5 shadow-[0_26px_80px_rgba(0,0,0,0.32)] sm:p-7">
            <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_330px]">
              <div>
                <div className="flex items-center gap-3 text-xs font-black uppercase tracking-[0.18em] text-yuzu-gold">
                  <span>{String(activeSectionIndex + 1).padStart(2, "0")}</span>
                  <span className="h-px w-10 bg-yuzu-line" />
                  <span>{activeSection?.heading}</span>
                </div>
                <p className="mt-5 text-lg leading-9 text-yuzu-cream/88">{activeSection?.body}</p>
              </div>

              <div className="border border-yuzu-line/75 bg-yuzu-night/58 p-4">
                <div className="flex items-start gap-3">
                  <Flame className="mt-1 size-5 text-yuzu-gold" />
                  <div>
                    <p className="text-[0.68rem] font-black uppercase tracking-[0.2em] text-yuzu-gold">Active Tasting Cue</p>
                    <p className="mt-2 font-heading text-2xl leading-tight text-yuzu-cream">{activeCue}</p>
                  </div>
                </div>
                <div className="mt-5 grid gap-2">
                  {activeSection?.bullets.map((bullet, index) => (
                    <button
                      key={bullet}
                      type="button"
                      aria-pressed={activeCueIndex === index}
                      onClick={() => setActiveCueIndex(index)}
                      className={cn(
                        "border px-3 py-3 text-left text-sm leading-5 transition focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-yuzu-gold/45",
                        activeCueIndex === index
                          ? "border-yuzu-gold bg-yuzu-gold text-yuzu-ink"
                          : "border-yuzu-line bg-yuzu-panel/70 text-yuzu-cream hover:border-yuzu-gold"
                      )}
                    >
                      {bullet}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="grid gap-3 border-t border-yuzu-line/70 pt-5 md:grid-cols-3">
              {sessionActions.map((action, index) => {
                const done = completedActions.includes(action.id);
                const ActionIcon = action.icon;

                return (
                  <button
                    key={action.id}
                    type="button"
                    aria-pressed={done}
                    onClick={() => toggleAction(action.id)}
                    className={cn(
                      "min-h-40 border p-4 text-left transition focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-yuzu-gold/45",
                      done ? "border-yuzu-gold bg-yuzu-gold text-yuzu-ink" : "border-yuzu-line bg-yuzu-night/58 text-yuzu-cream hover:border-yuzu-gold"
                    )}
                  >
                    <span className={cn("grid size-10 place-items-center border border-current", done ? "bg-yuzu-ink text-yuzu-gold" : sessionIconClasses[index])}>
                      {done ? <CheckCircle2 className="size-5" /> : <ActionIcon className="size-5" />}
                    </span>
                    <span className="mt-4 block text-[0.66rem] font-black uppercase tracking-[0.18em]">Smoke Session</span>
                    <span className="mt-2 block font-heading text-2xl leading-tight">{action.label}</span>
                    <span className="mt-2 block text-sm leading-6 opacity-80">{action.copy}</span>
                  </button>
                );
              })}
            </div>
          </article>
        </div>

        <aside className="grid content-start gap-4 lg:sticky lg:top-24">
          <div className="border border-yuzu-gold/70 bg-[linear-gradient(180deg,rgba(16,24,18,0.98),rgba(5,11,8,0.98))] p-5 shadow-[0_26px_80px_rgba(0,0,0,0.36)]">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.2em] text-yuzu-gold">Guide Progress</p>
                <p className="mt-2 font-heading text-4xl text-yuzu-cream">{completion}%</p>
              </div>
              <span className="grid size-14 place-items-center border border-yuzu-line bg-yuzu-night text-yuzu-gold">
                <ListChecks className="size-6" />
              </span>
            </div>
            <div
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={completion}
              aria-label="Smoke session checklist progress"
              className="mt-5 h-3 border border-yuzu-line bg-yuzu-night"
            >
              <div className="h-full bg-yuzu-gold transition-all duration-300" style={{ width: `${completion}%` }} />
            </div>
            <p className="mt-4 text-sm leading-6 text-yuzu-muted">
              Tap each Smoke Session action as you move from reading to the next cigar.
            </p>
            <div className="mt-5 grid gap-3">
              <Button className="h-11 bg-yuzu-gold text-yuzu-ink hover:bg-yuzu-gold-light" render={<Link href={guide.primaryCta.href} />}>
                {guide.primaryCta.label}
                <ArrowRight data-icon="inline-end" />
              </Button>
              <Button className="h-11 border-yuzu-line text-yuzu-cream hover:border-yuzu-gold hover:bg-yuzu-gold hover:text-yuzu-ink" variant="outline" render={<Link href={guide.secondaryCta.href} />}>
                {guide.secondaryCta.label}
              </Button>
            </div>
          </div>

          <div className="border border-yuzu-line bg-yuzu-panel/78 p-5">
            <div className="flex items-center gap-2 text-sm font-black uppercase tracking-[0.18em] text-yuzu-gold">
              <LinkIcon className="size-4" />
              Related Links
            </div>
            <div className="mt-4 grid gap-3">
              {guide.internalLinks.map((link) => (
                <Link key={link.href} href={link.href} className="group border border-yuzu-line/70 bg-yuzu-night/60 p-3 transition hover:border-yuzu-gold/70">
                  <span className="font-heading text-lg text-yuzu-cream transition group-hover:text-yuzu-gold">{link.label}</span>
                  <span className="mt-1 block text-xs leading-5 text-yuzu-muted">{link.description}</span>
                </Link>
              ))}
            </div>
          </div>

          <div className="border border-yuzu-line bg-yuzu-panel/78 p-5">
            <p className="text-sm font-black uppercase tracking-[0.18em] text-yuzu-gold">FAQ</p>
            <div className="mt-4 grid gap-3">
              {guide.faqs.map((faq, index) => {
                const isOpen = openFaqIndex === index;

                return (
                  <div key={faq.question} className="border border-yuzu-line/70 bg-yuzu-night/58">
                    <button
                      type="button"
                      aria-expanded={isOpen}
                      onClick={() => setOpenFaqIndex(isOpen ? -1 : index)}
                      className="flex w-full items-start justify-between gap-3 p-3 text-left focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-yuzu-gold/45"
                    >
                      <span className="font-heading text-lg leading-tight text-yuzu-cream">{faq.question}</span>
                      <ChevronDown className={cn("mt-1 size-4 shrink-0 text-yuzu-gold transition", isOpen && "rotate-180")} />
                    </button>
                    {isOpen ? <p className="px-3 pb-4 text-sm leading-6 text-yuzu-muted">{faq.answer}</p> : null}
                  </div>
                );
              })}
            </div>
          </div>
        </aside>
      </div>
    </section>
  );
}

function LuxuryGuideImage({
  activeSectionIndex,
  alt,
  objectPosition,
  sectionCount,
  src,
}: {
  activeSectionIndex: number;
  alt: string;
  objectPosition: string;
  sectionCount: number;
  src: string;
}) {
  return (
    <div className="relative min-h-72 overflow-hidden border border-yuzu-line bg-yuzu-ink shadow-[0_24px_70px_rgba(0,0,0,0.34)]">
      <ReferenceImage
        src={src}
        alt={alt}
        className="absolute inset-0"
        imageClassName="opacity-95"
        objectPosition={objectPosition}
      />
      <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(3,5,4,0.62)_0%,rgba(3,5,4,0.04)_54%,rgba(3,5,4,0.5)_100%),linear-gradient(180deg,rgba(3,5,4,0.04)_0%,rgba(3,5,4,0.82)_100%)]" />
      <div className="relative z-10 flex h-full min-h-72 flex-col justify-end p-5">
        <div className="grid grid-cols-3 gap-2">
          {Array.from({ length: sectionCount }).map((_, index) => (
            <span
              key={index}
              className={cn(
                "h-2 border border-yuzu-line bg-yuzu-night/75 transition",
                index <= activeSectionIndex && "border-yuzu-gold bg-yuzu-gold"
              )}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function buildSessionActions(sectionHeading: string, cue: string) {
  return [
    {
      id: "choose",
      label: "Choose the cigar",
      copy: `Use ${sectionHeading.toLowerCase()} as the lens for tonight's cigar.`,
      icon: Target,
    },
    {
      id: "pace",
      label: "Set the pace",
      copy: "Keep the draw slow enough for cedar, spice, and sweetness to separate.",
      icon: Timer,
    },
    {
      id: "log",
      label: "Log the cue",
      copy: `Save one note around "${cue}" in your humidor after the final third.`,
      icon: NotebookPen,
    },
  ];
}
