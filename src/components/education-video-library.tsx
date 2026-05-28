import { SectionHeading } from "@/components/section-heading";

type EducationVideo = {
  title: string;
  description: string;
  poster: string;
  videoSrc: string;
};

const educationVideos: EducationVideo[] = [
  {
    title: "Why Yuzu Exists",
    description: "A founder-style brand story about box-first buying, membership, tracking, events, and responsible commerce.",
    poster: "/assets/about-lounge.png",
    videoSrc: "/assets/yuzu-founder-brand-story.mp4",
  },
  {
    title: "No Singles. Better Boxes.",
    description: "The box-only storefront model, member pricing, and why Yuzu keeps buying focused.",
    poster: "/refs/shop.png",
    videoSrc: "/assets/yuzu-box-only-storefront-promo.mp4",
  },
  {
    title: "Choose Your Level",
    description: "A short guide to Box Access Pass, Kisha, Sensei, and Daimyo membership paths.",
    poster: "/refs/membership.png",
    videoSrc: "/assets/yuzu-membership-tiers-promo.mp4",
  },
  {
    title: "Never Lose Track Again",
    description: "Digital Humidor reminders for aging milestones, reorder alerts, and collection care.",
    poster: "/refs/mobile-layout.png",
    videoSrc: "/assets/yuzu-digital-humidor-notification-promo.mp4",
  },
];

const videoAudioVersion = "2026-05-11-audio-redo";

export function EducationVideoLibrary() {
  return (
    <section
      id="hyperframes-videos"
      data-education-video-library="compact"
      className="relative mx-auto max-w-[1320px] scroll-mt-24 px-5 py-8 sm:py-10 lg:px-10"
    >
      <SectionHeading
        kicker="Yuzu Video Library"
        title="Watch the Yuzu story in short cuts."
        copy="Four quick cuts through the core Yuzu story: why it exists, how box buying works, where membership fits, and how the Humidor keeps collections on track."
        className="max-w-4xl"
      />

      <div className="mt-6 grid grid-cols-1 items-stretch gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {educationVideos.map((video) => (
          <article
            key={video.title}
            className="flex h-full min-w-0 flex-col overflow-hidden border border-yuzu-line/75 bg-yuzu-panel/78 shadow-[0_12px_34px_rgba(0,0,0,0.2)]"
          >
            <div className="relative aspect-video w-full shrink-0 overflow-hidden border-b border-yuzu-line/70 bg-black">
              <video
                className="absolute inset-0 block h-full w-full object-contain"
                src={`${video.videoSrc}?v=${videoAudioVersion}`}
                poster={video.poster}
                controls
                playsInline
                preload="none"
                aria-label={video.title}
              >
                Your browser does not support the video tag.
              </video>
            </div>
            <div className="flex min-h-[7.5rem] flex-1 flex-col p-4">
              <h3 className="font-heading text-base leading-tight text-yuzu-cream sm:text-lg">{video.title}</h3>
              <p className="mt-2 line-clamp-3 text-xs leading-5 text-yuzu-muted">{video.description}</p>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
