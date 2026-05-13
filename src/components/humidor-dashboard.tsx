"use client";

import Link from "@/components/static-link";
import NextImage from "next/image";
import { useEffect, useMemo, useState, type ChangeEvent, type FormEvent, type ReactNode } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  Bell,
  Bot,
  Box,
  Camera,
  CheckCircle2,
  Clock,
  Crown,
  DollarSign,
  FileSpreadsheet,
  Image as ImageIcon,
  LoaderCircle,
  LockKeyhole,
  LogOut,
  Package,
  Plus,
  RefreshCw,
  Settings,
  ShieldCheck,
  Star,
  Upload,
  X,
} from "lucide-react";

import { BackupAuthPanel } from "@/components/backup-auth-panel";
import { useBackupAuth } from "@/components/backup-auth-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import {
  canUseHumidorBulkImport,
  humidorBulkImportTemplate,
  parseHumidorBulkImport,
} from "@/lib/humidor-bulk-import";
import {
  applyHumidorEntryPriceSnapshot,
  humidorEntryPriceSnapshotSource,
  resolveHumidorEntryPriceSnapshot,
  type HumidorEntryPriceSnapshot,
} from "@/lib/humidor-entry-price";
import { withAgingSnapshot, type AgingSnapshot, type CigarReadiness } from "@/lib/humidor-aging";
import { demoHumidorItems } from "@/lib/humidor-demo";
import {
  createHumidorItem,
  fetchHumidorDashboardBootstrap,
  getLiveApiErrorMessage,
  identifyCigarFromImage,
  type HumidorAlertPreferences,
  type HumidorPushSubscription,
  updateHumidorAlertPreferences,
  type CigarImageIdentifyResponse,
  type CigarImageSuggestion,
  type HumidorCigarImage,
  type HumidorItem,
  type HumidorItemInput,
} from "@/lib/live-api";
import { cn } from "@/lib/utils";

type SectionId = "overview" | "cigars" | "aging" | "alerts" | "settings";
type IconComponent = typeof Box;

type HumidorForm = {
  name: string;
  brand: string;
  line: string;
  vitola: string;
  wrapper: string;
  origin: string;
  strength: string;
  quantity: string;
  purchaseDate: string;
  agingStartDate: string;
  reorderReminder: string;
  humidorLocation: string;
  tray: string;
  rating: string;
  estimatedValue: string;
  estimatedValueCurrency: string;
  estimatedValueSource: string;
  tastingNotes: string;
};

type LiveHumidorState = {
  loading: boolean;
  items: HumidorItem[];
  persistence: string;
  error: string;
};

type AgingItem = {
  item: HumidorItem;
  snapshot: AgingSnapshot;
};

const navItems: Array<{ id: SectionId; label: string; icon: IconComponent }> = [
  { id: "overview", label: "Overview", icon: Box },
  { id: "cigars", label: "My Cigars", icon: Package },
  { id: "aging", label: "Aging", icon: Clock },
  { id: "alerts", label: "Alerts", icon: Bell },
  { id: "settings", label: "Settings", icon: Settings },
];

const blankHumidorForm: HumidorForm = {
  name: "",
  brand: "",
  line: "",
  vitola: "",
  wrapper: "",
  origin: "",
  strength: "",
  quantity: "1",
  purchaseDate: "",
  agingStartDate: "",
  reorderReminder: "",
  humidorLocation: "",
  tray: "",
  rating: "",
  estimatedValue: "",
  estimatedValueCurrency: "USD",
  estimatedValueSource: humidorEntryPriceSnapshotSource,
  tastingNotes: "",
};

const defaultHumidorAlerts: HumidorAlertPreferences = {
  pushEnabled: false,
  reorderRemindersEnabled: true,
  climateAlertsEnabled: false,
  pushSubscription: null,
};

const initialLiveState: LiveHumidorState = {
  loading: false,
  items: [],
  persistence: "",
  error: "",
};

const fullMembershipHumidorToolsCopy =
  "Kisha, Sensei, and Daimyo memberships include AI cigar adder and bulk import. Box Access Pass keeps single-item humidor adds.";
const aiCigarAdderGateStatus = "AI cigar adder is available for Kisha, Sensei, and Daimyo members.";

export function HumidorDashboard() {
  const auth = useBackupAuth();
  const [activeSection, setActiveSection] = useState<SectionId>("overview");
  const [liveState, setLiveState] = useState(initialLiveState);
  const [itemForm, setItemForm] = useState(blankHumidorForm);
  const [formStatus, setFormStatus] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [aiAdderInput, setAiAdderInput] = useState("");
  const [aiImagePayload, setAiImagePayload] = useState<{ imageBase64: string; mimeType: string; fileName: string } | null>(null);
  const [aiImagePreview, setAiImagePreview] = useState("");
  const [aiIdentification, setAiIdentification] = useState<CigarImageIdentifyResponse | null>(null);
  const [aiIdentifiedForm, setAiIdentifiedForm] = useState<HumidorForm | null>(null);
  const [aiAdderStatus, setAiAdderStatus] = useState("");
  const [isAiAdderSending, setIsAiAdderSending] = useState(false);
  const [isAiConfirmSaving, setIsAiConfirmSaving] = useState(false);
  const [bulkImportText, setBulkImportText] = useState("");
  const [bulkImportStatus, setBulkImportStatus] = useState("");
  const [isBulkImporting, setIsBulkImporting] = useState(false);
  const [selectedHumidorItem, setSelectedHumidorItem] = useState<HumidorItem | null>(null);
  const [humidorAlerts, setHumidorAlerts] = useState<HumidorAlertPreferences>(defaultHumidorAlerts);
  const [humidorAlertsStatus, setHumidorAlertsStatus] = useState("");
  const [isHumidorAlertsSaving, setIsHumidorAlertsSaving] = useState(false);
  const [isRequestingPushPermission, setIsRequestingPushPermission] = useState(false);
  const agingNow = useMemo(() => new Date(), []);
  const liveAuthRequired = process.env.NEXT_PUBLIC_REQUIRE_LIVE_AUTH === "true";
  const { isCognitoConfigured } = auth;
  const isAnonymousDemo = auth.isReady && !auth.isSignedIn;
  const canBulkImport = canUseHumidorBulkImport(auth.session?.membership.tier);
  const canUseAiCigarAdder = canBulkImport;

  useEffect(() => {
    let cancelled = false;

    if (!auth.isReady || !auth.isSignedIn || !auth.isMember || auth.authSource !== "cognito") {
      window.queueMicrotask(() => {
        if (cancelled) {
          return;
        }

        setLiveState(initialLiveState);
      });

      return () => {
        cancelled = true;
      };
    }

    let isMounted = true;

    void (async () => {
      const headers = await auth.createApiHeaders();

      if (!isMounted) {
        return;
      }

      if (!headers.Authorization) {
        setLiveState((current) => ({
          ...current,
          loading: false,
          error: auth.authError || "Cognito session is required to load live humidor data.",
        }));
        return;
      }

      setLiveState((current) => ({
        ...current,
        loading: true,
        error: "",
      }));

      try {
        const bootstrap = await fetchHumidorDashboardBootstrap(headers);
        if (!isMounted) {
          return;
        }

        setLiveState({
          loading: false,
          items: bootstrap.items.items,
          persistence: bootstrap.items.persistence,
          error: "",
        });

        if (bootstrap.alerts) {
          setHumidorAlerts({
            pushEnabled: !!bootstrap.alerts.preferences.pushEnabled,
            reorderRemindersEnabled: !!bootstrap.alerts.preferences.reorderRemindersEnabled,
            climateAlertsEnabled: !!bootstrap.alerts.preferences.climateAlertsEnabled,
            pushSubscription: bootstrap.alerts.preferences.pushSubscription || null,
          });
        } else {
          setHumidorAlerts(defaultHumidorAlerts);
        }
        setHumidorAlertsStatus(bootstrap.alertsError || "");
      } catch (error) {
        if (!isMounted) {
          return;
        }

        const errorMessage = getLiveApiErrorMessage(error);
        setHumidorAlerts(defaultHumidorAlerts);
        setHumidorAlertsStatus(errorMessage);
        setLiveState({
          loading: false,
          items: [],
          persistence: "",
          error: errorMessage,
        });
      }
    })();

    return () => {
      isMounted = false;
      cancelled = true;
    };
  }, [auth]);

  const items = isAnonymousDemo ? demoHumidorItems : liveState.items;
  const agingItems = useMemo(() => {
    const entries: AgingItem[] = [];

    for (const item of items) {
      const snapshot = getAgingSnapshotForItem(item, agingNow);

      if (snapshot) {
        entries.push({ item, snapshot });
      }
    }

    return entries;
  }, [agingNow, items]);
  const totalQuantity = useMemo(() => items.reduce((total, item) => total + item.quantity, 0), [items]);
  const collectionValue = useMemo(() => calculateCollectionValue(items), [items]);
  const valuedItemCount = useMemo(() => items.filter((item) => getHumidorUnitValue(item) !== null).length, [items]);
  const itemEntryPriceSnapshot = useMemo(() => resolveHumidorEntryPriceSnapshot(itemForm, auth.isMember), [auth.isMember, itemForm]);
  const aiEntryPriceSnapshot = useMemo(
    () => (aiIdentifiedForm ? resolveHumidorEntryPriceSnapshot(aiIdentifiedForm, auth.isMember) : null),
    [aiIdentifiedForm, auth.isMember],
  );
  const readyCount = agingItems.filter(({ snapshot }) => snapshot.readiness === "Ready Now").length;
  const reorderCount = items.filter((item) => Boolean(item.reorderReminder)).length;
  const ratedItems = items.filter((item) => typeof item.rating === "number");
  const averageRating = ratedItems.length
    ? Math.round(ratedItems.reduce((total, item) => total + Number(item.rating), 0) / ratedItems.length)
    : null;
  const liveApiConfigured = Boolean(process.env.NEXT_PUBLIC_YCC_API_BASE_URL);

  function updateForm(field: keyof HumidorForm, value: string) {
    setItemForm((current) => ({
      ...current,
      [field]: value,
    }));
    setFormStatus("");
  }

  function updateAiForm(field: keyof HumidorForm, value: string) {
    setAiIdentifiedForm((current) =>
      current
        ? {
            ...current,
            [field]: value,
          }
        : current,
    );
    setAiAdderStatus("");
  }

  async function handleAiImageChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    setAiIdentification(null);
    setAiIdentifiedForm(null);
    setAiAdderStatus("");

    if (!file) {
      setAiImagePayload(null);
      setAiImagePreview("");
      return;
    }

    if (!file.type.startsWith("image/")) {
      setAiImagePayload(null);
      setAiImagePreview("");
      setAiAdderStatus("Upload a cigar image before asking the humidor agent.");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setAiImagePayload(null);
      setAiImagePreview("");
      setAiAdderStatus("Upload a cigar image under 5 MB.");
      return;
    }

    try {
      const dataUrl = await readImageFileAsDataUrl(file);
      const payload = parseImageDataUrl(dataUrl);

      if (!payload) {
        setAiImagePayload(null);
        setAiImagePreview("");
        setAiAdderStatus("The uploaded cigar image could not be decoded.");
        return;
      }

      setAiImagePayload({
        imageBase64: payload.imageBase64,
        mimeType: payload.mimeType || file.type,
        fileName: file.name,
      });
      setAiImagePreview(dataUrl);
      setAiAdderStatus("Image ready. Identify it to load the humidor fields.");
    } catch {
      setAiImagePayload(null);
      setAiImagePreview("");
      setAiAdderStatus("The uploaded cigar image could not be read.");
    }
  }

  async function handleAiAdderSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (isAnonymousDemo || auth.authSource !== "cognito") {
      setAiAdderStatus("Sign in with Cognito before using the AI cigar adder.");
      return;
    }

    if (!canUseAiCigarAdder) {
      setAiAdderStatus(aiCigarAdderGateStatus);
      return;
    }

    if (!aiImagePayload) {
      setAiAdderStatus("Upload or take a cigar photo first.");
      return;
    }

    setIsAiAdderSending(true);
    setAiAdderStatus("");

    try {
      const headers = await auth.createApiHeaders();
      const response = await identifyCigarFromImage(
        {
          ...aiImagePayload,
          notes: aiAdderInput.trim() || undefined,
        },
        headers,
      );

      setAiIdentification(response);
      setAiIdentifiedForm(buildHumidorFormFromSuggestion(response.suggestion));
      setAiAdderStatus("Cigar information loaded. Review it, then confirm to add it to your humidor.");
    } catch (error) {
      setAiAdderStatus(getLiveApiErrorMessage(error));
    } finally {
      setIsAiAdderSending(false);
    }
  }

  async function handleConfirmAiCigar() {
    if (!aiIdentifiedForm) {
      setAiAdderStatus("Identify a cigar image before confirming.");
      return;
    }

    if (!aiIdentifiedForm.name.trim()) {
      setAiAdderStatus("Confirm the cigar name before adding it to your humidor.");
      return;
    }

    if (isAnonymousDemo || auth.authSource !== "cognito") {
      setAiAdderStatus("Sign in with Cognito before saving live humidor data.");
      return;
    }

    if (!canUseAiCigarAdder) {
      setAiAdderStatus(aiCigarAdderGateStatus);
      return;
    }

    setIsAiConfirmSaving(true);
    setAiAdderStatus("");

    try {
      const headers = await auth.createApiHeaders();
      const response = await createHumidorItem(
        buildHumidorPayload(aiIdentifiedForm, buildHumidorImageAttachment(aiImagePayload, aiImagePreview), auth.isMember),
        headers,
      );

      setLiveState((current) => ({
        loading: false,
        items: [response.item, ...current.items.filter((item) => item.id !== response.item.id)],
        persistence: response.persistence.status,
        error: "",
      }));
      setAiIdentification(null);
      setAiIdentifiedForm(null);
      setAiImagePayload(null);
      setAiImagePreview("");
      setAiAdderInput("");
      setAiAdderStatus(
        response.persistence.status === "stored"
          ? "Confirmed and added to your live humidor."
          : "Confirmed. The live API accepted this item, but database persistence is not enabled.",
      );
      setActiveSection("cigars");
    } catch (error) {
      setAiAdderStatus(getLiveApiErrorMessage(error));
    } finally {
      setIsAiConfirmSaving(false);
    }
  }

  async function handleAddItem(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!itemForm.name.trim()) {
      setFormStatus("Enter a cigar name before saving to the live humidor.");
      return;
    }

    if (auth.isSignedIn && auth.authSource !== "cognito") {
      setFormStatus("Sign in with Cognito before saving live humidor data.");
      return;
    }

    setIsSaving(true);
    setFormStatus("");

    try {
      const headers = await auth.createApiHeaders();
      const response = await createHumidorItem(buildHumidorPayload(itemForm, null, auth.isMember), headers);

      setLiveState((current) => ({
        loading: false,
        items: [response.item, ...current.items.filter((item) => item.id !== response.item.id)],
        persistence: response.persistence.status,
        error: "",
      }));
      setItemForm(blankHumidorForm);
      setFormStatus(
        response.persistence.status === "stored"
          ? "Saved to the live humidor."
          : "The live API accepted this item, but database persistence is not enabled.",
      );
      setActiveSection("cigars");
    } catch (error) {
      setFormStatus(getLiveApiErrorMessage(error));
    } finally {
      setIsSaving(false);
    }
  }

  async function handleBulkImport(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!canBulkImport) {
      setBulkImportStatus("Bulk import is available for Kisha, Sensei, and Daimyo members.");
      return;
    }

    if (isAnonymousDemo || auth.authSource !== "cognito") {
      setBulkImportStatus("Sign in with Cognito before bulk importing live humidor records.");
      return;
    }

    const parsed = parseHumidorBulkImport(bulkImportText);

    if (parsed.errors.length) {
      setBulkImportStatus(parsed.errors.slice(0, 4).join(" "));
      return;
    }

    if (!parsed.items.length) {
      setBulkImportStatus("Paste at least one cigar row.");
      return;
    }

    setIsBulkImporting(true);
    setBulkImportStatus("");

    try {
      const headers = await auth.createApiHeaders();
      const importedItems: HumidorItem[] = [];
      let persistence = "";

      for (const item of parsed.items) {
        const payload = buildHumidorPayload(buildHumidorFormFromInput(item), null, auth.isMember);
        const response = await createHumidorItem({ ...payload, source: item.source ?? payload.source }, headers);
        importedItems.push(response.item);
        persistence = response.persistence.status;
      }

      const importedIds = new Set(importedItems.map((item) => item.id));

      setLiveState((current) => ({
        loading: false,
        items: [...importedItems, ...current.items.filter((item) => !importedIds.has(item.id))],
        persistence: persistence || current.persistence,
        error: "",
      }));
      setBulkImportText("");
      setBulkImportStatus(`Imported ${importedItems.length} cigar${importedItems.length === 1 ? "" : "s"} to your live humidor.`);
      setActiveSection("cigars");
    } catch (error) {
      setBulkImportStatus(getLiveApiErrorMessage(error));
    } finally {
      setIsBulkImporting(false);
    }
  }

  function supportsPushNotifications() {
    return (
      typeof window !== "undefined" &&
      "Notification" in window &&
      "serviceWorker" in navigator &&
      "PushManager" in window
    );
  }

  function isPushSubscriptionSupported() {
    return supportsPushNotifications();
  }

  function getVapidApplicationServerKey() {
    return (process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || "").trim();
  }

  function sanitizePushSubscription(subscription: PushSubscription | null): HumidorPushSubscription | null {
    if (!subscription) {
      return null;
    }

    const raw = subscription.toJSON();
    const endpoint = typeof raw.endpoint === "string" ? raw.endpoint : "";
    const keys = raw.keys && typeof raw.keys === "object" ? raw.keys : {};
    const p256dh = typeof keys.p256dh === "string" ? keys.p256dh : "";
    const auth = typeof keys.auth === "string" ? keys.auth : "";

    if (!endpoint || !p256dh || !auth) {
      return null;
    }

    return { endpoint, keys: { p256dh, auth } };
  }

  function parseVapidKey(base64String: string) {
    const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
    const raw = window.atob(base64);
    const key = new Uint8Array(raw.length);

    for (let index = 0; index < raw.length; index++) {
      key[index] = raw.charCodeAt(index);
    }

    return key;
  }

  async function getOrCreatePushSubscription() {
    if (!supportsPushNotifications()) {
      throw new Error("push_not_supported");
    }

    const registration = await navigator.serviceWorker.ready;
    const existing = await registration.pushManager.getSubscription();
    if (existing) {
      return existing;
    }

    const vapidKey = getVapidApplicationServerKey();
    if (!vapidKey) {
      throw new Error("missing_push_subscription");
    }

    return registration.pushManager.subscribe({
      applicationServerKey: parseVapidKey(vapidKey),
      userVisibleOnly: true,
    });
  }

  async function saveHumidorAlertPreferences(nextPreferences: HumidorAlertPreferences) {
    setIsHumidorAlertsSaving(true);
    setHumidorAlertsStatus("");

    try {
      const headers = await auth.createApiHeaders();
      const response = await updateHumidorAlertPreferences(
        {
          climateAlertsEnabled: nextPreferences.climateAlertsEnabled,
          pushEnabled: nextPreferences.pushEnabled,
          reorderRemindersEnabled: nextPreferences.reorderRemindersEnabled,
          pushSubscription: nextPreferences.pushEnabled ? nextPreferences.pushSubscription : null,
        },
        headers,
      );

      setHumidorAlerts({
        pushEnabled: response.preferences.pushEnabled,
        reorderRemindersEnabled: response.preferences.reorderRemindersEnabled,
        climateAlertsEnabled: response.preferences.climateAlertsEnabled,
        pushSubscription: response.preferences.pushSubscription || null,
      });

      setHumidorAlertsStatus(
        response.persistence === "stored"
          ? "Humidor alert preferences are saved for your account."
          : "Your alert preferences were accepted, but persistence is still pending.",
      );
    } catch (error) {
      setHumidorAlertsStatus(getLiveApiErrorMessage(error));
    } finally {
      setIsHumidorAlertsSaving(false);
    }
  }

  async function handleEnableHumidorPushAlerts() {
    if (isAnonymousDemo || auth.authSource !== "cognito") {
      setHumidorAlertsStatus("Sign in before enabling alerts.");
      return;
    }

    if (!supportsPushNotifications()) {
      setHumidorAlertsStatus("Your browser does not support push alerts.");
      return;
    }

    setIsRequestingPushPermission(true);
    setHumidorAlertsStatus("");

    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        throw new Error("push_permission_denied");
      }

      const subscription = await getOrCreatePushSubscription();
      const sanitizedSubscription = sanitizePushSubscription(subscription);
      if (!sanitizedSubscription) {
        throw new Error("missing_push_subscription");
      }

      await saveHumidorAlertPreferences({
        ...humidorAlerts,
        pushEnabled: true,
        pushSubscription: sanitizedSubscription,
      });
    } catch (error) {
      const code = error instanceof Error ? error.message : "push_update_failed";
      setHumidorAlertsStatus(getLiveApiErrorMessage({ error: code, message: code }));
    } finally {
      setIsRequestingPushPermission(false);
    }
  }

  async function handleDisableHumidorPushAlerts() {
    setIsHumidorAlertsSaving(true);
    try {
      if (supportsPushNotifications()) {
        const registration = await navigator.serviceWorker.ready;
        const existing = await registration.pushManager.getSubscription();
        await existing?.unsubscribe();
      }

      await saveHumidorAlertPreferences({
        ...humidorAlerts,
        pushEnabled: false,
        pushSubscription: null,
      });
    } catch (error) {
      setHumidorAlertsStatus(getLiveApiErrorMessage(error));
    } finally {
      setIsHumidorAlertsSaving(false);
    }
  }

  function updateHumidorAlertToggle(field: keyof HumidorAlertPreferences, value: boolean) {
    const next: HumidorAlertPreferences = {
      ...humidorAlerts,
      [field]: value,
    };

    setHumidorAlerts(next);
    void saveHumidorAlertPreferences({
      ...next,
      pushEnabled: field === "pushEnabled" ? value : humidorAlerts.pushEnabled,
      pushSubscription: next.pushEnabled ? next.pushSubscription : null,
    });
  }

  function refreshHumidorItems() {
    if (auth.authSource !== "cognito") {
      return;
    }

    setLiveState((current) => ({ ...current, loading: true, error: "" }));
    void (async () => {
      try {
        const headers = await auth.createApiHeaders();
        const bootstrap = await fetchHumidorDashboardBootstrap(headers);
        setLiveState({
          loading: false,
          items: bootstrap.items.items,
          persistence: bootstrap.items.persistence,
          error: "",
        });
        if (bootstrap.alerts) {
          setHumidorAlerts({
            pushEnabled: !!bootstrap.alerts.preferences.pushEnabled,
            reorderRemindersEnabled: !!bootstrap.alerts.preferences.reorderRemindersEnabled,
            climateAlertsEnabled: !!bootstrap.alerts.preferences.climateAlertsEnabled,
            pushSubscription: bootstrap.alerts.preferences.pushSubscription || null,
          });
        } else {
          setHumidorAlerts(defaultHumidorAlerts);
        }
        setHumidorAlertsStatus(bootstrap.alertsError || "");
      } catch (error) {
        const errorMessage = getLiveApiErrorMessage(error);
        setHumidorAlerts(defaultHumidorAlerts);
        setHumidorAlertsStatus(errorMessage);
        setLiveState({
          loading: false,
          items: [],
          persistence: "",
          error: errorMessage,
        });
      }
    })();
  }

  function renderContent() {
    if (!auth.isReady) {
      return (
        <Panel className="min-h-64 place-items-center text-center">
          <LoaderCircle className="size-8 animate-spin text-yuzu-gold" />
          <div className="grid gap-2">
            <p className="font-heading text-3xl text-yuzu-cream">Loading live member access</p>
            <p className="text-sm text-yuzu-muted">Checking Cognito before opening the humidor API.</p>
          </div>
        </Panel>
      );
    }

    if (auth.isSignedIn && auth.authSource !== "cognito") {
      return (
        <div className="grid max-w-2xl gap-5">
          <AccessCard title="Live API Session Required" icon={ShieldCheck} status={auth.authError}>
            {liveAuthRequired
              ? "This deployment requires live Cognito authentication before humidor records can load."
              : "Local backup access cannot read or write live humidor records. Sign in with Cognito here so API requests carry a verified token."}
          </AccessCard>
          {isCognitoConfigured ? <BackupAuthPanel requireCognito /> : null}
        </div>
      );
    }

    if (auth.isSignedIn && !auth.isMember) {
      return (
        <AccessCard title="Members Only" icon={Crown} status={auth.authError}>
          Your live Cognito session is active, but this account is not in a member group yet. Join a plan or ask support to verify your membership before using the humidor.
          <div className="mt-5 flex flex-col gap-3 sm:flex-row">
            <Button className="h-11 bg-yuzu-gold text-yuzu-ink hover:bg-yuzu-gold-light" render={<Link href="/membership" />}>
              Choose Membership
            </Button>
            <Button className="h-11 border-yuzu-line text-yuzu-cream" variant="outline" onClick={auth.signOut}>
              <LogOut data-icon="inline-start" />
              Sign Out
            </Button>
          </div>
        </AccessCard>
      );
    }

    return (
      <div className="grid gap-6">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <StatCard
            label={isAnonymousDemo ? "Demo Cigars" : "Live Cigars"}
            value={items.length}
            note={isAnonymousDemo ? `${totalQuantity} cigars in sample records` : `${totalQuantity} cigars across live records`}
            icon={Package}
          />
          <StatCard
            label="Collection Value"
            value={formatHumidorValue(collectionValue)}
            note={valuedItemCount ? `${valuedItemCount} item${valuedItemCount === 1 ? "" : "s"} priced at entry` : "Appears after a catalog price match is saved"}
            icon={DollarSign}
          />
          <StatCard
            label="Aging Records"
            value={agingItems.length}
            note={isAnonymousDemo ? `${readyCount} demo cigars marked ready` : `${readyCount} marked ready now`}
            icon={Clock}
          />
          <StatCard
            label="Reorder Dates"
            value={reorderCount}
            note={isAnonymousDemo ? "Sample reminders for preview" : "Pulled from live humidor items"}
            icon={Bell}
          />
          <StatCard
            label="Avg Rating"
            value={averageRating ?? "Not set"}
            note={isAnonymousDemo ? "Calculated from demo ratings" : "Calculated from member ratings"}
            icon={Star}
          />
        </div>

        <div className="grid gap-4 lg:grid-cols-[260px_1fr]">
          <Card className="luxury-card h-fit">
            <CardContent className="grid gap-2 p-3">
              {navItems.map((item) => {
                const Icon = item.icon;
                return (
                  <Button
                    key={item.id}
                    className={cn(
                      "h-11 justify-start gap-3 border-yuzu-line text-yuzu-cream",
                      activeSection === item.id && "bg-yuzu-gold text-yuzu-ink hover:bg-yuzu-gold-light",
                    )}
                    variant={activeSection === item.id ? "default" : "outline"}
                    onClick={() => setActiveSection(item.id)}
                  >
                    <Icon data-icon="inline-start" />
                    {item.label}
                  </Button>
                );
              })}
            </CardContent>
          </Card>

          <div className="grid gap-5">
            <LiveStatusBar
              configured={liveApiConfigured}
              isDemo={isAnonymousDemo}
              loading={liveState.loading}
              persistence={liveState.persistence}
              error={liveState.error}
              onRefresh={refreshHumidorItems}
            />
            {renderActiveSection()}
          </div>
        </div>
      </div>
    );
  }

  function renderActiveSection() {
    if (activeSection === "cigars") {
      return renderCigars();
    }

    if (activeSection === "aging") {
      return renderAging();
    }

    if (activeSection === "alerts") {
      return renderAlerts();
    }

    if (activeSection === "settings") {
      return renderSettings();
    }

    return renderOverview();
  }

  function renderOverview() {
    return (
      <div className="grid gap-5">
        {items.length ? (
          <Card className="luxury-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-3 text-sm uppercase tracking-[0.16em] text-yuzu-gold">
                <Package />
                {isAnonymousDemo ? "Demo Inventory" : "Live Inventory"}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <HumidorTable
                items={items.slice(0, 6)}
                agingNow={agingNow}
                selectedItemId={selectedHumidorItem?.id ?? null}
                onSelectItem={(item) => {
                  setSelectedHumidorItem(item);
                  setActiveSection("cigars");
                }}
              />
            </CardContent>
          </Card>
        ) : (
          <EmptyLiveState
            title="No live humidor items returned"
            copy="Add your first cigar below. It will be sent through the Yuzu API with your Cognito token."
            action={() => setActiveSection("cigars")}
          />
        )}

        <Card className="luxury-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-3 text-sm uppercase tracking-[0.16em] text-yuzu-gold">
                <CheckCircle2 />
                {isAnonymousDemo ? "Demo Data Boundaries" : "Live Data Boundaries"}
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 text-sm leading-6 text-yuzu-muted">
              {isAnonymousDemo ? (
                <>
                  <p>This preview uses sample inventory, aging dates, reorder reminders, ratings, and tasting notes.</p>
                  <p>Your live member humidor replaces every demo record after Cognito sign-in.</p>
                </>
              ) : (
                <>
                  <p>Inventory, aging dates, reorder reminders, ratings, and tasting notes are read from the live humidor API.</p>
                  <p>Climate telemetry and smoke-log routes are not shown here until those API endpoints return member records.</p>
                </>
              )}
            </CardContent>
          </Card>
      </div>
    );
  }

  function renderCigars() {
    return (
      <div className="grid gap-5">
        <Card className="luxury-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-3 text-sm uppercase tracking-[0.16em] text-yuzu-gold">
              <Bot />
              AI Cigar Adder
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4">
            {!isAnonymousDemo && !canUseAiCigarAdder ? (
              <>
                <div className="border border-yuzu-line bg-yuzu-night/60 p-4 text-sm leading-6 text-yuzu-muted">
                  {fullMembershipHumidorToolsCopy}
                </div>
                <Button className="h-11 w-fit border-yuzu-gold text-yuzu-gold hover:bg-yuzu-gold hover:text-yuzu-ink" render={<Link href="/membership" />} variant="outline">
                  Compare Memberships
                </Button>
              </>
            ) : (
              <>
                <form className="grid gap-3" onSubmit={handleAiAdderSubmit}>
              <Field label="Upload or take a cigar photo">
                <Input
                  accept="image/*"
                  capture="environment"
                  className="h-11 rounded-sm border-yuzu-line bg-yuzu-night text-sm text-yuzu-cream"
                  type="file"
                  onChange={handleAiImageChange}
                />
              </Field>
              <Textarea
                aria-label="AI cigar adder notes"
                className="min-h-24 rounded-sm border-yuzu-line bg-yuzu-night text-sm text-yuzu-cream"
                placeholder="Optional notes from the band, box label, receipt line, or smoke"
                value={aiAdderInput}
                onChange={(event: ChangeEvent<HTMLTextAreaElement>) => {
                  setAiAdderInput(event.currentTarget.value);
                  setAiAdderStatus("");
                }}
              />
              {aiImagePreview ? (
                <div className="grid gap-3 border border-yuzu-line/65 bg-yuzu-night/50 p-3 sm:grid-cols-[180px_1fr] sm:items-center">
                  <NextImage
                    alt="Selected cigar for AI identification"
                    className="aspect-[4/3] w-full object-cover"
                    height={270}
                    src={aiImagePreview}
                    unoptimized
                    width={360}
                  />
                  <div className="grid gap-2 text-sm text-yuzu-muted">
                    <p className="font-heading text-xl text-yuzu-cream">{aiImagePayload?.fileName || "Selected cigar image"}</p>
                    <p>The humidor agent will inspect the band, label, box, or receipt details and load editable fields before anything is saved.</p>
                  </div>
                </div>
              ) : null}
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <Button className="h-11 bg-yuzu-gold text-yuzu-ink hover:bg-yuzu-gold-light" disabled={isAiAdderSending || !aiImagePayload || isAnonymousDemo || !canUseAiCigarAdder} type="submit">
                  {isAiAdderSending ? (
                    <LoaderCircle className="animate-spin" data-icon="inline-start" />
                  ) : isAnonymousDemo ? (
                    <LockKeyhole data-icon="inline-start" />
                  ) : (
                    <Camera data-icon="inline-start" />
                  )}
                  {isAnonymousDemo ? "Sign In To Use AI" : isAiAdderSending ? "Identifying Cigar" : "Identify Cigar"}
                </Button>
                <p className="min-h-5 text-sm text-yuzu-gold" aria-live="polite">
                  {aiAdderStatus}
                </p>
              </div>
            </form>

            {aiIdentification && aiIdentifiedForm ? (
              <div className="grid gap-4 border border-yuzu-line/65 bg-yuzu-night/50 p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="grid gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge className="border-yuzu-gold/50 text-yuzu-gold" variant="outline">
                        <Bot data-icon="inline-start" />
                        {formatPersistence(aiIdentification.ai.status)}
                      </Badge>
                      <Badge className="border-yuzu-line text-yuzu-muted" variant="outline">
                        <ImageIcon data-icon="inline-start" />
                        {formatPersistence(aiIdentification.suggestion.confidence)} confidence
                      </Badge>
                    </div>
                    <p className="font-heading text-2xl text-yuzu-cream">Review identified cigar</p>
                  </div>
                  <Button className="h-10 border-yuzu-line text-yuzu-cream" type="button" variant="outline" onClick={() => setItemForm(aiIdentifiedForm)}>
                    <Plus data-icon="inline-start" />
                    Copy To Manual Form
                  </Button>
                </div>

                {aiImagePreview ? (
                  <div className="grid gap-3 border border-yuzu-line/65 bg-yuzu-ink/35 p-3 sm:grid-cols-[120px_1fr] sm:items-center">
                    <NextImage
                      alt="Saved cigar photo preview"
                      className="aspect-[4/3] w-full object-cover"
                      height={180}
                      src={aiImagePreview}
                      unoptimized
                      width={240}
                    />
                    <div className="grid gap-1 text-sm text-yuzu-muted">
                      <p className="text-xs uppercase tracking-[0.16em] text-yuzu-gold">Saved photo</p>
                      <p className="font-heading text-xl text-yuzu-cream">{aiImagePayload?.fileName || "Cigar image"}</p>
                    </div>
                  </div>
                ) : null}

                <div className="grid gap-3 md:grid-cols-2">
                  <Field label="Cigar name">
                    <Input value={aiIdentifiedForm.name} onChange={(event: ChangeEvent<HTMLInputElement>) => updateAiForm("name", event.target.value)} required />
                  </Field>
                  <Field label="Brand">
                    <Input value={aiIdentifiedForm.brand} onChange={(event: ChangeEvent<HTMLInputElement>) => updateAiForm("brand", event.target.value)} />
                  </Field>
                  <Field label="Line">
                    <Input value={aiIdentifiedForm.line} onChange={(event: ChangeEvent<HTMLInputElement>) => updateAiForm("line", event.target.value)} />
                  </Field>
                  <Field label="Vitola">
                    <Input value={aiIdentifiedForm.vitola} onChange={(event: ChangeEvent<HTMLInputElement>) => updateAiForm("vitola", event.target.value)} />
                  </Field>
                  <Field label="Wrapper">
                    <Input value={aiIdentifiedForm.wrapper} onChange={(event: ChangeEvent<HTMLInputElement>) => updateAiForm("wrapper", event.target.value)} />
                  </Field>
                  <Field label="Origin">
                    <Input value={aiIdentifiedForm.origin} onChange={(event: ChangeEvent<HTMLInputElement>) => updateAiForm("origin", event.target.value)} />
                  </Field>
                  <Field label="Strength">
                    <Input value={aiIdentifiedForm.strength} onChange={(event: ChangeEvent<HTMLInputElement>) => updateAiForm("strength", event.target.value)} />
                  </Field>
                  <Field label="Quantity">
                    <Input min={1} type="number" value={aiIdentifiedForm.quantity} onChange={(event: ChangeEvent<HTMLInputElement>) => updateAiForm("quantity", event.target.value)} />
                  </Field>
                  <Field label="Entry price snapshot">
                    <EntryPriceSnapshotPreview
                      fallbackCurrency={aiIdentifiedForm.estimatedValueCurrency}
                      fallbackValue={parseHumidorValue(aiIdentifiedForm.estimatedValue)}
                      snapshot={aiEntryPriceSnapshot}
                    />
                  </Field>
                  <Field label="Purchase date">
                    <Input type="date" value={aiIdentifiedForm.purchaseDate} onChange={(event: ChangeEvent<HTMLInputElement>) => updateAiForm("purchaseDate", event.target.value)} />
                  </Field>
                  <Field label="Aging start">
                    <Input type="date" value={aiIdentifiedForm.agingStartDate} onChange={(event: ChangeEvent<HTMLInputElement>) => updateAiForm("agingStartDate", event.target.value)} />
                  </Field>
                  <Field label="Reorder reminder">
                    <Input type="date" value={aiIdentifiedForm.reorderReminder} onChange={(event: ChangeEvent<HTMLInputElement>) => updateAiForm("reorderReminder", event.target.value)} />
                  </Field>
                  <Field label="Rating">
                    <Input max={100} min={0} type="number" value={aiIdentifiedForm.rating} onChange={(event: ChangeEvent<HTMLInputElement>) => updateAiForm("rating", event.target.value)} />
                  </Field>
                  <Field label="Location">
                    <Input value={aiIdentifiedForm.humidorLocation} onChange={(event: ChangeEvent<HTMLInputElement>) => updateAiForm("humidorLocation", event.target.value)} />
                  </Field>
                  <Field label="Tray">
                    <Input value={aiIdentifiedForm.tray} onChange={(event: ChangeEvent<HTMLInputElement>) => updateAiForm("tray", event.target.value)} />
                  </Field>
                </div>

                <Field label="Tasting notes">
                  <Textarea aria-label="AI identified tasting notes" value={aiIdentifiedForm.tastingNotes} onChange={(event: ChangeEvent<HTMLTextAreaElement>) => updateAiForm("tastingNotes", event.target.value)} />
                </Field>

                {getCigarDetailRows(aiIdentification.suggestion.details).length ? (
                  <div className="grid gap-3 border border-yuzu-line/65 bg-yuzu-ink/35 p-3 text-sm text-yuzu-muted">
                    <p className="text-xs uppercase tracking-[0.16em] text-yuzu-gold">Cigar details</p>
                    <dl className="grid gap-2 sm:grid-cols-2">
                      {getCigarDetailRows(aiIdentification.suggestion.details).map((detail) => (
                        <div key={detail.label} className="grid gap-1 border-b border-yuzu-line/40 pb-2 last:border-b-0 sm:last:border-b">
                          <dt className="text-[0.68rem] uppercase tracking-[0.14em] text-yuzu-muted">{detail.label}</dt>
                          <dd className="text-yuzu-cream">{detail.value}</dd>
                        </div>
                      ))}
                    </dl>
                  </div>
                ) : null}

                <div className="grid gap-3 text-sm leading-6 text-yuzu-muted md:grid-cols-2">
                  <div>
                    <p className="text-xs uppercase tracking-[0.16em] text-yuzu-gold">Evidence</p>
                    <ul className="mt-2 grid gap-1">
                      {aiIdentification.suggestion.evidence.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-[0.16em] text-yuzu-gold">Review</p>
                    <ul className="mt-2 grid gap-1">
                      {(aiIdentification.suggestion.needsReview.length ? aiIdentification.suggestion.needsReview : ["Confirm the fields before saving."]).map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  </div>
                </div>

                <Button className="h-11 w-fit bg-yuzu-gold text-yuzu-ink hover:bg-yuzu-gold-light" disabled={isAiConfirmSaving || !aiIdentifiedForm.name.trim() || isAnonymousDemo || !canUseAiCigarAdder} type="button" onClick={handleConfirmAiCigar}>
                  {isAiConfirmSaving ? <LoaderCircle className="animate-spin" data-icon="inline-start" /> : <CheckCircle2 data-icon="inline-start" />}
                  {isAiConfirmSaving ? "Adding To Humidor" : "Confirm & Add To Humidor"}
                </Button>
              </div>
            ) : null}
              </>
            )}
          </CardContent>
        </Card>

        {renderBulkImport()}

        <Card className="luxury-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-3 text-sm uppercase tracking-[0.16em] text-yuzu-gold">
              <Plus />
              {isAnonymousDemo ? "Preview Add Form" : "Add Live Humidor Item"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form className="grid gap-4" onSubmit={handleAddItem}>
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Cigar name">
                  <Input value={itemForm.name} onChange={(event: ChangeEvent<HTMLInputElement>) => updateForm("name", event.target.value)} required />
                </Field>
                <Field label="Brand">
                  <Input value={itemForm.brand} onChange={(event: ChangeEvent<HTMLInputElement>) => updateForm("brand", event.target.value)} />
                </Field>
                <Field label="Line">
                  <Input value={itemForm.line} onChange={(event: ChangeEvent<HTMLInputElement>) => updateForm("line", event.target.value)} />
                </Field>
                <Field label="Vitola">
                  <Input value={itemForm.vitola} onChange={(event: ChangeEvent<HTMLInputElement>) => updateForm("vitola", event.target.value)} />
                </Field>
                <Field label="Wrapper">
                  <Input value={itemForm.wrapper} onChange={(event: ChangeEvent<HTMLInputElement>) => updateForm("wrapper", event.target.value)} />
                </Field>
                <Field label="Origin">
                  <Input value={itemForm.origin} onChange={(event: ChangeEvent<HTMLInputElement>) => updateForm("origin", event.target.value)} />
                </Field>
                <Field label="Strength">
                  <Input value={itemForm.strength} onChange={(event: ChangeEvent<HTMLInputElement>) => updateForm("strength", event.target.value)} />
                </Field>
                <Field label="Quantity">
                  <Input min={1} type="number" value={itemForm.quantity} onChange={(event: ChangeEvent<HTMLInputElement>) => updateForm("quantity", event.target.value)} />
                </Field>
                <Field label="Entry price snapshot">
                  <EntryPriceSnapshotPreview snapshot={itemEntryPriceSnapshot} />
                </Field>
                <Field label="Purchase date">
                  <Input type="date" value={itemForm.purchaseDate} onChange={(event: ChangeEvent<HTMLInputElement>) => updateForm("purchaseDate", event.target.value)} />
                </Field>
                <Field label="Aging start">
                  <Input type="date" value={itemForm.agingStartDate} onChange={(event: ChangeEvent<HTMLInputElement>) => updateForm("agingStartDate", event.target.value)} />
                </Field>
                <Field label="Reorder reminder">
                  <Input type="date" value={itemForm.reorderReminder} onChange={(event: ChangeEvent<HTMLInputElement>) => updateForm("reorderReminder", event.target.value)} />
                </Field>
                <Field label="Rating">
                  <Input max={100} min={0} type="number" value={itemForm.rating} onChange={(event: ChangeEvent<HTMLInputElement>) => updateForm("rating", event.target.value)} />
                </Field>
                <Field label="Location">
                  <Input value={itemForm.humidorLocation} onChange={(event: ChangeEvent<HTMLInputElement>) => updateForm("humidorLocation", event.target.value)} />
                </Field>
                <Field label="Tray">
                  <Input value={itemForm.tray} onChange={(event: ChangeEvent<HTMLInputElement>) => updateForm("tray", event.target.value)} />
                </Field>
              </div>
              <Field label="Tasting notes">
                <Textarea aria-label="Tasting notes" value={itemForm.tastingNotes} onChange={(event: ChangeEvent<HTMLTextAreaElement>) => updateForm("tastingNotes", event.target.value)} />
              </Field>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <Button className="h-11 bg-yuzu-gold text-yuzu-ink hover:bg-yuzu-gold-light" disabled={isSaving || !itemForm.name.trim() || isAnonymousDemo} type="submit">
                  {isSaving ? (
                    <LoaderCircle className="animate-spin" data-icon="inline-start" />
                  ) : isAnonymousDemo ? (
                    <LockKeyhole data-icon="inline-start" />
                  ) : (
                    <Plus data-icon="inline-start" />
                  )}
                  {isAnonymousDemo ? "Sign In To Save" : "Save To Live Humidor"}
                </Button>
                <p className="min-h-5 text-sm text-yuzu-gold" aria-live="polite">
                  {formStatus || (isAnonymousDemo ? "Demo preview is read-only. Sign in before saving to the live humidor." : "")}
                </p>
              </div>
            </form>
          </CardContent>
        </Card>

        <Card className="luxury-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-3 text-sm uppercase tracking-[0.16em] text-yuzu-gold">
              <Package />
              {isAnonymousDemo ? "Demo Cigars" : "My Cigars"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {items.length ? (
              <HumidorTable items={items} agingNow={agingNow} selectedItemId={selectedHumidorItem?.id ?? null} onSelectItem={setSelectedHumidorItem} />
            ) : (
              <p className="text-sm text-yuzu-muted">
                {isAnonymousDemo ? "No demo humidor records are configured." : "No live humidor records have been returned yet."}
              </p>
            )}
          </CardContent>
        </Card>

        {selectedHumidorItem ? (
          <HumidorDetailCard item={selectedHumidorItem} agingNow={agingNow} isDemo={isAnonymousDemo} onClose={() => setSelectedHumidorItem(null)} />
        ) : null}
      </div>
    );
  }

  function renderBulkImport() {
    if (isAnonymousDemo) {
      return null;
    }

    if (!canBulkImport) {
      return (
        <Card className="luxury-card" data-bulk-import-source="member_bulk_import">
          <CardHeader>
            <CardTitle className="flex items-center gap-3 text-sm uppercase tracking-[0.16em] text-yuzu-gold">
              <FileSpreadsheet />
              Bulk Import Cigars
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div className="border border-yuzu-line bg-yuzu-night/60 p-4 text-sm leading-6 text-yuzu-muted">
              {fullMembershipHumidorToolsCopy}
            </div>
            <Button className="h-11 w-fit border-yuzu-gold text-yuzu-gold hover:bg-yuzu-gold hover:text-yuzu-ink" render={<Link href="/membership" />} variant="outline">
              Compare Memberships
            </Button>
          </CardContent>
        </Card>
      );
    }

    return (
      <Card className="luxury-card" data-bulk-import-source="member_bulk_import">
        <CardHeader>
          <CardTitle className="flex items-center gap-3 text-sm uppercase tracking-[0.16em] text-yuzu-gold">
            <FileSpreadsheet />
            Bulk Import Cigars
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form className="grid gap-4" onSubmit={handleBulkImport}>
            <Field label="CSV or spreadsheet rows">
              <Textarea
                aria-label="Bulk humidor import rows"
                className="min-h-40 rounded-sm border-yuzu-line bg-yuzu-night text-sm text-yuzu-cream"
                placeholder={`${humidorBulkImportTemplate}\nPadron 1964 Anniversary,Padron,1964,Principe,Natural,Nicaragua,Medium-full,2,2026-03-12,2026-03-12,2026-06-15,Locker A,Drawer 2,94,Cocoa and cedar`}
                value={bulkImportText}
                onChange={(event: ChangeEvent<HTMLTextAreaElement>) => {
                  setBulkImportText(event.currentTarget.value);
                  setBulkImportStatus("");
                }}
              />
            </Field>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <Button className="h-11 bg-yuzu-gold text-yuzu-ink hover:bg-yuzu-gold-light" disabled={isBulkImporting || !bulkImportText.trim()} type="submit">
                {isBulkImporting ? <LoaderCircle className="animate-spin" data-icon="inline-start" /> : <Upload data-icon="inline-start" />}
                {isBulkImporting ? "Importing Cigars" : "Import Cigars"}
              </Button>
              <p className="min-h-5 text-sm text-yuzu-gold" aria-live="polite">
                {bulkImportStatus}
              </p>
            </div>
          </form>
        </CardContent>
      </Card>
    );
  }

  function renderAging() {
    return (
      <Card className="luxury-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-3 text-sm uppercase tracking-[0.16em] text-yuzu-gold">
            <Clock />
            Aging Tracker
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4">
          {agingItems.length ? (
            agingItems.map(({ item, snapshot }) => (
              <div key={item.id} className="grid gap-3 border border-yuzu-line bg-yuzu-night/60 p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="font-heading text-2xl text-yuzu-cream">{item.name}</p>
                    <p className="text-sm text-yuzu-muted">{formatItemDetails(item) || "Aging date recorded in live API"}</p>
                  </div>
                  <ReadinessBadge readiness={snapshot.readiness} />
                </div>
                <Progress className="[&_[data-slot=progress-indicator]]:bg-yuzu-gold" value={snapshot.progress} />
                <div className="grid gap-2 text-sm text-yuzu-muted sm:grid-cols-3">
                  <span>{snapshot.ageMonths} months aging</span>
                  <span>Started {formatDate(item.agingStartDate || item.purchaseDate)}</span>
                  <span>{item.quantity} on hand</span>
                </div>
              </div>
            ))
          ) : (
            <p className="text-sm leading-6 text-yuzu-muted">No live items have purchase or aging dates yet. Add dates to the item form to enable aging status.</p>
          )}
        </CardContent>
      </Card>
    );
  }

  function renderAlerts() {
    const reorderItems = items.filter((item) => Boolean(item.reorderReminder));
    const pushSupported = isPushSubscriptionSupported();
    const hasNotificationPermission = typeof window !== "undefined" && "Notification" in window ? Notification.permission === "granted" : false;

    return (
      <Card className="luxury-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-3 text-sm uppercase tracking-[0.16em] text-yuzu-gold">
            <Bell />
            Alerts
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="grid gap-3 border border-yuzu-line bg-yuzu-night/60 p-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-heading text-xl text-yuzu-cream">Mobile push preferences</p>
                <p className="mt-1 text-sm text-yuzu-muted">
                  Save your preferences and enable push alerts to receive reorder reminder notifications on your signed-in device.
                </p>
              </div>
              <Button
                className={`h-11 border ${
                  humidorAlerts.pushEnabled ? "bg-yuzu-gold text-yuzu-ink hover:bg-yuzu-gold-light" : "text-yuzu-cream hover:bg-yuzu-night/75"
                }`}
                disabled={
                  isAnonymousDemo ||
                  isHumidorAlertsSaving ||
                  isRequestingPushPermission ||
                  (!humidorAlerts.pushEnabled && (!pushSupported || getVapidApplicationServerKey() === ""))
                }
                variant={humidorAlerts.pushEnabled ? "default" : "outline"}
                onClick={humidorAlerts.pushEnabled ? handleDisableHumidorPushAlerts : handleEnableHumidorPushAlerts}
              >
                {isHumidorAlertsSaving || isRequestingPushPermission ? <LoaderCircle className="animate-spin" data-icon="inline-start" /> : null}
                {humidorAlerts.pushEnabled ? "Disable Push Alerts" : "Enable Push Alerts"}
              </Button>
            </div>
            <p className="text-sm text-yuzu-muted">
              {humidorAlerts.pushEnabled
                ? hasNotificationPermission
                  ? "Push alerts are enabled for this device. Keep this browser session signed in to continue receiving alerts."
                  : "Push alerts are not enabled because browser notification permission is blocked."
                : "Push alerts are currently disabled for this account."}
            </p>
            {!humidorAlerts.pushEnabled && !pushSupported ? (
              <p className="text-sm text-yuzu-amber">Your browser does not support push notifications in this context.</p>
            ) : null}
            {humidorAlerts.pushEnabled && !humidorAlerts.pushSubscription ? (
              <p className="text-sm text-yuzu-amber">No valid push subscription was saved. Re-enable alerts to refresh the device subscription.</p>
            ) : null}
          </div>

          <div className="grid gap-3 border border-yuzu-line bg-yuzu-night/60 p-4">
            <label className="flex items-center justify-between gap-3">
              <span className="text-sm text-yuzu-cream">Enable reorder reminder alerts</span>
              <input
                checked={humidorAlerts.reorderRemindersEnabled}
                className="h-5 w-5 accent-yuzu-gold"
                disabled={isAnonymousDemo || isHumidorAlertsSaving}
                type="checkbox"
                onChange={(event: ChangeEvent<HTMLInputElement>) =>
                  updateHumidorAlertToggle("reorderRemindersEnabled", event.currentTarget.checked)
                }
              />
            </label>
            <label className="flex items-center justify-between gap-3">
              <span className="text-sm text-yuzu-cream">Enable climate alerts</span>
              <input
                checked={humidorAlerts.climateAlertsEnabled}
                className="h-5 w-5 accent-yuzu-gold"
                disabled={isAnonymousDemo || isHumidorAlertsSaving}
                type="checkbox"
                onChange={(event: ChangeEvent<HTMLInputElement>) =>
                  updateHumidorAlertToggle("climateAlertsEnabled", event.currentTarget.checked)
                }
              />
            </label>
            <p className="text-sm text-yuzu-muted">{humidorAlertsStatus}</p>
          </div>

          <div className="grid gap-2">
            {reorderItems.length ? (
              reorderItems.map((item) => (
                <div key={item.id} className="flex flex-col gap-2 border border-yuzu-line bg-yuzu-night/60 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="font-heading text-xl text-yuzu-cream">{item.name}</p>
                    <p className="text-sm text-yuzu-muted">Reorder reminder: {formatDate(item.reorderReminder)}</p>
                  </div>
                  <Badge className="border-yuzu-gold/50 text-yuzu-gold" variant="outline">
                    {isAnonymousDemo ? "Demo item" : "Live item"}
                  </Badge>
                </div>
              ))
            ) : (
              <p className="text-sm leading-6 text-yuzu-muted">
                {isAnonymousDemo
                  ? "No demo reorder reminders are configured."
                  : "No live reorder reminders or climate alerts were returned by the Yuzu API."}
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  function renderSettings() {
    if (isAnonymousDemo) {
      return (
        <Card className="luxury-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-3 text-sm uppercase tracking-[0.16em] text-yuzu-gold">
              <Settings />
              Preview Settings
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div className="grid gap-3 md:grid-cols-3">
              <StatusTile label="Session" value="Anonymous" />
              <StatusTile label="Data Source" value="Demo" />
              <StatusTile label="Persistence" value="Sign in required" />
            </div>
            <div className="border border-yuzu-line bg-yuzu-night/60 p-4 text-sm leading-6 text-yuzu-muted">
              Demo records are never saved to a browser store or sent to the Yuzu API. Cognito sign-in loads your live member humidor instead.
            </div>
            <Button className="h-11 w-fit border-yuzu-line text-yuzu-cream" render={<Link href="/account" />} variant="outline">
              Sign In
            </Button>
          </CardContent>
        </Card>
      );
    }

    return (
      <Card className="luxury-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-3 text-sm uppercase tracking-[0.16em] text-yuzu-gold">
            <Settings />
            Live Settings
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="grid gap-3 md:grid-cols-3">
            <StatusTile label="Cognito" value={auth.authSource === "cognito" ? "Active" : "Required"} />
            <StatusTile label="Yuzu API" value={liveApiConfigured ? "Configured" : "Missing URL"} />
            <StatusTile label="Persistence" value={formatPersistence(liveState.persistence)} />
          </div>
          <div className="border border-yuzu-line bg-yuzu-night/60 p-4 text-sm leading-6 text-yuzu-muted">
            Signed in as <span className="font-semibold text-yuzu-cream">{auth.session?.email}</span>. Humidor requests are sent with the current Cognito Authorization header.
          </div>
          <Button className="h-11 w-fit border-yuzu-line text-yuzu-cream" variant="outline" onClick={auth.signOut}>
            <LogOut data-icon="inline-start" />
            Sign Out
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <main className="min-h-screen bg-yuzu-ink text-yuzu-cream">
      <div className="mx-auto grid w-full max-w-7xl gap-8 px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="grid gap-4">
            <Button className="h-10 w-fit border-yuzu-line text-yuzu-cream" render={<Link href="/" />} variant="outline">
              <ArrowLeft data-icon="inline-start" />
              Back to Club
            </Button>
            <div className="grid gap-3">
              <Badge className="w-fit border-yuzu-gold/50 text-yuzu-gold" variant="outline">
                <ShieldCheck data-icon="inline-start" />
                {isAnonymousDemo ? "Demo Humidor Preview" : "Live Member Humidor"}
              </Badge>
              <h1 className="font-heading text-4xl text-yuzu-cream sm:text-5xl">Digital Humidor</h1>
              <p className="max-w-3xl text-base leading-7 text-yuzu-muted">
                {isAnonymousDemo
                  ? "Explore sample inventory, aging dates, reorder reminders, ratings, and tasting notes before signing in."
                  : "Member inventory, aging dates, reorder reminders, ratings, and tasting notes are loaded from the Yuzu API."}
              </p>
            </div>
          </div>
          <div className="grid gap-2 text-sm text-yuzu-muted lg:text-right">
            <span>{auth.isSignedIn ? auth.session?.name || auth.session?.email : "Demo session"}</span>
            <span>{auth.isMember ? `${auth.session?.membership.tier ?? "Yuzu"} member` : isAnonymousDemo ? "Sign in for live data" : "Member access required"}</span>
          </div>
        </div>

        {renderContent()}
      </div>
    </main>
  );
}

function Panel({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("grid border border-yuzu-line bg-yuzu-night/70 p-6", className)}>{children}</div>;
}

function AccessCard({
  title,
  icon: Icon,
  children,
  status,
}: {
  title: string;
  icon: IconComponent;
  children: ReactNode;
  status?: string;
}) {
  return (
    <Card className="luxury-card max-w-2xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-3 text-sm uppercase tracking-[0.16em] text-yuzu-gold">
          <Icon />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="grid gap-5">
        <p className="text-sm leading-6 text-yuzu-muted">{children}</p>
        {status ? (
          <p className="text-sm text-yuzu-gold" aria-live="polite">
            {status}
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}

function StatCard({ label, value, note, icon: Icon }: { label: string; value: ReactNode; note: string; icon: IconComponent }) {
  return (
    <Card className="luxury-card">
      <CardContent className="grid gap-3 p-5">
        <div className="flex items-center justify-between gap-3">
          <span className="text-xs uppercase tracking-[0.16em] text-yuzu-muted">{label}</span>
          <Icon className="size-5 text-yuzu-gold" />
        </div>
        <div className="font-heading text-3xl text-yuzu-cream">{value}</div>
        <p className="text-sm text-yuzu-muted">{note}</p>
      </CardContent>
    </Card>
  );
}

function StatusTile({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="border border-yuzu-line bg-yuzu-night/60 p-4">
      <p className="text-xs uppercase tracking-[0.16em] text-yuzu-muted">{label}</p>
      <p className="mt-2 font-heading text-2xl text-yuzu-cream">{value}</p>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="grid gap-2 text-sm text-yuzu-muted">
      <span>{label}</span>
      {children}
    </label>
  );
}

function EntryPriceSnapshotPreview({
  fallbackCurrency = "USD",
  fallbackValue = null,
  snapshot,
}: {
  fallbackCurrency?: string;
  fallbackValue?: number | null;
  snapshot: HumidorEntryPriceSnapshot | null;
}) {
  if (snapshot) {
    return (
      <div className="grid min-h-16 gap-1 border border-yuzu-line bg-yuzu-night/60 p-3">
        <span className="text-yuzu-cream">{formatHumidorValue(snapshot.unitPrice, snapshot.currency)} per cigar</span>
        <span className="text-xs text-yuzu-muted">
          Current catalog price from {snapshot.productName}: {formatHumidorValue(snapshot.boxPrice, snapshot.currency)} / {snapshot.packageLabel}
        </span>
      </div>
    );
  }

  return (
    <div className="grid min-h-16 gap-1 border border-yuzu-line bg-yuzu-night/60 p-3">
      <span className="text-yuzu-cream">No catalog match yet</span>
      <span className="text-xs text-yuzu-muted">
        {fallbackValue === null
          ? "Collection Value stays unset until this cigar matches a current catalog price."
          : `AI reference ${formatHumidorValue(fallbackValue, fallbackCurrency)} is shown for review, but Collection Value uses catalog pricing only.`}
      </span>
    </div>
  );
}

function LiveStatusBar({
  configured,
  isDemo,
  loading,
  persistence,
  error,
  onRefresh,
}: {
  configured: boolean;
  isDemo: boolean;
  loading: boolean;
  persistence: string;
  error: string;
  onRefresh: () => void;
}) {
  if (isDemo) {
    return (
      <div className="flex flex-col gap-3 border border-yuzu-line bg-yuzu-night/70 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <LockKeyhole className="mt-1 size-5 text-yuzu-gold" />
          <div className="grid gap-1">
            <p className="font-heading text-xl text-yuzu-cream">Demo Humidor Preview</p>
            <p className="text-sm text-yuzu-muted">Sign in to replace this preview with your live member humidor.</p>
          </div>
        </div>
        <Button className="h-10 w-fit border-yuzu-line text-yuzu-cream" render={<Link href="/account" />} variant="outline">
          Sign In
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 border border-yuzu-line bg-yuzu-night/70 p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-3">
        {error || !configured ? <AlertTriangle className="mt-1 size-5 text-yuzu-gold" /> : <ShieldCheck className="mt-1 size-5 text-yuzu-gold" />}
        <div className="grid gap-1">
          <p className="font-heading text-xl text-yuzu-cream">{loading ? "Loading live humidor data" : error ? "Live humidor API issue" : "Live humidor connected"}</p>
          <p className="text-sm text-yuzu-muted">
            {error || (configured ? `Database persistence: ${formatPersistence(persistence)}` : "NEXT_PUBLIC_YCC_API_BASE_URL is not configured.")}
          </p>
        </div>
      </div>
      <Button className="h-10 border-yuzu-line text-yuzu-cream" disabled={loading} variant="outline" onClick={onRefresh}>
        {loading ? <LoaderCircle className="animate-spin" data-icon="inline-start" /> : <RefreshCw data-icon="inline-start" />}
        Refresh
      </Button>
    </div>
  );
}

function HumidorTable({
  items,
  agingNow,
  selectedItemId,
  onSelectItem,
}: {
  items: HumidorItem[];
  agingNow: Date;
  selectedItemId: string | null;
  onSelectItem: (item: HumidorItem) => void;
}) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Cigar</TableHead>
          <TableHead>Qty</TableHead>
          <TableHead>Collection Value</TableHead>
          <TableHead>Location</TableHead>
          <TableHead>Aging</TableHead>
          <TableHead>Rating</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {items.map((item) => {
          const snapshot = getAgingSnapshotForItem(item, agingNow);
          const unitValue = getHumidorUnitValue(item);
          const itemValue = getHumidorItemValue(item);
          return (
            <TableRow
              key={item.id}
              aria-label={`Open details for ${item.name}`}
              className="cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yuzu-gold/70 data-[state=selected]:bg-yuzu-gold/10"
              data-state={selectedItemId === item.id ? "selected" : undefined}
              role="button"
              tabIndex={0}
              onClick={() => onSelectItem(item)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  onSelectItem(item);
                }
              }}
            >
              <TableCell>
                <div className="flex min-w-52 items-center gap-3">
                  {item.cigarImage?.dataUrl ? (
                    <NextImage
                      alt={`${item.name} cigar photo`}
                      className="size-14 shrink-0 object-cover"
                      height={80}
                      src={item.cigarImage.dataUrl}
                      unoptimized
                      width={80}
                    />
                  ) : null}
                  <div className="grid gap-1">
                    <span className="font-medium text-yuzu-cream">{item.name}</span>
                    <span className="text-xs text-yuzu-muted">{formatItemDetails(item) || "No brand details"}</span>
                  </div>
                </div>
              </TableCell>
              <TableCell>{item.quantity}</TableCell>
              <TableCell>
                {itemValue === null || unitValue === null ? (
                  "Not set"
                ) : (
                  <div className="grid gap-1">
                    <span className="text-yuzu-cream">{formatHumidorValue(itemValue, item.estimatedValueCurrency)}</span>
                    <span className="text-xs text-yuzu-muted">
                      {formatHumidorValue(unitValue, item.estimatedValueCurrency)} each | {formatHumidorValueSource(item.estimatedValueSource)}
                    </span>
                  </div>
                )}
              </TableCell>
              <TableCell>{item.humidorLocation || "Not set"}</TableCell>
              <TableCell>{snapshot ? <ReadinessBadge readiness={snapshot.readiness} /> : "Not set"}</TableCell>
              <TableCell>{typeof item.rating === "number" ? item.rating : "Not set"}</TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}

function HumidorDetailCard({
  item,
  agingNow,
  isDemo,
  onClose,
}: {
  item: HumidorItem;
  agingNow: Date;
  isDemo: boolean;
  onClose: () => void;
}) {
  const snapshot = getAgingSnapshotForItem(item, agingNow);
  const unitValue = getHumidorUnitValue(item);
  const itemValue = getHumidorItemValue(item);
  const cigarDetails = [
    { label: "Brand", value: item.brand },
    { label: "Line", value: item.line },
    { label: "Vitola", value: item.vitola },
    { label: "Wrapper", value: item.wrapper },
    { label: "Origin", value: item.origin },
    { label: "Strength", value: item.strength },
    { label: "Location", value: item.humidorLocation },
    { label: "Tray", value: item.tray },
  ].filter((detail) => detail.value);

  return (
    <Card className="luxury-card">
      <CardHeader>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="grid gap-2">
            <CardTitle className="flex items-center gap-3 text-sm uppercase tracking-[0.16em] text-yuzu-gold">
              <Package />
              Detailed Cigar Card
            </CardTitle>
            <div className="grid gap-1">
              <p className="font-heading text-3xl text-yuzu-cream">{item.name}</p>
              <p className="text-sm text-yuzu-muted">{formatItemDetails(item) || "No brand details recorded yet."}</p>
            </div>
          </div>
          <Button className="h-10 w-fit border-yuzu-line text-yuzu-cream" type="button" variant="outline" onClick={onClose}>
            <X data-icon="inline-start" />
            Close Details
          </Button>
        </div>
      </CardHeader>
      <CardContent className="grid gap-5">
        <div className="grid gap-4 lg:grid-cols-[220px_1fr]">
          {item.cigarImage?.dataUrl ? (
            <NextImage
              alt={`${item.name} detailed cigar photo`}
              className="aspect-[4/3] w-full object-cover"
              height={330}
              src={item.cigarImage.dataUrl}
              unoptimized
              width={440}
            />
          ) : (
            <div className="grid aspect-[4/3] place-items-center border border-yuzu-line bg-yuzu-night/60 text-sm text-yuzu-muted">
              No saved photo
            </div>
          )}

          <div className="grid gap-4">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <StatusTile label="Quantity" value={item.quantity} />
              <StatusTile label="Rating" value={typeof item.rating === "number" ? item.rating : "Not set"} />
              <StatusTile label="Collection Value" value={itemValue === null ? "Not set" : formatHumidorValue(itemValue, item.estimatedValueCurrency)} />
              <StatusTile label="Source" value={isDemo ? "Demo" : formatPersistence(item.source)} />
            </div>

            <div className="grid gap-3 md:grid-cols-3">
              <DetailTile label="Purchase Date" value={formatDate(item.purchaseDate)} />
              <DetailTile label="Aging Start" value={formatDate(item.agingStartDate)} />
              <DetailTile label="Reorder Reminder" value={formatDate(item.reorderReminder)} />
            </div>

            {snapshot ? (
              <div className="grid gap-3 border border-yuzu-line bg-yuzu-night/60 p-4">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-xs uppercase tracking-[0.16em] text-yuzu-gold">Aging Snapshot</p>
                  <ReadinessBadge readiness={snapshot.readiness} />
                </div>
                <Progress className="[&_[data-slot=progress-indicator]]:bg-yuzu-gold" value={snapshot.progress} />
                <p className="text-sm text-yuzu-muted">{snapshot.ageMonths} months aging from the recorded start date.</p>
              </div>
            ) : null}
          </div>
        </div>

        {cigarDetails.length ? (
          <div className="grid gap-3 border border-yuzu-line bg-yuzu-night/60 p-4">
            <p className="text-xs uppercase tracking-[0.16em] text-yuzu-gold">Blend & Storage Details</p>
            <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {cigarDetails.map((detail) => (
                <div key={detail.label} className="grid gap-1">
                  <dt className="text-[0.68rem] uppercase tracking-[0.14em] text-yuzu-muted">{detail.label}</dt>
                  <dd className="text-sm text-yuzu-cream">{detail.value}</dd>
                </div>
              ))}
            </dl>
          </div>
        ) : null}

        <div className="grid gap-2 border border-yuzu-line bg-yuzu-night/60 p-4">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs uppercase tracking-[0.16em] text-yuzu-gold">Tasting Notes</p>
            <span className="text-xs text-yuzu-muted">
              {unitValue === null
                ? "No entry price snapshot"
                : `${formatHumidorValue(unitValue, item.estimatedValueCurrency)} each | ${formatHumidorValueSource(item.estimatedValueSource)}`}
            </span>
          </div>
          <p className="whitespace-pre-wrap text-sm leading-6 text-yuzu-muted">{item.tastingNotes || "No tasting notes recorded yet."}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function DetailTile({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="border border-yuzu-line bg-yuzu-night/60 p-4">
      <p className="text-xs uppercase tracking-[0.16em] text-yuzu-muted">{label}</p>
      <p className="mt-2 text-sm text-yuzu-cream">{value}</p>
    </div>
  );
}

function EmptyLiveState({ title, copy, action }: { title: string; copy: string; action: () => void }) {
  return (
    <Card className="luxury-card">
      <CardContent className="grid gap-4 p-6">
        <p className="font-heading text-3xl text-yuzu-cream">{title}</p>
        <p className="max-w-2xl text-sm leading-6 text-yuzu-muted">{copy}</p>
        <Button className="h-11 w-fit bg-yuzu-gold text-yuzu-ink hover:bg-yuzu-gold-light" onClick={action}>
          <Plus data-icon="inline-start" />
          Add Humidor Item
        </Button>
      </CardContent>
    </Card>
  );
}

function ReadinessBadge({ readiness }: { readiness: CigarReadiness }) {
  return (
    <Badge
      className={cn(
        "border-yuzu-line",
        readiness === "Ready Now" && "border-emerald-400/50 text-emerald-200",
        readiness === "Aging Well" && "border-yuzu-gold/50 text-yuzu-gold",
        readiness === "Too Young" && "border-sky-300/50 text-sky-200",
      )}
      variant="outline"
    >
      {readiness}
    </Badge>
  );
}

function buildHumidorFormFromSuggestion(suggestion: CigarImageSuggestion): HumidorForm {
  const detailNotes = formatCigarDetailsForNotes(suggestion.details);

  return {
    name: suggestion.name || "",
    brand: suggestion.brand || "",
    line: suggestion.line || "",
    vitola: suggestion.vitola || "",
    wrapper: suggestion.wrapper || "",
    origin: suggestion.origin || "",
    strength: suggestion.strength || "",
    quantity: String(suggestion.quantity ?? 1),
    purchaseDate: suggestion.purchaseDate || "",
    agingStartDate: suggestion.agingStartDate || "",
    reorderReminder: suggestion.reorderReminder || "",
    humidorLocation: suggestion.humidorLocation || "",
    tray: suggestion.tray || "",
    rating: suggestion.rating === null || suggestion.rating === undefined ? "" : String(suggestion.rating),
    estimatedValue: formatHumidorValueInput(suggestion.estimatedValue ?? parseHumidorValue(suggestion.details?.msrp)),
    estimatedValueCurrency: suggestion.estimatedValueCurrency || "USD",
    estimatedValueSource: suggestion.estimatedValueSource || "ai_identification_msrp",
    tastingNotes: [suggestion.tastingNotes || "", detailNotes].filter(Boolean).join("\n\n"),
  };
}

function buildHumidorFormFromInput(item: HumidorItemInput): HumidorForm {
  return {
    name: item.name || "",
    brand: item.brand || "",
    line: item.line || "",
    vitola: item.vitola || "",
    wrapper: item.wrapper || "",
    origin: item.origin || "",
    strength: item.strength || "",
    quantity: String(item.quantity ?? 1),
    purchaseDate: item.purchaseDate || "",
    agingStartDate: item.agingStartDate || "",
    reorderReminder: item.reorderReminder || "",
    humidorLocation: item.humidorLocation || "",
    tray: item.tray || "",
    rating: item.rating === null || item.rating === undefined ? "" : String(item.rating),
    estimatedValue: formatHumidorValueInput(item.estimatedValue),
    estimatedValueCurrency: item.estimatedValueCurrency || "USD",
    estimatedValueSource: item.estimatedValueSource || humidorEntryPriceSnapshotSource,
    tastingNotes: item.tastingNotes || "",
  };
}

function getCigarDetailRows(details: CigarImageSuggestion["details"] | undefined) {
  if (!details) {
    return [];
  }

  return [
    { label: "Manufacturer", value: details.manufacturer },
    { label: "Country", value: details.country },
    { label: "Region", value: details.region },
    { label: "Factory", value: details.factory },
    { label: "Size", value: details.size },
    { label: "Length", value: details.length },
    { label: "Ring gauge", value: details.ringGauge },
    { label: "Shape", value: details.shape },
    { label: "Wrapper", value: details.wrapper },
    { label: "Binder", value: details.binder },
    { label: "Filler", value: details.filler },
    { label: "Blend", value: details.blend },
    { label: "Flavor profile", value: details.flavorProfile.join(", ") },
    { label: "Body", value: details.body },
    { label: "Finish", value: details.finish },
    { label: "MSRP", value: details.msrp },
    { label: "Release status", value: details.releaseStatus },
    { label: "Packaging", value: details.packaging },
    { label: "Source summary", value: details.sourceSummary },
    { label: "Image observations", value: details.imageObservations.join("; ") },
  ].filter((detail) => detail.value.trim());
}

function formatCigarDetailsForNotes(details: CigarImageSuggestion["details"] | undefined) {
  const rows = getCigarDetailRows(details);
  if (!rows.length) {
    return "";
  }

  return ["AI pulled cigar details:", ...rows.map((detail) => `- ${detail.label}: ${detail.value}`)].join("\n");
}

function readImageFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("load", () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
        return;
      }

      reject(new Error("Image file did not produce a data URL."));
    });
    reader.addEventListener("error", () => reject(reader.error || new Error("Image file could not be read.")));
    reader.readAsDataURL(file);
  });
}

function parseImageDataUrl(dataUrl: string) {
  const match = dataUrl.match(/^data:(image\/[a-z0-9.+-]+);base64,([A-Za-z0-9+/=]+)$/i);

  if (!match) {
    return null;
  }

  return {
    mimeType: match[1],
    imageBase64: match[2],
  };
}

function buildHumidorPayload(form: HumidorForm, cigarImage: HumidorCigarImage | null = null, isMember = false): HumidorItemInput {
  const estimatedValue = parseHumidorValue(form.estimatedValue);
  const estimatedValueSource = (form.estimatedValueSource || "").trim();
  const estimatedValueCurrency = form.estimatedValueCurrency.trim().toUpperCase();
  const payload: HumidorItemInput = {
    name: form.name.trim(),
    brand: form.brand.trim(),
    line: form.line.trim(),
    vitola: form.vitola.trim(),
    wrapper: form.wrapper.trim(),
    origin: form.origin.trim(),
    strength: form.strength.trim(),
    quantity: Math.max(1, Math.round(Number(form.quantity) || 1)),
    purchaseDate: form.purchaseDate || null,
    agingStartDate: form.agingStartDate || null,
    reorderReminder: form.reorderReminder || null,
    humidorLocation: form.humidorLocation.trim(),
    tray: form.tray.trim(),
    rating: form.rating.trim() ? Math.max(0, Math.min(100, Math.round(Number(form.rating) || 0))) : null,
    estimatedValue,
    estimatedValueCurrency: estimatedValue === null ? "" : estimatedValueCurrency || "USD",
    estimatedValueSource: estimatedValue === null && !estimatedValueSource ? humidorEntryPriceSnapshotSource : estimatedValueSource || "member_estimate",
    cigarImage,
    tastingNotes: form.tastingNotes.trim(),
    source: "member_humidor",
  };

  if (payload.estimatedValue !== null && payload.estimatedValueSource === "ai_identification_msrp") {
    return payload;
  }

  if (payload.estimatedValue !== null && payload.estimatedValueSource === "member_estimate") {
    return payload;
  }

  return applyHumidorEntryPriceSnapshot(payload, isMember);
}

function buildHumidorImageAttachment(
  payload: { imageBase64: string; mimeType: string; fileName: string } | null,
  dataUrl: string,
): HumidorCigarImage | null {
  if (!payload || !dataUrl) {
    return null;
  }

  return {
    dataUrl,
    mimeType: payload.mimeType,
    fileName: payload.fileName,
    bytes: getBase64ByteLength(payload.imageBase64),
    source: "member_upload",
  };
}

function getBase64ByteLength(value: string) {
  const normalized = value.replace(/\s+/g, "");
  const padding = normalized.endsWith("==") ? 2 : normalized.endsWith("=") ? 1 : 0;
  return Math.max(0, Math.floor((normalized.length * 3) / 4) - padding);
}

function parseHumidorValue(value: string | number | null | undefined) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  if (typeof value === "number") {
    return Number.isFinite(value) && value >= 0 ? Math.round(value * 100) / 100 : null;
  }

  const match = value.replace(/,/g, "").match(/\d+(?:\.\d{1,2})?/);
  if (!match) {
    return null;
  }

  const parsed = Number(match[0]);
  return Number.isFinite(parsed) && parsed >= 0 ? Math.round(parsed * 100) / 100 : null;
}

function formatHumidorValueInput(value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return "";
  }

  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}

function getAgingSnapshotForItem(item: HumidorItem, now: Date) {
  const agingStartDate = item.agingStartDate || item.purchaseDate;

  if (!agingStartDate) {
    return null;
  }

  return withAgingSnapshot({ agingStartDate }, now);
}

function formatItemDetails(item: HumidorItem) {
  return [item.brand, item.line, item.vitola].filter(Boolean).join(" / ");
}

function calculateCollectionValue(items: HumidorItem[]) {
  const total = items.reduce((sum, item) => {
    const value = getHumidorItemValue(item);
    return value === null ? sum : sum + value;
  }, 0);

  return items.some((item) => getHumidorUnitValue(item) !== null) ? Math.round(total * 100) / 100 : null;
}

function getHumidorItemValue(item: HumidorItem) {
  const unitValue = getHumidorUnitValue(item);

  if (unitValue === null) {
    return null;
  }

  return Math.round(unitValue * Math.max(1, item.quantity) * 100) / 100;
}

function getHumidorUnitValue(item: HumidorItem) {
  return typeof item.estimatedValue === "number" && Number.isFinite(item.estimatedValue) ? item.estimatedValue : null;
}

function formatHumidorValue(value: number | null | undefined, currency = "USD") {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return "Not set";
  }

  try {
    return new Intl.NumberFormat("en-US", {
      currency: currency || "USD",
      maximumFractionDigits: 2,
      style: "currency",
    }).format(value);
  } catch {
    return `$${value.toFixed(2)}`;
  }
}

function formatHumidorValueSource(value: string | null | undefined) {
  const source = value || "";

  if (source === humidorEntryPriceSnapshotSource) {
    return "entry price snapshot";
  }

  if (source === "ai_identification_msrp") {
    return "AI MSRP reference";
  }

  if (source === "demo_entry_price_snapshot") {
    return "demo entry snapshot";
  }

  if (source === "demo_reference_estimate") {
    return "demo reference";
  }

  if (source === "member_estimate") {
    return "member estimate";
  }

  return source ? source.replace(/_/g, " ") : "price source not set";
}

function formatDate(value: string | null | undefined) {
  if (!value) {
    return "Not set";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

function formatPersistence(value: string) {
  return value ? value.replace(/_/g, " ") : "Not reported";
}
