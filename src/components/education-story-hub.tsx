"use client";

import { useEffect, useRef, useState } from "react";

import { CigarEducationExperience } from "@/components/cigar-education-experience";
import { EducationJournalExplorer } from "@/components/education-journal-explorer";
import type { CigarEducationStory } from "@/lib/data";

type EducationStoryHubProps = {
  stories: CigarEducationStory[];
};

export function EducationStoryHub({ stories }: EducationStoryHubProps) {
  const [storyOpen, setStoryOpen] = useState(false);
  const [activeStoryId, setActiveStoryId] = useState(stories[0]?.storyId ?? "");
  const storyRegionRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!storyOpen) {
      return;
    }

    const frame = window.requestAnimationFrame(() => {
      storyRegionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });

    return () => window.cancelAnimationFrame(frame);
  }, [activeStoryId, storyOpen]);

  function openStory(storyId: string) {
    setActiveStoryId(storyId);
    setStoryOpen(true);
  }

  return (
    <>
      <EducationJournalExplorer onOpenStory={openStory} />
      <div ref={storyRegionRef} className="scroll-mt-24">
        <CigarEducationExperience
          stories={stories}
          open={storyOpen}
          activeStoryId={activeStoryId}
          onActiveStoryChange={setActiveStoryId}
          onOpenChange={setStoryOpen}
        />
      </div>
    </>
  );
}
