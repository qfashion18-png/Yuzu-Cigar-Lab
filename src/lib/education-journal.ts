import { cigarEducationStories } from "@/lib/data";

export type JournalArticle = {
  storyId: string;
  title: string;
  summary: string;
  category: string;
  minutes: number;
  image: string;
  imagePosition?: string;
  featured?: boolean;
};

export type PopularRead = {
  title: string;
  category: string;
  minutes: number;
  image: string;
};

export type JournalArticleFilters = {
  category: string;
  query: string;
};

export const featuredStory = cigarEducationStories[1] ?? cigarEducationStories[0];
export const featuredLesson = cigarEducationStories[0];

export const educationJournalFilters = [
  "All Articles",
  "Pairings",
  "Aging",
  "Reviews",
  "Education",
  "Travel",
  "Member Stories",
];

export const journalArticles: JournalArticle[] = [
  {
    storyId: featuredStory.storyId,
    title: featuredStory.title,
    summary: featuredStory.deck,
    category: featuredStory.category,
    minutes: featuredStory.minutes,
    image: "/assets/journal-aging.png",
    imagePosition: "center",
    featured: true,
  },
  {
    storyId: "notes-nicaragua",
    title: "Notes from Nicaragua",
    summary: "A look at the people, places, and traditions shaping today's finest cigars.",
    category: "Travel",
    minutes: 6,
    image: "/assets/about-lounge.png",
    imagePosition: "54% 44%",
  },
  {
    storyId: "pairing-maduro-whiskey",
    title: "Pairing Maduro with Whiskey",
    summary: "Five bold pairings that elevate flavor in every pour and puff.",
    category: "Pairings",
    minutes: 7,
    image: "/assets/hero-boxes.png",
    imagePosition: "76% 52%",
  },
  {
    storyId: "vintage-preview-2026",
    title: "2026 Vintage Preview",
    summary: "What to expect from the 2026 release calendar.",
    category: "Reviews",
    minutes: 5,
    image: "/assets/membership-boxes.png",
    imagePosition: "50% 48%",
  },
  {
    storyId: "humidor-worth-keeping",
    title: "Building a Humidor Worth Keeping",
    summary: "Design, climate, and care tips for the perfect smoking experience.",
    category: "Education",
    minutes: 6,
    image: "/assets/shop-hero.png",
    imagePosition: "58% 46%",
  },
];

export const popularReads: PopularRead[] = [
  {
    title: "Corojo vs. Connecticut: Understanding Wrapper Leaves",
    category: "Education",
    minutes: 5,
    image: "/assets/product-fuente.png",
  },
  {
    title: "Limited Editions: Why They Matter",
    category: "Reviews",
    minutes: 4,
    image: "/assets/gift-box.png",
  },
  {
    title: "Traveling with Cigars: A Gentleman's Guide",
    category: "Travel",
    minutes: 6,
    image: "/assets/about-lounge.png",
  },
  {
    title: "Reading the Ash: What It Tells You",
    category: "Education",
    minutes: 4,
    image: "/assets/product-liga.png",
  },
  {
    title: "The Art of Tobacco Growing",
    category: "Education",
    minutes: 7,
    image: "/assets/product-plasencia.png",
  },
];

export function filterJournalArticles(
  articles: JournalArticle[],
  { category, query }: JournalArticleFilters
) {
  const normalizedQuery = query.trim().toLowerCase();

  return articles.filter((article) => {
    const matchesCategory = category === "All Articles" || article.category === category;
    const searchableText = `${article.title} ${article.summary} ${article.category}`.toLowerCase();
    const matchesQuery = !normalizedQuery || searchableText.includes(normalizedQuery);

    return matchesCategory && matchesQuery;
  });
}
