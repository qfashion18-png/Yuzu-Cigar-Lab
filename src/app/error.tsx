"use client";

import { AlertTriangle } from "lucide-react";
import { useEffect } from "react";

import Link from "@/components/static-link";
import { Button } from "@/components/ui/button";

type AppSegmentErrorProps = {
  error: Error & { digest?: string };
  unstable_retry: () => void;
};

export default function AppSegmentError({ error, unstable_retry }: AppSegmentErrorProps) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="grid min-h-screen place-items-center bg-[radial-gradient(circle_at_20%_0%,rgba(15,83,55,0.34),transparent_34rem),#030504] px-5 py-10 text-yuzu-cream">
      <section className="luxury-card w-full max-w-xl p-7">
        <div className="grid size-12 place-items-center border border-yuzu-gold/55 bg-yuzu-gold/10 text-yuzu-gold">
          <AlertTriangle className="size-5" />
        </div>
        <p className="mt-5 fine-label">Service Recovery</p>
        <h1 className="mt-3 font-heading text-4xl text-yuzu-cream">Something interrupted this page.</h1>
        <p className="mt-4 text-sm leading-6 text-yuzu-muted">
          Try loading this section again. If the issue keeps happening, return home and retry in a moment.
        </p>
        {error.digest ? (
          <p className="mt-3 text-xs text-yuzu-muted/90">
            Error reference: <span className="font-mono">{error.digest}</span>
          </p>
        ) : null}
        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <Button className="h-11 bg-yuzu-gold text-yuzu-ink hover:bg-yuzu-gold-light" onClick={() => unstable_retry()}>
            Try Again
          </Button>
          <Button className="h-11 border-yuzu-line text-yuzu-cream" render={<Link href="/" />} variant="outline">
            Back To Home
          </Button>
        </div>
      </section>
    </main>
  );
}
