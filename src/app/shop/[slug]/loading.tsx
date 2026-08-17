export default function ProductDetailLoading() {
  return (
    <div className="mx-auto flex max-w-[1520px] flex-col gap-10 px-5 py-7 md:px-[clamp(3rem,8.5vw,5rem)] md:py-9">
      <div className="h-11 w-40 animate-pulse bg-yuzu-line/20" />
      <section className="grid overflow-hidden border border-yuzu-line bg-yuzu-panel lg:grid-cols-[1.04fr_0.96fr]">
        <div className="min-h-[14rem] animate-pulse bg-yuzu-night sm:min-h-[22rem] lg:min-h-[38rem]" />
        <div className="grid content-start gap-6 p-6 sm:p-8 md:p-7 lg:p-10 xl:p-12">
          <div className="h-4 w-44 animate-pulse bg-yuzu-line/25" />
          <div className="h-24 w-4/5 animate-pulse bg-yuzu-line/25" />
          <div className="space-y-3">
            <div className="h-4 w-full animate-pulse bg-yuzu-line/15" />
            <div className="h-4 w-3/4 animate-pulse bg-yuzu-line/15" />
          </div>
          <div className="grid gap-5 border-y border-yuzu-line/60 py-6">
            <div className="h-14 w-40 animate-pulse bg-yuzu-line/25" />
            <div className="h-12 w-full animate-pulse bg-yuzu-gold/20" />
          </div>
          <div className="grid grid-cols-3 gap-5">
            {Array.from({ length: 3 }).map((_, index) => (
              <div key={index} className="h-16 animate-pulse bg-yuzu-line/15" />
            ))}
          </div>
        </div>
      </section>
      <section className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="h-72 animate-pulse border border-yuzu-line bg-yuzu-panel" />
        <div className="h-72 animate-pulse border border-yuzu-line bg-yuzu-panel" />
      </section>
    </div>
  );
}
