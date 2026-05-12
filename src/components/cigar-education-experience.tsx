"use client";

import { useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  BookOpenCheck,
  CheckCircle2,
  Clock3,
  ListChecks,
  NotebookPen,
  Sparkles,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { CigarEducationStory } from "@/lib/data";
import { cn } from "@/lib/utils";

type CigarEducationExperienceProps = {
  stories: CigarEducationStory[];
  initialOpen?: boolean;
  open?: boolean;
  activeStoryId?: string;
  onOpenChange?: (open: boolean) => void;
  onActiveStoryChange?: (storyId: string) => void;
};

type ActiveCueSelection = {
  storyId: string;
  index: number;
};

const labChecks = [
  {
    label: "Rest period",
    value: "30 days",
    copy: "Let shipped boxes settle before judging aroma, burn, or draw.",
  },
  {
    label: "Storage range",
    value: "65%-69%",
    copy: "Treat humidity as a range and correct slowly when conditions drift.",
  },
  {
    label: "Pace target",
    value: "1 puff/min",
    copy: "A calmer rhythm keeps the cigar cooler and the flavor easier to read.",
  },
];

export function CigarEducationExperience({
  stories,
  initialOpen = false,
  open,
  activeStoryId: controlledActiveStoryId,
  onOpenChange,
  onActiveStoryChange,
}: CigarEducationExperienceProps) {
  const [internalActiveStoryId, setInternalActiveStoryId] = useState(stories[0]?.storyId ?? "");
  const [activeCueSelection, setActiveCueSelection] = useState<ActiveCueSelection>({
    storyId: stories[0]?.storyId ?? "",
    index: 0,
  });
  const [completedStoryIds, setCompletedStoryIds] = useState<string[]>([]);
  const [internalOpen, setInternalOpen] = useState(initialOpen);
  const activeStoryId = controlledActiveStoryId ?? internalActiveStoryId;

  const activeIndex = Math.max(
    stories.findIndex((story) => story.storyId === activeStoryId),
    0
  );
  const activeStory = stories[activeIndex] ?? stories[0];
  const activeCueIndex = activeCueSelection.storyId === activeStory?.storyId ? activeCueSelection.index : 0;
  const activeCue = activeStory?.tastingCues[activeCueIndex] ??
    activeStory?.tastingCues[0] ?? { label: "Lesson", detail: "Choose a story to see its tasting cue." };
  const isReaderOpen = open ?? internalOpen;

  if (!activeStory) {
    return null;
  }

  function setReaderOpen(nextOpen: boolean) {
    if (open === undefined) {
      setInternalOpen(nextOpen);
    }

    onOpenChange?.(nextOpen);
  }

  function selectStory(storyId: string) {
    if (controlledActiveStoryId === undefined) {
      setInternalActiveStoryId(storyId);
    }

    setActiveCueSelection({ storyId, index: 0 });
    onActiveStoryChange?.(storyId);
  }

  function moveStory(direction: -1 | 1) {
    const nextIndex = (activeIndex + direction + stories.length) % stories.length;
    const nextStory = stories[nextIndex];

    if (nextStory) {
      selectStory(nextStory.storyId);
    }
  }

  function toggleCompleted(storyId: string) {
    setCompletedStoryIds((current) =>
      current.includes(storyId)
        ? current.filter((completedStoryId) => completedStoryId !== storyId)
        : [...current, storyId]
    );
  }

  if (!isReaderOpen) {
    return (
      <section
        id="stories"
        className="relative z-10 mx-auto max-w-[1520px] px-5 lg:px-10"
        data-story-shell="closed"
      />
    );
  }

  const isActiveComplete = completedStoryIds.includes(activeStory.storyId);

  return (
    <section
      id="stories"
      data-story-layout="focused-reader"
      className="relative z-10 mx-auto max-w-[1120px] scroll-mt-24 px-4 pb-14 pt-6 sm:px-5 lg:pb-18 lg:pt-8"
    >
      <article
        data-story-region="complete-story"
        className="overflow-hidden border border-yuzu-gold/80 bg-[linear-gradient(180deg,rgba(12,22,16,0.98),rgba(5,11,8,0.98))] shadow-[0_34px_100px_rgba(0,0,0,0.45)]"
      >
        <div className="flex flex-col gap-4 border-b border-yuzu-line bg-yuzu-panel/72 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
          <div className="flex items-start gap-3">
            <BookOpenCheck className="mt-1 size-5 text-yuzu-gold" />
            <div>
              <p className="text-[0.68rem] font-black uppercase tracking-[0.28em] text-yuzu-gold">Complete Story</p>
              <h2 className="mt-2 font-heading text-2xl leading-tight text-yuzu-cream sm:text-3xl">
                {activeStory.title}
              </h2>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="w-fit border border-yuzu-line bg-yuzu-night/45 px-3 py-2 text-[0.64rem] font-black uppercase tracking-[0.18em] text-yuzu-muted">
              Story {activeIndex + 1} / {stories.length}
            </span>
            <Button
              type="button"
              variant="outline"
              className="h-9 rounded-none border-yuzu-line px-3 text-[0.64rem] font-black uppercase tracking-[0.16em] text-yuzu-cream hover:border-yuzu-gold hover:bg-yuzu-gold hover:text-yuzu-ink"
              onClick={() => setReaderOpen(false)}
            >
              Journal
            </Button>
          </div>
        </div>

        <div className="grid gap-4 p-4 sm:p-5 lg:p-6">
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(320px,0.9fr)]">
            <StoryPanel className="min-h-[360px]">
              <div className="flex items-start gap-3">
                <NotebookPen className="mt-1 size-5 text-yuzu-gold" />
                <div>
                  <p className="text-[0.68rem] font-black uppercase tracking-[0.24em] text-yuzu-gold">Read the Story</p>
                  <h3 className="mt-2 font-heading text-3xl leading-tight text-yuzu-cream">Three teachable moments</h3>
                </div>
              </div>
              <div className="mt-5 grid gap-4">
                {activeStory.chapters.map((chapter, index) => (
                  <section key={chapter.heading} className="grid gap-2 border border-yuzu-line bg-yuzu-night/45 p-4">
                    <div className="flex items-center gap-3">
                      <span className="grid size-7 shrink-0 place-items-center border border-yuzu-gold text-xs font-black text-yuzu-gold">
                        {index + 1}
                      </span>
                      <h4 className="font-heading text-xl leading-tight text-yuzu-cream sm:text-2xl">{chapter.heading}</h4>
                    </div>
                    <p className="text-sm leading-6 text-yuzu-muted">{chapter.body}</p>
                  </section>
                ))}
              </div>
            </StoryPanel>

            <div className="grid gap-4">
              <StoryPanel>
                <div className="flex items-start gap-3">
                  <Sparkles className="mt-1 size-5 text-yuzu-gold" />
                  <div>
                    <p className="text-[0.68rem] font-black uppercase tracking-[0.24em] text-yuzu-gold">Tasting Cue</p>
                    <h3 className="mt-2 font-heading text-3xl leading-tight text-yuzu-cream">{activeCue.label}</h3>
                  </div>
                </div>
                <p className="mt-3 text-sm leading-6 text-yuzu-muted">{activeCue.detail}</p>
                <div className="mt-5 grid gap-2 sm:grid-cols-3 lg:grid-cols-1 2xl:grid-cols-3">
                  {activeStory.tastingCues.map((cue, index) => (
                    <button
                      key={cue.label}
                      type="button"
                      aria-pressed={activeCueIndex === index}
                      onClick={() => setActiveCueSelection({ storyId: activeStory.storyId, index })}
                      className={cn(
                        "border px-3 py-3 text-left text-[0.64rem] font-black uppercase tracking-[0.16em] transition",
                        activeCueIndex === index
                          ? "border-yuzu-gold bg-yuzu-gold text-yuzu-ink"
                          : "border-yuzu-line bg-yuzu-night/50 text-yuzu-cream hover:border-yuzu-gold"
                      )}
                    >
                      {cue.label}
                    </button>
                  ))}
                </div>
              </StoryPanel>

              <StoryPanel>
                <div className="flex items-start gap-3">
                  <ListChecks className="mt-1 size-5 text-yuzu-gold" />
                  <div>
                    <p className="text-[0.68rem] font-black uppercase tracking-[0.24em] text-yuzu-gold">Practice</p>
                    <h3 className="mt-2 font-heading text-3xl leading-tight text-yuzu-cream">Try it next smoke</h3>
                  </div>
                </div>
                <ul className="mt-5 grid gap-3">
                  {activeStory.practice.map((item) => (
                    <li key={item} className="flex gap-3 text-sm leading-6 text-yuzu-muted">
                      <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-yuzu-gold" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </StoryPanel>
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
            <StoryPanel>
              <p className="text-[0.68rem] font-black uppercase tracking-[0.24em] text-yuzu-gold">Field Notes</p>
              <div className="mt-5 grid gap-3">
                {activeStory.fieldNotes.map((note) => (
                  <div key={note} className="border border-yuzu-line bg-yuzu-night/45 p-4 text-sm leading-6 text-yuzu-cream">
                    {note}
                  </div>
                ))}
              </div>
            </StoryPanel>

            <StoryPanel>
              <div>
                <p className="text-[0.68rem] font-black uppercase tracking-[0.24em] text-yuzu-gold">Cigar Lab</p>
                <h3 className="mt-2 font-heading text-3xl leading-tight text-yuzu-cream">Apply the lesson to your next box.</h3>
              </div>
              <div className="mt-5 grid gap-3 sm:grid-cols-3">
                {labChecks.map((check) => (
                  <div key={check.label} className="border border-yuzu-line bg-yuzu-night/50 p-4">
                    <p className="text-[0.62rem] font-black uppercase tracking-[0.18em] text-yuzu-gold">{check.label}</p>
                    <p className="mt-2 font-heading text-3xl text-yuzu-cream">{check.value}</p>
                    <p className="mt-2 text-xs leading-5 text-yuzu-muted">{check.copy}</p>
                  </div>
                ))}
              </div>
              <div className="mt-5 grid gap-3 border-t border-yuzu-line pt-5 md:grid-cols-2">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.2em] text-yuzu-gold">Pairing prompt</p>
                  <p className="mt-2 text-sm leading-6 text-yuzu-muted">{activeStory.pairing}</p>
                </div>
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.2em] text-yuzu-gold">Humidor action</p>
                  <p className="mt-2 text-sm leading-6 text-yuzu-muted">{activeStory.humidorAction}</p>
                </div>
              </div>
            </StoryPanel>
          </div>

          <div
            data-story-actions="complete-story"
            className="flex flex-col gap-3 border-t border-yuzu-line bg-yuzu-night/45 pt-4 sm:flex-row"
          >
            <Button
              type="button"
              variant="outline"
              className="h-10 rounded-none border-yuzu-line px-4 text-yuzu-cream hover:border-yuzu-gold hover:bg-yuzu-gold hover:text-yuzu-ink"
              onClick={() => moveStory(-1)}
            >
              <ArrowLeft data-icon="inline-start" />
              Previous
            </Button>
            <Button
              type="button"
              className={cn(
                "h-10 rounded-none px-4",
                isActiveComplete
                  ? "border-yuzu-gold bg-yuzu-night text-yuzu-gold hover:bg-yuzu-gold hover:text-yuzu-ink"
                  : "bg-yuzu-gold text-yuzu-ink hover:bg-yuzu-gold-light"
              )}
              variant={isActiveComplete ? "outline" : "default"}
              onClick={() => toggleCompleted(activeStory.storyId)}
            >
              <CheckCircle2 data-icon="inline-start" />
              {isActiveComplete ? "Marked Read" : "Mark as Read"}
            </Button>
            <Button
              type="button"
              variant="outline"
              className="h-10 rounded-none border-yuzu-line px-4 text-yuzu-cream hover:border-yuzu-gold hover:bg-yuzu-gold hover:text-yuzu-ink sm:ml-auto"
              onClick={() => moveStory(1)}
            >
              Next
              <ArrowRight data-icon="inline-end" />
            </Button>
          </div>

          <div className="flex flex-wrap items-center gap-3 border-t border-yuzu-line/70 pt-4 text-xs font-bold uppercase tracking-[0.16em] text-yuzu-muted">
            <span className="inline-flex items-center gap-2">
              <Clock3 className="size-4 text-yuzu-gold" />
              {activeStory.minutes} min read
            </span>
            <span className="h-4 w-px bg-yuzu-line" />
            <span className="text-yuzu-gold">{activeStory.category}</span>
            <span className="h-4 w-px bg-yuzu-line" />
            <span>{activeStory.level}</span>
          </div>
        </div>
      </article>
    </section>
  );
}

function StoryPanel({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <Card className={cn("rounded-none border-yuzu-line bg-yuzu-panel/70", className)}>
      <CardContent className="p-5 sm:p-6">{children}</CardContent>
    </Card>
  );
}
