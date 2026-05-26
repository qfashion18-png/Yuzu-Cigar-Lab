import { Cascade, CascadeItem } from "@/components/motion-primitives";
import { benefits } from "@/lib/data";

export function BenefitStrip() {
  return (
    <section className="border-y border-yuzu-line/70 bg-yuzu-night/92">
      <Cascade className="mx-auto grid max-w-[1520px] gap-4 px-5 py-10 sm:grid-cols-2 lg:grid-cols-6 lg:px-10">
        {benefits.map((benefit) => {
          const Icon = benefit.icon;

          return (
            <CascadeItem key={benefit.title} className="flex items-start gap-4 border-yuzu-line/55 py-2 lg:border-r lg:pr-5 last:lg:border-r-0">
              <span className="grid size-10 shrink-0 place-items-center border border-yuzu-line/55 bg-yuzu-panel/70 text-yuzu-gold">
                <Icon className="size-5" />
              </span>
              <div className="flex flex-col gap-1">
                <h3 className="text-sm font-bold uppercase tracking-[0.14em] text-yuzu-gold">{benefit.title}</h3>
                <p className="text-sm leading-5 text-yuzu-muted">{benefit.text}</p>
              </div>
            </CascadeItem>
          );
        })}
      </Cascade>
    </section>
  );
}
