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
    id: "plasencia-triunfal-arrives-at-stores",
    kind: "manufacturer",
    mediaType: "image",
    sourceName: "halfwheel",
    sourceHandle: "@halfwheel",
    title: "Plasencia Triunfal, a World Cup 2026 Cigar, Arrives at Stores",
    excerpt: "A premium limited release landing now - worth bookmarking for allocation timing and first-wave availability.",
    storySnippet:
      "Plasencia's Triunfal arrives as a World Cup-inspired limited edition, giving members a clean, dated checkpoint to decide whether to hunt early boxes or wait for a second wave.",
    href: "https://halfwheel.com/plasencia-triunfal-a-world-cup-2026-cigar-arrives-at-stores/471086/",
    image: "https://halfwheel.com/wp-content/uploads/2026/04/Plasencia-Triunfal.jpg",
    imagePosition: "50% 44%",
    publishedAt: "May 12, 2026",
    readTime: "Release watch",
    tags: ["Manufacturer", "Limited", "World Cup 2026"],
    likes: 604,
    comments: 49,
    saves: 221,
    featured: true,
  },
  {
    id: "weekly-news-may-11-2026",
    kind: "rss",
    mediaType: "image",
    sourceName: "halfwheel",
    sourceHandle: "@halfwheel",
    title: "Weekly News (May 11, 2026)",
    excerpt: "A quick scan roundup for the week - best used to triage which releases and policy notes deserve a deeper read.",
    storySnippet:
      "This roundup is the fastest way to catch the week's big beats, useful as a launchpad before you jump into specific release stories or regulation updates.",
    href: "https://halfwheel.com/weekly-news-may-11-2026/470867/",
    image: "https://halfwheel.com/wp-content/uploads/2023/03/Weekly-News.jpg",
    imagePosition: "50% 50%",
    publishedAt: "May 11, 2026",
    readTime: "Roundup",
    tags: ["Industry", "Roundup", "Release radar"],
    likes: 412,
    comments: 33,
    saves: 176,
  },
  {
    id: "fratello-1821-dominican-republic",
    kind: "rss",
    mediaType: "image",
    sourceName: "halfwheel",
    sourceHandle: "@halfwheel",
    title: "Fratello 1821 Dominican Republic",
    excerpt: "A puro-style concept release for members tracking country-specific blends and limited batch timing.",
    storySnippet:
      "Fratello's 1821 Dominican Republic entry keeps the 'single-country' idea front and center, making it easy to decide if the format and batch cadence fit your buying plan.",
    href: "https://halfwheel.com/fratello-1821-dominican-republic/471079/",
    image: "https://halfwheel.com/wp-content/uploads/2026/05/Fratello-1821-Dominican-Republic-2.jpg",
    imagePosition: "50% 52%",
    publishedAt: "May 12, 2026",
    readTime: "Review",
    tags: ["Review", "Dominican Republic", "New release"],
    likes: 338,
    comments: 26,
    saves: 121,
  },
  {
    id: "partagas-y-nada-mas-cibao-arriving",
    kind: "manufacturer",
    mediaType: "image",
    sourceName: "halfwheel",
    sourceHandle: "@halfwheel",
    title: "Partagas Y Nada Más Cibao Arriving at Stores",
    excerpt: "Shipping moved up - a useful availability marker for members watching STG releases hit shelves.",
    storySnippet:
      "The Partagas Y Nada Más follow-up lands ahead of schedule, making this a clean 'now shipping' marker to check your preferred retailers before allocations thin out.",
    href: "https://halfwheel.com/stgs-partagas-y-nada-mas-cibao-arriving-at-stores/471045/",
    image: "https://halfwheel.com/wp-content/uploads/2026/04/Partagas-Y-Nada-Mas-Cibao.jpg",
    imagePosition: "50% 48%",
    publishedAt: "May 11, 2026",
    readTime: "Shipping",
    tags: ["Manufacturer", "STG", "Now shipping"],
    likes: 459,
    comments: 37,
    saves: 168,
  },
  {
    id: "drunk-chicken-limiteds-shipping",
    kind: "manufacturer",
    mediaType: "video",
    sourceName: "halfwheel",
    sourceHandle: "@halfwheel",
    title: "Drunk Chicken Ships Mother Clucker Maduro & Living the Dream Connecticut",
    excerpt: "Two limited editions on the move - a fast cue to check store shipments if you collect small-run brands.",
    storySnippet:
      "Drunk Chicken's newest limited editions are shipping, so this is a good moment to set a reminder and check your shops before the first wave disappears.",
    href: "https://halfwheel.com/drunk-chicken-ships-mother-clucker-maduro-living-the-dream-connecticut/471023/",
    image: "https://halfwheel.com/wp-content/uploads/2026/04/Drunk-Chicken-Mother-Clucker-Maduro.jpg",
    imagePosition: "48% 44%",
    publishedAt: "May 11, 2026",
    readTime: "Drop",
    tags: ["Manufacturer", "Limited", "Shipping"],
    likes: 521,
    comments: 44,
    saves: 204,
    videoDuration: "0:47",
  },
  {
    id: "leaf-by-oscar-broadleaf-limited-edition-2025",
    kind: "rss",
    mediaType: "image",
    sourceName: "halfwheel",
    sourceHandle: "@halfwheel",
    title: "Leaf by Oscar Broadleaf Limited Edition 2025",
    excerpt: "A redux-style follow-up worth revisiting if you track limited runs and want a second look at performance over time.",
    storySnippet:
      "The Leaf by Oscar Broadleaf Limited Edition 2025 entry is a useful reminder that limited releases can evolve - and it's a good prompt to check how your own stash is aging.",
    href: "https://halfwheel.com/leaf-by-oscar-broadleaf-limited-edition-2025-2/471011/",
    image: "https://halfwheel.com/wp-content/uploads/2026/05/Leaf-by-Oscar-Broadleaf-Limited-Edition-2025.jpg",
    imagePosition: "50% 46%",
    publishedAt: "May 11, 2026",
    readTime: "Redux",
    tags: ["Review", "Limited", "Redux"],
    likes: 377,
    comments: 29,
    saves: 140,
  },
  {
    id: "illusione-group-of-five-se",
    kind: "rss",
    mediaType: "image",
    sourceName: "halfwheel",
    sourceHandle: "@halfwheel",
    title: "Illusione Group of Five SE",
    excerpt: "A blend spotlight for members who like to track new seed varietals and what they mean for flavor direction.",
    storySnippet:
      "Illusione's Group of Five SE note frames a new-to-Nicaragua seed story, giving members a clean entry point for deciding whether to sample now or wait for broader availability.",
    href: "https://halfwheel.com/illusione-group-of-five-se/466504/",
    image: "https://halfwheel.com/wp-content/uploads/2026/05/Illusione-Group-of-Five-SE-2.jpg",
    imagePosition: "50% 50%",
    publishedAt: "May 10, 2026",
    readTime: "Review",
    tags: ["Review", "Nicaragua", "Blend notes"],
    likes: 286,
    comments: 21,
    saves: 97,
  },
  {
    id: "california-cigar-tax-rate-decrease",
    kind: "rss",
    mediaType: "image",
    sourceName: "halfwheel",
    sourceHandle: "@halfwheel",
    title: "California’s Cigar Tax Rate Decreasing This Summer",
    excerpt: "A policy note that impacts pricing math - useful context for members planning higher-MSRP pickups.",
    storySnippet:
      "California's annual tax adjustment trends slightly downward this summer, which is a good moment to revisit your pricing assumptions before making big-box purchases.",
    href: "https://halfwheel.com/californias-cigar-tax-rate-decreasing-this-summer/470961/",
    image: "https://halfwheel.com/wp-content/uploads/2015/01/California-flag-620x420.png",
    imagePosition: "50% 50%",
    publishedAt: "May 10, 2026",
    readTime: "Regulation",
    tags: ["Taxes", "California", "Policy"],
    likes: 243,
    comments: 19,
    saves: 88,
  },
  {
    id: "pca-2026-diesel",
    kind: "rss",
    mediaType: "image",
    sourceName: "Cigar Coop",
    sourceHandle: "@cigarcoop",
    title: "PCA 2026: Diesel",
    excerpt: "Trade show floor coverage for members tracking PCA-limited editions and booth intel before products ship.",
    storySnippet:
      "This PCA 2026 floor report keeps Diesel's limited edition lineup in view, helping members decide which releases to flag for follow-up once shipping details firm up.",
    href: "https://cigar-coop.com/2026/05/pca-2026-diesel.html",
    image: "https://cigar-coop.com/wp-content/uploads/2026/05/diesel-logo.jpg",
    imagePosition: "50% 50%",
    publishedAt: "May 12, 2026",
    readTime: "Trade show",
    tags: ["PCA 2026", "Show floor", "Limited editions"],
    likes: 314,
    comments: 27,
    saves: 102,
  },
  {
    id: "st-dupont-250th-anniversary-haute-collection",
    kind: "rss",
    mediaType: "image",
    sourceName: "Cigar Coop",
    sourceHandle: "@cigarcoop",
    title: "S.T. Dupont 250th Anniversary Haute Collection Showcased at PCA 2026",
    excerpt: "Accessory watch for collectors: an ultra-premium lighter/cutter set that pairs well with special-occasion purchases.",
    storySnippet:
      "S.T. Dupont's 250th anniversary set is a reminder that accessories can be the real 'limited edition' - useful context if you're planning a milestone gift or case buildout.",
    href: "https://cigar-coop.com/2026/05/s-t-dupont-250th-anniversary-haute-collection-showcased-at-pca-2026-cigar-news.html",
    image: "https://cigar-coop.com/wp-content/uploads/2026/05/ST_Dupont-250_Haute.jpeg",
    imagePosition: "50% 50%",
    publishedAt: "May 11, 2026",
    readTime: "Accessories",
    tags: ["Accessories", "PCA 2026", "Collector"],
    likes: 271,
    comments: 18,
    saves: 96,
  },
  {
    id: "fda-commissioner-makary-resigns-update",
    kind: "rss",
    mediaType: "image",
    sourceName: "halfwheel",
    sourceHandle: "@halfwheel",
    title: "FDA Commissioner Martin Makary Resigns (Update)",
    excerpt: "Regulatory whiplash matters: leadership changes can shift timelines for premium tobacco and adjacent enforcement priorities.",
    storySnippet:
      "This FDA leadership update is the kind of policy signal that changes the conversation quickly, making it worth keeping a dated note in your weekly industry scan.",
    href: "https://halfwheel.com/report-trump-planning-on-firing-fda-commissioner-marin-makary/470900/",
    image: "https://halfwheel.com/wp-content/uploads/2022/05/FDA-Logo.jpeg",
    imagePosition: "50% 50%",
    publishedAt: "May 12, 2026",
    readTime: "Regulation",
    tags: ["FDA", "Regulation", "Policy watch"],
    likes: 352,
    comments: 64,
    saves: 139,
  },
  {
    id: "founder-reserve-first-third-check-in",
    kind: "member",
    mediaType: "video",
    sourceName: "Yuzu member post",
    sourceHandle: "@lockerA12",
    title: "Release-week rest test: first-third check-in",
    excerpt: "Member clip: testing draw and burn line after a short rest, noting what changed between day one and day seven.",
    storySnippet:
      "This smoke-log clip captures a quick first-third check after a one-week rest, highlighting draw, burn, and the moment the profile starts to open up.",
    href: "/humidor",
    image: "/assets/journal-aging.png",
    imagePosition: "48% 50%",
    publishedAt: "May 14, 2026",
    readTime: "Member video",
    tags: ["Member post", "Aging", "Smoke log"],
    likes: 193,
    comments: 22,
    saves: 57,
    videoDuration: "1:08",
  },
  {
    id: "padron-humidor-note-spring-rotation",
    kind: "member",
    mediaType: "image",
    sourceName: "Yuzu member post",
    sourceHandle: "@senseitable",
    title: "Padron rotation note: mid-humidor sweep",
    excerpt: "Member note: rotating boxes and tracking how the last third cleans up after a humidity tweak.",
    storySnippet:
      "A short written log that ties a simple rotation and humidity adjustment to a cleaner finish, useful for members who like controlled, repeatable changes.",
    href: "/humidor",
    image: "/assets/product-padron.png",
    imagePosition: "50% 50%",
    publishedAt: "May 14, 2026",
    readTime: "Smoke log",
    tags: ["Member post", "Padron", "Humidor care"],
    likes: 248,
    comments: 28,
    saves: 91,
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
