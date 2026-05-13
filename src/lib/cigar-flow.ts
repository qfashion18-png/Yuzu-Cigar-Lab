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

export const cigarFlowAutomation: CigarFlowAutomation = {
  id: "cigar-flow-friday-update",
  cadence: "Fridays at 8:00 AM America/Phoenix",
  owner: "Codex recurring workspace agent",
  outputTargets: ["Cigar Flow feed", "Education weekly article", "Newsletter draft"],
  updateScope: [
    "Research the preceding day's cigar and cigar-adjacent news from verified sources.",
    "Refresh the first ten Cigar Flow cards in src/lib/cigar-flow.ts with current source links, images, and compact reader snippets.",
    "Keep member smoke-log cards distinct from RSS and manufacturer cards.",
    "Run project validation before reporting the update.",
  ],
};

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
  { label: "Flow cards", value: `${cigarFlowItems.length}`, detail: "News and member posts" },
  {
    label: "Member posts",
    value: `${cigarFlowItems.filter((item) => item.kind === "member").length}`,
    detail: "Smoke logs in the feed",
  },
];
