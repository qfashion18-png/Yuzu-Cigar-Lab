import { cn } from "@/lib/utils";

type SectionHeadingProps = {
  as?: "h1" | "h2";
  kicker?: string;
  title: string;
  copy?: string;
  className?: string;
  editableIds?: Partial<Record<"kicker" | "title" | "copy", string>>;
};

export function SectionHeading({ as = "h2", kicker, title, copy, className, editableIds }: SectionHeadingProps) {
  const Heading = as;

  return (
    <div className={cn("flex min-w-0 max-w-3xl flex-col gap-3", className)}>
      {kicker && (
        <p className="fine-label flex min-w-0 items-start gap-3 text-[0.62rem] leading-5 tracking-[0.08em] sm:text-xs sm:tracking-[0.16em]">
          <span className="mt-2 h-px w-8 shrink-0 bg-yuzu-line/80" aria-hidden="true" />
          <span className="min-w-0 flex-1 whitespace-normal" data-yuzu-editable={editableIds?.kicker}>{kicker}</span>
        </p>
      )}
      <Heading className="font-heading text-4xl leading-[1.05] text-yuzu-cream md:text-5xl" data-yuzu-editable={editableIds?.title}>{title}</Heading>
      {copy && <p className="text-base leading-7 text-yuzu-muted" data-yuzu-editable={editableIds?.copy}>{copy}</p>}
    </div>
  );
}
