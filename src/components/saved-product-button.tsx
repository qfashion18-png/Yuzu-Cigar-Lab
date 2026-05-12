"use client";

import { Heart } from "lucide-react";
import { useSyncExternalStore } from "react";

import { cn } from "@/lib/utils";

const savedProductsKey = "yuzu-saved-products-v1";

type SavedProductButtonProps = {
  productName: string;
  productSlug: string;
};

export function SavedProductButton({ productName, productSlug }: SavedProductButtonProps) {
  const saved = useSyncExternalStore(
    subscribeToSavedProducts,
    () => readSavedProducts().includes(productSlug),
    () => false
  );

  function toggleSaved() {
    const savedProducts = readSavedProducts();
    const nextSaved = savedProducts.includes(productSlug)
      ? savedProducts.filter((slug) => slug !== productSlug)
      : [...savedProducts, productSlug];

    window.localStorage.setItem(savedProductsKey, JSON.stringify(nextSaved));
    window.dispatchEvent(new Event(savedProductsKey));
  }

  return (
    <button
      type="button"
      className={cn(
        "absolute right-3 top-3 grid size-9 place-items-center border border-yuzu-line bg-yuzu-night/70 text-yuzu-cream transition hover:border-yuzu-gold hover:text-yuzu-gold",
        saved && "border-yuzu-gold bg-yuzu-gold text-yuzu-ink hover:text-yuzu-ink"
      )}
      aria-label={saved ? `Remove ${productName} from saved products` : `Save ${productName}`}
      aria-pressed={saved}
      onClick={toggleSaved}
      title={saved ? "Saved" : "Save"}
    >
      <Heart className={saved ? "fill-current" : undefined} />
    </button>
  );
}

function readSavedProducts() {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const stored = window.localStorage.getItem(savedProductsKey);
    const parsed = stored ? (JSON.parse(stored) as unknown) : [];

    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
}

function subscribeToSavedProducts(onStoreChange: () => void) {
  window.addEventListener("storage", onStoreChange);
  window.addEventListener(savedProductsKey, onStoreChange);

  return () => {
    window.removeEventListener("storage", onStoreChange);
    window.removeEventListener(savedProductsKey, onStoreChange);
  };
}
