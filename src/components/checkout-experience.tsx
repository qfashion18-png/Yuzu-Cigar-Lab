"use client";

import Link from "@/components/static-link";
import { CreditCard, Lock, MapPin, PackageCheck, ShieldCheck, Truck } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { ComponentProps, FormEvent, ReactNode } from "react";
import { useMemo, useState } from "react";

import { useBackupAuth } from "@/components/backup-auth-provider";
import {
  checkoutPaymentMethods,
  defaultDeliveryMethods,
  useCart,
} from "@/components/cart-provider";
import { MemberViewBanner } from "@/components/member-view-banner";
import { ReferenceImage } from "@/components/reference-image";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { readCheckoutAgeVerificationToken } from "@/lib/age-verification";
import type { BackupAuthSession } from "@/lib/backup-auth";
import {
  calculateCartTotals,
  formatCurrency,
  isMemberOnlyCart,
} from "@/lib/shopping-cart";
import { createCheckoutSession, getCheckoutErrorMessage } from "@/lib/stripe-checkout";

const taxRate = 0.066;

type CheckoutFormState = {
  email: string;
  phone: string;
  fullName: string;
  address1: string;
  address2: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
};

const initialFormState: CheckoutFormState = {
  email: "",
  phone: "",
  fullName: "",
  address1: "",
  address2: "",
  city: "",
  state: "Arizona",
  postalCode: "",
  country: "US",
};

export function CheckoutExperience() {
  const auth = useBackupAuth();

  return <CheckoutExperienceContent key={auth.session?.userId ?? "guest"} accountSession={auth.session} />;
}

function CheckoutExperienceContent({ accountSession }: { accountSession: BackupAuthSession | null }) {
  const auth = useBackupAuth();
  const { cart, itemCount } = useCart();
  const [form, setForm] = useState(() => createCheckoutFormStateFromAccount(accountSession));
  const [deliveryMethodId, setDeliveryMethodId] = useState(defaultDeliveryMethods[0].id);
  const [paymentMethodId, setPaymentMethodId] = useState(checkoutPaymentMethods[0].id);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const selectedDelivery = defaultDeliveryMethods.find((method) => method.id === deliveryMethodId) ?? defaultDeliveryMethods[0];
  const selectedPayment = checkoutPaymentMethods.find((method) => method.id === paymentMethodId) ?? checkoutPaymentMethods[0];
  const isMemberOnlyLocked = isMemberOnlyCart(cart) && !auth.isMember;
  const totals = useMemo(
    () =>
      calculateCartTotals(cart, {
        deliveryPrice: selectedDelivery.price,
        taxRate,
      }),
    [cart, selectedDelivery.price]
  );

  function updateFormValue(field: keyof CheckoutFormState, value: string) {
    setForm((currentForm) => ({
      ...currentForm,
      [field]: value,
    }));
  }

  async function handleContinueToCheckout(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (cart.items.length === 0) {
      setError("Add at least one item before checkout.");
      return;
    }

    if (isMemberOnlyLocked) {
      setError("Membership is required before checking out with member-only items.");
      return;
    }

    if (!form.email || !form.fullName || !form.address1 || !form.city || !form.state || !form.postalCode) {
      setError("Complete the required shipping fields before placing the order.");
      return;
    }

    if (!termsAccepted) {
      setError("Confirm the compliance checks before placing the order.");
      return;
    }

    const ageVerificationToken = readCheckoutAgeVerificationToken(window.sessionStorage);
    if (!ageVerificationToken) {
      setError("Complete verified 21+ identity review before checkout.");
      return;
    }

    setIsSubmitting(true);
    setError("");

    try {
      const session = await createCheckoutSession({
        cart,
        customer: {
          email: form.email,
          phone: form.phone,
          fullName: form.fullName,
        },
        isMember: auth.isMember,
        shippingAddress: {
          address1: form.address1,
          address2: form.address2,
          city: form.city,
          state: form.state,
          postalCode: form.postalCode,
          country: form.country,
        },
        shippingMethodId: deliveryMethodId,
        complianceToken: ageVerificationToken,
      });

      window.location.assign(session.url);
    } catch (checkoutError) {
      setError(getCheckoutErrorMessage(checkoutError));
      setIsSubmitting(false);
    }
  }

  if (cart.items.length === 0) {
    return (
      <div className="mx-auto grid min-h-[62vh] max-w-[920px] place-items-center px-5 py-16 text-center">
        <div className="luxury-card grid gap-6 p-8">
          <PackageCheck className="mx-auto size-12 text-yuzu-gold" />
          <div>
            <h1 className="font-heading text-4xl text-yuzu-cream">Checkout starts with a cart</h1>
            <p className="mt-3 text-sm leading-6 text-yuzu-muted">
              Choose catalog items first, then return here to complete shipping, payment, and review.
            </p>
          </div>
          <Button className="h-12 bg-yuzu-gold px-8 text-yuzu-ink hover:bg-yuzu-gold-light" render={<Link href="/shop" />}>
            Shop Catalog
          </Button>
        </div>
      </div>
    );
  }

  if (isMemberOnlyLocked) {
    return (
      <div className="mx-auto grid min-h-[62vh] max-w-[920px] place-items-center px-5 py-16 text-center">
        <div className="luxury-card grid gap-6 p-8">
          <ShieldCheck className="mx-auto size-12 text-yuzu-gold" />
          <div>
            <h1 className="font-heading text-4xl text-yuzu-cream">Membership required</h1>
            <p className="mt-3 text-sm leading-6 text-yuzu-muted">
              Your cart has member-only products. Sign in as a member or join now to complete checkout.
            </p>
          </div>
          <Button className="h-12 bg-yuzu-gold px-8 text-yuzu-ink hover:bg-yuzu-gold-light" render={<Link href="/membership" />}>
            Open membership
          </Button>
        </div>
      </div>
    );
  }

  return (
    <form className="mx-auto grid max-w-[1520px] gap-8 px-5 py-8 lg:grid-cols-[1fr_420px] lg:px-10" onSubmit={handleContinueToCheckout}>
      <section className="grid gap-5">
        <div>
          <p className="fine-label">Secure Checkout</p>
          <h1 className="mt-2 font-heading text-5xl text-yuzu-cream">Ship, Pay, Review</h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-yuzu-muted">
            Guest checkout is available. Yuzu verifies identity and shipping eligibility before Stripe-hosted payment and fulfillment.
          </p>
        </div>

        <MemberViewBanner context="checkout" />

        <CheckoutPanel icon={MapPin} title="1. Shipping Information">
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Email" value={form.email} onChange={(value) => updateFormValue("email", value)} autoComplete="email" type="email" required />
            <Field label="Phone" value={form.phone} onChange={(value) => updateFormValue("phone", value)} autoComplete="tel" />
          </div>
          <Field label="Full name" value={form.fullName} onChange={(value) => updateFormValue("fullName", value)} autoComplete="name" required />
          <div className="grid gap-4 md:grid-cols-[1fr_0.58fr]">
            <Field label="Address" value={form.address1} onChange={(value) => updateFormValue("address1", value)} autoComplete="shipping address-line1" required />
            <Field label="Apt, suite, etc." value={form.address2} onChange={(value) => updateFormValue("address2", value)} autoComplete="shipping address-line2" />
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            <Field label="City" value={form.city} onChange={(value) => updateFormValue("city", value)} autoComplete="shipping address-level2" required />
            <Field label="State" value={form.state} onChange={(value) => updateFormValue("state", value)} autoComplete="shipping address-level1" required />
            <Field label="ZIP code" value={form.postalCode} onChange={(value) => updateFormValue("postalCode", value)} autoComplete="shipping postal-code" required />
          </div>
        </CheckoutPanel>

        <CheckoutPanel icon={Truck} title="2. Delivery Method">
          <div className="grid gap-3 md:grid-cols-2">
            {defaultDeliveryMethods.map((method) => (
              <button
                key={method.id}
                type="button"
                className={`min-h-24 border p-4 text-left transition ${
                  deliveryMethodId === method.id
                    ? "border-yuzu-gold bg-yuzu-gold/10 text-yuzu-cream"
                    : "border-yuzu-line bg-yuzu-night/45 text-yuzu-muted hover:border-yuzu-gold hover:text-yuzu-cream"
                }`}
                onClick={() => setDeliveryMethodId(method.id)}
                aria-pressed={deliveryMethodId === method.id}
              >
                <span className="block font-heading text-2xl text-yuzu-gold">{method.title}</span>
                <span className="mt-2 block text-sm">{method.estimate}</span>
                <span className="mt-3 block text-sm font-bold">{formatCurrency(method.price)}</span>
              </button>
            ))}
          </div>
        </CheckoutPanel>

        <CheckoutPanel icon={CreditCard} title="3. Payment">
          <div className="grid gap-3 md:grid-cols-2">
            {checkoutPaymentMethods.map((method) => (
              <button
                key={method.id}
                type="button"
                className={`min-h-24 border p-4 text-left transition ${
                  paymentMethodId === method.id
                    ? "border-yuzu-gold bg-yuzu-gold/10 text-yuzu-cream"
                    : "border-yuzu-line bg-yuzu-night/45 text-yuzu-muted hover:border-yuzu-gold hover:text-yuzu-cream"
                }`}
                onClick={() => setPaymentMethodId(method.id)}
                aria-pressed={paymentMethodId === method.id}
              >
                <span className="block font-heading text-2xl text-yuzu-gold">{method.title}</span>
                <span className="mt-2 block text-sm leading-6">{method.note}</span>
              </button>
            ))}
          </div>
          {paymentMethodId === "stripe-checkout" && (
            <div className="flex items-start gap-3 border border-yuzu-line bg-yuzu-night p-4 text-sm leading-6 text-yuzu-muted">
              <ShieldCheck className="mt-0.5 size-5 shrink-0 text-yuzu-gold" />
              <p>Card details, wallets, receipts, and payment confirmation happen inside Stripe Checkout. Yuzu never stores card numbers in the static storefront.</p>
            </div>
          )}
        </CheckoutPanel>

        <CheckoutPanel icon={ShieldCheck} title="4. Review">
          <div className="grid gap-3">
            {cart.items.map((item) => (
              <div key={item.lineId} className="flex items-center justify-between gap-4 border-b border-yuzu-line/60 pb-3 text-sm last:border-b-0 last:pb-0">
                <span className="text-yuzu-muted">
                  {item.quantity} x {item.name}
                </span>
                <span className="font-heading text-lg text-yuzu-cream">{formatCurrency(item.unitPrice * item.quantity)}</span>
              </div>
            ))}
          </div>
          <label className="flex items-start gap-3 border border-yuzu-line bg-yuzu-night p-4 text-sm leading-6 text-yuzu-muted">
            <input
              type="checkbox"
              checked={termsAccepted}
              onChange={(event) => setTermsAccepted(event.currentTarget.checked)}
              className="mt-1 size-4 accent-yuzu-gold"
            />
            <span>
              I confirm the recipient is 21 or older and accept Yuzu&apos;s age verification, adult signature, shipping restriction, and payment review checks.
            </span>
          </label>
          {error && (
            <p className="border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive" aria-live="polite">
              {error}
            </p>
          )}
          <Button type="submit" disabled={isSubmitting} className="h-14 bg-yuzu-gold text-yuzu-ink hover:bg-yuzu-gold-light">
            <Lock data-icon="inline-start" />
            {isSubmitting ? "Opening secure checkout" : `Continue to secure checkout / ${formatCurrency(totals.total)}`}
          </Button>
        </CheckoutPanel>
      </section>

      <aside className="luxury-card h-fit p-5 lg:sticky lg:top-28">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold uppercase tracking-[0.22em] text-yuzu-gold">Order Summary</h2>
          <span className="text-sm text-yuzu-muted">{itemCount} items</span>
        </div>
        <div className="mt-5 grid gap-4">
          {cart.items.map((item) => (
            <div key={item.lineId} className="grid grid-cols-[72px_1fr_auto] gap-3">
              <ReferenceImage src={item.image} alt={`${item.name} checkout item`} className="aspect-square border border-yuzu-line" objectPosition={item.imagePosition} />
              <div>
                <h3 className="line-clamp-2 text-sm font-semibold text-yuzu-cream">{item.name}</h3>
                <p className="mt-1 text-xs text-yuzu-muted">{item.packageLabel}</p>
                <p className="mt-1 text-xs text-yuzu-gold">Qty {item.quantity}</p>
              </div>
              <p className="text-sm text-yuzu-cream">{formatCurrency(item.unitPrice * item.quantity)}</p>
            </div>
          ))}
        </div>
        <div className="mt-5 grid gap-2 border-t border-yuzu-line pt-4 text-sm text-yuzu-muted">
          <SummaryRow label="Subtotal" value={formatCurrency(totals.subtotal)} />
          {totals.discount > 0 && <SummaryRow label={`Promotion ${cart.promotionCode}`} value={`-${formatCurrency(totals.discount)}`} tone="gold" />}
          <SummaryRow label={selectedDelivery.title} value={formatCurrency(totals.shipping)} />
          <SummaryRow label="Estimated tax" value={formatCurrency(totals.tax)} />
          <SummaryRow label="Payment" value={selectedPayment.title} />
          <div className="mt-2 flex justify-between border-t border-yuzu-line pt-4 font-heading text-3xl text-yuzu-gold">
            <span>Total</span>
            <span>{formatCurrency(totals.total)}</span>
          </div>
        </div>
      </aside>
    </form>
  );
}

function CheckoutPanel({
  icon: Icon,
  title,
  children,
}: {
  icon: LucideIcon;
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="luxury-card grid gap-4 p-5 md:p-6">
      <div className="flex items-center gap-3">
        <Icon className="size-5 text-yuzu-gold" />
        <h2 className="text-sm font-bold uppercase tracking-[0.16em] text-yuzu-gold">{title}</h2>
      </div>
      {children}
    </section>
  );
}

function Field({
  label,
  value,
  onChange,
  required = false,
  ...props
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
} & Omit<ComponentProps<typeof Input>, "onChange" | "value" | "required">) {
  return (
    <label className="grid gap-2 text-sm text-yuzu-muted">
      <span className="font-bold uppercase tracking-[0.16em]">
        {label}
        {required ? " *" : ""}
      </span>
      <Input
        value={value}
        onChange={(event) => onChange(event.currentTarget.value)}
        required={required}
        className="h-11 rounded-sm border-yuzu-line bg-yuzu-night text-yuzu-cream"
        {...props}
      />
    </label>
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

function createCheckoutFormStateFromAccount(session: BackupAuthSession | null): CheckoutFormState {
  if (!session) {
    return initialFormState;
  }

  return {
    email: session.email,
    phone: session.phone,
    fullName: session.name,
    address1: session.shippingAddress.address1,
    address2: session.shippingAddress.address2,
    city: session.shippingAddress.city,
    state: session.shippingAddress.state || initialFormState.state,
    postalCode: session.shippingAddress.postalCode,
    country: session.shippingAddress.country || initialFormState.country,
  };
}
