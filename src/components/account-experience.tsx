"use client";

import Link from "@/components/static-link";
import {
  AlertTriangle,
  Bot,
  CalendarClock,
  CheckCircle2,
  CreditCard,
  Crown,
  Headphones,
  Home,
  LoaderCircle,
  LogOut,
  Mail,
  MessageCircle,
  PackageCheck,
  PencilLine,
  Phone,
  RefreshCw,
  Save,
  Send,
  ShieldCheck,
  Truck,
  UserRound,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { FormEvent, useCallback, useEffect, useState } from "react";

import { BackupAuthPanel } from "@/components/backup-auth-panel";
import { useBackupAuth } from "@/components/backup-auth-provider";
import { ProductCard, type ProductCardItem } from "@/components/product-card";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { emptyAccountShippingAddress, type AccountShippingAddress, type BackupAuthSession } from "@/lib/backup-auth";
import { shouldShowInlineCognitoSignIn } from "@/lib/cognito-auth";
import {
  fetchAccountOrders,
  fetchAccountSummary,
  getLiveApiErrorMessage,
  sendConciergeChat,
  type AccountOrder,
  type AccountSummary,
  type ConciergeAgentMode,
  type ConciergeChatResponse,
} from "@/lib/live-api";
import { formatCurrency } from "@/lib/shopping-cart";

type AccountExperienceProps = {
  featuredProducts: ProductCardItem[];
};

export function AccountExperience({ featuredProducts }: AccountExperienceProps) {
  const auth = useBackupAuth();
  const { isCognitoConfigured, isReady, isSignedIn } = auth;
  const showInlineCognitoSignIn = shouldShowInlineCognitoSignIn({ isReady, isSignedIn, isCognitoConfigured });
  const [summary, setSummary] = useState<AccountSummary | null>(null);
  const [orders, setOrders] = useState<AccountOrder[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const loadAccount = useCallback(async () => {
    if (!auth.isReady || !auth.isSignedIn || auth.authSource !== "cognito") {
      setSummary(null);
      setOrders([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError("");

    try {
      const headers = await auth.createApiHeaders();
      const [nextSummary, nextOrders] = await Promise.all([
        fetchAccountSummary(headers),
        fetchAccountOrders(headers),
      ]);

      setSummary(nextSummary);
      setOrders(nextOrders.orders);
    } catch (accountError) {
      setError(getLiveApiErrorMessage(accountError));
    } finally {
      setIsLoading(false);
    }
  }, [auth]);

  useEffect(() => {
    let cancelled = false;

    window.queueMicrotask(() => {
      if (cancelled) {
        return;
      }

      void loadAccount();
    });

    return () => {
      cancelled = true;
    };
  }, [loadAccount]);

  if (!isReady) {
    return (
      <main className="grid min-h-[62vh] place-items-center px-5 py-16 text-yuzu-cream">
        <div className="text-sm uppercase tracking-[0.22em] text-yuzu-gold">Loading account access</div>
      </main>
    );
  }

  if (!isSignedIn) {
    return (
      <main className="mx-auto grid max-w-[1120px] gap-6 px-5 py-12 lg:px-10">
        <Card className="luxury-card">
          <CardContent className="grid gap-5 p-6 md:grid-cols-[1fr_auto] md:items-center">
            <div>
              <p className="fine-label">Member Account</p>
              <h1 className="mt-3 font-heading text-4xl text-yuzu-cream">Sign in to load your complete member account.</h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-yuzu-muted">
                {showInlineCognitoSignIn
                  ? "Use the form below to sign in without leaving this account screen. Profile, membership, order, billing, shipping, compliance, humidor, and concierge details load after authentication."
                  : "Profile, membership, order history, billing, shipping, compliance, digital humidor, and concierge details load after authentication."}
              </p>
            </div>
            <Link
              href="/membership"
              className="inline-flex h-11 shrink-0 items-center justify-center rounded-lg border border-transparent bg-yuzu-gold px-7 text-sm font-medium text-yuzu-ink transition-all hover:bg-yuzu-gold-light"
            >
              Explore Membership
            </Link>
          </CardContent>
        </Card>
        <BackupAuthPanel />
        <AccountDetailPreviewGrid />
      </main>
    );
  }

  if (auth.authSource !== "cognito") {
    return (
      <main className="mx-auto grid max-w-[1120px] gap-6 px-5 py-12 lg:px-10">
        <Card className="luxury-card">
          <CardContent className="grid gap-5 p-6 md:grid-cols-[1fr_auto] md:items-center">
            <div>
              <p className="fine-label">Live API Session Required</p>
              <h1 className="mt-3 font-heading text-4xl text-yuzu-cream">Use Cognito for live account data.</h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-yuzu-muted">
                Local backup access cannot load live account, order, membership, or humidor records. Sign in with Cognito so API requests carry a verified token.
              </p>
            </div>
            <Button className="h-11 border-yuzu-line text-yuzu-cream" variant="outline" onClick={auth.signOut}>
              <LogOut data-icon="inline-start" />
              Sign Out
            </Button>
          </CardContent>
        </Card>
        <BackupAuthPanel requireCognito />
      </main>
    );
  }

  return (
    <main className="mx-auto grid max-w-[1520px] gap-7 px-5 py-8 lg:grid-cols-[minmax(0,1fr)_360px] lg:px-10">
      <section className="grid gap-5">
        <div className="flex flex-col justify-between gap-4 border border-yuzu-line bg-yuzu-panel p-6 md:flex-row md:items-end">
          <div>
            <p className="fine-label">Member Account</p>
            <h1 className="mt-3 font-heading text-5xl text-yuzu-cream">
              {auth.session?.name ?? summary?.account.name ?? "Yuzu Member"}
            </h1>
            <p className="mt-3 text-sm leading-6 text-yuzu-muted">
              Live account source: {summary?.source ?? "Yuzu API"} / persistence: {summary?.database.persistence ?? "loading"}
            </p>
          </div>
          <Button className="h-11 border-yuzu-gold text-yuzu-gold hover:bg-yuzu-gold hover:text-yuzu-ink" variant="outline" onClick={loadAccount} disabled={isLoading}>
            <RefreshCw data-icon="inline-start" />
            {isLoading ? "Refreshing" : "Refresh"}
          </Button>
        </div>

        {error ? (
          <div className="flex items-start gap-3 border border-destructive/50 bg-destructive/10 p-4 text-sm leading-6 text-destructive">
            <AlertTriangle className="mt-0.5 size-5 shrink-0" />
            <span>{error}</span>
          </div>
        ) : null}

        <AccountOverviewPanel summary={summary} orders={orders} session={auth.session} isLoading={isLoading} />

        <AccountProfileCard />

        <ConciergeChatPanel />

        <div className="grid gap-4 md:grid-cols-3">
          <StatusCard
            icon={ShieldCheck}
            label="Membership"
            value={formatMembershipTier(summary?.membership.tier ?? auth.session?.membership.tier)}
            note={formatStatusLabel(summary?.membership.status ?? auth.session?.membership.status ?? "Live status pending")}
          />
          <StatusCard
            icon={UserRound}
            label="Role"
            value={formatStatusLabel(summary?.membership.role ?? auth.session?.role ?? "Member")}
            note={formatList(summary?.membership.groups) || "Cognito groups"}
          />
          <StatusCard
            icon={PackageCheck}
            label="Orders"
            value={orders.length.toString()}
            note={orders.length ? `${formatCurrency(getLoadedOrderTotal(orders))} in loaded order history` : "Loaded from the commerce API"}
          />
        </div>

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)]">
          <AccountReadinessPanel summary={summary} orders={orders} session={auth.session} />
          <MembershipBenefitsPanel summary={summary} />
        </div>

        <Card className="luxury-card">
          <CardHeader>
            <CardTitle className="text-sm uppercase tracking-[0.2em] text-yuzu-gold">Recent Orders</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3">
            {orders.length ? (
              orders.map((order) => (
                <div key={order.id} className="grid gap-3 border border-yuzu-line bg-yuzu-night/45 p-4 sm:grid-cols-[1fr_auto] sm:items-center">
                  <div>
                    <h2 className="font-heading text-2xl text-yuzu-cream">{order.orderNumber ?? order.id}</h2>
                    <p className="mt-1 text-sm text-yuzu-muted">
                      {formatStatusLabel(order.status)} / {formatStatusLabel(order.fulfillmentStatus ?? "fulfillment pending")} / {order.itemCount ?? 0} items
                    </p>
                    <p className="mt-2 text-xs uppercase tracking-[0.16em] text-yuzu-muted">
                      {formatDate(order.placedAt)} / {shortId(order.id)}
                    </p>
                  </div>
                  <p className="font-heading text-2xl text-yuzu-gold">
                    {typeof order.total === "number" ? formatCurrency(order.total, (order.currency ?? "USD").toUpperCase()) : "Pending"}
                  </p>
                </div>
              ))
            ) : (
              <p className="border border-yuzu-line bg-yuzu-night/45 p-4 text-sm leading-6 text-yuzu-muted">
                No live orders returned yet.
              </p>
            )}
          </CardContent>
        </Card>
      </section>

      <aside className="grid h-fit gap-4">
        <Card className="luxury-card">
          <CardHeader>
            <CardTitle className="text-sm uppercase tracking-[0.2em] text-yuzu-gold">Recommended Boxes</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4">
            {featuredProducts.slice(0, 2).map((product) => (
              <ProductCard key={product.id} product={product} compact />
            ))}
          </CardContent>
        </Card>
        <AccountActionsPanel />
      </aside>
    </main>
  );
}

function AccountDetailPreviewGrid() {
  const previewDetails: AccountDetailTileProps[] = [
    {
      icon: Crown,
      label: "Membership",
      value: "Tier and status",
      note: "Active plan, member role, and Cognito group access.",
    },
    {
      icon: PackageCheck,
      label: "Orders",
      value: "History and totals",
      note: "Recent order status, fulfillment state, item count, and totals.",
    },
    {
      icon: Truck,
      label: "Delivery",
      value: "Shipping readiness",
      note: "Checkout address, adult signature, and compliance checkpoints.",
    },
    {
      icon: CreditCard,
      label: "Billing",
      value: "Secure payments",
      note: "Stripe-hosted payment and membership billing handoff.",
    },
    {
      icon: Home,
      label: "Humidor",
      value: "Collection access",
      note: "Member humidor tracking, recommendations, and reorder cues.",
    },
    {
      icon: Headphones,
      label: "Support",
      value: "Concierge help",
      note: "Support, allocation, and account follow-up context.",
    },
  ];

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {previewDetails.map((detail) => (
        <AccountDetailTile key={detail.label} {...detail} />
      ))}
    </div>
  );
}

function AccountOverviewPanel({
  summary,
  orders,
  session,
  isLoading,
}: {
  summary: AccountSummary | null;
  orders: AccountOrder[];
  session: BackupAuthSession | null;
  isLoading: boolean;
}) {
  const latestOrder = orders[0];
  const overviewDetails: AccountDetailTileProps[] = [
    {
      icon: Mail,
      label: "Email",
      value: summary?.account.email ?? session?.email ?? "Loading",
      note: formatList(summary?.account.groups) || "Verified member identity",
    },
    {
      icon: Phone,
      label: "Phone",
      value: session?.phone || "Add phone",
      note: "Used for concierge and delivery follow-up.",
    },
    {
      icon: CalendarClock,
      label: "Last Sign-In",
      value: formatDate(session?.signedInAt),
      note: "Current browser session.",
    },
    {
      icon: PackageCheck,
      label: "Latest Order",
      value: latestOrder ? (latestOrder.orderNumber ?? shortId(latestOrder.id)) : isLoading ? "Loading" : "No orders yet",
      note: latestOrder ? `${formatDate(latestOrder.placedAt)} / ${formatStatusLabel(latestOrder.fulfillmentStatus ?? latestOrder.status)}` : "Order history appears here after checkout.",
    },
  ];

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {overviewDetails.map((detail) => (
        <AccountDetailTile key={detail.label} {...detail} />
      ))}
    </div>
  );
}

function AccountReadinessPanel({
  summary,
  orders,
  session,
}: {
  summary: AccountSummary | null;
  orders: AccountOrder[];
  session: BackupAuthSession | null;
}) {
  const readinessItems = [
    {
      label: "Contact Profile",
      value: session?.phone ? "Name, email, and phone available" : "Add a phone number for delivery follow-up",
    },
    {
      label: "Member Record",
      value: summary?.database.memberId ? `Stored member ${shortId(summary.database.memberId)}` : formatStatusLabel(summary?.database.persistence ?? "Waiting on live API"),
    },
    {
      label: "Order History",
      value: orders.length ? `${orders.length} recent order${orders.length === 1 ? "" : "s"} loaded` : "No live orders returned yet",
    },
    {
      label: "Shipping and Compliance",
      value: "Address, 21+ review, and adult signature are completed during checkout",
    },
    {
      label: "Billing",
      value: "Cards, wallets, receipts, and membership billing remain in secure Stripe flows",
    },
  ];

  return (
    <Card className="luxury-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-3 text-sm uppercase tracking-[0.2em] text-yuzu-gold">
          <CheckCircle2 />
          Account Readiness
        </CardTitle>
      </CardHeader>
      <CardContent className="grid gap-3">
        {readinessItems.map((item) => (
          <div key={item.label} className="grid gap-1 border border-yuzu-line/65 bg-yuzu-night/50 p-4">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-yuzu-gold">{item.label}</p>
            <p className="text-sm leading-6 text-yuzu-muted">{item.value}</p>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function MembershipBenefitsPanel({ summary }: { summary: AccountSummary | null }) {
  const tier = formatMembershipTier(summary?.membership.tier);
  const benefits = [
    "Member-cost boxes and private allocation access",
    "Digital humidor tracking, aging notes, and reorder cues",
    "Concierge support with account and order context",
    "Checkout-aware shipping caps and compliance review",
  ];

  return (
    <Card className="luxury-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-3 text-sm uppercase tracking-[0.2em] text-yuzu-gold">
          <Crown />
          Membership Details
        </CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4">
        <div className="border border-yuzu-line/65 bg-yuzu-night/50 p-4">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-yuzu-muted">Current Tier</p>
          <p className="mt-2 font-heading text-3xl text-yuzu-cream">{tier}</p>
          <p className="mt-2 text-sm leading-6 text-yuzu-muted">
            Status: {formatStatusLabel(summary?.membership.status ?? "Live status pending")}
          </p>
        </div>
        <div className="grid gap-3">
          {benefits.map((benefit) => (
            <div key={benefit} className="flex items-start gap-3 text-sm leading-6 text-yuzu-muted">
              <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-yuzu-gold" />
              <span>{benefit}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function AccountActionsPanel() {
  return (
    <Card className="luxury-card">
      <CardHeader>
        <CardTitle className="text-sm uppercase tracking-[0.2em] text-yuzu-gold">Account Actions</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-3">
        <Link
          href="/humidor"
          className="inline-flex h-11 items-center justify-start gap-1.5 rounded-lg border border-yuzu-line bg-background px-3 text-sm font-medium text-yuzu-cream transition-all hover:bg-muted hover:text-foreground"
        >
          <Home className="size-4 shrink-0" />
          Open Digital Humidor
        </Link>
        <Link
          href="/membership"
          className="inline-flex h-11 items-center justify-start gap-1.5 rounded-lg border border-yuzu-line bg-background px-3 text-sm font-medium text-yuzu-cream transition-all hover:bg-muted hover:text-foreground"
        >
          <Crown className="size-4 shrink-0" />
          Manage Membership
        </Link>
        <Link
          href="/shop"
          className="inline-flex h-11 items-center justify-start gap-1.5 rounded-lg border border-transparent bg-yuzu-gold px-3 text-sm font-medium text-yuzu-ink transition-all hover:bg-yuzu-gold-light"
        >
          <PackageCheck className="size-4 shrink-0" />
          Shop Member Boxes
        </Link>
      </CardContent>
    </Card>
  );
}

const conciergeAgentModes: Array<{ id: ConciergeAgentMode; label: string; icon: LucideIcon }> = [
  { id: "concierge", label: "Concierge", icon: MessageCircle },
  { id: "cigar_guide", label: "Cigar Guide", icon: Bot },
  { id: "support", label: "Support", icon: Headphones },
  { id: "humidor", label: "Humidor", icon: Home },
];

function ConciergeChatPanel() {
  const auth = useBackupAuth();
  const [mode, setMode] = useState<ConciergeAgentMode>("concierge");
  const [message, setMessage] = useState("");
  const [chatResponse, setChatResponse] = useState<ConciergeChatResponse | null>(null);
  const [conversationId, setConversationId] = useState("");
  const [statusMessage, setStatusMessage] = useState("");
  const [isSending, setIsSending] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const nextMessage = message.trim();
    if (!nextMessage) {
      setStatusMessage("Enter a message for the Yuzu concierge.");
      return;
    }

    if (auth.authSource !== "cognito") {
      setStatusMessage("Sign in with Cognito before using the live concierge.");
      return;
    }

    setIsSending(true);
    setStatusMessage("");

    try {
      const headers = await auth.createApiHeaders();
      const response = await sendConciergeChat(
        {
          message: nextMessage,
          agent: mode,
          conversationId: conversationId || undefined,
        },
        headers
      );

      setChatResponse(response);
      setConversationId(response.conversation.id);
      setMessage("");
      setStatusMessage(response.conversation.persisted ? "Conversation saved." : formatPersistenceStatus(response.conversation.persistence));
    } catch (error) {
      setStatusMessage(getLiveApiErrorMessage(error));
    } finally {
      setIsSending(false);
    }
  }

  return (
    <Card className="luxury-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-3 text-sm uppercase tracking-[0.2em] text-yuzu-gold">
          <MessageCircle />
          Yuzu Concierge
        </CardTitle>
      </CardHeader>
      <CardContent className="grid gap-5">
        <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
          {conciergeAgentModes.map((item) => {
            const Icon = item.icon;
            const isActive = mode === item.id;

            return (
              <Button
                key={item.id}
                className={isActive ? "h-11 bg-yuzu-gold text-yuzu-ink hover:bg-yuzu-gold-light" : "h-11 border-yuzu-line text-yuzu-cream"}
                type="button"
                variant={isActive ? "default" : "outline"}
                onClick={() => setMode(item.id)}
              >
                <Icon data-icon="inline-start" />
                {item.label}
              </Button>
            );
          })}
        </div>

        <form className="grid gap-3" onSubmit={handleSubmit}>
          <Textarea
            aria-label="Concierge message"
            className="min-h-28 rounded-sm border-yuzu-line bg-yuzu-night text-sm text-yuzu-cream"
            placeholder="Ask about membership, orders, cigars, or your humidor"
            value={message}
            onChange={(event) => {
              setMessage(event.currentTarget.value);
              setStatusMessage("");
            }}
          />
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <Button className="h-11 bg-yuzu-gold text-yuzu-ink hover:bg-yuzu-gold-light" disabled={isSending || !message.trim()} type="submit">
              {isSending ? <LoaderCircle className="animate-spin" data-icon="inline-start" /> : <Send data-icon="inline-start" />}
              {isSending ? "Sending" : "Send"}
            </Button>
            <p className="min-h-5 text-sm text-yuzu-gold" aria-live="polite">
              {statusMessage}
            </p>
          </div>
        </form>

        {chatResponse ? (
          <div className="grid gap-3 border border-yuzu-line/65 bg-yuzu-night/50 p-4">
            <div className="flex flex-col gap-2 text-xs uppercase tracking-[0.14em] text-yuzu-muted sm:flex-row sm:items-center sm:justify-between">
              <span>{formatStatusLabel(chatResponse.agent)}</span>
              <span>{formatStatusLabel(chatResponse.ai.status)}</span>
            </div>
            <p className="text-sm leading-6 text-yuzu-cream">{chatResponse.reply}</p>
            {chatResponse.guardrails.humanHandoff ? (
              <p className="text-sm leading-6 text-yuzu-muted">A concierge operator can review this thread for follow-up.</p>
            ) : null}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function AccountProfileCard() {
  const auth = useBackupAuth();
  const session = auth.session;

  if (!session) {
    return null;
  }

  return <AccountProfileForm key={session.userId} session={session} />;
}

function AccountProfileForm({ session }: { session: BackupAuthSession }) {
  const auth = useBackupAuth();
  const [name, setName] = useState(session.name);
  const [phone, setPhone] = useState(session.phone);
  const [shippingAddress, setShippingAddress] = useState<AccountShippingAddress>({
    ...emptyAccountShippingAddress,
    ...session.shippingAddress,
  });
  const [statusMessage, setStatusMessage] = useState("");

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const result = auth.updateAccountProfile({ name, phone, shippingAddress });

    setStatusMessage(result.message);
  }

  function updateShippingAddressValue(field: keyof AccountShippingAddress, value: string) {
    setShippingAddress((currentAddress) => ({
      ...currentAddress,
      [field]: value,
    }));
  }

  return (
    <Card className="luxury-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-3 text-sm uppercase tracking-[0.2em] text-yuzu-gold">
          <PencilLine />
          Account Details
        </CardTitle>
      </CardHeader>
      <CardContent className="grid gap-5 lg:grid-cols-[1fr_220px]">
        <form className="grid gap-4 md:grid-cols-2" onSubmit={handleSubmit}>
          <label className="grid gap-2 text-xs font-bold uppercase tracking-[0.14em] text-yuzu-muted">
            Display Name
            <Input
              value={name}
              onChange={(event) => setName(event.currentTarget.value)}
              required
              className="h-11 rounded-sm border-yuzu-line bg-yuzu-night text-sm normal-case tracking-normal text-yuzu-cream"
            />
          </label>
          <label className="grid gap-2 text-xs font-bold uppercase tracking-[0.14em] text-yuzu-muted">
            Email
            <Input
              value={session.email}
              disabled
              className="h-11 rounded-sm border-yuzu-line bg-yuzu-night text-sm normal-case tracking-normal text-yuzu-muted"
            />
          </label>
          <label className="grid gap-2 text-xs font-bold uppercase tracking-[0.14em] text-yuzu-muted">
            Phone
            <Input
              value={phone}
              onChange={(event) => setPhone(event.currentTarget.value)}
              placeholder="Optional"
              className="h-11 rounded-sm border-yuzu-line bg-yuzu-night text-sm normal-case tracking-normal text-yuzu-cream"
            />
          </label>
          <div className="grid gap-3 border-t border-yuzu-line/65 pt-4 md:col-span-2">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-yuzu-gold">Shipping Address</p>
            <label className="grid gap-2 text-xs font-bold uppercase tracking-[0.14em] text-yuzu-muted">
              Address
              <Input
                value={shippingAddress.address1}
                onChange={(event) => updateShippingAddressValue("address1", event.currentTarget.value)}
                className="h-11 rounded-sm border-yuzu-line bg-yuzu-night text-sm normal-case tracking-normal text-yuzu-cream"
                autoComplete="shipping address-line1"
              />
            </label>
            <label className="grid gap-2 text-xs font-bold uppercase tracking-[0.14em] text-yuzu-muted">
              Apt, suite, etc.
              <Input
                value={shippingAddress.address2}
                onChange={(event) => updateShippingAddressValue("address2", event.currentTarget.value)}
                className="h-11 rounded-sm border-yuzu-line bg-yuzu-night text-sm normal-case tracking-normal text-yuzu-cream"
                autoComplete="shipping address-line2"
              />
            </label>
            <div className="grid gap-4 md:grid-cols-[1fr_0.7fr_0.7fr_0.55fr]">
              <label className="grid gap-2 text-xs font-bold uppercase tracking-[0.14em] text-yuzu-muted">
                City
                <Input
                  value={shippingAddress.city}
                  onChange={(event) => updateShippingAddressValue("city", event.currentTarget.value)}
                  className="h-11 rounded-sm border-yuzu-line bg-yuzu-night text-sm normal-case tracking-normal text-yuzu-cream"
                  autoComplete="shipping address-level2"
                />
              </label>
              <label className="grid gap-2 text-xs font-bold uppercase tracking-[0.14em] text-yuzu-muted">
                State
                <Input
                  value={shippingAddress.state}
                  onChange={(event) => updateShippingAddressValue("state", event.currentTarget.value)}
                  className="h-11 rounded-sm border-yuzu-line bg-yuzu-night text-sm normal-case tracking-normal text-yuzu-cream"
                  autoComplete="shipping address-level1"
                />
              </label>
              <label className="grid gap-2 text-xs font-bold uppercase tracking-[0.14em] text-yuzu-muted">
                ZIP code
                <Input
                  value={shippingAddress.postalCode}
                  onChange={(event) => updateShippingAddressValue("postalCode", event.currentTarget.value)}
                  className="h-11 rounded-sm border-yuzu-line bg-yuzu-night text-sm normal-case tracking-normal text-yuzu-cream"
                  autoComplete="shipping postal-code"
                />
              </label>
              <label className="grid gap-2 text-xs font-bold uppercase tracking-[0.14em] text-yuzu-muted">
                Country
                <Input
                  value={shippingAddress.country}
                  onChange={(event) => updateShippingAddressValue("country", event.currentTarget.value)}
                  className="h-11 rounded-sm border-yuzu-line bg-yuzu-night text-sm normal-case tracking-normal text-yuzu-cream"
                  autoComplete="shipping country"
                />
              </label>
            </div>
          </div>
          <div className="grid content-end gap-2 md:col-span-2">
            <Button type="submit" className="h-11 bg-yuzu-gold text-yuzu-ink hover:bg-yuzu-gold-light">
              <Save data-icon="inline-start" />
              Save Account
            </Button>
            <p className="min-h-5 text-sm text-yuzu-gold" aria-live="polite">
              {statusMessage}
            </p>
          </div>
        </form>

        <div className="grid gap-3 border border-yuzu-line/65 bg-yuzu-night/50 p-4">
          <ProfileTile label="Access" value={auth.authSource === "cognito" ? "Cognito" : "Backup"} />
          <ProfileTile label="View" value={auth.isMember ? "Member" : "Non-member"} />
          <Button className="h-11 border-yuzu-line text-yuzu-cream" variant="outline" onClick={auth.signOut}>
            <LogOut data-icon="inline-start" />
            Sign Out
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function ProfileTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-yuzu-line/65 bg-yuzu-night/60 p-4">
      <p className="text-xs uppercase tracking-[0.16em] text-yuzu-muted">{label}</p>
      <p className="mt-2 font-heading text-xl text-yuzu-cream">{value}</p>
    </div>
  );
}

function StatusCard({
  icon: Icon,
  label,
  value,
  note,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  note: string;
}) {
  return (
    <Card className="luxury-card">
      <CardContent className="flex min-h-36 flex-col justify-between gap-4 p-5">
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-yuzu-gold">{label}</p>
          <Icon className="text-yuzu-gold" />
        </div>
        <p className="font-heading text-3xl text-yuzu-cream">{value}</p>
        <p className="text-sm text-yuzu-muted">{note}</p>
      </CardContent>
    </Card>
  );
}

type AccountDetailTileProps = {
  icon: LucideIcon;
  label: string;
  value: string;
  note: string;
};

function AccountDetailTile({ icon: Icon, label, value, note }: AccountDetailTileProps) {
  return (
    <div className="grid min-h-40 gap-4 border border-yuzu-line bg-yuzu-panel p-5">
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-yuzu-gold">{label}</p>
        <Icon className="size-5 shrink-0 text-yuzu-gold" />
      </div>
      <div>
        <p className="break-words font-heading text-2xl text-yuzu-cream">{value}</p>
        <p className="mt-2 text-sm leading-6 text-yuzu-muted">{note}</p>
      </div>
    </div>
  );
}

function getLoadedOrderTotal(orders: AccountOrder[]) {
  return orders.reduce((total, order) => total + (typeof order.total === "number" ? order.total : 0), 0);
}

function formatMembershipTier(value?: string | null) {
  if (!value) {
    return "No Paid Tier";
  }

  return formatStatusLabel(value);
}

function formatStatusLabel(value?: string | null) {
  if (!value) {
    return "Pending";
  }

  return value
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatPersistenceStatus(value?: string | null) {
  return value ? `Persistence: ${formatStatusLabel(value)}` : "Conversation accepted.";
}

function formatList(value?: string[] | null) {
  return value?.filter(Boolean).map(formatStatusLabel).join(", ") ?? "";
}

function formatDate(value?: string | null) {
  if (!value) {
    return "Pending";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Pending";
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

function shortId(value?: string | null) {
  if (!value) {
    return "Pending";
  }

  return value.length > 12 ? `...${value.slice(-8)}` : value;
}
