"use client";

import Link from "@/components/static-link";
import { CheckCircle2, Clock3, PackageCheck } from "lucide-react";
import { useEffect, useState } from "react";

import { useCart } from "@/components/cart-provider";
import { Button } from "@/components/ui/button";
import { getCheckoutErrorMessage, getCheckoutSessionStatus, type CheckoutSessionStatus } from "@/lib/stripe-checkout";

export default function CheckoutSuccessPage() {
  const { clearCart } = useCart();
  const [status, setStatus] = useState<CheckoutSessionStatus | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const sessionId = params.get("session_id");

    if (!sessionId) {
      queueMicrotask(() => setError("Checkout session is missing."));
      return;
    }

    let cancelled = false;

    getCheckoutSessionStatus(sessionId)
      .then((sessionStatus) => {
        if (cancelled) {
          return;
        }

        setStatus(sessionStatus);

        if (sessionStatus.orderRecorded) {
          clearCart();
        }
      })
      .catch((checkoutError) => {
        if (!cancelled) {
          setError(getCheckoutErrorMessage(checkoutError));
        }
      });

    return () => {
      cancelled = true;
    };
  }, [clearCart]);

  const orderRecorded = Boolean(status?.orderRecorded);

  return (
    <main className="mx-auto grid min-h-[62vh] max-w-[980px] place-items-center px-5 py-16 text-center">
      <section className="luxury-card grid gap-6 p-8">
        {orderRecorded ? <CheckCircle2 className="mx-auto size-14 text-yuzu-gold" /> : <Clock3 className="mx-auto size-14 text-yuzu-gold" />}
        <div>
          <p className="fine-label">{orderRecorded ? "Order Recorded" : "Checkout Received"}</p>
          <h1 className="mt-2 font-heading text-5xl text-yuzu-cream">
            {orderRecorded ? "Your order is in review." : "We are confirming fulfillment."}
          </h1>
          <p className="mt-3 text-sm leading-6 text-yuzu-muted">
            {status?.message ??
              "Stripe payment status, age verification, tax, and adult-signature shipping are checked by the Yuzu backend before fulfillment."}
          </p>
        </div>
        {status && (
          <div className="grid gap-3 border-t border-yuzu-line pt-5 text-sm text-yuzu-muted sm:grid-cols-3">
            <StatusTile label="Payment" value={status.paymentStatus} />
            <StatusTile label="Fulfillment" value={status.fulfillmentStatus} />
            <StatusTile label="Order" value={status.orderId ?? "Pending"} />
          </div>
        )}
        {error && (
          <p className="border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive" aria-live="polite">
            {error}
          </p>
        )}
        {!status && !error && (
          <p className="inline-flex items-center justify-center gap-2 text-sm text-yuzu-muted">
            <PackageCheck className="size-4 text-yuzu-gold" />
            Checking backend order status
          </p>
        )}
        <div className="flex flex-col justify-center gap-3 sm:flex-row">
          <Button className="h-12 bg-yuzu-gold px-8 text-yuzu-ink hover:bg-yuzu-gold-light" render={<Link href="/account" />}>
            View Account
          </Button>
          <Button className="h-12 border-yuzu-gold px-8 text-yuzu-gold hover:bg-yuzu-gold hover:text-yuzu-ink" variant="outline" render={<Link href="/shop" />}>
            Continue Shopping
          </Button>
        </div>
      </section>
    </main>
  );
}

function StatusTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-yuzu-line bg-yuzu-night p-4">
      <p className="text-xs font-bold uppercase tracking-[0.16em] text-yuzu-muted">{label}</p>
      <p className="mt-2 font-heading text-xl text-yuzu-cream">{value.replaceAll("_", " ")}</p>
    </div>
  );
}
