import Link from "@/components/static-link";
import Image from "next/image";

import { cn } from "@/lib/utils";

type BrandMarkProps = {
  compact?: boolean;
  className?: string;
};

export function BrandMark({ compact = false, className }: BrandMarkProps) {
  return (
    <Link href="/" className={cn("flex min-w-0 items-center gap-2 sm:gap-3", className)} aria-label="Yuzu Cigar Club home">
      <Image
        src="/assets/yuzu-logo.png"
        alt=""
        width={48}
        height={48}
        priority
        unoptimized
        className={cn(
          "h-10 w-10 shrink-0 object-contain drop-shadow-[0_0_22px_rgba(221,170,61,0.24)] sm:h-12 sm:w-12",
          compact && "h-9 w-9 min-[380px]:h-10 min-[380px]:w-10"
        )}
      />
      <span className="flex min-w-0 flex-col leading-none">
        <span
          className={cn(
            "font-heading text-2xl tracking-[0.22em] text-yuzu-cream",
            compact && "text-[1.12rem] tracking-[0.18em] sm:text-2xl sm:tracking-[0.22em]"
          )}
        >
          YUZU
        </span>
        <span
          className={cn(
            "mt-1 text-[0.62rem] font-semibold uppercase tracking-[0.32em] text-yuzu-gold",
            compact && "text-[0.46rem] tracking-[0.22em] min-[380px]:text-[0.5rem] sm:text-[0.62rem] sm:tracking-[0.32em]"
          )}
        >
          Cigar Club
        </span>
      </span>
    </Link>
  );
}
