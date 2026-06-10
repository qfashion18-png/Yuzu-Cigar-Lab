import type { MetadataRoute } from "next";
import type { ProductCardItem } from "@/components/product-card";

import { storefrontCategories, storefrontProductCards } from "@/lib/catalog";
import { absoluteUrl } from "@/lib/seo";
export { seoFooterLinks } from "@/lib/seo-links";

export type SeoFaq = {
  question: string;
  answer: string;
};

export type SeoInternalLink = {
  label: string;
  href: string;
  description: string;
};

export type SeoContentSection = {
  heading: string;
  body: string;
  bullets: string[];
};

export type SeoVisualLesson = {
  label: string;
  image: string;
  imageAlt: string;
  imagePosition?: string;
  copy: string;
};

export type SeoResearchNote = {
  label: string;
  takeaway: string;
  sourceLabel: string;
  sourceUrl: string;
};

export type SeoContentPage = {
  slug: string;
  path: string;
  metadataTitle: string;
  title: string;
  description: string;
  kicker: string;
  heroTitle: string;
  heroCopy: string;
  image: string;
  imageAlt: string;
  imagePosition?: string;
  atelierImage?: string;
  atelierImageAlt?: string;
  atelierImagePosition?: string;
  keywords: string[];
  intent: string;
  primaryCta: SeoInternalLink;
  secondaryCta: SeoInternalLink;
  sections: SeoContentSection[];
  faqs: SeoFaq[];
  internalLinks: SeoInternalLink[];
  visualLessons?: SeoVisualLesson[];
  researchNotes?: SeoResearchNote[];
  productCategories: string[];
  updatedAt: string;
};

export type CategorySeoPage = SeoContentPage & {
  category: string;
  products: ProductCardItem[];
  shopFilterHref: string;
};

const contentUpdatedAt = "2026-06-08T00:00:00.000Z";

const guideResearchSources = {
  fdaTobacco21: {
    sourceLabel: "FDA Tobacco 21",
    sourceUrl: "https://www.fda.gov/tobacco-products/retail-sales-tobacco-products/tobacco-21",
  },
  wrapperColors: {
    sourceLabel: "Tobacconist University wrapper color FAQ",
    sourceUrl: "https://tobacconistuniversity.org/faq_cigar_wrapper_color.php",
  },
  flavorChart: {
    sourceLabel: "Tobacconist University flavor chart",
    sourceUrl: "https://www.tobacconistuniversity.org/pdf/flavorchart.pdf",
  },
  storageRh: {
    sourceLabel: "Boveda cigar RH guide",
    sourceUrl: "https://bovedainc.com/question/what-rh-is-right-for-me/",
  },
  cuttingLighting: {
    sourceLabel: "Cigar Aficionado cutting and lighting guide",
    sourceUrl: "https://www.cigaraficionado.com/article/cutting-and-lighting-8090",
  },
  blendAnatomy: {
    sourceLabel: "Cigar Aficionado blend anatomy",
    sourceUrl: "https://www.cigaraficionado.com/article/what-s-the-most-important-part-of-a-cigar",
  },
  primingStrength: {
    sourceLabel: "Cigar Aficionado tobacco priming report",
    sourceUrl: "https://www.cigaraficionado.com/article/drought-in-dominican-republic-means-smaller-but-better-tobacco-harvest",
  },
  strengthBodyMisconceptions: {
    sourceLabel: "Cigar Advisor strength and body guide",
    sourceUrl: "https://www.famous-smoke.com/cigaradvisor/cigars-101/difference-between-cigar-strength-and-body",
  },
  rumPairings: {
    sourceLabel: "Cigar Aficionado rum pairing tasting",
    sourceUrl: "https://www.cigaraficionado.com/index.php/article/the-pairings-rum-meets-cigars",
  },
  bourbonPairings: {
    sourceLabel: "Cigar Aficionado bourbon pairing tasting",
    sourceUrl: "https://www.cigaraficionado.com/index.php/article/bonding-with-bourbon",
  },
} as const;

const adultOnlyResearchNote: SeoResearchNote = {
  label: "Adult-only cigar education",
  takeaway:
    "The guide keeps cigar education and shopping paths clearly for adults 21+, matching federal Tobacco 21 rules that cover cigars and other tobacco products.",
  ...guideResearchSources.fdaTobacco21,
};

export const seoLandingPages: SeoContentPage[] = [
  {
    slug: "cigar-subscription",
    path: "/cigar-subscription/",
    metadataTitle: "Premium Cigar Subscription and Box Membership | Yuzu Cigar Club",
    title: "Premium Cigar Subscription",
    description:
      "Compare Yuzu Cigar Club membership options for adults 21+ who want curated monthly cigar selection windows, member-cost box access, digital humidor tools, and private drop alerts.",
    kicker: "Membership guide",
    heroTitle: "A cigar subscription built around real box buying.",
    heroCopy:
      "Yuzu is designed for adults who want more than a random sampler. Membership connects preselected monthly cigar lists, direct member-cost box access, private allocations, and a digital humidor that keeps every purchase organized.",
    image: "/assets/membership-boxes.png",
    imageAlt: "Yuzu Cigar Club membership boxes prepared for adult members",
    imagePosition: "54% 48%",
    keywords: ["cigar subscription", "premium cigar membership", "monthly cigar club", "cigar box membership"],
    intent: "Adults comparing cigar subscription clubs and premium cigar memberships.",
    primaryCta: {
      label: "Compare Memberships",
      href: "/membership/",
      description: "Review member tiers, monthly selection windows, and box access.",
    },
    secondaryCta: {
      label: "Shop Member Boxes",
      href: "/shop/",
      description: "Browse the current public catalog before choosing a tier.",
    },
    productCategories: ["Premium Cigars ($150-$300)", "Luxury Cigars ($300+)", "Sample Packs"],
    sections: [
      {
        heading: "What makes the Yuzu model different",
        body:
          "Most cigar clubs focus on one fixed monthly delivery. Yuzu treats membership as an operating system for a cigar collection: preselected monthly lists, first-come selection windows, box buying, private drops, adult-signature shipping, and notes that stay tied to your humidor.",
        bullets: ["Preselected monthly lists", "First-come selection windows", "Digital humidor history", "Adult-compliant checkout"],
      },
      {
        heading: "Who should choose a cigar subscription",
        body:
          "A subscription makes sense when you want guided discovery, a predictable cadence, and a cleaner path from tasting one cigar to buying the right box. It is especially useful for adults building taste notes across wrapper, origin, and strength.",
        bullets: ["Newer smokers learning preferences", "Collectors watching allocations", "Gift buyers who want recurring value"],
      },
      {
        heading: "How to evaluate value",
        body:
          "Look past the headline price. Compare cigar count, box access, shipping rules, support, allocation priority, and whether the club helps you remember what you liked after the cigar is gone.",
        bullets: ["Check monthly cadence", "Compare box pricing rules", "Review shipping and age verification", "Track favorites in the humidor"],
      },
    ],
    faqs: [
      {
        question: "Is Yuzu Cigar Club a cigar subscription?",
        answer:
          "Yes. Yuzu offers paid membership tiers with curated monthly cigar selection windows, member-cost box access, private drops, and digital humidor tools for adults 21+.",
      },
      {
        question: "Can members buy full boxes?",
        answer:
          "Yes. Box access is central to the membership. Members can browse eligible boxes and use the digital humidor to track purchases, aging windows, and reorder notes.",
      },
      {
        question: "Do cigar subscription orders require age verification?",
        answer:
          "Yes. Yuzu is built for adult customers only and uses age-gated browsing, checkout verification, and adult-signature delivery controls where required.",
      },
    ],
    internalLinks: [
      { label: "Membership tiers", href: "/membership/", description: "Compare monthly selection windows, discounts, and box access." },
      { label: "Premium cigar boxes", href: "/shop/categories/premium-cigars-150-300/", description: "Browse premium boxes that fit many club members." },
      { label: "Limited edition cigars", href: "/limited-edition-cigars/", description: "Learn how private drops and allocations work." },
      { label: "Cigars for beginners", href: "/cigars-for-beginners/", description: "Start with strength, wrapper, and storage basics." },
    ],
    updatedAt: contentUpdatedAt,
  },
  {
    slug: "cigar-gifts",
    path: "/cigar-gifts/",
    metadataTitle: "Premium Cigar Gifts for Adults 21+ | Yuzu Cigar Club",
    title: "Premium Cigar Gifts",
    description:
      "Find premium cigar gift ideas for adults 21+, including curated boxes, sampler-friendly picks, humidor accessories, member experiences, and education-first buying guidance.",
    kicker: "Gift guide",
    heroTitle: "Cigar gifts that feel considered, not generic.",
    heroCopy:
      "The best cigar gift respects the recipient's taste, storage setup, and experience level. Yuzu helps gift buyers choose between accessible samplers, premium boxes, humidor tools, and membership options.",
    image: "/assets/gift-box.png",
    imageAlt: "Premium cigar gift box arranged for adult gifting",
    imagePosition: "50% 52%",
    keywords: ["cigar gifts", "premium cigar gifts", "cigar gift box", "gifts for cigar lovers"],
    intent: "Gift buyers looking for premium cigar boxes, samplers, and accessories for adults 21+.",
    primaryCta: {
      label: "Shop Giftable Boxes",
      href: "/shop/",
      description: "Browse boxes, sample packs, accessories, and member-ready picks.",
    },
    secondaryCta: {
      label: "Read Beginner Guide",
      href: "/cigars-for-beginners/",
      description: "Choose a safer first gift by learning the basics.",
    },
    productCategories: ["Sample Packs", "Premium Cigars ($150-$300)", "Humidors"],
    sections: [
      {
        heading: "Start with experience level",
        body:
          "A newer smoker may appreciate a forgiving sampler or mild-to-medium box. A collector may value a rare allocation, a known brand, or a humidor upgrade more than a broad assortment.",
        bullets: ["Beginner-friendly samplers", "Premium boxes for enthusiasts", "Humidor accessories for collectors"],
      },
      {
        heading: "Match the gift to the occasion",
        body:
          "Weddings, client gifts, milestone birthdays, and lounge nights each call for a different format. A full box works well for shared celebrations, while a membership can become a recurring gift.",
        bullets: ["Celebration boxes", "Recurring membership", "Accessories for storage and lighting"],
      },
      {
        heading: "Keep compliance visible",
        body:
          "Cigar gifts are adult products. Yuzu keeps age-gated browsing, checkout verification, and adult-signature delivery close to the shopping flow so gift buying stays responsible.",
        bullets: ["Adults 21+ only", "Age verification before fulfillment", "Adult-signature delivery where required"],
      },
    ],
    faqs: [
      {
        question: "What is a good cigar gift for a beginner?",
        answer:
          "Choose a mild-to-medium sampler, a smaller premium box, or a membership tier that includes guidance. Avoid guessing at very strong cigars unless you know the recipient's preferences.",
      },
      {
        question: "Can I give a cigar membership as a gift?",
        answer:
          "A Yuzu membership can work as a recurring gift for an adult recipient, especially when they want curated cigars, member pricing, and humidor tracking over time.",
      },
      {
        question: "Are cigar gifts shipped directly?",
        answer:
          "Eligible orders can be shipped, but age verification, shipping rules, and adult-signature requirements apply before any tobacco product is fulfilled.",
      },
    ],
    internalLinks: [
      { label: "Sample packs", href: "/shop/categories/sample-packs/", description: "Browse flexible gift-friendly samplers." },
      { label: "Humidor guide", href: "/humidor-guide/", description: "Understand storage before gifting a box." },
      { label: "Cigar etiquette", href: "/guides/cigar-etiquette/", description: "Help the recipient enjoy the moment well." },
      { label: "Membership", href: "/membership/", description: "Compare recurring gift options." },
    ],
    updatedAt: contentUpdatedAt,
  },
  {
    slug: "cigars-for-beginners",
    path: "/cigars-for-beginners/",
    metadataTitle: "Cigars for Beginners: Strength, Wrapper, Storage | Yuzu Cigar Club",
    title: "Cigars for Beginners",
    description:
      "Learn how to choose cigars for beginners with clear guidance on wrapper types, strength, size, storage, lighting, pacing, and adult-compliant buying.",
    kicker: "Beginner guide",
    heroTitle: "Start with cigars you can actually understand.",
    heroCopy:
      "A good first cigar is not just mild or inexpensive. It is well stored, clearly described, matched to your pace, and easy to compare against the next smoke. This guide gives adults a clean starting map.",
    image: "/refs/journal.png",
    imageAlt: "Cigar journal and tasting notes for beginners",
    imagePosition: "64% 50%",
    keywords: ["cigars for beginners", "beginner cigar guide", "how to choose a cigar", "cigar strength guide"],
    intent: "Adults learning how to choose their first cigars and avoid expensive mistakes.",
    primaryCta: {
      label: "Shop Beginner-Friendly Picks",
      href: "/shop/categories/sample-packs/",
      description: "Start with flexible formats before committing to a large box.",
    },
    secondaryCta: {
      label: "Read Wrapper Guide",
      href: "/guides/wrapper-types/",
      description: "Learn how wrapper, binder, and filler shape flavor.",
    },
    productCategories: ["Sample Packs", "Budget Cigars (Under $50)", "Mid-Range Cigars ($50-$150)"],
    sections: [
      {
        heading: "Choose by strength and body separately",
        body:
          "Beginners often use strength to mean everything. Separate nicotine strength, smoke body, and flavor intensity so you can choose a cigar that stays enjoyable instead of overwhelming.",
        bullets: ["Mild does not always mean flavorless", "Full flavor can still be balanced", "Eat first when trying stronger cigars"],
      },
      {
        heading: "Use samplers as learning tools",
        body:
          "A sampler is most useful when each cigar teaches a contrast: wrapper, origin, size, or strength. Keep simple notes so the second purchase is smarter than the first.",
        bullets: ["Compare one variable at a time", "Write three flavor notes", "Save favorites in the humidor"],
      },
      {
        heading: "Storage matters from day one",
        body:
          "Even a beginner cigar can taste harsh if it is dry or muted if it is too wet. A basic humidor routine protects the experience and makes your notes more reliable.",
        bullets: ["Rest shipped cigars before judging", "Watch humidity trends", "Avoid constant lid opening"],
      },
    ],
    faqs: [
      {
        question: "What cigar should a beginner start with?",
        answer:
          "Many beginners do well with mild-to-medium cigars, sample packs, and clear flavor profiles such as cedar, cream, toast, cocoa, or light spice.",
      },
      {
        question: "Are dark cigars always stronger?",
        answer:
          "No. Dark wrapper can signal sweetness, cocoa, or earth, but nicotine strength depends on the whole blend. Use wrapper as a clue, not a verdict.",
      },
      {
        question: "How should beginners store cigars?",
        answer:
          "Keep cigars in stable humidity, avoid heat, and give shipped cigars time to rest before judging flavor. The humidor guide explains the basic setup.",
      },
    ],
    internalLinks: [
      { label: "Wrapper types", href: "/guides/wrapper-types/", description: "Learn Connecticut, Habano, Maduro, and more." },
      { label: "Cigar strength", href: "/guides/cigar-strength/", description: "Separate body, flavor, and nicotine strength." },
      { label: "Humidor guide", href: "/humidor-guide/", description: "Protect your first box with stable storage." },
      { label: "Sample packs", href: "/shop/categories/sample-packs/", description: "Browse beginner-friendly discovery formats." },
    ],
    updatedAt: contentUpdatedAt,
  },
  {
    slug: "humidor-guide",
    path: "/humidor-guide/",
    metadataTitle: "Humidor Guide: Setup, Humidity, Aging, Tracking | Yuzu Cigar Club",
    title: "Humidor Guide",
    description:
      "Set up and manage a cigar humidor with guidance on humidity targets, temperature, box aging, travel shock, storage notes, and Yuzu digital humidor tools.",
    kicker: "Storage guide",
    heroTitle: "A calmer way to protect every box.",
    heroCopy:
      "A humidor should make cigar ownership simpler. Learn the core storage ranges, how to avoid overcorrection, when to rest shipments, and how Yuzu's digital humidor keeps purchase dates and tasting windows visible.",
    image: "/refs/mobile-layout.png",
    imageAlt: "Digital humidor interface for tracking cigar boxes",
    imagePosition: "50% 50%",
    keywords: ["humidor guide", "cigar humidor setup", "cigar storage", "digital humidor"],
    intent: "Adults learning how to store cigars, age boxes, and track a personal collection.",
    primaryCta: {
      label: "Open Digital Humidor",
      href: "/humidor/",
      description: "Track boxes, notes, ratings, and aging reminders.",
    },
    secondaryCta: {
      label: "Shop Humidors",
      href: "/shop/categories/humidors/",
      description: "Browse humidor products and storage accessories.",
    },
    productCategories: ["Humidors", "Premium Cigars ($150-$300)", "Luxury Cigars ($300+)"],
    sections: [
      {
        heading: "Stability beats constant adjustment",
        body:
          "Most cigar storage problems come from panic changes. Aim for a steady range, check trends instead of single readings, and avoid opening the humidor every day.",
        bullets: ["Target stable humidity", "Keep temperature moderate", "React to trends, not tiny swings"],
      },
      {
        heading: "Rest before you review",
        body:
          "Shipping can temporarily change aroma, draw, and burn. Give new boxes a quiet rest, then smoke one cigar as a baseline before deciding how the rest should age.",
        bullets: ["Log arrival date", "Set a first-smoke date", "Compare at six and twelve months"],
      },
      {
        heading: "Use notes to build a collection",
        body:
          "A digital humidor turns scattered memories into buying intelligence. Save wrapper, strength, rating, pairing, and reorder notes so every box makes the next purchase easier.",
        bullets: ["Track aging windows", "Record tasting notes", "Create reorder reminders"],
      },
    ],
    faqs: [
      {
        question: "What humidity should cigars be stored at?",
        answer:
          "Many premium cigars perform well around the mid-to-high 60% range, but the best target depends on cigar style, environment, and personal preference.",
      },
      {
        question: "How long should shipped cigars rest?",
        answer:
          "A short rest period helps cigars recover from travel. Serious collectors often compare one cigar after rest, another after several months, and another after longer aging.",
      },
      {
        question: "What does a digital humidor do?",
        answer:
          "Yuzu's digital humidor helps adults track boxes, purchase dates, tasting notes, ratings, pairings, and reorder reminders alongside their real collection.",
      },
    ],
    internalLinks: [
      { label: "Digital humidor", href: "/humidor/", description: "Use Yuzu tools to manage your collection." },
      { label: "Cigar storage guide", href: "/guides/cigar-storage/", description: "Read the deeper storage article." },
      { label: "Humidors", href: "/shop/categories/humidors/", description: "Browse storage products in the catalog." },
      { label: "Box aging workshop", href: "/events/cigar-aging-workshop/", description: "Join an education event about aging and storage." },
    ],
    updatedAt: contentUpdatedAt,
  },
  {
    slug: "limited-edition-cigars",
    path: "/limited-edition-cigars/",
    metadataTitle: "Limited Edition Cigars and Private Box Drops | Yuzu Cigar Club",
    title: "Limited Edition Cigars",
    description:
      "Explore how Yuzu Cigar Club handles limited edition cigars, rare box allocations, member drops, release alerts, and fair access for adult collectors.",
    kicker: "Allocation guide",
    heroTitle: "Limited cigars deserve clear rules and patient buying.",
    heroCopy:
      "Scarcity is only useful when the cigar is worth smoking. Yuzu helps adults evaluate limited boxes by maker, age, blend structure, allocation rules, and whether a release belongs in the humidor now or later.",
    image: "/assets/hero-boxes.png",
    imageAlt: "Limited premium cigar boxes prepared for Yuzu members",
    imagePosition: "56% 52%",
    keywords: ["limited edition cigars", "rare cigars", "cigar drops", "premium cigar boxes"],
    intent: "Collectors researching limited cigar releases, rare boxes, monthly selection windows, and private allocations.",
    primaryCta: {
      label: "View Member Drops",
      href: "/member-drops/",
      description: "See member-focused monthly selection and drop experiences.",
    },
    secondaryCta: {
      label: "Shop Luxury Boxes",
      href: "/shop/categories/luxury-cigars-300/",
      description: "Browse the current luxury cigar box category.",
    },
    productCategories: ["Luxury Cigars ($300+)", "Premium Cigars ($150-$300)", "Arturo Fuente Cigars"],
    sections: [
      {
        heading: "Limited is not the same as better",
        body:
          "A limited cigar should still earn its space through construction, balance, tobacco selection, and aging potential. Yuzu's content helps members separate real quality signals from release noise.",
        bullets: ["Look for blend details", "Watch construction and age", "Avoid buying on scarcity alone"],
      },
      {
        heading: "Fair access matters",
        body:
          "Monthly selection windows and private drops work best when eligibility, timing, limits, and pickup or shipping rules are clear. Yuzu connects these rules to membership tiers so collectors understand the path before the release.",
        bullets: ["Preselected lists", "First-come claim windows", "Member reminders"],
      },
      {
        heading: "Plan the aging window",
        body:
          "Many limited boxes benefit from rest before judgment. Use the digital humidor to set first-smoke dates, compare notes over time, and avoid opening rare inventory too quickly.",
        bullets: ["Rest after shipment", "Smoke at intervals", "Save tasting and reorder notes"],
      },
    ],
    faqs: [
      {
        question: "How does Yuzu handle limited cigar drops?",
        answer:
          "Yuzu uses member-focused drop pages, monthly selection windows, reminders, event context, and tier-aware allocation messaging so adult collectors can understand access before a release.",
      },
      {
        question: "Are limited edition cigars always worth aging?",
        answer:
          "No. Some are best enjoyed after a short rest, while others have enough structure for longer aging. Construction, balance, and blend depth matter more than scarcity.",
      },
      {
        question: "Where should I track rare cigar boxes?",
        answer:
          "Use the digital humidor to record purchase date, rest date, tasting windows, rating, and pairing notes for each limited box.",
      },
    ],
    internalLinks: [
      { label: "Member drops", href: "/member-drops/", description: "See Yuzu's monthly selection and private drop surface." },
      { label: "Luxury cigars", href: "/shop/categories/luxury-cigars-300/", description: "Browse luxury box inventory." },
      { label: "Humidor guide", href: "/humidor-guide/", description: "Plan aging windows before opening rare boxes." },
      { label: "Events", href: "/events/", description: "Watch allocation nights and tasting events." },
    ],
    updatedAt: contentUpdatedAt,
  },
];

export const seoGuides: SeoContentPage[] = [
  {
    slug: "wrapper-types",
    path: "/guides/wrapper-types/",
    metadataTitle: "Cigar Wrapper Types Guide: Connecticut, Habano, Maduro | Yuzu",
    title: "Cigar Wrapper Types",
    description:
      "Learn how cigar wrapper types influence aroma, texture, and flavor, including Connecticut, Habano, Maduro, San Andres, Cameroon, and wrapper buying tips.",
    kicker: "Wrapper literacy",
    heroTitle: "Read the wrapper without judging by color alone.",
    heroCopy:
      "Wrapper leaf is the first thing you see, but it is only one part of the cigar. Learn how common wrappers shape aroma and texture while binder, filler, age, and construction complete the blend.",
    image: "/assets/guides/luxury-wrapper-types.png",
    imageAlt: "Cigar wrapper education notes on a tasting table",
    imagePosition: "60% 50%",
    atelierImage: "/assets/guides/luxury-guide-atelier.png",
    atelierImageAlt: "Luxury cigar education atelier with wrapper leaves and a tasting notebook",
    atelierImagePosition: "50% 50%",
    keywords: ["cigar wrapper types", "Connecticut wrapper", "Maduro wrapper", "Habano wrapper"],
    intent: "Adults researching cigar wrapper types before choosing a box.",
    primaryCta: {
      label: "Shop Cigars",
      href: "/shop/",
      description: "Browse boxes after learning wrapper basics.",
    },
    secondaryCta: {
      label: "Strength Guide",
      href: "/guides/cigar-strength/",
      description: "Learn how body and strength differ from wrapper color.",
    },
    productCategories: ["Premium Cigars ($150-$300)", "Mid-Range Cigars ($50-$150)", "Oliva Cigars"],
    visualLessons: [
      {
        label: "Read color as a clue",
        image: "/assets/guides/luxury-wrapper-types.png",
        imageAlt: "Cigar wrapper leaves and tasting notes for wrapper color education",
        imagePosition: "60% 50%",
        copy:
          "Use the wrapper image to compare Claro, Natural, Colorado, and Maduro signals, then confirm the blend before assuming sweetness, body, or strength.",
      },
      {
        label: "Compare lighter wrapper texture",
        image: "/assets/product-davidoff.png",
        imageAlt: "Cigar box with lighter wrapper cigars for Connecticut-style comparison",
        imagePosition: "50% 52%",
        copy:
          "Lighter wrapper cigars often make cream, cedar, hay, and almond easier to notice, especially when the draw is slow and the palate is fresh.",
      },
      {
        label: "Look past dark color",
        image: "/assets/product-liga.png",
        imageAlt: "Dark premium cigar box for Maduro wrapper comparison",
        imagePosition: "50% 50%",
        copy:
          "A darker wrapper can bring cocoa, molasses, earth, or espresso notes, but nicotine strength still depends on binder, filler, priming, and size.",
      },
    ],
    sections: [
      {
        heading: "Connecticut and shade-grown wrappers",
        body:
          "Connecticut-style cigars often bring cream, cedar, hay, almond, and a smoother start. They can still have structure, but they are common choices for morning smokes and newer palates.",
        bullets: ["Cream and cedar", "Often mild to medium", "Useful for first comparisons"],
      },
      {
        heading: "Habano, Corojo, and spicier leaves",
        body:
          "Habano and Corojo wrappers often bring pepper, toast, citrus peel, and baking spice. They can feel more energetic and are good tests for pace and pairing choices.",
        bullets: ["Pepper and toast", "Medium to fuller body", "Good with coffee or sparkling water"],
      },
      {
        heading: "Maduro and San Andres wrappers",
        body:
          "Maduro and San Andres wrappers often carry cocoa, earth, molasses, espresso, and a rounder texture. Dark color does not automatically mean stronger nicotine.",
        bullets: ["Cocoa and earth", "Sweetness from fermentation", "Strength depends on the full blend"],
      },
    ],
    researchNotes: [
      {
        label: "Maduro is a color and process cue",
        takeaway:
          "Tobacconist University distinguishes general Maduro color from a true Maduro wrapper, where longer or hotter fermentation can create richer, earthier, sweeter flavor.",
        ...guideResearchSources.wrapperColors,
      },
      adultOnlyResearchNote,
    ],
    faqs: [
      {
        question: "Does cigar wrapper color show strength?",
        answer:
          "Wrapper color can suggest flavor direction, but it does not prove nicotine strength. Binder, filler, vitola, and fermentation all influence the final experience.",
      },
      {
        question: "What is a good wrapper for beginners?",
        answer:
          "Many beginners start with Connecticut or balanced Habano cigars, then compare a Maduro once they understand body, pace, and flavor notes.",
      },
      {
        question: "What does Maduro mean?",
        answer:
          "Maduro means mature. In cigars, it usually refers to darker wrapper leaf that has gone through additional fermentation and can show cocoa, earth, or sweetness.",
      },
    ],
    internalLinks: [
      { label: "Cigars for beginners", href: "/cigars-for-beginners/", description: "Use wrapper knowledge in your first purchases." },
      { label: "Cigar strength", href: "/guides/cigar-strength/", description: "Separate color from body and strength." },
      { label: "Premium cigar boxes", href: "/shop/categories/premium-cigars-150-300/", description: "Browse premium boxes after reading." },
      { label: "Humidor guide", href: "/humidor-guide/", description: "Store wrapper leaf with stable humidity." },
    ],
    updatedAt: contentUpdatedAt,
  },
  {
    slug: "cigar-strength",
    path: "/guides/cigar-strength/",
    metadataTitle: "Cigar Strength Guide: Body, Flavor, Nicotine | Yuzu Cigar Club",
    title: "Cigar Strength Guide",
    description:
      "Understand cigar strength, body, flavor intensity, wrapper color, priming, filler, binder, vitola, and pace so mild, medium, and full cigars are easier to compare.",
    kicker: "Strength guide",
    heroTitle: "Cigar strength is not a wrapper-color ladder.",
    heroCopy:
      "A dark wrapper can look powerful and a pale wrapper can still sit on a serious blend. Learn how nicotine impact comes from the full recipe: filler, binder, wrapper, priming, origin, fermentation, vitola, and pace.",
    image: "/assets/guides/luxury-cigar-strength.png",
    imageAlt: "Premium cigar box selected for strength education",
    imagePosition: "58% 50%",
    atelierImage: "/assets/guides/luxury-guide-atelier.png",
    atelierImageAlt: "Luxury cigar education atelier with wrapper leaves and a tasting notebook",
    atelierImagePosition: "50% 50%",
    keywords: ["cigar strength", "mild cigars", "full bodied cigars", "cigar body guide"],
    intent: "Adults comparing mild, medium, and full cigars before buying.",
    primaryCta: {
      label: "Shop Mid-Range Cigars",
      href: "/shop/categories/mid-range-cigars-50-150/",
      description: "Start with balanced boxes across approachable price points.",
    },
    secondaryCta: {
      label: "Read Pairing Guide",
      href: "/guides/cigar-pairings/",
      description: "Match drink choices to body and flavor.",
    },
    productCategories: ["Mid-Range Cigars ($50-$150)", "Premium Cigars ($150-$300)", "Sample Packs"],
    visualLessons: [
      {
        label: "Blend, not ladder",
        image: "/assets/guides/luxury-cigar-strength.png",
        imageAlt: "Cigar strength guide table with premium cigars and tasting markers",
        imagePosition: "58% 50%",
        copy:
          "Wrapper shade can point toward flavor, but the whole blend decides the final impact. Start with filler, binder, wrapper, and size before trusting color alone.",
      },
      {
        label: "Read priming and filler",
        image: "/assets/guides/luxury-guide-atelier.png",
        imageAlt: "Premium cigar blending table with wrapper leaves for strength education",
        imagePosition: "50% 50%",
        copy:
          "Higher-priming leaves such as ligero and medio tiempo usually bring more nicotine and weight, while seco and volado can shift aroma, burn, and balance.",
      },
      {
        label: "Let color stay a clue",
        image: "/assets/guides/luxury-wrapper-types.png",
        imageAlt: "Cigar wrapper leaves and cigars arranged for wrapper strength comparison",
        imagePosition: "50% 52%",
        copy:
          "Connecticut, Habano, Sumatra, Broadleaf, Maduro, and San Andres are useful style cues, not fixed rungs from mild to strong.",
      },
    ],
    sections: [
      {
        heading: "Strength starts in the blend",
        body:
          "Nicotine strength is the physical effect: warming, heady, or heavy. The biggest read comes from the recipe, especially filler and binder choices, leaf priming, seed variety, growing region, fermentation, and aging. Wrapper matters, but it is one part of the formula rather than the formula itself.",
        bullets: ["Check filler and binder", "Notice ligero or high primings", "Compare origin, age, and blend family"],
      },
      {
        heading: "Body and flavor are separate",
        body:
          "Body describes smoke weight and texture. Flavor describes what you taste: cedar, cocoa, pepper, citrus, leather, coffee, cream, earth, or sweetness. A cigar can be full-bodied and smooth, full-flavored and medium in nicotine, or visually dark without being the strongest cigar in the tray.",
        bullets: ["Rate strength, body, and flavor separately", "Do not confuse dark with strong", "Log first third and final third"],
      },
      {
        heading: "Format and pace change the read",
        body:
          "Vitola, ring gauge, draw, smoke temperature, and time can change how strong a cigar feels. The final third often concentrates heat and nicotine perception. Eat first, keep water nearby, and step down in blend strength or size if the cigar starts to feel heavy.",
        bullets: ["Compare similar sizes", "Watch the final third", "Eat first and slow the pace"],
      },
    ],
    researchNotes: [
      {
        label: "Record body, flavor, and strength separately",
        takeaway:
          "Tobacconist University's tasting chart separates body, flavor, and strength, which supports taking notes on palate texture, flavor clarity, and nicotine effect as different observations.",
        ...guideResearchSources.flavorChart,
      },
      {
        label: "The bunch carries much of the strength",
        takeaway:
          "Cigar Aficionado describes wrapper, binder, and filler as the three handmade cigar components and notes that binder and filler strongly shape overall strength, body, and flavor.",
        ...guideResearchSources.blendAnatomy,
      },
      {
        label: "High primings change nicotine impact",
        takeaway:
          "Cigar Aficionado reports that ligero and medio tiempo come from higher parts of the plant and tend to be stronger, thicker, and richer in nicotine because they receive more sun exposure.",
        ...guideResearchSources.primingStrength,
      },
      {
        label: "Wrapper color is not a strength verdict",
        takeaway:
          "Cigar Advisor calls wrapper-color-as-strength a common misconception: darker wrappers can suggest richer flavor, but the blend of tobaccos is the better strength signal.",
        ...guideResearchSources.strengthBodyMisconceptions,
      },
      adultOnlyResearchNote,
    ],
    faqs: [
      {
        question: "What is the difference between full-bodied and strong?",
        answer:
          "Full-bodied refers to smoke weight and texture. Strong usually refers to nicotine impact. A cigar can be full-bodied, flavorful, and smooth without being the highest-nicotine cigar in the humidor.",
      },
      {
        question: "Are dark cigars always stronger?",
        answer:
          "No. A dark wrapper can bring cocoa, earth, sweetness, or richer texture, but strength depends on the full blend: filler, binder, wrapper, priming, origin, age, size, and how the cigar is paced.",
      },
      {
        question: "How do I choose strength more accurately?",
        answer:
          "Use the maker's blend notes, your own anchors, and separate ratings for body, flavor intensity, and nicotine impact. Compare similar sizes and note how the cigar changes in the final third.",
      },
    ],
    internalLinks: [
      { label: "Cigars for beginners", href: "/cigars-for-beginners/", description: "Build a first buying map." },
      { label: "Wrapper types", href: "/guides/wrapper-types/", description: "Learn why dark wrappers are not always stronger." },
      { label: "Sample packs", href: "/shop/categories/sample-packs/", description: "Compare strength levels in smaller formats." },
      { label: "Digital humidor", href: "/humidor/", description: "Save strength notes for future buying." },
    ],
    updatedAt: contentUpdatedAt,
  },
  {
    slug: "cigar-pairings",
    path: "/guides/cigar-pairings/",
    metadataTitle: "Cigar Pairing Guide: Coffee, Whiskey, Rum, Nonalcoholic | Yuzu",
    title: "Cigar Pairing Guide",
    description:
      "Pair cigars with coffee, whiskey, rum, tea, sparkling water, and nonalcoholic drinks by matching strength, sweetness, body, and finish.",
    kicker: "Pairing guide",
    heroTitle: "Pair by balance, not volume.",
    heroCopy:
      "A great pairing reveals the cigar instead of covering it. Learn how coffee, rum, whiskey, tea, and sparkling water can support different wrappers, strengths, and flavor profiles.",
    image: "/assets/guides/luxury-cigar-pairings.png",
    imageAlt: "Cigar lounge table prepared for pairing education",
    imagePosition: "52% 48%",
    atelierImage: "/assets/guides/luxury-guide-atelier.png",
    atelierImageAlt: "Luxury cigar education atelier with wrapper leaves and a tasting notebook",
    atelierImagePosition: "50% 50%",
    keywords: ["cigar pairings", "cigar and whiskey", "cigar and coffee", "cigar pairing guide"],
    intent: "Adults looking for cigar pairing ideas and better tasting-session structure.",
    primaryCta: {
      label: "Explore Events",
      href: "/events/",
      description: "Find guided tastings and education sessions.",
    },
    secondaryCta: {
      label: "Shop Premium Cigars",
      href: "/shop/categories/premium-cigars-150-300/",
      description: "Choose boxes that reward pairing practice.",
    },
    productCategories: ["Premium Cigars ($150-$300)", "Luxury Cigars ($300+)", "Montecristo Cigars"],
    visualLessons: [
      {
        label: "Build a control pour",
        image: "/assets/guides/luxury-cigar-pairings.png",
        imageAlt: "Cigar pairing table with glasses and premium cigars",
        imagePosition: "52% 48%",
        copy:
          "Start with water beside the pairing so you can tell whether coffee, bourbon, rum, or tea is revealing the cigar or covering the finish.",
      },
      {
        label: "Match the room to the cigar",
        image: "/assets/about-lounge.png",
        imageAlt: "Cigar lounge seating arranged for guided cigar pairing",
        imagePosition: "50% 54%",
        copy:
          "A quieter lounge setting makes it easier to compare first-third sweetness, mid-smoke spice, and final-third strength without rushing.",
      },
      {
        label: "Use events for contrast",
        image: "/assets/aire-by-puro-open-event.jpeg",
        imageAlt: "Cigar event table prepared for adult tasting and pairing education",
        imagePosition: "50% 50%",
        copy:
          "Guided tastings help users compare two cigars against the same drink, which is the fastest way to learn intensity and flavor bridges.",
      },
    ],
    sections: [
      {
        heading: "Coffee and tea",
        body:
          "Coffee can echo cocoa, roast, and cedar, while black tea keeps the palate alert without adding alcohol weight. Use these as control pairings when learning a new cigar.",
        bullets: ["Coffee for cocoa and roast", "Black tea for cedar and spice", "Water between comparisons"],
      },
      {
        heading: "Whiskey and rum",
        body:
          "Bourbon can flatter Maduro sweetness, rye can sharpen heavy profiles, and aged rum can support dessert-like notes. Proof and sweetness matter more than prestige.",
        bullets: ["Keep proof moderate", "Match sweetness with structure", "Stop if the drink hides the finish"],
      },
      {
        heading: "Nonalcoholic pairings",
        body:
          "Sparkling water, ginger ale, cold brew, and mineral water can make a cigar easier to read. They are useful for events, afternoon smokes, and strength comparisons.",
        bullets: ["Sparkling water resets the palate", "Ginger can lift heavy smoke", "Cold brew supports cocoa notes"],
      },
    ],
    researchNotes: [
      {
        label: "Rum pairings change by cigar body",
        takeaway:
          "Cigar Aficionado paired rums against different cigar body levels and found different give-and-take effects, reinforcing intensity matching over one universal pairing rule.",
        ...guideResearchSources.rumPairings,
      },
      {
        label: "Bourbon is reliable but not automatic",
        takeaway:
          "Cigar Aficionado's bourbon tasting shows many friendly pairings, but the best results came from how spice, coffee, leather, cocoa, and sweetness interacted with specific cigars.",
        ...guideResearchSources.bourbonPairings,
      },
    ],
    faqs: [
      {
        question: "What is the easiest cigar pairing?",
        answer:
          "Still or sparkling water is the best control pairing. It lets you read the cigar before adding coffee, whiskey, rum, or another flavor.",
      },
      {
        question: "Do Maduro cigars pair well with bourbon?",
        answer:
          "Often, yes. Bourbon can echo cocoa, caramel, and oak notes, but high proof can overpower the cigar. Start moderate and compare with water.",
      },
      {
        question: "Can cigar pairings be nonalcoholic?",
        answer:
          "Yes. Coffee, tea, sparkling water, ginger ale, and cold brew can all make excellent cigar pairings depending on wrapper, body, and time of day.",
      },
    ],
    internalLinks: [
      { label: "Events", href: "/events/", description: "Attend guided pairing and tasting sessions." },
      { label: "Cigar strength", href: "/guides/cigar-strength/", description: "Match pairings to body and nicotine impact." },
      { label: "Premium cigars", href: "/shop/categories/premium-cigars-150-300/", description: "Browse boxes suited to pairing practice." },
      { label: "Digital humidor", href: "/humidor/", description: "Save pairing notes to each box." },
    ],
    updatedAt: contentUpdatedAt,
  },
  {
    slug: "cigar-storage",
    path: "/guides/cigar-storage/",
    metadataTitle: "Cigar Storage Guide: Humidity, Temperature, Aging | Yuzu",
    title: "Cigar Storage Guide",
    description:
      "Learn cigar storage basics for humidity, temperature, travel rest, box aging, dry cigars, wet cigars, and monthly humidor maintenance.",
    kicker: "Storage article",
    heroTitle: "Good storage is quiet, steady, and boring in the best way.",
    heroCopy:
      "Cigar storage works best when you stop chasing tiny readings and start watching trends. This guide covers stable humidity, temperature, rest windows, and how to track aging without fuss.",
    image: "/assets/guides/luxury-cigar-storage.png",
    imageAlt: "Cigar box aging and storage setup",
    imagePosition: "50% 50%",
    atelierImage: "/assets/guides/luxury-guide-atelier.png",
    atelierImageAlt: "Luxury cigar education atelier with wrapper leaves and a tasting notebook",
    atelierImagePosition: "50% 50%",
    keywords: ["cigar storage", "cigar humidity", "cigar aging", "humidor maintenance"],
    intent: "Adults looking for practical cigar storage and aging guidance.",
    primaryCta: {
      label: "Open Humidor Guide",
      href: "/humidor-guide/",
      description: "Read the full Yuzu humidor setup guide.",
    },
    secondaryCta: {
      label: "Shop Humidors",
      href: "/shop/categories/humidors/",
      description: "Browse storage products and accessories.",
    },
    productCategories: ["Humidors", "Premium Cigars ($150-$300)", "Butane / Fluid"],
    visualLessons: [
      {
        label: "Watch trends, not panic readings",
        image: "/assets/guides/luxury-cigar-storage.png",
        imageAlt: "Cigar storage guide setup with humidor and premium cigar boxes",
        imagePosition: "50% 50%",
        copy:
          "Use the storage image as a reminder that steady humidity and patient observation matter more than chasing every one-point hygrometer swing.",
      },
      {
        label: "Pair physical and digital storage",
        image: "/refs/humidor.png",
        imageAlt: "Digital cigar humidor dashboard for tracking cigar storage",
        imagePosition: "50% 50%",
        copy:
          "Record arrival date, first-rest date, and ratings in the digital humidor so physical storage decisions connect to actual smoking results.",
      },
      {
        label: "Plan aging windows",
        image: "/assets/journal-aging.png",
        imageAlt: "Cigar aging journal with tasting notes and premium cigar box",
        imagePosition: "50% 50%",
        copy:
          "Aging is useful only when you compare the same box at planned intervals, with notes on draw, burn, aroma, and whether the cigar improved.",
      },
    ],
    sections: [
      {
        heading: "Humidity targets",
        body:
          "Many cigars perform well in a stable mid-to-high 60% range. The exact target depends on the blend, climate, and draw preference, so watch trends over time.",
        bullets: ["Use a calibrated hygrometer", "Avoid rapid swings", "Adjust slowly"],
      },
      {
        heading: "Temperature and airflow",
        body:
          "Moderate temperature and gentle airflow help cigars age evenly. Avoid heat, direct sun, and packing boxes so tightly that air cannot move.",
        bullets: ["Keep away from heat", "Leave breathing room", "Inspect without overhandling"],
      },
      {
        heading: "Aging notes",
        body:
          "Rest solves travel shock, while aging can soften rough edges. Taste at planned intervals and save notes so you know when the box is actually improving.",
        bullets: ["Log arrival date", "Taste after rest", "Compare at set intervals"],
      },
    ],
    researchNotes: [
      {
        label: "Use RH as a range, not a superstition",
        takeaway:
          "Boveda identifies 69% RH as a common cigar-storage choice and also names 65% and 72% as specialty options, so the guide frames humidity as a controlled range.",
        ...guideResearchSources.storageRh,
      },
      adultOnlyResearchNote,
    ],
    faqs: [
      {
        question: "Can dry cigars be saved?",
        answer:
          "Sometimes, if they are not cracked or severely damaged. Rehydrate slowly and avoid sudden humidity spikes that can split wrappers.",
      },
      {
        question: "Can cigars be too wet?",
        answer:
          "Yes. Overly wet cigars can draw tightly, burn unevenly, and taste muted. Stabilize gradually rather than making abrupt corrections.",
      },
      {
        question: "How often should I check my humidor?",
        answer:
          "Check often enough to see trends, but not so often that you keep opening the storage area. Weekly trend checks are a useful starting point.",
      },
    ],
    internalLinks: [
      { label: "Humidor guide", href: "/humidor-guide/", description: "Use the complete setup and tracking guide." },
      { label: "Humidors", href: "/shop/categories/humidors/", description: "Browse storage products." },
      { label: "Limited edition cigars", href: "/limited-edition-cigars/", description: "Plan rare box aging windows." },
      { label: "Cigar aging workshop", href: "/events/cigar-aging-workshop/", description: "Join a practical storage session." },
    ],
    updatedAt: contentUpdatedAt,
  },
  {
    slug: "cigar-etiquette",
    path: "/guides/cigar-etiquette/",
    metadataTitle: "Cigar Etiquette Guide: Lounge, Cutting, Lighting, Pacing | Yuzu",
    title: "Cigar Etiquette Guide",
    description:
      "Learn cigar etiquette for lounges, events, cutting, lighting, pacing, ash, sharing, gifts, and respectful cigar enjoyment for adults 21+.",
    kicker: "Etiquette guide",
    heroTitle: "Good cigar etiquette makes the room easier to enjoy.",
    heroCopy:
      "Cigar etiquette is not about being stiff. It is about respecting the lounge, the people around you, the cigar, and your own pace so the experience stays relaxed.",
    image: "/assets/guides/luxury-cigar-etiquette.png",
    imageAlt: "Cigar lounge seating for etiquette guidance",
    imagePosition: "50% 50%",
    atelierImage: "/assets/guides/luxury-guide-atelier.png",
    atelierImageAlt: "Luxury cigar education atelier with wrapper leaves and a tasting notebook",
    atelierImagePosition: "50% 50%",
    keywords: ["cigar etiquette", "cigar lounge etiquette", "how to smoke a cigar", "cigar event etiquette"],
    intent: "Adults preparing for cigar lounges, tastings, events, and gifts.",
    primaryCta: {
      label: "Find Events",
      href: "/events/",
      description: "Practice etiquette at guided Yuzu events.",
    },
    secondaryCta: {
      label: "Beginner Guide",
      href: "/cigars-for-beginners/",
      description: "Learn the basics before your first lounge visit.",
    },
    productCategories: ["Sample Packs", "Lighters / Torch", "Premium Cigars ($150-$300)"],
    visualLessons: [
      {
        label: "Cut for draw, not drama",
        image: "/assets/guides/luxury-cigar-etiquette.png",
        imageAlt: "Cigar etiquette guide with cutter and premium cigar on a lounge table",
        imagePosition: "50% 50%",
        copy:
          "A clean shallow cut protects the cap and wrapper, giving the cigar enough airflow without turning the head into loose tobacco.",
      },
      {
        label: "Respect the lounge setting",
        image: "/assets/about-lounge.png",
        imageAlt: "Cigar lounge seating for respectful cigar etiquette",
        imagePosition: "50% 54%",
        copy:
          "Lounge etiquette starts with house rules, buying where you smoke when appropriate, and keeping ash, smoke direction, and conversation considerate.",
      },
      {
        label: "Gift with context",
        image: "/assets/gift-box.png",
        imageAlt: "Premium cigar gift box used for cigar etiquette and sharing guidance",
        imagePosition: "50% 52%",
        copy:
          "A cigar gift lands better when it includes strength, wrapper, and storage context instead of pressuring someone into a format they may not enjoy.",
      },
    ],
    sections: [
      {
        heading: "Cut and light with patience",
        body:
          "A careful cut and slow toast protect the first third. Avoid rushing the light, overheating the foot, or pulling too hard before the burn settles.",
        bullets: ["Cut less than you think", "Toast evenly", "Let the ember settle"],
      },
      {
        heading: "Respect the lounge",
        body:
          "Ask before bringing outside cigars, follow house rules, keep ash and smoke direction in mind, and give staff clear buying signals when you need help.",
        bullets: ["Follow house policies", "Use ashtrays well", "Buy where you smoke when appropriate"],
      },
      {
        heading: "Share without pressure",
        body:
          "A cigar gift or recommendation should fit the person's experience level. Offer context, but do not pressure someone into a strength or format they do not want.",
        bullets: ["Ask taste preferences", "Respect pace", "Keep strong cigars optional"],
      },
    ],
    researchNotes: [
      {
        label: "Cut at the shoulder and toast slowly",
        takeaway:
          "Cigar Aficionado's technique guide emphasizes creating enough opening without damaging construction and lighting patiently above the flame rather than scorching the foot.",
        ...guideResearchSources.cuttingLighting,
      },
      adultOnlyResearchNote,
    ],
    faqs: [
      {
        question: "Do you inhale cigar smoke?",
        answer:
          "Cigar smoke is generally tasted in the mouth and not inhaled. Beginners should pace slowly and stop if a cigar feels too strong.",
      },
      {
        question: "Is it rude to relight a cigar?",
        answer:
          "No. Relighting is normal if the cigar goes out. Remove loose ash, warm the foot gently, and avoid scorching the cigar.",
      },
      {
        question: "Can I bring my own cigar to a lounge?",
        answer:
          "It depends on the lounge. Always check house rules. Many lounges expect guests to buy cigars on site if they are using the space.",
      },
    ],
    internalLinks: [
      { label: "Cigars for beginners", href: "/cigars-for-beginners/", description: "Learn first-smoke basics." },
      { label: "Cigar pairings", href: "/guides/cigar-pairings/", description: "Pair respectfully without overpowering the cigar." },
      { label: "Events", href: "/events/", description: "Find guided lounges and tastings." },
      { label: "Lighters and torches", href: "/shop/categories/lighters-torch/", description: "Browse lighting tools for clean starts." },
    ],
    updatedAt: contentUpdatedAt,
  },
];

const categoryProfiles: Record<string, Pick<SeoContentPage, "kicker" | "heroTitle" | "heroCopy" | "sections" | "faqs" | "keywords">> = {
  "Luxury Cigars ($300+)": {
    kicker: "Luxury box catalog",
    heroTitle: "Luxury cigar boxes for patient collectors.",
    heroCopy:
      "Explore higher-value boxes with an eye toward construction, aging potential, allocation context, and the digital notes that help each purchase become part of a longer collection.",
    keywords: ["luxury cigars", "premium cigar boxes", "rare cigar boxes"],
    sections: [
      {
        heading: "Buy for the whole box",
        body: "Luxury boxes deserve more than a one-cigar impulse. Compare maker reputation, wrapper, strength, and how the box may change with rest.",
        bullets: ["Review maker and blend", "Plan first-smoke timing", "Track ratings over time"],
      },
      {
        heading: "Protect the investment",
        body: "A higher-value box needs steady storage, patient opening, and notes that tell you whether the cigars are improving.",
        bullets: ["Use stable humidity", "Set tasting reminders", "Keep reorder context"],
      },
      {
        heading: "Connect to membership",
        body: "Yuzu membership helps collectors watch monthly selection windows, private drops, member pricing, and allocation rules tied to serious box buying.",
        bullets: ["Member-cost access", "Selection and drop alerts", "Digital humidor tracking"],
      },
    ],
    faqs: [
      { question: "What makes a cigar box luxury?", answer: "Luxury cigar boxes often combine higher price, maker reputation, scarcity, construction quality, and aging potential, but quality matters more than price alone." },
      { question: "Should luxury cigars be aged?", answer: "Some benefit from rest or longer aging, while others are ready sooner. Track tasting intervals instead of aging every box blindly." },
      { question: "How should luxury boxes be stored?", answer: "Keep them in stable humidity, away from heat, with purchase dates and tasting notes saved for comparison." },
    ],
  },
  Humidors: {
    kicker: "Storage catalog",
    heroTitle: "Humidors and tools for a calmer cigar collection.",
    heroCopy:
      "Browse humidor products and storage-focused accessories while learning how capacity, humidity stability, airflow, and digital tracking work together.",
    keywords: ["humidors", "cigar storage", "cigar humidor"],
    sections: [
      {
        heading: "Choose capacity honestly",
        body: "A humidor should fit the collection you actually keep, with enough room for airflow and near-term growth.",
        bullets: ["Avoid overpacking", "Leave airflow space", "Plan for box storage"],
      },
      {
        heading: "Track the environment",
        body: "Humidity and temperature trends matter more than one-off readings. Digital notes help connect storage conditions to flavor changes.",
        bullets: ["Calibrate sensors", "Watch trends", "Log changes slowly"],
      },
      {
        heading: "Pair physical and digital storage",
        body: "Yuzu's digital humidor adds purchase dates, ratings, tasting notes, and reorder reminders to the physical collection.",
        bullets: ["Save box dates", "Track tasting windows", "Remember favorites"],
      },
    ],
    faqs: [
      { question: "What size humidor should I buy?", answer: "Choose enough capacity for your current cigars, boxes you expect to buy soon, and breathing room for steady airflow." },
      { question: "Do humidors need maintenance?", answer: "Yes. Check humidity trends, keep the seal healthy, avoid heat, and recalibrate measuring tools when needed." },
      { question: "Can Yuzu track my humidor?", answer: "Yuzu's digital humidor can track boxes, ratings, notes, purchase dates, aging windows, and reorder reminders." },
    ],
  },
  "Sample Packs": {
    kicker: "Discovery catalog",
    heroTitle: "Sample packs for learning taste without overcommitting.",
    heroCopy:
      "Use sample packs to compare wrapper, strength, origin, and format before committing to a full box or membership tier.",
    keywords: ["cigar sample packs", "cigar samplers", "beginner cigars"],
    sections: [
      {
        heading: "Compare one lesson at a time",
        body: "A useful sampler teaches a clear contrast, such as Connecticut versus Maduro or mild versus medium.",
        bullets: ["Compare wrapper", "Compare strength", "Compare size"],
      },
      {
        heading: "Take simple notes",
        body: "Three flavor notes, body, strength, and whether you would buy a box are enough to make the next purchase smarter.",
        bullets: ["Flavor", "Body", "Box-worthiness"],
      },
      {
        heading: "Move from sampler to box",
        body: "When a sampler reveals a favorite, use the product category pages and humidor notes to decide what deserves box space.",
        bullets: ["Save favorites", "Browse by category", "Compare membership access"],
      },
    ],
    faqs: [
      { question: "Are sample packs good for beginners?", answer: "Yes. They let adults compare styles without committing to a large box too early." },
      { question: "How should I compare sample pack cigars?", answer: "Keep the same drink, pace, and setting when possible so wrapper and strength differences are easier to notice." },
      { question: "When should I buy a full box?", answer: "Buy a box when you have smoked enough to know the cigar fits your palate, storage plan, and budget." },
    ],
  },
};

const defaultCategoryLinks: SeoInternalLink[] = [
  { label: "Shop all boxes", href: "/shop/", description: "Return to the full Yuzu catalog." },
  { label: "Cigar subscription", href: "/cigar-subscription/", description: "Compare membership and recurring cigar options." },
  { label: "Humidor guide", href: "/humidor-guide/", description: "Protect and track your next box." },
  { label: "Cigars for beginners", href: "/cigars-for-beginners/", description: "Learn how to choose with more confidence." },
];

export function getSeoLandingPage(slug: string) {
  return seoLandingPages.find((page) => page.slug === slug);
}

export function getSeoGuide(slug: string) {
  return seoGuides.find((guide) => guide.slug === slug);
}

export function getSeoPageProducts(page: Pick<SeoContentPage, "productCategories">, limit = 4) {
  const categorySet = new Set(page.productCategories);
  const matchingProducts = storefrontProductCards.filter((product) => product.category && categorySet.has(product.category));
  const fallbackProducts = storefrontProductCards.filter((product) => !matchingProducts.some((match) => match.id === product.id));

  return [...matchingProducts, ...fallbackProducts].slice(0, limit);
}

export function getCategorySlug(category: string) {
  return category
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/['']/g, "")
    .replace(/\+/g, "")
    .replace(/\$/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

export function getCategorySeoPages(): CategorySeoPage[] {
  return storefrontCategories.map(buildCategorySeoPage);
}

export function getCategorySeoPage(slug: string) {
  return getCategorySeoPages().find((page) => page.slug === slug);
}

export function getSeoContentSitemapEntries(): MetadataRoute.Sitemap {
  const contentRoutes = [...seoLandingPages, ...seoGuides, ...getCategorySeoPages()];

  return contentRoutes.map((page) => ({
    url: absoluteUrl(page.path),
    lastModified: new Date(page.updatedAt),
    changeFrequency: page.path.startsWith("/shop/categories/") ? "weekly" : "monthly",
    priority: page.path.startsWith("/shop/categories/") ? 0.72 : 0.68,
    images: [absoluteUrl(page.image)],
  }));
}

function buildCategorySeoPage(category: string): CategorySeoPage {
  const slug = getCategorySlug(category);
  const products = storefrontProductCards.filter((product) => product.category === category);
  const leadProduct = products[0];
  const profile = categoryProfiles[category] ?? buildDefaultCategoryProfile(category);
  const description = `Shop ${category} from Yuzu Cigar Club with adult-compliant checkout, product-grid browsing, member education links, and digital humidor guidance for every box.`;
  const shopFilterHref = `/shop/?category=${encodeURIComponent(category)}#catalog`;

  return {
    slug,
    path: `/shop/categories/${slug}/`,
    metadataTitle: `${category} | Yuzu Cigar Club Category Guide`,
    title: category,
    category,
    description,
    kicker: profile.kicker,
    heroTitle: profile.heroTitle,
    heroCopy: profile.heroCopy,
    image: leadProduct?.image ?? "/assets/shop-hero.png",
    imageAlt: `${category} available from Yuzu Cigar Club`,
    imagePosition: leadProduct?.imagePosition ?? "50% 50%",
    keywords: profile.keywords,
    intent: `Adults comparing ${category} before browsing the Yuzu catalog.`,
    primaryCta: {
      label: "Filter This Category",
      href: shopFilterHref,
      description: `Open the shop catalog filtered to ${category}.`,
    },
    secondaryCta: {
      label: "Compare Membership",
      href: "/membership/",
      description: "Review member pricing, access, and allocation benefits.",
    },
    sections: profile.sections,
    faqs: profile.faqs,
    internalLinks: defaultCategoryLinks,
    productCategories: [category],
    products,
    shopFilterHref,
    updatedAt: contentUpdatedAt,
  };
}

function buildDefaultCategoryProfile(category: string): Pick<SeoContentPage, "kicker" | "heroTitle" | "heroCopy" | "sections" | "faqs" | "keywords"> {
  const isAccessory = /humidor|lighter|torch|butane|fluid/i.test(category);
  const categoryLower = category.toLowerCase();

  return {
    kicker: isAccessory ? "Accessory category" : "Cigar category",
    heroTitle: `${category} with buying context built in.`,
    heroCopy: isAccessory
      ? `Browse ${categoryLower} with practical context for storage, setup, maintenance, and responsible adult cigar enjoyment.`
      : `Browse ${categoryLower} with context on value, strength, wrapper, box format, member pricing, and how each purchase can fit into a longer humidor plan.`,
    keywords: [categoryLower, "Yuzu Cigar Club", isAccessory ? "cigar accessories" : "premium cigar boxes"],
    sections: [
      {
        heading: "Start with the category signal",
        body: isAccessory
          ? `This category supports the cigar experience around storage, lighting, or maintenance. Use it alongside the humidor and education guides for better decisions.`
          : `This category groups related boxes so you can compare price, maker, package format, and likely use case without losing the broader catalog view.`,
        bullets: isAccessory ? ["Support the setup", "Check compatibility", "Pair with storage notes"] : ["Compare box format", "Review maker and price", "Save favorites"],
      },
      {
        heading: "Use education before buying",
        body: "Internal guides help connect product browsing with wrapper, strength, storage, pairing, and etiquette basics so shoppers can choose with more confidence.",
        bullets: ["Read the guide", "Compare products", "Track notes after purchase"],
      },
      {
        heading: "Connect products to membership",
        body: "Yuzu membership adds recurring discovery, member-cost box access, private drops, and digital humidor tools to the catalog experience.",
        bullets: ["Compare tiers", "Watch member drops", "Use the digital humidor"],
      },
    ],
    faqs: [
      {
        question: `What is included in ${category}?`,
        answer: `The ${category} page groups current Yuzu catalog products assigned to that shopper-facing category, with links back to the full shop and education resources.`,
      },
      {
        question: `How do I compare ${categoryLower}?`,
        answer: isAccessory
          ? "Compare use case, compatibility, maintenance needs, and how the item supports your storage or smoking setup."
          : "Compare maker, wrapper, strength, package size, price, availability, and whether the box fits your current humidor plan.",
      },
      {
        question: "Can members get more context before buying?",
        answer:
          "Yes. Yuzu connects category browsing with membership, education guides, product pages, and digital humidor notes so purchases are easier to evaluate over time.",
      },
    ],
  };
}
