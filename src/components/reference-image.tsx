import Image from "next/image";

import { cn } from "@/lib/utils";

type ReferenceImageProps = {
  src: string;
  alt: string;
  className?: string;
  imageClassName?: string;
  objectPosition?: string;
  priority?: boolean;
};

export function ReferenceImage({
  src,
  alt,
  className,
  imageClassName,
  objectPosition = "center",
  priority = false,
}: ReferenceImageProps) {
  return (
    <div className={cn("luxury-image-frame relative overflow-hidden bg-yuzu-ink", className)}>
      <div className="luxury-image-backdrop absolute inset-0" aria-hidden="true" />
      <Image
        src={src}
        alt={alt}
        fill
        priority={priority}
        loading={priority ? "eager" : "lazy"}
        sizes="(max-width: 768px) 100vw, 50vw"
        className={cn("relative z-10 object-cover", imageClassName)}
        style={{ objectPosition }}
      />
    </div>
  );
}
