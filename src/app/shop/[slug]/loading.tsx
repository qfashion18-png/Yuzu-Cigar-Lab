export default function ProductDetailLoading() {
  return (
    <div className="mx-auto flex max-w-[1520px] flex-col gap-8 px-5 py-8 md:px-[clamp(3rem,8.5vw,5rem)]">
      <div className="h-4 w-40 bg-yuzu-line/30" />
      <section className="grid overflow-hidden border border-yuzu-line bg-yuzu-panel md:grid-cols-[1.05fr_0.95fr]">
        <div className="min-h-[22rem] animate-pulse bg-yuzu-night md:min-h-[44rem]" />
        <div className="grid gap-6 p-6 md:p-5 lg:p-8 xl:p-10">
          <div className="h-4 w-56 bg-yuzu-line/30" />
          <div className="space-y-4">
            <div className="h-14 w-4/5 bg-yuzu-line/30" />
            <div className="h-5 w-full bg-yuzu-line/20" />
            <div className="h-5 w-3/4 bg-yuzu-line/20" />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="h-20 border border-yuzu-line bg-yuzu-night" />
            ))}
          </div>
          <div className="mt-auto h-28 border-t border-yuzu-line" />
        </div>
      </section>
    </div>
  );
}
