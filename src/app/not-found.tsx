import { Compass } from "lucide-react";

import Link from "@/components/static-link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="grid min-h-screen place-items-center bg-[radial-gradient(circle_at_20%_0%,rgba(15,83,55,0.34),transparent_34rem),#030504] px-5 py-10 text-yuzu-cream">
      <section className="luxury-card w-full max-w-xl p-7">
        <div className="grid size-12 place-items-center border border-yuzu-gold/55 bg-yuzu-gold/10 text-yuzu-gold">
          <Compass className="size-5" />
        </div>
        <p className="mt-5 fine-label">404</p>
        <h1 className="mt-3 font-heading text-4xl text-yuzu-cream">That page is not in this humidor.</h1>
        <p className="mt-4 text-sm leading-6 text-yuzu-muted">
          The route may have moved, or the link is no longer valid. Use home navigation to continue.
        </p>
        <div className="mt-6">
          <Button className="h-11 bg-yuzu-gold text-yuzu-ink hover:bg-yuzu-gold-light" render={<Link href="/" />}>
            Return Home
          </Button>
        </div>
      </section>
    </main>
  );
}
