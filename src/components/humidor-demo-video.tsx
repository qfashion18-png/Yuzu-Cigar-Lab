"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Play, X } from "lucide-react";

import { cn } from "@/lib/utils";

type HumidorDemoVideoProps = {
  className?: string;
};

export function HumidorDemoVideo({ className }: HumidorDemoVideoProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [open, setOpen] = useState(false);

  const closeVideo = useCallback(() => {
    videoRef.current?.pause();
    setOpen(false);
  }, []);

  useEffect(() => {
    if (!open) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const playTimer = window.setTimeout(() => {
      videoRef.current?.play().catch(() => undefined);
    }, 0);

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        closeVideo();
      }
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.clearTimeout(playTimer);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [closeVideo, open]);

  return (
    <>
      <button
        type="button"
        className={cn(
          "group grid w-full gap-3 rounded-md border border-yuzu-line bg-yuzu-night/70 p-4 text-left transition hover:border-yuzu-gold hover:bg-yuzu-panel focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yuzu-gold focus-visible:ring-offset-2 focus-visible:ring-offset-yuzu-night",
          className
        )}
        onClick={() => setOpen(true)}
      >
        <span className="flex items-center gap-3 text-xs font-bold uppercase tracking-[0.18em] text-yuzu-gold">
          <span className="grid size-9 place-items-center rounded-md border border-yuzu-gold text-yuzu-gold transition group-hover:bg-yuzu-gold group-hover:text-yuzu-ink">
            <Play className="size-4" />
          </span>
          Demo video
        </span>
        <span className="font-heading text-xl leading-tight text-yuzu-cream">
          Watch the Digital Humidor explainer
        </span>
        <span className="text-sm leading-6 text-yuzu-muted">
          See the collection workflow from overview to smoke log.
        </span>
      </button>

      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-yuzu-night/90 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="humidor-demo-video-title"
          onClick={closeVideo}
        >
          <div
            className="w-full max-w-6xl overflow-hidden rounded-md border border-yuzu-line bg-yuzu-ink shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4 border-b border-yuzu-line p-4">
              <div>
                <p id="humidor-demo-video-title" className="font-heading text-2xl leading-tight text-yuzu-cream">
                  Digital Humidor demo video
                </p>
                <p className="mt-1 text-sm leading-6 text-yuzu-muted">
                  A quick walkthrough of the Yuzu member humidor.
                </p>
              </div>
              <button
                type="button"
                aria-label="Close demo video"
                className="grid size-10 shrink-0 place-items-center rounded-md border border-yuzu-line text-yuzu-cream transition hover:border-yuzu-gold hover:text-yuzu-gold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yuzu-gold"
                onClick={closeVideo}
              >
                <X className="size-5" />
              </button>
            </div>
            <video
              ref={videoRef}
              className="aspect-video w-full bg-black"
              aria-label="Yuzu digital humidor explainer video"
              poster="/refs/humidor.png"
              src="/assets/digital-humidor-explainer.mp4"
              controls
              autoPlay
              playsInline
              preload="metadata"
            />
          </div>
        </div>
      ) : null}
    </>
  );
}
