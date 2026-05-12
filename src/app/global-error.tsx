"use client";

import { AlertOctagon } from "lucide-react";
import { useEffect } from "react";

type GlobalErrorProps = {
  error: Error & { digest?: string };
  unstable_retry: () => void;
};

export default function GlobalError({ error, unstable_retry }: GlobalErrorProps) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="en" className="dark h-full">
      <body className="min-h-full bg-yuzu-night text-yuzu-cream">
        <main className="grid min-h-screen place-items-center px-5 py-10">
          <section className="luxury-card w-full max-w-xl p-7">
            <div className="grid size-12 place-items-center border border-yuzu-gold/55 bg-yuzu-gold/10 text-yuzu-gold">
              <AlertOctagon className="size-5" />
            </div>
            <p className="mt-5 fine-label">Global Error</p>
            <h1 className="mt-3 font-heading text-4xl text-yuzu-cream">The app hit an unexpected issue.</h1>
            <p className="mt-4 text-sm leading-6 text-yuzu-muted">
              Refresh this section to restore the storefront shell. If the error continues, check deployment logs with the reference below.
            </p>
            {error.digest ? (
              <p className="mt-3 text-xs text-yuzu-muted/90">
                Error reference: <span className="font-mono">{error.digest}</span>
              </p>
            ) : null}
            <button
              className="mt-6 h-11 rounded-lg bg-yuzu-gold px-4 text-sm font-medium text-yuzu-ink transition hover:bg-yuzu-gold-light"
              onClick={() => unstable_retry()}
              type="button"
            >
              Try Again
            </button>
          </section>
        </main>
      </body>
    </html>
  );
}
