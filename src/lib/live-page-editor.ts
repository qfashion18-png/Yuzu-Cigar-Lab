export type LiveEditableField = {
  id: string;
  label: string;
  control: "input" | "textarea";
  defaultValue: string;
};

export type LivePageEditorConfig = {
  route: string;
  label: string;
  fields: LiveEditableField[];
};

export const livePageEditorStorageKey = "yuzu-live-page-editor-v1";

export const livePageEditorConfigs: LivePageEditorConfig[] = [
  {
    route: "/",
    label: "Homepage",
    fields: [
      {
        id: "home.hero.kicker",
        label: "Hero label",
        control: "input",
        defaultValue: "Premium cigars. Curated for you.",
      },
      {
        id: "home.hero.title",
        label: "Hero headline",
        control: "textarea",
        defaultValue: "Premium Cigars by the Box. Curated Membership. Smart Digital Humidor.",
      },
      {
        id: "home.hero.copy",
        label: "Hero copy",
        control: "textarea",
        defaultValue: "We sell by the box, not by the stick, because every great cigar experience deserves more than one.",
      },
      {
        id: "home.hero.primaryCta",
        label: "Primary CTA",
        control: "input",
        defaultValue: "Shop Boxes",
      },
      {
        id: "home.hero.secondaryCta",
        label: "Secondary CTA",
        control: "input",
        defaultValue: "Explore Humidor",
      },
    ],
  },
  {
    route: "/membership",
    label: "Membership",
    fields: [
      {
        id: "membership.hero.kicker",
        label: "Hero label",
        control: "input",
        defaultValue: "The Yuzu Cigar Club",
      },
      {
        id: "membership.hero.title",
        label: "Hero headline",
        control: "textarea",
        defaultValue: "Membership, built around member-cost boxes.",
      },
      {
        id: "membership.hero.copy",
        label: "Hero copy",
        control: "textarea",
        defaultValue:
          "Every member can buy cigar boxes at direct member cost. Kisha, Sensei, and Daimyo members can select monthly cigars from a preselected online list, while store perks, shipping value, concierge access, and VIP allocations scale by tier.",
      },
      {
        id: "membership.hero.primaryCta",
        label: "Primary CTA",
        control: "input",
        defaultValue: "Join Sensei",
      },
      {
        id: "membership.hero.secondaryCta",
        label: "Secondary CTA",
        control: "input",
        defaultValue: "Compare Tiers",
      },
    ],
  },
  {
    route: "/education",
    label: "Education",
    fields: [
      {
        id: "education.hero.kicker",
        label: "Hero label",
        control: "input",
        defaultValue: "The Education Journal",
      },
      {
        id: "education.hero.title",
        label: "Hero headline",
        control: "textarea",
        defaultValue: "Stories Worth Savoring.",
      },
      {
        id: "education.hero.copy",
        label: "Hero copy",
        control: "textarea",
        defaultValue:
          "Insights on cigars, culture, and craftsmanship. Curated for those who appreciate the finer things - one box at a time.",
      },
      {
        id: "education.featured.kicker",
        label: "Featured label",
        control: "input",
        defaultValue: "Featured Story",
      },
      {
        id: "education.featured.title",
        label: "Featured headline",
        control: "textarea",
        defaultValue: "How to Age a Box the Right Way",
      },
      {
        id: "education.featured.cta",
        label: "Featured CTA",
        control: "input",
        defaultValue: "Read the Story",
      },
    ],
  },
];

export function normalizeLiveEditorPath(pathname: string): string {
  const withoutQuery = pathname.split(/[?#]/, 1)[0] || "/";
  const withLeadingSlash = withoutQuery.startsWith("/") ? withoutQuery : `/${withoutQuery}`;
  const withoutTrailingSlash =
    withLeadingSlash.length > 1 && withLeadingSlash.endsWith("/")
      ? withLeadingSlash.slice(0, -1)
      : withLeadingSlash;

  return withoutTrailingSlash || "/";
}

export function getLivePageEditorConfig(pathname: string): LivePageEditorConfig | null {
  const normalizedPath = normalizeLiveEditorPath(pathname);

  return livePageEditorConfigs.find((config) => config.route === normalizedPath) ?? null;
}

export function mergeLivePageValues(
  config: LivePageEditorConfig,
  edits: Record<string, string> = {}
): Record<string, string> {
  return config.fields.reduce<Record<string, string>>((values, field) => {
    const editedValue = edits[field.id];
    values[field.id] = typeof editedValue === "string" ? editedValue : field.defaultValue;

    return values;
  }, {});
}
