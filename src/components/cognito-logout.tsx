"use client";

import Link from "@/components/static-link";
import { CheckCircle2 } from "lucide-react";
import { useEffect } from "react";

import { useBackupAuth } from "@/components/backup-auth-provider";
import { Button } from "@/components/ui/button";

export function CognitoLogout() {
  const auth = useBackupAuth();

  useEffect(() => {
    auth.clearCognitoSession();
  }, [auth]);

  return (
    <main className="grid min-h-screen place-items-center bg-[radial-gradient(circle_at_20%_0%,rgba(15,83,55,0.34),transparent_34rem),#030504] px-5 py-10 text-yuzu-cream">
      <section className="luxury-card w-full max-w-xl p-7">
        <div className="grid size-12 place-items-center border border-yuzu-gold/55 bg-yuzu-gold/10 text-yuzu-gold">
          <CheckCircle2 className="size-5" />
        </div>
        <p className="mt-5 fine-label">Signed Out</p>
        <h1 className="mt-3 font-heading text-4xl text-yuzu-cream">Your Cognito session is closed.</h1>
        <p className="mt-4 text-sm leading-6 text-yuzu-muted">
          Admin and member API access will require a fresh Cognito sign-in.
        </p>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <Button className="h-11 bg-yuzu-gold text-yuzu-ink hover:bg-yuzu-gold-light" render={<Link href="/account" />}>
            Sign In Again
          </Button>
          <Button className="h-11 border-yuzu-line text-yuzu-cream" variant="outline" render={<Link href="/" />}>
            Back Home
          </Button>
        </div>
      </section>
    </main>
  );
}
