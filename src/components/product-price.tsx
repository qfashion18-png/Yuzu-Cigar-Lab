"use client";

import { useOptionalBackupAuth } from "@/components/backup-auth-provider";
import { formatCatalogPrice, resolveVisibleProductPrice, type ProductPriceView } from "@/lib/catalog-pricing";
import { cn } from "@/lib/utils";

type ProductPriceProps = {
  product: ProductPriceView;
  unitLabel?: string;
  className?: string;
  priceClassName?: string;
  unitClassName?: string;
  captionClassName?: string;
};

export function ProductPrice({
  product,
  unitLabel,
  className,
  priceClassName,
  unitClassName,
  captionClassName,
}: ProductPriceProps) {
  const auth = useOptionalBackupAuth();
  const isMember = Boolean(auth?.isReady && auth.isMember);
  const visiblePrice = resolveVisibleProductPrice(product, isMember);
  const publicPrice = resolveVisibleProductPrice(product, false);

  return (
    <div className={cn("grid gap-1", className)}>
      <div>
        <span className={priceClassName}>{formatCatalogPrice(visiblePrice)}</span>
        {unitLabel && <span className={unitClassName}>{unitLabel}</span>}
      </div>
      <p className={cn("text-xs text-yuzu-muted", captionClassName)}>
        {isMember ? `Member price; public ${formatCatalogPrice(publicPrice)}` : "Public price"}
      </p>
    </div>
  );
}
