"use client";

import Link from "@/components/static-link";
import { Lock, Minus, Plus, ShoppingBag, Trash2, Truck } from "lucide-react";
import type { FormEvent } from "react";
import { useMemo, useState } from "react";

import { ReferenceImage } from "@/components/reference-image";
import { useCart } from "@/components/cart-provider";
import { MemberViewBanner } from "@/components/member-view-banner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { defaultDeliveryMethods, formatCurrency, type ShoppingCartItem } from "@/lib/shopping-cart";

export function CartPageClient() {
  const {
    cart,
    itemCount,
    totals,
    statusMessage,
    updateQuantity,
    removeItem,
    applyPromotion,
    clearPromotion,
  } = useCart();
  const [promoCode, setPromoCode] = useState("");
  const estimatedDelivery = defaultDeliveryMethods[0];
  const estimatedTotal = useMemo(
    () => totals.subtotal - totals.discount,
    [totals.discount, totals.subtotal]
  );

  function handleApplyPromotion(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const accepted = applyPromotion(promoCode);

    if (accepted) {
      setPromoCode("");
    }
  }

  if (cart.items.length === 0) {
    return (
      <div className="mx-auto grid min-h-[62vh] max-w-[920px] place-items-center px-5 py-16 text-center">
        <div className="luxury-card grid gap-6 p-8">
          <ShoppingBag className="mx-auto size-12 text-yuzu-gold" />
          <div>
            <h1 className="font-heading text-4xl text-yuzu-cream">Your cart is empty</h1>
            <p className="mt-3 text-sm leading-6 text-yuzu-muted">
              Add a catalog item, membership box, or limited drop to begin checkout.
            </p>
          </div>
          <Button className="h-12 bg-yuzu-gold px-8 text-yuzu-ink hover:bg-yuzu-gold-light" render={<Link href="/shop" />}>
            Continue Shopping
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto grid max-w-[1520px] gap-8 px-5 py-8 lg:grid-cols-[1fr_390px] lg:px-10">
      <section className="grid gap-5">
        <div className="flex flex-col justify-between gap-4 border-b border-yuzu-line pb-5 md:flex-row md:items-end">
          <div>
            <p className="fine-label">Shopping Cart</p>
            <h1 className="mt-2 font-heading text-5xl text-yuzu-cream">Review Your Order</h1>
          </div>
          <p className="text-sm text-yuzu-muted" aria-live="polite">
            {itemCount} {itemCount === 1 ? "item" : "items"} ready for checkout
          </p>
        </div>

        <MemberViewBanner context="checkout" />

        <div className="grid gap-4">
          {cart.items.map((item) => (
            <article key={item.lineId} className="luxury-card grid gap-4 p-4 md:grid-cols-[112px_1fr_auto]">
              <Link href={getCartItemHref(item)} className="block">
                <ReferenceImage
                  src={item.image}
                  alt={`${item.name} cart item`}
                  objectPosition={item.imagePosition}
                  className="aspect-square border border-yuzu-line"
                />
              </Link>
              <div className="grid gap-3">
                <div>
                  <Link href={getCartItemHref(item)} className="font-heading text-2xl leading-tight text-yuzu-cream transition hover:text-yuzu-gold">
                    {item.name}
                  </Link>
                  <p className="mt-1 text-sm text-yuzu-muted">
                    {item.packageLabel} / SKU {item.sku} / {item.category}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <QuantityControl
                    name={item.name}
                    quantity={item.quantity}
                    onDecrease={() => updateQuantity(item.lineId, item.quantity - 1)}
                    onIncrease={() => updateQuantity(item.lineId, item.quantity + 1)}
                  />
                  <Button
                    type="button"
                    className="h-10 border-yuzu-line text-yuzu-muted hover:border-yuzu-gold hover:text-yuzu-gold"
                    variant="outline"
                    onClick={() => removeItem(item.lineId)}
                    aria-label={`Remove ${item.name}`}
                  >
                    <Trash2 data-icon="inline-start" />
                    Remove
                  </Button>
                </div>
              </div>
              <div className="text-left md:text-right">
                <p className="font-heading text-2xl text-yuzu-gold">{formatCurrency(item.unitPrice * item.quantity)}</p>
                <p className="mt-1 text-xs uppercase tracking-[0.16em] text-yuzu-muted">
                  {formatCurrency(item.unitPrice)} each
                </p>
              </div>
            </article>
          ))}
        </div>
      </section>

      <aside className="grid h-fit gap-5 lg:sticky lg:top-28">
        <div className="luxury-card p-5">
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-sm font-bold uppercase tracking-[0.22em] text-yuzu-gold">Order Summary</h2>
            <Lock className="size-5 text-yuzu-gold" />
          </div>
          <div className="mt-5 grid gap-3 text-sm text-yuzu-muted">
            <SummaryRow label={`Subtotal (${itemCount})`} value={formatCurrency(totals.subtotal)} />
            {totals.discount > 0 && (
              <SummaryRow
                label={`Promotion ${cart.promotionCode}`}
                value={`-${formatCurrency(totals.discount)}`}
                tone="gold"
              />
            )}
            <SummaryRow label="Shipping" value="Selected at checkout" />
            <SummaryRow label="Estimated tax" value="Calculated at checkout" />
            <div className="mt-3 flex items-end justify-between border-t border-yuzu-line pt-4 font-heading text-3xl text-yuzu-gold">
              <span>Total</span>
              <span>{formatCurrency(estimatedTotal)}</span>
            </div>
          </div>

          <form className="mt-5 grid gap-3" onSubmit={handleApplyPromotion}>
            <label className="text-xs font-bold uppercase tracking-[0.2em] text-yuzu-muted" htmlFor="promo-code">
              Promo code
            </label>
            <div className="grid gap-3 sm:grid-cols-[1fr_116px] lg:grid-cols-1 xl:grid-cols-[1fr_116px]">
              <Input
                id="promo-code"
                value={promoCode}
                onChange={(event) => setPromoCode(event.currentTarget.value)}
                placeholder="KISHA5"
                className="h-11 rounded-sm border-yuzu-line bg-yuzu-night text-yuzu-cream"
              />
              <Button type="submit" className="h-11 border-yuzu-gold text-yuzu-gold hover:bg-yuzu-gold hover:text-yuzu-ink" variant="outline">
                Apply
              </Button>
            </div>
            {cart.promotionCode && (
              <button
                type="button"
                className="w-fit text-xs font-bold uppercase tracking-[0.16em] text-yuzu-gold transition hover:text-yuzu-gold-light"
                onClick={clearPromotion}
              >
                Remove {cart.promotionCode}
              </button>
            )}
            <p className="min-h-5 text-xs text-yuzu-muted" aria-live="polite">
              {statusMessage}
            </p>
          </form>

          <div className="mt-5 flex items-start gap-3 border border-yuzu-line bg-yuzu-night p-4 text-sm leading-6 text-yuzu-muted">
            <Truck className="mt-0.5 size-5 shrink-0 text-yuzu-gold" />
            <p>
              {estimatedDelivery.title} is available in checkout. Adult signature and age verification remain required before fulfillment.
            </p>
          </div>

          <Button className="mt-5 h-14 w-full bg-yuzu-gold text-yuzu-ink hover:bg-yuzu-gold-light" render={<Link href="/checkout" />}>
            <Lock data-icon="inline-start" />
            Proceed to Checkout
          </Button>
        </div>

        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-yuzu-line bg-yuzu-night/95 p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] backdrop-blur lg:hidden">
          <div className="mx-auto flex max-w-[640px] items-center gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-xs uppercase tracking-[0.18em] text-yuzu-muted">Cart total</p>
              <p className="font-heading text-2xl text-yuzu-gold">{formatCurrency(estimatedTotal)}</p>
            </div>
            <Button className="h-12 bg-yuzu-gold px-6 text-yuzu-ink hover:bg-yuzu-gold-light" render={<Link href="/checkout" />}>
              Checkout
            </Button>
          </div>
        </div>
      </aside>
    </div>
  );
}

function QuantityControl({
  name,
  quantity,
  onDecrease,
  onIncrease,
}: {
  name: string;
  quantity: number;
  onDecrease: () => void;
  onIncrease: () => void;
}) {
  return (
    <div className="grid h-10 grid-cols-[40px_48px_40px] overflow-hidden border border-yuzu-line" aria-label={`${name} quantity`}>
      <button type="button" className="grid place-items-center text-yuzu-muted transition hover:bg-yuzu-gold hover:text-yuzu-ink" onClick={onDecrease} aria-label={`Decrease ${name} quantity`}>
        <Minus className="size-4" />
      </button>
      <span className="grid place-items-center border-x border-yuzu-line text-sm font-bold text-yuzu-cream">{quantity}</span>
      <button type="button" className="grid place-items-center text-yuzu-muted transition hover:bg-yuzu-gold hover:text-yuzu-ink" onClick={onIncrease} aria-label={`Increase ${name} quantity`}>
        <Plus className="size-4" />
      </button>
    </div>
  );
}

function SummaryRow({ label, value, tone = "muted" }: { label: string; value: string; tone?: "muted" | "gold" }) {
  return (
    <div className={tone === "gold" ? "flex justify-between text-yuzu-gold" : "flex justify-between"}>
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}

function getCartItemHref(item: ShoppingCartItem) {
  return item.category === "Membership" ? "/membership" : `/shop/${item.slug}`;
}
