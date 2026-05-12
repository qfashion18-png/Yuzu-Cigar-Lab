"use client";

import Link from "@/components/static-link";
import { LoaderCircle, TriangleAlert } from "lucide-react";
import { useEffect, useState } from "react";

import { useBackupAuth } from "@/components/backup-auth-provider";
import { Button } from "@/components/ui/button";

export function CognitoCallback() {
  const auth = useBackupAuth();
  const [status, setStatus] = useState<"loading" | "error">("loading");
  const [message, setMessage] = useState("Finishing secure sign-in.");

  useEffect(() => {
    let cancelled = false;

    const completeSignIn = async () => {
      try {
        const result = await auth.completeCognitoCallback();
        if (cancelled) {
          return;
        }

        setMessage(result.message);
        if (result.status === "signed_in") {
          window.location.replace(result.redirectPath || "/account");
          return;
        }

        setStatus("error");
      } catch (error) {
        if (cancelled) {
          return;
        }

        setMessage(error instanceof Error ? error.message : "Sign-in could not complete. Please try again.");
        setStatus("error");
      }
    };

    completeSignIn();

    return () => {
      cancelled = true;
    };
  }, [auth]);

  return (
    <main className="grid min-h-screen place-items-center bg-[radial-gradient(circle_at_20%_0%,rgba(15,83,55,0.34),transparent_34rem),#030504] px-5 py-10 text-yuzu-cream">
      <section className="luxury-card w-full max-w-xl p-7">
        <div className="grid size-12 place-items-center border border-yuzu-gold/55 bg-yuzu-gold/10 text-yuzu-gold">
          {status === "loading" ? <LoaderCircle className="size-5 animate-spin" /> : <TriangleAlert className="size-5" />}
        </div>
        <p className="mt-5 fine-label">Cognito Sign-In</p>
        <h1 className="mt-3 font-heading text-4xl text-yuzu-cream">
          {status === "loading" ? "Securing your session." : "Sign-in needs another try."}
        </h1>
        <p className="mt-4 text-sm leading-6 text-yuzu-muted">{message}</p>
        {status === "error" ? (
          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <Button className="h-11 bg-yuzu-gold text-yuzu-ink hover:bg-yuzu-gold-light" render={<Link href="/account" />}>
              Try Again
            </Button>
            <Button className="h-11 border-yuzu-line text-yuzu-cream" variant="outline" render={<Link href="/account" />}>
              Back To Account
            </Button>
          </div>
        ) : null}
      </section>
    </main>
  );
}
