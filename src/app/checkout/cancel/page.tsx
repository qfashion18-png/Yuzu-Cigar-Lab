import Link from "@/components/static-link";
import { ArrowLeft, ShoppingBag } from "lucide-react";

import { Button } from "@/components/ui/button";

export default function CheckoutCancelPage() {
  return (
    <main className="mx-auto grid min-h-[62vh] max-w-[860px] place-items-center px-5 py-16 text-center">
      <section className="luxury-card grid gap-6 p-8">
        <ShoppingBag className="mx-auto size-14 text-yuzu-gold" />
        <div>
          <p className="fine-label">Checkout Canceled</p>
          <h1 className="mt-2 font-heading text-5xl text-yuzu-cream">Your cart is still waiting.</h1>
          <p className="mt-3 text-sm leading-6 text-yuzu-muted">
            Payment was not completed. Return to checkout to review your shipping details and continue through Stripe when ready.
          </p>
        </div>
        <div className="flex flex-col justify-center gap-3 sm:flex-row">
          <Button className="h-12 bg-yuzu-gold px-8 text-yuzu-ink hover:bg-yuzu-gold-light" render={<Link href="/checkout" />}>
            <ArrowLeft data-icon="inline-start" />
            Return to Checkout
          </Button>
          <Button className="h-12 border-yuzu-gold px-8 text-yuzu-gold hover:bg-yuzu-gold hover:text-yuzu-ink" variant="outline" render={<Link href="/cart" />}>
            View Cart
          </Button>
        </div>
      </section>
    </main>
  );
}
