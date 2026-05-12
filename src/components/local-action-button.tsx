"use client";

import type { ReactNode } from "react";
import { useSyncExternalStore } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type LocalActionButtonProps = {
  storageKey: string;
  idleLabel: string;
  completedLabel: string;
  statusText: string;
  className?: string;
  containerClassName?: string;
  variant?: "default" | "outline";
  icon?: ReactNode;
};

export function LocalActionButton({
  storageKey,
  idleLabel,
  completedLabel,
  statusText,
  className,
  containerClassName,
  variant = "outline",
  icon,
}: LocalActionButtonProps) {
  const completed = useSyncExternalStore(
    (onStoreChange) => subscribeToLocalAction(storageKey, onStoreChange),
    () => readLocalAction(storageKey),
    () => false
  );

  function completeAction() {
    window.localStorage.setItem(storageKey, "yes");
    window.dispatchEvent(new Event(getLocalActionEventName(storageKey)));
  }

  return (
    <div className={cn("grid gap-2", containerClassName)}>
      <Button
        type="button"
        className={className}
        variant={variant}
        onClick={completeAction}
        aria-pressed={completed}
      >
        {icon}
        {completed ? completedLabel : idleLabel}
      </Button>
      <p className="min-h-5 text-xs font-bold uppercase tracking-[0.16em] text-yuzu-gold" aria-live="polite">
        {completed ? statusText : ""}
      </p>
    </div>
  );
}

function readLocalAction(storageKey: string) {
  return typeof window !== "undefined" && window.localStorage.getItem(storageKey) === "yes";
}

function subscribeToLocalAction(storageKey: string, onStoreChange: () => void) {
  const eventName = getLocalActionEventName(storageKey);

  window.addEventListener("storage", onStoreChange);
  window.addEventListener(eventName, onStoreChange);

  return () => {
    window.removeEventListener("storage", onStoreChange);
    window.removeEventListener(eventName, onStoreChange);
  };
}

function getLocalActionEventName(storageKey: string) {
  return `yuzu-local-action:${storageKey}`;
}
