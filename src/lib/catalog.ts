import { importedInventory, type ImportedInventoryItem } from "@/lib/imported-inventory";
import { importedMarketPricesBySku } from "@/lib/imported-market-prices";
import { importedProductDescriptions } from "@/lib/imported-product-descriptions";
import { calculateCatalogPricing, formatCatalogPrice, isCatalogPricingPublishable } from "@/lib/catalog-pricing";

const sunsetImageBaseUrl = "https://swwest.com/Images/SunsetItems";
const lighterImageCategory = "Lighters / Torch";
const butaneFluidCategory = "Butane / Fluid";
const humidorCategory = "Humidors";
const samplePacksCategory = "Sample Packs";
const budgetCategory = "Budget Cigars (Under $50)";
const midRangeCategory = "Mid-Range Cigars ($50-$150)";
const premiumCategory = "Premium Cigars ($150-$300)";
const luxuryCategory = "Luxury Cigars ($300+)";
const priceTierCategories = new Set([budgetCategory, midRangeCategory, premiumCategory, luxuryCategory]);
const genericCigarAttributeCategories = new Set([
  "Belicoso / Torpedo",
  "Connecticut & Shade Grown",
  "Connecticut Wrapper",
  "Corojo Wrapper",
  "Gordo",
  "Habano Wrapper",
  "Maduro Wrapper",
  "Natural Wrapper",
]);
const catalogMissingImageFallback = "/assets/gift-box.png";
const importedMarketPriceLookup: Partial<Record<string, number>> = importedMarketPricesBySku;

const sourceMissingImageSkus = new Set([
  "11711",
  "17643",
  "1284",
  "26767",
  "5089",
  "5955",
  "16364",
  "16365",
  "16363",
  "21020",
  "2361",
  "4021",
  "93143",
  "6396",
  "8382",
  "21361",
  "41325",
  "41324",
  "20522",
  "10582",
  "61020",
  "61021",
  "9562",
  "93165",
  "17958",
  "3067",
  "777126",
  "572613",
  "572610",
  "572681",
  "572317",
  "777097",
  "17764",
  "572323",
  "572632",
  "6586",
  "32788",
  "75331",
  "89162",
  "13500",
  "777293",
  "48443",
  "572590",
  "572576",
]);

const nonProductInventorySkus = new Set(["MISSING-SKU-1757", "MISSING-SKU-10587"]);

const retiredLighterSkus = new Set([
  "57195", // #SCORCH TORCH TURBO STRAIGHT UP SHOOTER DISPLAY 4 FLAME
  "20738", // BLAZER BIG BUDDY TORCH
  "43296", // BLAZER BIG SHOT INDUSTRIAL TORCH
  "88939", // BLAZER BIG SHOT INDUSTRIAL TORCH
  "88938", // BLAZER BIG SHOT INDUSTRIAL TORCH
  "75601", // BLAZER BIG SHOT INDUSTRIAL TORCH
  "46574", // BLAZER BIG SHOT INDUSTRIAL TORCH
  "81228", // BLAZER BIG SHOT INDUSTRIAL TORCH
  "20940", // BLAZER BIG SHOT INDUSTRIAL TORCH
  "12614", // EAGLE PEN TORCH LIGHTER
  "29075", // EAGLE TORCH MONEY CLIP
  "65903", // MAVEN ALPHA CHROME REFILABLE TORCH
  "31452", // MAVEN ALPHA GRADIENT REFILABLE TORCH
  "65906", // MAVEN ALPHA MINI SEQUOIA TORCH DISPLAY
  "65905", // MAVEN ALPHA MINI TRANSPARENT TORCH DISPLAY
  "31451", // MAVEN ALPHA NEON REFILABLE TORCH
  "65904", // MAVEN ALPHA SEQUOIA REFILABLE TORCH
  "31453", // MAVEN ALPHA TRANSPARENT REFILABLE TORCH
  "65908", // MAVEN LAYTOP TRANSPARENT TORCH DISPLAY
  "65907", // MAVEN POPPER TRANSPARENT BOTTLE OPEN TORCH DISPLAY
  "65909", // MAVEN TUNER TRANSPARENT TORCH DISPLAY
  "55890", // NEWPORT ZERO RUBBER SMALL TORCH LIGHTER
  "73644", // SCORCH 3T FANCY TORCH DISPLAY 3 FLAME
  "74035", // SCORCH ADJUSTABLE ANGLE TURBO TORCH DISPLAY 1 FLAME
  "77089", // SCORCH BENDABLE TWO TONE TORCH DISPLAY 1 FLAME
  "88908", // SCORCH CYLINDRICAL BODY ASSORT TORCH DISPLAY 1 FLAME
  "66448", // SCORCH DESIGNER PENCIL TORCH SEE THRU DISPLA 1 FLAME
  "88903", // SCORCH OVAL SHAPE ASSORT TORCH DISPLAY 1 FLAME
  "77087", // SCORCH PASTEL SINGLE FLAME PEN TORCH DISPLAY 1 FLAME
  "73642", // SCORCH PENCIL W/CLIP CAMO TORCH DISPLAY 1 FLAME
  "73643", // SCORCH PLATINUM STANDING PENCIL TORCH DISPLAY 1 FLAME
  "73645", // SCORCH POWERFUL 5" ASSORT DESIGN TORCH DISPLAY
  "88904", // SCORCH POWERFUL ASSORT W/ SIDE IGNIT TORCH DISPLAY 1 FLAME
  "74036", // SCORCH POWERFUL HAND HELD TORCH DISPLAY 1 FLAME
  "88907", // SCORCH RECTANGULAR COLUMN ASSORT TORCH DISPLAY 1 FLAME
  "88909", // SCORCH ROTATING NOZZLE W/CIGAR CUTT TORCH DISPLAY 1 FLAME
  "69500", // SCORCH SEE THRU SATIN FINISH DUAL TORCH DISPLAY 1 FLAME
  "77088", // SCORCH SINGLE FLAME SLIDE BUTTON TORCH DISPLAY 1 FLAME
  "88906", // SCORCH SMILEY FACE ASSORT TORCH DISPLAY 1 FLAME
  "88905", // SCORCH TALL PENCIL ASSORT TORCH DISPLAY 1 FLAME
  "41258", // SCORCH TORCH 3T AUTO TURBO TORCH 3 FLAME
  "75182", // SCORCH TORCH 3T SMOOTH SIDE W/CIGAR PUNCH DISPLAY 3 FLAME
  "57181", // SCORCH TORCH 45 DEGREE ANGLE SHOOTER DISPLAY
  "70277", // SCORCH TORCH ADJUSTABLE 45/90 DEGREE ANGLE MATTE
  "85320", // SCORCH TORCH ANGLE SEE THRU CIGAR 1 FLAME DISPLAY 1 FLAME
  "70310", // SCORCH TORCH BLOW TORCH FANCY DESIGNS
  "85319", // SCORCH TORCH CIGAR & CIGARETTE SINGLE FLAM DISPLAY 1 FLAME
  "10079", // SCORCH TORCH COLOR BOWLING PIN TORCH 1 FLAME
  "11098", // SCORCH TORCH COLOR BULLET TORCH 1 FLAME
  "29435", // SCORCH TORCH COLOR PENCIL TORCH DISPLAY 1 FLAME
  "85321", // SCORCH TORCH COLORFUL GRIP W/ CIGAR PUNCH DISPLAY
  "66447", // SCORCH TORCH DUAL USE SEE THRU TORCH DISPLAY 1 FLAME
  "75185", // SCORCH TORCH FALCON ROCKET NOZZ DISPLAY 1 FLAME
  "49193", // SCORCH TORCH FLEX PENCIL ADJUSTABLE TORCH 1 FLAME
  "75181", // SCORCH TORCH GOLF BAG DISPLAY 1 FLAME
  "24086", // SCORCH TORCH GRAFFITI SEE THRU SLIM TORCH DISLPLAY ONE FLAME
  "70278", // SCORCH TORCH HVY DUTY SOLDERING 90 DEGREE
  "79048", // SCORCH TORCH LARGE UNIVERSAL MULTI USE TOP W/GAS
  "70276", // SCORCH TORCH LEAF DESIGN BLISTER COMBO W/BUTANE
  "70339", // SCORCH TORCH NEON MEGA TORCH W/STAND
  "49191", // SCORCH TORCH OMBRE LAMP TORCH 1 FLAME
  "64184", // SCORCH TORCH OVAL DUAL FUNCTION SEE THROUGH DISPLA 1 FLAME
  "29428", // SCORCH TORCH SINGLE FLINT IGNITER DISPLAY 1 FLAME
  "29176", // SCORCH TORCH SLIM PEN TURBO DISPLAY 1 FLAME
  "31584", // SCORCH TORCH SLIM PENCIL SEE THROUGH DISPLAY 1 FLAME
  "76077", // SCORCH TORCH STANDING W/SEE THROUGH TOP DISPLAY 1 FLAME
  "29433", // SCORCH TORCH STRAIGHT UP SHOOTER LIGHTER 1 FLAME
  "75183", // SCORCH TORCH STRAIGHT UP TORCH ASSORT DISPLAY 1 FLAME
  "70275", // SCORCH TORCH SUPER POWERFUL ASSORTED COLORS
  "31580", // SCORCH TORCH TABLE TORCH 45 DEGREE ANGLE 1 FLAME
  "76078", // SCORCH TORCH TRIPLE TORCH W/CIGAR PUNCH 74581 3 FLAME
  "75184", // SCORCH TORCH VIBRANT BENDABLE PEN DISPLAY 1 FLAME
  "49188", // SCORCH TORCH W/ MINI BUTANE
  "73641", // SCORCH TUBE 45 DEGREE TORCH DISPLAY 1 FLAME
  "69502", // SCORCH WAVY METAL LOCK W/CIGAR PUNCH TORCH DISPLAY 1 FLAME
  "46853", // SCORCH X MAX SERIES 45 DEGREE BLOW TORCH DISPLAY
  "88910", // SCORCH X-MAX MATTE GLOSSY ASSORT TORCH DISPLAY 1 FLAME
  "74037", // SCORCH XL DESIGNER BLOW TORCH 1 FLAME
  "64107", // SMOXY COLT TORCH DISPLAY
  "64108", // SMOXY DELUXE BLACK TORCH
  "64109", // SMOXY DELUXE BLUE TORCH
  "69612", // SMOXY DRAGON TORCH
  "89203", // SMOXY FREEDOM TORCH LIGHTER DISPLAY
  "64106", // SMOXY PRESIDENTE CIGAR TORCH DISPLAY 3 FLAME
  "64105", // SMOXY THRUST TORCH DISPLAY
  "24171", // SPECIAL BLUE AVENGER TORCH DISPLAY
  "85997", // TECHNO CLICK GRAIDIENT COLORED TORCH DISPLAY
  "85999", // TECHNO CLICKER GRADIENT TORCH DISPLAY
  "89161", // TECHNO TORCH FROSTED COLOR FLIP TORCH LIGHTER
  "86775", // TECHNO TORCH PSYCHEDELIC SPINNER DISPLAY W/ LED LIGHT
  "89160", // TECHNO TORCH SLANT ASST METAL COLOR TORCH LIGHTER
  "88435", // TECHNO TORCH SLANT W/SWIVEL HEAD DISPLAY
  "86780", // TECHNO TORCH STAR SKULLS SLIDE TORCH DISPLAY
  "88437", // TECHNO TORCH TRIPLE TORCH LIGHTER DISPLAY
  "69497", // TESLA 2 FLAME STRAIGHT UP SHOOTER DISPLAY
  "69496", // TESLA 2 TONE 3 FLAME 45 DEGREE TORCH DISPLADISPLAY
  "69493", // TESLA 2 TONE DBL FLAME W/CIGAR PUNCH DISPLAY
  "69494", // TESLA 2 TONE EASY SLIDE TRIGGER TORCH DISPLAY
  "77086", // TESLA 3 FLAME CIGAR TORCH W/POKER & PUNCH DISPLAY
  "64186", // TESLA AMPLE TABLE TORCH DISLAY
  "31120", // TESLA CIGAR PUNCH W/SATIN 2 TONE TORCH DISPLAY
  "69499", // TESLA DYNAMIC 2 FLAME W/SEE THRU BUTANE DISPLAY
  "44998", // TESLA METALLIC OMBRE PENCIL TORCH DISPLAY
  "31119", // TESLA OMBRE CIGAR PUNCH TORCH DISPLAY
  "57186", // TESLA PHASER TORCH STRAIGHT UP DISPLAY
  "46000", // TESLA QUAD SEE THRU BUTANE CIGAR TORCH DISPLAY
  "31695", // TESLA SLIM WAND SEE THROUGH TORCH DISPLAY
  "69498", // TESLA SMOOTH PRESS EASY GRIP TORCH DISPLAY
  "57185", // TESLA TORCH 45 DEGREE W/PUNCH CHROME & STAINLESS
  "57190", // TESLA TORCH MARBLE/STONE DISPLAY
  "69495", // TESLA TURBO 2 FLAME BLACK MATTE TORCH DISPLAY
  "44686", // TESLA TURBO STANDING PENCIL TORCH DISPLAY
  "64187", // TESLA TWO TORCH PUSH UP CAP W/EZ DIAL DISPLAY
  "31632", // VECTOR (ICON-IV/05) BLACK CRACKLE MATTE
  "31664", // VECTOR (ICON-IV/06) SPARKLE BLUE
  "31630", // VECTOR (ICON-IV/08) RED LACQUER
  "31629", // VECTOR (ICON-IV/12) PRIZM SENSOR
  "28546", // VECTOR (THRONE/06) BLUE MATTE QUAD JET FLAME
  "28548", // VECTOR (THRONE/08) RED MATTE QUAD JET FLAME
]);

const publishedSwwestLighterSkus = new Set([
  "85318",
  "85321",
  "76078",
  "46853",
  "81274",
  "69496",
  "85319",
  "69493",
  "69494",
  "77086",
  "31120",
  "31119",
]);

const localLighterImageSkus = new Set([
  ...publishedSwwestLighterSkus,
  "20740",
  "81248",
  "31601",
  "31682",
  "31683",
  "41866",
  "41867",
  "28551",
]);

const catalogImageOverrides: Record<string, string> = {
  "41205": `${sunsetImageBaseUrl}/41205/0.jpg`,
  "48443": catalogMissingImageFallback,
  "572590": "/assets/inventory/cigars/my-father-la-antiguedad-super-toro-20-bx.jpg",
  "572576": catalogMissingImageFallback,
  "777146": "/assets/inventory/cigars/my-father-blue-petit-robusto-20-bx.jpg",
  "777147": "/assets/inventory/cigars/my-father-blue-robusto-20-bx.jpg",
  "777148": "/assets/inventory/cigars/my-father-blue-toro-20-bx.jpg",
  "777149": "/assets/inventory/cigars/my-father-blue-toro-gordo-20-bx.jpg",
  "113887": "/assets/inventory/cigars/flor-de-las-antillas-toro-20-bx.jpg",
  "113886": "/assets/inventory/cigars/flor-de-las-antillas-robusto-20-bx.jpg",
  "MISSING-SKU-NICA-RUSTICA-GORDO": "/assets/inventory/cigars/nica-rustica-gordo-25-bx.jpg",
  "MISSING-SKU-UNDERCROWN-SHADE-GORDITO": "/assets/inventory/cigars/undercrown-shade-gordito.jpg",
  "572429": "/assets/inventory/cigars/undercrown-maduro-robusto.jpg",
  "MISSING-SKU-UNDERCROWN-MADURO-TORO": "/assets/inventory/cigars/undercrown-maduro-toro.jpg",
  "572749": "/assets/inventory/cigars/deadwood-dia-de-los-muertos-20-bx.jpg",
  "572753": "/assets/inventory/cigars/deadwood-girl-with-no-name-lonsdale-20-bx.jpg",
  "777229": "/assets/inventory/cigars/aging-room-nicaragua-sonata-maestro-10-bx.jpg",
  "777230": "/assets/inventory/cigars/aging-room-nicaragua-concerto-maestro-10-bx.jpg",
  "777242": "/assets/inventory/cigars/cao-flathead-speed-shop-v554-24-bx.jpg",
  "777243": "/assets/inventory/cigars/cao-flathead-speed-shop-v660-24-bx.jpg",
  "572744": "/assets/inventory/cigars/liga-privada-h99-papas-fritas-10-bx.jpg",
  "572745": "/assets/inventory/cigars/liga-privada-h99-papas-fritas-10-bx.jpg",
  "2754": "/assets/inventory/acid-1400cc-open-box.jpg",
  "18821": "/assets/inventory/acid-20-toro-maduro-open-box.jpg",
  "39919": "/assets/inventory/acid-20-twenty-year-open-box.jpg",
  "4621": "/assets/inventory/acid-atom-maduro-open-box.jpg",
  "2651": "/assets/inventory/acid-blondie-open-box.jpg",
  "2654": "/assets/inventory/acid-blondie-belicoso-open-box.jpg",
  "17219": "/assets/inventory/acid-blondie-green-label-open-box.jpg",
  "11787": "/assets/inventory/acid-blondie-maduro-open-box.jpg",
  "2649": "/assets/inventory/acid-cold-infusion-open-box.jpg",
  "3251": "/assets/inventory/acid-deep-dish-open-box.jpg",
  "5867": "/assets/inventory/acid-extra-ordinary-larry-open-box.jpg",
  "2647": "/assets/inventory/acid-krush-classic-blue-connecticut-open-tin.jpg",
  "2760": "/assets/inventory/acid-krush-classic-gold-sumatra-open-tin.jpg",
  "2759": "/assets/inventory/acid-krush-classic-morado-maduro-open-tin.jpg",
  "2761": "/assets/inventory/acid-krush-classic-red-cameroon-open-tin.jpg",
  "9798": "/assets/inventory/acid-kuba-grande-open-box.jpg",
  "2653": "/assets/inventory/acid-kuba-kuba-open-box.jpg",
  "17218": "/assets/inventory/acid-kuba-kuba-green-label-open-box.jpg",
  "2652": "/assets/inventory/acid-kuba-maduro-open-box.jpg",
  "27794": "/assets/inventory/acid-plush-open-box.jpg",
  "2648": "/assets/inventory/acid-toast-open-box.jpg",
};

const brandPrefixes: Array<[prefix: string, label: string]> = [
  ["AJ FERNANDEZ", "AJ Fernandez"],
  ["ARTURO FUENTE", "Arturo Fuente"],
  ["ALEC BRADLEY", "Alec Bradley"],
  ["AGING ROOM", "Aging Room"],
  ["DEADWOOD", "Deadwood"],
  ["NICA RUSTICA", "Nica Rustica"],
  ["FONSECA", "Fonseca"],
  ["LIGA UNDERCROWN", "Liga Undercrown"],
  ["LIGA PRIVADA", "Liga Privada"],
  ["UNDERCROWN", "Undercrown"],
  ["CAO", "CAO"],
  ["LA AROMA", "La Aroma"],
  ["LA FLOR", "La Flor"],
  ["MY FATHER", "My Father"],
  ["ROCKY PATEL", "Rocky Patel"],
  ["SAN CRISTOBAL", "San Cristobal"],
  ["ACID", "ACID"],
  ["PADRON", "Padron"],
  ["PLASENCIA", "Plasencia"],
  ["DAVIDOFF", "Davidoff"],
  ["COHIBA", "Cohiba"],
  ["SCORCH", "Scorch"],
  ["SMOXY", "Smoxy"],
  ["SPECIAL BLUE", "Special Blue"],
  ["TECHNO", "Techno"],
  ["TESLA", "Tesla"],
  ["VECTOR", "Vector"],
];

const cigarAficionadoSearchBaseUrl = "https://www.cigaraficionado.com/ratings/search";

export type CatalogProduct = {
  id: string;
  sku: string;
  slug: string;
  name: string;
  brand: string;
  category: string;
  price: number;
  marketPrice: number;
  nonMemberPrice: number;
  memberPrice: number;
  description: string;
  packageLabel: string;
  packageCount: number;
  availability: "In stock" | "Low stock" | "Out of stock";
  sourceStatus: string;
  managedStock: boolean;
  sourceQuantity: number | null;
  image: string;
  imagePosition: string;
  tags: string[];
  memberOnly: boolean;
  status: string;
  publishStatus: "draft" | "published" | "archived";
  inventoryPolicy: "track" | "manual" | "preorder";
  shippable: boolean;
  adultSignatureRequired: boolean;
  stripeProductId: string | null;
  stripePriceId: string | null;
  storeHref: string;
  origin?: string;
  wrapper?: string;
  vitola?: string;
  length?: string;
  gauge?: string;
  strength?: string;
  filler?: string;
  binder?: string;
  expertReview?: CatalogExpertReview;
  reviewProfile?: CatalogReviewProfile;
  reviewSearchUrl: string;
};

export type CatalogExpertReview = {
  sourceName: "Cigar Aficionado";
  sourceUrl: string;
  score: number;
  issue: string;
  tastingSummary: string;
  otherReviews: Array<{
    score: number;
    issue: string;
    sourceUrl: string;
  }>;
};

export type CatalogReviewProfile = {
  summary: string;
  sources: Array<{
    sourceName: string;
    sourceUrl: string;
    rating: string;
    keyDetails: string[];
  }>;
};

type CatalogProductEnrichment = Pick<
  CatalogProduct,
  "origin" | "wrapper" | "vitola" | "length" | "gauge" | "strength" | "filler" | "binder" | "expertReview" | "reviewProfile"
>;

export type CatalogProductDetails = {
  summary: string;
  signals: string[];
  availability: string;
  fulfillment: string[];
  adminNote: string;
};

export type CatalogListingProduct = Pick<
  CatalogProduct,
  | "id"
  | "sku"
  | "slug"
  | "name"
  | "brand"
  | "category"
  | "price"
  | "marketPrice"
  | "nonMemberPrice"
  | "memberPrice"
  | "image"
  | "imagePosition"
  | "tags"
  | "memberOnly"
  | "status"
  | "packageLabel"
  | "availability"
  | "vitola"
  | "length"
  | "gauge"
  | "strength"
> & {
  description?: string;
  expertReview?: Pick<CatalogExpertReview, "sourceName" | "score">;
};

const researchedCatalogEnrichment: Record<string, Partial<CatalogProductEnrichment>> = {
  "acid-1400cc-18-bx": {
    origin: "Nicaragua",
    wrapper: "U.S.A. Connecticut Shade",
    vitola: "Robusto",
    length: '5"',
    gauge: "50",
    filler: "Nicaragua",
    binder: "Nicaragua",
  },
  "acid-20-toro-maduro-24-bx": {
    origin: "Nicaragua",
    wrapper: "Mexican San Andres Maduro",
    vitola: "Toro",
    length: '6"',
    gauge: "50",
    strength: "Medium",
    filler: "Nicaragua",
    binder: "Indonesia",
    reviewProfile: {
      summary:
        "ACID 20 Maduro Toro has sourced line-level community signals and an exact Toro publication review, led by Cigar Coop's 87-point assessment of the 6 x 50 Toro.",
      sources: [
        {
          sourceName: "Cigar Coop",
          sourceUrl: "https://cigar-coop.com/2021/05/agile-cigar-review-acid-20-toro-by-drew-estate.html",
          rating: "87",
          keyDetails: [
            "Reviewed the ACID 20 Toro by Drew Estate as a 6 x 50 Toro with Mexican San Andres wrapper, Indonesian binder, and Nicaraguan filler.",
            "Key flavors include mocha, licorice, earth, white pepper, and sweetened-tip sweetness.",
            "Rated the Toro 87 with a Buy One value call and medium body.",
          ],
        },
        {
          sourceName: "Cigar World",
          sourceUrl: "https://www.cigarworld.com/cigars/acid/acid-20/",
          rating: "4.63 community rating",
          keyDetails: [
            "Lists ACID 20 with Mexican San Andres wrapper, Indonesian binder, Nicaraguan filler, and Toro among the available sizes.",
            "Community profile tags call out earthy, spice, and herbal tasting notes.",
            "Visible community reviews include 5-star, 4-star, and 5-star ratings from 2022 through 2025.",
          ],
        },
        {
          sourceName: "Holt's Cigar Co.",
          sourceUrl: "https://www.holts.com/cigars/all-cigar-brands/acid-20.html",
          rating: "5/5 from 5 customer reviews",
          keyDetails: [
            "Retailer page lists Acid 20 by Drew Estate with a Toro 6 x 50 option and box-of-24 purchase format.",
            "Shows five customer reviews for the Acid 20 line, all in the five-star distribution.",
            "Product notes identify San Andres wrapper, Nicaraguan country, and Robusto/Toro shapes.",
          ],
        },
      ],
    },
  },
  "acid-20-twenty-year-24-bx": {
    origin: "Nicaragua",
    wrapper: "Mexican San Andres Maduro",
    vitola: "Robusto",
    length: '5"',
    gauge: "50",
    strength: "Medium",
    filler: "Nicaragua",
    binder: "Indonesia",
    reviewProfile: {
      summary:
        "ACID 20 community and retailer ratings skew positive, while scored review coverage frames it as a strong infused-cigar pick with sweetness, mocha, licorice, earth, and white pepper rather than a high-complexity traditional profile.",
      sources: [
        {
          sourceName: "Cigar World",
          sourceUrl: "https://www.cigarworld.com/cigars/acid/acid-20/",
          rating: "4.63 community rating",
          keyDetails: [
            "Lists the blend as medium-bodied and box-pressed with a sweet-tipped Mexican San Andres wrapper, Indonesian binder, and Nicaraguan fillers.",
            "Tasting-note tags call out earthy, spice, and herbal, with Robusto BP and Toro shown as available sizes.",
            "Recent visible reviews include 5-star, 4-star, and 5-star customer ratings across 2022-2025.",
          ],
        },
        {
          sourceName: "CIGAR.com",
          sourceUrl: "https://www.cigar.com/product/acid-cigars-by-drew-estate-acid-20/AID-PM.html",
          rating: "4.5/5 from 21 customer ratings",
          keyDetails: [
            "Profiles ACID 20 in Robusto and Toro shapes with San Andres wrapper, Nicaraguan origin, Indonesian binder, and Nicaraguan fillers.",
            "Marks the profile as medium and sweet, matching the shopper expectation for an infused ACID anniversary release.",
          ],
        },
        {
          sourceName: "Cigar Coop",
          sourceUrl: "https://cigar-coop.com/2021/03/cigar-review-acid-20-robusto-by-drew-estate.html",
          rating: "88 Robusto / 87 Toro",
          keyDetails: [
            "Scored the Robusto at 88 and the later Toro assessment at 87, both with a Buy One value call.",
            "Key flavors across the assessments include mocha, licorice, earth, white pepper, and artificial-sweetener sweetness from the cap.",
            "The Toro review notes mild-to-medium strength and medium body, with the Robusto getting the edge on burn performance.",
          ],
        },
      ],
    },
  },
  "acid-atom-maduro-24-bx": {
    origin: "Nicaragua",
    wrapper: "Connecticut Broadleaf Maduro",
    vitola: "Robusto",
    length: '5"',
    gauge: "50",
    filler: "Nicaragua",
    binder: "Nicaragua",
  },
  "acid-blondie-40-ct": {
    origin: "Nicaragua",
    wrapper: "Connecticut",
    vitola: "Petit Corona",
    length: '4"',
    gauge: "38",
    filler: "Nicaragua",
    binder: "Nicaragua",
  },
  "acid-blondie-5-1-g-fresh-pack": {
    origin: "Nicaragua",
    wrapper: "Connecticut",
    vitola: "Petit Corona",
    length: '4"',
    gauge: "38",
    filler: "Nicaragua",
    binder: "Nicaragua",
  },
  "acid-blondie-belicoso-24-bx": {
    origin: "Nicaragua",
    wrapper: "U.S.A. Connecticut Shade",
    vitola: "Belicoso",
    length: '5"',
    gauge: "54",
    filler: "Nicaragua",
    binder: "Nicaragua",
  },
  "acid-blondie-green-label-40-bx": {
    origin: "Nicaragua",
    wrapper: "Candela",
    vitola: "Petit Corona",
    length: '4"',
    gauge: "38",
    strength: "Mild",
    filler: "Nicaragua",
    binder: "Nicaragua",
  },
  "acid-blondie-maduro-40-bx": {
    origin: "Nicaragua",
    wrapper: "Mexican San Andres Maduro",
    vitola: "Petit Corona",
    length: '4"',
    gauge: "38",
    filler: "Nicaragua",
    binder: "Nicaragua",
  },
  "acid-cold-infusion-24-bx": {
    origin: "Nicaragua",
    wrapper: "Connecticut Shade",
    vitola: "Corona",
    length: '6.75"',
    gauge: "44",
    filler: "Nicaragua",
    binder: "Nicaragua",
  },
  "acid-deep-dish-24-bx": {
    origin: "Nicaragua",
    wrapper: "Sumatra",
    vitola: "Robusto Grande",
    length: '5"',
    gauge: "58",
    strength: "Mild-Medium",
    filler: "Nicaragua",
    binder: "Nicaragua",
  },
  "acid-extra-ordinary-larry-10-bx": {
    origin: "Nicaragua",
    wrapper: "Connecticut Broadleaf Maduro",
    vitola: "Gordo",
    length: '6"',
    gauge: "60",
    strength: "Medium-Full",
    filler: "Nicaragua",
    binder: "Nicaragua",
  },
  "acid-krush-classic-blue-connecticut-5-10-tins": {
    origin: "Nicaragua",
    wrapper: "Connecticut",
    vitola: "Cigarillo",
    length: '4"',
    gauge: "32",
    filler: "Nicaragua",
    binder: "Nicaragua",
  },
  "acid-krush-classic-gold-sumatra-5-10-tins": {
    origin: "Nicaragua",
    wrapper: "Sumatra",
    vitola: "Cigarillo",
    length: '4"',
    gauge: "32",
    filler: "Nicaragua",
    binder: "Nicaragua",
  },
  "acid-krush-classic-morado-maduro-5-10-tins": {
    origin: "Nicaragua",
    wrapper: "Connecticut Broadleaf Maduro",
    vitola: "Cigarillo",
    length: '4"',
    gauge: "32",
    strength: "Medium",
    filler: "Nicaragua",
    binder: "Nicaragua",
  },
  "acid-krush-classic-red-cameroon-5-10-tins": {
    origin: "Nicaragua",
    wrapper: "Cameroon",
    vitola: "Cigarillo",
    length: '4"',
    gauge: "32",
    filler: "Nicaragua",
    binder: "Nicaragua",
  },
  "acid-kuba-grande-10-bx": {
    origin: "Nicaragua",
    wrapper: "Sumatra",
    vitola: "Gordo",
    length: '6"',
    gauge: "60",
    filler: "Nicaragua",
    binder: "Nicaragua",
  },
  "acid-kuba-kuba-24-bx": {
    origin: "Nicaragua",
    wrapper: "Sumatra",
    vitola: "Robusto",
    length: '5"',
    gauge: "54",
    filler: "Nicaragua",
    binder: "Nicaragua",
  },
  "acid-kuba-kuba-green-label-24-bx": {
    origin: "Nicaragua",
    wrapper: "Candela",
    vitola: "Robusto",
    length: '5"',
    gauge: "54",
    filler: "Nicaragua",
    binder: "Nicaragua",
  },
  "acid-kuba-maduro-24-bx": {
    origin: "Nicaragua",
    wrapper: "Connecticut Broadleaf Maduro",
    vitola: "Robusto",
    length: '5"',
    gauge: "54",
    strength: "Medium-Full",
    filler: "Nicaragua",
    binder: "Nicaragua",
  },
  "acid-plush-24-bx": {
    origin: "Nicaragua",
    wrapper: "Connecticut Broadleaf Maduro",
    vitola: "Robusto",
    length: '5.5"',
    gauge: "50",
    filler: "Nicaragua",
    binder: "Nicaragua",
  },
  "acid-toast-24-bx": {
    origin: "Nicaragua",
    wrapper: "Cameroon Maduro",
    vitola: "Toro",
    length: '6"',
    gauge: "50",
    strength: "Medium-Full",
    filler: "Nicaragua",
    binder: "Nicaragua",
  },
  "deadwood-crazy-alice-10-bx": {
    origin: "Nicaragua",
    wrapper: "Connecticut Broadleaf Maduro",
    vitola: "Pyramid",
    length: '4"',
    gauge: "52",
    strength: "Medium-Full",
    filler: "Nicaragua",
    binder: "Nicaragua",
  },
  "deadwood-dominicana-noches-gordo-10-bx": {
    origin: "Nicaragua",
    wrapper: "Connecticut Broadleaf",
    vitola: "Gordo",
    length: '6"',
    gauge: "60",
    strength: "Medium",
    filler: "Dominican Republic, Nicaragua",
    binder: "Mexican San Andres",
  },
  "deadwood-dominicana-noches-robusto-10-bx": {
    origin: "Nicaragua",
    wrapper: "Connecticut Broadleaf",
    vitola: "Robusto",
    length: '5"',
    gauge: "54",
    strength: "Medium",
    filler: "Dominican Republic, Nicaragua",
    binder: "Mexican San Andres",
  },
  "deadwood-dominicana-noches-toro-10-bx": {
    origin: "Nicaragua",
    wrapper: "Connecticut Broadleaf",
    vitola: "Toro",
    length: '6"',
    gauge: "50",
    strength: "Medium",
    filler: "Dominican Republic, Nicaragua",
    binder: "Mexican San Andres",
  },
  "h-upmann-heritage-robusto": {
    origin: "Nicaragua",
    wrapper: "Brazil",
    vitola: "Robusto",
    length: '5"',
    gauge: "52",
    strength: "Medium-Full",
    filler: "Nicaragua",
    binder: "Nicaragua",
    expertReview: {
      sourceName: "Cigar Aficionado",
      sourceUrl: "https://www.cigaraficionado.com/rating/h-upmann-nicaragua-by-aj-fernandez-heritage-robusto",
      score: 90,
      issue: "Cigar Aficionado - Aug 01, 2022",
      tastingSummary: "A veiny Robusto profile with anise, herbs, pepper, vanilla, malt, and sharp combustion.",
      otherReviews: [],
    },
  },
  "h-upmann-nicaraguan-toro-20-bx-aj-fernandez": {
    origin: "Nicaragua",
    wrapper: "Ecuador",
    vitola: "Toro",
    length: '6"',
    gauge: "54",
    strength: "Medium",
    filler: "Dominican Republic, Nicaragua",
    binder: "Nicaragua",
    expertReview: {
      sourceName: "Cigar Aficionado",
      sourceUrl: "https://www.cigaraficionado.com/ratings/25341/name/h.-upmann-by-aj-fernandez-toro-toro",
      score: 92,
      issue: "Cigar Aficionado - Aug 01, 2024",
      tastingSummary: "A bright Toro profile with spice, dried fruit, hickory, nuts, cherry, coconut, and leather.",
      otherReviews: [
        {
          score: 92,
          issue: "Cigar Aficionado - Oct 01, 2022",
          sourceUrl: "https://www.cigaraficionado.com/ratings/23806/name/h-upmann-by-aj-fernandez-toro",
        },
        {
          score: 88,
          issue: "Cigar Insider - Jun 20, 2017",
          sourceUrl: "https://www.cigaraficionado.com/ratings/19823/name/h-upmann-by-aj-fernandez-toro",
        },
      ],
    },
  },
  "h-upmann-robusto-by-aj-fernandez-20-bx": {
    origin: "Nicaragua",
    wrapper: "Ecuador",
    vitola: "Robusto",
    length: '5"',
    gauge: "52",
    strength: "Medium-Full",
    filler: "Dominican Republic, Nicaragua",
    binder: "Nicaragua",
  },
  "h-upmann-nicaragua-sunrise-magnum-20-bx": {
    origin: "Nicaragua",
    wrapper: "Ecuadorian Connecticut",
    vitola: "Magnum",
    length: '6"',
    gauge: "60",
    strength: "Medium",
    filler: "Nicaragua",
    binder: "Nicaragua",
  },
  "h-upmann-nicaragua-sunrise-robusto-20-box": {
    origin: "Nicaragua",
    wrapper: "Ecuadorian Connecticut",
    vitola: "Robusto",
    length: '5"',
    gauge: "52",
    strength: "Medium",
    filler: "Nicaragua",
    binder: "Nicaragua",
  },
  "h-upmann-nicaragua-sunrise-toro-20-bx": {
    origin: "Nicaragua",
    wrapper: "Ecuadorian Connecticut",
    vitola: "Toro",
    length: '6"',
    gauge: "54",
    strength: "Medium",
    filler: "Nicaragua",
    binder: "Nicaragua",
  },
  "h-upmann-the-banker-daytrader-toro-10-bx": {
    origin: "Dominican Republic",
    wrapper: "Ecuador",
    vitola: "Toro",
    length: '6"',
    gauge: "54",
    strength: "Medium-Full",
    filler: "Dominican Republic, Nicaragua",
    binder: "Nicaragua",
    expertReview: {
      sourceName: "Cigar Aficionado",
      sourceUrl: "https://www.cigaraficionado.com/ratings/24958/name/h-upmann-the-banker-daytrader-toro-toro",
      score: 90,
      issue: "Cigar Insider - Nov 21, 2023",
      tastingSummary: "A substantial Toro reviewed with leather, ginger snap, almond, minerals, and a tangy finish.",
      otherReviews: [],
    },
  },
  "la-aroma-de-cuba-robusto-24-bx": {
    origin: "Nicaragua",
    wrapper: "U.S.A. Connecticut Broadleaf",
    vitola: "Robusto",
    length: '5.25"',
    gauge: "54",
    strength: "Full",
    filler: "Nicaragua",
    binder: "Nicaragua",
  },
  "my-father-don-pepin-clasicos-20th-20-bx": {
    origin: "Nicaragua",
    wrapper: "Nicaraguan Habano",
    vitola: "Toro Extra",
    length: '6.5"',
    gauge: "52",
    strength: "Full",
    filler: "Nicaragua",
    binder: "Nicaragua",
  },
  "oliva-serie-v-melanio-maduro-dbl-toro-10-bx": {
    origin: "Nicaragua",
    wrapper: "Mexican San Andres Maduro",
    vitola: "Double Toro",
    length: '6"',
    gauge: "60",
    strength: "Medium-Full",
    filler: "Nicaragua",
    binder: "Nicaragua",
  },
  "oliva-serie-v-melanio-soccer-edition-24-bx": {
    origin: "Nicaragua",
    wrapper: "Ecuadorian Sumatra, Mexican San Andres Maduro",
    vitola: "Double Toro",
    length: '6"',
    gauge: "60",
    strength: "Medium-Full",
    filler: "Nicaragua",
    binder: "Nicaragua",
  },
  "plasencia-explorer-sampler-6-bx": {
    origin: "Nicaragua",
    wrapper: "Varies by selection",
    vitola: "Sampler",
    length: "Assorted",
    gauge: "Assorted",
    strength: "Medium-Full",
    filler: "Varies by selection",
    binder: "Varies by selection",
  },
};

export function getCatalogImageUrl(sku: string, category?: string) {
  const normalizedSku = sku.trim();
  const overrideImage = catalogImageOverrides[normalizedSku];

  if (overrideImage) {
    return overrideImage;
  }

  if (!/^\d+$/.test(normalizedSku)) {
    return "/assets/gift-box.png";
  }

  if (category?.trim() === lighterImageCategory && localLighterImageSkus.has(normalizedSku)) {
    return `/assets/inventory/lighters/${normalizedSku}-single-lighter.jpg`;
  }

  return `${sunsetImageBaseUrl}/${normalizedSku}/0.jpg`;
}

function toTitleCase(value: string) {
  return value
    .toLowerCase()
    .replace(/\b[a-z]/g, (letter) => letter.toUpperCase());
}

function inferBrand(productName: string) {
  const normalizedName = productName.trim().replace(/^\d+\s*x\s*\d+\s+/i, "");
  const upperName = normalizedName.toUpperCase();
  const knownBrand = brandPrefixes.find(([prefix]) => upperName.startsWith(prefix));

  if (knownBrand) {
    return knownBrand[1];
  }

  const [firstWord = "Catalog"] = normalizedName.split(/\s+/);
  return toTitleCase(firstWord);
}

function inferPackage(productName: string) {
  const packagePatterns: Array<{
    pattern: RegExp;
    label: (match: RegExpMatchArray) => string;
    count: (match: RegExpMatchArray) => number;
  }> = [
    {
      pattern: /(\d+)\s*\/\s*(?:BX|BOX|B)\b/i,
      label: (match) => `Box of ${match[1]}`,
      count: (match) => Number(match[1]),
    },
    {
      pattern: /\bBX\s*\/\s*(\d+)\b/i,
      label: (match) => `Box of ${match[1]}`,
      count: (match) => Number(match[1]),
    },
    {
      pattern: /(\d+)\s*\/\s*(?:CT|COUNT)\b/i,
      label: (match) => `${match[1]} count`,
      count: (match) => Number(match[1]),
    },
    {
      pattern: /(\d+)\s*(?:CT|COUNT)\b/i,
      label: (match) => `${match[1]} count`,
      count: (match) => Number(match[1]),
    },
    {
      pattern: /(\d+)\s*\/\s*PACK\b/i,
      label: (match) => `${match[1]} pack`,
      count: (match) => Number(match[1]),
    },
    {
      pattern: /(\d+)\s*PACK\b/i,
      label: (match) => `${match[1]} pack`,
      count: (match) => Number(match[1]),
    },
    {
      pattern: /(\d+)\s*\/\s*(\d+)\s*TINS?\b/i,
      label: (match) => `${match[1]} x ${match[2]} tins`,
      count: (match) => Number(match[1]) * Number(match[2]),
    },
  ];

  for (const packagePattern of packagePatterns) {
    const match = productName.match(packagePattern.pattern);

    if (match) {
      return {
        label: packagePattern.label(match),
        count: packagePattern.count(match),
      };
    }
  }

  if (/display/i.test(productName)) {
    return { label: "Display unit", count: 1 };
  }

  return { label: "Catalog item", count: 1 };
}

function getAvailability(item: ImportedInventoryItem): CatalogProduct["availability"] {
  if (item.sourceStatus !== "instock") {
    return "Out of stock";
  }

  if (item.sourceQuantity !== null && item.sourceQuantity <= 12) {
    return "Low stock";
  }

  return "In stock";
}

function getPriceTierCategory(price: number) {
  if (price >= 300) {
    return luxuryCategory;
  }

  if (price >= 150) {
    return premiumCategory;
  }

  if (price >= 50) {
    return midRangeCategory;
  }

  return budgetCategory;
}

function isSamplerProduct(productName: string) {
  return /\b(SAMPLER|SAMPLE\s+PACK|FRESH\s*PACK)\b/i.test(productName);
}

function isHumidorProduct(productName: string) {
  return /\bHUMIDOR\b/i.test(productName);
}

function isFuelProduct(productName: string) {
  return /\b(BOOK\s+MATCHES|BUTANE|LIGHTER\s+FLUID|FLUID|GAS|REFILL)\b/i.test(productName);
}

function isLighterProduct(productName: string) {
  return /\b(LIGHTER|TORCH)\b/i.test(productName);
}

function getCatalogCategory(item: ImportedInventoryItem) {
  if (isSamplerProduct(item.product)) {
    return samplePacksCategory;
  }

  if (isHumidorProduct(item.product)) {
    return humidorCategory;
  }

  if (isFuelProduct(item.product)) {
    return butaneFluidCategory;
  }

  if (isLighterProduct(item.product)) {
    return lighterImageCategory;
  }

  if (priceTierCategories.has(item.category) || genericCigarAttributeCategories.has(item.category)) {
    return getPriceTierCategory(item.price);
  }

  return item.category.trim() || getPriceTierCategory(item.price);
}

function getTags(item: ImportedInventoryItem, availability: CatalogProduct["availability"], category = getCatalogCategory(item)) {
  const tags = [category];

  if (availability === "Low stock") {
    tags.push("Low stock");
  }

  if (item.price >= 150) {
    tags.push("Premium");
  }

  return tags.slice(0, 3);
}

function isPublishableImportedInventoryItem(item: ImportedInventoryItem) {
  if (nonProductInventorySkus.has(item.sku)) {
    return false;
  }

  if (retiredLighterSkus.has(item.sku) && !publishedSwwestLighterSkus.has(item.sku)) {
    return false;
  }

  if (item.price <= 0) {
    return false;
  }

  if (!Number.isFinite(Number(importedMarketPriceLookup[item.sku])) || Number(importedMarketPriceLookup[item.sku]) <= 0) {
    return false;
  }

  if (!isCatalogPricingPublishable({ currentPrice: item.price, marketPrice: importedMarketPriceLookup[item.sku] })) {
    return false;
  }

  if (sourceMissingImageSkus.has(item.sku) && !catalogImageOverrides[item.sku]) {
    return false;
  }

  return true;
}

function getPublishedImportedInventory(items: ImportedInventoryItem[]) {
  const seenSkus = new Set<string>();
  const publishedItems: ImportedInventoryItem[] = [];

  for (const item of items) {
    const normalizedSku = item.sku.trim();

    if (seenSkus.has(normalizedSku)) {
      continue;
    }

    seenSkus.add(normalizedSku);

    if (!isPublishableImportedInventoryItem(item)) {
      continue;
    }

    publishedItems.push(item);
  }

  return publishedItems;
}

function getReviewSearchUrl(productName: string) {
  const search = new URLSearchParams({ q: stripPackageFromName(productName) });

  return `${cigarAficionadoSearchBaseUrl}?${search.toString()}`;
}

export function isCigarCatalogProduct(product: Pick<CatalogProduct, "category" | "name">) {
  const nonCigarPattern = /lighter|torch|fluid|butane|humidor|membership|accessor|ashtray|cutter|punch|display|book matches/i;

  return !nonCigarPattern.test(product.category) && !nonCigarPattern.test(product.name);
}

function extractLabeledValue(text: string, label: string) {
  const nextLabels = [
    "Country of Origin",
    "Country",
    "Wrapper",
    "Shape",
    "Profile",
    "Strength",
    "Binder",
    "Filler",
    "Sold as",
    "Available",
    "Box of",
  ];
  const escapedLabels = nextLabels
    .filter((nextLabel) => nextLabel !== label)
    .map((nextLabel) => nextLabel.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .join("|");
  const match = text.match(new RegExp(`${label}:\\s*([\\s\\S]*?)(?=\\s+(?:${escapedLabels}):|$)`, "i"));

  return cleanSpecValue(match?.[1] ?? "");
}

function cleanSpecValue(value: string) {
  return value
    .replace(/\s+/g, " ")
    .replace(/\s+(?:Sold as|Available in|Box of).*/i, "")
    .replace(/[.,;]\s*$/, "")
    .trim();
}

function normalizeLength(value: string) {
  const cleaned = value.replace(/\s+/g, " ").trim();

  if (!cleaned) {
    return undefined;
  }

  if (cleaned.includes('"')) {
    return cleaned.replace(/\s*"\s*$/, '"');
  }

  return `${cleaned}"`;
}

function normalizeStrength(profile: string) {
  const value = profile.toLowerCase();

  if (!value) {
    return undefined;
  }

  if (/(medium|mellow|mild)\s*(?:-|to)\s*full|full\s*(?:-|to)\s*medium/.test(value)) {
    return "Medium-Full";
  }

  if (/(mild|mellow)\s*(?:-|to)\s*medium|medium\s*(?:-|to)\s*(mild|mellow)/.test(value)) {
    return "Mild-Medium";
  }

  if (/full/.test(value)) {
    return "Full";
  }

  if (/medium/.test(value)) {
    return "Medium";
  }

  if (/mild|mellow/.test(value)) {
    return "Mild";
  }

  return toTitleCase(profile.replace(/\b(body|bodied|profile)\b/gi, "").trim());
}

function parseShape(shape: string, productName: string) {
  const searchableShape = `${shape} ${productName}`;
  const sizeMatch =
    searchableShape.match(/(\d+(?:\s+\d+\/\d+)?|\d+(?:\.\d+)?)\s*(?:"|inches?|in\.)?\s*(?:x|by)\s*(\d{2})/i) ??
    searchableShape.match(/\b(\d+(?:\s+\d+\/\d+)?|\d+(?:\.\d+)?)\s*(?:"|inches?|in\.)\s*(?:with|and)?\s*(?:a\s*)?(\d{2})\s*(?:ring|gauge)/i);
  const vitola = cleanSpecValue(shape.replace(/\([^)]*\)/g, "").replace(/\b\d+(?:\s+\d+\/\d+)?\s*(?:"|inches?|in\.)?\s*(?:x|by)\s*\d{2}.*$/i, ""));

  return {
    vitola: vitola || undefined,
    length: sizeMatch ? normalizeLength(sizeMatch[1]) : undefined,
    gauge: sizeMatch?.[2],
  };
}

function parseImportedProductDetails(productName: string, description: string): Partial<CatalogProductEnrichment> {
  const origin = extractLabeledValue(description, "Country of Origin") || extractLabeledValue(description, "Country");
  const wrapper = extractLabeledValue(description, "Wrapper");
  const filler = extractLabeledValue(description, "Filler");
  const binder = extractLabeledValue(description, "Binder");
  const shape = extractLabeledValue(description, "Shape");
  const profile = extractLabeledValue(description, "Profile") || extractLabeledValue(description, "Strength");
  const shapeDetails = parseShape(shape, productName);

  return {
    origin: origin || undefined,
    wrapper: wrapper || undefined,
    filler: filler || undefined,
    binder: binder || undefined,
    vitola: shapeDetails.vitola,
    length: shapeDetails.length,
    gauge: shapeDetails.gauge,
    strength: normalizeStrength(profile),
  };
}

function applyEnrichment(product: CatalogProduct, enrichment: Partial<CatalogProductEnrichment>): CatalogProduct {
  return {
    ...product,
    ...Object.fromEntries(Object.entries(enrichment).filter(([, value]) => value !== undefined && value !== "")),
  };
}

function getResearchedCatalogEnrichment(slug: string) {
  return researchedCatalogEnrichment[slug] ?? researchedCatalogEnrichment[slug.replace(/-\d+$/, "")] ?? {};
}

function researchedBlend(
  origin: string,
  wrapper: string,
  binder: string,
  filler: string,
  strength?: string
): Partial<CatalogProductEnrichment> {
  return { origin, wrapper, binder, filler, strength };
}

function researchedSize(vitola: string, length: string, gauge: string): Partial<CatalogProductEnrichment> {
  return { vitola, length, gauge };
}

function assortedResearchDetails(): Partial<CatalogProductEnrichment> {
  return {
    origin: "Varies by selection",
    vitola: "Assorted",
    length: "Assorted",
    gauge: "Assorted",
    strength: "Varies by selection",
    wrapper: "Varies by selection",
    binder: "Varies by selection",
    filler: "Varies by selection",
  };
}

function combineResearchDetails(...details: Array<Partial<CatalogProductEnrichment> | undefined>) {
  return Object.assign({}, ...details.filter(Boolean));
}

function researchedSizeFromMap(
  productName: string,
  sizes: Array<[pattern: RegExp, vitola: string, length: string, gauge: string]>
) {
  const match = sizes.find(([pattern]) => pattern.test(productName));

  return match ? researchedSize(match[1], match[2], match[3]) : undefined;
}

function standardCigarSizeFromName(productName: string) {
  return researchedSizeFromMap(productName, [
    [/PETIT PANTELA|PETITE PANATELA|PETIT PANATELA/, "Petite Panatela", '4"', "24"],
    [/BELICOSO/, "Belicoso", '6"', "52"],
    [/LONSDALE/, "Lonsdale", '6.5"', "42"],
    [/TORPEDO/, "Torpedo", '6.125"', "52"],
    [/GRAN ROBUSTO/, "Gran Robusto", '6"', "54"],
    [/GRAN TORO/, "Gran Toro", '6"', "54"],
    [/GIGANTE|SUPER GORDO|MAGNUM|IMPERIAL|\bGORDO\b/, "Gordo", '6"', "60"],
    [/CHURCHILL/, "Churchill", '7"', "50"],
    [/ROBUSTO/, "Robusto", '5"', "50"],
    [/TORO/, "Toro", '6"', "50"],
    [/CORONA/, "Corona", '5.5"', "44"],
  ]);
}

function getFactorySmokesResearch(productName: string) {
  if (!/^FACTORY SMOKES\b/.test(productName)) {
    return undefined;
  }

  const wrapper = /SHADE/.test(productName)
    ? "Ecuadorian Connecticut Shade"
    : /SUN\s*GROWN/.test(productName)
      ? "Habano Sun Grown"
      : /SWEET/.test(productName)
        ? "Habano"
        : "Maduro";
  const size = /CHURCHILL/.test(productName)
    ? researchedSize("Churchill", '7"', "50")
    : /GORDITO/.test(productName)
      ? researchedSize("Gordito", '6"', "60")
      : /ROBUSTO/.test(productName)
        ? researchedSize("Robusto", '5"', "54")
        : /BELICOSO/.test(productName)
          ? researchedSize("Belicoso", '6"', "54")
          : /TORO/.test(productName)
            ? researchedSize("Toro", '6"', "52")
            : undefined;

  return combineResearchDetails(
    researchedBlend("Nicaragua", wrapper, "Indonesia", "Indonesia", "Medium"),
    size
  );
}

function getDrewEstateJavaResearch(productName: string) {
  if (!/^DREW ESTATE JAVA\b/.test(productName)) {
    return undefined;
  }

  const wrapper = /LATTE/.test(productName) ? "Ecuadorian Connecticut Shade" : "Brazilian Maduro";
  const size = /CORONA/.test(productName)
    ? researchedSize("Corona", '5"', "42")
    : /ROBUSTO/.test(productName)
      ? researchedSize("Robusto", '5.5"', "50")
      : /THE\s+58/.test(productName)
        ? researchedSize("The 58", '5"', "58")
        : /TORO/.test(productName)
          ? researchedSize("Toro", '6"', "50")
          : undefined;

  return combineResearchDetails(
    researchedBlend("Nicaragua", wrapper, "Nicaragua", "Nicaragua", "Mild-Medium"),
    size
  );
}

function getAjFernandezResearch(productName: string) {
  if (!/^AJ FERNANDEZ\b/.test(productName)) {
    return undefined;
  }

  if (/NEW WORLD CAMEROON/.test(productName)) {
    return combineResearchDetails(
      researchedBlend("Nicaragua", "Cameroon", "Nicaragua", "Nicaragua", "Medium-Full"),
      researchedSize("Toro", '6"', "50")
    );
  }

  if (/NEW WORLD CONNECTICUT/.test(productName)) {
    return combineResearchDetails(
      researchedBlend("Nicaragua", "Connecticut Shade", "Mexican San Andres", "Nicaragua, Brazil", "Mild-Medium"),
      researchedSize("Toro", '6"', "52")
    );
  }

  if (/NEW WORLD DECENIO/.test(productName)) {
    const size = /GORDO/.test(productName)
      ? researchedSize("Gordo", '6"', "58")
      : researchedSize("Toro", '6.5"', "54");

    return combineResearchDetails(
      researchedBlend("Nicaragua", "Mexican San Andres", "Nicaragua", "Nicaragua, Honduras", "Medium-Full"),
      size
    );
  }

  if (/NEW WORLD/.test(productName)) {
    const size = /ROBUSTO/.test(productName)
      ? researchedSize("Robusto", '5.5"', "55")
      : researchedSize("Toro", '6.5"', "55");

    return combineResearchDetails(
      researchedBlend("Nicaragua", "Dark Nicaraguan", "Jalapa", "Ometepe, Condega, Esteli", "Medium-Full"),
      size
    );
  }

  if (/SAN LOTANO CONNECTICUT/.test(productName)) {
    return combineResearchDetails(
      researchedBlend("Nicaragua", "Ecuadorian Connecticut", "Honduras", "Nicaragua, Dominican Republic", "Medium"),
      researchedSize("Toro", '6"', "52")
    );
  }

  if (/SAN LOTANO HABANO/.test(productName)) {
    const size = /GRAN TORO/.test(productName)
      ? researchedSize("Gran Toro", '6"', "60")
      : researchedSize("Toro", '6"', "54");

    return combineResearchDetails(
      researchedBlend("Nicaragua", "Brazil Habano", "Nicaragua", "Nicaragua, Honduras", "Medium-Full"),
      size
    );
  }

  if (/BELLA ARTES MAD/.test(productName)) {
    return combineResearchDetails(
      researchedBlend("Nicaragua", "Brazil Mata Fina", "Mexican San Andres", "Nicaragua", "Medium-Full"),
      researchedSize("Toro", '6"', "54")
    );
  }

  return undefined;
}

function getArturoFuenteResearch(productName: string) {
  if (!/^ARTURO FUENTE\b/.test(productName)) {
    return undefined;
  }

  const base = researchedBlend("Dominican Republic", "Connecticut Shade", "Dominican Republic", "Dominican Republic", "Medium");

  if (/DON CARLOS/.test(productName)) {
    const size = /DBL|DOUBLE/.test(productName)
      ? researchedSize("Double Robusto", '5.75"', "52")
      : /NO\.?\s*2/.test(productName)
        ? researchedSize("No. 2", '5.875"', "44/55")
        : researchedSize("Robusto", '5"', "50");

    return combineResearchDetails(base, { wrapper: "African Cameroon" }, size);
  }

  if (/HEMINGWAY|MASTERPIECE/.test(productName)) {
    const size = /BEST SELLER/.test(productName)
      ? researchedSize("Best Seller", '4.5"', "43/55")
      : /CLASSIC/.test(productName)
        ? researchedSize("Classic", '7"', "46")
        : /MASTERPIECE/.test(productName)
          ? researchedSize("Masterpiece", '9"', "52")
          : /SHORT STORY/.test(productName)
            ? researchedSize("Short Story", '4"', "42/49")
            : /SIGNATURE/.test(productName)
              ? researchedSize("Signature", '6"', "46")
              : researchedSize("Work of Art", '4.875"', "46/60");
    const wrapper = /MADURO/.test(productName) ? "Connecticut Broadleaf Maduro" : "African Cameroon";

    return combineResearchDetails(base, { wrapper }, size);
  }

  if (/CHATEAU|KING B|KING T|QUEEN B|ROYAL SALUTE/.test(productName)) {
    const size = /ROYAL SALUTE/.test(productName)
      ? researchedSize("Royal Salute", '7.625"', "54")
      : /DOUBLE CHATEAU|DBL CHATEAU/.test(productName)
        ? researchedSize("Double Chateau", '6.75"', "50")
        : /KING B/.test(productName)
          ? researchedSize("King B", '6"', "55")
          : /QUEEN B/.test(productName)
            ? researchedSize("Queen B", '5.5"', "52")
            : /KING T/.test(productName)
              ? researchedSize("King T", '7"', "49")
              : /BELICOSO/.test(productName)
                ? researchedSize("Belicoso", '5.75"', "51")
                : /PYRAMID/.test(productName)
                  ? researchedSize("Pyramid", '6"', "52")
                  : researchedSize("Chateau Fuente", '4.5"', "50");
    const wrapper = /SUN\s*GROWN|SUNGROWN|\bSG\b|KING B|QUEEN B/.test(productName)
      ? "Ecuadorian Sun Grown"
      : /MADURO/.test(productName)
        ? "Connecticut Broadleaf Maduro"
        : "Connecticut Shade";

    return combineResearchDetails(base, { wrapper }, size);
  }

  const granReservaSize = /CANONES|CAÑONES/.test(productName)
    ? researchedSize("Canones", '8.5"', "52")
    : /CAZADORES/.test(productName)
      ? researchedSize("Cazadores", '6"', "50")
      : /CHURCHILL/.test(productName)
        ? researchedSize("Churchill", '7.25"', "48")
        : /CORONA IMPERIAL/.test(productName)
          ? researchedSize("Corona Imperial", '6.5"', "46")
          : /CUBAN CORONA/.test(productName)
            ? researchedSize("Corona", '5.25"', "45")
            : /FLOR FINA|8-5-8/.test(productName)
              ? researchedSize("Flor Fina 8-5-8", '6"', "47")
              : /PETIT CORONA/.test(productName)
                ? researchedSize("Petit Corona", '5"', "38")
                : /ROTH/.test(productName)
                  ? researchedSize("Rothschild", '4.5"', "50")
                  : /SPANISH LONSDALE/.test(productName)
                    ? researchedSize("Spanish Lonsdale", '6.5"', "42")
                    : undefined;

  if (granReservaSize) {
    const wrapper = /MADURO/.test(productName)
      ? "Connecticut Broadleaf Maduro"
      : /SUN\s*GROWN|SUNGROWN/.test(productName)
        ? "Ecuadorian Sun Grown"
        : /CAMEROON/.test(productName)
          ? "African Cameroon"
          : "Connecticut Shade";

    return combineResearchDetails(base, { wrapper }, granReservaSize);
  }

  return undefined;
}

function getAshtonResearch(productName: string) {
  if (!/^ASHTON\b/.test(productName)) {
    return undefined;
  }

  if (/VSG/.test(productName)) {
    const size = /ECLIPSE/.test(productName)
      ? researchedSize("Eclipse Tubo", '6"', "52")
      : /ILLUSION/.test(productName)
        ? researchedSize("Illusion", '6.5"', "44")
        : /SPELLBOUND/.test(productName)
          ? researchedSize("Spellbound", '7.5"', "54")
          : researchedSize("Torpedo", '6.5"', "55");

    return combineResearchDetails(
      researchedBlend("Dominican Republic", "Ecuadorian Sumatra", "Dominican Republic", "Dominican Republic", "Full"),
      size
    );
  }

  if (/AGED.*MADURO/.test(productName)) {
    return combineResearchDetails(
      researchedBlend("Dominican Republic", "Connecticut Broadleaf", "Dominican Republic", "Dominican Republic", "Mild-Medium"),
      researchedSize("No. 60", '7.5"', "52")
    );
  }

  if (/ESQUIRE MADURO/.test(productName)) {
    return combineResearchDetails(
      researchedBlend("Dominican Republic", "Connecticut Broadleaf", "Dominican Republic", "Dominican Republic", "Mild-Medium"),
      researchedSize("Esquire", '4.25"', "32")
    );
  }

  if (/CABINET PYRAMIDS/.test(productName)) {
    return combineResearchDetails(
      researchedBlend("Dominican Republic", "Connecticut Shade", "Dominican Republic", "Dominican Republic", "Mild-Medium"),
      researchedSize("Pyramid", '6"', "52")
    );
  }

  const classicSize = /\b898\b/.test(productName)
    ? researchedSize("8-9-8", '6.5"', "44")
    : /CHURCHILL/.test(productName)
      ? researchedSize("Churchill", '7.5"', "52")
      : /DOUBLE MAGNUM/.test(productName)
        ? researchedSize("Double Magnum", '6"', "50")
        : /HALF CORONA/.test(productName)
          ? researchedSize("Half Corona", '4.125"', "37")
          : /MAGNUM/.test(productName)
            ? researchedSize("Magnum", '5"', "50")
            : /MONARCH/.test(productName)
              ? researchedSize("Monarch", '6"', "50")
              : /SENORITAS/.test(productName)
                ? researchedSize("Senoritas", '3.5"', "30")
                : undefined;

  if (!classicSize) {
    return undefined;
  }

  const wrapper = /SENORITAS WHITE|SENORITAS(?!.*BLUE)/.test(productName) ? "Cameroon" : "Connecticut Shade";

  return combineResearchDetails(
    researchedBlend("Dominican Republic", wrapper, "Dominican Republic", "Dominican Republic", "Mild"),
    classicSize
  );
}

function getPerdomoResearch(productName: string) {
  if (!/^PERDOMO\b/.test(productName)) {
    return undefined;
  }

  if (/4 PACK|SAMPLER/.test(productName)) {
    return assortedResearchDetails();
  }

  if (/10TH ANN.*CHAMPAGNE/.test(productName)) {
    const size = /CHURCHILL/.test(productName)
      ? researchedSize("Churchill", '7"', "54")
      : /EPICURE/.test(productName)
        ? researchedSize("Epicure", '6"', "54")
        : /FIGURADO/.test(productName)
          ? researchedSize("Figurado", '4.75"', "56")
          : /MAGNUM/.test(productName)
            ? researchedSize("Magnum Tubo", '6"', "50")
            : /SUPER TORO/.test(productName)
              ? researchedSize("Super Toro", '6"', "60")
              : /TORPEDO/.test(productName)
                ? researchedSize("Torpedo", '7"', "54")
                : researchedSize("Robusto", '5"', "54");

    return combineResearchDetails(
      researchedBlend("Nicaragua", "Ecuadorian Connecticut", "Cuban-seed Nicaraguan", "Cuban-seed Nicaraguan", "Mild-Medium"),
      size
    );
  }

  if (/20TH ANN/.test(productName)) {
    const wrapper = /CONN/.test(productName) ? "Ecuadorian Connecticut" : /MADURO/.test(productName) ? "Nicaraguan Maduro" : "Nicaraguan Sun Grown";
    const strength = /CONN/.test(productName) ? "Mild-Medium" : "Medium-Full";
    const size = /GORDO/.test(productName)
      ? researchedSize("Gordo", '6"', "60")
      : /EPICURE/.test(productName)
        ? researchedSize("Epicure", '6"', "56")
        : researchedSize("Robusto", '5"', "56");

    return combineResearchDetails(
      researchedBlend("Nicaragua", wrapper, "Cuban-seed Nicaraguan", "Cuban-seed Nicaraguan", strength),
      size
    );
  }

  if (/HABANO/.test(productName)) {
    const wrapper = /CONN/.test(productName) ? "Ecuadorian Connecticut" : /MADURO/.test(productName) ? "Nicaraguan Maduro" : "Nicaraguan Sun Grown";
    const strength = /CONN/.test(productName) ? "Mild-Medium" : "Medium-Full";
    const size = /CHURCHILL/.test(productName)
      ? researchedSize("Churchill", '7"', "54")
      : /EPICURE/.test(productName)
        ? researchedSize("Epicure", '6"', "54")
        : /GORDO/.test(productName)
          ? researchedSize("Gordo", '6"', "60")
          : /TORPEDO/.test(productName)
            ? researchedSize("Torpedo", '6.5"', "54")
            : researchedSize("Robusto", '5"', "54");

    return combineResearchDetails(
      researchedBlend("Nicaragua", wrapper, "Cuban-seed Nicaraguan", "Cuban-seed Nicaraguan", strength),
      size
    );
  }

  if (/INMENSO/.test(productName)) {
    return researchedBlend(
      "Nicaragua",
      /MADURO/.test(productName) ? "Nicaraguan Maduro" : "Nicaraguan Sun Grown",
      "Cuban-seed Nicaraguan",
      "Cuban-seed Nicaraguan",
      "Medium-Full"
    );
  }

  if (/LOT 23/.test(productName)) {
    const wrapper = /MADURO/.test(productName) ? "Nicaraguan Maduro" : "Nicaraguan Sun Grown";
    const size = /CHURCHILL/.test(productName)
      ? researchedSize("Churchill", '7"', "50")
      : /ROBUSTO/.test(productName)
        ? researchedSize("Robusto", '5"', "50")
        : researchedSize("Toro", '6"', "50");

    return combineResearchDetails(
      researchedBlend("Nicaragua", wrapper, "Cuban-seed Nicaraguan", "Cuban-seed Nicaraguan", /MADURO/.test(productName) ? "Medium-Full" : "Medium"),
      size
    );
  }

  if (/RESERVE MADURO/.test(productName)) {
    const size = /CHURCHILL/.test(productName)
      ? researchedSize("Churchill", '7"', "54")
      : /EPICURE/.test(productName)
        ? researchedSize("Epicure", '6"', "54")
        : /SUPER TORO/.test(productName)
          ? researchedSize("Super Toro", '6"', "60")
          : researchedSize("Robusto", '5"', "54");

    return combineResearchDetails(
      researchedBlend("Nicaragua", "Nicaraguan Maduro", "Cuban-seed Nicaraguan", "Cuban-seed Nicaraguan", "Medium-Full"),
      size
    );
  }

  return undefined;
}

function getOlivaResearch(productName: string) {
  if (!/^OLIVA\b/.test(productName)) {
    return undefined;
  }

  if (/SAMPLER/.test(productName)) {
    return assortedResearchDetails();
  }

  if (/CONNECTICUT RESERVE/.test(productName)) {
    const size = /CHURCHILL/.test(productName)
      ? researchedSize("Churchill", '7"', "50")
      : /DOUBLE TORO/.test(productName)
        ? researchedSize("Double Toro", '6"', "60")
        : /LONSDALE/.test(productName)
          ? researchedSize("Lonsdale", '6.25"', "44")
          : /ROBUSTO/.test(productName)
            ? researchedSize("Robusto", '5"', "50")
            : researchedSize("Toro", '6"', "50");

    return combineResearchDetails(
      researchedBlend("Nicaragua", "Ecuadorian Connecticut", "Nicaragua", "Nicaragua", "Mild-Medium"),
      size
    );
  }

  if (/SERIE G/.test(productName) || /\bOLIVA G\b/.test(productName)) {
    const size = /SPECIAL G/.test(productName)
      ? researchedSize("Special G", '3.75"', "48")
      : /CHURCHILL/.test(productName)
        ? researchedSize("Churchill", '7"', "50")
        : /CIGARILLOS/.test(productName)
          ? researchedSize("Cigarillo", '4"', "38")
          : /DOUBLE ROBUSTO/.test(productName)
            ? researchedSize("Double Robusto", '5"', "54")
            : /FIG/.test(productName)
              ? researchedSize("Figurado", '6.5"', "60")
              : /ROBUSTO/.test(productName)
                ? researchedSize("Robusto", '4.5"', "50")
                : /TORPEDO/.test(productName)
                  ? researchedSize("Torpedo", '6.5"', "52")
                  : researchedSize("Toro", '6"', "50");
    const wrapper = /MADURO/.test(productName) ? "Connecticut Broadleaf Maduro" : "African Cameroon";

    return combineResearchDetails(
      researchedBlend("Nicaragua", wrapper, "Nicaraguan Habano", "Nicaraguan Habano", "Medium"),
      size
    );
  }

  if (/SERIE O/.test(productName)) {
    const size = /CHURCHILL/.test(productName)
      ? researchedSize("Churchill", '7"', "50")
      : /DOUBLE TORO/.test(productName)
        ? researchedSize("Double Toro", '6"', "60")
        : /ROBUSTO/.test(productName)
          ? researchedSize("Robusto", '5"', "50")
          : /TORPEDO/.test(productName)
            ? researchedSize("Torpedo", '6.5"', "52")
            : researchedSize("Toro", '6"', "50");
    const wrapper = /MADURO/.test(productName) ? "Nicaraguan Maduro" : "Ecuadorian Habano";

    return combineResearchDetails(
      researchedBlend("Nicaragua", wrapper, "Nicaragua", "Nicaragua", "Medium"),
      size
    );
  }

  if (/MELANIO/.test(productName)) {
    const size = /CHURCHILL/.test(productName)
      ? researchedSize("Churchill", '7"', "50")
      : /DOUBLE TORO|DBL TORO/.test(productName)
        ? researchedSize("Double Toro", '6"', "60")
        : /FIGURADO/.test(productName)
          ? researchedSize("Figurado", '6.5"', "54")
          : /ROBUSTO/.test(productName)
            ? researchedSize("Robusto", '5"', "52")
            : /TORPEDO/.test(productName)
              ? researchedSize("Torpedo", '6.5"', "52")
              : researchedSize("Toro", '6"', "52");
    const wrapper = /MADURO/.test(productName) ? "Mexican San Andres Maduro" : "Ecuadorian Sumatra";

    return combineResearchDetails(
      researchedBlend("Nicaragua", wrapper, "Nicaragua", "Nicaragua", "Medium-Full"),
      size
    );
  }

  if (/SERIE V/.test(productName)) {
    const size = /BELICOSO/.test(productName)
      ? researchedSize("Belicoso", '5"', "54")
      : /CHURCHILL/.test(productName)
        ? researchedSize("Churchill Extra", '7"', "52")
        : /DOUBLE ROBUSTO|DBL ROBUSTO/.test(productName)
          ? researchedSize("Double Robusto", '5"', "54")
          : /DOUBLE TORO|DBL TORO/.test(productName)
            ? researchedSize("Double Toro", '6"', "60")
            : /SPECIAL FIGURADO/.test(productName)
              ? researchedSize("Special Figurado", '6"', "60")
              : /TORPEDO/.test(productName)
                ? researchedSize("Torpedo", '6"', "56")
                : researchedSize("Toro", '6"', "50");
    const wrapper = /MADURO/.test(productName) ? "Mexican San Andres Maduro" : "Ecuadorian Habano Sun Grown";

    return combineResearchDetails(
      researchedBlend("Nicaragua", wrapper, "Nicaragua", "Nicaragua", "Medium-Full"),
      size
    );
  }

  return undefined;
}

function getMacanudoResearch(productName: string) {
  if (!/^MACANUDO\b/.test(productName)) {
    return undefined;
  }

  if (/SAMPLER/.test(productName)) {
    return assortedResearchDetails();
  }

  if (/GOLD/.test(productName)) {
    const size = /ASCOT/.test(productName)
      ? researchedSize("Ascot", '4.25"', "32")
      : researchedSize("Crystal", '5.5"', "50");

    return combineResearchDetails(
      researchedBlend("Dominican Republic", "Connecticut Shade", "Mexican San Andres", "Dominican Republic, Mexico", "Mild"),
      size
    );
  }

  if (/CAFE|ASCOT|CRYSTAL CAFE|ROTHSCHILD/.test(productName) && !/INSPIRADO/.test(productName)) {
    const size = /ASCOT/.test(productName)
      ? researchedSize("Ascot", '4.25"', "32")
      : /BARON|ROTHSCHILD/.test(productName)
        ? researchedSize("Baron de Rothschild", '6.5"', "42")
        : /COURT TUBO/.test(productName)
          ? researchedSize("Court Tubo", '4.187"', "36")
          : /DUKE OF WINDSOR/.test(productName)
            ? researchedSize("Duke of Windsor", '6"', "50")
            : /HAMPTON COURT/.test(productName)
              ? researchedSize("Hampton Court", '5.5"', "42")
              : /HYDE PARK/.test(productName)
                ? researchedSize("Hyde Park", '5.5"', "49")
                : /PETITE CORONA/.test(productName)
                  ? researchedSize("Petite Corona", '5"', "38")
                  : /PORTIFINO|PORTOFINO/.test(productName)
                    ? researchedSize("Portofino", '7"', "34")
                    : /PRINCE OF WHA/.test(productName)
                      ? researchedSize("Prince of Wales", '8"', "52")
                      : /THAMES/.test(productName)
                        ? researchedSize("Thames Court", '6"', "54")
                        : /TUDOR/.test(productName)
                          ? researchedSize("Tudor", '6"', "52")
                          : researchedSize("Crystal", '5.5"', "50");

    return combineResearchDetails(
      researchedBlend("Dominican Republic", "Connecticut Shade", "Mexican San Andres", "Dominican Republic, Mexico", "Mild"),
      size
    );
  }

  if (/INSPIRADO WHITE/.test(productName)) {
    const size = /CHURCHILL/.test(productName)
      ? researchedSize("Churchill", '7"', "49")
      : /ROBUSTO|TUBO/.test(productName)
        ? researchedSize("Robusto", '5"', "50")
        : /TORO/.test(productName)
          ? researchedSize("Toro", '6.5"', "50")
          : /CIGARILLOS/.test(productName)
            ? researchedSize("Cigarillo", '4"', "32")
            : undefined;

    return combineResearchDetails(
      researchedBlend("Dominican Republic", "Ecuadorian Connecticut", "Indonesia", "Nicaragua, Mexico", "Mild-Medium"),
      size
    );
  }

  if (/INSPIRADO BLACK/.test(productName)) {
    const size = /CHURCHILL/.test(productName)
      ? researchedSize("Churchill", '7"', "48")
      : /ROBUSTO|TUBO/.test(productName)
        ? researchedSize("Robusto", '4.875"', "48")
        : researchedSize("Toro", '5.5"', "54");

    return combineResearchDetails(
      researchedBlend("Dominican Republic", "Connecticut Broadleaf", "Ecuadorian Sumatra", "Nicaragua", "Full"),
      size
    );
  }

  if (/INSPIRADO ORANGE/.test(productName)) {
    const size = /CHURCHILL/.test(productName)
      ? researchedSize("Churchill", '7"', "49")
      : /GIGANTE/.test(productName)
        ? researchedSize("Gigante", '6"', "60")
        : /ROBUSTO/.test(productName)
          ? researchedSize("Robusto", '5"', "50")
          : /TORO/.test(productName)
            ? researchedSize("Toro", '6"', "50")
            : undefined;

    return combineResearchDetails(
      researchedBlend("Honduras", "Honduran", "Honduran", "Dominican Republic, Honduras, Nicaragua", "Medium"),
      size
    );
  }

  if (/INSPIRADO RED/.test(productName)) {
    const size = /GIGANTE/.test(productName)
      ? researchedSize("Gigante", '6"', "60")
      : /ROBUSTO/.test(productName)
        ? researchedSize("Robusto", '5"', "50")
        : /TORO/.test(productName)
          ? researchedSize("Toro", '6"', "50")
          : undefined;

    return combineResearchDetails(
      researchedBlend("Nicaragua", "Ecuadorian Habano", "Nicaraguan Jalapa", "Honduran Jamastran, Nicaraguan Esteli, Nicaraguan Ometepe", "Medium-Full"),
      size
    );
  }

  return undefined;
}

function getMontecristoResearch(productName: string) {
  if (!/^MONTECRISTO\b/.test(productName)) {
    return undefined;
  }

  if (/SAMPLER|FRESHLOC/.test(productName)) {
    return assortedResearchDetails();
  }

  if (/1935 ANNIVERSARY/.test(productName)) {
    const size = /NO\.?\s*2/.test(productName)
      ? researchedSize("No. 2", '6.125"', "52")
      : researchedSize("Toro", '6"', "54");

    return combineResearchDetails(
      researchedBlend("Nicaragua", "Nicaragua", "Nicaragua", "Nicaragua", "Medium-Full"),
      size
    );
  }

  if (/ESPADA/.test(productName)) {
    const size = /GUARD/.test(productName)
      ? researchedSize("Guard", '6"', "50")
      : researchedSize("Ricasso", '5"', "54");

    return combineResearchDetails(
      researchedBlend("Nicaragua", "Nicaraguan Habano Jalapa", "Nicaraguan Habano Jalapa", "Nicaraguan Habano", "Medium-Full"),
      size
    );
  }

  if (/NICARAGUA SERIES/.test(productName)) {
    return combineResearchDetails(
      researchedBlend("Nicaragua", "Nicaragua", "Nicaragua", "Nicaragua", "Full"),
      researchedSize("Toro", '6"', "54")
    );
  }

  if (/PLATINUM/.test(productName)) {
    const size = /CHURCHILL/.test(productName)
      ? researchedSize("Churchill", '7"', "50")
      : researchedSize("Rothchilde", '5"', "50");

    return combineResearchDetails(
      researchedBlend("Dominican Republic", "San Andres", "Dominican Republic", "Dominican Republic, Nicaragua, Peru", "Medium-Full"),
      size
    );
  }

  if (/WHITE/.test(productName)) {
    const size = /CHURCHILL/.test(productName)
      ? researchedSize("Churchill", '7"', "54")
      : /COURT/.test(productName)
        ? researchedSize("Montecristo Court", '5.5"', "44")
        : /NO\.?\s*2|TORPEDO/.test(productName)
          ? researchedSize("No. 2 Torpedo", '6.125"', "52")
          : /PRONTOS/.test(productName)
            ? researchedSize("Prontos", '4"', "33")
            : researchedSize("Toro", '6"', "54");

    return combineResearchDetails(
      researchedBlend("Dominican Republic", "Ecuadorian Connecticut Shade", "Nicaragua", "Dominican Republic, Nicaragua", "Mild-Medium"),
      size
    );
  }

  if (/CLASSIC/.test(productName)) {
    const size = /EL CONDE/.test(productName)
      ? researchedSize("El Conde", '6"', "52")
      : /ESPECIAL NO\.?3|NO\.?3/.test(productName)
        ? researchedSize("Especial No. 3", '5.5"', "44")
        : /NO\.?2/.test(productName)
          ? researchedSize("No. 2 Torpedo", '6.125"', "52")
          : /TUBO ESPECIAL/.test(productName)
            ? researchedSize("Tubo Especial", '6"', "50")
            : researchedSize("Churchill", '7"', "54");

    return combineResearchDetails(
      researchedBlend("Dominican Republic", "Connecticut Shade", "Dominican Republic", "Dominican Republic", "Mild"),
      size
    );
  }

  return undefined;
}

function getRockyPatelResearch(productName: string) {
  if (!/^ROCKY PATEL\b/.test(productName)) {
    return undefined;
  }

  if (/SAMPLER|SAMPLE PACK|FRESH PACK/.test(productName)) {
    return assortedResearchDetails();
  }

  if (/1990|VINTAGE 1990/.test(productName)) {
    return combineResearchDetails(
      researchedBlend("Honduras", "Honduran Broadleaf", "Nicaragua", "Dominican Republic, Nicaragua", "Mild-Medium"),
      researchedSizeFromMap(productName, [
        [/JUNIORS/, "Junior", '4"', "38"],
        [/PETITE CORONA/, "Petite Corona", '4.5"', "44"],
        [/CHURCHILL/, "Churchill", '7"', "48"],
        [/DELUXE TORO|TORO TUBO/, "Toro Tubo", '6"', "50"],
        [/ROBUSTO/, "Robusto", '5.5"', "50"],
        [/SIXTY/, "Sixty", '6"', "60"],
        [/TORPEDO/, "Torpedo", '6.25"', "52"],
        [/TORO/, "Toro", '6.5"', "52"],
      ])
    );
  }

  if (/1992/.test(productName)) {
    return combineResearchDetails(
      researchedBlend("Honduras", "Ecuadorian Sumatra", "Nicaragua", "Dominican Republic, Nicaragua", "Medium"),
      researchedSizeFromMap(productName, [
        [/JUNIORS/, "Junior", '4"', "38"],
        [/PETITE CORONA/, "Petite Corona", '4.5"', "44"],
        [/CHURCHILL/, "Churchill", '7"', "48"],
        [/DELUXE TORO|TORO TUBO/, "Toro Tubo", '6"', "50"],
        [/ROBUSTO/, "Robusto", '5.5"', "50"],
        [/SIXTY/, "Sixty", '6"', "60"],
        [/TORPEDO/, "Torpedo", '6.25"', "52"],
        [/TORO/, "Toro", '6.5"', "52"],
      ])
    );
  }

  if (/1999/.test(productName)) {
    return combineResearchDetails(
      researchedBlend("Honduras", "Connecticut Shade", "Nicaragua", "Dominican Republic, Nicaragua", "Mild-Medium"),
      researchedSizeFromMap(productName, [
        [/JUNIORS|10\/10 TINS/, "Junior", '4"', "38"],
        [/CHURCHILL/, "Churchill", '7"', "48"],
        [/DELUXE TORO|TORO TUBO/, "Toro Tubo", '6"', "50"],
        [/ROBUSTO/, "Robusto", '5.5"', "50"],
        [/SIXTY/, "Sixty", '6"', "60"],
        [/TORPEDO/, "Torpedo", '6.25"', "52"],
        [/TORO/, "Toro", '6.5"', "52"],
      ])
    );
  }

  if (/DECADE/.test(productName)) {
    return combineResearchDetails(
      researchedBlend("Honduras", "Ecuadorian Sumatra", "Mexico", "Honduras, Panama", "Medium-Full"),
      researchedSizeFromMap(productName, [
        [/ROBUSTO/, "Robusto", '5"', "50"],
        [/TORO|DELUXE TUBO/, "Toro", '6.5"', "52"],
      ])
    );
  }

  if (/THE EDGE|EDGE/.test(productName)) {
    const wrapper = /MADURO/.test(productName)
      ? "Costa Rican Maduro"
      : /HABANO/.test(productName)
        ? "Nicaraguan Habano"
        : "Honduran Corojo";
    const binder = /HABANO/.test(productName) ? "Nicaragua" : "Nicaragua";
    const filler = /HABANO/.test(productName) ? "Nicaragua" : "Honduras, Nicaragua";

    return combineResearchDetails(
      researchedBlend("Honduras", wrapper, binder, filler, "Medium-Full"),
      researchedSizeFromMap(productName, [
        [/A-10|TORO|TORPEDO/, /TORPEDO/.test(productName) ? "Torpedo" : "Toro", '6"', "52"],
        [/BAT|BATTALION|GORDO/, "Battalion", '6"', "60"],
        [/ROBUSTO/, "Robusto", '5.5"', "50"],
      ])
    );
  }

  if (/SIXTY/.test(productName)) {
    return combineResearchDetails(
      researchedBlend("Nicaragua", "Mexican San Andres Maduro", "Nicaragua", "Nicaragua", "Medium-Full"),
      researchedSizeFromMap(productName, [
        [/ROBUSTO/, "Robusto", '5.5"', "50"],
        [/SIXTY/, "Sixty", '6"', "60"],
        [/TORO/, "Toro", '6.5"', "52"],
      ])
    );
  }

  if (/SUN GROWN MADURO/.test(productName)) {
    return combineResearchDetails(
      researchedBlend("Nicaragua", "Connecticut Broadleaf Maduro", "Nicaragua", "Nicaragua", "Medium-Full"),
      researchedSizeFromMap(productName, [
        [/ROBUSTO/, "Robusto", '5"', "50"],
        [/SIXTY/, "Sixty", '6"', "60"],
        [/TORO/, "Toro", '6.5"', "52"],
      ])
    );
  }

  if (/SUN GROWN/.test(productName)) {
    return combineResearchDetails(
      researchedBlend("Honduras", "Ecuadorian Sun Grown", "Nicaragua", "Dominican Republic, Nicaragua", "Medium-Full"),
      researchedSizeFromMap(productName, [
        [/DELUXE TUBO|TORO/, "Toro", '6"', "52"],
      ])
    );
  }

  if (/LB1/.test(productName)) {
    return combineResearchDetails(
      researchedBlend("Honduras", "Ecuadorian Habano", "Honduras", "Honduras, Nicaragua", "Medium"),
      researchedSizeFromMap(productName, [
        [/ROBUSTO/, "Robusto", '5"', "50"],
        [/TORO/, "Toro", '6.5"', "52"],
      ])
    );
  }

  if (/NO\.?\s*6/.test(productName)) {
    return combineResearchDetails(
      researchedBlend("Honduras", "Honduran Corojo", "Honduras", "Honduras, Nicaragua", "Medium"),
      researchedSizeFromMap(productName, [
        [/ROBUSTO/, "Robusto", '5.5"', "50"],
        [/TORO/, "Toro", '6.5"', "52"],
      ])
    );
  }

  return undefined;
}

function getRomeoResearch(productName: string) {
  if (!/^ROMEO\b|^RYJ\b/.test(productName)) {
    return undefined;
  }

  if (/SAMPLER|FRESH PACK/.test(productName)) {
    return assortedResearchDetails();
  }

  if (/SPAIN MINI/.test(productName)) {
    return combineResearchDetails(
      researchedBlend("Spain", "Natural tobacco leaf", "Cuban-seed tobacco", "Cuban-seed tobacco", "Mild"),
      researchedSize("Mini", '3.25"', "20")
    );
  }

  if (/RESERVA REAL.*TWISTED/.test(productName)) {
    return combineResearchDetails(
      researchedBlend("Dominican Republic", "Ecuadorian Connecticut and Connecticut Broadleaf Maduro", "Nicaragua", "Dominican Republic, Nicaragua", "Mild-Medium"),
      researchedSize("Twisted Toro", '6"', "54")
    );
  }

  if (/RESERVA REAL/.test(productName)) {
    return combineResearchDetails(
      researchedBlend("Dominican Republic", "Ecuadorian Connecticut Shade", "Nicaragua", "Dominican Republic, Nicaragua", "Mild-Medium"),
      researchedSizeFromMap(productName, [
        [/BOY|GIRL|5\/6 TINS/, "Petite", '4"', "32"],
        [/CHURCHILL/, "Churchill", '7"', "50"],
        [/ROBUSTO/, "Robusto", '5"', "52"],
        [/TORO|GRAN TORO/, "Toro", '6"', "54"],
      ])
    );
  }

  if (/CONN\.?NICARAGUA|CONNECTICUT NICARAGUA/.test(productName)) {
    return combineResearchDetails(
      researchedBlend("Nicaragua", "Ecuadorian Connecticut", "Nicaragua", "Nicaragua", "Medium"),
      researchedSizeFromMap(productName, [
        [/BULLY/, "Bully", '5"', "50"],
        [/TORO/, "Toro", '6"', "52"],
      ])
    );
  }

  if (/1875 NICARAGUA/.test(productName)) {
    return combineResearchDetails(
      researchedBlend("Nicaragua", "Nicaragua", "Nicaragua", "Nicaragua", "Medium-Full"),
      researchedSizeFromMap(productName, [
        [/ROBUSTO|BX\/10/, "Robusto", '5"', "50"],
      ])
    );
  }

  if (/1875/.test(productName)) {
    return combineResearchDetails(
      researchedBlend("Dominican Republic", "Indonesian TBN", "Dominican Republic", "Dominican Republic", "Medium"),
      researchedSizeFromMap(productName, [
        [/BULLY/, "Bully", '5"', "50"],
        [/CEDRO DE LUXE #?1|DE LUXE #?1/, "Cedro Deluxe No. 1", '6.5"', "44"],
        [/CEDRO DEL LUXE #?2|DELUXE #?2|NUMERO DOS/, "Cedro Deluxe No. 2", '5.5"', "44"],
        [/CHURCHILL/, "Churchill", '7"', "50"],
        [/CLEMENCEAU/, "Clemenceau", '6.25"', "50"],
        [/EXHIBICION #?1/, "Exhibicion No. 1", '6.25"', "50"],
        [/EXHIBICION #?3/, "Exhibicion No. 3", '5"', "50"],
        [/MAGNUM/, "Magnum", '6"', "60"],
        [/NO\.?2|BELICOSO/, "No. 2 Belicoso", '6.125"', "52"],
        [/ROMEO COURT/, "Romeo Court", '5.5"', "44"],
        [/ROMEOS/, "Romeos", '4"', "33"],
        [/ROTHSCHILDE/, "Rothchilde", '5"', "50"],
      ])
    );
  }

  if (/RESERVE/.test(productName)) {
    return combineResearchDetails(
      researchedBlend("Honduras", "Ecuadorian Sumatra", "Nicaragua", "Dominican Republic, Nicaragua", "Medium-Full"),
      researchedSizeFromMap(productName, [
        [/CHURCHILL/, "Churchill", '7"', "50"],
        [/ROBUSTO|ROTHSCHILDE/, "Robusto", '5"', "50"],
        [/TORO/, "Toro", '6"', "50"],
      ])
    );
  }

  if (/ROMEO BY RYJ|ROMEO BY ROMEO/.test(productName)) {
    return combineResearchDetails(
      researchedBlend("Dominican Republic", "Ecuadorian Habano", "Dominican Republic", "Dominican Republic, Nicaragua", "Medium-Full"),
      researchedSizeFromMap(productName, [
        [/CHURCHILL/, "Churchill", '7"', "50"],
        [/ROBUSTO/, "Robusto", '5"', "52"],
        [/TORO/, "Toro", '6"', "54"],
      ])
    );
  }

  if (/150TH/.test(productName)) {
    return combineResearchDetails(
      researchedBlend("Dominican Republic", "Ecuadorian Habano", "Dominican Republic", "Dominican Republic, Nicaragua", "Medium"),
      researchedSize("Toro", '6"', "54")
    );
  }

  return undefined;
}

function getTatianaResearch(productName: string) {
  if (!/^TATIANA\b/.test(productName)) {
    return undefined;
  }

  if (/SAMPLER/.test(productName)) {
    return assortedResearchDetails();
  }

  const size = /MINI|TINS/.test(productName)
    ? researchedSize("Mini", '3.5"', "26")
    : /LA VITA/.test(productName)
      ? researchedSize("La Vita", '5"', "38")
      : /ROBUSTO|DELIGHTS/.test(productName)
        ? researchedSize("Robusto", '5"', "50")
        : researchedSize("Classic", '6"', "44");

  return combineResearchDetails(
    researchedBlend("Dominican Republic", "Indonesia", "Dominican Republic", "Dominican Republic", "Mild"),
    size
  );
}

function getQuorumResearch(productName: string) {
  if (!/^QUORUM\b/.test(productName)) {
    return undefined;
  }

  if (/SAMPLER/.test(productName)) {
    return assortedResearchDetails();
  }

  const wrapper = /SHADE/.test(productName)
    ? "Ecuadorian Connecticut Shade"
    : /MADURO/.test(productName)
      ? "Sumatra Sun Grown Maduro"
      : "Sumatra Sun Grown";
  const binder = /SHADE/.test(productName)
    ? "Sumatra Sun Grown"
    : /MADURO/.test(productName)
      ? "Connecticut Broadleaf"
      : "Nicaragua";

  return combineResearchDetails(
    researchedBlend("Nicaragua", wrapper, binder, "Nicaragua", "Medium"),
    researchedSizeFromMap(productName, [
      [/CHURCHILL/, "Churchill", '7"', "48"],
      [/DBL GORDO|DOUBLE GORDO/, "Double Gordo", '6"', "60"],
      [/SHORT ROBUSTO/, "Short Robusto", '3.5"', "50"],
      [/ROBUSTO/, "Robusto", '4.75"', "50"],
      [/TORPEDO/, "Torpedo", '6"', "50"],
      [/CORONA/, "Corona", '5.5"', "43"],
      [/TORO/, "Toro", '6"', "50"],
    ])
  );
}

function getCohibaResearch(productName: string) {
  if (!/^COHIBA\b/.test(productName)) {
    return undefined;
  }

  if (/RIVIERA/.test(productName)) {
    return combineResearchDetails(
      researchedBlend("Honduras", "San Andres", "Honduran Connecticut", "Honduran Jamastran, Honduran La Entrada, Nicaraguan Condega, Nicaraguan Esteli", "Medium"),
      researchedSize("Box Press Toro", '6.5"', "52")
    );
  }

  if (/BLUE/.test(productName)) {
    return combineResearchDetails(
      researchedBlend("Honduras", "Honduran Olancho San Agustin", "Honduras", "Honduras, Nicaragua", "Medium"),
      researchedSizeFromMap(productName, [
        [/7 X 70/, "Gigante", '7"', "70"],
        [/CHURCHILL/, "Churchill", '7"', "49"],
        [/PEQUENO/, "Pequeno", '4.187"', "32"],
        [/ROBUSTO/, "Robusto", '5.5"', "50"],
        [/TORO/, "Toro", '6"', "54"],
      ])
    );
  }

  if (/BLACK/.test(productName)) {
    return combineResearchDetails(
      researchedBlend("Dominican Republic", "Connecticut Broadleaf", "Dominican Republic", "Dominican Republic, Mexico", "Medium-Full"),
      researchedSizeFromMap(productName, [
        [/CRYSTAL/, "Crystal", '5.5"', "50"],
        [/GIGANTE/, "Gigante", '6"', "60"],
        [/PEQUENO/, "Pequeno", '4.187"', "32"],
      ])
    );
  }

  if (/CONNECTICUT/.test(productName)) {
    return combineResearchDetails(
      researchedBlend("Dominican Republic", "Ecuadorian Connecticut", "Mexican San Andres", "Brazil, Dominican Republic", "Mild-Medium"),
      researchedSize("Robusto Crystal", '5"', "50")
    );
  }

  if (/NICARAG/.test(productName)) {
    return combineResearchDetails(
      researchedBlend("Nicaragua", "Nicaraguan Colorado", "Nicaragua", "Nicaragua", "Medium-Full"),
      researchedSizeFromMap(productName, [
        [/PEQUENO/, "Pequeno", '4.187"', "32"],
        [/ROBUSTO/, "Robusto", '5"', "50"],
        [/TORO/, "Toro", '6.5"', "52"],
      ])
    );
  }

  if (/ROYALE/.test(productName)) {
    return combineResearchDetails(
      researchedBlend("Honduras", "Nicaraguan Broadleaf", "Dominican Piloto Cubano", "Dominican Republic, Honduras, Nicaragua", "Full"),
      researchedSize("Toro", '6"', "50")
    );
  }

  return combineResearchDetails(
    researchedBlend("Dominican Republic", "Cameroon", "Indonesia", "Dominican Republic", "Medium"),
    researchedSizeFromMap(productName, [
      [/CRYSTAL|CORONA/, "Corona", '5.5"', "42"],
      [/ROBUSTO/, "Robusto", '5"', "49"],
      [/TORO|TUBO/, "Toro", '6"', "50"],
    ])
  );
}

function getJmsDominicanResearch(productName: string) {
  if (!/^JM'S DOMINICAN\b/.test(productName)) {
    return undefined;
  }

  const wrapper = /CONNECTICUT/.test(productName)
    ? "Ecuadorian Connecticut"
    : /COROJO/.test(productName)
      ? "Ecuadorian Corojo"
      : /MADURO/.test(productName)
        ? "San Andres Maduro"
        : "Sumatra";
  const strength = /MADURO|COROJO/.test(productName) ? "Medium-Full" : "Mild-Medium";

  return combineResearchDetails(
    researchedBlend("Dominican Republic", wrapper, "Connecticut Broadleaf", "Dominican Republic", strength),
    researchedSizeFromMap(productName, [
      [/BELICOSO/, "Belicoso", '6"', "52"],
      [/CHURCHILL/, "Churchill", '6.75"', "50"],
      [/GORDO/, "Gordo", '5.5"', "62"],
      [/ROBUSTO/, "Robusto", '5"', "50"],
      [/TORO/, "Toro", '6"', "50"],
    ])
  );
}

function getBrickHouseResearch(productName: string) {
  if (!/^BRICK HOUSE\b/.test(productName)) {
    return undefined;
  }

  if (/SAMPLER/.test(productName)) {
    return assortedResearchDetails();
  }

  const wrapper = /CONNECTICUT/.test(productName)
    ? "Connecticut Shade"
    : /MADURO/.test(productName)
      ? "Brazilian Arapiraca Maduro"
      : "Nicaraguan Havana Subido";
  const binder = /CONNECTICUT/.test(productName) ? "Connecticut Broadleaf" : "Nicaragua";

  return combineResearchDetails(
    researchedBlend("Nicaragua", wrapper, binder, "Nicaragua", /CONNECTICUT/.test(productName) ? "Mild-Medium" : "Medium"),
    researchedSizeFromMap(productName, [
      [/MIGHTY MIGHTY/, "Mighty Mighty", '6.25"', "60"],
      [/SHORT TORPEDO/, "Short Torpedo", '5.5"', "52"],
      [/CHURCHILL/, "Churchill", '7.25"', "50"],
      [/CORONA LARGA/, "Corona Larga", '6.25"', "46"],
      [/ROBUSTO/, "Robusto", '5"', "54"],
      [/TORO/, "Toro", '6"', "52"],
      [/TRAVELER/, "Traveler", '6.25"', "42"],
    ])
  );
}

function getCamachoResearch(productName: string) {
  if (!/^CAMACHO\b/.test(productName)) {
    return undefined;
  }

  if (/CONNECTICUT/.test(productName)) {
    return combineResearchDetails(
      researchedBlend("Honduras", "Ecuadorian Connecticut", "Honduran Corojo", "Dominican Republic, Honduras", "Mild-Medium"),
      researchedSizeFromMap(productName, [
        [/CHURCHILL/, "Churchill", '7"', "48"],
        [/GIGANTE/, "Gigante", '6.5"', "54"],
        [/TORO/, "Toro", '6"', "50"],
      ])
    );
  }

  if (/ECUADOR/.test(productName)) {
    return combineResearchDetails(
      researchedBlend("Honduras", "Ecuadorian Habano", "Brazilian Mata Fina", "Honduran Corojo, Dominican Republic", "Medium-Full"),
      researchedSizeFromMap(productName, [
        [/CHURCHILL/, "Churchill", '7"', "48"],
        [/ROBUSTO/, "Robusto", '5"', "50"],
        [/TORO BOX PRESS/, "Toro Box Press", '6"', "50"],
        [/TORO/, "Toro", '6"', "50"],
      ])
    );
  }

  if (/NICARAGUA/.test(productName)) {
    return combineResearchDetails(
      researchedBlend("Honduras", "Ecuadorian Habano", "Honduras", "Dominican Republic, Honduras, Nicaragua", "Medium-Full"),
      researchedSizeFromMap(productName, [
        [/CHURCHILL/, "Churchill", '7"', "50"],
        [/ROBUSTO/, "Robusto", '5"', "52"],
        [/TORO/, "Toro", '6"', "50"],
      ])
    );
  }

  if (/TRIPLE MADURO/.test(productName)) {
    return combineResearchDetails(
      researchedBlend("Honduras", "San Andres Maduro", "Honduras", "Honduras", "Full"),
      researchedSizeFromMap(productName, [
        [/ROBUSTO/, "Robusto", '5"', "50"],
        [/TRIPLE MADURO/, "Robusto", '5"', "50"],
      ])
    );
  }

  if (/COROJO/.test(productName)) {
    return combineResearchDetails(
      researchedBlend("Honduras", "Honduran Corojo", "Honduran Corojo", "Honduran Corojo", "Full"),
      researchedSizeFromMap(productName, [
        [/GORDO/, "Gordo", '6"', "60"],
      ])
    );
  }

  return undefined;
}

function getNubResearch(productName: string) {
  if (!/^NUB\b/.test(productName)) {
    return undefined;
  }

  if (/SAMPLER/.test(productName)) {
    return assortedResearchDetails();
  }

  const wrapper = /CAMEROON/.test(productName)
    ? "Cameroon"
    : /CONNECTICUT/.test(productName)
      ? "Ecuadorian Connecticut"
      : /MADURO/.test(productName)
        ? "Brazilian Maduro"
        : "Nicaraguan Habano";
  const strength = /CONNECTICUT/.test(productName) ? "Mild-Medium" : "Medium";

  return combineResearchDetails(
    researchedBlend("Nicaragua", wrapper, "Nicaragua", "Nicaragua", strength),
    researchedSizeFromMap(productName, [
      [/358/, "358", '3.75"', "58"],
      [/460/, "460", '4"', "60"],
      [/464T/, "464T Torpedo", '4"', "64"],
      [/466/, "466", '4"', "66"],
    ])
  );
}

function getAsylumResearch(productName: string) {
  if (!/^ASYLUM\b/.test(productName)) {
    return undefined;
  }

  if (/INSIDIOUS/.test(productName)) {
    const wrapper = /MADURO/.test(productName) ? "Mexican San Andres Maduro" : "Ecuadorian Connecticut";

    return combineResearchDetails(
      researchedBlend("Honduras", wrapper, "Honduras", "Honduras", "Mild-Medium"),
      researchedSizeFromMap(productName, [
        [/7 X 64/, "Super Gordo", '7"', "64"],
        [/CHURCHILL/, "Churchill", '7"', "48"],
        [/ROBUSTO/, "Robusto", '5"', "50"],
        [/TORO/, "Toro", '6"', "52"],
      ])
    );
  }

  const wrapper = /OGRE/.test(productName) ? "Candela and Nicaraguan Maduro" : "Nicaragua";

  return combineResearchDetails(
    researchedBlend("Nicaragua", wrapper, "Nicaragua", "Nicaragua", "Full"),
    researchedSizeFromMap(productName, [
      [/80X6|XO/, "XO", '8"', "80"],
      [/7X70/, "Gordo", '7"', "70"],
      [/6X60/, "Gordo", '6"', "60"],
    ])
  );
}

function getAgingRoomResearch(productName: string) {
  if (!/^AGING ROOM\b/.test(productName)) {
    return undefined;
  }

  if (/QUATTRO|NICARAGUA/.test(productName)) {
    return combineResearchDetails(
      researchedBlend("Nicaragua", "Nicaraguan", "Nicaraguan", "Nicaraguan", "Medium-Full"),
      researchedSizeFromMap(productName, [
        [/SONATA MAESTRO/, "Maestro Torpedo", '5"', "52"],
        [/CONCERTO MAESTRO/, "Maestro Torpedo", '6"', "52"],
        [/MAESTRO/, "Maestro Torpedo", '5"', "56"],
      ])
    );
  }

  return undefined;
}

function getCaoResearch(productName: string) {
  if (!/^CAO\b/.test(productName)) {
    return undefined;
  }

  if (/FLATHEAD SPEED SHOP/.test(productName)) {
    return combineResearchDetails(
      researchedBlend("Nicaragua", "Connecticut Broadleaf", "Ecuadorian Connecticut", "Nicaragua, Dominican Republic", "Full"),
      researchedSizeFromMap(productName, [
        [/V554/, "V554", '6.5"', "50"],
        [/V660/, "V660", '6"', "60"],
      ])
    );
  }

  if (/FLATHEAD/.test(productName)) {
    return combineResearchDetails(
      researchedBlend("Nicaragua", "Connecticut Broadleaf", "Ecuadorian Connecticut", "Nicaragua, Dominican Republic", "Full"),
      researchedSizeFromMap(productName, [
        [/554/, "Camshaft", '5.5"', "54"],
        [/6\.25X42|PISTON/, "Piston", '6.25"', "42"],
        [/770/, "Big Block", '7"', "70"],
        [/V660|660|CARB/, "Carb", '6"', "60"],
      ])
    );
  }

  if (/BRAZILIA/.test(productName)) {
    return combineResearchDetails(
      researchedBlend("Nicaragua", "Brazilian Arapiraca", "Nicaragua", "Nicaragua", "Full"),
      researchedSizeFromMap(productName, [
        [/AMAZON/, "Amazon", '6"', "60"],
        [/GOL/, "Gol", '5"', "56"],
        [/SAMOBA|SAMBA/, "Samba", '6.25"', "54"],
      ])
    );
  }

  if (/NICARAGUA/.test(productName)) {
    return combineResearchDetails(
      researchedBlend("Honduras", "Honduran Jamastran", "Honduras", "Dominican Republic, Honduras, Nicaragua", "Medium"),
      researchedSizeFromMap(productName, [
        [/GRANADA/, "Granada", '6.25"', "50"],
        [/TIPITAPA/, "Tipitapa", '4.875"', "50"],
      ])
    );
  }

  if (/BX3/.test(productName)) {
    return combineResearchDetails(
      researchedBlend("Nicaragua", "Brazilian Mata Fina", "Brazilian Arapiraca", "Brazil, Honduras, Mexico, Nicaragua", "Medium-Full"),
      researchedSize("Robusto", '5"', "52")
    );
  }

  return undefined;
}

function getPartagasResearch(productName: string) {
  if (!/^PARTAGAS\b/.test(productName)) {
    return undefined;
  }

  if (/BLACK LABEL/.test(productName)) {
    return combineResearchDetails(
      researchedBlend("Dominican Republic", "Connecticut Havana Seed Maduro", "Dominican Republic", "Dominican Republic, Nicaragua", "Full"),
      researchedSizeFromMap(productName, [
        [/CLASICO/, "Clasico", '5.25"', "54"],
        [/CRYSTAL/, "Crystal Tubo", '5.5"', "50"],
        [/GIGANTE/, "Gigante", '6"', "60"],
        [/MAGNIFICO/, "Magnifico", '6"', "54"],
        [/MAXIMO/, "Maximo", '6"', "50"],
        [/PIRAMIDES/, "Piramides", '6"', "54"],
        [/PRONTOS/, "Prontos", '4.187"', "36"],
      ])
    );
  }

  if (/CORTADO/.test(productName)) {
    return combineResearchDetails(
      researchedBlend("Honduras", "Ecuadorian Connecticut", "Indonesia", "Honduras, Mexico, Nicaragua", "Medium"),
      researchedSizeFromMap(productName, [
        [/ROBUSTO/, "Robusto", '5"', "50"],
        [/TORO/, "Toro", '6"', "52"],
      ])
    );
  }

  return undefined;
}

function getFactoryThrowoutsResearch(productName: string) {
  if (!/^FACTORY THROWOUTS\b/.test(productName)) {
    return undefined;
  }

  return combineResearchDetails(
    researchedBlend("United States", /SWEET/.test(productName) ? "Sumatra" : "Ecuadorian Sun Grown", "Various", "Dominican Republic", "Mild-Medium"),
    researchedSizeFromMap(productName, [
      [/#49/, "No. 49", '5.5"', "49"],
      [/#59/, "No. 59", '6.25"', "45"],
      [/#99/, "No. 99", '7.25"', "52"],
    ])
  );
}

function getTabakResearch(productName: string) {
  if (!/^TABAK\b/.test(productName)) {
    return undefined;
  }

  const isNegra = /NEGRA|DARK ROAST/.test(productName);

  return combineResearchDetails(
    researchedBlend("Nicaragua", isNegra ? "Connecticut Broadleaf Maduro" : "Ecuadorian Connecticut Shade", "Nicaragua", "Nicaragua", "Medium"),
    researchedSizeFromMap(productName, [
      [/CAFECITA|5\/10 TIN|5\/10 TINS/, "Cafecita", '4"', "32"],
      [/CORONA/, "Corona", '4.75"', "46"],
      [/ROBUSTO/, "Robusto", '5"', "54"],
      [/TORO/, "Toro", '6"', "52"],
    ])
  );
}

function getDeadwoodResearch(productName: string) {
  if (!/^DEADWOOD\b/.test(productName)) {
    return undefined;
  }

  if (/DOMINICANA/.test(productName)) {
    return combineResearchDetails(
      researchedBlend("Dominican Republic", "Dark Maduro", "Dominican Republic", "Dominican Republic, Nicaragua", "Medium"),
      researchedSizeFromMap(productName, [
        [/ROBUSTO|NOCHES/, "Robusto", '5"', "54"],
        [/TORO/, "Toro", '6"', "50"],
        [/GORDO/, "Gordo", '6"', "60"],
      ])
    );
  }

  return combineResearchDetails(
    researchedBlend("Nicaragua", "Maduro", "Indonesia", "Nicaragua", "Medium"),
    researchedSizeFromMap(productName, [
      [/FAT BOTTOM BETTY GORDITO/, "Gordito", '6"', "60"],
      [/FAT BOTTOM BETTY TORO/, "Toro", '6"', "50"],
      [/FAT BOTTOM BETTY/, "Robusto", '5"', "54"],
      [/DIA DE LOS MUERTOS/, "Toro", '6"', "52"],
      [/GIRL WITH NO NAME/, "Lonsdale", '7"', "44"],
      [/LEATHER ROSE/, "Torpedo", '5"', "54"],
      [/TINS SWEET JANE/, "Tin", '4"', "32"],
      [/SWEET JANE/, "Corona", '5"', "46"],
    ])
  );
}

function getMyFatherFamilyResearch(productName: string) {
  if (!/^MY FATHER\b|^LA ANTI(?:GU|QU)EDAD\b|^FLOR DE LAS ANTILLAS\b|^JAIME GARCIA\b/.test(productName)) {
    return undefined;
  }

  if (/SAMPLER/.test(productName)) {
    return assortedResearchDetails();
  }

  if (/BLUE/.test(productName)) {
    return combineResearchDetails(
      researchedBlend("Nicaragua", "Nicaraguan Corojo", "Nicaraguan", "Nicaraguan", "Medium-Full"),
      researchedSizeFromMap(productName, [
        [/PETIT ROBUSTO/, "Petit Robusto", '4.5"', "50"],
        [/TORO GORDO/, "Toro Gordo", '6"', "60"],
        [/ROBUSTO/, "Robusto", '5.25"', "52"],
        [/TORO/, "Toro", '6"', "54"],
      ])
    );
  }

  if (/LA ANTI(?:GU|QU)EDAD/.test(productName)) {
    return combineResearchDetails(
      researchedBlend("Nicaragua", "Ecuadorian Habano Rosado Oscuro", "Nicaraguan Corojo and Criollo", "Nicaragua", "Medium-Full"),
      researchedSizeFromMap(productName, [
        [/SUPER TORO/, "Super Toro", '7"', "56"],
        [/TORO GORDO/, "Toro Gordo", '6"', "60"],
        [/CORONA GRANDE/, "Corona Grande", '6.375"', "47"],
        [/ROBUSTO/, "Robusto", '5.25"', "52"],
        [/TORO/, "Toro", '5.625"', "55"],
      ])
    );
  }

  if (/FLOR DE LAS ANTILLAS/.test(productName)) {
    return combineResearchDetails(
      researchedBlend("Nicaragua", "Nicaraguan Sun Grown", "Nicaragua", "Nicaragua", "Medium"),
      researchedSizeFromMap(productName, [
        [/ROBUSTO/, "Robusto", '5"', "50"],
        [/TORO/, "Toro", '6"', "52"],
      ])
    );
  }

  if (/JAIME GARCIA/.test(productName)) {
    return combineResearchDetails(
      researchedBlend("Nicaragua", "Connecticut Broadleaf Maduro", "Nicaragua", "Nicaragua", "Medium-Full"),
      researchedSizeFromMap(productName, [
        [/ROBUSTO/, "Robusto", '5.25"', "52"],
        [/TORO/, "Toro", '6"', "54"],
      ])
    );
  }

  if (/LE BIJOU/.test(productName)) {
    return combineResearchDetails(
      researchedBlend("Nicaragua", "Ecuadorian Habano Oscuro", "Nicaragua", "Nicaragua", "Full"),
      researchedSizeFromMap(productName, [
        [/TORO/, "Toro", '6"', "52"],
        [/PETIT ROBUSTO/, "Petit Robusto", '4.5"', "50"],
      ])
    );
  }

  return combineResearchDetails(
    researchedBlend("Nicaragua", "Ecuadorian Habano Rosado", "Nicaragua", "Nicaragua", "Medium-Full"),
    researchedSizeFromMap(productName, [
      [/ROBUSTO/, "Robusto", '5.25"', "52"],
      [/TORO/, "Toro", '6"', "52"],
      [/TORPEDO/, "Torpedo", '6.125"', "52"],
    ])
  );
}

function getAladinoResearch(productName: string) {
  if (!/^ALADINO\b/.test(productName)) {
    return undefined;
  }

  const wrapper = /CAMEROON/.test(productName)
    ? "Cameroon"
    : /CONNECTICUT/.test(productName)
      ? "Ecuadorian Connecticut"
      : "Honduran Corojo";

  return combineResearchDetails(
    researchedBlend("Honduras", wrapper, "Honduran Corojo", "Honduran Corojo", "Medium"),
    researchedSizeFromMap(productName, [
      [/ROBUSTO/, "Robusto", '5"', "50"],
      [/TORO/, "Toro", '6"', "50"],
    ])
  );
}

function getTatuajeResearch(productName: string) {
  if (!/^TATUAJE\b/.test(productName)) {
    return undefined;
  }

  if (/SAMPLER|MIXED/.test(productName)) {
    return assortedResearchDetails();
  }

  if (/HAVANA VI/.test(productName)) {
    return combineResearchDetails(
      researchedBlend("Nicaragua", "Nicaraguan Corojo", "Nicaragua", "Nicaragua", "Medium"),
      researchedSizeFromMap(productName, [
        [/GORDITOS/, "Gorditos", '5.5"', "56"],
        [/NOBLES/, "Nobles", '5"', "50"],
      ])
    );
  }

  if (/BLACK/.test(productName)) {
    return combineResearchDetails(
      researchedBlend("Nicaragua", "Nicaraguan Sun Grown Criollo", "Nicaragua", "Nicaragua", "Medium-Full"),
      researchedSizeFromMap(productName, [
        [/CORONA GORDA/, "Corona Gorda", '5.625"', "46"],
      ])
    );
  }

  if (/10TH/.test(productName)) {
    return combineResearchDetails(
      researchedBlend("Nicaragua", "Ecuadorian Habano", "Nicaragua", "Nicaragua", "Medium-Full"),
      researchedSize("Bon Chasseur", '5.375"', "52")
    );
  }

  return undefined;
}

function getLaFamilyResearch(productName: string) {
  if (!/^LA\b/.test(productName)) {
    return undefined;
  }

  if (/LA ANTIQUEDAD/.test(productName)) {
    return getMyFatherFamilyResearch(productName);
  }

  if (/LA GLORIA CUBANA/.test(productName)) {
    if (/SERIE R ESTELI MADURO/.test(productName)) {
      return combineResearchDetails(
        researchedBlend("Nicaragua", "Nicaraguan Maduro", "Nicaragua", "Nicaragua", "Full"),
        researchedSizeFromMap(productName, [
          [/NO\.?54|ROBUSTO/, "No. 54", '6"', "54"],
          [/NO\.?60|6 X 60/, "No. 60", '6"', "60"],
          [/NO\.?64|6\.25X64/, "No. 64", '6.25"', "64"],
        ])
      );
    }

    return combineResearchDetails(
      researchedBlend("Dominican Republic", "Ecuadorian Sumatra", "Nicaragua", "Dominican Republic, Nicaragua", "Medium"),
      researchedSizeFromMap(productName, [
        [/WAVELL/, "Wavell", '5"', "50"],
        [/CHURCHILL/, "Churchill", '7"', "50"],
        [/TORO/, "Toro", '6"', "54"],
      ])
    );
  }

  if (/LA FLOR DOMINICANA|LFD/.test(productName)) {
    const wrapper = /CAMEROON/.test(productName)
      ? "Cameroon"
      : /AIR BENDER/.test(productName)
        ? "Ecuadorian Habano"
        : "Ecuadorian Sumatra";

    return combineResearchDetails(
      researchedBlend("Dominican Republic", wrapper, "Dominican Republic", "Dominican Republic", "Medium-Full"),
      researchedSizeFromMap(productName, [
        [/CHISEL/, "Chisel", '6"', "54"],
        [/CHURCHILL/, "Churchill", '7"', "50"],
        [/CORONADO/, "Corona Gorda", '6"', "52"],
        [/ROBUSTO/, "Robusto", '5"', "50"],
        [/TORO/, "Toro", '6"', "50"],
      ])
    );
  }

  if (/LA AURORA/.test(productName)) {
    return combineResearchDetails(
      researchedBlend("Dominican Republic", /COROJO/.test(productName) ? "Corojo" : "Ecuadorian Connecticut", "Dominican Republic", "Dominican Republic", "Medium"),
      researchedSizeFromMap(productName, [
        [/PREFERIDO/, "Preferido", '5"', "54"],
      ])
    );
  }

  return undefined;
}

function getArturoFuenteRemainingResearch(productName: string) {
  if (!/^ARTURO FUENTE\b/.test(productName)) {
    return undefined;
  }

  const wrapper = /MADURO/.test(productName)
    ? "Connecticut Broadleaf Maduro"
    : /CLARO/.test(productName)
      ? "Connecticut Shade Claro"
      : "Connecticut Shade";
  const base = researchedBlend("Dominican Republic", wrapper, "Dominican Republic", "Dominican Republic", "Medium");

  if (/BREVAS ROYALE/.test(productName)) {
    return combineResearchDetails(base, researchedSize("Brevas Royale", '5.5"', "42"));
  }

  if (/CUBANITOS/.test(productName)) {
    return combineResearchDetails(base, researchedSize("Cubanitos", '4.5"', "32"));
  }

  if (/CURLY HEAD/.test(productName)) {
    return combineResearchDetails(base, researchedSize("Curly Head", '6.5"', "43"));
  }

  if (/EXQUISITOS/.test(productName)) {
    return combineResearchDetails(base, researchedSize("Exquisitos", '4.5"', "33"));
  }

  return undefined;
}

function getGurkhaResearch(productName: string) {
  if (!/^GURKHA\b/.test(productName)) {
    return undefined;
  }

  if (/SAMPLER/.test(productName)) {
    return assortedResearchDetails();
  }

  if (/BOURBON/.test(productName)) {
    return combineResearchDetails(
      researchedBlend("Dominican Republic", "Connecticut Shade", "Dominican", "Dominican", "Mild-Medium"),
      researchedSizeFromMap(productName, [
        [/CORONA/, "Corona", '5"', "42"],
        [/TORO/, "Toro", '6"', "50"],
        [/CHURCHILL/, "Churchill", '7"', "50"],
      ])
    );
  }

  if (/GRAND RESERVE|GRAN RESERVE/.test(productName)) {
    return combineResearchDetails(
      researchedBlend("Dominican Republic", "Connecticut Shade", "Dominican", "Dominican", "Mild-Medium"),
      researchedSizeFromMap(productName, [
        [/CORONA/, "Corona", '5"', "42"],
        [/CHURCHILL/, "Churchill", '7.25"', "52"],
        [/ROBUSTO/, "Robusto", '6"', "50"],
        [/TORPEDO/, "Torpedo", '6.25"', "52"],
      ])
    );
  }

  if (/PRIVATE SELECT/.test(productName)) {
    return combineResearchDetails(
      researchedBlend("Dominican Republic", "Connecticut Shade", "Dominican", "Dominican", "Mild-Medium"),
      researchedSizeFromMap(productName, [
        [/CORONA/, "Corona", '5"', "42"],
        [/CHURCHILL/, "Churchill", '7.25"', "52"],
      ])
    );
  }

  if (/CASTLE HALL NICARAGUA/.test(productName)) {
    return combineResearchDetails(
      researchedBlend("Nicaragua", "Ecuadorian Habano", "Nicaraguan", "Nicaraguan", "Medium"),
      researchedSizeFromMap(productName, [
        [/ROBUSTO/, "Robusto", '5"', "52"],
        [/TORO/, "Toro", '6"', "54"],
      ])
    );
  }

  if (/CASTLE HALL/.test(productName)) {
    return combineResearchDetails(
      researchedBlend("Dominican Republic", "Ecuadorian Connecticut", "Ecuadorian Habano", "Dominican Republic, Nicaragua", "Mild-Medium"),
      researchedSizeFromMap(productName, [
        [/ROBUSTO/, "Robusto", '5"', "52"],
        [/TORO/, "Toro", '6"', "54"],
      ])
    );
  }

  if (/CELLAR RESV 12YR PLATINUM/.test(productName)) {
    return combineResearchDetails(
      researchedBlend("Nicaragua", "Ecuadorian Habano Oscuro", "Nicaragua", "Nicaragua", "Medium-Full"),
      researchedSizeFromMap(productName, [
        [/SOLARA/, "Solara", '5"', "58"],
        [/HEDONISM/, "Hedonism", '6"', "58"],
        [/KRAKEN/, "Kraken", '6"', "60"],
      ])
    );
  }

  if (/CELLAR RESV 15YR MADURO/.test(productName)) {
    return combineResearchDetails(
      researchedBlend("Dominican Republic", "Brazilian Arapiraca Maduro", "Dominican Olor", "Dominican Republic", "Medium-Full"),
      researchedSizeFromMap(productName, [
        [/SOLARO|SOLARA/, "Solara", '5"', "58"],
        [/HEDONISM/, "Hedonism", '6"', "58"],
      ])
    );
  }

  if (/CELLAR RESV 15YR/.test(productName)) {
    return combineResearchDetails(
      researchedBlend("Dominican Republic", "Dominican Criollo 98", "Dominican Olor", "15 Year Dominican", "Medium-Full"),
      researchedSizeFromMap(productName, [
        [/SOLARO|SOLARA|DBL ROBUSTO/, "Solara", '5"', "58"],
        [/HEDONISM/, "Hedonism", '6"', "58"],
        [/PRISONER|CHURCHILL/, "Prisoner", '7"', "54"],
      ])
    );
  }

  if (/CELLAR RESV 18YR/.test(productName)) {
    return combineResearchDetails(
      researchedBlend("Dominican Republic", "Corojo", "Dominican", "Dominican", "Medium-Full"),
      researchedSizeFromMap(productName, [
        [/HEDONISM|GRAND ROTHSCHILD|HEDONSIM/, "Grand Rothschild", '6"', "58"],
      ])
    );
  }

  if (/GHOST/.test(productName)) {
    return combineResearchDetails(
      researchedBlend("Dominican Republic", "Brazilian Arapiraca Maduro", "Dominican Criollo 98", "Dominican Republic, Nicaragua", "Medium-Full"),
      researchedSizeFromMap(productName, [
        [/ASURA|TORO/, "Asura Toro", '6"', "54"],
        [/SHADOW|ROBUSTO/, "Shadow Robusto", '5"', "52"],
      ])
    );
  }

  if (/HERITAGE MADURO/.test(productName)) {
    return combineResearchDetails(
      researchedBlend("Nicaragua", "Mexican San Andres Maduro", "Nicaragua", "Nicaragua", "Medium-Full"),
      researchedSize("Robusto", '5"', "50")
    );
  }

  if (/NICARAGUA SERIES/.test(productName)) {
    return combineResearchDetails(
      researchedBlend("Dominican Republic", "Corojo", "Cameroon", "Criollo 98, USA, Nicaraguan", "Full"),
      researchedSizeFromMap(productName, [
        [/ROBUSTO/, "Robusto", '5"', "52"],
        [/TORO/, "Toro", '6"', "54"],
      ])
    );
  }

  if (/ROYAL CHALLENGE/.test(productName)) {
    return combineResearchDetails(
      researchedBlend("Dominican Republic", "Ecuadorian Connecticut", "Honduran Habano", "Dominican Republic, Nicaragua", "Mild-Medium"),
      researchedSizeFromMap(productName, [
        [/ROBUSTO/, "Robusto", '5"', "50"],
        [/TORO/, "Toro", '6"', "50"],
      ])
    );
  }

  if (/YEAR OF DRAGON|YEAR OF THE DRAGON/.test(productName)) {
    return combineResearchDetails(
      researchedBlend("Nicaragua", "Mexican San Andres", "Ecuadorian", "Dominican Republic, Nicaragua", "Medium-Full"),
      researchedSize("Figurado", '6.625"', "52")
    );
  }

  return undefined;
}

function getRockyPatelRemainingResearch(productName: string) {
  if (!/^ROCKY PATEL\b|^RP\b/.test(productName)) {
    return undefined;
  }

  if (/SAMPLER|SAMPLE PACK|FRESH PACK/.test(productName)) {
    return assortedResearchDetails();
  }

  if (/15TH ANNIV|FIFTEENTH/.test(productName)) {
    return combineResearchDetails(
      researchedBlend("Nicaragua", "Ecuadorian Habano", "Nicaragua", "Nicaragua", "Medium-Full"),
      researchedSizeFromMap(productName, [
        [/TORO TUBO/, "Toro Tubo", '6"', "50"],
        [/TORO/, "Toro", '6.5"', "52"],
        [/ROBUSTO/, "Robusto", '5.5"', "50"],
      ])
    );
  }

  if (/2003 VINTAGE CAMEROON/.test(productName)) {
    return combineResearchDetails(
      researchedBlend("Honduras", "Cameroon", "Nicaragua", "Dominican Republic, Nicaragua", "Medium"),
      researchedSize("Toro", '6.5"', "52")
    );
  }

  if (/2006 VINTAGE/.test(productName)) {
    return combineResearchDetails(
      researchedBlend("Nicaragua", "Mexican San Andres Maduro", "Nicaragua", "Nicaragua", "Medium-Full"),
      researchedSize("Toro", '6"', "52")
    );
  }

  if (/\bALR\b/.test(productName)) {
    return combineResearchDetails(
      researchedBlend("Nicaragua", "Mexican San Andres", "Nicaragua", "Nicaragua", "Medium-Full"),
      researchedSizeFromMap(productName, [
        [/ROBUSTO/, "Robusto", '5"', "50"],
        [/TORO/, "Toro", '6.5"', "52"],
      ])
    );
  }

  if (/GRAND RESERVE/.test(productName)) {
    return combineResearchDetails(
      researchedBlend("Nicaragua", "Proprietary", "Proprietary", "Proprietary", "Medium"),
      researchedSizeFromMap(productName, [
        [/ROBUSTO/, "Robusto", '5"', "50"],
        [/TORO/, "Toro", '6.5"', "52"],
      ])
    );
  }

  if (/GOLD LABEL/.test(productName)) {
    return combineResearchDetails(
      researchedBlend("Nicaragua", "Sumatra", "Connecticut Shade and Connecticut Broadleaf", "Nicaraguan Jalapa and Esteli", "Medium-Full"),
      researchedSize("Toro", '6.5"', "52")
    );
  }

  if (/EMERALD/.test(productName)) {
    return combineResearchDetails(
      researchedBlend("Nicaragua", "Ecuadorian Habano", "Nicaragua and Mexico", "Nicaragua, Honduras", "Medium"),
      researchedSize("Robusto", '5.5"', "50")
    );
  }

  if (/HONDURAN/.test(productName)) {
    return combineResearchDetails(
      researchedBlend("Honduras", "Honduran", "Honduran", "Honduran", "Medium"),
      /SAMPLER/.test(productName) ? assortedResearchDetails() : researchedSize("Assorted", "Assorted", "Assorted")
    );
  }

  if (/IT'S A BOY|ITS A BOY|IT'S A GIRL|ITS A GIRL/.test(productName)) {
    return combineResearchDetails(
      researchedBlend("Nicaragua", "Ecuadorian Connecticut", "Nicaragua", "Nicaragua", "Mild-Medium"),
      researchedSize("Toro", '6"', "50")
    );
  }

  if (/JUNIORS SUNGROWN/.test(productName)) {
    return combineResearchDetails(
      researchedBlend("Honduras", "Ecuadorian Sun Grown", "Nicaragua", "Dominican Republic, Nicaragua", "Medium-Full"),
      researchedSize("Junior", '4"', "38")
    );
  }

  return undefined;
}

function getKarenBergerResearch(productName: string) {
  if (!/^KAREN BERGER\b/.test(productName)) {
    return undefined;
  }

  if (/SAMPLER/.test(productName)) {
    return assortedResearchDetails();
  }

  const wrapper = /CONNECTICUT/.test(productName)
    ? "Ecuadorian Connecticut"
    : /MADURO/.test(productName)
      ? "Mexican San Andres Maduro"
      : "Ecuadorian Habano";

  return combineResearchDetails(
    researchedBlend("Nicaragua", wrapper, "Nicaragua", "Nicaragua", "Medium"),
    researchedSizeFromMap(productName, [
      [/ROBUSTO/, "Robusto", '5"', "52"],
      [/SALOMON|SALAMON/, "Salomon", '6"', "54"],
      [/TORO/, "Toro", '6"', "52"],
    ])
  );
}

function getMyFatherRemainingResearch(productName: string) {
  if (!/^MY FATHER\b|^LA DUENA\b|^EL CENTURION\b|^FONSECA\b/.test(productName)) {
    return undefined;
  }

  if (/SAMPLER|HUMID BAG/.test(productName)) {
    return assortedResearchDetails();
  }

  if (/FONSECA/.test(productName)) {
    return combineResearchDetails(
      researchedBlend("Nicaragua", /MX EDITION/.test(productName) ? "Mexican San Andres" : "Corojo 99", "Nicaragua", "Nicaragua", "Medium"),
      researchedSizeFromMap(productName, [
        [/ROBUSTO/, "Robusto", '5"', "50"],
        [/TORO/, "Toro", '6.25"', "52"],
        [/CEDROS/, "Cedros", '6.25"', "52"],
      ])
    );
  }

  if (/JUDGE/.test(productName)) {
    return combineResearchDetails(
      researchedBlend("Nicaragua", "Sumatra Oscuro", "Corojo Criollo", "Nicaragua", "Full"),
      researchedSizeFromMap(productName, [
        [/CORONA GORDA/, "Corona Gorda", '5.625"', "46"],
        [/TORO/, "Box-Pressed Toro", '6"', "56"],
      ])
    );
  }

  if (/LA GRAN OFERTA/.test(productName)) {
    return combineResearchDetails(
      researchedBlend("Nicaragua", "Habano Rosado", "Nicaragua", "Nicaragua Habano-Criollo", "Medium"),
      researchedSize("Assorted", "Assorted", "Assorted")
    );
  }

  if (/LA PROMESA/.test(productName)) {
    return combineResearchDetails(
      researchedBlend("Nicaragua", "Ecuadorian Habano Rosado Oscuro", "Nicaragua", "Nicaragua", "Medium-Full"),
      researchedSizeFromMap(productName, [
        [/LANCERO/, "Lancero", '7.5"', "38"],
      ])
    );
  }

  if (/LE BIJOU/.test(productName)) {
    return combineResearchDetails(
      researchedBlend("Nicaragua", "Habano Oscuro-Oscuro", "Nicaragua", "Nicaragua", "Full"),
      researchedSizeFromMap(productName, [
        [/CHURCHILL/, "Churchill", '7"', "50"],
        [/PETITE ROBUSTO|PETIT ROBUSTO/, "Petit Robusto", '4.5"', "50"],
        [/TORPEDO/, "Torpedo Box Pressed", '6.125"', "52"],
      ])
    );
  }

  if (/NO\.?3 CREMAS/.test(productName)) {
    return combineResearchDetails(
      researchedBlend("Nicaragua", "Ecuadorian Habano Rosado", "Nicaragua", "Nicaragua", "Medium-Full"),
      researchedSize("Cremas", '6.5"', "44")
    );
  }

  if (/LA DUENA/.test(productName)) {
    return combineResearchDetails(
      researchedBlend("Nicaragua", "Connecticut Broadleaf", "Connecticut Broadleaf and Nicaragua", "Connecticut Broadleaf and Nicaragua", "Medium-Full"),
      researchedSizeFromMap(productName, [
        [/NO\.?\s*7|\b7\b/, "No. 7 Petit Lancero", '6"', "42"],
        [/NO\.?\s*13|\b13\b/, "No. 13 Toro Gordo", '6"', "56"],
      ])
    );
  }

  if (/EL CENTURION H-?2K-?CT/.test(productName)) {
    return combineResearchDetails(
      researchedBlend("Nicaragua", "Hybrid Habano 2000 Connecticut", "Nicaragua", "Nicaragua", "Medium-Full"),
      researchedSize("Toro", '6"', "52")
    );
  }

  return undefined;
}

function getLaGloriaRemainingResearch(productName: string) {
  if (!/^LA GLORIA\b|^LA AROMA\b|^LA AURORA\b|^LA PALINA\b|^LA ESTRELLA\b|^LA MIRADA\b/.test(productName)) {
    return undefined;
  }

  if (/SAMPLER|4 PACK/.test(productName)) {
    return assortedResearchDetails();
  }

  if (/LA GLORIA CUBANA.*SERIE R/.test(productName)) {
    const isMaduro = /MADURO/.test(productName);

    return combineResearchDetails(
      researchedBlend(
        "Dominican Republic",
        isMaduro ? "Connecticut Broadleaf Maduro" : "Ecuadorian Sumatra",
        "Nicaragua",
        "Dominican Republic, Nicaragua",
        "Full"
      ),
      researchedSizeFromMap(productName, [
        [/#5|\b5\b/, "No. 5", '5.5"', "54"],
        [/#6|\b6\b/, "No. 6", '5.875"', "60"],
        [/#7|\b7\b/, "No. 7", '7"', "58"],
      ])
    );
  }

  if (/LA GLORIA CUBANA.*GLORIAS EN CEDRO/.test(productName)) {
    return combineResearchDetails(
      researchedBlend("Dominican Republic", "Ecuadorian Sumatra", "Nicaragua", "Dominican Republic, Nicaragua", "Medium"),
      researchedSize("Glorias en Cedro", '6.25"', "46")
    );
  }

  if (/LA GLORIA ESTELI/.test(productName)) {
    const isMaduro = /MADURO/.test(productName);

    return combineResearchDetails(
      researchedBlend("Nicaragua", isMaduro ? "Nicaraguan Jalapa Maduro" : "Nicaraguan Jalapa", "Nicaragua", "Nicaragua", "Medium-Full"),
      researchedSizeFromMap(productName, [
        [/#52|\b52\b/, "No. 52", '6"', "52"],
        [/#60|\b60\b/, "No. 60", '6"', "60"],
        [/#64|\b64\b/, "No. 64", '6.25"', "64"],
      ])
    );
  }

  if (/LA AURORA 120TH/.test(productName)) {
    return combineResearchDetails(
      researchedBlend("Dominican Republic", "Ecuadorian Connecticut", "Dominican Republic", "Dominican Republic", "Medium"),
      researchedSize("Robusto", '5"', "50")
    );
  }

  if (/LA AROMA DE CUBA CONN/.test(productName)) {
    return combineResearchDetails(
      researchedBlend("Nicaragua", "Ecuadorian Connecticut", "Nicaragua", "Nicaragua", "Mild-Medium"),
      researchedSize("Immensa", '5.75"', "60")
    );
  }

  if (/LA AROMA DE CUBA EL JEFE/.test(productName)) {
    return combineResearchDetails(
      researchedBlend("Nicaragua", "Connecticut Broadleaf", "Nicaragua", "Nicaragua", "Medium-Full"),
      researchedSize("El Jefe", '7"', "58")
    );
  }

  if (/LA PALINA NICARAGUA/.test(productName)) {
    return assortedResearchDetails();
  }

  if (/LA ESTRELLA CUBANA/.test(productName)) {
    return combineResearchDetails(
      researchedBlend("Nicaragua", "Habano", "Nicaragua", "Nicaragua", "Medium"),
      researchedSize("Robusto", '5"', "50")
    );
  }

  if (/LA MIRADA/.test(productName)) {
    return combineResearchDetails(
      researchedBlend("Nicaragua", "Habano", "Nicaragua", "Nicaragua", "Medium"),
      researchedSize("Robusto", '5"', "50")
    );
  }

  return undefined;
}

function getMacanudoRemainingResearch(productName: string) {
  if (!/^MACANUDO\b/.test(productName)) {
    return undefined;
  }

  if (/SAMPLER/.test(productName)) {
    return assortedResearchDetails();
  }

  if (/INSPIRADO GREEN/.test(productName)) {
    return combineResearchDetails(
      researchedBlend("Dominican Republic", "Brazilian Arapiraca", "Indonesia", "Colombia, Dominican Republic", "Medium"),
      researchedSizeFromMap(productName, [
        [/ROBUSTO/, "Robusto", '5"', "52"],
        [/TORO/, "Toro", '6"', "50"],
      ])
    );
  }

  if (/INSPIRADO (ORANGE|RED|WHITE).*MINIS/.test(productName)) {
    return researchedSize("Mini", '3"', "20");
  }

  if (/MINIATURES/.test(productName)) {
    return combineResearchDetails(
      researchedBlend("Dominican Republic", "Connecticut Shade", "Mexican San Andres", "Dominican Republic, Mexico", "Mild"),
      researchedSize("Miniature", '3.25"', "26")
    );
  }

  if (/\bM ESPRESSO W\/ CREAM\b|M ESPRESSO/.test(productName)) {
    return combineResearchDetails(
      researchedBlend("Nicaragua", "Indonesian barber pole", "Philippine", "Nicaraguan", "Medium"),
      researchedSize("Toro", '6"', "50")
    );
  }

  return undefined;
}

function getMontecristoRemainingResearch(productName: string) {
  if (!/^MONTECRISTO\b/.test(productName)) {
    return undefined;
  }

  if (/SAMPLER|FRESHLOC/.test(productName)) {
    return assortedResearchDetails();
  }

  if (/1935 ANNIVERSARY|ESPADA|NICARAGUA SERIES|PLATINUM|WHITE|CLASSIC/.test(productName)) {
    return undefined;
  }

  if (/MEMORIES/.test(productName)) {
    return combineResearchDetails(
      researchedBlend("Dominican Republic", "Connecticut Shade", "Dominican Republic", "Dominican Republic", "Mild"),
      researchedSize("Memories", '4"', "33")
    );
  }

  return combineResearchDetails(
    researchedBlend("Dominican Republic", "Connecticut Shade", "Dominican Republic", "Dominican Republic", "Mild"),
    researchedSizeFromMap(productName, [
      [/DOUBLE CORONA/, "Double Corona", '6.75"', "50"],
      [/CHURCHILL/, "Churchill", '7"', "54"],
      [/NO\.?\s*1/, "No. 1", '6.625"', "44"],
      [/NO\.?\s*2/, "No. 2", '6.125"', "52"],
      [/NO\.?\s*3/, "No. 3", '5.5"', "44"],
      [/ROBUSTO/, "Robusto", '5"', "52"],
    ])
  );
}

function getPerlaDelMarResearch(productName: string) {
  if (!/^PERLA DEL MAR\b/.test(productName)) {
    return undefined;
  }

  const isMaduro = /MADURO/.test(productName);

  return combineResearchDetails(
    researchedBlend("Nicaragua", isMaduro ? "Connecticut Broadleaf" : "Ecuadorian Connecticut", "Nicaragua", "Nicaragua", "Mild-Medium"),
    researchedSizeFromMap(productName, [
      [/CORONA/, "Perla L", '5.5"', "46"],
      [/SHORT|ST ROBUSTO/, "Perla P", '3.75"', "56"],
      [/ROBUSTO/, "Perla M", '4.75"', "52"],
      [/DOUBLE TORO/, "Perla TG", '6"', "60"],
      [/TORO GRANDE/, "Perla TG", '6"', "60"],
      [/TORO/, "Perla G", '6.25"', "54"],
    ])
  );
}

function getBaccaratResearch(productName: string) {
  if (!/^BACCARAT\b/.test(productName)) {
    return undefined;
  }

  const isMaduro = /MADURO/.test(productName);

  return combineResearchDetails(
    researchedBlend("Honduras", isMaduro ? "Connecticut Broadleaf" : "Connecticut Shade", "Mexican", "Honduran", "Mild"),
    researchedSizeFromMap(productName, [
      [/CHURCHILL/, "Churchill", '7"', "49"],
      [/ROTHCHILD|ROTHSCHILD/, "Rothschild", '5"', "50"],
      [/GORDO/, "Gordo", '6"', "60"],
      [/TORO/, "Toro", '6"', "50"],
    ])
  );
}

function getJoyaResearch(productName: string) {
  if (!/^JOYA\b/.test(productName)) {
    return undefined;
  }

  if (/CABINETTA/.test(productName)) {
    return combineResearchDetails(
      researchedBlend("Nicaragua", "Ecuadorian Connecticut and Nicaraguan Habano Criollo", "Nicaraguan", "Nicaraguan", "Mild-Medium"),
      researchedSizeFromMap(productName, [
        [/CORONA GORDA/, "Corona Gorda", '5.25"', "46"],
        [/ROBUSTO/, "Robusto", '5"', "50"],
        [/TORO/, "Toro", '6"', "52"],
      ])
    );
  }

  if (/SILVER/.test(productName)) {
    return combineResearchDetails(
      researchedBlend("Nicaragua", "Ecuadorian Habano", "Mexican San Andres", "Nicaraguan", "Medium-Full"),
      researchedSizeFromMap(productName, [
        [/TORO/, "Toro", '6"', "52"],
        [/ROBUSTO/, "Robusto", '5"', "50"],
      ])
    );
  }

  if (/BLACK/.test(productName)) {
    return combineResearchDetails(
      researchedBlend("Nicaragua", "Mexican San Andres", "Nicaraguan", "Nicaraguan", "Medium"),
      researchedSize("Robusto", '5.25"', "50")
    );
  }

  if (/RED/.test(productName)) {
    return combineResearchDetails(
      researchedBlend("Nicaragua", "Nicaraguan Habano Criollo Claro", "Nicaraguan", "Nicaraguan", "Medium"),
      researchedSize("Robusto", '5.25"', "50")
    );
  }

  return undefined;
}

function getLeafByOscarResearch(productName: string) {
  if (!/^LEAF BY OSCAR\b|^OSCAR LEAF\b/.test(productName)) {
    return undefined;
  }

  const wrapper = /CONNECTICUT/.test(productName)
    ? "Ecuadorian Connecticut"
    : /COROJO/.test(productName)
      ? "Honduran Corojo"
      : /MADURO/.test(productName)
        ? "Mexican San Andres Maduro"
        : /CRIOLLO/.test(productName)
          ? "Criollo Jamastran"
          : "Ecuadorian Sumatra";

  return combineResearchDetails(
    researchedBlend("Honduras", wrapper, "Honduran", "Honduran", "Medium"),
    researchedSizeFromMap(productName, [
      [/TORO/, "Toro", '6"', "52"],
      [/ROBUSTO/, "Robusto", '4"', "50"],
      [/SIXTY|GORDO/, "Sixty", '6"', "60"],
    ])
  );
}

function getSchizoResearch(productName: string) {
  if (!/^SCHIZO\b/.test(productName)) {
    return undefined;
  }

  const isMaduro = /MADURO/.test(productName);

  return combineResearchDetails(
    researchedBlend(
      isMaduro ? "Nicaragua" : "Honduras",
      isMaduro ? "San Andres Maduro" : "Natural",
      isMaduro ? "Nicaragua" : "Honduras",
      isMaduro ? "Nicaragua" : "Honduras",
      isMaduro ? "Medium-Full" : "Medium"
    ),
    researchedSizeFromMap(productName, [
      [/7\s*X\s*70|HERCULE/, "Hercule", '7"', "70"],
      [/6\s*X\s*60|TORO GORDO/, "Toro Gordo", '6"', "60"],
      [/6\s*X\s*50|TORO/, "Toro", '6"', "50"],
    ])
  );
}

function getHavanaQResearch(productName: string) {
  if (!/^HAVANA Q\b/.test(productName)) {
    return undefined;
  }

  return combineResearchDetails(
    researchedBlend("Nicaragua", "Ecuadorian Havana-seed", "Nicaraguan", "Nicaraguan", "Medium"),
    researchedSizeFromMap(productName, [
      [/DOUBLE CHURCHILL/, "Double Churchill", '7"', "52"],
      [/DOUBLE GRANDE/, "Double Grande", '6"', "60"],
      [/DOUBLE ROBUSTO/, "Double Robusto", '5"', "56"],
      [/DOUBLE TORO/, "Double Toro", '6"', "54"],
    ])
  );
}

function getHoyoResearch(productName: string) {
  if (!/^HOYO\b/.test(productName)) {
    return undefined;
  }

  if (/EXCALIBUR/.test(productName)) {
    const wrapper = /MADURO/.test(productName) ? "Connecticut Broadleaf Maduro" : "Connecticut Shade";

    return combineResearchDetails(
      researchedBlend("Honduras", wrapper, "Connecticut Shade", "Dominican Republic, Honduras, Nicaragua", "Mild-Medium"),
      researchedSizeFromMap(productName, [
        [/CIGARILLOS/, "Cigarillo", '4"', "24"],
        [/MINIATURES/, "Miniature", '3.25"', "22"],
        [/NO\.?\s*1/, "No. 1", '7.25"', "54"],
      ])
    );
  }

  return undefined;
}

function getAvoResearch(productName: string) {
  if (!/^AVO\b/.test(productName)) {
    return undefined;
  }

  if (/SAMPLER/.test(productName)) {
    return assortedResearchDetails();
  }

  if (/CLASSIC/.test(productName)) {
    return combineResearchDetails(
      researchedBlend("Dominican Republic", "Ecuadorian Connecticut", "Dominican Republic", "Dominican Republic", "Mild-Medium"),
      researchedSize("Robusto", '5"', "50")
    );
  }

  if (/SYNCRO NICARAGUA/.test(productName)) {
    return combineResearchDetails(
      researchedBlend("Dominican Republic", "Ecuadorian Connecticut", "Dominican Republic", "Dominican Republic, Nicaragua, Peru", "Medium"),
      researchedSize("Toro", '6"', "54")
    );
  }

  if (/SYNCRO CARIBE/.test(productName)) {
    return combineResearchDetails(
      researchedBlend("Dominican Republic", "Ecuadorian wrapper", "Dominican Republic", "Dominican Republic, Nicaragua", "Medium"),
      researchedSize("Toro", '6"', "52")
    );
  }

  return undefined;
}

function getUndercrownRemainingResearch(productName: string) {
  if (!/^LIGA UNDERCROWN\b|^LIGA PRIVADA\b|^UNDERCROWN\b/.test(productName)) {
    return undefined;
  }

  if (/FRESH PACK/.test(productName)) {
    return assortedResearchDetails();
  }

  if (/H99.*PAPAS FRITAS/.test(productName)) {
    return combineResearchDetails(
      researchedBlend("Nicaragua", "Connecticut Corojo", "Mexican San Andres", "Nicaragua, Honduras", "Medium-Full"),
      researchedSize("Papas Fritas", '4.5"', "44")
    );
  }

  if (/SHADE/.test(productName)) {
    return combineResearchDetails(
      researchedBlend("Nicaragua", "Ecuadorian Connecticut", "Sumatra", "Dominican Republic, Nicaragua", "Medium"),
      researchedSizeFromMap(productName, [
        [/GORDITO/, "Gordito", '6"', "60"],
        [/GRAN TORO/, "Gran Toro", '6"', "52"],
        [/ROBUSTO/, "Robusto", '5"', "54"],
        [/TORO/, "Toro", '6"', "52"],
      ])
    );
  }

  if (/MADURO/.test(productName)) {
    return combineResearchDetails(
      researchedBlend("Nicaragua", "Mexican San Andres Maduro", "Connecticut River Valley Stalk-Cut Habano", "Brazilian Mata Fina, Nicaragua", "Medium-Full"),
      researchedSizeFromMap(productName, [
        [/ROBUSTO/, "Robusto", '5"', "50"],
        [/TORO/, "Toro", '6"', "52"],
      ])
    );
  }

  if (/UC10/.test(productName)) {
    return combineResearchDetails(
      researchedBlend("Nicaragua", "Mexican San Andres Maduro", "Connecticut Broadleaf", "Nicaragua", "Medium-Full"),
      researchedSizeFromMap(productName, [
        [/ROBUSTO/, "Robusto", '5"', "50"],
        [/TORO/, "Toro", '6"', "52"],
      ])
    );
  }

  return undefined;
}

function getNicaRusticaResearch(productName: string) {
  if (!/^NICA RUSTICA\b/.test(productName)) {
    return undefined;
  }

  if (/CONNECTICUT/.test(productName)) {
    return combineResearchDetails(
      researchedBlend("Nicaragua", "Ecuadorian Connecticut", "Mexican San Andres", "Nicaraguan", "Medium"),
      researchedSizeFromMap(productName, [
        [/SHORT ROBUSTO/, "Short Robusto", '4.5"', "50"],
        [/GORDO/, "Gordo", '6"', "60"],
        [/TORO/, "Toro", '6"', "50"],
      ])
    );
  }

  if (/ADOBE/.test(productName)) {
    return combineResearchDetails(
      researchedBlend("Nicaragua", "Ecuadorian Habano", "Brazilian", "Nicaragua", "Medium-Full"),
      researchedSizeFromMap(productName, [
        [/GORDO/, "Gordo", '6"', "60"],
        [/TORO/, "Toro", '6"', "52"],
        [/ROBUSTO/, "Robusto", '5"', "52"],
      ])
    );
  }

  return combineResearchDetails(
    researchedBlend("Nicaragua", "Connecticut Broadleaf", "Mexican San Andres", "Nicaragua", "Medium-Full"),
    researchedSizeFromMap(productName, [
      [/SHORT ROBUSTO/, "Short Robusto", '4.5"', "50"],
      [/GORDO/, "Gordo", '6"', "60"],
      [/TORO/, "Toro", '6"', "52"],
    ])
  );
}

function getCazadoresResearch(productName: string) {
  if (!/^CAZADORES\b/.test(productName)) {
    return undefined;
  }

  const isNicaragua = /NICARAGUA/.test(productName);

  return combineResearchDetails(
    researchedBlend(isNicaragua ? "Nicaragua" : "Dominican Republic", isNicaragua ? "Nicaraguan" : "Ecuadorian Habano", "Nicaragua", "Nicaragua", "Medium"),
    researchedSizeFromMap(productName, [
      [/ROBUSTO/, "Robusto", '5"', "50"],
      [/TORO/, "Toro", '6"', "50"],
    ])
  );
}

function getNewCubaResearch(productName: string) {
  if (!/^NEW CUBA\b/.test(productName)) {
    return undefined;
  }

  const wrapper = /CONNECTICUT/.test(productName)
    ? "Ecuadorian Connecticut"
    : /COROJO/.test(productName)
      ? "Ecuadorian Corojo"
      : "Nicaraguan";

  return combineResearchDetails(
    researchedBlend("Nicaragua", wrapper, "Nicaraguan", "Nicaraguan", "Medium"),
    researchedSizeFromMap(productName, [
      [/TITAN/, "Titan", '6"', "60"],
      [/CHURCHILL/, "Churchill", '7"', "50"],
      [/ROBUSTO/, "Robusto", '5"', "50"],
      [/TORO/, "Toro", '6"', "50"],
      [/CORONA/, "Corona", '5.5"', "44"],
    ])
  );
}

function getRomeoRemainingResearch(productName: string) {
  if (!/^ROMEO\b|^RYJ\b/.test(productName)) {
    return undefined;
  }

  if (/SAMPLER|FRESH PACK/.test(productName)) {
    return assortedResearchDetails();
  }

  if (/HABANA RESV|HABANA RESERVE/.test(productName)) {
    return combineResearchDetails(
      researchedBlend("Honduras", "Nicaraguan", "Nicaraguan", "Honduras, Nicaragua", "Medium-Full"),
      researchedSizeFromMap(productName, [
        [/AMORES/, "Amores", '4"', "33"],
      ])
    );
  }

  if (/VINTAGE/.test(productName)) {
    return combineResearchDetails(
      researchedBlend("Dominican Republic", "Ecuadorian Connecticut", "Mexican", "Dominican Republic", "Mild-Medium"),
      researchedSizeFromMap(productName, [
        [/CORONA/, "Corona", '5.5"', "44"],
      ])
    );
  }

  if (/GRAN TORO/.test(productName)) {
    return combineResearchDetails(
      researchedBlend("Dominican Republic", "Ecuadorian Habano", "Dominican Republic", "Dominican Republic, Nicaragua", "Medium-Full"),
      researchedSize("Gran Toro", '6"', "54")
    );
  }

  return undefined;
}

function getDeepAuditRemainingResearch(productName: string) {
  if (/^TRADER JACK/.test(productName)) {
    const wrapper = /SUNRISE/.test(productName)
      ? "Connecticut Shade"
      : /MIDNIGHT/.test(productName)
        ? "Maduro"
        : "Connecticut seed";

    return combineResearchDetails(
      researchedBlend("Dominican Republic", wrapper, "Proprietary", "Dominican Republic, Honduras, Nicaragua", "Mild-Medium"),
      researchedSize("Assorted", "Assorted", "Assorted")
    );
  }

  if (/^GRAN HABANO/.test(productName)) {
    const isNumberOne = /#?1\b/.test(productName);

    return combineResearchDetails(
      researchedBlend("Honduras", isNumberOne ? "Connecticut" : "Nicaraguan Corojo", "Nicaraguan Habano", "Nicaraguan and Costa Rican", isNumberOne ? "Mild-Medium" : "Medium-Full"),
      researchedSizeFromMap(productName, [
        [/GRAN ROBUSTO|#?5|COROJO/, "Gran Robusto", '6"', "54"],
        [/ROBUSTO/, "Robusto", '5"', "50"],
      ])
    );
  }

  if (/^DIESEL\b/.test(productName)) {
    if (/SHERRY CASK/.test(productName)) {
      return combineResearchDetails(
        researchedBlend("Nicaragua", "Connecticut Broadleaf", "Brazilian Arapiraca", "Nicaraguan", "Medium-Full"),
        researchedSizeFromMap(productName, [
          [/ROBUSTO/, "Robusto", '5"', "52"],
          [/TORO/, "Toro", '6"', "50"],
        ])
      );
    }

    if (/WHISKEY ROW/.test(productName)) {
      return combineResearchDetails(
        researchedBlend("Nicaragua", "Ecuadorian Habano", "Mexican San Andres", "Nicaraguan Condega, Jalapa, Ometepe", "Medium-Full"),
        researchedSize("Toro", '6"', "54")
      );
    }
  }

  if (/^LIGA UNDERCROWN\b/.test(productName)) {
    return combineResearchDetails(
      /^LIGA UNDERCROWN SHADE/.test(productName)
        ? researchedBlend("Nicaragua", "Ecuadorian Connecticut", "Sumatra", "Dominican Republic, Nicaragua", "Medium")
        : researchedBlend("Nicaragua", "Mexican San Andres Maduro", "Connecticut River Valley Stalk-Cut Habano", "Brazilian Mata Fina, Nicaragua", "Medium-Full"),
      researchedSizeFromMap(productName, [
        [/ROBUSTO/, "Robusto", '5"', "54"],
        [/GRAN TORO/, "Gran Toro", '6"', "52"],
      ])
    );
  }

  if (/^CACTUS JOE/.test(productName)) {
    return combineResearchDetails(
      researchedBlend("Dominican Republic", "Indonesian", "Proprietary", "Dominican Republic", "Mild"),
      standardCigarSizeFromName(productName)
    );
  }

  if (/^DAVIDOFF WINSTON CHURCHILL/.test(productName)) {
    return assortedResearchDetails();
  }

  if (/^OLD MAN/.test(productName)) {
    return combineResearchDetails(
      researchedBlend("Nicaragua", "Habano", "Proprietary", "Proprietary", "Medium"),
      researchedSize("Assorted", "Assorted", "Assorted")
    );
  }

  if (/^JAVA (MADURO|MINT)/.test(productName)) {
    return combineResearchDetails(
      researchedBlend("Nicaragua", /MINT/.test(productName) ? "Brazilian Maduro" : "Brazilian Maduro", "Nicaragua", "Nicaragua", "Medium"),
      researchedSize("X-Press", '4"', "32")
    );
  }

  if (/^DON PEPIN/.test(productName)) {
    const isJj = /SERIES JJ/.test(productName);

    return combineResearchDetails(
      researchedBlend("Nicaragua", isJj ? "Nicaraguan Corojo Rosado" : "Nicaraguan Corojo Oscuro", "Nicaragua", "Nicaragua", "Medium-Full"),
      researchedSizeFromMap(productName, [
        [/INVICTUS/, "Invictus", '5"', "50"],
        [/ROBUSTO/, "Robusto", '5.25"', "50"],
      ])
    );
  }

  if (/^NATIONAL BRAND/.test(productName)) {
    return combineResearchDetails(
      researchedBlend("Honduras", /MADURO/.test(productName) ? "Maduro" : "Natural", "Proprietary", "Proprietary", "Medium"),
      standardCigarSizeFromName(productName)
    );
  }

  if (/^SAN LOTANO MADURO/.test(productName)) {
    return combineResearchDetails(
      researchedBlend("Nicaragua", "San Andres Maduro", "Nicaragua", "Honduras, Nicaragua", "Medium-Full"),
      researchedSizeFromMap(productName, [
        [/GRAN TORO/, "Gran Toro", '6"', "60"],
        [/TORO/, "Toro", '6"', "54"],
      ])
    );
  }

  if (/^ZINO PLATINUM/.test(productName)) {
    return combineResearchDetails(
      researchedBlend("Dominican Republic", "Ecuadorian Connecticut", "Dominican Republic", "Dominican Republic, Peru", "Medium"),
      researchedSizeFromMap(productName, [
        [/CHUBBY/, "Chubby", '4"', "54"],
        [/GRAND MASTER/, "Grand Master", '5.5"', "52"],
      ])
    );
  }

  if (/^(CHILLIN MOOSE|SHADY MOOSE)/.test(productName)) {
    return combineResearchDetails(
      researchedBlend("Nicaragua", /MADURO/.test(productName) ? "Maduro" : "Ecuadorian Connecticut", "Nicaragua", "Nicaragua", "Medium"),
      standardCigarSizeFromName(productName)
    );
  }

  if (/^H UPMANN THE BANKER DAYTRADER/.test(productName)) {
    return combineResearchDetails(
      researchedBlend("Dominican Republic", "Ecuador", "Nicaragua", "Dominican Republic, Nicaragua", "Medium-Full"),
      researchedSizeFromMap(productName, [
        [/ROBUSTO/, "Robusto", '5"', "54"],
        [/WHALE/, "Whale", '6"', "60"],
      ])
    );
  }

  if (/^VILLIGER MINI/.test(productName)) {
    return combineResearchDetails(
      researchedBlend("Germany", "Indonesian", "Proprietary", "Proprietary", "Mild"),
      researchedSize("Mini", '3"', "20")
    );
  }

  if (/^EL REY DEL MUNDO.*SAMPLER|^BOLIVAR.*SAMPLER|^ALEC BRADLEY.*FRESH PACK|^TASTE OF OLIVA|^AGING ROOM.*SAMPLER|^OMAR ORTEZ.*SAMPLER/.test(productName)) {
    return assortedResearchDetails();
  }

  if (/^OUTCAST/.test(productName)) {
    return combineResearchDetails(
      researchedBlend("Nicaragua", "Ecuadorian Habano", "Nicaragua", "Nicaragua", "Medium"),
      standardCigarSizeFromName(productName)
    );
  }

  if (/^OLMEC/.test(productName)) {
    return combineResearchDetails(
      researchedBlend("Nicaragua", /MADURO/.test(productName) ? "Mexican San Andres Maduro" : "Mexican San Andres Claro", "Nicaraguan", "Nicaraguan", "Full"),
      researchedSize("Robusto", '5"', "50")
    );
  }

  if (/^6 X 60 SAMPLER JC NEWMAN/.test(productName)) {
    return {
      binder: "Varies by selection",
      filler: "Varies by selection",
    };
  }

  if (/^20 ACRE FARM/.test(productName)) {
    return combineResearchDetails(
      researchedBlend("Nicaragua", "Florida Sun Grown", "Honduran", "Nicaraguan", "Medium"),
      researchedSize("Robusto", '5.25"', "54")
    );
  }

  if (/^ACID C-NOTE/.test(productName)) {
    return combineResearchDetails(
      researchedBlend("Nicaragua", "Sumatra", "Nicaragua", "Nicaragua", "Mild"),
      researchedSize("C-Note", '3.75"', "20")
    );
  }

  if (/^AL CAPONE/.test(productName)) {
    return combineResearchDetails(
      researchedBlend("Nicaragua", "Indonesian", "Brazilian", "Brazilian", "Mild"),
      researchedSize("Cigarillo", '3.5"', "20")
    );
  }

  if (/^ANTANO 1970/.test(productName)) {
    return combineResearchDetails(
      researchedBlend("Nicaragua", "Nicaraguan Habano Criollo", "Nicaraguan", "Nicaraguan", "Full"),
      researchedSize("Gran Consul", '4.75"', "60")
    );
  }

  if (/^FLOR DE LAS ANTILLAS MADURO/.test(productName)) {
    return combineResearchDetails(
      researchedBlend("Nicaragua", "Nicaraguan Maduro", "Nicaragua", "Nicaragua", "Medium"),
      researchedSize("Torpedo", '6.125"', "52")
    );
  }

  if (/^JAIME GARCIA SUPER GORDO/.test(productName)) {
    return combineResearchDetails(
      researchedBlend("Nicaragua", "Connecticut Broadleaf Maduro", "Nicaragua", "Nicaragua", "Medium-Full"),
      researchedSize("Super Gordo", '6"', "60")
    );
  }

  if (/^JM DOMINICAN/.test(productName)) {
    return combineResearchDetails(
      researchedBlend("Dominican Republic", /MADURO/.test(productName) ? "San Andres Maduro" : "Ecuadorian Connecticut", "Connecticut Broadleaf", "Dominican Republic", "Medium-Full"),
      standardCigarSizeFromName(productName)
    );
  }

  if (/^KUBA KUBA FRESH PACK/.test(productName)) {
    return combineResearchDetails(
      researchedBlend("Nicaragua", "Sumatra", "Nicaragua", "Nicaragua", "Medium"),
      researchedSize("Assorted", "Assorted", "Assorted")
    );
  }

  if (/^ODYSSEY CONNECTICUT/.test(productName)) {
    return combineResearchDetails(
      researchedBlend("Honduras", "Connecticut Shade", "Honduras", "Honduras, Nicaragua", "Mild-Medium"),
      standardCigarSizeFromName(productName)
    );
  }

  if (/^OSCAR 2012 MADURO/.test(productName)) {
    return combineResearchDetails(
      researchedBlend("Honduras", "Mexican San Andres Maduro", "Honduran", "Honduran", "Medium-Full"),
      standardCigarSizeFromName(productName)
    );
  }

  if (/^ROMEO Y JULIETA 1875 ROTHCHILDE/.test(productName)) {
    return combineResearchDetails(
      researchedBlend("Dominican Republic", "Indonesian TBN", "Dominican Republic", "Dominican Republic", "Medium"),
      researchedSize("Rothchilde", '5"', "50")
    );
  }

  if (/^TATUAJE NEGOCIANT/.test(productName)) {
    return combineResearchDetails(
      researchedBlend("Nicaragua", "Ecuadorian Connecticut", "Nicaragua", "Nicaragua", "Medium"),
      researchedSize("No. 1", '6.5"', "48")
    );
  }

  if (/^THE UPSETTERS/.test(productName)) {
    return combineResearchDetails(
      researchedBlend("Nicaragua", "Connecticut Shade", "Nicaragua", "Nicaragua", "Medium"),
      researchedSize("Rock Steady", '7"', "48")
    );
  }

  if (/^BRIOSO/.test(productName)) {
    return combineResearchDetails(
      researchedBlend("Nicaragua", "Habano", "Nicaragua", "Nicaragua", "Medium"),
      standardCigarSizeFromName(productName)
    );
  }

  if (/^CASA MAGNA COLORADO/.test(productName)) {
    return combineResearchDetails(
      researchedBlend("Nicaragua", "Cuban-seed Colorado", "Nicaraguan", "Nicaraguan", "Medium-Full"),
      researchedSize("Robusto", '5.5"', "52")
    );
  }

  if (/^COHIBA PEQUENO/.test(productName)) {
    return researchedSize("Pequeno", '4.187"', "34");
  }

  if (/^COJIMAR/.test(productName)) {
    return combineResearchDetails(
      researchedBlend("Dominican Republic", "Connecticut Shade", "Dominican Republic", "Dominican Republic", "Mild"),
      researchedSize("Assorted", "Assorted", "Assorted")
    );
  }

  if (/^RYJ RESERVA REAL NICARAGUA/.test(productName)) {
    return combineResearchDetails(
      researchedBlend("Nicaragua", "Nicaraguan", "Nicaraguan", "Nicaraguan", "Medium-Full"),
      researchedSize("Magnum", '6"', "60")
    );
  }

  if (/^CHARTER OAK HABANO/.test(productName)) {
    return combineResearchDetails(
      researchedBlend("Nicaragua", "Ecuadorian Habano", "Nicaraguan", "Nicaraguan", "Medium"),
      standardCigarSizeFromName(productName)
    );
  }

  if (/^HOYO DE MONTERREY OSCURO/.test(productName)) {
    return combineResearchDetails(
      researchedBlend("Honduras", "Ecuadorian Sumatra Oscuro", "Connecticut Broadleaf", "Dominican Republic, Honduras, Nicaragua", "Medium-Full"),
      standardCigarSizeFromName(productName)
    );
  }

  if (/^RP VINTAGE 1990/.test(productName)) {
    return combineResearchDetails(
      researchedBlend("Honduras", "Honduran Broadleaf", "Nicaragua", "Dominican Republic, Nicaragua", "Mild-Medium"),
      researchedSize("Toro Tubo", '6"', "50")
    );
  }

  if (/^SANCHO PANZA EXTRA FUERTE/.test(productName)) {
    return combineResearchDetails(
      researchedBlend("Honduras", "Ecuadorian Sumatra", "Nicaragua", "Dominican Republic, Honduras, Nicaragua", "Medium-Full"),
      researchedSize("Toro", '6.25"', "54")
    );
  }

  if (/^TATASCAN CONNECTICUT/.test(productName)) {
    return combineResearchDetails(
      researchedBlend("Honduras", "Connecticut Shade", "Honduran", "Honduran", "Mild-Medium"),
      standardCigarSizeFromName(productName)
    );
  }

  if (/^TRINIDAD ESPIRITU SERIES 3/.test(productName)) {
    return combineResearchDetails(
      researchedBlend("Nicaragua", "Mexican San Andres", "Nicaragua", "Nicaragua", "Medium-Full"),
      standardCigarSizeFromName(productName)
    );
  }

  if (/^DARK STAR/.test(productName)) {
    return combineResearchDetails(
      researchedBlend("Nicaragua", "San Andres Maduro", "Nicaragua", "Nicaragua", "Medium-Full"),
      standardCigarSizeFromName(productName)
    );
  }

  if (/^EDGE 20TH ANNIVERSARY/.test(productName)) {
    return combineResearchDetails(
      researchedBlend("Nicaragua", "Ecuadorian Sumatra", "Nicaragua", "Nicaragua, Honduras", "Medium-Full"),
      standardCigarSizeFromName(productName)
    );
  }

  if (/^EPC ENCORE/.test(productName)) {
    return combineResearchDetails(
      researchedBlend("Nicaragua", "Nicaraguan", "Nicaraguan", "Nicaraguan", "Medium"),
      researchedSize("Majestic Robusto", '5.375"', "52")
    );
  }

  if (/^KNUCKLE SANDWICH HABANO/.test(productName)) {
    return combineResearchDetails(
      researchedBlend("Nicaragua", "Ecuadorian Habano", "Nicaraguan", "Nicaraguan", "Medium-Full"),
      standardCigarSizeFromName(productName)
    );
  }

  if (/^PLASENCIA ALMA FUERTE/.test(productName)) {
    return combineResearchDetails(
      researchedBlend("Nicaragua", "Nicaraguan", "Nicaraguan", "Nicaraguan", "Medium-Full"),
      researchedSize("Robustus I", '5.25"', "52")
    );
  }

  if (/^JOYA DE NICARAGUA ANTANO CT/.test(productName)) {
    return combineResearchDetails(
      researchedBlend("Nicaragua", "Ecuadorian Connecticut", "Nicaraguan", "Nicaraguan", "Medium-Full"),
      researchedSize("Assorted", "Assorted", "Assorted")
    );
  }

  return undefined;
}

function getResearchedLineEnrichment(item: ImportedInventoryItem) {
  const productName = item.product.toUpperCase();

  return combineResearchDetails(
    getFactorySmokesResearch(productName),
    getDrewEstateJavaResearch(productName),
    getAjFernandezResearch(productName),
    getArturoFuenteResearch(productName),
    getAshtonResearch(productName),
    getPerdomoResearch(productName),
    getOlivaResearch(productName),
    getMacanudoResearch(productName),
    getMontecristoResearch(productName),
    getRockyPatelResearch(productName),
    getRomeoResearch(productName),
    getTatianaResearch(productName),
    getQuorumResearch(productName),
    getCohibaResearch(productName),
    getJmsDominicanResearch(productName),
    getBrickHouseResearch(productName),
    getCamachoResearch(productName),
    getNubResearch(productName),
    getAsylumResearch(productName),
    getAgingRoomResearch(productName),
    getCaoResearch(productName),
    getPartagasResearch(productName),
    getFactoryThrowoutsResearch(productName),
    getTabakResearch(productName),
    getDeadwoodResearch(productName),
    getMyFatherFamilyResearch(productName),
    getAladinoResearch(productName),
    getTatuajeResearch(productName),
    getLaFamilyResearch(productName),
    getArturoFuenteRemainingResearch(productName),
    getGurkhaResearch(productName),
    getRockyPatelRemainingResearch(productName),
    getKarenBergerResearch(productName),
    getMyFatherRemainingResearch(productName),
    getLaGloriaRemainingResearch(productName),
    getMacanudoRemainingResearch(productName),
    getMontecristoRemainingResearch(productName),
    getPerlaDelMarResearch(productName),
    getBaccaratResearch(productName),
    getJoyaResearch(productName),
    getLeafByOscarResearch(productName),
    getSchizoResearch(productName),
    getHavanaQResearch(productName),
    getHoyoResearch(productName),
    getAvoResearch(productName),
    getUndercrownRemainingResearch(productName),
    getNicaRusticaResearch(productName),
    getCazadoresResearch(productName),
    getNewCubaResearch(productName),
    getRomeoRemainingResearch(productName),
    getDeepAuditRemainingResearch(productName)
  );
}

function toCatalogProduct(item: ImportedInventoryItem): CatalogProduct {
  const availability = getAvailability(item);
  const inferredPackage = inferPackage(item.product);
  const description = importedProductDescriptions[item.slug] ?? "";
  const parsedDetails = parseImportedProductDetails(item.product, description);
  const lineResearchDetails = getResearchedLineEnrichment(item);
  const researchedDetails = getResearchedCatalogEnrichment(item.slug);
  const category = getCatalogCategory(item);
  const pricing = calculateCatalogPricing({
    currentPrice: item.price,
    marketPrice: importedMarketPriceLookup[item.sku],
  });

  return applyEnrichment({
    id: `sku-${item.sku}-${item.slug}`,
    sku: item.sku,
    slug: item.slug,
    name: item.product,
    brand: inferBrand(item.product),
    category,
    price: item.price,
    marketPrice: pricing.marketPrice,
    nonMemberPrice: pricing.nonMemberPrice,
    memberPrice: pricing.memberPrice,
    description,
    packageLabel: inferredPackage.label,
    packageCount: inferredPackage.count,
    availability,
    sourceStatus: item.sourceStatus,
    managedStock: item.managedStock,
    sourceQuantity: item.sourceQuantity,
    image: getCatalogImageUrl(item.sku, category),
    imagePosition: "center",
    tags: getTags(item, availability, category),
    memberOnly: false,
    status: availability,
    publishStatus: "published",
    inventoryPolicy: item.managedStock ? "track" : "manual",
    shippable: true,
    adultSignatureRequired: true,
    stripeProductId: null,
    stripePriceId: null,
    storeHref: `/shop/${item.slug}/`,
    reviewSearchUrl: getReviewSearchUrl(item.product),
  }, { ...parsedDetails, ...lineResearchDetails, ...researchedDetails });
}

export const publishedImportedInventory = getPublishedImportedInventory(importedInventory);

export const catalogProducts = publishedImportedInventory.map(toCatalogProduct);

export const catalogCategories = Array.from(
  new Set(catalogProducts.map((product) => product.category))
).sort((left, right) => left.localeCompare(right));

export const luxuryCatalogProducts = catalogProducts.filter((product) => product.category === luxuryCategory);

function getDiverseFeaturedProducts(products: CatalogProduct[], limit: number) {
  const selectedProducts: CatalogProduct[] = [];
  const selectedBrands = new Set<string>();
  const specCompleteProducts = products.filter((product) => product.vitola && product.wrapper && product.strength);

  for (const product of specCompleteProducts) {
    if (selectedBrands.has(product.brand)) {
      continue;
    }

    selectedProducts.push(product);
    selectedBrands.add(product.brand);

    if (selectedProducts.length === limit) {
      return selectedProducts;
    }
  }

  const selectedProductIds = new Set(selectedProducts.map((product) => product.id));

  return [
    ...selectedProducts,
    ...products.filter((product) => !selectedProductIds.has(product.id)),
  ].slice(0, limit);
}

export const featuredLuxuryProducts = getDiverseFeaturedProducts(luxuryCatalogProducts, 4);

export const curatedBoxProducts: CatalogProduct[] = [];

export const storefrontProducts = [...curatedBoxProducts, ...catalogProducts];

export const storefrontProductCards = storefrontProducts.map(toCatalogListingProduct);

export const storefrontCategories = Array.from(
  new Set(storefrontProducts.map((product) => product.category))
).sort((left, right) => left.localeCompare(right));

export function toCatalogListingProduct(product: CatalogProduct): CatalogListingProduct {
  const { expertReview } = product;

  return {
    id: product.id,
    sku: product.sku,
    slug: product.slug,
    name: product.name,
    brand: product.brand,
    category: product.category,
    price: product.price,
    marketPrice: product.marketPrice,
    nonMemberPrice: product.nonMemberPrice,
    memberPrice: product.memberPrice,
    description: getListingDescription(product.description),
    packageLabel: product.packageLabel,
    availability: product.availability,
    image: product.image,
    imagePosition: product.imagePosition,
    tags: product.tags,
    memberOnly: product.memberOnly,
    status: product.status,
    vitola: product.vitola,
    length: product.length,
    gauge: product.gauge,
    strength: product.strength,
    expertReview: expertReview
      ? {
          sourceName: expertReview.sourceName,
          score: expertReview.score,
        }
      : undefined,
  };
}

function getListingDescription(description: string) {
  const normalizedDescription = description.replace(/\s+/g, " ").trim();

  if (normalizedDescription.length <= 180) {
    return normalizedDescription;
  }

  return `${normalizedDescription.slice(0, 177).trimEnd()}...`;
}

export function getCatalogProductBySlug(slug: string) {
  return catalogProducts.find((product) => product.slug === slug);
}

export function getStorefrontProductBySlug(slug: string) {
  return storefrontProducts.find((product) => product.slug === slug);
}

const catalogProductsBySkuOrId = new Map<string, CatalogProduct>();
for (const product of catalogProducts) {
  catalogProductsBySkuOrId.set(product.sku, product);
  catalogProductsBySkuOrId.set(product.id, product);
}

export function getCatalogProductBySkuOrId(identifier: string) {
  return catalogProductsBySkuOrId.get(identifier);
}

export function getCatalogProductDetails(product: CatalogProduct): CatalogProductDetails {
  const priceSignal = product.nonMemberPrice > 0 ? `${formatCatalogPrice(product.nonMemberPrice)} public catalog price` : "Price pending";
  const cigarSpecs = [
    product.vitola,
    product.length && `${product.length} length`,
    product.gauge && `${product.gauge} ring gauge`,
    product.strength && `${product.strength} strength`,
  ].filter(Boolean) as string[];
  const reviewSignal = product.expertReview
    ? [`${product.expertReview.score}-point ${product.expertReview.sourceName} review`]
    : product.reviewProfile
      ? ["Review details researched"]
      : [];

  return {
    summary: getCatalogProductDescription(product),
    signals: [product.category, product.packageLabel, product.availability, ...cigarSpecs, ...reviewSignal, priceSignal],
    availability: `Current source status is ${product.sourceStatus}. ${
      product.sourceQuantity === null
        ? "The source feed did not provide an exact quantity for this item."
        : `The source feed reports ${product.sourceQuantity} available.`
    }`,
    fulfillment: [
      "Age verification before checkout",
      "Adult signature required at delivery",
      "SKU matched across catalog and inventory",
    ],
    adminNote: `Use SKU ${product.sku} to reconcile this storefront item with imported inventory and image assets.`,
  };
}

export function getCatalogProductDescription(product: CatalogProduct) {
  const importedDescription = product.description.trim();

  if (importedDescription) {
    return importedDescription;
  }

  const productName = stripPackageFromName(product.name);
  const packageDescription = formatPackageForDescription(product.packageLabel);
  const availabilityText =
    product.availability === "Out of stock"
      ? "This item is currently out of stock."
      : product.availability === "Low stock"
        ? "Availability is limited, so add it to your cart while it is still in stock."
        : "It is available now for checkout with age verification and adult-signature delivery.";
  const priceText = product.nonMemberPrice > 0 ? ` Current public catalog price is ${formatCatalogPrice(product.nonMemberPrice)}.` : "";

  return `${productName} is part of the ${product.category} collection from ${product.brand} and is available as ${packageDescription}. ${availabilityText}${priceText}`;
}

function stripPackageFromName(productName: string) {
  return productName
    .replace(/\s+\d+\s*\/\s*(?:BX|BOX|B|CT|COUNT|PACK)\b/gi, "")
    .replace(/\s+BX\s*\/\s*\d+\b/gi, "")
    .replace(/\s+\d+\s*(?:BX|BOX|CT|COUNT|PACK)\b/gi, "")
    .replace(/\s+\d+\s*\/\s*\d+\s*TINS?\b/gi, "")
    .trim();
}

function formatPackageForDescription(packageLabel: string) {
  const lowerLabel = packageLabel.toLowerCase();

  if (/^(box|pack|tin|bundle|case|single)\b/.test(lowerLabel)) {
    return `a ${lowerLabel}`;
  }

  return packageLabel;
}
