"use client";

import { useCallback, useEffect, useMemo, useState, type ComponentType } from "react";
import {
  AlertTriangle,
  Bot,
  CheckCircle2,
  Database,
  Loader2,
  RefreshCw,
  Send,
  ShieldCheck,
  SquareActivity,
  UploadCloud,
} from "lucide-react";

import { useBackupAuth } from "@/components/backup-auth-provider";
import { Button } from "@/components/ui/button";
import {
  fetchAdminComplianceHolds,
  fetchAdminWebhookEvents,
  getLiveApiErrorMessage,
  sendConciergeChat,
  syncAdminStripeProducts,
  type AdminAuditEntry,
  type AdminComplianceHold,
  type AdminComplianceHoldsResponse,
  type AdminPersistence,
  type AdminRecentOrder,
  type AdminRecentSubscription,
  type AdminStripeCatalogPreviewItem,
  type AdminStripeSyncProductsResponse,
  type AdminWebhookEvent,
  type AdminWebhookEventsResponse,
} from "@/lib/live-api";
import { cn } from "@/lib/utils";

type StatusTone = "ok" | "warn" | "neutral";

export function BackendAdminConsole() {
  const auth = useBackupAuth();
  const [compliance, setCompliance] = useState<AdminComplianceHoldsResponse | null>(null);
  const [webhooks, setWebhooks] = useState<AdminWebhookEventsResponse | null>(null);
  const [syncResult, setSyncResult] = useState<AdminStripeSyncProductsResponse | null>(null);
  const [adminPrompt, setAdminPrompt] = useState("Summarize backend health and any admin follow-ups.");
  const [adminReply, setAdminReply] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [isRefreshing, setIsRefreshing] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isAsking, setIsAsking] = useState(false);
  const createApiHeaders = auth.createApiHeaders;

  const refreshBackend = useCallback(async () => {
    setIsRefreshing(true);
    setError("");

    try {
      const headers = await createApiHeaders();
      const [nextCompliance, nextWebhooks] = await Promise.all([
        fetchAdminComplianceHolds(headers),
        fetchAdminWebhookEvents(headers),
      ]);

      setCompliance(nextCompliance);
      setWebhooks(nextWebhooks);
      setMessage("Backend admin endpoints responded.");
    } catch (refreshError) {
      setError(getLiveApiErrorMessage(refreshError));
    } finally {
      setIsRefreshing(false);
    }
  }, [createApiHeaders]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void refreshBackend();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [refreshBackend]);

  const holdCount = compliance?.holds.length ?? 0;
  const eventCount = webhooks?.events.length ?? 0;
  const overview = compliance?.overview;
  const holdSummary = compliance?.summary;
  const webhookSummary = webhooks?.summary;
  const persistenceLabel = useMemo(
    () => formatPersistence(compliance?.persistence ?? webhooks?.persistence),
    [compliance?.persistence, webhooks?.persistence]
  );
  const orderCount = overview?.counts.orders.total ?? 0;
  const paidOrders = overview?.counts.orders.paid ?? 0;
  const pendingOrders = overview?.counts.orders.pending ?? 0;
  const activeSubscriptions = overview?.counts.subscriptions.active ?? 0;
  const totalSubscriptions = overview?.counts.subscriptions.total ?? 0;
  const pastDueSubscriptions = overview?.counts.subscriptions.pastDue ?? 0;
  const openHolds = holdSummary?.open ?? holdCount;
  const totalHolds = holdSummary?.total ?? holdCount;
  const processedWebhooks = webhookSummary?.processed ?? overview?.counts.webhooks.processed ?? 0;
  const pendingWebhooks = webhookSummary?.pending ?? overview?.counts.webhooks.pending ?? eventCount;
  const totalWebhooks = webhookSummary?.total ?? overview?.counts.webhooks.total ?? eventCount;
  const recentOrders = compliance?.orders ?? [];
  const recentSubscriptions = compliance?.subscriptions ?? [];
  const recentAudit = compliance?.audit ?? [];
  const groups = auth.cognitoSession?.claims.groups ?? [];
  const syncStatus = syncResult?.sync;

  async function handleSyncProducts() {
    setIsSyncing(true);
    setError("");
    setMessage("");

    try {
      const headers = await createApiHeaders();
      const response = await syncAdminStripeProducts(headers);
      setSyncResult(response);
      setMessage("Stripe product sync queued for backend processing.");
    } catch (syncError) {
      setError(getLiveApiErrorMessage(syncError));
    } finally {
      setIsSyncing(false);
    }
  }

  async function handleAskAdminAgent() {
    const prompt = adminPrompt.trim();

    if (!prompt) {
      setError("Enter an admin agent prompt.");
      return;
    }

    setIsAsking(true);
    setError("");
    setMessage("");

    try {
      const headers = await createApiHeaders();
      const response = await sendConciergeChat({ agent: "admin", message: prompt }, headers);
      setAdminReply(response.reply);
      setMessage(`${response.agent} responded through the live backend.`);
    } catch (askError) {
      setError(getLiveApiErrorMessage(askError));
    } finally {
      setIsAsking(false);
    }
  }

  return (
    <main className="min-h-screen bg-yuzu-night text-yuzu-cream">
      <section className="border-b border-yuzu-line/70 bg-[radial-gradient(circle_at_14%_0%,rgba(15,83,55,0.24),transparent_28rem),#030504]">
        <div className="mx-auto grid max-w-[1480px] gap-6 px-5 py-8 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end lg:px-10">
          <div>
            <div className="flex items-center gap-3 text-xs font-black uppercase tracking-[0.22em] text-yuzu-gold">
              <ShieldCheck className="size-4" />
              <span>Authenticated Backend</span>
            </div>
            <h1 className="mt-4 font-heading text-4xl leading-none text-yuzu-cream sm:text-5xl">Yuzu admin console</h1>
            <p className="mt-4 max-w-3xl text-sm leading-6 text-yuzu-muted">
              Live operations are gated by Cognito groups and call the YCC API directly from the admin domain.
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <Button
              className="h-11 border-yuzu-line text-yuzu-cream"
              disabled={isRefreshing}
              onClick={refreshBackend}
              variant="outline"
            >
              {isRefreshing ? <Loader2 className="animate-spin" data-icon="inline-start" /> : <RefreshCw data-icon="inline-start" />}
              Refresh Backend
            </Button>
            <Button className="h-11 bg-yuzu-gold text-yuzu-ink hover:bg-yuzu-gold-light" disabled={isSyncing} onClick={handleSyncProducts}>
              {isSyncing ? <Loader2 className="animate-spin" data-icon="inline-start" /> : <UploadCloud data-icon="inline-start" />}
              Queue Stripe Sync
            </Button>
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-[1480px] gap-6 px-5 py-7 lg:px-10">
        {message || error ? (
          <div
            className={cn(
              "flex items-start gap-3 border p-4 text-sm leading-6",
              error ? "border-red-400/50 bg-red-950/24 text-red-100" : "border-yuzu-line bg-yuzu-panel/72 text-yuzu-muted"
            )}
          >
            {error ? <AlertTriangle className="mt-0.5 size-5 shrink-0 text-red-300" /> : <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-yuzu-gold" />}
            <span>{error || message}</span>
          </div>
        ) : null}

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <StatusTile
            icon={ShieldCheck}
            label="Cognito Admin"
            tone="ok"
            value={auth.currentUser?.email || "Signed in"}
            note={groups.length ? groups.join(", ") : "verified Cognito session"}
          />
          <StatusTile
            icon={Database}
            label="Persistence"
            tone={persistenceLabel.includes("pending") ? "warn" : "ok"}
            value={persistenceLabel}
            note={overview?.latest.auditAt ? `Latest audit ${formatTimestamp(overview.latest.auditAt)}` : "Awaiting live audit activity"}
          />
          <StatusTile
            icon={SquareActivity}
            label="Orders"
            tone={pendingOrders ? "warn" : "ok"}
            value={String(orderCount)}
            note={`${paidOrders} paid / ${pendingOrders} pending`}
          />
          <StatusTile
            icon={Bot}
            label="Memberships"
            tone={pastDueSubscriptions ? "warn" : "ok"}
            value={String(activeSubscriptions)}
            note={`${pastDueSubscriptions} past due / ${totalSubscriptions} total`}
          />
          <StatusTile
            icon={AlertTriangle}
            label="Queue Health"
            tone={openHolds || pendingWebhooks ? "warn" : totalWebhooks ? "neutral" : "ok"}
            value={`${openHolds} / ${pendingWebhooks}`}
            note="open holds / pending webhooks"
          />
        </div>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,0.68fr)_minmax(360px,0.32fr)]">
          <section className="border border-yuzu-line bg-yuzu-panel/72">
            <div className="border-b border-yuzu-line px-5 py-4">
              <h2 className="text-sm font-black uppercase tracking-[0.18em] text-yuzu-gold">Operations Queue</h2>
              <p className="mt-2 text-sm leading-6 text-yuzu-muted">
                {overview
                  ? `${overview.counts.audit.last24h} audit events in the last 24 hours. Latest order ${overview.latest.orderAt ? formatTimestamp(overview.latest.orderAt) : "not available"}.`
                  : "Live queue details appear here after the backend refresh completes."}
              </p>
            </div>
            <div className="grid gap-0 divide-y divide-yuzu-line/80">
              <QueueBlock
                countLabel={`${openHolds} open / ${totalHolds} total`}
                empty="No compliance holds returned by the backend."
                items={compliance?.holds ?? []}
                renderItem={(hold, index) => <ComplianceHoldRow hold={hold} index={index} />}
                title="Compliance Holds"
              />
              <QueueBlock
                countLabel={`${pendingWebhooks} pending / ${processedWebhooks} processed`}
                empty="No webhook events returned by the backend."
                items={webhooks?.events ?? []}
                renderItem={(event, index) => <WebhookEventRow event={event} index={index} />}
                title="Webhook Events"
              />
            </div>
          </section>

          <div className="grid gap-6">
            <section className="border border-yuzu-line bg-yuzu-panel/72">
              <div className="border-b border-yuzu-line px-5 py-4">
                <div className="flex items-center gap-3">
                  <Bot className="size-5 text-yuzu-gold" />
                  <h2 className="text-sm font-black uppercase tracking-[0.18em] text-yuzu-gold">Admin Agent</h2>
                </div>
              </div>
              <div className="grid gap-4 p-5">
                <label className="grid gap-2">
                  <span className="text-xs font-black uppercase tracking-[0.18em] text-yuzu-muted">Prompt</span>
                  <textarea
                    className="min-h-32 border border-yuzu-line bg-yuzu-night/72 p-3 text-sm leading-6 text-yuzu-cream outline-none transition placeholder:text-yuzu-muted/70 focus:border-yuzu-gold focus:ring-2 focus:ring-yuzu-gold/25"
                    onChange={(event) => setAdminPrompt(event.target.value)}
                    value={adminPrompt}
                  />
                </label>
                <Button className="h-11 bg-yuzu-gold text-yuzu-ink hover:bg-yuzu-gold-light" disabled={isAsking} onClick={handleAskAdminAgent}>
                  {isAsking ? <Loader2 className="animate-spin" data-icon="inline-start" /> : <Send data-icon="inline-start" />}
                  Ask Admin Agent
                </Button>
                <div className="min-h-32 whitespace-pre-wrap border border-yuzu-line bg-yuzu-night/64 p-4 text-sm leading-6 text-yuzu-muted">
                  {adminReply || "The admin agent response will appear here."}
                </div>
              </div>
            </section>

            <section className="border border-yuzu-line bg-yuzu-panel/72">
              <div className="border-b border-yuzu-line px-5 py-4">
                <h2 className="text-sm font-black uppercase tracking-[0.18em] text-yuzu-gold">Stripe Sync Details</h2>
              </div>
              <div className="grid gap-4 p-5">
                {syncStatus ? (
                  <StripeSyncPanel sync={syncStatus} />
                ) : (
                  <div className="border border-yuzu-line bg-yuzu-night/64 p-4 text-sm leading-6 text-yuzu-muted">
                    Use Queue Stripe Sync to inspect launch catalog readiness, membership price keys, and Stripe configuration notes.
                  </div>
                )}
              </div>
            </section>
          </div>
        </div>

        <div className="grid gap-6 xl:grid-cols-3">
          <section className="border border-yuzu-line bg-yuzu-panel/72">
            <div className="border-b border-yuzu-line px-5 py-4">
              <h2 className="text-sm font-black uppercase tracking-[0.18em] text-yuzu-gold">Recent Orders</h2>
            </div>
            <AdminList
              empty="No recent orders are available from the backend."
              items={recentOrders}
              renderItem={(order, index) => <OrderRow order={order} index={index} />}
            />
          </section>

          <section className="border border-yuzu-line bg-yuzu-panel/72">
            <div className="border-b border-yuzu-line px-5 py-4">
              <h2 className="text-sm font-black uppercase tracking-[0.18em] text-yuzu-gold">Membership Snapshot</h2>
            </div>
            <AdminList
              empty="No membership records are available from the backend."
              items={recentSubscriptions}
              renderItem={(subscription, index) => <SubscriptionRow index={index} subscription={subscription} />}
            />
          </section>

          <section className="border border-yuzu-line bg-yuzu-panel/72">
            <div className="border-b border-yuzu-line px-5 py-4">
              <h2 className="text-sm font-black uppercase tracking-[0.18em] text-yuzu-gold">Audit Trail</h2>
            </div>
            <AdminList
              empty="No audit log rows are available from the backend."
              items={recentAudit}
              renderItem={(entry, index) => <AuditRow entry={entry} index={index} />}
            />
          </section>
        </div>

        <section className="grid gap-3 border border-yuzu-line bg-yuzu-panel/72 p-5 text-sm leading-6 text-yuzu-muted">
          <h2 className="text-sm font-black uppercase tracking-[0.18em] text-yuzu-gold">Session</h2>
          <div className="grid gap-2 md:grid-cols-4">
            <SessionFact label="User" value={auth.currentUser?.email || "Cognito admin"} />
            <SessionFact label="Groups" value={groups.length ? groups.join(", ") : "admin session"} />
            <SessionFact label="Stripe Sync" value={syncResult ? formatStripeSync(syncResult) : "Idle"} />
            <SessionFact label="Recent Audit" value={overview?.latest.auditAt ? formatTimestamp(overview.latest.auditAt) : "No audit rows yet"} />
          </div>
        </section>
      </section>
    </main>
  );
}

function StatusTile({
  icon: Icon,
  label,
  tone,
  value,
  note,
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  tone: StatusTone;
  value: string;
  note?: string;
}) {
  return (
    <section className="border border-yuzu-line bg-yuzu-panel/72 p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-xs font-black uppercase tracking-[0.18em] text-yuzu-muted">{label}</div>
          <div className="mt-3 break-words text-2xl font-semibold text-yuzu-cream">{value}</div>
          {note ? <div className="mt-2 text-sm leading-6 text-yuzu-muted">{note}</div> : null}
        </div>
        <Icon
          className={cn(
            "size-5 shrink-0",
            tone === "ok" ? "text-yuzu-gold" : tone === "warn" ? "text-amber-300" : "text-yuzu-muted"
          )}
        />
      </div>
    </section>
  );
}

function QueueBlock<T>({
  countLabel,
  empty,
  items,
  renderItem,
  title,
}: {
  countLabel: string;
  empty: string;
  items: T[];
  renderItem: (item: T, index: number) => React.ReactNode;
  title: string;
}) {
  return (
    <section>
      <div className="flex items-center justify-between gap-4 border-b border-yuzu-line/70 px-5 py-4">
        <h3 className="text-xs font-black uppercase tracking-[0.16em] text-yuzu-muted">{title}</h3>
        <span className="text-xs uppercase tracking-[0.16em] text-yuzu-muted">{countLabel}</span>
      </div>
      <AdminList empty={empty} items={items} renderItem={renderItem} />
    </section>
  );
}

function AdminList<T>({
  empty,
  items,
  renderItem,
}: {
  empty: string;
  items: T[];
  renderItem: (item: T, index: number) => React.ReactNode;
}) {
  return (
    <section>
      {items.length ? (
        <div className="divide-y divide-yuzu-line/70">{items.slice(0, 8).map(renderItem)}</div>
      ) : (
        <div className="p-5 text-sm leading-6 text-yuzu-muted">{empty}</div>
      )}
    </section>
  );
}

function ComplianceHoldRow({ hold, index }: { hold: AdminComplianceHold; index: number }) {
  return (
    <div className="grid gap-2 p-5 text-sm">
      <div>
        <div className="font-semibold text-yuzu-cream">{readString(hold, ["orderNumber", "caseId", "id"], `Hold ${index + 1}`)}</div>
        <div className="mt-1 text-yuzu-muted">{readString(hold, ["reason", "message", "description"], "Compliance review pending.")}</div>
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs uppercase tracking-[0.12em] text-yuzu-muted">
        <span>{readString(hold, ["status"], "open")}</span>
        <span>{readString(hold, ["email"], "unknown customer")}</span>
        <span>{hold.total ? formatCurrency(hold.total, hold.currency) : "total unavailable"}</span>
      </div>
      <div className="text-sm text-yuzu-muted">
        {readString(hold, ["orderStatus"], "order status unavailable")} / {readString(hold, ["fulfillmentStatus"], "fulfillment pending")} / {" "}
        {readString(hold, ["complianceStatus"], "compliance pending")}
      </div>
      <div className="text-xs uppercase tracking-[0.12em] text-yuzu-muted">created {formatTimestamp(readString(hold, ["createdAt"], ""))}</div>
    </div>
  );
}

function WebhookEventRow({ event, index }: { event: AdminWebhookEvent; index: number }) {
  return (
    <div className="grid gap-2 p-5 text-sm">
      <div>
        <div className="font-semibold text-yuzu-cream">{readString(event, ["type", "id"], `Webhook event ${index + 1}`)}</div>
        <div className="mt-1 text-yuzu-muted">{readString(event, ["requestId", "lastAction", "status"], "Backend event recorded.")}</div>
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs uppercase tracking-[0.12em] text-yuzu-muted">
        <span>{readString(event, ["processingStatus", "status"], "received")}</span>
        <span>{readString(event, ["orderNumber"], "no linked order")}</span>
        <span>{readString(event, ["actorEmail"], "system")}</span>
      </div>
      <div className="text-sm text-yuzu-muted">
        {readString(event, ["orderStatus"], "order status unavailable")} / {readString(event, ["fulfillmentStatus"], "fulfillment unavailable")} / {" "}
        {readString(event, ["complianceStatus"], "compliance unavailable")}
      </div>
      <div className="text-xs uppercase tracking-[0.12em] text-yuzu-muted">
        received {formatTimestamp(readString(event, ["createdAt"], ""))}
        {event.processedAt ? ` · processed ${formatTimestamp(event.processedAt)}` : ""}
      </div>
    </div>
  );
}

function OrderRow({ order, index }: { order: AdminRecentOrder; index: number }) {
  return (
    <div className="grid gap-2 p-5 text-sm">
      <div className="font-semibold text-yuzu-cream">{order.orderNumber || `Order ${index + 1}`}</div>
      <div className="text-yuzu-muted">{order.email || "customer email unavailable"}</div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs uppercase tracking-[0.12em] text-yuzu-muted">
        <span>{humanizeStatus(order.status || "pending")}</span>
        <span>{humanizeStatus(order.fulfillmentStatus || "not_started")}</span>
        <span>{humanizeStatus(order.complianceStatus || "pending")}</span>
      </div>
      <div className="text-sm text-yuzu-muted">
        {formatCurrency(order.total, order.currency)} · placed {formatTimestamp(order.placedAt || "")}
      </div>
    </div>
  );
}

function SubscriptionRow({ index, subscription }: { index: number; subscription: AdminRecentSubscription }) {
  return (
    <div className="grid gap-2 p-5 text-sm">
      <div className="font-semibold text-yuzu-cream">{subscription.email || `Membership ${index + 1}`}</div>
      <div className="text-yuzu-muted">
        {humanizeStatus(subscription.tierKey || "membership")} · {humanizeStatus(subscription.billingPeriod || "plan")}
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs uppercase tracking-[0.12em] text-yuzu-muted">
        <span>{humanizeStatus(subscription.status || "unknown")}</span>
        <span>{subscription.currentPeriodEnd ? `renews ${formatTimestamp(subscription.currentPeriodEnd)}` : "renewal unavailable"}</span>
      </div>
    </div>
  );
}

function AuditRow({ entry, index }: { entry: AdminAuditEntry; index: number }) {
  return (
    <div className="grid gap-2 p-5 text-sm">
      <div className="font-semibold text-yuzu-cream">{humanizeStatus(entry.action || `audit_${index + 1}`)}</div>
      <div className="text-yuzu-muted">
        {entry.actorEmail || "system"} · {humanizeStatus(entry.targetType || "target")}
        {entry.targetId ? ` ${entry.targetId}` : ""}
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs uppercase tracking-[0.12em] text-yuzu-muted">
        <span>{entry.requestId || "no request id"}</span>
        <span>{entry.orderId || entry.complianceHoldId || entry.stripeEventId || "no linked record"}</span>
      </div>
      <div className="text-xs uppercase tracking-[0.12em] text-yuzu-muted">{formatTimestamp(entry.createdAt)}</div>
    </div>
  );
}

function SessionFact({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-yuzu-line/80 bg-yuzu-night/50 p-3">
      <div className="text-xs font-black uppercase tracking-[0.16em] text-yuzu-muted">{label}</div>
      <div className="mt-2 break-words text-yuzu-cream">{value}</div>
    </div>
  );
}

function StripeSyncPanel({ sync }: { sync: AdminStripeSyncProductsResponse["sync"] }) {
  return (
    <div className="grid gap-4">
      <div className="grid gap-2 md:grid-cols-2">
        <SessionFact label="Status" value={humanizeStatus(sync.status)} />
        <SessionFact label="Scope" value={humanizeStatus(sync.seedScope)} />
        <SessionFact label="Catalog" value={`${sync.configuredProductCount} configured / ${sync.publishedProductCount} published`} />
        <SessionFact label="Membership Keys" value={String(sync.membershipPriceKeys.length)} />
      </div>

      <div className="border border-yuzu-line bg-yuzu-night/64 p-4 text-sm leading-6 text-yuzu-muted">
        {sync.notes.length ? sync.notes.join(" ") : "Stripe launch catalog, webhook secret, and membership price keys are configured for review."}
      </div>

      <div className="grid gap-2 text-xs uppercase tracking-[0.14em] text-yuzu-muted">
        <span>catalog source: {sync.catalogSource}</span>
        <span>tax status: {humanizeStatus(sync.taxStatus)}</span>
        <span>api version: {sync.apiVersion || "not configured"}</span>
      </div>

      {sync.catalogPreview.length ? (
        <div className="border border-yuzu-line/80 bg-yuzu-night/50">
          {sync.catalogPreview.map((product) => (
            <StripeCatalogRow key={product.sku} product={product} />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function StripeCatalogRow({ product }: { product: AdminStripeCatalogPreviewItem }) {
  return (
    <div className="grid gap-2 border-b border-yuzu-line/70 p-4 last:border-b-0">
      <div className="flex items-center justify-between gap-4">
        <div className="font-semibold text-yuzu-cream">{product.name}</div>
        <div className="text-xs uppercase tracking-[0.12em] text-yuzu-muted">{product.sku}</div>
      </div>
      <div className="text-sm text-yuzu-muted">
        {formatCurrency(product.price, "usd")} · {humanizeStatus(product.publishStatus)}
      </div>
      <div className="text-xs uppercase tracking-[0.12em] text-yuzu-muted">{product.stripePriceId}</div>
    </div>
  );
}

function formatPersistence(persistence: AdminPersistence | undefined) {
  if (!persistence) {
    return "Unknown";
  }

  if (typeof persistence === "string") {
    return humanizeStatus(persistence);
  }

  return humanizeStatus(persistence.status || persistence.table || "configured");
}

function formatStripeSync(result: AdminStripeSyncProductsResponse) {
  return `${humanizeStatus(result.sync.status)}: ${humanizeStatus(result.sync.seedScope)}`;
}

function formatCurrency(amount: number | undefined, currency = "usd") {
  if (typeof amount !== "number" || !Number.isFinite(amount)) {
    return "amount unavailable";
  }

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency.toUpperCase(),
  }).format(amount);
}

function formatTimestamp(value: string) {
  if (!value) {
    return "timestamp unavailable";
  }

  const timestamp = new Date(value);
  if (Number.isNaN(timestamp.getTime())) {
    return value;
  }

  return timestamp.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function humanizeStatus(value: string) {
  return value.replace(/_/g, " ");
}

function readString(record: Record<string, unknown>, keys: string[], fallback: string) {
  for (const key of keys) {
    const value = record[key];

    if (typeof value === "string" && value.trim()) {
      return value;
    }

    if (typeof value === "number") {
      return String(value);
    }
  }

  return fallback;
}

