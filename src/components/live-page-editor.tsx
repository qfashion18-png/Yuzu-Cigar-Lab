"use client";

import { Eye, EyeOff, Pencil, RotateCcw, Save, X } from "lucide-react";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { useBackupAuth } from "@/components/backup-auth-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { fetchLivePageContent, getLiveApiErrorMessage, saveLivePageContent } from "@/lib/live-api";
import {
  getLivePageEditorConfig,
  livePageEditorStorageKey,
  mergeLivePageValues,
  type LivePageEditorConfig,
} from "@/lib/live-page-editor";
import { cn } from "@/lib/utils";

type StoredLivePageEdits = Record<string, Record<string, string>>;
const emptyRouteEdits: Record<string, string> = {};
const emptyValues: Record<string, string> = {};

export function LivePageEditor() {
  const pathname = usePathname();
  const auth = useBackupAuth();
  const config = useMemo(() => getLivePageEditorConfig(pathname ?? "/"), [pathname]);
  const [isHydrated, setIsHydrated] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [showEditableAreas, setShowEditableAreas] = useState(false);
  const [publishedEdits, setPublishedEdits] = useState<StoredLivePageEdits>({});
  const [localEdits, setLocalEdits] = useState<StoredLivePageEdits>({});
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState("");
  const routeEdits = useMemo(() => {
    if (!config) {
      return emptyRouteEdits;
    }

    return {
      ...(publishedEdits[config.route] ?? emptyRouteEdits),
      ...(auth.isAdmin ? localEdits[config.route] ?? emptyRouteEdits : emptyRouteEdits),
    };
  }, [auth.isAdmin, config, localEdits, publishedEdits]);
  const values = useMemo(
    () => (config ? mergeLivePageValues(config, routeEdits) : emptyValues),
    [config, routeEdits]
  );
  const [draft, setDraft] = useState<Record<string, string>>({});

  useEffect(() => {
    let cancelled = false;
    const nextSavedEdits = readStoredEdits();

    window.queueMicrotask(() => {
      if (cancelled) {
        return;
      }

      setLocalEdits(nextSavedEdits);
      setIsHydrated(true);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!config || !isHydrated) {
      return;
    }

    let cancelled = false;

    fetchLivePageContent(config.route)
      .then((response) => {
        if (cancelled) {
          return;
        }

        setPublishedEdits((current) => ({
          ...current,
          [config.route]: response.page.edits,
        }));
      })
      .catch(() => {
        // Static preview environments may not have the live API configured yet.
      });

    return () => {
      cancelled = true;
    };
  }, [config, isHydrated]);

  useEffect(() => {
    if (!config) {
      return;
    }

    let cancelled = false;

    window.queueMicrotask(() => {
      if (cancelled) {
        return;
      }

      setDraft(values);
    });

    return () => {
      cancelled = true;
    };
  }, [config, values]);

  useEffect(() => {
    if (!config || !isHydrated) {
      return;
    }

    applyLivePageValues(config, values);
  }, [config, isHydrated, values]);

  useEffect(() => {
    if (!isHydrated) {
      return;
    }

    if (showEditableAreas) {
      document.body.dataset.yuzuLiveEditor = "active";
    } else {
      delete document.body.dataset.yuzuLiveEditor;
    }

    return () => {
      delete document.body.dataset.yuzuLiveEditor;
    };
  }, [isHydrated, showEditableAreas]);

  if (!isHydrated || !auth.isReady || !auth.isAdmin || !config) {
    return null;
  }

  function updateDraft(fieldId: string, value: string) {
    setDraft((current) => ({
      ...current,
      [fieldId]: value,
    }));
  }

  async function saveDraft() {
    if (!config) {
      return;
    }

    const nextRouteEdits = compactDraft(config, draft);
    const nextEdits = {
      ...localEdits,
      [config.route]: nextRouteEdits,
    };

    setLocalEdits(nextEdits);
    writeStoredEdits(nextEdits);
    setIsSaving(true);
    setSaveStatus("Saving live changes...");

    try {
      const headers = await auth.createApiHeaders();
      const response = await saveLivePageContent(config.route, nextRouteEdits, headers);
      setPublishedEdits((current) => ({
        ...current,
        [config.route]: response.page.edits,
      }));
      setSaveStatus("Published live.");
    } catch (error) {
      setSaveStatus(`Saved in this browser. ${getLiveApiErrorMessage(error)}`);
    } finally {
      setIsSaving(false);
    }
  }

  async function resetPage() {
    if (!config) {
      return;
    }

    const nextEdits = { ...localEdits };
    const nextValues = mergeLivePageValues(config);

    delete nextEdits[config.route];
    setDraft(nextValues);
    setLocalEdits(nextEdits);
    writeStoredEdits(nextEdits);
    applyLivePageValues(config, nextValues);
    setIsSaving(true);
    setSaveStatus("Resetting live page...");

    try {
      const headers = await auth.createApiHeaders();
      const response = await saveLivePageContent(config.route, {}, headers);
      setPublishedEdits((current) => ({
        ...current,
        [config.route]: response.page.edits,
      }));
      setSaveStatus("Live page reset.");
    } catch (error) {
      setSaveStatus(`Reset in this browser. ${getLiveApiErrorMessage(error)}`);
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <>
      <button
        type="button"
        className="fixed bottom-5 right-5 z-[70] inline-flex h-12 items-center gap-2 border border-yuzu-gold bg-yuzu-gold px-4 text-sm font-black uppercase tracking-[0.14em] text-yuzu-ink shadow-[0_18px_46px_rgba(0,0,0,0.42)] transition hover:bg-yuzu-gold-light"
        onClick={() => {
          setIsOpen(true);
          setShowEditableAreas(true);
        }}
      >
        <Pencil className="size-4" />
        Edit page
      </button>

      {isOpen && (
        <aside className="fixed inset-y-0 right-0 z-[90] flex w-full max-w-[27rem] flex-col border-l border-yuzu-line bg-yuzu-forest text-yuzu-cream shadow-[0_0_80px_rgba(0,0,0,0.55)]">
          <header className="flex items-start gap-3 border-b border-yuzu-line px-5 py-5">
            <div className="grid size-10 shrink-0 place-items-center border border-yuzu-gold/60 bg-yuzu-gold/10 text-yuzu-gold">
              <Pencil className="size-5" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-black uppercase tracking-[0.2em] text-yuzu-gold">Live Editor</p>
              <h2 className="mt-1 font-heading text-2xl leading-tight text-yuzu-cream">{config.label}</h2>
            </div>
            <button
              type="button"
              className="ml-auto grid size-9 place-items-center border border-yuzu-line text-yuzu-muted transition hover:border-yuzu-gold hover:text-yuzu-gold"
              aria-label="Close live editor"
              onClick={() => {
                setIsOpen(false);
                setShowEditableAreas(false);
              }}
            >
              <X className="size-4" />
            </button>
          </header>

          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
            <div className="grid gap-4">
              {config.fields.map((field) => (
                <label className="grid gap-2 text-sm" key={field.id}>
                  <span className="text-xs font-black uppercase tracking-[0.16em] text-yuzu-gold">{field.label}</span>
                  {field.control === "textarea" ? (
                    <Textarea
                      value={draft[field.id] ?? field.defaultValue}
                      onChange={(event) => updateDraft(field.id, event.currentTarget.value)}
                      className="min-h-28 rounded-sm border-yuzu-line bg-yuzu-night text-yuzu-cream"
                    />
                  ) : (
                    <Input
                      value={draft[field.id] ?? field.defaultValue}
                      onChange={(event) => updateDraft(field.id, event.currentTarget.value)}
                      className="h-11 rounded-sm border-yuzu-line bg-yuzu-night text-yuzu-cream"
                    />
                  )}
                </label>
              ))}
            </div>
          </div>

          <footer className="grid gap-3 border-t border-yuzu-line p-5">
            {saveStatus && (
              <p className="text-xs font-semibold leading-relaxed text-yuzu-muted" role="status">
                {saveStatus}
              </p>
            )}
            <Button
              type="button"
              className={cn(
                "h-11 justify-start border-yuzu-line text-yuzu-cream",
                showEditableAreas && "border-yuzu-gold text-yuzu-gold"
              )}
              disabled={isSaving}
              variant="outline"
              onClick={() => setShowEditableAreas((visible) => !visible)}
            >
              {showEditableAreas ? <EyeOff data-icon="inline-start" /> : <Eye data-icon="inline-start" />}
              {showEditableAreas ? "Hide Editable Areas" : "Show Editable Areas"}
            </Button>
            <div className="grid grid-cols-2 gap-3">
              <Button
                type="button"
                className="h-11 border-yuzu-line text-yuzu-cream"
                disabled={isSaving}
                variant="outline"
                onClick={() => void resetPage()}
              >
                <RotateCcw data-icon="inline-start" />
                Reset Page
              </Button>
              <Button
                type="button"
                className="h-11 bg-yuzu-gold text-yuzu-ink hover:bg-yuzu-gold-light"
                disabled={isSaving}
                onClick={() => void saveDraft()}
              >
                <Save data-icon="inline-start" />
                {isSaving ? "Saving..." : "Save Live"}
              </Button>
            </div>
          </footer>
        </aside>
      )}
    </>
  );
}

function applyLivePageValues(config: LivePageEditorConfig, values: Record<string, string>) {
  for (const field of config.fields) {
    const nextValue = values[field.id] ?? field.defaultValue;
    const editableElements = document.querySelectorAll<HTMLElement>(
      `[data-yuzu-editable="${field.id}"]`
    );

    editableElements.forEach((element) => {
      element.textContent = nextValue;
    });
  }
}

function compactDraft(config: LivePageEditorConfig, draft: Record<string, string>) {
  return config.fields.reduce<Record<string, string>>((edits, field) => {
    const nextValue = draft[field.id] ?? "";

    if (nextValue !== field.defaultValue) {
      edits[field.id] = nextValue;
    }

    return edits;
  }, {});
}

function readStoredEdits(): StoredLivePageEdits {
  try {
    const value = window.localStorage.getItem(livePageEditorStorageKey);
    const parsedValue = value ? JSON.parse(value) : {};

    return parsedValue && typeof parsedValue === "object" ? parsedValue : {};
  } catch {
    return {};
  }
}

function writeStoredEdits(edits: StoredLivePageEdits) {
  window.localStorage.setItem(livePageEditorStorageKey, JSON.stringify(edits));
}
