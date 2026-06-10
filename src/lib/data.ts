import {
  Bell,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  Crown,
  Droplets,
  Gift,
  Headphones,
  Leaf,
  LockKeyhole,
  Package,
  ShieldCheck,
  ShoppingCart,
  Smartphone,
  Star,
  Tag,
  Thermometer,
  Truck,
  UserCheck,
  Warehouse,
} from "lucide-react";

export const navItems = [
  { href: "/shop", label: "Shop Boxes" },
  { href: "/membership", label: "Membership" },
  { href: "/humidor", label: "Humidor" },
  { href: "/cigar-flow", label: "Cigar Flow" },
  { href: "/education", label: "Education" },
  { href: "/events", label: "Events" },
  { href: "/about", label: "About" },
  { href: "/contact", label: "Contact" },
];

export const commerceNav = [
  { href: "/new-arrivals", label: "New Arrivals" },
  { href: "/member-drops", label: "Member Drops" },
  { href: "/cart", label: "Cart" },
  { href: "/checkout", label: "Checkout" },
  { href: "/account", label: "Account" },
  { href: "/admin", label: "Admin" },
];

export const heroProof = [
  { label: "Box only", detail: "No singles, ever.", icon: Package },
  { label: "Curated quality", detail: "Hand-selected boxes.", icon: ShieldCheck },
  { label: "Member pricing", detail: "Best value always.", icon: Tag },
  { label: "Secure shipping", detail: "Adult signature required.", icon: Truck },
];

export const tiers = [
  {
    name: "Box Access Pass",
    subtitle: "The Wholesale Box Membership",
    price: 18,
    monthlyCigars: 0,
    discount: "Wholesale boxes only",
    cadence: "No monthly cigars",
    wholesaleBoxAccess: "Wholesale boxes only",
    shipping: "Member pays shipping",
    shippingNote: "Wholesale box orders ship at member cost.",
    welcomeKit: "Digital welcome kit; physical insert with first box order",
    prepaid: {
      quarterly: 49,
      quarterlySavings: 5,
      quarterlyEffective: "16.33",
      yearly: 179,
      yearlySavings: 37,
      yearlyEffective: "14.92",
    },
    icon: Warehouse,
    benefits: [
      "Wholesale/member-cost pricing on cigar boxes",
      "Access to private box catalog",
      "Member-only box drops",
      "Digital humidor access",
      "Email support",
      "Shipping paid by member",
      "No monthly cigars",
      "No standalone physical welcome kit",
    ],
  },
  {
    name: "Kisha",
    subtitle: "The Refined Introduction",
    price: 49,
    monthlyCigars: 4,
    discount: "5% off eligible non-box store products",
    cadence: "4 monthly cigars from the curated selection list",
    wholesaleBoxAccess: "Wholesale boxes + member store perks",
    shipping: "Member pays shipping",
    shippingNote: "Monthly cigar and wholesale box orders ship at member cost.",
    welcomeKit: "Cutter, Boveda/humidity pack, tasting guide",
    prepaid: {
      quarterly: 139,
      quarterlySavings: 8,
      quarterlyEffective: "46.33",
      yearly: 499,
      yearlySavings: 89,
      yearlyEffective: "41.58",
    },
    icon: Leaf,
    benefits: [
      "Wholesale/member-cost pricing on boxes",
      "Preselected monthly cigar list",
      "Early access to new releases",
      "Digital humidor access",
      "Bulk digital humidor import",
      "Email member support",
      "Basic welcome kit",
    ],
  },
  {
    name: "Sensei",
    subtitle: "The Connoisseur Experience",
    price: 99,
    monthlyCigars: 8,
    discount: "10% off eligible non-box store products",
    cadence: "8 monthly cigars from the curated selection list",
    wholesaleBoxAccess: "Wholesale boxes + stronger store perks",
    shipping: "Monthly cigar shipping included",
    shippingNote: "Includes 1 wholesale-box shipment per month; additional box orders ship at cost.",
    welcomeKit: "Cutter, Boveda, tasting journal, upgraded pouch, optional 1 bonus cigar",
    prepaid: {
      quarterly: 279,
      quarterlySavings: 18,
      quarterlyEffective: "93",
      yearly: 999,
      yearlySavings: 189,
      yearlyEffective: "83.25",
    },
    icon: Crown,
    featured: true,
    benefits: [
      "Wholesale/member-cost pricing on boxes",
      "Monthly online selection window",
      "Monthly cigar shipping included",
      "Priority drop allocations",
      "Concierge recommendations",
      "Bulk digital humidor import",
      "Upgraded welcome kit",
    ],
  },
  {
    name: "Daimyo",
    subtitle: "The Ultimate Indulgence",
    price: 199,
    monthlyCigars: 12,
    discount: "15% off eligible non-box store products",
    cadence: "12 monthly cigars from the curated selection list",
    wholesaleBoxAccess: "Wholesale boxes + VIP access",
    shipping: "Monthly cigar shipping included",
    shippingNote: "Includes 2 wholesale-box shipments per month; additional orders ship at cost.",
    welcomeKit: "Premium travel case or accessory, tasting journal, Boveda, 1-2 bonus limited cigars",
    prepaid: {
      quarterly: 559,
      quarterlySavings: 38,
      quarterlyEffective: "186.33",
      yearly: 1999,
      yearlySavings: 389,
      yearlyEffective: "166.58",
    },
    icon: Star,
    benefits: [
      "Wholesale/member-cost pricing on boxes",
      "Ultra-premium monthly selection access",
      "VIP concierge support",
      "Private events and tastings",
      "First access to member-only drops",
      "Bulk digital humidor import",
      "Premium welcome kit",
      "Highest priority allocations",
    ],
  },
];

export const membershipPrepaidPricing = tiers.map((tier) => ({
  name: tier.name,
  monthly: tier.price,
  quarterly: tier.prepaid.quarterly,
  quarterlySavings: tier.prepaid.quarterlySavings,
  quarterlyEffective: tier.prepaid.quarterlyEffective,
  yearly: tier.prepaid.yearly,
  yearlySavings: tier.prepaid.yearlySavings,
  yearlyEffective: tier.prepaid.yearlyEffective,
}));

export const welcomeKitRecommendations = tiers.map((tier) => ({
  plan: tier.name,
  kit: tier.welcomeKit,
}));

export const wholesaleCostDefinition = {
  formula:
    "Member wholesale box price = supplier cost + inbound freight allocation + required taxes/fees + payment-processing cost + packaging/handling if needed.",
  promise: "Members buy boxes at our direct member cost with no traditional retail markup.",
  rule:
    "Quarterly and yearly discounts apply to membership dues only. They do not reduce wholesale box pricing, taxes, shipping, adult-signature fees, or already-discounted products.",
  shipping:
    "Adult-signature delivery adds a real per-shipment cost before normal postage, so included wholesale-box shipping is capped by tier.",
};

export const benefits = [
  { title: "Member Cost Boxes", text: "Boxes priced at direct member cost.", icon: Tag },
  { title: "Selection Windows", text: "Pick from monthly lists and rare releases.", icon: CalendarDays },
  { title: "Shipping Controls", text: "Included shipping is capped by tier.", icon: Truck },
  { title: "Digital Humidor", text: "Track, age, and reorder.", icon: Smartphone },
  { title: "Concierge Service", text: "Personal cigar guidance.", icon: Headphones },
  { title: "Exclusive Events", text: "Private tastings and drops.", icon: Gift },
];

export const humidorStats = [
  { label: "Humidity", value: "69%", note: "Target 65%-72%", icon: Droplets, tone: "Optimal" },
  { label: "Temperature", value: "70°F", note: "Target 68°F-72°F", icon: Thermometer, tone: "Optimal" },
  { label: "Total Cigars", value: "128", note: "Across 12 boxes", icon: Package, tone: "Inventory" },
  { label: "Ready Now", value: "3", note: "Boxes at peak window", icon: CheckCircle2, tone: "Smoke" },
];

export const humidorItems = [
  {
    cigar: "Padron 1964 Anniversary Series",
    origin: "Nicaragua",
    wrapper: "Natural",
    location: "Locker A / Drawer 2",
    boxes: "1 Box (25)",
    added: "Nov 12, 2024",
    age: "18 months",
    readiness: "Aging Well",
    rating: 94,
  },
  {
    cigar: "Davidoff Signature No. 2",
    origin: "Dominican Republic",
    wrapper: "Connecticut",
    location: "Home / Tray 1",
    boxes: "1 Box (25)",
    added: "Jul 5, 2025",
    age: "10 months",
    readiness: "Too Young",
    rating: 90,
  },
  {
    cigar: "Liga Privada T52",
    origin: "Nicaragua",
    wrapper: "Habano",
    location: "Locker B / Drawer 1",
    boxes: "1 Box (24)",
    added: "Aug 20, 2025",
    age: "8 months",
    readiness: "Too Young",
    rating: 92,
  },
  {
    cigar: "Plasencia Alma Fuerte Sixto I",
    origin: "Nicaragua",
    wrapper: "Maduro",
    location: "Home / Box 3",
    boxes: "1 Box (20)",
    added: "Dec 28, 2024",
    age: "16 months",
    readiness: "Aging Well",
    rating: 93,
  },
];

export const smokeLogs = [
  {
    cigar: "Padron 1926 Serie 80 Years",
    date: "May 8, 2026",
    rating: 94,
    notes: "Dark chocolate, espresso, leather, and a long cedar finish.",
    pairing: "Barrel-proof bourbon",
  },
  {
    cigar: "Montecristo No. 2",
    date: "May 5, 2026",
    rating: 90,
    notes: "Creamy cedar, roasted almond, and balanced spice.",
    pairing: "Aged rum",
  },
  {
    cigar: "Oliva Serie V Melanio",
    date: "May 2, 2026",
    rating: 92,
    notes: "Coffee, cocoa, and a polished draw from first light.",
    pairing: "Single malt",
  },
];

export type CigarEducationStory = {
  storyId: string;
  title: string;
  category: string;
  minutes: number;
  level: string;
  image: string;
  imagePosition: string;
  deck: string;
  origin: string;
  wrapperFocus: string;
  strength: string;
  lesson: string;
  pullQuote: string;
  chapters: { heading: string; body: string }[];
  fieldNotes: string[];
  tastingCues: { label: string; detail: string }[];
  practice: string[];
  pairing: string;
  humidorAction: string;
};

export const cigarEducationStories: CigarEducationStory[] = [
  {
    storyId: "wrapper-room",
    title: "The Wrapper That Changed the Room",
    category: "Wrapper Literacy",
    minutes: 7,
    level: "Foundational",
    image: "/refs/journal.png",
    imagePosition: "82% 48%",
    deck: "A guided story about wrapper leaf, binder support, and why color alone never tells the whole flavor story.",
    origin: "Ecuador, Mexico, Cameroon",
    wrapperFocus: "Connecticut Shade, Habano, San Andres",
    strength: "Mild to full",
    lesson: "Wrapper leaf shapes aroma, texture, and first impressions, but the binder and filler decide whether the blend feels balanced.",
    pullQuote: "Color is a clue, not a verdict. Read the whole cigar before you judge the smoke.",
    chapters: [
      {
        heading: "The first lesson at the table",
        body:
          "A new smoker once picked the darkest cigar in the tray because it looked powerful. The first third was sweet, soft, and cocoa-rich, while a lighter Habano beside it carried more pepper and lift. The room learned quickly that shade is only one piece of the blend.",
      },
      {
        heading: "What the wrapper contributes",
        body:
          "Wrapper leaf is thin, aromatic, and visible, so it has an outsized role in aroma and texture. Connecticut Shade often brings cream and hay, Habano can bring spice and citrus peel, and San Andres frequently adds earth, cocoa, and molasses.",
      },
      {
        heading: "How to practice",
        body:
          "Smoke two cigars with similar filler origins but different wrappers. Keep the cut, light, pace, and drink the same. The contrast teaches more than reading a strength label ever will.",
      },
    ],
    fieldNotes: [
      "Dark wrapper does not always mean high strength.",
      "Oily sheen often points to careful fermentation and storage.",
      "Rough veins can be cosmetic, not a flavor defect.",
    ],
    tastingCues: [
      { label: "Connecticut", detail: "Cream, cedar, almond, fresh hay" },
      { label: "Habano", detail: "Pepper, toast, citrus rind, baking spice" },
      { label: "San Andres", detail: "Cocoa, earth, molasses, espresso" },
    ],
    practice: [
      "Compare wrapper aroma before cutting.",
      "Write the first three flavors after the first inch.",
      "Note whether body and nicotine strength match the color.",
    ],
    pairing: "Sparkling mineral water or black tea keeps the leaf contrast clear.",
    humidorAction: "Group boxes by wrapper for one month and compare how each style changes after resting.",
  },
  {
    storyId: "aging-window",
    title: "How to Age a Box the Right Way",
    category: "Aging",
    minutes: 8,
    level: "Collector",
    image: "/assets/journal-aging.png",
    imagePosition: "center",
    deck: "A box-aging story that turns patience into a repeatable tasting method for collectors.",
    origin: "Nicaragua, Dominican Republic",
    wrapperFocus: "Box-pressed and cabinet selections",
    strength: "Medium to full",
    lesson: "Rest solves shipping shock, aging softens rough edges, and notes over time tell you when a box is ready.",
    pullQuote: "Aging is not waiting blindly. It is listening to the same box at honest intervals.",
    chapters: [
      {
        heading: "The arrival test",
        body:
          "The first mistake collectors make is smoking a fresh delivery on the doorstep. Heat, travel, and changing humidity can mute aroma or sharpen bitterness. Give the box a quiet rest before judging the blend.",
      },
      {
        heading: "The tasting window",
        body:
          "Try one cigar after 30 days, another around six months, and a third at one year. The point is not to chase age for its own sake. The point is to learn when the cigar becomes more integrated, aromatic, and calm.",
      },
      {
        heading: "Rotation without fuss",
        body:
          "Boxes stored at 65%-69% relative humidity usually need only light attention. Rotate position when you inspect humidity, keep air exchange gentle, and avoid opening the box every few days just to admire it.",
      },
    ],
    fieldNotes: [
      "Fresh cigars may taste sharper after shipping.",
      "Most premium boxes show useful change between 6 and 18 months.",
      "Aging cannot repair poor construction or bad storage.",
    ],
    tastingCues: [
      { label: "30 days", detail: "Rested, clearer aroma, less travel shock" },
      { label: "6 months", detail: "More integrated spice and sweetness" },
      { label: "12 months", detail: "Rounder smoke, longer finish, calmer edges" },
    ],
    practice: [
      "Write a first-smoke baseline after the rest period.",
      "Date the box and set two tasting reminders.",
      "Compare draw, aroma, burn, and finish at each interval.",
    ],
    pairing: "Aged rum or unsweetened coffee supports the comparison without hiding flaws.",
    humidorAction: "Add purchase date, first rest date, and next tasting window to your humidor notes.",
  },
  {
    storyId: "slow-toast",
    title: "The Slow Toast Method",
    category: "Technique",
    minutes: 6,
    level: "Practical",
    image: "/refs/journal.png",
    imagePosition: "58% 47%",
    deck: "A lighting ritual that protects the first third and prevents the bitter start many smokers accidentally create.",
    origin: "Universal technique",
    wrapperFocus: "All wrappers",
    strength: "Any strength",
    lesson: "The light should warm the foot evenly before flame touches the draw. A rushed torch can make a fine cigar taste harsh.",
    pullQuote: "The first inch remembers how you lit it.",
    chapters: [
      {
        heading: "The bitter beginning",
        body:
          "At a tasting, two people smoked the same cigar and described two different first thirds. One tasted cedar and cream. The other tasted char. The difference was not the cigar. It was the light.",
      },
      {
        heading: "Toast, then draw",
        body:
          "Hold the flame just off the foot and rotate until the edge glows evenly. Then take a gentle first puff while bringing the flame close enough to finish the ignition. You want combustion, not a scorched cap of ash.",
      },
      {
        heading: "Fixing an uneven burn",
        body:
          "A small wave in the burn line is normal. Correct only when it keeps running. Touch up the slow side, then give the cigar a minute to settle before pulling harder.",
      },
    ],
    fieldNotes: [
      "Soft flame is slower but forgiving.",
      "Torch flame works best when held off the foot, not buried into it.",
      "Strong puffs during lighting can overheat the first third.",
    ],
    tastingCues: [
      { label: "Good light", detail: "Clean aroma, even ember, no acrid edge" },
      { label: "Too hot", detail: "Char, bitterness, flaky black ash" },
      { label: "Underlit", detail: "Thin smoke, canoeing, repeated relights" },
    ],
    practice: [
      "Rotate the cigar before drawing through it.",
      "Take two gentle puffs, then wait 30 seconds.",
      "Touch up only the lagging edge, not the whole foot.",
    ],
    pairing: "Still water is the best companion while practicing lighting technique.",
    humidorAction: "Log burn quality after each smoke until your lighting routine is consistent.",
  },
  {
    storyId: "strength-map",
    title: "Reading Strength Without Guessing",
    category: "Body and Strength",
    minutes: 9,
    level: "Intermediate",
    image: "/refs/journal.png",
    imagePosition: "66% 70%",
    deck: "A story about the difference between flavor intensity, smoke texture, and nicotine strength.",
    origin: "Honduras, Nicaragua, Dominican Republic",
    wrapperFocus: "Broadleaf, Corojo, Cameroon",
    strength: "Medium-plus to full",
    lesson: "Body is how much the smoke fills the palate. Strength is how much nicotine you feel. Flavor intensity is something else again.",
    pullQuote: "Full flavor can be gentle, and a quiet cigar can still ask you to sit down.",
    chapters: [
      {
        heading: "Three words people mix up",
        body:
          "A cigar can be full flavored without being physically strong. It can feel creamy and medium bodied while still carrying a firm nicotine finish. Separating those ideas helps you choose better boxes and pace the smoke.",
      },
      {
        heading: "How strength shows itself",
        body:
          "Nicotine strength often appears as warmth, lightheadedness, or a need to slow down. Body shows as smoke density and mouthfeel. Flavor intensity shows as how clearly notes like pepper, cedar, cocoa, or citrus arrive.",
      },
      {
        heading: "Pace is part of education",
        body:
          "One puff per minute is a useful starting rhythm. If a cigar gets bitter or heavy, set it down longer. If it grows thin, check your light and draw before blaming the blend.",
      },
    ],
    fieldNotes: [
      "Eat before full-strength cigars.",
      "Retrohale lightly when judging aroma, not nicotine tolerance.",
      "A smaller vitola can feel stronger because the smoke is more concentrated.",
    ],
    tastingCues: [
      { label: "Body", detail: "Creamy, chewy, airy, dense, oily" },
      { label: "Strength", detail: "Gentle, warming, heady, heavy" },
      { label: "Flavor", detail: "Cedar, pepper, cocoa, citrus, leather" },
    ],
    practice: [
      "Rate body, strength, and flavor separately from 1 to 5.",
      "Track how the final third changes your score.",
      "Compare your notes with box size and vitola.",
    ],
    pairing: "Cold brew coffee or ginger ale can support fuller cigars without adding alcohol strength.",
    humidorAction: "Add separate body and strength fields to tasting notes instead of one overall intensity score.",
  },
  {
    storyId: "pairing-contrast",
    title: "Pairing by Contrast, Not Volume",
    category: "Pairings",
    minutes: 7,
    image: "/refs/journal.png",
    imagePosition: "46% 54%",
    level: "Hosting",
    deck: "A pairing story that uses contrast, sweetness, acid, and texture instead of simply matching strong cigars with strong drinks.",
    origin: "Cuba-style classics, Nicaragua, Dominican Republic",
    wrapperFocus: "Maduro, Cameroon, Connecticut",
    strength: "Mild to full",
    lesson: "The best pairing either echoes a flavor clearly or refreshes the palate between puffs. Louder is not always better.",
    pullQuote: "A pairing should make the next puff easier to understand.",
    chapters: [
      {
        heading: "The whiskey trap",
        body:
          "Many smokers reach for the biggest whiskey with the biggest cigar. Sometimes it works. Often it turns the palate into a wall of oak, heat, pepper, and sweetness where every puff tastes the same.",
      },
      {
        heading: "Contrast creates space",
        body:
          "A creamy Connecticut can shine with espresso because bitterness frames the sweet hay notes. A peppery Habano can open with sparkling water. A Maduro can become brighter with black tea or a not-too-sweet rum.",
      },
      {
        heading: "Build a pairing ladder",
        body:
          "Start with water, then try a low-sugar drink, then a richer pairing. The ladder shows whether the drink clarifies the cigar or flattens it.",
      },
    ],
    fieldNotes: [
      "Sweet drinks can hide bitterness but also mute complexity.",
      "Acidity refreshes heavy smoke.",
      "Carbonation can reset the palate during long sessions.",
    ],
    tastingCues: [
      { label: "Echo", detail: "Coffee with cocoa, rum with molasses" },
      { label: "Contrast", detail: "Sparkling water with pepper, tea with cream" },
      { label: "Reset", detail: "Mineral water, citrus peel, unsweetened tea" },
    ],
    practice: [
      "Taste the drink before lighting and after the first third.",
      "Ask whether the pairing reveals a new note.",
      "Stop pairing if the drink makes every puff taste identical.",
    ],
    pairing: "Try black tea with Maduro, espresso with Connecticut, and mineral water with peppery Habano.",
    humidorAction: "Save one pairing note per cigar so future box choices become easier.",
  },
  {
    storyId: "notes-nicaragua",
    title: "Notes from Nicaragua",
    category: "Travel",
    minutes: 6,
    image: "/assets/about-lounge.png",
    imagePosition: "54% 44%",
    level: "Field Notes",
    deck: "A field story from farms, fermentation rooms, and sorting tables that shows why Nicaragua leaves such a clear mark on a cigar.",
    origin: "Esteli, Jalapa, Condega",
    wrapperFocus: "Habano, Corojo, Criollo",
    strength: "Medium to full",
    lesson: "Nicaraguan character is built before the cigar reaches the bench: soil, heat, fermentation, and sorting all shape the pepper, cedar, cacao, and mineral notes in the smoke.",
    pullQuote: "A cigar carries the field with it. The factory only teaches that field how to speak clearly.",
    chapters: [
      {
        heading: "The farms before the factory",
        body:
          "The most useful trip begins outside the rolling room. In Esteli, Jalapa, and Condega, the same seed can speak with different accents because the soil, shade, wind, and heat all push the leaf in their own direction.",
      },
      {
        heading: "Fermentation is where strength gets manners",
        body:
          "Fresh tobacco can be loud before it is ready. In the pilones, patient turning and temperature control help rough ammonia fade while pepper, cedar, cacao, and mineral notes become easier to read.",
      },
      {
        heading: "Sorting teaches consistency",
        body:
          "Factory tables separate leaves by color, texture, size, and use. That quiet sorting work is why one box can feel coherent from cigar to cigar instead of like ten unrelated smokes sharing a band.",
      },
    ],
    fieldNotes: [
      "Esteli often brings structure, pepper, and density.",
      "Jalapa can add perfume, sweetness, and a softer finish.",
      "Condega frequently sits between lift, earth, and spice.",
    ],
    tastingCues: [
      { label: "Esteli", detail: "Pepper, cedar, earth, cocoa nib" },
      { label: "Jalapa", detail: "Floral lift, honey, toasted nuts" },
      { label: "Condega", detail: "Mineral, baking spice, dry wood" },
    ],
    practice: [
      "Compare two Nicaraguan cigars from different regions.",
      "Write down when pepper appears: first light, middle, or finish.",
      "Notice whether sweetness feels creamy, floral, or dark.",
    ],
    pairing: "Sparkling water or black coffee keeps regional differences readable.",
    humidorAction: "Tag Nicaraguan boxes by listed growing region when the maker provides that detail.",
  },
  {
    storyId: "pairing-maduro-whiskey",
    title: "Pairing Maduro with Whiskey",
    category: "Pairings",
    minutes: 7,
    image: "/assets/hero-boxes.png",
    imagePosition: "76% 52%",
    level: "Hosting",
    deck: "Five pairing principles for matching Maduro sweetness with bourbon, rye, and single malt without letting proof flatten the cigar.",
    origin: "Mexico, Connecticut River Valley, Nicaragua",
    wrapperFocus: "Maduro and Broadleaf",
    strength: "Medium-plus to full",
    lesson: "Maduro and whiskey work best when sweetness, oak, proof, and spice are balanced. The drink should frame the cigar, not turn every puff into heat.",
    pullQuote: "The right whiskey gives Maduro room. The wrong one makes every note taste like oak and flame.",
    chapters: [
      {
        heading: "Start with proof, not prestige",
        body:
          "A rare bottle is not automatically the right bottle. High proof can overpower cocoa and molasses notes, especially early in the smoke. Begin with a moderate pour and let the cigar set the volume.",
      },
      {
        heading: "Match sweetness with structure",
        body:
          "Bourbon can echo vanilla, caramel, and brown sugar in a Maduro. Rye can sharpen heavy sweetness with spice. A gentle single malt can add cereal, honey, and smoke without turning the pairing syrupy.",
      },
      {
        heading: "Use water as a control",
        body:
          "Taste the cigar with water before the pour, then return to water after the first pairing sip. If the whiskey reveals cocoa, cedar, or fruit, keep it. If it erases detail, step down in proof or sweetness.",
      },
    ],
    fieldNotes: [
      "Bourbon often flatters cocoa and molasses.",
      "Rye can brighten heavy Maduro smoke.",
      "Peated Scotch should be used carefully with earthy wrappers.",
    ],
    tastingCues: [
      { label: "Bourbon", detail: "Caramel, vanilla, oak, brown sugar" },
      { label: "Rye", detail: "Spice, citrus peel, dry oak, cocoa" },
      { label: "Single malt", detail: "Honey, malt, orchard fruit, light smoke" },
    ],
    practice: [
      "Take three puffs with water before tasting the whiskey.",
      "Try one sip neat and one sip with a few drops of water.",
      "Stop the pairing if proof hides the cigar's finish.",
    ],
    pairing: "Try a lower-proof bourbon first, then compare a dry rye if the cigar feels too sweet.",
    humidorAction: "Save pairing notes by wrapper so future Maduro boxes get better drink matches.",
  },
  {
    storyId: "vintage-preview-2026",
    title: "2026 Vintage Preview",
    category: "Reviews",
    minutes: 5,
    image: "/assets/membership-boxes.png",
    imagePosition: "50% 48%",
    level: "Collector",
    deck: "A collector preview for the 2026 release calendar, with notes on patient buying, allocations, and boxes worth aging.",
    origin: "Nicaragua, Dominican Republic, Honduras",
    wrapperFocus: "Habano, Broadleaf, Cameroon",
    strength: "Medium to full",
    lesson: "The best 2026 buys will reward patience: watch construction, tobacco age, allocation size, and whether a box has enough structure to improve after a long rest.",
    pullQuote: "A vintage preview is not a race to buy first. It is a map for buying with patience.",
    chapters: [
      {
        heading: "Look beyond the release date",
        body:
          "Early buzz can make every new box feel urgent. A better preview asks what changed in tobacco selection, whether the blend has a clear purpose, and how much rest the cigars may need after shipment.",
      },
      {
        heading: "Allocation is not the same as quality",
        body:
          "Small runs can be excellent, but scarcity alone is not a tasting note. Watch for makers who explain the leaf, aging, and blend decisions instead of relying only on a limited count.",
      },
      {
        heading: "Buy one for now and one for later",
        body:
          "If a 2026 box shows balance, firm construction, and enough depth, split your plan. Smoke after a short rest, then revisit at six and twelve months before deciding whether to chase more.",
      },
    ],
    fieldNotes: [
      "Limited does not always mean age-worthy.",
      "Fresh releases need rest before a fair review.",
      "Boxes with structure and balance usually age better than one-note power.",
    ],
    tastingCues: [
      { label: "Ready now", detail: "Open aroma, clean burn, balanced finish" },
      { label: "Needs rest", detail: "Sharp edges, muted aroma, uneven finish" },
      { label: "Age-worthy", detail: "Depth, structure, sweetness, long finish" },
    ],
    practice: [
      "Write a release-date note before reading reviews.",
      "Smoke one after 30 days before judging the full box.",
      "Hold back at least two cigars for a six-month comparison.",
    ],
    pairing: "Black coffee or still water keeps the first review honest.",
    humidorAction: "Create a 2026 watchlist with purchase date, rest date, and next tasting date.",
  },
  {
    storyId: "humidor-worth-keeping",
    title: "Building a Humidor Worth Keeping",
    category: "Education",
    minutes: 6,
    image: "/assets/shop-hero.png",
    imagePosition: "58% 46%",
    level: "Foundational",
    deck: "Design, climate, and care guidance for a humidor that protects boxes instead of becoming another thing to worry about.",
    origin: "Home collection",
    wrapperFocus: "All wrappers",
    strength: "Any strength",
    lesson: "A lasting humidor is not the largest box you can buy. It is the one sized for your habits, lined with reliable cedar, and managed with steady humidity and useful notes.",
    pullQuote: "A good humidor should make smoking calmer, not turn every box into a maintenance project.",
    chapters: [
      {
        heading: "Buy for the collection you actually keep",
        body:
          "Capacity matters, but empty air is harder to stabilize than a thoughtful collection. Choose enough room for current boxes, near-term purchases, and a little growth without building a climate problem.",
      },
      {
        heading: "Cedar and airflow do quiet work",
        body:
          "Spanish cedar helps buffer moisture and keeps aroma pleasant, but it needs airflow to matter. Avoid packing boxes so tightly that humidity cannot move through the humidor at a gentle pace.",
      },
      {
        heading: "Steady beats dramatic",
        body:
          "Most problems come from overcorrection. A slow drift from 65% to 69% is less dangerous than constant lid opening, wet packs, and panic adjustments that shock delicate wrappers.",
      },
    ],
    fieldNotes: [
      "Keep a calibrated hygrometer inside the storage area.",
      "Leave room for air to move around boxes.",
      "Group boxes by age, wrapper, or smoking window.",
    ],
    tastingCues: [
      { label: "Too dry", detail: "Brittle wrapper, hot burn, thin smoke" },
      { label: "Stable", detail: "Clean draw, even burn, clear aroma" },
      { label: "Too wet", detail: "Tight draw, muted flavor, uneven burn" },
    ],
    practice: [
      "Calibrate the hygrometer before trusting its reading.",
      "Check trends weekly instead of reacting every day.",
      "Keep purchase and first-smoke dates with each box.",
    ],
    pairing: "Choose water for humidor checks so storage flaws are easier to notice.",
    humidorAction: "Audit capacity, humidity trend, and box organization once a month.",
  },
];

export const educationArticles = cigarEducationStories.map((story) => ({
  storyId: story.storyId,
  title: story.title,
  category: story.category,
  minutes: story.minutes,
  image: story.image,
  imagePosition: story.imagePosition,
  summary: story.deck,
}));

export type EventExperience = {
  slug: string;
  title: string;
  startsAt: string;
  endsAt: string;
  date: string;
  time: string;
  location: string;
  access: string;
  image: string;
  imagePosition: string;
  deck: string;
  description: string;
  host: string;
  capacity: string;
  includes: string[];
  agenda: { time: string; label: string }[];
  goodFor: string[];
};

export const events: EventExperience[] = [
  {
    slug: "aire-by-puro-open-event",
    title: "Aire by Puro [Open event]",
    startsAt: "2026-05-07T19:00:00-07:00",
    endsAt: "2026-05-07T23:00:00-07:00",
    date: "May 7, 2026",
    time: "7:00 PM - 11:00 PM MST",
    location: "111 W Boston St, Chandler, AZ 85225",
    access: "Open",
    image: "/assets/aire-by-puro-open-event.jpeg",
    imagePosition: "50% 32%",
    deck: "A free rooftop patio opening for Aire by Puro, hosted outdoors under the evening breeze and stars.",
    description:
      "The time has come to bless the rooftop patio of Puro. Aire by Puro is a unique open-air venue made for the breeze and stars, and this free open event invites guests to enjoy the outdoors while the weather is still cool enough. Bring a friend and settle in with Tap That Ash.",
    host: "Tap That Ash",
    capacity: "Open RSVP",
    includes: ["Free admission", "Rooftop patio opening", "Open-air evening gathering"],
    agenda: [
      { time: "7:00 PM", label: "Open event begins on the rooftop patio" },
      { time: "8:00 PM", label: "Aire by Puro patio gathering" },
      { time: "10:30 PM", label: "Final rooftop lounge hour" },
    ],
    goodFor: ["Guests looking for an open outdoor cigar lounge", "Friends meeting for a relaxed patio night", "Anyone curious about Aire by Puro"],
  },
  {
    slug: "founder-reserve-tasting",
    title: "Founder Reserve Tasting",
    startsAt: "2026-05-22T19:00:00-07:00",
    endsAt: "2026-05-22T21:00:00-07:00",
    date: "May 22, 2026",
    time: "7:00 PM - 9:00 PM",
    location: "Yuzu Lounge, Phoenix",
    access: "Members",
    image: "/assets/about-lounge.png",
    imagePosition: "50% 48%",
    deck: "A guided evening around founder-selected boxes, slow-pour pairings, and private lounge conversation.",
    description:
      "Join the Yuzu team for a seated reserve tasting built around boxes we would personally make room for in the humidor. Expect a calm lounge pace, hosted tasting notes, pairing guidance, and first look access to the next member allocation window.",
    host: "Yuzu Founder Table",
    capacity: "18 seats",
    includes: ["Reserve cigar flight", "Pairing guidance", "Member allocation preview"],
    agenda: [
      { time: "7:00 PM", label: "Welcome pour and cellar notes" },
      { time: "7:25 PM", label: "Founder reserve tasting flight" },
      { time: "8:20 PM", label: "Allocation preview and Q&A" },
    ],
    goodFor: ["Members building a serious box collection", "Guests who enjoy hosted lounge tastings", "Collectors watching rare releases"],
  },
  {
    slug: "cigar-aging-workshop",
    title: "Cigar Aging Workshop",
    startsAt: "2026-06-06T14:00:00-07:00",
    endsAt: "2026-06-06T15:30:00-07:00",
    date: "June 6, 2026",
    time: "2:00 PM - 3:30 PM",
    location: "Digital + In-store",
    access: "Open",
    image: "/assets/journal-aging.png",
    imagePosition: "50% 50%",
    deck: "A practical workshop for reading rest windows, humidity patterns, and box-aging decisions without guesswork.",
    description:
      "This hybrid workshop turns aging advice into a repeatable method. We will compare rest periods, show how to log humidity and tasting changes, and help guests decide which boxes are ready now versus worth holding.",
    host: "Yuzu Education Desk",
    capacity: "32 seats",
    includes: ["Aging checklist", "Digital humidor walkthrough", "Live Q&A"],
    agenda: [
      { time: "2:00 PM", label: "Storage fundamentals and target ranges" },
      { time: "2:30 PM", label: "Rest windows and tasting baselines" },
      { time: "3:05 PM", label: "Humidor notes and reminder setup" },
    ],
    goodFor: ["New collectors", "Members managing multiple boxes", "Remote guests joining the education session"],
  },
  {
    slug: "opus-x-allocation-night",
    title: "Opus X Allocation Night",
    startsAt: "2026-06-18T20:00:00-07:00",
    endsAt: "2026-06-18T22:00:00-07:00",
    date: "June 18, 2026",
    time: "8:00 PM - 10:00 PM",
    location: "Private Locker Room",
    access: "Sensei+",
    image: "/assets/hero-boxes.png",
    imagePosition: "72% 50%",
    deck: "A private release night for Sensei and Daimyo members with allocation rules, tasting notes, and locker-room pickup.",
    description:
      "Allocation Night is designed for members who want a fair, transparent path into rare boxes. We will review eligibility, explain reserve limits, taste a companion selection, and open the first claim window for qualifying members.",
    host: "Yuzu Allocation Team",
    capacity: "12 seats",
    includes: ["Eligibility review", "Companion tasting", "Priority claim window"],
    agenda: [
      { time: "8:00 PM", label: "Private locker room check-in" },
      { time: "8:20 PM", label: "Allocation rules and tasting notes" },
      { time: "9:10 PM", label: "Member claim window opens" },
    ],
    goodFor: ["Sensei and Daimyo members", "Rare box collectors", "Members who prefer clear allocation rules"],
  },
];

export type CuratedCigarEvent = {
  title: string;
  date: string;
  recurrence?: "daily" | "weekly" | "monthly" | "single" | "special";
  venue: string;
  area: string;
  distance: string;
  access: string;
  summary: string;
  sourceUrl: string;
  areaAliases?: string[];
  searchTerms?: string[];
};

export type CuratedCigarLounge = {
  name: string;
  area: string;
  address: string;
  bestFor: string;
  note: string;
  sourceUrl: string;
  areaAliases?: string[];
  searchTerms?: string[];
};

export type CuratedCigarMarket = {
  id: string;
  label: string;
  region: string;
  coordinates: {
    latitude: number;
    longitude: number;
  };
  radiusMiles: number;
  updatedLabel: string;
  cigarEvents: CuratedCigarEvent[];
  cigarLounges: CuratedCigarLounge[];
};

export const curatedCigarMarkets: CuratedCigarMarket[] = [
  {
    id: "phoenix-metro",
    label: "Phoenix Metro",
    region: "Phoenix, Scottsdale, Chandler, Tempe",
    coordinates: {
      latitude: 33.4484,
      longitude: -112.074,
    },
    radiusMiles: 35,
    updatedLabel: "Phoenix area picks",
    cigarEvents: [
      {
        title: "Downtown Chandler Patio Signal",
        date: "This week",
        recurrence: "daily",
        venue: "Puro Cigar Bar",
        area: "Chandler",
        distance: "East Valley",
        access: "Open lounge",
        summary:
          "A Yuzu watchlist pick for members who want a cigar bar with craft beer, spirits, game-night energy, and nearby food delivery.",
        sourceUrl: "https://purocigarbar.com/",
        areaAliases: ["85225", "downtown chandler", "east valley"],
        searchTerms: ["patio", "puro"],
      },
      {
        title: "Scottsdale Brand Event Watch",
        date: "Check calendar",
        recurrence: "daily",
        venue: "Owl Ear Smoke Shop",
        area: "Scottsdale",
        distance: "Central Scottsdale",
        access: "Membership-free lounge",
        summary:
          "A retail-lounge event signal for brand nights, raffles, and relaxed member meetups around a humidor-forward shop.",
        sourceUrl: "https://www.owlearsmokeshop.com/events",
        areaAliases: ["85250", "indian bend", "central scottsdale"],
        searchTerms: ["brand event"],
      },
      {
        title: "Polished Bourbon Lounge Night",
        date: "Evening pick",
        recurrence: "daily",
        venue: "Churchill's Fine Cigars",
        area: "Phoenix / Scottsdale",
        distance: "Multiple Valley locations",
        access: "Open lounge",
        summary:
          "A strong fit for members looking for an upscale cigar bar, full-service shop, craft cocktails, and a quieter business-friendly setting.",
        sourceUrl: "https://churchillsaz.com/",
        areaAliases: ["85018", "85255", "arcadia", "ahwatukee", "glendale"],
        searchTerms: ["bourbon"],
      },
    ],
    cigarLounges: [
      {
        name: "Churchill's Fine Cigars",
        area: "Phoenix / Scottsdale",
        address: "5041 N 44th Street, Phoenix; 18529 N Scottsdale Rd, Scottsdale",
        bestFor: "Polished bourbon and cigar nights",
        note: "A locally owned upscale cigar shop and lounge group with Phoenix, Scottsdale, Ahwatukee, and Glendale locations.",
        sourceUrl: "https://churchillsaz.com/",
        areaAliases: ["85018", "85255", "arcadia", "ahwatukee", "glendale"],
        searchTerms: ["bourbon"],
      },
      {
        name: "Castro's Cigar Bar",
        area: "Phoenix / Tempe / Scottsdale",
        address: "4855 E Warner Rd, Phoenix; 10610 N Scottsdale Rd, Scottsdale; 1807 E Baseline Rd, Tempe",
        bestFor: "Craft cocktails and a modern lounge feel",
        note: "A cigar bar group with plush seating, warm lighting, a full craft bar, and walk-in humidors.",
        sourceUrl: "https://castroscigarbar.com/",
        areaAliases: ["85044", "85254", "85283", "ahwatukee", "baseline", "warner"],
      },
      {
        name: "Puro Cigar Bar",
        area: "Chandler",
        address: "111 W. Boston St. #200, Chandler",
        bestFor: "East Valley patio and game-night sessions",
        note: "A downtown Chandler cigar bar and lounge with premium cigars, craft beer, spirits, TVs, and food nearby.",
        sourceUrl: "https://purocigarbar.com/",
        areaAliases: ["85225", "downtown chandler", "east valley"],
        searchTerms: ["patio"],
      },
      {
        name: "Oggie's Cigars",
        area: "Scottsdale",
        address: "13610 N Scottsdale Road #27, Scottsdale",
        bestFor: "Casual humidor browsing and locker storage",
        note: "A relaxed Scottsdale cigar shop with a walk-in humidor, cigar lockers, lounge seating, Wi-Fi, and posted events area.",
        sourceUrl: "https://oggiescigars.com/",
        areaAliases: ["85254", "north scottsdale"],
        searchTerms: ["lockers", "humidor"],
      },
      {
        name: "Owl Ear Smoke Shop",
        area: "Scottsdale",
        address: "8920 E. Indian Bend Rd Suite A-1, Scottsdale",
        bestFor: "Membership-free lounge and patio hangs",
        note: "A Scottsdale lounge with indoor seating, an outside patio, sports packages, lockers, and store event updates.",
        sourceUrl: "https://www.owlearsmokeshop.com/lounge",
        areaAliases: ["85250", "indian bend", "central scottsdale"],
        searchTerms: ["patio", "sports"],
      },
    ],
  },
];

export function getEventBySlug(slug: string) {
  return events.find((event) => event.slug === slug);
}

export const adminMetrics = [
  { label: "Orders awaiting age verification", value: "12", icon: UserCheck },
  { label: "Held shipping destinations", value: "4", icon: LockKeyhole },
  { label: "Member allocations ready", value: "27", icon: Warehouse },
  { label: "IoT alert rules active", value: "18", icon: Bell },
];

export const complianceStack = [
  "Age gate before browsing",
  "AgeChecker.Net / Veratad checkout verification",
  "Adult signature required shipping",
  "State-level shipping rules",
  "Stripe Tax and tobacco excise readiness",
  "Compliance audit log per order",
];

export const humidorFeatureList = [
  { title: "Private access", icon: ShieldCheck },
  { title: "Saved collection", icon: Package },
  { title: "Aging dates", icon: CalendarDays },
  { title: "Reorder reminders", icon: ShoppingCart },
  { title: "Member ratings", icon: Star },
  { title: "Tasting notes", icon: BookOpen },
];

export const awsServices = [
  ["Amplify Hosting", "Static Next.js storefront and PWA"],
  ["API Gateway + Lambda", "Checkout, account, support, humidor, and compliance API"],
  ["Stripe", "Hosted Checkout, Billing, Customer Portal, refunds, and disputes"],
  ["S3", "Cigar photos, media, raw support mail, and catalog assets"],
  ["RDS PostgreSQL", "Members, orders, subscriptions, humidor inventory, and audit logs"],
  ["Cognito", "Member authentication"],
  ["EventBridge + SQS/SNS", "Commerce, support, fulfillment, and compliance events"],
  ["SES", "Inbound support email and guarded outbound operator sends"],
  ["Secrets Manager", "Stripe, AgeChecker, tax-provider, shipping, and database secrets"],
  ["Bedrock", "Concierge, support, cigar guide, humidor, admin, and news agents"],
];
