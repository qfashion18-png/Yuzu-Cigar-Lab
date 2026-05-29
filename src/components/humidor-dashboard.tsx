"use client";

import Link from "@/components/static-link";
import NextImage from "next/image";
import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent, type ReactNode } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Bell,
  Bot,
  Box,
  Camera,
  CheckCircle2,
  Clock,
  Crown,
  DollarSign,
  Droplets,
  FileSpreadsheet,
  Flame,
  Image as ImageIcon,
  LoaderCircle,
  LockKeyhole,
  LogOut,
  MapPin,
  Package,
  Plus,
  RefreshCw,
  Search,
  Settings,
  Share2,
  ShieldCheck,
  Thermometer,
  Trash2,
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
  addHumidorDevice,
  applyHumidorDeviceDiscovery,
  defaultHumidorDeviceForm,
  discoverAvailableHumidorDevice,
  getConnectedHumidorDeviceReading,
  getHumidorDeviceClimateAlerts,
  humidorDeviceTypeLabels,
  normalizeHumidorDevices,
  type HumidorDeviceInput,
  type HumidorSensorDevice,
} from "@/lib/humidor-devices";
import {
  applyHumidorEntryPriceSnapshot,
  humidorEntryPriceSnapshotSource,
  resolveHumidorEntryPriceSnapshot,
  type HumidorEntryPriceSnapshot,
} from "@/lib/humidor-entry-price";
import {
  agingStartPresetOptions,
  getTotalAgeSnapshot,
  resolveAgingStartPresetDate,
  withAgingSnapshot,
  type AgingSnapshot,
  type AgingStartPreset,
  type CigarReadiness,
} from "@/lib/humidor-aging";
import { demoHumidorItems } from "@/lib/humidor-demo";
import {
  defaultHumidorTableSort,
  formatHumidorTableSortValue,
  humidorTableSortOptions,
  parseHumidorTableSortValue,
  sortHumidorItems,
  toggleHumidorTableSort,
  type HumidorTableColumnSortKey,
  type HumidorTableSort,
} from "@/lib/humidor-table-sort";
import {
  createHumidorItem,
  createSmokeLog,
  deleteHumidorItem,
  updateHumidorItem,
  fetchHumidorDashboardBootstrap,
  fetchHumidorSmokeLogs,
  getLiveApiErrorMessage,
  identifyCigarFromImage,
  shareHumidorItem,
  type HumidorAlertPreferences,
  type HumidorPushSubscription,
  updateHumidorAlertPreferences,
  type CigarImageIdentifyResponse,
  type CigarImageSuggestion,
  enrichHumidorItem,
  type HumidorCigarImage,
  type HumidorEnrichmentField,
  type HumidorItemEnrichmentResponse,
  type HumidorLocationProfile,
  type HumidorItem,
  type HumidorItemInput,
  type HumidorItemUpdateInput,
  type HumidorSmokeLog,
  type HumidorSmokeLogInput,
} from "@/lib/live-api";
import { formatHumidorTastingNote } from "@/lib/humidor-tasting-notes";
import { cn } from "@/lib/utils";

type SectionId = "overview" | "tools" | "locations" | "smokes" | "cigars" | "aging" | "alerts" | "settings";
type IconComponent = typeof Box;

type HumidorProfileLocationKind = "humidor" | "other";

type HumidorProfileLocation = {
  name: string;
  kind: HumidorProfileLocationKind;
  trays: string[];
};

type HumidorStorageLocationOption = {
  key: string;
  label: string;
  humidorLocation: string;
  tray: string;
};

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
  productionDate: string;
  reorderReminder: string;
  humidorLocation: string;
  tray: string;
  rating: string;
  estimatedValue: string;
  estimatedValueCurrency: string;
  estimatedValueSource: string;
  tastingNotes: string;
};

type SmokeLogForm = {
  humidorItemId: string;
  cigarName: string;
  smokedAt: string;
  rating: string;
  drinkPairing: string;
  notes: string;
  durationMinutes: string;
};

type LiveHumidorState = {
  loading: boolean;
  items: HumidorItem[];
  smokeLogs: HumidorSmokeLog[];
  persistence: string;
  smokePersistence: string;
  error: string;
};

type AgingItem = {
  item: HumidorItem;
  snapshot: AgingSnapshot;
};

type PendingHumidorEnrichmentApproval = {
  enrichment: HumidorItemEnrichmentResponse["enrichment"];
  item: HumidorItem;
  previewItem: HumidorItem;
};

const navItems: Array<{ id: SectionId; label: string; icon: IconComponent }> = [
  { id: "overview", label: "Overview", icon: Box },
  { id: "tools", label: "Add Cigars", icon: Plus },
  { id: "locations", label: "Add Locations", icon: MapPin },
  { id: "smokes", label: "Log a Smoke", icon: Flame },
  { id: "cigars", label: "My Cigars", icon: Package },
  { id: "aging", label: "Aging", icon: Clock },
  { id: "alerts", label: "Alerts", icon: Bell },
  { id: "settings", label: "Settings", icon: Settings },
];

function resolveHumidorDeepLinkSection(value: string | null): SectionId | null {
  const normalized = value?.replace(/^#/, "").trim().toLowerCase();

  return navItems.some((item) => item.id === normalized) ? (normalized as SectionId) : null;
}

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
  productionDate: "",
  reorderReminder: "",
  humidorLocation: "",
  tray: "",
  rating: "",
  estimatedValue: "",
  estimatedValueCurrency: "USD",
  estimatedValueSource: humidorEntryPriceSnapshotSource,
  tastingNotes: "",
};

const defaultHumidorLocationProfile: HumidorLocationProfile = {
  humidorName: "",
  defaultLocation: "",
  locations: [],
};

const defaultHumidorAlerts: HumidorAlertPreferences = {
  pushEnabled: false,
  reorderRemindersEnabled: true,
  climateAlertsEnabled: false,
  pushSubscription: null,
  pairedDevices: [],
  humidorProfile: defaultHumidorLocationProfile,
};

function normalizeHumidorProfileTextList(value: unknown): string[] {
  const rawValues = Array.isArray(value)
    ? value
    : typeof value === "string" && value.trim()
      ? value.split(/\r?\n|,/)
      : [];
  const values: string[] = [];
  const seen = new Set<string>();

  for (const rawValue of rawValues) {
    const text = String(rawValue ?? "").trim();
    const key = text.toLowerCase();

    if (!text || seen.has(key)) {
      continue;
    }

    seen.add(key);
    values.push(text);
  }

  return values;
}

function normalizeHumidorProfileLocationKind(value: unknown): HumidorProfileLocationKind {
  return String(value ?? "").trim().toLowerCase() === "humidor" ? "humidor" : "other";
}

function normalizeHumidorProfileLocation(value: unknown): HumidorProfileLocation | null {
  if (typeof value === "string") {
    const name = value.trim();
    return name ? { name, kind: "other", trays: [] } : null;
  }

  if (!value || typeof value !== "object") {
    return null;
  }

  const raw = value as Record<string, unknown>;
  const name = String(raw.name ?? raw.location ?? raw.label ?? "").trim();
  if (!name) {
    return null;
  }

  const kind = normalizeHumidorProfileLocationKind(raw.kind ?? raw.type ?? raw.locationType);
  const trays = kind === "humidor" ? normalizeHumidorProfileTextList(raw.trays ?? raw.trayNames ?? raw.trayOptions) : [];

  return { name, kind, trays };
}

function normalizeHumidorProfileLocations(value: unknown): HumidorProfileLocation[] {
  const rawLocations = Array.isArray(value)
    ? value
    : typeof value === "string" && value.trim()
      ? value.split(/\r?\n|,/)
      : [];
  const locations: HumidorProfileLocation[] = [];
  const locationsByKey = new Map<string, HumidorProfileLocation>();

  for (const rawLocation of rawLocations) {
    const location = normalizeHumidorProfileLocation(rawLocation);
    if (!location) {
      continue;
    }

    const key = location.name.toLowerCase();
    const existing = locationsByKey.get(key);

    if (!existing) {
      locationsByKey.set(key, location);
      locations.push(location);
      continue;
    }

    if (location.kind === "humidor") {
      existing.kind = "humidor";
      existing.trays = normalizeHumidorProfileTextList([...existing.trays, ...location.trays]);
    }
  }

  return locations.map((location) => ({
    ...location,
    trays: location.kind === "humidor" ? normalizeHumidorProfileTextList(location.trays) : [],
  }));
}

function getPrimaryHumidorProfileLocationName(locations: HumidorProfileLocation[]) {
  for (const location of locations) {
    const name = location.name.trim();
    if (name) {
      return name;
    }
  }

  return "";
}

function normalizeHumidorLocationProfile(profile: Partial<HumidorLocationProfile> | null | undefined): HumidorLocationProfile {
  const locations = normalizeHumidorProfileLocations(profile?.locations);

  return {
    humidorName: profile?.humidorName?.trim() ?? "",
    defaultLocation: getPrimaryHumidorProfileLocationName(locations) || profile?.defaultLocation?.trim() || "",
    locations,
  };
}

function applyDefaultHumidorLocationToForm(form: HumidorForm, profile: HumidorLocationProfile, previousDefaultLocation = ""): HumidorForm {
  const defaultLocation = profile.defaultLocation.trim();
  const currentLocation = form.humidorLocation.trim();

  if (!defaultLocation || (currentLocation && currentLocation !== previousDefaultLocation.trim())) {
    return form;
  }

  return {
    ...form,
    humidorLocation: defaultLocation,
  };
}

function applyDefaultHumidorLocationToDeviceForm(form: HumidorDeviceInput, profile: HumidorLocationProfile, previousDefaultLocation = ""): HumidorDeviceInput {
  const defaultLocation = profile.defaultLocation.trim();
  const currentLocation = form.location.trim();

  if (!defaultLocation || (currentLocation && currentLocation !== previousDefaultLocation.trim())) {
    return form;
  }

  return {
    ...form,
    location: defaultLocation,
  };
}

function buildHumidorStorageOptionKey(humidorLocation: string, tray = "") {
  return `${humidorLocation.trim().toLowerCase()}\u001f${tray.trim().toLowerCase()}`;
}

function getHumidorStorageLocationOptions(profile: HumidorLocationProfile, items: HumidorItem[]) {
  const options: HumidorStorageLocationOption[] = [];
  const seen = new Set<string>();

  function addOption(rawLocation: string, rawTray = "") {
    const humidorLocation = rawLocation.trim();
    const tray = rawTray.trim();
    const key = buildHumidorStorageOptionKey(humidorLocation, tray);

    if (!humidorLocation || seen.has(key)) {
      return;
    }

    seen.add(key);
    options.push({
      key,
      label: tray ? `${humidorLocation} / ${tray}` : humidorLocation,
      humidorLocation,
      tray,
    });
  }

  addOption(profile.defaultLocation);

  for (const location of profile.locations) {
    if (location.kind === "humidor" && location.trays.length) {
      for (const tray of location.trays) {
        addOption(location.name, tray);
      }
      continue;
    }

    addOption(location.name);
  }

  for (const item of items) {
    addOption(item.humidorLocation, item.tray);
  }

  return options;
}

const initialLiveState: LiveHumidorState = {
  loading: false,
  items: [],
  smokeLogs: [],
  persistence: "",
  smokePersistence: "",
  error: "",
};

const blankSmokeLogForm: SmokeLogForm = {
  humidorItemId: "",
  cigarName: "",
  smokedAt: "",
  rating: "",
  drinkPairing: "",
  notes: "",
  durationMinutes: "",
};

const fullMembershipHumidorToolsCopy =
  "Kisha, Sensei, and Daimyo memberships include AI cigar adder and bulk import. Box Access Pass keeps single-item humidor adds.";
const aiCigarAdderGateStatus = "AI cigar adder is available for Kisha, Sensei, and Daimyo members.";

export function HumidorDashboard() {
  const auth = useBackupAuth();
  const [activeSection, setActiveSection] = useState<SectionId>("overview");
  const [liveState, setLiveState] = useState(initialLiveState);
  const [itemForm, setItemForm] = useState(blankHumidorForm);
  const [itemAgingStartPreset, setItemAgingStartPreset] = useState<AgingStartPreset>("exact");
  const [formStatus, setFormStatus] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [cigarFlowIntent, setCigarFlowIntent] = useState(false);
  const [aiAdderInput, setAiAdderInput] = useState("");
  const [aiImagePayload, setAiImagePayload] = useState<{ imageBase64: string; mimeType: string; fileName: string } | null>(null);
  const [aiImagePreview, setAiImagePreview] = useState("");
  const [aiIdentification, setAiIdentification] = useState<CigarImageIdentifyResponse | null>(null);
  const [aiIdentifiedForm, setAiIdentifiedForm] = useState<HumidorForm | null>(null);
  const [aiAgingStartPreset, setAiAgingStartPreset] = useState<AgingStartPreset>("exact");
  const [aiAdderStatus, setAiAdderStatus] = useState("");
  const [isAiAdderSending, setIsAiAdderSending] = useState(false);
  const [isAiConfirmSaving, setIsAiConfirmSaving] = useState(false);
  const [returnToSmokeLogAfterAi, setReturnToSmokeLogAfterAi] = useState(false);
  const [smokeLogForm, setSmokeLogForm] = useState(() => buildSmokeLogFormForItem(null));
  const [smokeLogStatus, setSmokeLogStatus] = useState("");
  const [isSavingSmokeLog, setIsSavingSmokeLog] = useState(false);
  const [bulkImportText, setBulkImportText] = useState("");
  const [bulkImportStatus, setBulkImportStatus] = useState("");
  const [isBulkImporting, setIsBulkImporting] = useState(false);
  const [selectedHumidorItem, setSelectedHumidorItem] = useState<HumidorItem | null>(null);
  const [pendingHumidorDetailScrollItemId, setPendingHumidorDetailScrollItemId] = useState("");
  const humidorDetailCardRef = useRef<HTMLDivElement | null>(null);
  const [humidorInventoryActionStatus, setHumidorInventoryActionStatus] = useState("");
  const [updatingHumidorItemId, setUpdatingHumidorItemId] = useState("");
  const [humidorItemUpdateStatus, setHumidorItemUpdateStatus] = useState("");
  const [humidorItemUpdateStatusItemId, setHumidorItemUpdateStatusItemId] = useState("");
  const [enrichingHumidorItemId, setEnrichingHumidorItemId] = useState("");
  const [humidorEnrichmentStatus, setHumidorEnrichmentStatus] = useState("");
  const [pendingHumidorEnrichmentApproval, setPendingHumidorEnrichmentApproval] = useState<PendingHumidorEnrichmentApproval | null>(null);
  const [humidorDevices, setHumidorDevices] = useState<HumidorSensorDevice[]>([]);
  const [humidorDeviceForm, setHumidorDeviceForm] = useState<HumidorDeviceInput>({ ...defaultHumidorDeviceForm });
  const [humidorDeviceStatus, setHumidorDeviceStatus] = useState("");
  const [isSearchingHumidorDevices, setIsSearchingHumidorDevices] = useState(false);
  const [humidorLocationProfile, setHumidorLocationProfile] = useState<HumidorLocationProfile>(defaultHumidorLocationProfile);
  const [newHumidorLocationDraft, setNewHumidorLocationDraft] = useState("");
  const [newHumidorLocationKind, setNewHumidorLocationKind] = useState<HumidorProfileLocationKind>("humidor");
  const [newHumidorTrayDraft, setNewHumidorTrayDraft] = useState("");
  const [humidorLocationProfileStatus, setHumidorLocationProfileStatus] = useState("");
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

  const applyHumidorAlertPreferences = useCallback((preferences: HumidorAlertPreferences) => {
    const pairedDevices = normalizeHumidorDevices(preferences.pairedDevices);
    const profile = normalizeHumidorLocationProfile(preferences.humidorProfile);
    setHumidorAlerts({
      pushEnabled: !!preferences.pushEnabled,
      reorderRemindersEnabled: !!preferences.reorderRemindersEnabled,
      climateAlertsEnabled: !!preferences.climateAlertsEnabled,
      pushSubscription: preferences.pushSubscription || null,
      pairedDevices,
      humidorProfile: profile,
    });
    setHumidorDevices(pairedDevices);
    setHumidorLocationProfile(profile);
    setNewHumidorLocationDraft("");
    setNewHumidorTrayDraft("");
    setItemForm((current) => applyDefaultHumidorLocationToForm(current, profile));
    setHumidorDeviceForm((current) => applyDefaultHumidorLocationToDeviceForm(current, profile));
    setAiIdentifiedForm((current) => (current ? applyDefaultHumidorLocationToForm(current, profile) : current));
  }, []);

  useEffect(() => {
    let cancelled = false;

    if (!auth.isReady || !auth.isSignedIn || !auth.isMember || auth.authSource !== "cognito") {
      window.queueMicrotask(() => {
        if (cancelled) {
          return;
        }

        setLiveState(initialLiveState);
        setHumidorAlerts(defaultHumidorAlerts);
        setHumidorDevices([]);
        setHumidorLocationProfile(defaultHumidorLocationProfile);
        setNewHumidorLocationDraft("");
        setNewHumidorTrayDraft("");
        setHumidorLocationProfileStatus("");
        setSmokeLogForm(buildSmokeLogFormForItem(null));
        setSmokeLogStatus("");
        setReturnToSmokeLogAfterAi(false);
        setSelectedHumidorItem(null);
        setHumidorInventoryActionStatus("");
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
          smokeLogs: bootstrap.smokes.logs,
          persistence: bootstrap.items.persistence,
          smokePersistence: bootstrap.smokes.persistence,
          error: "",
        });

        if (bootstrap.alerts) {
          applyHumidorAlertPreferences(bootstrap.alerts.preferences);
        } else {
          setHumidorAlerts(defaultHumidorAlerts);
          setHumidorDevices([]);
          setHumidorLocationProfile(defaultHumidorLocationProfile);
          setNewHumidorLocationDraft("");
          setNewHumidorTrayDraft("");
          setHumidorLocationProfileStatus("");
        }
        setHumidorAlertsStatus(bootstrap.alertsError || "");
        setSmokeLogStatus(bootstrap.smokesError || "");
      } catch (error) {
        if (!isMounted) {
          return;
        }

        const errorMessage = getLiveApiErrorMessage(error);
        setHumidorAlerts(defaultHumidorAlerts);
        setHumidorDevices([]);
        setHumidorLocationProfile(defaultHumidorLocationProfile);
        setNewHumidorLocationDraft("");
        setNewHumidorTrayDraft("");
        setHumidorLocationProfileStatus(errorMessage);
        setHumidorAlertsStatus(errorMessage);
        setSmokeLogStatus(errorMessage);
        setLiveState({
          loading: false,
          items: [],
          smokeLogs: [],
          persistence: "",
          smokePersistence: "",
          error: errorMessage,
        });
      }
    })();

    return () => {
      isMounted = false;
      cancelled = true;
    };
  }, [applyHumidorAlertPreferences, auth]);

  const items = isAnonymousDemo ? demoHumidorItems : liveState.items;
  const smokeLogs = isAnonymousDemo ? [] : liveState.smokeLogs;
  const storageLocationOptions = useMemo(
    () => getHumidorStorageLocationOptions(humidorLocationProfile, items),
    [humidorLocationProfile, items],
  );
  const connectedHumidorDevice = useMemo(() => getConnectedHumidorDeviceReading(humidorDevices), [humidorDevices]);
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
  const liveApiConfigured = Boolean(process.env.NEXT_PUBLIC_YCC_API_BASE_URL);

  function handleSelectHumidorItem(item: HumidorItem) {
    setSelectedHumidorItem(item);
    setPendingHumidorDetailScrollItemId(item.id);
    setHumidorInventoryActionStatus("");
  }

  function updateSmokeLogForm(field: keyof SmokeLogForm, value: string) {
    setSmokeLogForm((current) => ({
      ...current,
      [field]: value,
    }));
    setSmokeLogStatus("");
  }

  function handleSmokeLogItemSelection(itemId: string) {
    const selectedItem = items.find((item) => item.id === itemId) || null;
    setSmokeLogForm((current) => ({
      ...buildSmokeLogFormForItem(selectedItem),
      smokedAt: current.smokedAt || getCurrentSmokeDateTimeLocalValue(),
      rating: selectedItem?.rating === null || selectedItem?.rating === undefined ? current.rating : String(selectedItem.rating),
      drinkPairing: current.drinkPairing,
      notes: current.notes,
      durationMinutes: current.durationMinutes,
    }));
    setSmokeLogStatus("");
  }

  function handleStartAiCigarAdderForSmoke() {
    setReturnToSmokeLogAfterAi(true);
    setAiAdderStatus("Take or upload the cigar photo, then confirm it to return here and rate the smoke.");
    setActiveSection("tools");
  }

  async function handleAddSmokeLog(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!smokeLogForm.humidorItemId && !smokeLogForm.cigarName.trim()) {
      setSmokeLogStatus("Choose a saved cigar or add the cigar with the AI Cigar Adder first.");
      return;
    }

    if (!smokeLogForm.rating.trim()) {
      setSmokeLogStatus("Add a smoke rating before saving the log.");
      return;
    }

    if (isAnonymousDemo || auth.authSource !== "cognito") {
      setSmokeLogStatus("Sign in with Cognito before saving smoke logs.");
      return;
    }

    setIsSavingSmokeLog(true);
    setSmokeLogStatus("");

    try {
      const headers = await auth.createApiHeaders();
      const response = await createSmokeLog(buildSmokeLogPayload(smokeLogForm), headers);
      setLiveState((current) => ({
        ...current,
        loading: false,
        smokeLogs: [response.log, ...current.smokeLogs.filter((log) => log.id !== response.log.id)],
        smokePersistence: response.persistence.status,
        error: "",
      }));
      setSmokeLogForm((current) => ({
        ...buildSmokeLogFormForItem(items.find((item) => item.id === current.humidorItemId) || null),
        drinkPairing: current.drinkPairing,
      }));
      setSmokeLogStatus(
        response.persistence.status === "stored"
          ? "Smoke logged with rating and drink pairing."
          : "The live API accepted this smoke log, but database persistence is not enabled.",
      );
    } catch (error) {
      setSmokeLogStatus(getLiveApiErrorMessage(error));
    } finally {
      setIsSavingSmokeLog(false);
    }
  }

  useEffect(() => {
    if (!pendingHumidorDetailScrollItemId || activeSection !== "cigars" || selectedHumidorItem?.id !== pendingHumidorDetailScrollItemId) {
      return;
    }

    const frame = window.requestAnimationFrame(() => {
      humidorDetailCardRef.current?.scrollIntoView({ block: "start", behavior: "smooth" });
      setPendingHumidorDetailScrollItemId("");
    });

    return () => window.cancelAnimationFrame(frame);
  }, [activeSection, pendingHumidorDetailScrollItemId, selectedHumidorItem?.id]);

  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    const requestedSection = resolveHumidorDeepLinkSection(searchParams.get("section") || window.location.hash);
    const hasCigarFlowIntent = searchParams.get("intent") === "cigar-flow";

    window.queueMicrotask(() => {
      if (hasCigarFlowIntent) {
        setCigarFlowIntent(true);
        setActiveSection("tools");
        return;
      }

      if (requestedSection) {
        setActiveSection(requestedSection);
      }
    });
  }, []);

  function updateForm(field: keyof HumidorForm, value: string) {
    setItemForm((current) => ({
      ...current,
      [field]: value,
    }));
    setFormStatus("");
  }

  function updateItemAgingStartPreset(value: string) {
    const preset = normalizeAgingStartPreset(value);
    setItemAgingStartPreset(preset);
    setFormStatus("");

    if (preset === "exact") {
      return;
    }

    setItemForm((current) => ({
      ...current,
      agingStartDate: resolveAgingStartPresetDate(preset),
    }));
  }

  function updateItemAgingStartDate(value: string) {
    setItemAgingStartPreset("exact");
    updateForm("agingStartDate", value);
  }

  function getNormalizedHumidorProfileLocations(locations = humidorLocationProfile.locations) {
    return normalizeHumidorProfileLocations(locations);
  }

  function buildHumidorProfileLocationInput() {
    const name = newHumidorLocationDraft.trim();

    if (!name) {
      return null;
    }

    return {
      name,
      kind: newHumidorLocationKind,
      trays: newHumidorLocationKind === "humidor" ? normalizeHumidorProfileTextList(newHumidorTrayDraft) : [],
    };
  }

  function handleAddHumidorProfileLocation() {
    const location = buildHumidorProfileLocationInput();

    if (!location) {
      setHumidorLocationProfileStatus("Enter a location before adding it.");
      return;
    }

    setHumidorLocationProfile((current) => {
      const nextLocations = normalizeHumidorProfileLocations([...current.locations, location]);

      return {
        ...current,
        defaultLocation: getPrimaryHumidorProfileLocationName(nextLocations),
        locations: nextLocations,
      };
    });
    setNewHumidorLocationDraft("");
    setNewHumidorTrayDraft("");
    setHumidorLocationProfileStatus("Location added. Save Locations to persist it.");
  }

  function handleEditHumidorProfileLocation(index: number, value: string) {
    setHumidorLocationProfile((current) => {
      const locations = current.locations.map((location, locationIndex) => (locationIndex === index ? { ...location, name: value } : location));

      return {
        ...current,
        defaultLocation: getPrimaryHumidorProfileLocationName(locations),
        locations,
      };
    });
    setHumidorLocationProfileStatus("");
  }

  function handleEditHumidorProfileLocationKind(index: number, value: string) {
    const kind = normalizeHumidorProfileLocationKind(value);
    setHumidorLocationProfile((current) => ({
      ...current,
      locations: current.locations.map((location, locationIndex) =>
        locationIndex === index
          ? {
              ...location,
              kind,
              trays: kind === "humidor" ? location.trays : [],
            }
          : location,
      ),
    }));
    setHumidorLocationProfileStatus("");
  }

  function handleEditHumidorProfileLocationTrays(index: number, value: string) {
    setHumidorLocationProfile((current) => ({
      ...current,
      locations: current.locations.map((location, locationIndex) =>
        locationIndex === index
          ? {
              ...location,
              trays: location.kind === "humidor" ? normalizeHumidorProfileTextList(value) : [],
            }
          : location,
      ),
    }));
    setHumidorLocationProfileStatus("");
  }

  function handleRemoveHumidorProfileLocation(index: number) {
    setHumidorLocationProfile((current) => {
      const locations = current.locations.filter((_, locationIndex) => locationIndex !== index);

      return {
        ...current,
        defaultLocation: getPrimaryHumidorProfileLocationName(locations),
        locations,
      };
    });
    setHumidorLocationProfileStatus("Location removed. Save Locations to persist it.");
  }

  function updateDeviceForm(field: keyof HumidorDeviceInput, value: string) {
    setHumidorDeviceForm((current) => {
      if (field === "deviceType") {
        const deviceType = value === "HYGROMETER_THERMOMETER" ? "HYGROMETER_THERMOMETER" : "HUMIDIFIER";
        return {
          ...current,
          deviceType,
          connection: deviceType === "HUMIDIFIER" ? "WiFi" : "Bluetooth",
          name: "",
          identifier: "",
          humidity: "",
          temperature: "",
        };
      }

      if (field === "connection") {
        return {
          ...current,
          connection: value === "WiFi" ? "WiFi" : "Bluetooth",
          name: "",
          identifier: "",
          humidity: "",
          temperature: "",
        };
      }

      return {
        ...current,
        [field]: value,
      };
    });
    setHumidorDeviceStatus("");
  }

  async function handleSearchHumidorDevice() {
    setIsSearchingHumidorDevices(true);
    setHumidorDeviceStatus("");

    try {
      const discovery = await discoverAvailableHumidorDevice(humidorDeviceForm);
      setHumidorDeviceForm((current) =>
        getDeviceFormWithDefaultHumidorLocation(applyHumidorDeviceDiscovery(current, discovery)),
      );
      setHumidorDeviceStatus(`${discovery.name} found. Device name, ID, humidity, and temperature were pulled from the device.`);
    } catch (error) {
      setHumidorDeviceStatus(error instanceof Error ? error.message : "No available humidor device was selected.");
    } finally {
      setIsSearchingHumidorDevices(false);
    }
  }

  function getFormWithDefaultHumidorLocation(form: HumidorForm, profile = humidorLocationProfile, previousDefaultLocation = ""): HumidorForm {
    return applyDefaultHumidorLocationToForm(form, profile, previousDefaultLocation);
  }

  function getDeviceFormWithDefaultHumidorLocation(form: HumidorDeviceInput, profile = humidorLocationProfile, previousDefaultLocation = ""): HumidorDeviceInput {
    return applyDefaultHumidorLocationToDeviceForm(form, profile, previousDefaultLocation);
  }

  function normalizeHumidorLocationProfileForm(profile: HumidorLocationProfile | null | undefined): HumidorLocationProfile {
    return normalizeHumidorLocationProfile(profile);
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

  function updateAiAgingStartPreset(value: string) {
    const preset = normalizeAgingStartPreset(value);
    setAiAgingStartPreset(preset);
    setAiAdderStatus("");

    if (preset === "exact") {
      return;
    }

    setAiIdentifiedForm((current) =>
      current
        ? {
            ...current,
            agingStartDate: resolveAgingStartPresetDate(preset),
          }
        : current,
    );
  }

  function updateAiAgingStartDate(value: string) {
    setAiAgingStartPreset("exact");
    updateAiForm("agingStartDate", value);
  }

  async function handlePairDevice(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (isAnonymousDemo || auth.authSource !== "cognito") {
      setHumidorDeviceStatus("Sign in with Cognito before pairing devices for phone alerts.");
      return;
    }

    if (!humidorDeviceForm.name.trim() || !humidorDeviceForm.identifier.trim() || !humidorDeviceForm.humidity.trim() || !humidorDeviceForm.temperature.trim()) {
      setHumidorDeviceStatus("Search available devices before pairing so the device name, ID, humidity, and temperature are pulled from the device.");
      return;
    }

    const normalizedDeviceForm = getDeviceFormWithDefaultHumidorLocation(humidorDeviceForm);
    const result = addHumidorDevice(humidorDevices, normalizedDeviceForm, formatDeviceSyncTime(new Date()));

    if (result.status === "missing_name") {
      setHumidorDeviceStatus("Search available devices and enter a humidor location before pairing.");
      return;
    }

    if (result.status === "missing_identifier") {
      setHumidorDeviceStatus("Search available devices to pull the device ID before pairing.");
      return;
    }

    if (result.status === "invalid_climate") {
      setHumidorDeviceStatus("Search available devices again to pull a valid humidity and temperature reading.");
      return;
    }

    if (result.status !== "created") {
      setHumidorDeviceStatus("The device could not be paired. Review the device details and try again.");
      return;
    }

    if (!result.device || !result.reading) {
      setHumidorDeviceStatus("The device could not be paired. Check the device details and try again.");
      return;
    }

    let pushEnabled = humidorAlerts.pushEnabled;
    let pushSubscription = humidorAlerts.pushSubscription;
    let phoneStatus = pushEnabled ? "Climate push alerts are enabled for this phone." : "";

    if (!pushEnabled && supportsPushNotifications() && getVapidApplicationServerKey()) {
      setIsRequestingPushPermission(true);
      try {
        const permission = await Notification.requestPermission();
        if (permission === "granted") {
          const subscription = await getOrCreatePushSubscription();
          const sanitizedSubscription = sanitizePushSubscription(subscription);

          if (sanitizedSubscription) {
            pushEnabled = true;
            pushSubscription = sanitizedSubscription;
            phoneStatus = "Climate push alerts are enabled for this phone.";
          }
        }
      } catch {
        phoneStatus = "";
      } finally {
        setIsRequestingPushPermission(false);
      }
    }

    if (!phoneStatus) {
      phoneStatus = "Enable push alerts on this phone to receive climate notifications.";
    }

    const saved = await saveHumidorAlertPreferences({
      ...humidorAlerts,
      climateAlertsEnabled: true,
      humidorProfile: humidorLocationProfile,
      pairedDevices: result.devices,
      pushEnabled,
      pushSubscription,
    });

    setHumidorDevices(result.devices);
    setHumidorDeviceForm(getDeviceFormWithDefaultHumidorLocation({ ...defaultHumidorDeviceForm }));
    setHumidorDeviceStatus(
      saved
        ? `${humidorDeviceTypeLabels[result.device.deviceType]} paired. ${result.reading.note} ${phoneStatus}`
        : `${humidorDeviceTypeLabels[result.device.deviceType]} paired for this session, but alert routing could not be saved. ${phoneStatus}`,
    );
  }

  async function handleAiImageChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    setAiIdentification(null);
    setAiIdentifiedForm(null);
    setAiAgingStartPreset("exact");
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
      setAiIdentifiedForm(getFormWithDefaultHumidorLocation(buildHumidorFormFromSuggestion(response.suggestion)));
      setAiAgingStartPreset("exact");
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
        ...current,
        loading: false,
        items: [response.item, ...current.items.filter((item) => item.id !== response.item.id)],
        persistence: response.persistence.status,
        error: "",
      }));
      setAiIdentification(null);
      setAiIdentifiedForm(null);
      setAiAgingStartPreset("exact");
      setAiImagePayload(null);
      setAiImagePreview("");
      setAiAdderInput("");
      setAiAdderStatus(
        response.persistence.status === "stored"
          ? "Confirmed and added to your live humidor."
          : "Confirmed. The live API accepted this item, but database persistence is not enabled.",
      );
      if (returnToSmokeLogAfterAi) {
        setSmokeLogForm(buildSmokeLogFormForItem(response.item));
        setSmokeLogStatus("Cigar added. Add your smoke rating and drink pairing to finish the log.");
        setReturnToSmokeLogAfterAi(false);
        setActiveSection("smokes");
      } else {
        setActiveSection("cigars");
      }
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
      const response = await createHumidorItem(buildHumidorPayload(getFormWithDefaultHumidorLocation(itemForm), null, auth.isMember), headers);

      setLiveState((current) => ({
        ...current,
        loading: false,
        items: [response.item, ...current.items.filter((item) => item.id !== response.item.id)],
        persistence: response.persistence.status,
        error: "",
      }));
      setItemForm(getFormWithDefaultHumidorLocation(blankHumidorForm));
      setItemAgingStartPreset("exact");
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

  async function handleEnrichHumidorItem(item: HumidorItem, approved: boolean) {
    const gaps = getHumidorEnrichmentGaps(item);

    if (!gaps.length) {
      setHumidorEnrichmentStatus("This cigar already has the core info, image, and MSRP fields.");
      return null;
    }

    if (isAnonymousDemo || auth.authSource !== "cognito") {
      setHumidorEnrichmentStatus("Sign in with Cognito before asking the humidor agent to update saved cigars.");
      return null;
    }

    setEnrichingHumidorItemId(item.id);
    setHumidorEnrichmentStatus("");

    try {
      const headers = await auth.createApiHeaders();
      const response = await enrichHumidorItem(
        item.id,
        {
          approved,
          fields: gaps.map((gap) => gap.key),
        },
        headers,
      );

      return { gaps, response };
    } catch (error) {
      setHumidorEnrichmentStatus(getLiveApiErrorMessage(error));
      return null;
    } finally {
      setEnrichingHumidorItemId("");
    }
  }

  async function handleRequestHumidorEnrichment(item: HumidorItem) {
    const previewRequest = { approved: false };
    const result = await handleEnrichHumidorItem(item, previewRequest.approved);

    if (!result) {
      return;
    }

    const { gaps, response } = result;

    if (shouldOpenHumidorEnrichmentApproval(response)) {
      setPendingHumidorEnrichmentApproval({
        enrichment: response.enrichment,
        item,
        previewItem: response.previewItem ?? response.item,
      });
      setHumidorEnrichmentStatus(
        response.enrichment.status === "needs_review"
          ? "Review the humidor agent notes before anything is saved."
          : "Review the humidor agent updates before they are saved.",
      );
      return;
    }

    setHumidorEnrichmentStatus(
      response.enrichment.status === "complete"
        ? "This cigar already has the core info, image, and MSRP fields."
        : "Humidor agent reviewed this cigar, but the missing fields still need member review.",
    );

    if (response.enrichment.status === "updated") {
      setLiveState((current) => ({
        ...current,
        loading: false,
        items: current.items.map((currentItem) => (currentItem.id === response.item.id ? response.item : currentItem)),
        persistence: response.persistence.status,
        error: "",
      }));
      setSelectedHumidorItem(response.item);
      setHumidorEnrichmentStatus(`Humidor agent updated ${formatHumidorEnrichmentGapLabels(gaps)}.`);
    }
  }

  async function handleApproveHumidorEnrichment() {
    if (!pendingHumidorEnrichmentApproval) {
      return;
    }

    const previewChanges = getHumidorEnrichmentPreviewChanges(
      pendingHumidorEnrichmentApproval.item,
      pendingHumidorEnrichmentApproval.previewItem,
      pendingHumidorEnrichmentApproval.enrichment.updatedFields,
    );
    if (!previewChanges.length) {
      setPendingHumidorEnrichmentApproval(null);
      setHumidorEnrichmentStatus("Humidor agent did not find any saveable field changes.");
      return;
    }

    const approvalRequest = { approved: true };
    const result = await handleEnrichHumidorItem(pendingHumidorEnrichmentApproval.item, approvalRequest.approved);

    if (!result) {
      return;
    }

    const { gaps, response } = result;

    if (response.enrichment.status === "updated") {
      setLiveState((current) => ({
        ...current,
        loading: false,
        items: current.items.map((currentItem) => (currentItem.id === response.item.id ? response.item : currentItem)),
        persistence: response.persistence.status,
        error: "",
      }));
      setSelectedHumidorItem(response.item);
      setPendingHumidorEnrichmentApproval(null);
      setHumidorEnrichmentStatus(`Humidor agent updated ${formatHumidorEnrichmentGapLabels(gaps)}.`);
      return;
    }

    setPendingHumidorEnrichmentApproval(null);
    setHumidorEnrichmentStatus(
      response.enrichment.status === "complete"
        ? "This cigar already has the core info, image, and MSRP fields."
        : "Humidor agent reviewed this cigar, but the missing fields still need member review.",
    );
  }

  function handleCancelHumidorEnrichmentApproval() {
    setPendingHumidorEnrichmentApproval(null);
    setHumidorEnrichmentStatus("Humidor agent updates were not saved.");
  }

  async function handleUpdateHumidorItem(item: HumidorItem, input: HumidorItemUpdateInput) {
    const updatePayload: HumidorItemUpdateInput = {};
    const hasHumidorLocationUpdate = input.humidorLocation !== undefined;
    const hasAgingStartDateUpdate = input.agingStartDate !== undefined;
    const hasTrayUpdate = input.tray !== undefined;
    const humidorLocation = input.humidorLocation?.trim() ?? "";
    const agingStartDate = input.agingStartDate?.trim() ?? "";
    const tray = input.tray?.trim() ?? "";
    setHumidorItemUpdateStatusItemId(item.id);

    if (hasHumidorLocationUpdate && !humidorLocation) {
      setHumidorItemUpdateStatus("Enter a humidor location before updating this cigar.");
      return;
    }

    if (hasAgingStartDateUpdate && !agingStartDate) {
      setHumidorItemUpdateStatus("Choose an aging start date before updating this cigar.");
      return;
    }

    if (!hasHumidorLocationUpdate && !hasAgingStartDateUpdate && !hasTrayUpdate) {
      setHumidorItemUpdateStatus("Choose a saved cigar field to update.");
      return;
    }

    if (isAnonymousDemo || auth.authSource !== "cognito") {
      setHumidorItemUpdateStatus("Sign in with Cognito before updating saved cigars.");
      return;
    }

    if (hasHumidorLocationUpdate) {
      updatePayload.humidorLocation = humidorLocation;
    }

    if (hasTrayUpdate) {
      updatePayload.tray = tray;
    }

    if (hasAgingStartDateUpdate) {
      updatePayload.agingStartDate = agingStartDate;
    }

    setUpdatingHumidorItemId(item.id);
    setHumidorItemUpdateStatus("");

    try {
      const headers = await auth.createApiHeaders();
      const response = await updateHumidorItem(item.id, updatePayload, headers);

      setLiveState((current) => ({
        ...current,
        loading: false,
        items: current.items.map((currentItem) => (currentItem.id === response.item.id ? response.item : currentItem)),
        persistence: response.persistence.status,
        error: "",
      }));
      setSelectedHumidorItem(response.item);
      const updatedFieldLabel = [
        hasHumidorLocationUpdate ? "Humidor location" : "",
        hasTrayUpdate ? "Tray" : "",
        hasAgingStartDateUpdate ? "Aging start date" : "",
      ].filter(Boolean).join(" and ");
      setHumidorItemUpdateStatus(
        response.persistence.status === "stored"
          ? `${updatedFieldLabel} updated.`
          : "The live API accepted this update, but database persistence is not enabled.",
      );
    } catch (error) {
      setHumidorItemUpdateStatus(getLiveApiErrorMessage(error));
    } finally {
      setUpdatingHumidorItemId("");
    }
  }

  async function handleShareHumidorItem(item: HumidorItem) {
    setHumidorItemUpdateStatusItemId(item.id);

    if (item.quantity <= 0) {
      setHumidorInventoryActionStatus("This cigar is already out of inventory.");
      return;
    }

    if (isAnonymousDemo || auth.authSource !== "cognito") {
      setHumidorInventoryActionStatus("Sign in with Cognito before updating saved cigars.");
      return;
    }

    if (
      typeof window !== "undefined" &&
      !window.confirm(`Log one ${item.name} as shared and remove it from your inventory?`)
    ) {
      return;
    }

    setUpdatingHumidorItemId(item.id);
    setHumidorItemUpdateStatus("");
    setHumidorInventoryActionStatus("");

    try {
      const headers = await auth.createApiHeaders();
      const response = await shareHumidorItem(item.id, { sharedQuantity: 1 }, headers);
      const updatedItem = response.item;

      setLiveState((current) => ({
        ...current,
        loading: false,
        items:
          response.item.quantity > 0
            ? current.items.map((currentItem) => (currentItem.id === updatedItem.id ? updatedItem : currentItem))
            : current.items.filter((currentItem) => currentItem.id !== item.id),
        smokeLogs: response.log ? [response.log, ...current.smokeLogs.filter((log) => log.id !== response.log?.id)] : current.smokeLogs,
        persistence: response.persistence.status,
        smokePersistence: response.tracking?.status || current.smokePersistence,
        error: "",
      }));
      setSelectedHumidorItem(response.item.quantity > 0 ? updatedItem : null);
      setHumidorInventoryActionStatus(
        response.item.quantity > 0
          ? `Shared 1 ${item.name}. ${response.item.quantity} left in inventory.`
          : `Shared the last ${item.name}. It was removed from inventory.`,
      );
    } catch (error) {
      setHumidorInventoryActionStatus(getLiveApiErrorMessage(error));
    } finally {
      setUpdatingHumidorItemId("");
    }
  }

  async function handleDeleteHumidorItem(item: HumidorItem) {
    setHumidorItemUpdateStatusItemId(item.id);

    if (isAnonymousDemo || auth.authSource !== "cognito") {
      setHumidorInventoryActionStatus("Sign in with Cognito before updating saved cigars.");
      return;
    }

    if (
      typeof window !== "undefined" &&
      !window.confirm(`Delete ${item.name} from your humidor inventory?`)
    ) {
      return;
    }

    setUpdatingHumidorItemId(item.id);
    setHumidorItemUpdateStatus("");
    setHumidorInventoryActionStatus("");

    try {
      const headers = await auth.createApiHeaders();
      const response = await deleteHumidorItem(item.id, headers);

      setLiveState((current) => ({
        ...current,
        loading: false,
        items: current.items.filter((currentItem) => currentItem.id !== item.id),
        persistence: response.persistence.status,
        error: "",
      }));
      setSelectedHumidorItem(null);
      setHumidorInventoryActionStatus(`Deleted ${item.name} from inventory.`);
    } catch (error) {
      setHumidorInventoryActionStatus(getLiveApiErrorMessage(error));
    } finally {
      setUpdatingHumidorItemId("");
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
        const payload = buildHumidorPayload(getFormWithDefaultHumidorLocation(buildHumidorFormFromInput(item)), null, auth.isMember);
        const response = await createHumidorItem({ ...payload, source: item.source ?? payload.source }, headers);
        importedItems.push(response.item);
        persistence = response.persistence.status;
      }

      const importedIds = new Set(importedItems.map((item) => item.id));

      setLiveState((current) => ({
        ...current,
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
          pairedDevices: nextPreferences.pairedDevices,
          humidorProfile: normalizeHumidorLocationProfileForm(nextPreferences.humidorProfile),
        },
        headers,
      );

      applyHumidorAlertPreferences(response.preferences);

      setHumidorAlertsStatus(
        response.persistence === "stored"
          ? "Humidor alert preferences are saved for your account."
          : "Your alert preferences were accepted, but persistence is still pending.",
      );
      return true;
    } catch (error) {
      setHumidorAlertsStatus(getLiveApiErrorMessage(error));
      return false;
    } finally {
      setIsHumidorAlertsSaving(false);
    }
  }

  async function handleSaveHumidorLocationProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (isAnonymousDemo || auth.authSource !== "cognito") {
      setHumidorLocationProfileStatus("Sign in with Cognito before saving humidor location info.");
      return;
    }

    const hasNewHumidorLocationDraft = Boolean(newHumidorLocationDraft.trim());
    const hasNewHumidorTrayDraft = Boolean(newHumidorTrayDraft.trim());

    if (!hasNewHumidorLocationDraft && hasNewHumidorTrayDraft) {
      setHumidorLocationProfileStatus("Enter a location name before saving tray names.");
      return;
    }

    const pendingLocation = buildHumidorProfileLocationInput();
    const previousProfile = normalizeHumidorLocationProfileForm(humidorAlerts.humidorProfile);
    const nextLocations = normalizeHumidorProfileLocations([...humidorLocationProfile.locations, pendingLocation].filter(Boolean));
    const nextProfile = normalizeHumidorLocationProfileForm({
      ...humidorLocationProfile,
      defaultLocation: getPrimaryHumidorProfileLocationName(nextLocations),
      locations: nextLocations,
    });

    if (!nextProfile.locations.length) {
      setHumidorLocationProfileStatus("Add at least one humidor location before saving.");
      return;
    }

    const profilePreferences = {
      ...humidorAlerts,
      humidorProfile: nextProfile,
    };

    setHumidorLocationProfile(nextProfile);
    setNewHumidorLocationDraft("");
    setNewHumidorTrayDraft("");

    const saved = await saveHumidorAlertPreferences(profilePreferences);
    setItemForm((current) => getFormWithDefaultHumidorLocation(current, nextProfile, previousProfile.defaultLocation));
    setHumidorDeviceForm((current) => getDeviceFormWithDefaultHumidorLocation(current, nextProfile, previousProfile.defaultLocation));
    setAiIdentifiedForm((current) => (current ? getFormWithDefaultHumidorLocation(current, nextProfile, previousProfile.defaultLocation) : current));
    setHumidorLocationProfileStatus(
      saved
        ? "Locations saved."
        : "Locations are ready in this session, but persistence is still pending.",
    );
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
          smokeLogs: bootstrap.smokes.logs,
          persistence: bootstrap.items.persistence,
          smokePersistence: bootstrap.smokes.persistence,
          error: "",
        });
        if (bootstrap.alerts) {
          applyHumidorAlertPreferences(bootstrap.alerts.preferences);
        } else {
          setHumidorAlerts(defaultHumidorAlerts);
          setHumidorDevices([]);
          setHumidorLocationProfile(defaultHumidorLocationProfile);
          setNewHumidorLocationDraft("");
          setNewHumidorTrayDraft("");
        }
        setHumidorAlertsStatus(bootstrap.alertsError || "");
        setSmokeLogStatus(bootstrap.smokesError || "");
      } catch (error) {
        const errorMessage = getLiveApiErrorMessage(error);
        setHumidorAlerts(defaultHumidorAlerts);
        setHumidorDevices([]);
        setHumidorLocationProfile(defaultHumidorLocationProfile);
        setNewHumidorLocationDraft("");
        setNewHumidorTrayDraft("");
        setHumidorLocationProfileStatus(errorMessage);
        setHumidorAlertsStatus(errorMessage);
        setSmokeLogStatus(errorMessage);
        setLiveState({
          loading: false,
          items: [],
          smokeLogs: [],
          persistence: "",
          smokePersistence: "",
          error: errorMessage,
        });
      }
    })();
  }

  function refreshSmokeLogs() {
    if (auth.authSource !== "cognito") {
      return;
    }

    setSmokeLogStatus("Refreshing smoke logs.");
    void (async () => {
      try {
        const headers = await auth.createApiHeaders();
        const response = await fetchHumidorSmokeLogs(headers);
        setLiveState((current) => ({
          ...current,
          smokeLogs: response.logs,
          smokePersistence: response.persistence,
          error: "",
        }));
        setSmokeLogStatus("");
      } catch (error) {
        setSmokeLogStatus(getLiveApiErrorMessage(error));
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
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
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
            label="Humidity"
            value={connectedHumidorDevice ? `${formatDeviceClimateValue(connectedHumidorDevice.humidity)}% RH` : "No device"}
            note={connectedHumidorDevice ? `${connectedHumidorDevice.name} at ${connectedHumidorDevice.location}` : "Pair a device in Settings"}
            icon={Droplets}
          />
          <StatCard
            label="Temperature"
            value={connectedHumidorDevice ? `${formatDeviceClimateValue(connectedHumidorDevice.temperature)} F` : "No device"}
            note={connectedHumidorDevice ? `Last synced ${connectedHumidorDevice.lastSyncedAt}` : "Pair a device in Settings"}
            icon={Thermometer}
          />
          <StatCard
            label="Aging Records"
            value={agingItems.length}
            note={isAnonymousDemo ? `${readyCount} demo cigars marked ready` : `${readyCount} marked ready now`}
            icon={Clock}
          />
          <StatCard
            label="Smoke Logs"
            value={smokeLogs.length}
            note={isAnonymousDemo ? "Sign in to save rated smoke sessions" : "Recent rated smokes and drink pairings"}
            icon={Flame}
          />
          <StatCard
            label="Reorder Dates"
            value={reorderCount}
            note={isAnonymousDemo ? "Sample reminders for preview" : "Pulled from live humidor items"}
            icon={Bell}
          />
        </div>

        {cigarFlowIntent ? (
          <Card className="luxury-card">
            <CardContent className="grid gap-4 p-5 md:grid-cols-[1fr_auto] md:items-center">
              <div>
                <p className="fine-label">Cigar Flow smoke note prep</p>
                <h2 className="mt-3 font-heading text-3xl text-yuzu-cream">Build the note from your humidor record.</h2>
                <p className="mt-3 max-w-2xl text-sm leading-6 text-yuzu-muted">
                  Shareable notes start in your live humidor: save the cigar, capture rating and tasting notes, then ask Concierge to review the context before publication.
                </p>
              </div>
              <Button className="h-11 bg-yuzu-gold px-5 text-yuzu-ink hover:bg-yuzu-gold-light" type="button" onClick={() => setActiveSection("tools")}>
                <Plus data-icon="inline-start" />
                Add Smoke Note
              </Button>
            </CardContent>
          </Card>
        ) : null}

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
    if (activeSection === "tools") {
      return renderTools();
    }

    if (activeSection === "locations") {
      return renderLocations();
    }

    if (activeSection === "smokes") {
      return renderSmokeLogs();
    }

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
                  handleSelectHumidorItem(item);
                  setActiveSection("cigars");
                }}
              />
            </CardContent>
          </Card>
        ) : (
          <EmptyLiveState
            title="No live humidor items returned"
            copy="Open Add Cigars to send your first item through the Yuzu API with your Cognito token."
            action={() => setActiveSection("tools")}
          />
        )}

      </div>
    );
  }

  function renderTools() {
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
                  <Button
                    className="h-10 border-yuzu-line text-yuzu-cream"
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setItemForm(getFormWithDefaultHumidorLocation(aiIdentifiedForm));
                      setItemAgingStartPreset("exact");
                    }}
                  >
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
                    <div className="grid gap-2 sm:grid-cols-[minmax(0,0.9fr)_minmax(0,1fr)]">
                      <select
                        aria-label="AI aging start option"
                        className="h-11 w-full rounded-sm border border-yuzu-line bg-yuzu-night px-3 text-sm text-yuzu-cream outline-none focus:border-yuzu-gold"
                        value={aiAgingStartPreset}
                        onChange={(event: ChangeEvent<HTMLSelectElement>) => updateAiAgingStartPreset(event.currentTarget.value)}
                      >
                        {agingStartPresetOptions.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                      <Input
                        aria-label="AI aging start exact date"
                        disabled={aiAgingStartPreset !== "exact"}
                        type="date"
                        value={aiIdentifiedForm.agingStartDate}
                        onChange={(event: ChangeEvent<HTMLInputElement>) => updateAiAgingStartDate(event.target.value)}
                      />
                    </div>
                  </Field>
                  <Field label="Box / production date">
                    <Input type="date" value={aiIdentifiedForm.productionDate} onChange={(event: ChangeEvent<HTMLInputElement>) => updateAiForm("productionDate", event.target.value)} />
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
                  <div className="grid gap-2 sm:grid-cols-[minmax(0,0.9fr)_minmax(0,1fr)]">
                    <select
                      aria-label="Manual aging start option"
                      className="h-11 w-full rounded-sm border border-yuzu-line bg-yuzu-night px-3 text-sm text-yuzu-cream outline-none focus:border-yuzu-gold"
                      value={itemAgingStartPreset}
                      onChange={(event: ChangeEvent<HTMLSelectElement>) => updateItemAgingStartPreset(event.currentTarget.value)}
                    >
                      {agingStartPresetOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                    <Input
                      aria-label="Manual aging start exact date"
                      disabled={itemAgingStartPreset !== "exact"}
                      type="date"
                      value={itemForm.agingStartDate}
                      onChange={(event: ChangeEvent<HTMLInputElement>) => updateItemAgingStartDate(event.target.value)}
                    />
                  </div>
                </Field>
                <Field label="Box / production date">
                  <Input type="date" value={itemForm.productionDate} onChange={(event: ChangeEvent<HTMLInputElement>) => updateForm("productionDate", event.target.value)} />
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

  function renderLocations() {
    if (isAnonymousDemo) {
      return (
        <Card className="luxury-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-3 text-sm uppercase tracking-[0.16em] text-yuzu-gold">
              <MapPin />
              Add Locations
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div className="border border-yuzu-line bg-yuzu-night/60 p-4 text-sm leading-6 text-yuzu-muted">
              Sign in to manage saved locations and trays for new cigar rows and paired devices.
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
            <MapPin />
            Add Locations
          </CardTitle>
        </CardHeader>
        <CardContent>{renderHumidorLocationProfile()}</CardContent>
      </Card>
    );
  }

  function renderSmokeLogs() {
    const selectedSmokeItem = items.find((item) => item.id === smokeLogForm.humidorItemId) || null;

    return (
      <div className="grid gap-5">
        <Card className="luxury-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-3 text-sm uppercase tracking-[0.16em] text-yuzu-gold">
              <Flame />
              Log a Smoke
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-5">
            <form className="grid gap-4" onSubmit={handleAddSmokeLog}>
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Saved humidor cigar">
                  <select
                    aria-label="Saved humidor cigar"
                    className="h-11 w-full rounded-sm border border-yuzu-line bg-yuzu-night px-3 text-sm text-yuzu-cream outline-none focus:border-yuzu-gold disabled:cursor-not-allowed disabled:opacity-60"
                    disabled={isAnonymousDemo || !items.length}
                    value={smokeLogForm.humidorItemId}
                    onChange={(event: ChangeEvent<HTMLSelectElement>) => handleSmokeLogItemSelection(event.currentTarget.value)}
                  >
                    <option value="">{items.length ? "Choose from My Cigars" : "No saved cigars yet"}</option>
                    {items.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Cigar name">
                  <Input
                    value={smokeLogForm.cigarName}
                    onChange={(event: ChangeEvent<HTMLInputElement>) => updateSmokeLogForm("cigarName", event.currentTarget.value)}
                    placeholder={selectedSmokeItem ? selectedSmokeItem.name : "Use AI Cigar Adder for a new smoke"}
                    required={!smokeLogForm.humidorItemId}
                  />
                </Field>
                <Field label="Smoked at">
                  <Input type="datetime-local" value={smokeLogForm.smokedAt} onChange={(event: ChangeEvent<HTMLInputElement>) => updateSmokeLogForm("smokedAt", event.currentTarget.value)} />
                </Field>
                <Field label="Smoke rating">
                  <Input max={100} min={0} type="number" value={smokeLogForm.rating} onChange={(event: ChangeEvent<HTMLInputElement>) => updateSmokeLogForm("rating", event.currentTarget.value)} required />
                </Field>
                <Field label="Drink pairing">
                  <Input value={smokeLogForm.drinkPairing} onChange={(event: ChangeEvent<HTMLInputElement>) => updateSmokeLogForm("drinkPairing", event.currentTarget.value)} placeholder="Bourbon, espresso, rum, coffee, sparkling water" />
                </Field>
                <Field label="Duration minutes">
                  <Input min={1} type="number" value={smokeLogForm.durationMinutes} onChange={(event: ChangeEvent<HTMLInputElement>) => updateSmokeLogForm("durationMinutes", event.currentTarget.value)} />
                </Field>
              </div>
              <Field label="Smoke notes">
                <Textarea aria-label="Smoke notes" value={smokeLogForm.notes} onChange={(event: ChangeEvent<HTMLTextAreaElement>) => updateSmokeLogForm("notes", event.currentTarget.value)} />
              </Field>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center">
                  <Button className="h-11 bg-yuzu-gold text-yuzu-ink hover:bg-yuzu-gold-light" disabled={isSavingSmokeLog || isAnonymousDemo} type="submit">
                    {isSavingSmokeLog ? (
                      <LoaderCircle className="animate-spin" data-icon="inline-start" />
                    ) : isAnonymousDemo ? (
                      <LockKeyhole data-icon="inline-start" />
                    ) : (
                      <Flame data-icon="inline-start" />
                    )}
                    {isAnonymousDemo ? "Sign In To Log" : isSavingSmokeLog ? "Logging Smoke" : "Log Smoke"}
                  </Button>
                  <Button className="h-11 border-yuzu-line text-yuzu-cream" disabled={isAnonymousDemo} type="button" variant="outline" onClick={handleStartAiCigarAdderForSmoke}>
                    <Camera data-icon="inline-start" />
                    Use AI Cigar Adder
                  </Button>
                </div>
                <p className="min-h-5 text-sm text-yuzu-gold" aria-live="polite">
                  {smokeLogStatus || (isAnonymousDemo ? "Sign in to rate smokes and save drink pairings." : "")}
                </p>
              </div>
            </form>
          </CardContent>
        </Card>

        <Card className="luxury-card">
          <CardHeader>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <CardTitle className="flex items-center gap-3 text-sm uppercase tracking-[0.16em] text-yuzu-gold">
                <Clock />
                Recent Smoke Logs
              </CardTitle>
              <Button className="h-10 w-fit border-yuzu-line text-yuzu-cream" disabled={isAnonymousDemo} type="button" variant="outline" onClick={refreshSmokeLogs}>
                <RefreshCw data-icon="inline-start" />
                Refresh Logs
              </Button>
            </div>
          </CardHeader>
          <CardContent className="grid gap-3">
            {smokeLogs.length ? (
              smokeLogs.map((log) => <SmokeLogRow key={log.id} log={log} />)
            ) : (
              <p className="text-sm leading-6 text-yuzu-muted">
                {isAnonymousDemo
                  ? "Smoke logs are saved to member accounts after sign-in."
                  : "No smoke logs yet. Choose a cigar, add a rating, and save the first session."}
              </p>
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
              <Package />
              {isAnonymousDemo ? "Demo Cigars" : "My Cigars"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {items.length ? (
              <HumidorTable items={items} agingNow={agingNow} selectedItemId={selectedHumidorItem?.id ?? null} onSelectItem={handleSelectHumidorItem} />
            ) : (
              <p className="text-sm text-yuzu-muted">
                {isAnonymousDemo ? "No demo humidor records are configured." : "No live humidor records have been returned yet."}
              </p>
            )}
            <p className="mt-3 min-h-5 text-sm text-yuzu-gold" aria-live="polite">
              {humidorInventoryActionStatus}
            </p>
          </CardContent>
        </Card>

        {selectedHumidorItem ? (
          <div ref={humidorDetailCardRef} className="scroll-mt-24" data-humidor-detail-card="top">
            <HumidorDetailCard
              key={selectedHumidorItem.id}
              item={selectedHumidorItem}
              agingNow={agingNow}
              enrichmentStatus={humidorEnrichmentStatus}
              itemUpdateStatus={humidorItemUpdateStatusItemId === selectedHumidorItem.id ? humidorItemUpdateStatus : ""}
              isDemo={isAnonymousDemo}
              isEnriching={enrichingHumidorItemId === selectedHumidorItem.id}
              isUpdating={updatingHumidorItemId === selectedHumidorItem.id}
              storageLocationOptions={storageLocationOptions}
              onClose={() => {
                setSelectedHumidorItem(null);
                setPendingHumidorDetailScrollItemId("");
              }}
              onDelete={isAnonymousDemo ? undefined : handleDeleteHumidorItem}
              onEnrich={isAnonymousDemo ? undefined : handleRequestHumidorEnrichment}
              onShare={isAnonymousDemo ? undefined : handleShareHumidorItem}
              onUpdate={isAnonymousDemo ? undefined : handleUpdateHumidorItem}
            />
          </div>
        ) : null}
      </div>
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
              <AgingTrackerItem
                key={`${item.id}-${getAgingStartDateForItem(item) ?? ""}`}
                item={item}
                agingNow={agingNow}
                itemUpdateStatus={humidorItemUpdateStatusItemId === item.id ? humidorItemUpdateStatus : ""}
                isUpdating={updatingHumidorItemId === item.id}
                snapshot={snapshot}
                onUpdate={isAnonymousDemo ? undefined : handleUpdateHumidorItem}
              />
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
    const climateDeviceAlerts = getHumidorDeviceClimateAlerts(humidorDevices);
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
                  Save your preferences and enable push alerts to receive reorder reminder and climate notifications on your signed-in device.
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
            <div className="grid gap-3 border border-yuzu-gold/30 bg-yuzu-ink/50 p-4">
              <div className="grid gap-1">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-yuzu-gold">iPhone setup guide</p>
                <p className="text-sm leading-6 text-yuzu-muted">
                  iPhone push alerts require iOS 16.4 or later and the Yuzu web app saved to the Home Screen.
                </p>
              </div>
              <ol className="grid gap-2 text-sm leading-6 text-yuzu-muted sm:grid-cols-2">
                <li>
                  <span className="font-semibold text-yuzu-cream">1. Install Yuzu.</span> In Safari, open the Humidor, use Share, choose Add to Home Screen,
                  then confirm.
                </li>
                <li>
                  <span className="font-semibold text-yuzu-cream">2. Launch the app.</span> Open Yuzu from the Home Screen icon and sign in
                  before returning to Alerts.
                </li>
                <li>
                  <span className="font-semibold text-yuzu-cream">3. Enable alerts.</span> Tap Enable Push Alerts here and allow notifications
                  when iOS asks.
                </li>
                <li>
                  <span className="font-semibold text-yuzu-cream">4. Unblock permission.</span> If alerts were denied, open iOS{" "}
                  <span className="whitespace-nowrap">{"Settings > Notifications > Yuzu"}</span> and allow notifications.
                </li>
              </ol>
              <p className="text-xs leading-5 text-yuzu-amber">
                Safari tab alone cannot receive iPhone push alerts. Open Yuzu from the Home Screen before enabling alerts.
              </p>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <StatusTile label="Paired Devices" value={humidorDevices.length} note="Climate sources" />
            <StatusTile
              label="Climate Readings"
              value={climateDeviceAlerts.length ? `${climateDeviceAlerts.length} needs attention` : "In range"}
              note={humidorAlerts.climateAlertsEnabled ? "Climate alerts enabled" : "Climate alerts disabled"}
            />
            <StatusTile label="Phone Push" value={humidorAlerts.pushEnabled ? "Enabled" : "Disabled"} note={hasNotificationPermission ? "Permission granted" : "Permission pending"} />
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
            {climateDeviceAlerts.map((alert) => (
              <div key={alert.deviceId} className="flex flex-col gap-2 border border-yuzu-gold/40 bg-yuzu-gold/10 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-heading text-xl text-yuzu-cream">{alert.deviceName}</p>
                  <p className="text-sm text-yuzu-muted">{alert.message}</p>
                </div>
                <Badge className="border-yuzu-gold/50 text-yuzu-gold" variant="outline">
                  Climate alert
                </Badge>
              </div>
            ))}
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
                  : climateDeviceAlerts.length
                    ? "No live reorder reminders are due from your saved cigars."
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

    const hasPulledDeviceReading = Boolean(
      humidorDeviceForm.name.trim() &&
        humidorDeviceForm.identifier.trim() &&
        humidorDeviceForm.humidity.trim() &&
        humidorDeviceForm.temperature.trim(),
    );

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
          {renderHumidorLocationProfile()}
          <div className="grid gap-4 border border-yuzu-line bg-yuzu-night/60 p-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div className="grid gap-1">
                <p className="text-xs uppercase tracking-[0.16em] text-yuzu-gold">Device Settings</p>
                <p className="text-sm leading-6 text-yuzu-muted">
                  Pair a HUMIDIFIER or sensor after pulling its current climate reading from an available device.
                </p>
              </div>
              <Badge className="w-fit border-yuzu-line text-yuzu-muted" variant="outline">
                {humidorDevices.length} paired
              </Badge>
            </div>

            <form className="grid gap-4" onSubmit={handlePairDevice}>
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Device type">
                  <select
                    aria-label="Humidor device type"
                    className="h-11 w-full rounded-sm border border-yuzu-line bg-yuzu-night px-3 text-sm text-yuzu-cream outline-none focus:border-yuzu-gold"
                    value={humidorDeviceForm.deviceType ?? "HUMIDIFIER"}
                    onChange={(event: ChangeEvent<HTMLSelectElement>) => updateDeviceForm("deviceType", event.currentTarget.value)}
                  >
                    <option value="HUMIDIFIER">HUMIDIFIER</option>
                    <option value="HYGROMETER_THERMOMETER">Hygrometer thermometer</option>
                  </select>
                </Field>
                <Field label="Connection">
                  <select
                    aria-label="Humidor device connection"
                    className="h-11 w-full rounded-sm border border-yuzu-line bg-yuzu-night px-3 text-sm text-yuzu-cream outline-none focus:border-yuzu-gold"
                    value={humidorDeviceForm.connection}
                    onChange={(event: ChangeEvent<HTMLSelectElement>) => updateDeviceForm("connection", event.currentTarget.value)}
                  >
                    <option value="Bluetooth">Bluetooth</option>
                    <option value="WiFi">WiFi</option>
                  </select>
                </Field>
                <div className="grid gap-3 border border-yuzu-line/70 bg-yuzu-ink/35 p-3 md:col-span-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
                  <div className="grid gap-1">
                    <p className="text-sm font-semibold text-yuzu-cream">Available device search</p>
                    <p className="text-sm leading-6 text-yuzu-muted">
                      Device name, ID, humidity, and temperature are filled from the selected device.
                    </p>
                  </div>
                  <Button
                    aria-label="Search available humidor devices"
                    className="h-11 border-yuzu-line text-yuzu-cream"
                    disabled={isSearchingHumidorDevices}
                    type="button"
                    variant="outline"
                    onClick={handleSearchHumidorDevice}
                  >
                    {isSearchingHumidorDevices ? <LoaderCircle className="animate-spin" data-icon="inline-start" /> : <Search data-icon="inline-start" />}
                    {isSearchingHumidorDevices ? "Searching Devices" : "Search Available Devices"}
                  </Button>
                </div>
                <Field label="Device name">
                  <Input
                    aria-label="Discovered device name"
                    placeholder="Search available devices"
                    readOnly
                    value={humidorDeviceForm.name}
                  />
                </Field>
                <Field label="Humidor location">
                  <Input value={humidorDeviceForm.location} onChange={(event: ChangeEvent<HTMLInputElement>) => updateDeviceForm("location", event.currentTarget.value)} />
                </Field>
                <Field label="Device ID">
                  <Input
                    aria-label="Discovered device ID"
                    placeholder="Pulled from selected device"
                    readOnly
                    value={humidorDeviceForm.identifier}
                  />
                </Field>
                <Field label="Sync interval minutes">
                  <Input
                    min={5}
                    max={120}
                    type="number"
                    value={humidorDeviceForm.syncInterval}
                    onChange={(event: ChangeEvent<HTMLInputElement>) => updateDeviceForm("syncInterval", event.currentTarget.value)}
                  />
                </Field>
                <Field label="Current humidity percent">
                  <Input
                    aria-label="Discovered humidity percent"
                    min={1}
                    max={100}
                    placeholder="Pulled from device"
                    readOnly
                    type="number"
                    value={humidorDeviceForm.humidity}
                  />
                </Field>
                <Field label="Current temperature">
                  <Input
                    aria-label="Discovered temperature"
                    min={40}
                    max={95}
                    placeholder="Pulled from device"
                    readOnly
                    type="number"
                    value={humidorDeviceForm.temperature}
                  />
                </Field>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <Button className="h-11 bg-yuzu-gold text-yuzu-ink hover:bg-yuzu-gold-light" disabled={isHumidorAlertsSaving || isRequestingPushPermission || isSearchingHumidorDevices || !hasPulledDeviceReading} type="submit">
                  {isHumidorAlertsSaving || isRequestingPushPermission ? <LoaderCircle className="animate-spin" data-icon="inline-start" /> : <Plus data-icon="inline-start" />}
                  {humidorDeviceForm.deviceType === "HYGROMETER_THERMOMETER" ? "Pair Sensor" : "Pair HUMIDIFIER"}
                </Button>
                <p className="min-h-5 text-sm text-yuzu-gold" aria-live="polite">
                  {humidorDeviceStatus || (!hasPulledDeviceReading ? "Search available devices before pairing." : "")}
                </p>
              </div>
            </form>
          </div>

          <div className="grid gap-3 border border-yuzu-line bg-yuzu-night/60 p-4">
            <p className="text-xs uppercase tracking-[0.16em] text-yuzu-gold">Paired Devices</p>
            {humidorDevices.length ? (
              <div className="grid gap-3">
                {humidorDevices.map((device) => {
                  const deviceAlert = getHumidorDeviceClimateAlerts([device])[0];

                  return (
                    <div key={device.id} className="grid gap-3 border border-yuzu-line/70 bg-yuzu-ink/35 p-3 md:grid-cols-[1fr_auto] md:items-center">
                      <div className="grid gap-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-heading text-xl text-yuzu-cream">{device.name}</p>
                          <Badge className="border-yuzu-gold/50 text-yuzu-gold" variant="outline">
                            {humidorDeviceTypeLabels[device.deviceType]}
                          </Badge>
                          <Badge className="border-yuzu-line text-yuzu-muted" variant="outline">
                            {device.connection}
                          </Badge>
                          <Badge className={deviceAlert ? "border-yuzu-gold/50 text-yuzu-gold" : "border-emerald-400/50 text-emerald-200"} variant="outline">
                            {deviceAlert ? "Alert ready" : "In range"}
                          </Badge>
                        </div>
                        <p className="text-sm text-yuzu-muted">
                          {device.location} | {device.humidity}% RH | {device.temperature} F | every {device.syncIntervalMinutes} min
                        </p>
                        {deviceAlert ? <p className="text-sm text-yuzu-gold">{deviceAlert.message}</p> : null}
                      </div>
                      <div className="text-sm text-yuzu-muted md:text-right">
                        <p>{device.status}</p>
                        <p>{device.lastSyncedAt}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm leading-6 text-yuzu-muted">
                No paired devices yet. Pair your HUMIDIFIER here so climate alerts have a session reading to reference.
              </p>
            )}
          </div>
          <Button className="h-11 w-fit border-yuzu-line text-yuzu-cream" variant="outline" onClick={auth.signOut}>
            <LogOut data-icon="inline-start" />
            Sign Out
          </Button>
        </CardContent>
      </Card>
    );
  }

  function renderHumidorLocationProfile() {
    const savedLocations = getNormalizedHumidorProfileLocations();
    const hasNewHumidorLocationDraft = Boolean(newHumidorLocationDraft.trim());
    const hasNewHumidorTrayDraft = Boolean(newHumidorTrayDraft.trim());
    const pendingHumidorProfileLocation = buildHumidorProfileLocationInput();
    const hasIncompleteNewHumidorLocation = !hasNewHumidorLocationDraft && hasNewHumidorTrayDraft;
    const canAddHumidorProfileLocation = Boolean(pendingHumidorProfileLocation);
    const canSaveHumidorProfile = !hasIncompleteNewHumidorLocation && Boolean(savedLocations.length || hasNewHumidorLocationDraft);

    return (
      <div className="grid gap-4 border border-yuzu-line bg-yuzu-night/60 p-4">
        <form className="grid gap-4" onSubmit={handleSaveHumidorLocationProfile}>
          <div className="grid gap-4 border border-yuzu-line/70 bg-yuzu-ink/35 p-3 xl:grid-cols-[minmax(240px,0.7fr)_minmax(0,1.3fr)]">
            <div className="grid gap-3 border border-yuzu-line/60 bg-yuzu-night/55 p-3">
              <p className="text-xs uppercase tracking-[0.16em] text-yuzu-gold">Add a location</p>
              <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_170px] xl:grid-cols-1">
                <Field label="Location name">
                  <Input
                    aria-label="New humidor location"
                    className="h-11 rounded-sm border-yuzu-line bg-yuzu-night text-sm text-yuzu-cream"
                    value={newHumidorLocationDraft}
                    onChange={(event: ChangeEvent<HTMLInputElement>) => {
                      setNewHumidorLocationDraft(event.currentTarget.value);
                      setHumidorLocationProfileStatus("");
                    }}
                  />
                </Field>
                <Field label="Location type">
                  <select
                    aria-label="New humidor location type"
                    className="h-11 w-full rounded-sm border border-yuzu-line bg-yuzu-night px-3 text-sm text-yuzu-cream outline-none focus:border-yuzu-gold"
                    value={newHumidorLocationKind}
                    onChange={(event: ChangeEvent<HTMLSelectElement>) => {
                      const nextKind = normalizeHumidorProfileLocationKind(event.currentTarget.value);
                      setNewHumidorLocationKind(nextKind);
                      if (nextKind !== "humidor") {
                        setNewHumidorTrayDraft("");
                      }
                      setHumidorLocationProfileStatus("");
                    }}
                  >
                    <option value="humidor">Humidor</option>
                    <option value="other">Other</option>
                  </select>
                </Field>
                <Field label="Tray names">
                  <Input
                    aria-invalid={hasIncompleteNewHumidorLocation}
                    aria-label="New humidor tray names"
                    className="h-11 rounded-sm border-yuzu-line bg-yuzu-night text-sm text-yuzu-cream"
                    disabled={newHumidorLocationKind !== "humidor"}
                    placeholder="Top Tray, Bottom Tray"
                    value={newHumidorTrayDraft}
                    onChange={(event: ChangeEvent<HTMLInputElement>) => {
                      setNewHumidorTrayDraft(event.currentTarget.value);
                      setHumidorLocationProfileStatus("");
                    }}
                  />
                </Field>
                <Button
                  className="h-11 border-yuzu-line text-yuzu-cream sm:col-span-2 xl:col-span-1"
                  disabled={!canAddHumidorProfileLocation}
                  type="button"
                  variant="outline"
                  onClick={handleAddHumidorProfileLocation}
                >
                  <Plus data-icon="inline-start" />
                  Add Location
                </Button>
              </div>
              <p className="min-h-5 text-xs text-yuzu-gold" aria-live="polite">
                {hasIncompleteNewHumidorLocation ? "Enter a location name before saving tray names." : ""}
              </p>
            </div>

            <div className="grid gap-3">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-xs uppercase tracking-[0.16em] text-yuzu-gold">Saved Locations</p>
                <Badge className="w-fit border-yuzu-line text-yuzu-muted" variant="outline">
                  {savedLocations.length ? `${savedLocations.length} saved` : "None saved"}
                </Badge>
              </div>
              {humidorLocationProfile.locations.length ? (
                <div className="grid gap-2">
                  <div
                    aria-label="Location columns"
                    className="hidden gap-2 text-[0.68rem] uppercase tracking-[0.14em] text-yuzu-muted lg:grid lg:grid-cols-[minmax(0,1fr)_150px_minmax(0,1fr)_112px]"
                  >
                    <span>Location</span>
                    <span>Type</span>
                    <span>Tray names</span>
                    <span>Action</span>
                  </div>
                  {humidorLocationProfile.locations.map((location, index) => (
                    <div key={`saved-location-${index}`} className="grid gap-2 lg:grid-cols-[minmax(0,1fr)_150px_minmax(0,1fr)_112px] lg:items-center">
                      <Input
                        aria-label={`Edit saved location ${index + 1}`}
                        className="h-11 rounded-sm border-yuzu-line bg-yuzu-night text-sm text-yuzu-cream"
                        value={location.name}
                        onChange={(event: ChangeEvent<HTMLInputElement>) => handleEditHumidorProfileLocation(index, event.currentTarget.value)}
                      />
                      <select
                        aria-label={`Edit type for saved location ${index + 1}`}
                        className="h-11 w-full rounded-sm border border-yuzu-line bg-yuzu-night px-3 text-sm text-yuzu-cream outline-none focus:border-yuzu-gold"
                        value={location.kind}
                        onChange={(event: ChangeEvent<HTMLSelectElement>) => handleEditHumidorProfileLocationKind(index, event.currentTarget.value)}
                      >
                        <option value="humidor">Humidor</option>
                        <option value="other">Other</option>
                      </select>
                      <Input
                        aria-label={`Edit trays for saved location ${index + 1}`}
                        className="h-11 rounded-sm border-yuzu-line bg-yuzu-night text-sm text-yuzu-cream"
                        disabled={location.kind !== "humidor"}
                        value={location.trays.join(", ")}
                        onChange={(event: ChangeEvent<HTMLInputElement>) => handleEditHumidorProfileLocationTrays(index, event.currentTarget.value)}
                      />
                      <Button
                        aria-label={`Remove saved location ${index + 1}`}
                        className="h-11 border-yuzu-line text-yuzu-cream"
                        type="button"
                        variant="outline"
                        onClick={() => handleRemoveHumidorProfileLocation(index)}
                      >
                        <X data-icon="inline-start" />
                        Remove
                      </Button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm leading-6 text-yuzu-muted">No saved locations yet.</p>
              )}
            </div>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <Button className="h-11 bg-yuzu-gold text-yuzu-ink hover:bg-yuzu-gold-light" disabled={isHumidorAlertsSaving || !canSaveHumidorProfile} type="submit">
              {isHumidorAlertsSaving ? <LoaderCircle className="animate-spin" data-icon="inline-start" /> : <MapPin data-icon="inline-start" />}
              Save Locations
            </Button>
            <p className="min-h-5 text-sm text-yuzu-gold" aria-live="polite">
              {humidorLocationProfileStatus}
            </p>
          </div>
        </form>
      </div>
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
        {pendingHumidorEnrichmentApproval ? (
          <HumidorEnrichmentApprovalDialog
            approval={pendingHumidorEnrichmentApproval}
            isApproving={enrichingHumidorItemId === pendingHumidorEnrichmentApproval.item.id}
            onApprove={handleApproveHumidorEnrichment}
            onCancel={handleCancelHumidorEnrichmentApproval}
          />
        ) : null}
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

function SmokeLogRow({ log }: { log: HumidorSmokeLog }) {
  const isSharedLog = log.source === "member_shared_gift";

  return (
    <div className="grid gap-3 border border-yuzu-line bg-yuzu-night/60 p-4 md:grid-cols-[1fr_auto] md:items-start">
      <div className="grid gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-heading text-xl text-yuzu-cream">{log.cigarName}</p>
          {isSharedLog ? (
            <Badge className="border-yuzu-gold/50 text-yuzu-gold" variant="outline">
              Shared
            </Badge>
          ) : null}
          {typeof log.rating === "number" ? (
            <Badge className="border-yuzu-gold/50 text-yuzu-gold" variant="outline">
              {log.rating}/100
            </Badge>
          ) : null}
        </div>
        <p className="text-sm text-yuzu-muted">{log.notes || (isSharedLog ? "Shared cigar logged." : "No smoke notes recorded.")}</p>
        <div className="flex flex-wrap gap-2 text-xs uppercase tracking-[0.14em] text-yuzu-muted">
          {isSharedLog ? <span>Inventory activity</span> : null}
          {log.drinkPairing ? <span>Drink: {log.drinkPairing}</span> : null}
          {log.durationMinutes ? <span>{formatSmokeDuration(log.durationMinutes)}</span> : null}
        </div>
      </div>
      <span className="text-sm text-yuzu-muted md:text-right">{formatDateTime(log.smokedAt)}</span>
    </div>
  );
}

function StatusTile({ label, note, value }: { label: string; note?: string; value: ReactNode }) {
  return (
    <div className="border border-yuzu-line bg-yuzu-night/60 p-4">
      <p className="text-xs uppercase tracking-[0.16em] text-yuzu-muted">{label}</p>
      <p className="mt-2 font-heading text-2xl text-yuzu-cream">{value}</p>
      {note ? <p className="mt-1 text-xs text-yuzu-muted">{note}</p> : null}
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

function HumidorEnrichmentApprovalDialog({
  approval,
  isApproving,
  onApprove,
  onCancel,
}: {
  approval: PendingHumidorEnrichmentApproval;
  isApproving: boolean;
  onApprove: () => void;
  onCancel: () => void;
}) {
  const changes = getHumidorEnrichmentPreviewChanges(approval.item, approval.previewItem, approval.enrichment.updatedFields);
  const hasChanges = changes.length > 0;
  const previewImageSrc = approval.enrichment.updatedFields.includes("cigarImage")
    ? getHumidorCigarImageSrc(approval.previewItem)
    : "";

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-yuzu-ink/80 px-4 py-6 backdrop-blur-sm">
      <div
        aria-labelledby="humidor-enrichment-approval-title"
        aria-modal="true"
        className="grid max-h-[90vh] w-full max-w-2xl gap-5 overflow-y-auto border border-yuzu-gold/50 bg-yuzu-night p-5 shadow-2xl"
        role="dialog"
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="grid gap-2">
            <p className="flex items-center gap-2 text-xs uppercase tracking-[0.16em] text-yuzu-gold">
              <Bot />
              Humidor Agent Review
            </p>
            <p id="humidor-enrichment-approval-title" className="font-heading text-2xl text-yuzu-cream">
              {approval.item.name}
            </p>
          </div>
          <Badge className="w-fit border-yuzu-line text-yuzu-muted" variant="outline">
            {changes.length} update{changes.length === 1 ? "" : "s"}
          </Badge>
        </div>

        <div className="grid gap-3 border border-yuzu-line bg-yuzu-ink/45 p-4 text-sm text-yuzu-muted">
          <p className="text-xs uppercase tracking-[0.16em] text-yuzu-gold">Pending Updates</p>
          {previewImageSrc ? (
            <div className="grid gap-3 border border-yuzu-line/65 bg-yuzu-night/60 p-3 sm:grid-cols-[120px_1fr] sm:items-center">
              <NextImage
                alt={`${approval.item.name} proposed cigar photo`}
                className="aspect-[4/3] w-full object-cover"
                height={120}
                src={previewImageSrc}
                unoptimized
                width={160}
              />
              <div className="grid gap-1">
                <p className="text-[0.68rem] uppercase tracking-[0.14em] text-yuzu-muted">Image</p>
                <p className="text-yuzu-cream">{getHumidorEnrichmentPreviewValue(approval.previewItem, "cigarImage")}</p>
              </div>
            </div>
          ) : null}
          {changes.length ? (
            <div className="grid gap-2 sm:grid-cols-2">
              {changes.map((change) => (
                <DetailCompare key={change.field} label={change.label} before={change.before} after={change.after} />
              ))}
            </div>
          ) : (
            <p className="text-sm leading-6 text-yuzu-muted">The humidor agent did not find any saveable field changes.</p>
          )}
        </div>

        {approval.enrichment.evidence.length ? (
          <div className="grid gap-2 text-sm text-yuzu-muted">
            <p className="text-xs uppercase tracking-[0.16em] text-yuzu-gold">Evidence</p>
            <ul className="grid gap-1">
              {approval.enrichment.evidence.map((evidence) => (
                <li key={evidence}>{evidence}</li>
              ))}
            </ul>
          </div>
        ) : null}

        {approval.enrichment.needsReview.length ? (
          <div className="grid gap-2 text-sm text-yuzu-muted">
            <p className="text-xs uppercase tracking-[0.16em] text-yuzu-gold">Review Notes</p>
            <ul className="grid gap-1">
              {approval.enrichment.needsReview.map((note) => (
                <li key={note}>{note}</li>
              ))}
            </ul>
          </div>
        ) : null}

        <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
          <Button className="h-11 border-yuzu-line text-yuzu-cream" disabled={isApproving} type="button" variant="outline" onClick={onCancel}>
            <X data-icon="inline-start" />
            Cancel
          </Button>
          <Button className="h-11 bg-yuzu-gold text-yuzu-ink hover:bg-yuzu-gold-light" disabled={isApproving || !hasChanges} type="button" onClick={onApprove}>
            {isApproving ? <LoaderCircle className="animate-spin" data-icon="inline-start" /> : <CheckCircle2 data-icon="inline-start" />}
            {isApproving ? "Approving Updates" : hasChanges ? "Approve Updates" : "No Updates To Approve"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function shouldOpenHumidorEnrichmentApproval(response: HumidorItemEnrichmentResponse) {
  return response.enrichment.status === "pending_approval" || response.enrichment.status === "needs_review";
}

function DetailCompare({ label, before, after }: { label: string; before: ReactNode; after: ReactNode }) {
  return (
    <div className="grid gap-1 border border-yuzu-line/65 bg-yuzu-night/60 p-3">
      <p className="text-[0.68rem] uppercase tracking-[0.14em] text-yuzu-muted">{label}</p>
      <p className="break-words text-yuzu-muted">Before: {before || "Not set"}</p>
      <p className="break-words text-yuzu-cream">After: {after || "Not set"}</p>
    </div>
  );
}

const humidorEnrichmentPreviewLabels: Record<string, string> = {
  brand: "Brand",
  cigarImage: "Image",
  estimatedValue: "MSRP",
  line: "Line",
  origin: "Origin",
  strength: "Strength",
  tastingNotes: "Tasting notes",
  vitola: "Vitola",
  wrapper: "Wrapper",
};

function getHumidorEnrichmentPreviewChanges(original: HumidorItem, preview: HumidorItem, updatedFields: string[]) {
  return updatedFields
    .map((field) => ({
      field,
      label: humidorEnrichmentPreviewLabels[field] ?? formatHumidorEnrichmentPreviewLabel(field),
      before: getHumidorEnrichmentPreviewValue(original, field),
      after: getHumidorEnrichmentPreviewValue(preview, field),
    }))
    .filter((change) => change.before !== change.after || change.after !== "Not set");
}

function getHumidorEnrichmentPreviewValue(item: HumidorItem, field: string): string {
  if (field === "estimatedValue") {
    return item.estimatedValue === null ? "Not set" : formatHumidorValue(item.estimatedValue, item.estimatedValueCurrency);
  }

  if (field === "cigarImage") {
    if (!getHumidorCigarImageSrc(item)) {
      return "Not set";
    }

    return item.cigarImage?.fileName || item.cigarImage?.source || "Reference image ready";
  }

  if (field === "brand") {
    return item.brand || "Not set";
  }

  if (field === "line") {
    return item.line || "Not set";
  }

  if (field === "vitola") {
    return item.vitola || "Not set";
  }

  if (field === "wrapper") {
    return item.wrapper || "Not set";
  }

  if (field === "origin") {
    return item.origin || "Not set";
  }

  if (field === "strength") {
    return item.strength || "Not set";
  }

  if (field === "tastingNotes") {
    return item.tastingNotes || "Not set";
  }

  return "Not set";
}

function formatHumidorEnrichmentPreviewLabel(field: string) {
  return field
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (letter) => letter.toUpperCase())
    .trim();
}

function AgingTrackerItem({
  item,
  agingNow,
  itemUpdateStatus,
  isUpdating,
  snapshot,
  onUpdate,
}: {
  item: HumidorItem;
  agingNow: Date;
  itemUpdateStatus: string;
  isUpdating: boolean;
  snapshot: AgingSnapshot;
  onUpdate?: (item: HumidorItem, input: HumidorItemUpdateInput) => void;
}) {
  const totalAgeSnapshot = getTotalAgeSnapshot(item.productionDate, agingNow);
  const [agingStartPreset, setAgingStartPreset] = useState<AgingStartPreset>("exact");
  const [agingStartDateDraft, setAgingStartDateDraft] = useState(formatDateInputValue(getAgingStartDateForItem(item)));

  function updateAgingStartPreset(value: string) {
    const preset = normalizeAgingStartPreset(value);
    setAgingStartPreset(preset);

    if (preset !== "exact") {
      setAgingStartDateDraft(resolveAgingStartPresetDate(preset));
    }
  }

  function updateAgingStartDate(value: string) {
    setAgingStartPreset("exact");
    setAgingStartDateDraft(value);
  }

  return (
    <div className="grid gap-3 border border-yuzu-line bg-yuzu-night/60 p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="font-heading text-2xl text-yuzu-cream">{item.name}</p>
          <p className="text-sm text-yuzu-muted">{formatItemDetails(item) || "Aging date recorded in live API"}</p>
        </div>
        <ReadinessBadge readiness={snapshot.readiness} />
      </div>
      <Progress className="[&_[data-slot=progress-indicator]]:bg-yuzu-gold" value={snapshot.progress} />
      <div className="grid gap-2 text-sm text-yuzu-muted sm:grid-cols-4">
        <span>{snapshot.ageMonths} months in your humidor</span>
        <span>Started {formatDate(getAgingStartDateForItem(item))}</span>
        <span>{totalAgeSnapshot ? `${totalAgeSnapshot.ageMonths} months total age` : "Production date not recorded"}</span>
        <span>{item.quantity} on hand</span>
      </div>
      <form
        className="grid gap-3 border border-yuzu-line/70 bg-yuzu-ink/35 p-3"
        onSubmit={(event: FormEvent<HTMLFormElement>) => {
          event.preventDefault();
          onUpdate?.(item, { agingStartDate: agingStartDateDraft });
        }}
      >
        <p className="flex items-center gap-2 text-xs uppercase tracking-[0.16em] text-yuzu-gold">
          <Clock />
          Adjust Aging Start
        </p>
        <div className="grid gap-3 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1fr)_auto]">
          <select
            aria-label={`${item.name} aging start option`}
            className="h-11 w-full rounded-sm border border-yuzu-line bg-yuzu-night px-3 text-sm text-yuzu-cream outline-none focus:border-yuzu-gold disabled:cursor-not-allowed disabled:opacity-60"
            disabled={!onUpdate || isUpdating}
            value={agingStartPreset}
            onChange={(event: ChangeEvent<HTMLSelectElement>) => updateAgingStartPreset(event.currentTarget.value)}
          >
            {agingStartPresetOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <Input
            aria-label={`${item.name} aging start exact date`}
            disabled={!onUpdate || isUpdating || agingStartPreset !== "exact"}
            type="date"
            value={agingStartDateDraft}
            onChange={(event: ChangeEvent<HTMLInputElement>) => updateAgingStartDate(event.target.value)}
          />
          <Button
            className="h-11 bg-yuzu-gold text-yuzu-ink hover:bg-yuzu-gold-light"
            disabled={!onUpdate || isUpdating || !agingStartDateDraft.trim()}
            type="submit"
          >
            {isUpdating ? <LoaderCircle className="animate-spin" data-icon="inline-start" /> : <Clock data-icon="inline-start" />}
            {isUpdating ? "Updating Start" : "Update Start Date"}
          </Button>
        </div>
        <p className="min-h-5 text-sm text-yuzu-gold" aria-live="polite">
          {itemUpdateStatus}
        </p>
      </form>
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
  const [sort, setSort] = useState(defaultHumidorTableSort);
  const sortedItems = useMemo(() => sortHumidorItems(items, sort, agingNow), [agingNow, items, sort]);

  return (
    <div className="grid gap-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <span className="text-xs uppercase tracking-[0.16em] text-yuzu-muted">{items.length} saved cigars</span>
        <label className="flex w-full flex-col gap-1 text-xs uppercase tracking-[0.16em] text-yuzu-muted sm:w-64">
          Sort by
          <select
            aria-label="Sort My Cigars"
            className="h-10 rounded-sm border border-yuzu-line bg-yuzu-night px-3 text-sm normal-case tracking-normal text-yuzu-cream outline-none focus:border-yuzu-gold"
            value={formatHumidorTableSortValue(sort)}
            onChange={(event: ChangeEvent<HTMLSelectElement>) => setSort(parseHumidorTableSortValue(event.currentTarget.value))}
          >
            {humidorTableSortOptions.map((option) => (
              <option key={formatHumidorTableSortValue(option.sort)} value={formatHumidorTableSortValue(option.sort)}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <SortableHumidorTableHead label="Cigar" sort={sort} sortKey="cigar" onSortChange={setSort} />
            <SortableHumidorTableHead label="Qty" sort={sort} sortKey="quantity" onSortChange={setSort} />
            <SortableHumidorTableHead label="Collection Value" sort={sort} sortKey="collectionValue" onSortChange={setSort} />
            <SortableHumidorTableHead label="Location" sort={sort} sortKey="location" onSortChange={setSort} />
            <SortableHumidorTableHead label="Aging" sort={sort} sortKey="aging" onSortChange={setSort} />
            <SortableHumidorTableHead label="Rating" sort={sort} sortKey="rating" onSortChange={setSort} />
          </TableRow>
        </TableHeader>
        <TableBody>
          {sortedItems.map((item) => {
            const snapshot = getAgingSnapshotForItem(item, agingNow);
            const unitValue = getHumidorUnitValue(item);
            const itemValue = getHumidorItemValue(item);
            const cigarImageSrc = getHumidorCigarImageSrc(item);
            const enrichmentGaps = getHumidorEnrichmentGaps(item);

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
                    {cigarImageSrc ? (
                      <NextImage
                        alt={`${item.name} cigar photo`}
                        className="size-14 shrink-0 object-cover"
                        height={80}
                        src={cigarImageSrc}
                        unoptimized
                        width={80}
                      />
                    ) : null}
                    <div className="grid gap-1">
                      <span className="font-medium text-yuzu-cream">{item.name}</span>
                      <span className="text-xs text-yuzu-muted">{formatItemDetails(item) || "No brand details"}</span>
                      {enrichmentGaps.length ? (
                        <span className="text-[0.68rem] uppercase tracking-[0.14em] text-yuzu-gold">
                          Missing: {formatHumidorEnrichmentGapLabels(enrichmentGaps)}
                        </span>
                      ) : null}
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
    </div>
  );
}

function SortableHumidorTableHead({
  label,
  sort,
  sortKey,
  onSortChange,
}: {
  label: string;
  sort: HumidorTableSort;
  sortKey: HumidorTableColumnSortKey;
  onSortChange: (sort: HumidorTableSort) => void;
}) {
  const isActive = sort.key === sortKey;
  const SortIcon = isActive ? (sort.direction === "asc" ? ArrowUp : ArrowDown) : ArrowUpDown;

  return (
    <TableHead aria-sort={getHumidorTableAriaSort(sort, sortKey)}>
      <button
        aria-label={`Sort by ${label}`}
        className="flex h-10 items-center gap-1.5 text-left text-yuzu-cream transition-colors hover:text-yuzu-gold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yuzu-gold/70"
        type="button"
        onClick={() => onSortChange(toggleHumidorTableSort(sort, sortKey))}
      >
        <span>{label}</span>
        <SortIcon aria-hidden="true" className={cn("size-3.5", isActive ? "text-yuzu-gold" : "text-yuzu-muted")} />
      </button>
    </TableHead>
  );
}

function getHumidorTableAriaSort(sort: HumidorTableSort, sortKey: HumidorTableColumnSortKey) {
  if (sort.key !== sortKey) {
    return "none";
  }

  return sort.direction === "asc" ? "ascending" : "descending";
}

function HumidorDetailCard({
  item,
  agingNow,
  enrichmentStatus,
  itemUpdateStatus,
  isDemo,
  isEnriching,
  isUpdating,
  storageLocationOptions,
  onClose,
  onDelete,
  onEnrich,
  onShare,
  onUpdate,
}: {
  item: HumidorItem;
  agingNow: Date;
  enrichmentStatus: string;
  itemUpdateStatus: string;
  isDemo: boolean;
  isEnriching: boolean;
  isUpdating: boolean;
  storageLocationOptions: HumidorStorageLocationOption[];
  onClose: () => void;
  onDelete?: (item: HumidorItem) => void;
  onEnrich?: (item: HumidorItem) => void;
  onShare?: (item: HumidorItem) => void;
  onUpdate?: (item: HumidorItem, input: HumidorItemUpdateInput) => void;
}) {
  const snapshot = getAgingSnapshotForItem(item, agingNow);
  const totalAgeSnapshot = getTotalAgeSnapshot(item.productionDate, agingNow);
  const unitValue = getHumidorUnitValue(item);
  const itemValue = getHumidorItemValue(item);
  const cigarImageSrc = getHumidorCigarImageSrc(item);
  const enrichmentGaps = getHumidorEnrichmentGaps(item);
  const currentStorageLocationKey = buildHumidorStorageOptionKey(item.humidorLocation, item.tray);
  const tastingNote = formatHumidorTastingNote(item.tastingNotes);
  const initialStorageLocation = storageLocationOptions.find((option) => option.key === currentStorageLocationKey) ?? storageLocationOptions[0] ?? null;
  const [selectedStorageLocationKey, setSelectedStorageLocationKey] = useState(initialStorageLocation?.key ?? "");
  const selectedStorageLocation =
    storageLocationOptions.find((option) => option.key === selectedStorageLocationKey) ??
    initialStorageLocation ?? {
      key: "",
      label: "",
      humidorLocation: "",
      tray: "",
    };
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
          <div className="flex flex-wrap gap-2 sm:justify-end">
            {onShare ? (
              <Button
                className="h-10 w-fit border-yuzu-line text-yuzu-cream"
                disabled={isUpdating || item.quantity <= 0}
                type="button"
                variant="outline"
                onClick={() => onShare?.(item)}
              >
                <Share2 data-icon="inline-start" />
                Shared
              </Button>
            ) : null}
            {onDelete ? (
              <Button
                className="h-10 w-fit border-yuzu-amber/60 text-yuzu-cream hover:border-yuzu-amber hover:bg-yuzu-amber/15"
                disabled={isUpdating}
                type="button"
                variant="outline"
                onClick={() => onDelete?.(item)}
              >
                <Trash2 data-icon="inline-start" />
                Delete
              </Button>
            ) : null}
            <Button className="h-10 w-fit border-yuzu-line text-yuzu-cream" type="button" variant="outline" onClick={onClose}>
              <X data-icon="inline-start" />
              Close Details
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="grid gap-5">
        <div className="grid gap-4 lg:grid-cols-[220px_1fr]">
          {cigarImageSrc ? (
            <NextImage
              alt={`${item.name} detailed cigar photo`}
              className="aspect-[4/3] w-full object-cover"
              height={330}
              src={cigarImageSrc}
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
              <DetailTile label="Box / Production Date" value={formatDate(item.productionDate)} />
              <DetailTile label="Reorder Reminder" value={formatDate(item.reorderReminder)} />
              <DetailTile label="Added To Yuzu" value={formatDate(item.createdAt)} />
            </div>

            {snapshot ? (
              <div className="grid gap-3 border border-yuzu-line bg-yuzu-night/60 p-4">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-xs uppercase tracking-[0.16em] text-yuzu-gold">Aging Snapshot</p>
                  <ReadinessBadge readiness={snapshot.readiness} />
                </div>
                <Progress className="[&_[data-slot=progress-indicator]]:bg-yuzu-gold" value={snapshot.progress} />
                <p className="text-sm text-yuzu-muted">{snapshot.ageMonths} months in your humidor from the recorded start date.</p>
                {totalAgeSnapshot ? (
                  <p className="text-sm text-yuzu-muted">{totalAgeSnapshot.ageMonths} months total age from the box / production date.</p>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>

        {enrichmentGaps.length ? (
          <div className="grid gap-3 border border-yuzu-gold/40 bg-yuzu-gold/10 p-4" data-humidor-enrichment="missing">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="grid gap-1">
                <p className="flex items-center gap-2 text-xs uppercase tracking-[0.16em] text-yuzu-gold">
                  <Bot />
                  Humidor Agent Update
                </p>
                <p className="text-sm text-yuzu-muted">Missing: {formatHumidorEnrichmentGapLabels(enrichmentGaps)}</p>
              </div>
              {onEnrich ? (
                <Button
                  className="h-10 w-fit bg-yuzu-gold text-yuzu-ink hover:bg-yuzu-gold-light"
                  disabled={isEnriching}
                  type="button"
                  onClick={() => onEnrich(item)}
                >
                  {isEnriching ? <LoaderCircle className="animate-spin" data-icon="inline-start" /> : <Bot data-icon="inline-start" />}
                  {isEnriching ? "Agent Updating" : "Ask Humidor Agent"}
                </Button>
              ) : null}
            </div>
            <p className="min-h-5 text-sm text-yuzu-gold" aria-live="polite">
              {enrichmentStatus}
            </p>
          </div>
        ) : null}

        <form
          className="grid gap-3 border border-yuzu-line bg-yuzu-night/60 p-4"
          onSubmit={(event: FormEvent<HTMLFormElement>) => {
            event.preventDefault();
            onUpdate?.(item, { humidorLocation: selectedStorageLocation.humidorLocation, tray: selectedStorageLocation.tray });
          }}
        >
          <p className="flex items-center gap-2 text-xs uppercase tracking-[0.16em] text-yuzu-gold">
            <MapPin />
            Storage Location
          </p>
          <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
            <select
              aria-label="Humidor location update"
              className="h-11 w-full rounded-sm border border-yuzu-line bg-yuzu-night px-3 text-sm text-yuzu-cream outline-none focus:border-yuzu-gold disabled:cursor-not-allowed disabled:opacity-60"
              disabled={!onUpdate || isUpdating}
              value={selectedStorageLocation.key}
              onChange={(event: ChangeEvent<HTMLSelectElement>) => setSelectedStorageLocationKey(event.currentTarget.value)}
            >
              {storageLocationOptions.length ? (
                storageLocationOptions.map((option) => (
                  <option key={option.key} value={option.key}>
                    {option.label}
                  </option>
                ))
              ) : (
                <option value="">Save a location first</option>
              )}
            </select>
            <Button
              className="h-11 bg-yuzu-gold text-yuzu-ink hover:bg-yuzu-gold-light"
              disabled={!onUpdate || isUpdating || !selectedStorageLocation.humidorLocation.trim() || !storageLocationOptions.length}
              type="submit"
            >
              {isUpdating ? <LoaderCircle className="animate-spin" data-icon="inline-start" /> : <MapPin data-icon="inline-start" />}
              {isUpdating ? "Updating Location" : "Update Location"}
            </Button>
          </div>
          <p className="min-h-5 text-sm text-yuzu-gold" aria-live="polite">
            {itemUpdateStatus}
          </p>
        </form>

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

        <div className="grid gap-3 border border-yuzu-line bg-yuzu-night/60 p-4">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs uppercase tracking-[0.16em] text-yuzu-gold">Tasting Notes</p>
            <span className="text-xs text-yuzu-muted">
              {unitValue === null
                ? "No entry price snapshot"
                : `${formatHumidorValue(unitValue, item.estimatedValueCurrency)} each | ${formatHumidorValueSource(item.estimatedValueSource)}`}
            </span>
          </div>
          {tastingNote.paragraphs.length || tastingNote.details.length ? (
            <div className="grid gap-3">
              {tastingNote.paragraphs.map((paragraph) => (
                <p key={paragraph} className="text-sm leading-6 text-yuzu-muted">
                  {paragraph}
                </p>
              ))}
              {tastingNote.details.length ? (
                <dl className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                  {tastingNote.details.map((detail) => (
                    <div key={`${detail.label}-${detail.value}`} className="grid gap-1 border border-yuzu-line/60 bg-yuzu-ink/45 p-3">
                      <dt className="text-[0.68rem] uppercase tracking-[0.14em] text-yuzu-muted">{detail.label}</dt>
                      <dd className="break-words text-sm leading-6 text-yuzu-cream">{detail.value}</dd>
                    </div>
                  ))}
                </dl>
              ) : null}
            </div>
          ) : (
            <p className="text-sm leading-6 text-yuzu-muted">No tasting notes recorded yet.</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function getHumidorCigarImageSrc(item: HumidorItem) {
  const src = item.cigarImage?.imageUrl || item.cigarImage?.dataUrl || "";
  return isRenderableHumidorCigarImageSrc(src) ? src : "";
}

function isRenderableHumidorCigarImageSrc(src: string) {
  if (/^data:image\/[a-z0-9.+-]+;base64,[A-Za-z0-9+/=]+$/i.test(src)) {
    return true;
  }

  if (
    /^https:\/\/classroom2\.s3\.us-east-1\.amazonaws\.com\/ycc\/humidor-images\/[^\s"<>]+$/i.test(src) ||
    /^https:\/\/swwest\.com\/Images\/SunsetItems\/[^\s"<>]+$/i.test(src) ||
    /^https:\/\/halfwheel\.com\/wp-content\/uploads\/[^\s"<>]+$/i.test(src) ||
    /^https:\/\/cigardojo\.com\/wp-content\/uploads\/[^\s"<>]+$/i.test(src)
  ) {
    return true;
  }

  return /^\/assets\/(?:product-[a-z-]+\.png|inventory\/[A-Za-z0-9._~/%-]+\.(?:png|jpe?g|gif|webp))$/i.test(src);
}

type HumidorEnrichmentGap = {
  key: HumidorEnrichmentField;
  label: string;
};

const humidorEnrichmentGapLabels: Record<HumidorEnrichmentField, string> = {
  image: "Image",
  info: "Info",
  msrp: "MSRP",
};

function getHumidorEnrichmentGaps(item: HumidorItem): HumidorEnrichmentGap[] {
  const gaps: HumidorEnrichmentGap[] = [];
  const missingInfo = [item.brand, item.line, item.vitola, item.wrapper, item.origin, item.strength].some((value) => !value);

  if (missingInfo) {
    gaps.push({ key: "info", label: humidorEnrichmentGapLabels.info });
  }

  if (!getHumidorCigarImageSrc(item)) {
    gaps.push({ key: "image", label: humidorEnrichmentGapLabels.image });
  }

  if (getHumidorUnitValue(item) === null) {
    gaps.push({ key: "msrp", label: humidorEnrichmentGapLabels.msrp });
  }

  return gaps;
}

function formatHumidorEnrichmentGapLabels(gaps: HumidorEnrichmentGap[]) {
  return gaps.map((gap) => gap.label).join(", ");
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

function normalizeAgingStartPreset(value: string): AgingStartPreset {
  return agingStartPresetOptions.some((option) => option.value === value) ? (value as AgingStartPreset) : "exact";
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
    productionDate: suggestion.productionDate || "",
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
    productionDate: item.productionDate || "",
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
    productionDate: form.productionDate || null,
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

function buildSmokeLogFormForItem(item: HumidorItem | null): SmokeLogForm {
  return {
    ...blankSmokeLogForm,
    humidorItemId: item?.id || "",
    cigarName: item?.name || "",
    smokedAt: getCurrentSmokeDateTimeLocalValue(),
    rating: item?.rating === null || item?.rating === undefined ? "" : String(item.rating),
  };
}

function buildSmokeLogPayload(form: SmokeLogForm): HumidorSmokeLogInput {
  const rating = form.rating.trim() ? Math.max(0, Math.min(100, Math.round(Number(form.rating) || 0))) : null;
  const durationMinutes = form.durationMinutes.trim() ? Math.max(1, Math.round(Number(form.durationMinutes) || 0)) : null;
  const smokedAt = form.smokedAt ? new Date(form.smokedAt).toISOString() : null;

  return {
    humidorItemId: form.humidorItemId || null,
    cigarName: form.cigarName.trim(),
    smokedAt,
    rating,
    drinkPairing: form.drinkPairing.trim(),
    notes: form.notes.trim(),
    durationMinutes,
    source: "member_smoke_log",
  };
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
  const agingStartDate = item.agingStartDate || item.purchaseDate || item.createdAt;

  if (!agingStartDate) {
    return null;
  }

  return withAgingSnapshot({ agingStartDate }, now);
}

function getAgingStartDateForItem(item: HumidorItem) {
  return item.agingStartDate || item.purchaseDate || item.createdAt || null;
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

  const date = parseHumidorDisplayDate(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

function formatDateTime(value: string | null | undefined) {
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
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function getCurrentSmokeDateTimeLocalValue() {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

function formatSmokeDuration(value: number) {
  return `${value} min`;
}

function parseHumidorDisplayDate(value: string) {
  const text = value.trim();
  const dateOnly = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (dateOnly) {
    return new Date(Number(dateOnly[1]), Number(dateOnly[2]) - 1, Number(dateOnly[3]));
  }

  return new Date(text);
}

function formatDateInputValue(value: string | null | undefined) {
  const text = value?.trim() ?? "";
  if (!text) {
    return "";
  }

  const dateOnly = text.match(/^(\d{4}-\d{2}-\d{2})/);
  if (dateOnly) {
    return dateOnly[1];
  }

  const date = new Date(text);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return date.toISOString().slice(0, 10);
}

function formatDeviceClimateValue(value: number) {
  const rounded = Math.round(value * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

function formatDeviceSyncTime(value: Date) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(value);
}

function formatPersistence(value: string) {
  return value ? value.replace(/_/g, " ") : "Not reported";
}
