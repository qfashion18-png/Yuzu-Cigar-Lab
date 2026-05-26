import { SectionHeading } from "@/components/section-heading";

type EducationVideo = {
  title: string;
  description: string;
  poster: string;
  videoSrc: string;
};

const educationVideos: EducationVideo[] = [
  {
    title: "Premium Cigars, Smarter Club",
    description: "A polished homepage promo introducing Yuzu's box-only store, membership access, and Digital Humidor.",
    poster: "/assets/hero-boxes.png",
    videoSrc: "/assets/yuzu-product-promo.mp4",
  },
  {
    title: "Your Collection, Perfectly Managed",
    description: "A Digital Humidor explainer focused on inventory, aging windows, tasting notes, and reminders.",
    poster: "/refs/humidor.png",
    videoSrc: "/assets/digital-humidor-explainer.mp4",
  },
  {
    title: "Choose Your Level",
    description: "A membership tier promo for Box Access Pass, Kisha, Sensei, and Daimyo.",
    poster: "/refs/membership.png",
    videoSrc: "/assets/yuzu-membership-tiers-promo.mp4",
  },
  {
    title: "No Singles. Better Boxes.",
    description: "A short storefront promo built around premium box ordering and member pricing.",
    poster: "/refs/shop.png",
    videoSrc: "/assets/yuzu-box-only-storefront-promo.mp4",
  },
  {
    title: "The Feed for Cigar People",
    description: "A Cigar Flow feature promo for news, drops, member posts, and smoke logs.",
    poster: "/refs/frontpage.png",
    videoSrc: "/assets/cigar-flow-clip-01.mp4",
  },
  {
    title: "From Online Club to Real Lounge Moments",
    description: "An events promo connecting Yuzu's digital club experience with adult lounge gatherings.",
    poster: "/assets/aire-by-puro-open-event.jpeg",
    videoSrc: "/assets/yuzu-events-promo.mp4",
  },
  {
    title: "Confidence Before It Ships",
    description: "A trust-building checkout promo covering age verification, adult signature delivery, and shipping controls.",
    poster: "/refs/checkout.png",
    videoSrc: "/assets/yuzu-compliance-checkout-promo.mp4",
  },
  {
    title: "Why Yuzu Exists",
    description: "A founder-style brand story about box-first buying, membership, tracking, events, and responsible commerce.",
    poster: "/assets/about-lounge.png",
    videoSrc: "/assets/yuzu-founder-brand-story.mp4",
  },
  {
    title: "Never Lose Track Again",
    description: "A mobile-first Digital Humidor reminder promo for aging milestones and reorder alerts.",
    poster: "/refs/mobile-layout.png",
    videoSrc: "/assets/yuzu-digital-humidor-notification-promo.mp4",
  },
  {
    title: "Everything in One Club",
    description: "A full website overview showing storefront, membership, Digital Humidor, Cigar Flow, events, and checkout.",
    poster: "/refs/frontpage.png",
    videoSrc: "/assets/yuzu-full-website-overview.mp4",
  },
  {
    title: "The Collection Builder",
    description: "A fast luxury social reel for box access, member drops, and collection tracking.",
    poster: "/assets/membership-boxes.png",
    videoSrc: "/assets/yuzu-luxury-social-reel.mp4",
  },
  {
    title: "A Smarter Club Experience",
    description: "A B2B partnership promo for lounges and cigar communities using Yuzu's digital layer.",
    poster: "/refs/about.png",
    videoSrc: "/assets/yuzu-lounge-partnership-promo.mp4",
  },
];

const videoAudioVersion = "2026-05-11-audio-redo";

export function EducationVideoLibrary() {
  return (
    <section
      id="hyperframes-videos"
      data-education-video-library="compact"
      className="relative mx-auto max-w-[1320px] scroll-mt-24 px-5 pt-8 lg:px-10"
    >
      <div className="border border-yuzu-line/80 bg-yuzu-night/78 p-4 shadow-[0_18px_54px_rgba(0,0,0,0.24)] sm:p-5 lg:p-6">
        <SectionHeading
          kicker="Yuzu Video Library"
          title="Watch the Yuzu story in short cuts."
          copy="A clean shelf of Yuzu promos, explainers, and feature videos."
          className="max-w-3xl"
        />

        <div className="mt-6 grid items-start gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
          {educationVideos.map((video) => (
            <article
              key={video.title}
              className="overflow-hidden border border-yuzu-line/75 bg-yuzu-panel/78 shadow-[0_12px_34px_rgba(0,0,0,0.2)]"
            >
              <div className="aspect-video max-h-44 border-b border-yuzu-line/70 bg-black">
                <video
                  className="h-full w-full object-contain"
                  src={`${video.videoSrc}?v=${videoAudioVersion}`}
                  poster={video.poster}
                  controls
                  playsInline
                  preload="metadata"
                  aria-label={video.title}
                />
              </div>
              <div className="p-4">
                <h3 className="font-heading text-lg leading-snug text-yuzu-cream sm:text-xl">{video.title}</h3>
                <p className="mt-2 line-clamp-2 text-xs leading-5 text-yuzu-muted">{video.description}</p>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
