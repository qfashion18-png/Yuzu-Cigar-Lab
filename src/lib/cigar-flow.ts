import { officialCigarNewsSources, type NewsStory, type NewsStoryImage } from "@/lib/newsroom";

export type CigarFlowSource = {
  name: string;
  publisher: string;
  feedUrl: string;
  websiteUrl: string;
  focus: string;
  cadence: string;
};

export type CigarFlowItem = {
  id: string;
  kind: "manufacturer" | "rss" | "member";
  mediaType: "image" | "video";
  sourceName: string;
  sourceHandle: string;
  title: string;
  excerpt: string;
  storySnippet: string;
  href: string;
  image: string;
  imagePosition: string;
  publishedAt: string;
  readTime: string;
  tags: string[];
  likes: number;
  comments: number;
  saves: number;
  featured?: boolean;
  videoDuration?: string;
};

export type CigarPressReleaseSearchSource = {
  name: string;
  publisher: string;
  url: string;
  searchQuery: string;
  focus: string;
  cadence: string;
};

export type CigarFlowAutomation = {
  id: string;
  cadence: string;
  owner: string;
  outputTargets: string[];
  updateScope: string[];
};

export const cigarFlowSources: CigarFlowSource[] = [
  {
    name: "halfwheel",
    publisher: "halfwheel",
    feedUrl: "https://halfwheel.com/feed",
    websiteUrl: "https://halfwheel.com",
    focus: "Industry news, reviews, release coverage",
    cadence: "Daily cigar desk",
  },
  {
    name: "Cigar Dojo",
    publisher: "Cigar Dojo",
    feedUrl: "https://cigardojo.com/feed",
    websiteUrl: "https://cigardojo.com",
    focus: "Reviews, cigar culture, videos, events",
    cadence: "Several posts weekly",
  },
  {
    name: "Cigar Journal",
    publisher: "Cigar Journal",
    feedUrl: "https://www.cigarjournal.com/feed",
    websiteUrl: "https://www.cigarjournal.com",
    focus: "Global cigar news and manufacturer updates",
    cadence: "International dispatches",
  },
  {
    name: "JR Cigars Blending Room",
    publisher: "JR Cigars",
    feedUrl: "https://www.jrcigars.com/blending-room/feed/",
    websiteUrl: "https://www.jrcigars.com/blending-room/",
    focus: "New cigar education, lists, and retail editorial",
    cadence: "Retail editorial feed",
  },
  {
    name: "Cigar Aficionado",
    publisher: "Cigar Aficionado",
    feedUrl: "http://cigaraficionado.com/",
    websiteUrl: "https://www.cigaraficionado.com",
    focus: "Ratings, cigar news, blogs, videos, and magazine coverage",
    cadence: "Homepage and blog monitor",
  },
];

export const cigarPressReleaseSearchSources: CigarPressReleaseSearchSource[] = [
  {
    name: "PR Newswire cigar release search",
    publisher: "PR Newswire",
    url: "https://www.prnewswire.com/news-releases/news-releases-list/",
    searchQuery: "cigar press release",
    focus: "Daily wire search for cigar, premium cigar, and cigar-company announcements.",
    cadence: "Daily press-release scan",
  },
  {
    name: "Business Wire cigar newsroom search",
    publisher: "Business Wire",
    url: "https://www.businesswire.com/newsroom",
    searchQuery: "cigar",
    focus: "Daily newsroom keyword search for cigar launch, event, and company-release leads.",
    cadence: "Daily press-release scan",
  },
  {
    name: "GlobeNewswire cigar tag search",
    publisher: "GlobeNewswire",
    url: "https://www.globenewswire.com/en/search/tag/cigar",
    searchQuery: "cigar",
    focus: "Daily GlobeNewswire tag review for cigar-related release pages worth operator review.",
    cadence: "Daily press-release scan",
  },
];

export const cigarFlowAutomation: CigarFlowAutomation = {
  id: "cigar-flow-daily-newsroom-refresh",
  cadence: "Daily at 8:00 AM America/Phoenix",
  owner: "GitHub Actions newsroom automation",
  outputTargets: ["Cigar Flow news desk", "Published newsroom story", "Operator review trail"],
  updateScope: [
    "Research current cigar and cigar-adjacent news from verified sources.",
    "Monitor every configured manufacturer URL in officialCigarNewsSources for brand-direct updates.",
    "Run a daily search for cigar press releases across approved wire/newsroom search pages to find story leads.",
    "POST /news/story-drafts with source-safe notes and only source-aligned story imagery.",
    "Keep every published Cigar Flow story in the editorial split-hero layout with inline images throughout the story body.",
    "POST /news/stories with operator approval so the Cigar Flow news desk updates through the live API.",
    "Keep static member smoke-log concept cards distinct from live newsroom stories.",
  ],
};

const cigarFlowUpdateStoryImages: NewsStoryImage[] = [
  {
    label: "Oliva Serie V Maduro",
    image: "/assets/news/researched/oliva-serie-v-maduro.jpg",
    imagePosition: "50% 50%",
    alt: "Oliva Serie V Maduro cigar from Oliva Cigars for the May 31 industry highlights story",
    sourceUrl: "https://olivacigar.com/cigars/serie-v-maduro/",
  },
  {
    label: "Perdomo 20th Anniversary",
    image: "/assets/news/researched/perdomo-20th-anniversary-maduro.jpg",
    imagePosition: "50% 50%",
    alt: "Perdomo 20th Anniversary Maduro cigar from the official Perdomo product page",
    sourceUrl: "https://www.perdomocigars.com/20th-anniversary",
  },
  {
    label: "Foundation Wise Man Maduro",
    image: "/assets/news/researched/foundation-wise-man-maduro.jpg",
    imagePosition: "50% 50%",
    alt: "Foundation Cigar Company Wise Man Maduro box from the official Foundation product page",
    sourceUrl: "https://foundationcigarcompany.com/the-wise-man-maduro/",
  },
  {
    label: "PCA Trade Show",
    image: "/assets/news/researched/pca-2026-trade-show.jpg",
    imagePosition: "50% 50%",
    alt: "Cigar Aficionado collage for the 2026 PCA Trade Show highlights story",
    sourceUrl: "https://www.cigaraficionado.com/article/highlights-from-the-pca-trade-show",
  },
];

export const cigarFlowNewsStories: NewsStory[] = [
  {
    id: "cigar-industry-highlights-2026-05-31",
    slug: "may-31-cigar-industry-highlights-new-releases-events",
    title: "May 31 Cigar Industry Highlights: New Releases and Events",
    dek:
      "Explore the latest cigar releases and industry events from Oliva, Perdomo, Foundation Cigar Company, and PCA show coverage.",
    category: "Cigar Industry News",
    bodyMarkdown:
      "## New Releases\nOliva Serie V Maduro remains a source-backed highlight for adult cigar readers tracking richer Maduro profiles, with Oliva describing the line around Nicaraguan ligeros beneath a San Andres wrapper. Perdomo 20th Anniversary Series adds another anniversary-focused release lane, with the Maduro expression giving the story a real product image and official product page to verify against. Foundation Cigar Company's real Wise Man Maduro replaces the unverified Foundation 1876 wording from the draft brief, aligning the story with the official Foundation product page and its San Andres Mexican wrapper notes.\n\n## Upcoming Events\nCigar Aficionado's 2026 PCA Trade Show report anchors the event portion of this Cigar Flow update with current show imagery and a broad rundown of new and upcoming premium cigar releases shown at the industry's largest convention.\n\n## Flow Note\nStay tuned for more updates as the cigar industry continues to evolve and surprise adult cigar readers with new releases, event notes, and source-backed stories inside Cigar Flow.",
    images: cigarFlowUpdateStoryImages,
    sourceNotes: [
      {
        label: "Oliva Serie V Maduro",
        url: "https://olivacigar.com/cigars/serie-v-maduro/",
        note: "Official Oliva product page and image source for the Serie V Maduro reference.",
        sourceType: "official",
        domain: "olivacigar.com",
      },
      {
        label: "Perdomo 20th Anniversary",
        url: "https://www.perdomocigars.com/20th-anniversary",
        note: "Official Perdomo product page and image source for the 20th Anniversary reference.",
        sourceType: "official",
        domain: "perdomocigars.com",
      },
      {
        label: "Foundation Wise Man Maduro",
        url: "https://foundationcigarcompany.com/the-wise-man-maduro/",
        note: "Official Foundation product page and image source for the corrected Wise Man Maduro reference.",
        sourceType: "official",
        domain: "foundationcigarcompany.com",
      },
      {
        label: "Cigar Aficionado PCA Trade Show",
        url: "https://www.cigaraficionado.com/article/highlights-from-the-pca-trade-show",
        note: "Current 2026 PCA Trade Show report used for the event section and show collage image.",
        sourceType: "needs_review",
        domain: "cigaraficionado.com",
      },
    ],
    officialSources: [
      "https://olivacigar.com/cigars/serie-v-maduro/",
      "https://www.perdomocigars.com/20th-anniversary",
      "https://foundationcigarcompany.com/the-wise-man-maduro/",
      "https://www.cigaraficionado.com/article/highlights-from-the-pca-trade-show",
    ],
    status: "published",
    publishedAt: "2026-05-31T12:00:00.000Z",
    updatedAt: "2026-05-31T12:00:00.000Z",
  },
];

export const cigarFlowItems: CigarFlowItem[] = [
  {
    id: "matilde-limited-exposure-no-3",
    kind: "rss",
    mediaType: "image",
    sourceName: "halfwheel",
    sourceHandle: "@halfwheel",
    title: "Matilde Limited Exposure No. 3 Robusto",
    excerpt: "A current release review signal for members tracking limited-production boxes and rest-worthy blends.",
    storySnippet: "Matilde's third Limited Exposure entry is framed as a small-production robusto review, useful for deciding whether to chase boxes now or let them rest.",
    href: "https://halfwheel.com/matilde-limited-exposure-no-3-robusto/470765/",
    image: "https://halfwheel.com/wp-content/uploads/2026/05/Matilde-Limited-Exposure-No.-3-Robusto-2-768x512.jpg",
    imagePosition: "50% 52%",
    publishedAt: "May 2026",
    readTime: "Review",
    tags: ["Review", "Limited", "Box watch"],
    likes: 428,
    comments: 36,
    saves: 119,
    featured: true,
  },
  {
    id: "cromagnon-visigoth-2026",
    kind: "manufacturer",
    mediaType: "video",
    sourceName: "Roma Craft watch",
    sourceHandle: "@makerwatch",
    title: "CroMagnon Visigoth Targeted for Late 2026",
    excerpt: "A maker-release watch card for collectors who want early allocation reminders before the buying rush.",
    storySnippet: "The Visigoth note centers on Roma Craft's late-2026 target window, giving collectors time to flag allocation interest before the release rush.",
    href: "https://halfwheel.com/cromagnon-visigoth-targeted-for-late-2026/470739/",
    image: "https://halfwheel.com/wp-content/uploads/2026/05/Visigoth-Logo-768x512.jpeg",
    imagePosition: "44% 50%",
    publishedAt: "May 2026",
    readTime: "Release watch",
    tags: ["Manufacturer", "2026", "Allocation"],
    likes: 612,
    comments: 58,
    saves: 184,
    videoDuration: "0:38",
  },
  {
    id: "cigar-dojo-brand-market",
    kind: "rss",
    mediaType: "image",
    sourceName: "halfwheel",
    sourceHandle: "@halfwheel",
    title: "Rocky Patel Thirtieth Anniversary Limited Edition",
    excerpt: "Release coverage for a milestone anniversary cigar members may want to monitor for box availability.",
    storySnippet: "The anniversary release story tracks Rocky Patel's milestone limited edition, a blend positioned for fans watching celebratory boxes and short-window inventory.",
    href: "https://halfwheel.com/rocky-patel-thirtieth-anniversary-limited-edition/470748/",
    image: "https://halfwheel.com/wp-content/uploads/2026/04/Rocky-Patel-Thirtieth-Anniversary-Limited-Edition-2-768x512.jpg",
    imagePosition: "50% 45%",
    publishedAt: "May 2026",
    readTime: "Trend",
    tags: ["Culture", "Brands", "Market"],
    likes: 344,
    comments: 41,
    saves: 92,
  },
  {
    id: "aganorsa-single-cask-release",
    kind: "manufacturer",
    mediaType: "image",
    sourceName: "Camacho watch",
    sourceHandle: "@makerwatch",
    title: "Camacho Factory Unleashed 3",
    excerpt: "A manufacturer release signal pulled from the feed for members tracking bolder seasonal drops.",
    storySnippet: "The Camacho update keeps the Factory Unleashed 3 drop in view, with a bolder seasonal profile likely to matter for members chasing fresh arrivals.",
    href: "https://halfwheel.com/redux-camacho-factory-unleashed-3-3/470682/",
    image: "https://halfwheel.com/wp-content/uploads/2026/05/Camacho-Factory-Unleashed-3-768x512.jpg",
    imagePosition: "55% 50%",
    publishedAt: "May 2026",
    readTime: "Drop",
    tags: ["New drop", "Aganorsa", "Pairing"],
    likes: 535,
    comments: 63,
    saves: 201,
  },
  {
    id: "loaisiga-infiel-box-press",
    kind: "manufacturer",
    mediaType: "image",
    sourceName: "Loaisiga Cigars",
    sourceHandle: "@makerwatch",
    title: "Loaisiga Announces Infiel Limited Edition Box Press Toro",
    excerpt: "A new limited box-press release surfaced from RSS for members watching allocation timing.",
    storySnippet: "Loaisiga's Infiel limited edition points to a box-pressed toro release, the kind of Dominican-made allocation story worth watching early.",
    href: "https://halfwheel.com/loaisiga-cigars-announces-infiel-limited-edition-box-press-toro/470711/",
    image: "https://halfwheel.com/wp-content/uploads/2026/05/Loaisiga-Infiel-Limited-Edition-Box-Press-Toro-feature-1-768x520.jpg",
    imagePosition: "50% 52%",
    publishedAt: "May 2026",
    readTime: "Industry",
    tags: ["Industry", "Dominican Republic", "Trade"],
    likes: 219,
    comments: 18,
    saves: 67,
  },
  {
    id: "founder-reserve-ash-shot",
    kind: "member",
    mediaType: "video",
    sourceName: "Yuzu member post",
    sourceHandle: "@lockerA12",
    title: "Founder Reserve first-third check-in",
    excerpt: "Member clip: clean draw, cocoa lift, and a slow burn line after 42 days of rest in a 69% locker.",
    storySnippet: "This member check-in captures the first third after 42 days of rest, calling out draw, cocoa lift, and burn line before the smoke develops.",
    href: "/humidor",
    image: "/assets/journal-aging.png",
    imagePosition: "48% 50%",
    publishedAt: "May 7, 2026",
    readTime: "Member video",
    tags: ["Member post", "Aging", "Smoke log"],
    likes: 187,
    comments: 24,
    saves: 51,
    videoDuration: "1:12",
  },
  {
    id: "padron-box-note",
    kind: "member",
    mediaType: "image",
    sourceName: "Yuzu member post",
    sourceHandle: "@senseitable",
    title: "Padron box note after six months",
    excerpt: "Cedar sharpened, cocoa settled down, and the final third now carries a cleaner espresso finish.",
    storySnippet: "The Padron box note follows six months of humidor time, with cedar, cocoa, and a cleaner espresso finish becoming the useful takeaways.",
    href: "/humidor",
    image: "/assets/product-padron.png",
    imagePosition: "50% 50%",
    publishedAt: "May 7, 2026",
    readTime: "Smoke log",
    tags: ["Member post", "Padron", "Aging note"],
    likes: 246,
    comments: 31,
    saves: 83,
  },
  {
    id: "cigar-prop-anniversary",
    kind: "manufacturer",
    mediaType: "image",
    sourceName: "Cigar Prop",
    sourceHandle: "@cigarpropwatch",
    title: "Cigar Prop Releases 10th Anniversary Commemorative Cigar",
    excerpt: "A commemorative release card for members who follow creator-led collaborations and short-window drops.",
    storySnippet: "Cigar Prop's anniversary piece follows a creator-led commemorative cigar and stand package, tuned for members who watch collaboration drops.",
    href: "https://cigardojo.com/2026/05/cigar-prop-releases-10th-anniversary-commemorative-cigar/",
    image: "https://cigardojo.com/wp-content/uploads/2026/05/Cigar-Prop-10th-Anniversary-Cigar-and-stand.jpg",
    imagePosition: "50% 52%",
    publishedAt: "May 2026",
    readTime: "Drop",
    tags: ["Commemorative", "Creator", "New release"],
    likes: 303,
    comments: 28,
    saves: 96,
  },
  {
    id: "weekly-news-may-4-2026",
    kind: "rss",
    mediaType: "image",
    sourceName: "halfwheel",
    sourceHandle: "@halfwheel",
    title: "Weekly News: May 4, 2026",
    excerpt: "A broad industry roundup card for members who want the quick scan before diving into individual releases.",
    storySnippet: "The weekly news roundup gives a scan of current cigar industry items, best used as a jump point before opening individual release stories.",
    href: "https://halfwheel.com/weekly-news-may-4-2026/470603/",
    image: "https://halfwheel.com/wp-content/uploads/2023/03/Weekly-News-768x513.jpg",
    imagePosition: "50% 50%",
    publishedAt: "May 2026",
    readTime: "Allocation",
    tags: ["Allocation", "International", "Limited"],
    likes: 268,
    comments: 22,
    saves: 111,
  },
];

export const cigarFlowStats = [
  { label: "Sources", value: `${cigarFlowSources.length}`, detail: "Feeds and news monitors" },
  { label: "Makers", value: `${officialCigarNewsSources.length}`, detail: "Official manufacturer pages" },
  { label: "Flow cards", value: `${cigarFlowItems.length}`, detail: "News and member posts" },
  {
    label: "Member posts",
    value: `${cigarFlowItems.filter((item) => item.kind === "member").length}`,
    detail: "Smoke logs in the feed",
  },
];
