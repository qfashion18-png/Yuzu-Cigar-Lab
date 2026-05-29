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
  "777287": "/assets/inventory/cigars/plasencia-explorer-sampler-6-bx.jpg",
  "777292": "/assets/inventory/cigars/oliva-serie-v-melanio-soccer-edition-24-bx.jpg",
  "777293": "/assets/inventory/cigars/my-father-don-pepin-clasicos-20th-20-bx.jpg",
  "777295": "/assets/inventory/cigars/plasencia-triunfal-2026-10-bx.jpg",
  "777296": "/assets/inventory/cigars/montecristo-1935-winners-club-sampler-6-pk.jpg",
  "777297": "/assets/inventory/cigars/olmec-maduro-toro-12-bx.jpg",
  "777303": "/assets/inventory/cigars/plasencia-alma-fuerte-salomon-10-bx.jpg",
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
  "olmec-maduro-toro-12-bx": {
    origin: "Nicaragua",
    wrapper: "Mexican San Andres Maduro",
    vitola: "Toro",
    length: '6"',
    gauge: "52",
    strength: "Medium-Full",
    filler: "Nicaragua",
    binder: "Nicaragua",
  },
  "montecristo-1935-winners-club-sampler-6-pk": {
    origin: "Nicaragua",
    wrapper: "Varies by selection",
    vitola: "Sampler",
    length: "Assorted",
    gauge: "Assorted",
    strength: "Medium-Full",
    filler: "Varies by selection",
    binder: "Varies by selection",
  },
  "plasencia-alma-fuerte-salomon-10-bx": {
    origin: "Nicaragua",
    wrapper: "Nicaraguan",
    vitola: "Salomon",
    length: '7"',
    gauge: "58",
    strength: "Medium-Full",
    filler: "Nicaragua",
    binder: "Nicaragua",
  },
  "plasencia-triunfal-2026-10-bx": {
    origin: "Honduras",
    wrapper: "Honduran",
    vitola: "Toro",
    length: '6.25"',
    gauge: "54",
    strength: "Medium",
    filler: "Honduras, Nicaragua",
    binder: "Honduras",
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
  return isCigarCategoryAndName(product.category, product.name);
}

function isCigarCategoryAndName(category: string, name: string) {
  const cigarCategoryPattern = /cigar|sample packs|premium cigars|mid-range cigars|budget cigars|luxury cigars|my cigars/i;
  const accessoryCategoryPattern = /lighter|torch|fluid|butane|humidor|membership|accessor|ashtray|cutter|display|book matches/i;
  const accessoryNamePattern = /lighter|torch|fluid|butane|humidor|membership|accessor|ashtray|display|book matches/i;

  if (accessoryCategoryPattern.test(category) && !cigarCategoryPattern.test(category)) {
    return false;
  }

  if (cigarCategoryPattern.test(category)) {
    return true;
  }

  return !accessoryNamePattern.test(name);
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

function sourcedRockyPatelReviewProfile(lineName: string, sourceUrl: string, rating: string, keyDetails: string[]) {
  return {
    reviewProfile: {
      summary: `${lineName} has source-backed line rating coverage from Rocky Patel's brand profile. Treat this as line-level coverage unless an exact vitola review is added later.`,
      sources: [
        {
          sourceName: "Rocky Patel",
          sourceUrl,
          rating,
          keyDetails,
        },
      ],
    },
  };
}

function sourcedArturoFuenteReviewProfile(
  lineName: string,
  sourceName: string,
  sourceUrl: string,
  rating: string,
  keyDetails: string[]
) {
  return {
    reviewProfile: {
      summary: `${lineName} has source-backed Arturo Fuente review coverage from ${sourceName}. Exact-product ratings are labeled directly; broader matches are line-level or customer-review coverage.`,
      sources: [
        {
          sourceName,
          sourceUrl,
          rating,
          keyDetails,
        },
      ],
    },
  };
}

function arturoFuenteCigarAficionadoProfile(lineName: string, sourceUrl: string, rating: string, keyDetails: string[]) {
  return sourcedArturoFuenteReviewProfile(lineName, "Cigar Aficionado", sourceUrl, rating, keyDetails);
}

function arturoFuenteNeptuneProfile(lineName: string, sourceUrl: string, rating: string, keyDetails: string[]) {
  return sourcedArturoFuenteReviewProfile(lineName, "Neptune Cigar", sourceUrl, rating, keyDetails);
}

function sourcedBrandReviewProfile(
  brandName: string,
  lineName: string,
  sourceName: string,
  sourceUrl: string,
  rating: string,
  keyDetails: string[]
) {
  return {
    reviewProfile: {
      summary: `${lineName} has source-backed ${brandName} Ratings & Reviews coverage from ${sourceName}. Exact-product and line-level matches are labeled in the source rating.`,
      sources: [
        {
          sourceName,
          sourceUrl,
          rating,
          keyDetails,
        },
      ],
    },
  };
}

function getOlivaReviewProfile(productName: string) {
  if (/CONNECTICUT RESERVE/.test(productName)) {
    return sourcedBrandReviewProfile(
      "Oliva",
      "Oliva Connecticut Reserve",
      "Cigar Aficionado",
      "https://www.cigaraficionado.com/rating/oliva-connecticut-reserve-churchill",
      "92 Cigar Aficionado Churchill line-reference rating",
      [
        "Cigar Aficionado rates the Connecticut Reserve Churchill at 92 points.",
        "The page identifies the blend as Ecuador-wrapped with Nicaraguan binder and filler.",
        "Use this as Connecticut Reserve line coverage for non-Churchill formats until exact vitola reviews are added.",
      ]
    );
  }

  if (/SERIE G/.test(productName) || /\bOLIVA G\b/.test(productName)) {
    if (/MADURO/.test(productName) && /SPECIAL G/.test(productName)) {
      return sourcedBrandReviewProfile(
        "Oliva",
        "Oliva Serie G Maduro Special G",
        "Cigar Aficionado",
        "https://www.cigaraficionado.com/ratings/25003/name/oliva-serie-g-maduro-special-g-figurado",
        "91 Cigar Aficionado exact review",
        [
          "Cigar Aficionado rates the Serie G Maduro Special G at 91 points.",
          "The page identifies the small figurado format and Mexican-wrapper Maduro profile.",
          "Visible tasting notes emphasize leather, earth, graham cracker, and honey.",
        ]
      );
    }

    if (/MADURO/.test(productName)) {
      return sourcedBrandReviewProfile(
        "Oliva",
        "Oliva Serie G Maduro",
        "Cigar Aficionado",
        "https://www.cigaraficionado.com/ratings/18666/name/oliva-serie-g-maduro-robusto-robusto",
        "89 Cigar Insider listed review",
        [
          "Cigar Aficionado's Serie G Maduro Robusto page lists an 89-point Cigar Insider review.",
          "The page identifies the Maduro Robusto as a Nicaraguan cigar with a dark wrapper.",
          "Use this as Maduro line coverage for other Serie G Maduro formats.",
        ]
      );
    }

    return sourcedBrandReviewProfile(
      "Oliva",
      "Oliva Serie G",
      "Cigar Aficionado",
      "https://www.cigaraficionado.com/ratings/25279/name/oliva-serie-g-robusto-robusto",
      "93 Cigar Aficionado line-reference rating",
      [
        "Cigar Aficionado rates the Serie G Robusto at 93 points.",
        "The page identifies the Cameroon-wrapped Nicaraguan Serie G profile.",
        "Use this as Serie G Natural line coverage for non-Robusto formats and the Serie G sampler.",
      ]
    );
  }

  if (/SERIE O/.test(productName)) {
    if (/MADURO/.test(productName)) {
      return sourcedBrandReviewProfile(
        "Oliva",
        "Oliva Serie O Maduro",
        "Cigar Aficionado",
        "https://www.cigaraficionado.com/ratings/14347/name/oliva-serie-o-maduro-robusto",
        "88 Cigar Aficionado Robusto line-reference rating",
        [
          "Cigar Aficionado rates the Serie O Maduro Robusto at 88 points and lists additional 90-point review history.",
          "The page identifies the cigar as a Nicaraguan Maduro using Nicaraguan binder and filler.",
          "Use this as Serie O Maduro line coverage for Churchill, Double Toro, Robusto, and related formats.",
        ]
      );
    }

    return sourcedBrandReviewProfile(
      "Oliva",
      "Oliva Serie O",
      "Cigar Aficionado",
      "https://www.cigaraficionado.com/ratings/16472/name/oliva-serie-o-churchill-churchill",
      "92 Cigar Aficionado Churchill line-reference rating",
      [
        "Cigar Aficionado rates the Serie O Churchill at 92 points and lists later high-scoring reviews.",
        "The page identifies the line as a Nicaraguan puro.",
        "Use this as Serie O Natural line coverage for non-Churchill formats.",
      ]
    );
  }

  if (/MELANIO/.test(productName)) {
    if (/MADURO/.test(productName) && /ROBUSTO/.test(productName)) {
      return sourcedBrandReviewProfile(
        "Oliva",
        "Oliva Serie V Melanio Maduro Robusto",
        "Cigar Aficionado",
        "https://www.cigaraficionado.com/ratings/26704/name/oliva-serie-v-melanio-maduro-robusto-robusto",
        "94 Cigar Aficionado exact review",
        [
          "Cigar Aficionado rates the Melanio Maduro Robusto at 94 points.",
          "The page identifies the Maduro line as Mexican-wrapped with Nicaraguan binder and filler.",
          "Visible tasting notes emphasize dark chocolate, raisin, caramel, and mineral character.",
        ]
      );
    }

    if (/MADURO/.test(productName)) {
      return sourcedBrandReviewProfile(
        "Oliva",
        "Oliva Serie V Melanio Maduro",
        "Cigar Aficionado",
        "https://www.cigaraficionado.com/ratings/26237/name/oliva-serie-v-melanio-maduro-figurado-figurado",
        "92 Cigar Aficionado Melanio Maduro Figurado line-reference rating",
        [
          "Cigar Aficionado rates the Melanio Maduro Figurado at 92 points.",
          "The page identifies the Maduro blend as Mexican-wrapped with Nicaraguan binder and filler.",
          "Use this as Melanio Maduro line coverage for non-Robusto Maduro formats.",
        ]
      );
    }

    if (/ROBUSTO/.test(productName)) {
      return sourcedBrandReviewProfile(
        "Oliva",
        "Oliva Serie V Melanio Robusto",
        "Cigar Aficionado",
        "https://www.cigaraficionado.com/ratings/19454/name/oliva-serie-v-melanio-robusto",
        "94 Cigar Aficionado exact review",
        [
          "Cigar Aficionado rates the Melanio Robusto at 94 points.",
          "The page identifies the blend as Ecuador Sumatra over Nicaraguan binder and filler.",
          "Visible review context references the Melanio Figurado's Cigar of the Year history.",
        ]
      );
    }

    if (/FIGURADO/.test(productName)) {
      return sourcedBrandReviewProfile(
        "Oliva",
        "Oliva Serie V Melanio Figurado",
        "Cigar Aficionado",
        "https://www.cigaraficionado.com/ratings/17587/name/oliva-serie-v-melanio-figurado-figurado",
        "96 Cigar Aficionado Cigar of the Year exact review",
        [
          "Cigar Aficionado's Melanio Figurado page anchors the 96-point Cigar of the Year profile.",
          "The source identifies the Figurado as a Nicaraguan Melanio format.",
          "Use exact Figurado coverage for the matching box-pressed format.",
        ]
      );
    }

    if (/TORO|DOUBLE TORO|DBL TORO/.test(productName)) {
      return sourcedBrandReviewProfile(
        "Oliva",
        "Oliva Serie V Melanio Toro",
        "Cigar Aficionado",
        "https://www.cigaraficionado.com/top25cigar/oliva-serie-v-melanio-toro-2023",
        "96 Cigar Aficionado Top 25 Toro line-reference rating",
        [
          "Cigar Aficionado ranked the Melanio Toro third in the 2023 Top 25 with a 96-point rating.",
          "The page identifies the blend as Ecuador-wrapper Melanio with Nicaraguan binder and filler.",
          "Use this as line coverage for Toro and Double Toro Melanio formats.",
        ]
      );
    }

    return sourcedBrandReviewProfile(
      "Oliva",
      "Oliva Serie V Melanio",
      "Oliva Cigars",
      "https://olivacigar.com/cigars/serie-v-melanio/",
      "96 Oliva brand-cited Cigar Aficionado rating",
      [
        "Oliva's Melanio profile cites the 2014 Cigar of the Year recognition and a 96-point Cigar Aficionado rating.",
        "The page lists Melanio sizes including Churchill, Double Toro, Figurado, Torpedo, Toro, and Robusto.",
        "Use this as brand-profile coverage for Melanio formats without a more specific page.",
      ]
    );
  }

  if (/SERIE V/.test(productName)) {
    if (/MADURO/.test(productName)) {
      return sourcedBrandReviewProfile(
        "Oliva",
        "Oliva Serie V Maduro",
        "Cigar Aficionado",
        "https://www.cigaraficionado.com/ratings/21757/name/oliva-serie-v-maduro-double-robusto-robusto",
        "88 Cigar Aficionado Double Robusto line-reference rating",
        [
          "Cigar Aficionado rates the Serie V Maduro Double Robusto at 88 points.",
          "The page identifies the Mexican-wrapper Maduro variant with Nicaraguan binder and filler.",
          "Use this as Serie V Maduro line coverage for Double Toro, Toro, and Torpedo formats.",
        ]
      );
    }

    return sourcedBrandReviewProfile(
      "Oliva",
      "Oliva Serie V",
      "Cigar Aficionado",
      "https://www.cigaraficionado.com/ratings/14124/name/oliva-serie-v-torpedo-figurado",
      "93 Cigar Aficionado Torpedo line-reference rating",
      [
        "Cigar Aficionado rates the Serie V Torpedo at 93 points and notes Top 25 recognition.",
        "The page identifies Serie V as an all-Nicaraguan blend with a high-priming wrapper.",
        "Use this as Serie V line coverage for non-Torpedo formats until exact vitola reviews are added.",
      ]
    );
  }

  return undefined;
}

function getRomeoReviewProfile(productName: string) {
  if (/SAMPLER|FRESH PACK/.test(productName)) {
    return sourcedBrandReviewProfile(
      "Romeo",
      "Romeo y Julieta Sampler",
      "Cigar Aficionado",
      "https://www.cigaraficionado.com/ratings/24412/name/romeo-y-julieta-1875-bully-robusto",
      "89 Cigar Aficionado component-line reference",
      [
        "Cigar Aficionado rates the Romeo y Julieta 1875 Bully at 89 points.",
        "Use this as component-line review coverage for Romeo sampler packs.",
        "The sampler is not presented as having a single blended review score.",
      ]
    );
  }

  if (/RESERVA REAL/.test(productName)) {
    return sourcedBrandReviewProfile(
      "Romeo",
      "Romeo y Julieta Reserva Real",
      "Cigar Aficionado",
      "https://www.cigaraficionado.com/ratings/8963/name/romeo-y-julieta-reserva-real-robusto",
      "90 Cigar Insider listed review",
      [
        "Cigar Aficionado's Reserva Real Robusto page lists a 90-point Cigar Insider review.",
        "The page identifies the blend as Ecuador-wrapper with Dominican and Nicaraguan tobaccos.",
        "Use this as Reserva Real line coverage for non-Robusto sizes and the Twisted Toro.",
      ]
    );
  }

  if (/1875/.test(productName) && /CONN\.?NICARAGUA|CONNECTICUT NICARAGUA/.test(productName)) {
    return sourcedBrandReviewProfile(
      "Romeo",
      "Romeo y Julieta 1875 Connecticut Nicaragua",
      "Cigar Aficionado",
      "https://www.cigaraficionado.com/brand/romeo-y-julieta-non-cuban",
      "Cigar Aficionado brand-profile line coverage",
      [
        "Cigar Aficionado's non-Cuban Romeo y Julieta brand page groups the modern Romeo product lines and ratings database.",
        "Use this as brand-profile coverage for the Connecticut Nicaragua offshoot until exact ratings are added.",
        "The profile is line coverage rather than an exact vitola score.",
      ]
    );
  }

  if (/1875 NICARAGUA/.test(productName)) {
    return sourcedBrandReviewProfile(
      "Romeo",
      "Romeo y Julieta 1875 Nicaragua",
      "Cigar Aficionado",
      "https://www.cigaraficionado.com/brand/romeo-y-julieta-non-cuban",
      "Cigar Aficionado brand-profile line coverage",
      [
        "Cigar Aficionado's non-Cuban Romeo y Julieta page groups current Romeo lines with ratings and articles.",
        "Use this as Nicaragua line coverage until exact 1875 Nicaragua ratings are added.",
        "The source is a brand-profile reference, not an exact product score.",
      ]
    );
  }

  if (/1875/.test(productName)) {
    if (/NO\.?2|BELICOSO|NUMERO DOS/.test(productName)) {
      return sourcedBrandReviewProfile(
        "Romeo",
        "Romeo y Julieta 1875 Belicoso",
        "Cigar Aficionado",
        "https://www.cigaraficionado.com/ratings/25590/name/romeo-y-julieta-1875-belicoso-figurado",
        "91 Cigar Aficionado exact or line-reference rating",
        [
          "Cigar Aficionado rates the 1875 Belicoso at 91 points.",
          "The page identifies the Indonesian-wrapper Dominican 1875 blend.",
          "Use exact coverage for Belicoso formats and line-reference coverage for related No. 2/Numero Dos items.",
        ]
      );
    }

    if (/CHURCHILL/.test(productName)) {
      return sourcedBrandReviewProfile(
        "Romeo",
        "Romeo y Julieta 1875 Churchill",
        "Cigar Aficionado",
        "https://www.cigaraficionado.com/ratings/19397/name/romeo-y-julieta-1875-churchill-churchill",
        "88 Cigar Aficionado exact review",
        [
          "Cigar Aficionado rates the 1875 Churchill at 88 points.",
          "The page identifies the Churchill as Indonesian-wrapper Dominican 1875.",
          "Visible notes emphasize bread, toast, wood, and a faint fruit finish.",
        ]
      );
    }

    if (/CLEMENCEAU/.test(productName)) {
      return sourcedBrandReviewProfile(
        "Romeo",
        "Romeo y Julieta 1875 Clemenceau",
        "Cigar Aficionado",
        "https://www.cigaraficionado.com/ratings/10001/name/romeo-y-julieta-1875-clemenceaus-en-tubo",
        "88 Cigar Aficionado exact review",
        [
          "Cigar Aficionado rates the 1875 Clemenceau en Tubo at 88 points.",
          "The page identifies the cigar as a Dominican Romeo y Julieta with Indonesian wrapper.",
          "Use exact coverage for Clemenceau tubo products.",
        ]
      );
    }

    return sourcedBrandReviewProfile(
      "Romeo",
      "Romeo y Julieta 1875 Bully",
      "Cigar Aficionado",
      "https://www.cigaraficionado.com/ratings/24412/name/romeo-y-julieta-1875-bully-robusto",
      "89 Cigar Aficionado exact review",
      [
        "Cigar Aficionado rates the 1875 Bully at 89 points.",
        "The page identifies the cigar as an Indonesian-wrapper Dominican Robusto.",
        "Use this as 1875 line coverage for closely related non-Belicoso, non-Churchill, and non-Clemenceau formats.",
      ]
    );
  }

  if (/RESERVE/.test(productName)) {
    return sourcedBrandReviewProfile(
      "Romeo",
      "Romeo y Julieta Reserve",
      "Cigar Aficionado",
      "https://www.cigaraficionado.com/search?q=Romeo+y+Julieta+Reserve",
      "90 Cigar Aficionado search-listed Reserve Robusto rating",
      [
        "Cigar Aficionado search results list Romeo y Julieta Reserve Robusto at 90 points.",
        "The source also lists Reserve Churchill and Titan rating entries.",
        "Use this as Reserve line coverage until direct rating pages are added.",
      ]
    );
  }

  if (/ROMEO BY RYJ|ROMEO BY ROMEO|GRAN TORO|150TH/.test(productName)) {
    return sourcedBrandReviewProfile(
      "Romeo",
      "Romeo by Romeo y Julieta",
      "Cigar Aficionado",
      "https://www.cigaraficionado.com/search?q=Romeo+By+Romeo+y+Julieta",
      "Cigar Aficionado Romeo by Romeo search-profile coverage",
      [
        "Cigar Aficionado search results surface Romeo by Romeo y Julieta rating coverage.",
        "Use this as line-profile coverage for Romeo by Romeo, Gran Toro, and 150th Anniversary formats.",
        "The source is broader search-profile coverage rather than an exact vitola score.",
      ]
    );
  }

  if (/HABANA RESV|HABANA RESERVE/.test(productName)) {
    return sourcedBrandReviewProfile(
      "Romeo",
      "Romeo y Julieta Habana Reserve",
      "Cigar Aficionado",
      "https://www.cigaraficionado.com/ratings/12378/name/romeo-y-julieta-habana-reserve-toro",
      "Cigar Aficionado Habana Reserve Toro listed review",
      [
        "Cigar Aficionado's Habana Reserve Toro page provides review coverage for the line.",
        "The page identifies the richer Habana Reserve profile with coffee, fruit, wood, and spice notes.",
        "Use this as line coverage for Amores and other small-format Habana Reserve products.",
      ]
    );
  }

  if (/VINTAGE|SPAIN MINI/.test(productName)) {
    return sourcedBrandReviewProfile(
      "Romeo",
      "Romeo y Julieta small-format and Vintage lines",
      "Cigar Aficionado",
      "https://www.cigaraficionado.com/brand/romeo-y-julieta-non-cuban",
      "Cigar Aficionado brand-profile line coverage",
      [
        "Cigar Aficionado's non-Cuban Romeo y Julieta brand page provides source-backed ratings and article context for the brand.",
        "Use this as brand-profile coverage for small-format and Vintage products without exact public review pages.",
        "The profile is not presented as an exact score for these formats.",
      ]
    );
  }

  return undefined;
}

function getPerdomoReviewProfile(productName: string) {
  if (/4 PACK|SAMPLER/.test(productName)) {
    return sourcedBrandReviewProfile(
      "Perdomo",
      "Perdomo humidified sampler",
      "Perdomo Cigars",
      "https://www.perdomocigars.com/",
      "Perdomo official brand and line profile coverage",
      [
        "Perdomo's official site groups the 10th Anniversary, Habano Bourbon Barrel-Aged, Lot 23, and sampler-style offerings.",
        "Use this as brand/line component coverage for mixed Perdomo packs.",
        "Sampler packs are not presented as having one blended score.",
      ]
    );
  }

  if (/10TH ANN.*CHAMPAGNE/.test(productName)) {
    return sourcedBrandReviewProfile(
      "Perdomo",
      "Perdomo 10th Anniversary Champagne Connecticut",
      "Cigar Aficionado",
      "https://www.cigaraficionado.com/ratings/22176/name/perdomo-reserve-10th-anniversary-champagne-connecticut-torpedo-figurado",
      "89 Cigar Aficionado exact review",
      [
        "Cigar Aficionado rates the Champagne Connecticut Torpedo at 89 points.",
        "The page identifies the blend as Ecuador Connecticut over Nicaraguan binder and filler.",
        "Use this as 10th Anniversary Champagne line coverage for non-Torpedo sizes.",
      ]
    );
  }

  if (/20TH ANN/.test(productName)) {
    return sourcedBrandReviewProfile(
      "Perdomo",
      "Perdomo 20th Anniversary Connecticut",
      "Cigar Aficionado",
      "https://www.cigaraficionado.com/ratings/24297/name/perdomo-20th-anniversary-connecticut-gordo-grande",
      "88 Cigar Aficionado line-reference rating",
      [
        "Cigar Aficionado rates the 20th Anniversary Connecticut Gordo at 88 points.",
        "The page identifies the blend as Ecuador Connecticut over Nicaraguan binder and filler.",
        "Use this as 20th Anniversary Connecticut line coverage for Epicure and Gordo products.",
      ]
    );
  }

  if (/HABANO/.test(productName)) {
    if (/CONN/.test(productName)) {
      return sourcedBrandReviewProfile(
        "Perdomo",
        "Perdomo Habano Bourbon Barrel-Aged Connecticut",
        "Cigar Aficionado",
        "https://www.cigaraficionado.com/ratings/20351/name/perdomo-habano-bourbon-barrel-aged-connecticut-gordo-grande",
        "88 Cigar Aficionado line-reference rating",
        [
          "Cigar Aficionado rates the Habano Bourbon Barrel-Aged Connecticut Gordo at 88 points.",
          "The page identifies the blend as Ecuador Connecticut over Nicaraguan binder and filler.",
          "Use this as Habano Connecticut line coverage for Churchill, Epicure, Gordo, and Robusto formats.",
        ]
      );
    }

    if (/MADURO/.test(productName)) {
      return sourcedBrandReviewProfile(
        "Perdomo",
        "Perdomo Habano Bourbon Barrel-Aged Maduro",
        "Cigar Aficionado",
        "https://www.cigaraficionado.com/ratings/19410/name/perdomo-habano-bourbon-barrel-aged-maduro-robusto-robusto",
        "88 Cigar Aficionado exact or line-reference rating",
        [
          "Cigar Aficionado rates the Habano Bourbon Barrel-Aged Maduro Robusto at 88 points.",
          "The page identifies the Maduro blend as Nicaraguan wrapper, binder, and filler.",
          "Use exact coverage for Robusto and line coverage for Churchill, Epicure, Gordo, and Torpedo formats.",
        ]
      );
    }

    return sourcedBrandReviewProfile(
      "Perdomo",
      "Perdomo Habano Bourbon Barrel-Aged Sun Grown",
      "Perdomo Cigars",
      "https://www.perdomocigars.com/habano-bourbon-barrel-aged",
      "Perdomo official ratings-and-awards profile",
      [
        "Perdomo's official Habano Bourbon Barrel-Aged page describes the Sun Grown wrapper aging and blend profile.",
        "The page lists the Churchill, Epicure, Gordo, Robusto, and Torpedo sizes.",
        "Use this as official line-profile coverage until exact Sun Grown ratings are added.",
      ]
    );
  }

  if (/INMENSO/.test(productName)) {
    return sourcedBrandReviewProfile(
      "Perdomo",
      "Perdomo Inmenso Seventy",
      "Neptune Cigar",
      "https://www.neptunecigar.com/cigar/perdomo-inmenso-seventy-maduro",
      "4.31/5 from 69 Neptune customer reviews",
      [
        "Neptune lists Perdomo Inmenso Seventy Maduro with a 4.31 overall customer rating from 69 reviews.",
        "The page identifies the 70-ring Maduro line and customer comments on the large-format smoke.",
        "Use this as customer-review line coverage for Maduro and Sun Grown Inmenso formats.",
      ]
    );
  }

  if (/LOT 23/.test(productName)) {
    if (/MADURO/.test(productName)) {
      return sourcedBrandReviewProfile(
        "Perdomo",
        "Perdomo Lot 23 Maduro",
        "Cigar Aficionado",
        "https://www.cigaraficionado.com/ratings/14640/name/perdomo-lot-23-maduro-gordito-odd",
        "89 Cigar Aficionado line-reference rating",
        [
          "Cigar Aficionado rates the Lot 23 Maduro Gordito at 89 points.",
          "The page identifies the Maduro line as a Nicaraguan Perdomo Lot 23 cigar.",
          "Use this as Lot 23 Maduro line coverage for Churchill, Robusto, and Toro products.",
        ]
      );
    }

    return sourcedBrandReviewProfile(
      "Perdomo",
      "Perdomo Lot 23",
      "Cigar Aficionado",
      "https://www.cigaraficionado.com/ratings/21596/name/perdomo-lot-23-robusto",
      "90 Cigar Aficionado exact or line-reference rating",
      [
        "Cigar Aficionado rates the Lot 23 Robusto at 90 points.",
        "The page identifies the line as Nicaraguan with Nicaraguan wrapper, binder, and filler.",
        "Use exact coverage for Robusto and line coverage for Churchill and Toro natural formats.",
      ]
    );
  }

  if (/RESERVE MADURO/.test(productName)) {
    return sourcedBrandReviewProfile(
      "Perdomo",
      "Perdomo Reserve Maduro",
      "Perdomo Cigars",
      "https://www.perdomocigars.com/10th-anniversary",
      "Perdomo official Reserve Maduro ratings-and-awards profile",
      [
        "Perdomo's 10th Anniversary page describes the Maduro reserve profile and its ratings-and-awards section.",
        "The page identifies Maduro sizes including Robusto, Epicure, Super Toro, and Churchill.",
        "Use this as official line-profile coverage until exact Reserve Maduro ratings are added.",
      ]
    );
  }

  return undefined;
}

function getMacanudoReviewProfile(productName: string) {
  if (/SAMPLER/.test(productName)) {
    return sourcedBrandReviewProfile(
      "Macanudo",
      "Macanudo Inspirado sampler",
      "Neptune Cigar",
      "https://www.neptunecigar.com/cigar/macanudo-inspirado-orange",
      "4.39/5 from 212 Neptune customer reviews",
      [
        "Neptune lists Macanudo Inspirado Orange with a 4.39 overall rating from 212 customer reviews.",
        "Use this as component-line customer coverage for Inspirado sampler packs.",
        "Sampler packs are not presented as having one blended score.",
      ]
    );
  }

  if (/GOLD/.test(productName)) {
    return sourcedBrandReviewProfile(
      "Macanudo",
      "Macanudo Gold Label",
      "Neptune Cigar",
      "https://www.neptunecigar.com/cigar/macanudo-gold-label",
      "4.56/5 from 50 Neptune customer reviews",
      [
        "Neptune lists Macanudo Gold Label with a 4.56 overall customer rating from 50 reviews.",
        "The page groups Gold Label sizes including Crystal and Ascot-related small formats.",
        "Visible customer themes emphasize smooth, mild, mellow, creamy, and easy-smoking traits.",
      ]
    );
  }

  if (/CAFE|ASCOT|CRYSTAL CAFE|ROTHSCHILD|MINIATURES/.test(productName) && !/INSPIRADO/.test(productName)) {
    if (/HYDE PARK/.test(productName)) {
      return sourcedBrandReviewProfile(
        "Macanudo",
        "Macanudo Cafe Hyde Park",
        "Cigar Aficionado",
        "https://www.cigaraficionado.com/ratings/14291/name/macanudo-cafe-hyde-park-toro",
        "90 Cigar Aficionado exact review",
        [
          "Cigar Aficionado rates the Macanudo Cafe Hyde Park at 90 points and notes Top 25 recognition.",
          "The page identifies Hyde Park as a classic mild Macanudo Cafe format.",
          "Visible review context emphasizes consistency, mildness, vanilla, bread, and sweet spice.",
        ]
      );
    }

    return sourcedBrandReviewProfile(
      "Macanudo",
      "Macanudo Cafe",
      "Neptune Cigar",
      "https://www.neptunecigar.com/cigar/macanudo-cafe",
      "4.43/5 from 262 Neptune customer reviews",
      [
        "Neptune lists Macanudo Cafe with a 4.43 overall customer rating from 262 reviews.",
        "The page groups Cafe sizes including Ascots, Baron de Rothschild, Court, Crystal, Hyde Park, Portofino, and related formats.",
        "Visible customer themes emphasize sweet, smooth, mild, mellow, creamy, and good-construction impressions.",
      ]
    );
  }

  if (/INSPIRADO WHITE/.test(productName)) {
    return sourcedBrandReviewProfile(
      "Macanudo",
      "Macanudo Inspirado White",
      "Cigar Aficionado",
      "https://www.cigaraficionado.com/ratings/20283/name/macanudo-inspirado-white-robusto-robusto",
      "87 Cigar Insider Robusto line-reference rating",
      [
        "Cigar Aficionado's Inspirado White Robusto page lists an 87-point Cigar Insider review.",
        "The page identifies the blend as Ecuador Connecticut over Indonesian binder and Mexican/Nicaraguan filler.",
        "Use this as Inspirado White line coverage for Churchill, cigarillo, mini, Robusto, Toro, and tubo formats.",
      ]
    );
  }

  if (/INSPIRADO BLACK/.test(productName)) {
    return sourcedBrandReviewProfile(
      "Macanudo",
      "Macanudo Inspirado Black",
      "Cigar Aficionado",
      "https://www.cigaraficionado.com/article/macanudo-inspirado-going-black-and-white-19474",
      "Cigar Aficionado Inspirado Black line article profile",
      [
        "Cigar Aficionado's Inspirado Black and White article identifies Inspirado Black sizes and the Broadleaf-led blend.",
        "The article describes Robusto, Toro, and Churchill sizes for the Black line.",
        "Use this as line-profile coverage until exact Inspirado Black ratings are added.",
      ]
    );
  }

  if (/INSPIRADO GREEN/.test(productName)) {
    return sourcedBrandReviewProfile(
      "Macanudo",
      "Macanudo Inspirado Green",
      "Cigar Aficionado",
      "https://www.cigaraficionado.com/rating/macanudo-inspirado-green-toro",
      "91 Cigar Aficionado Toro line-reference rating",
      [
        "Cigar Aficionado rates the Inspirado Green Toro at 91 points.",
        "The page identifies the Brazilian-wrapper Green blend with Dominican and Colombian filler.",
        "Use this as Inspirado Green line coverage for Robusto and Toro formats.",
      ]
    );
  }

  if (/INSPIRADO ORANGE/.test(productName)) {
    if (/ROBUSTO/.test(productName)) {
      return sourcedBrandReviewProfile(
        "Macanudo",
        "Macanudo Inspirado Orange Robusto",
        "Cigar Aficionado",
        "https://www.cigaraficionado.com/ratings/19007/name/macanudo-inspirado-orange-robusto-robusto",
        "90 Cigar Aficionado exact review",
        [
          "Cigar Aficionado rates Inspirado Orange Robusto at 90 points.",
          "The page identifies the Honduran-wrapper blend with Dominican, Honduran, and Nicaraguan filler.",
          "Visible tasting notes emphasize caramel, maple, and char.",
        ]
      );
    }

    return sourcedBrandReviewProfile(
      "Macanudo",
      "Macanudo Inspirado Orange",
      "Neptune Cigar",
      "https://www.neptunecigar.com/cigar/macanudo-inspirado-orange",
      "4.39/5 from 212 Neptune customer reviews",
      [
        "Neptune lists Inspirado Orange with a 4.39 overall rating from 212 customer reviews.",
        "The page groups Churchill, Gigante, Minis, Robusto, Toro, and sampler coverage.",
        "Visible customer themes emphasize smooth, good flavor, sweetness, creaminess, and citrus/orange impressions.",
      ]
    );
  }

  if (/INSPIRADO RED/.test(productName)) {
    return sourcedBrandReviewProfile(
      "Macanudo",
      "Macanudo Inspirado Red",
      "Cigar Aficionado",
      "https://www.cigaraficionado.com/ratings/20426/name/macanudo-inspirado-red-robusto-robusto",
      "86 Cigar Insider Robusto line-reference rating",
      [
        "Cigar Aficionado's Inspirado Red Robusto page lists an 86-point Cigar Insider review.",
        "The page identifies the Ecuador Habano wrapper with Nicaraguan binder and Nicaraguan/Honduran filler.",
        "Use this as Inspirado Red line coverage for Gigante, Minis, Robusto, and Toro formats.",
      ]
    );
  }

  if (/\bM ESPRESSO W\/ CREAM\b|M ESPRESSO/.test(productName)) {
    return sourcedBrandReviewProfile(
      "Macanudo",
      "M by Macanudo Espresso with Cream",
      "Neptune Cigar",
      "https://www.neptunecigar.com/cigar/m-by-macanudo-espresso",
      "Neptune customer-review product page",
      [
        "Neptune's M by Macanudo Espresso page provides customer-review coverage for the flavored Espresso line.",
        "Use this as retailer/customer coverage for the Espresso with Cream Toro.",
        "The source is not presented as an expert score.",
      ]
    );
  }

  return undefined;
}

function getTatianaReviewProfile(productName: string) {
  if (/MINI|TINS/.test(productName)) {
    return sourcedBrandReviewProfile(
      "Tatiana",
      "Tatiana Mini Tins",
      "Cigars International",
      "https://www.cigarsinternational.com/p/Tatiana-Flavored-Cigarillos/2003029/",
      "4.76/5 from 152 Cigars International customer ratings",
      [
        "Cigars International lists Tatiana Flavored Cigarillos at 4.76 out of 5 from 152 customer ratings.",
        "Use this as customer-review coverage for Tatiana tins and mini cigarillo formats.",
        "The source is retailer/customer coverage rather than an expert review.",
      ]
    );
  }

  if (/CHERRY/.test(productName)) {
    return sourcedBrandReviewProfile(
      "Tatiana",
      "Tatiana Cherry",
      "Neptune Cigar",
      "https://www.neptunecigar.com/cigar/tatiana-cherry",
      "4.37/5 from 111 Neptune customer reviews",
      [
        "Neptune lists Tatiana Cherry with a 4.37 overall customer rating from 111 reviews.",
        "The page groups Classic Corona, Dolce, Miniatures, and sampler reviews for the Cherry flavor.",
        "Visible customer themes emphasize sweet, smooth, mild, favorite, and easy-smoking impressions.",
      ]
    );
  }

  if (/VANILLA/.test(productName)) {
    return sourcedBrandReviewProfile(
      "Tatiana",
      "Tatiana Vanilla",
      "Neptune Cigar",
      "https://www.neptunecigar.com/cigar/tatiana-vanilla",
      "4.48/5 from 188 Neptune customer reviews",
      [
        "Neptune lists Tatiana Vanilla with a 4.48 overall customer rating from 188 reviews.",
        "The page groups Classic Corona, Dolce, sampler, and related Vanilla reviews.",
        "Visible customer themes emphasize vanilla, smooth, sweet, good flavor, mild, and favorite impressions.",
      ]
    );
  }

  return sourcedBrandReviewProfile(
    "Tatiana",
    "Tatiana infused cigar lines",
    "Cigars.com",
    "https://www.cigars.com/cigars/handmade-cigars/tatiana-cigars/",
    "4.3/5 from 19 Cigars.com customer reviews",
    [
      "Cigars.com lists the Tatiana brand page with a 4.3 average customer review from 19 reviews.",
      "The page groups Tatiana Classic, Classic Trio, Dolce, La Vita, Mini Tins, Robusto, and Trios Petite formats.",
      "Use this as broad customer-review coverage for Tatiana flavors without exact Neptune review pages.",
    ]
  );
}

function getGurkhaReviewProfile(productName: string) {
  if (/CELLAR RESV 12YR PLATINUM/.test(productName)) {
    return sourcedBrandReviewProfile(
      "Gurkha",
      "Gurkha Cellar Reserve Platinum 12 Year",
      "Neptune Cigar",
      "https://www.neptunecigar.com/cigar/gurkha-cellar-reserve-platinum-12-year",
      "4.44/5 from 115 Neptune customer reviews",
      [
        "Neptune lists Gurkha Cellar Reserve Platinum 12 Year with a 4.44 overall customer rating from 115 reviews.",
        "The page groups Solara, Hedonism, Kraken, and sampler review coverage for the 12 Year Platinum line.",
        "Use this as customer-review line coverage for the Platinum 12 Year formats.",
      ]
    );
  }

  if (/CELLAR RESV 15YR/.test(productName)) {
    return sourcedBrandReviewProfile(
      "Gurkha",
      "Gurkha Cellar Reserve 15 Years",
      "Neptune Cigar",
      "https://www.neptunecigar.com/cigars/gurkha-cellar-reserve-15-years-hedonism",
      "4.35/5 from 26 Neptune customer reviews",
      [
        "Neptune lists Gurkha Cellar Reserve 15 Years Hedonism with a 4.35 overall customer rating from 26 reviews.",
        "The page identifies the Dominican Cellar Reserve profile with cedar, earth, leather, and cocoa descriptors.",
        "Use this as customer-review line coverage for Cellar Reserve 15 Year and related Maduro/Prisoner formats.",
      ]
    );
  }

  if (/GHOST/.test(productName)) {
    return sourcedBrandReviewProfile(
      "Gurkha",
      "Gurkha Ghost",
      "Neptune Cigar",
      "https://www.neptunecigar.com/cigar/gurkha-ghost",
      "4.28/5 from 123 Neptune customer reviews",
      [
        "Neptune lists Gurkha Ghost with a 4.28 overall customer rating from 123 reviews.",
        "The page groups Ghost Shadow, Exorcist, and sampler review coverage.",
        "Use this as customer-review line coverage for Ghost and Ghost sampler products.",
      ]
    );
  }

  if (/GRAND RESERVE|GRAN RESERVE/.test(productName)) {
    return sourcedBrandReviewProfile(
      "Gurkha",
      "Gurkha Grand Reserve",
      "Neptune Cigar",
      "https://www.neptunecigar.com/cigar/gurkha-grand-reserve",
      "4.47/5 from 78 Neptune customer reviews",
      [
        "Neptune lists Gurkha Grand Reserve with a 4.47 overall customer rating from 78 reviews.",
        "The page identifies Grand Reserve as the cognac-infused Gurkha line and groups Churchill review coverage.",
        "Use this as customer-review line coverage for Grand Reserve cognac formats.",
      ]
    );
  }

  if (/HERITAGE MADURO/.test(productName)) {
    return sourcedBrandReviewProfile(
      "Gurkha",
      "Gurkha Heritage Maduro",
      "Neptune Cigar",
      "https://www.neptunecigar.com/cigar/gurkha-heritage-maduro",
      "4.35/5 from 21 Neptune customer reviews",
      [
        "Neptune lists Gurkha Heritage Maduro with a 4.35 overall customer rating from 21 reviews.",
        "The page identifies the Heritage Maduro customer-review line and reviewer descriptors.",
        "Use this as customer-review line coverage for the Heritage Maduro Robusto.",
      ]
    );
  }

  if (/NICARAGUA SERIES/.test(productName)) {
    return sourcedBrandReviewProfile(
      "Gurkha",
      "Gurkha Nicaragua Series",
      "Neptune Cigar",
      "https://www.neptunecigar.com/cigar/gurkha-nicaragua-series",
      "4.48/5 from 40 Neptune customer reviews",
      [
        "Neptune lists Gurkha Nicaragua Series with a 4.48 overall customer rating from 40 reviews.",
        "The page identifies the Nicaraguan Corojo/Criollo profile and groups Robusto and sampler reviews.",
        "Use this as customer-review line coverage for Nicaragua Series Robusto and Toro products.",
      ]
    );
  }

  if (/ROYAL CHALLENGE/.test(productName)) {
    return sourcedBrandReviewProfile(
      "Gurkha",
      "Gurkha Royal Challenge",
      "Neptune Cigar",
      "https://www.neptunecigar.com/cigar/gurkha-royal-challenge",
      "4.4/5 from 89 Neptune customer reviews",
      [
        "Neptune lists Gurkha Royal Challenge with a 4.4 overall customer rating from 89 reviews.",
        "The page groups Royal Challenge Robusto, Toro, and sampler review coverage.",
        "Use this as customer-review line coverage for Royal Challenge formats.",
      ]
    );
  }

  return sourcedBrandReviewProfile(
    "Gurkha",
    "Gurkha cigar lines",
    "Neptune Cigar",
    "https://www.neptunecigar.com/gurkha-cigar",
    "4.41/5 from 1,487 Neptune customer reviews",
    [
      "Neptune's Gurkha brand page lists a 4.41 overall customer rating from 1,487 reviews.",
      "The page groups Gurkha Bourbon, Castle Hall, Cellar Reserve, Private Select, Year of the Dragon, and other lines.",
      "Use this as broad customer-review brand coverage where exact line review pages are not yet mapped.",
    ]
  );
}

function getMontecristoReviewProfile(productName: string) {
  if (/1935 ANNIVERSARY/.test(productName)) {
    return sourcedBrandReviewProfile(
      "Montecristo",
      "Montecristo 1935 Anniversary Nicaragua No. 2",
      "Cigar Aficionado",
      "https://www.cigaraficionado.com/top25cigar/montecristo-1935-anniversary-nicaragua-no-2-0",
      "95 Cigar Aficionado Top 25 line-reference rating",
      [
        "Cigar Aficionado ranked the 1935 Anniversary Nicaragua No. 2 second in the 2021 Top 25 with a 95-point rating.",
        "The page identifies the Nicaraguan A.J. Fernandez-made Anniversary blend and its No. 2 dimensions.",
        "Use this as line-reference coverage for the No. 2 and Toro Anniversary formats.",
      ]
    );
  }

  if (/WHITE/.test(productName)) {
    return sourcedBrandReviewProfile(
      "Montecristo",
      "Montecristo White Toro",
      "Cigar Aficionado",
      "https://www.cigaraficionado.com/ratings/15552/name/montecristo-white-toro-toro",
      "88 Cigar Aficionado exact review",
      [
        "Cigar Aficionado rates the Montecristo White Toro at 88 points.",
        "The page identifies the Dominican-made White line with Ecuador wrapper and Dominican/Nicaraguan filler.",
        "Use exact coverage for Toro formats and line-reference coverage for Churchill, Court, No. 2, and Prontos products.",
      ]
    );
  }

  if (/CLASSIC/.test(productName)) {
    return sourcedBrandReviewProfile(
      "Montecristo",
      "Montecristo Classic Series Churchill",
      "Cigar Aficionado",
      "https://www.cigaraficionado.com/ratings/25584/name/montecristo-classic-series-churchill-churchill",
      "88 Cigar Aficionado Churchill line-reference rating",
      [
        "Cigar Aficionado rates the Montecristo Classic Series Churchill at 88 points.",
        "The page identifies the Classic Series as Dominican-made with Ecuador wrapper and Dominican filler.",
        "Use this as Classic line coverage for El Conde, Especial No. 3, No. 2, and tubo formats.",
      ]
    );
  }

  if (/ESPADA/.test(productName)) {
    return sourcedBrandReviewProfile(
      "Montecristo",
      "Espada by Montecristo Guard",
      "Cigar Aficionado",
      "https://www.cigaraficionado.com/ratings/18942/name/espada-by-montecristo-guard-toro",
      "89 Cigar Aficionado exact or line-reference rating",
      [
        "Cigar Aficionado rates the Espada by Montecristo Guard at 89 points.",
        "The page identifies Espada as an all-Nicaraguan Montecristo line.",
        "Use exact coverage for Guard and line-reference coverage for Ricasso.",
      ]
    );
  }

  if (/NICARAGUA SERIES/.test(productName)) {
    return sourcedBrandReviewProfile(
      "Montecristo",
      "Montecristo Nicaragua Series Toro",
      "Cigar Aficionado",
      "https://www.cigaraficionado.com/ratings/21048/name/montecristo-nicaragua-series-toro",
      "90 Cigar Aficionado exact review",
      [
        "Cigar Aficionado rates the Montecristo Nicaragua Series Toro at 90 points.",
        "The page identifies the blend as Nicaraguan wrapper, binder, and filler.",
        "Use this as exact coverage for the Nicaragua Series Toro.",
      ]
    );
  }

  if (/PLATINUM/.test(productName)) {
    return sourcedBrandReviewProfile(
      "Montecristo",
      "Montecristo Platinum Series Robusto",
      "Cigar Aficionado",
      "https://www.cigaraficionado.com/ratings/6008/name/montecristo-platinum-series-robusto",
      "89 Cigar Aficionado Robusto line-reference rating",
      [
        "Cigar Aficionado lists the Montecristo Platinum Series Robusto with an 89-point review history.",
        "The page identifies the Platinum blend as Mexican-wrapper with Dominican, Nicaraguan, and Peruvian filler.",
        "Use this as line-reference coverage for Platinum Churchill and Rothchilde tubos.",
      ]
    );
  }

  if (/CHURCHILL/.test(productName) && !/CLASSIC|WHITE|PLATINUM/.test(productName)) {
    return sourcedBrandReviewProfile(
      "Montecristo",
      "Montecristo Churchill",
      "Cigar Aficionado",
      "https://www.cigaraficionado.com/ratings/7348/name/montecristo-churchill-churchill",
      "88 Cigar Insider exact review",
      [
        "Cigar Aficionado's Montecristo Churchill page lists an 88-point Cigar Insider review.",
        "The page identifies the Churchill as a Dominican Montecristo with Connecticut Shade wrapper.",
        "Use exact coverage for the core Churchill and line-reference coverage for closely related core formats.",
      ]
    );
  }

  return sourcedBrandReviewProfile(
    "Montecristo",
    "Montecristo non-Cuban core lines",
    "Cigar Aficionado",
    "https://www.cigaraficionado.com/brand/montecristo-non-cuban",
    "Cigar Aficionado non-Cuban brand-profile ratings coverage",
    [
      "Cigar Aficionado's non-Cuban Montecristo brand page lists Classic, White, Platinum, Espada, and other rated product lines.",
      "Use this as brand-profile coverage for core sizes, Memories, Freshloc, and sampler products without exact public pages.",
      "The source is broader brand-profile coverage rather than an exact vitola score.",
    ]
  );
}

function getMyFatherReviewProfile(productName: string) {
  if (/CONNECTICUT/.test(productName)) {
    return sourcedBrandReviewProfile(
      "My Father",
      "My Father Connecticut Robusto",
      "Cigar Aficionado",
      "https://www.cigaraficionado.com/ratings/19239/name/my-father-connecticut-robusto-robusto",
      "90 Cigar Aficionado line-reference rating",
      [
        "Cigar Aficionado's My Father Connecticut Robusto page lists a 90-point review history.",
        "The page identifies the Connecticut line as Nicaraguan-made with Ecuador wrapper.",
        "Use exact coverage for Robusto and line-reference coverage for Toro and Toro Gordo formats.",
      ]
    );
  }

  if (/FONSECA/.test(productName)) {
    return sourcedBrandReviewProfile(
      "My Father",
      "Fonseca by My Father Cedros",
      "Cigar Aficionado",
      "https://www.cigaraficionado.com/ratings/22425/name/fonseca-by-my-father-cedros",
      "90 Cigar Aficionado Cedros line-reference rating",
      [
        "Cigar Aficionado's Fonseca by My Father Cedros page lists a 90-point Cigar Aficionado review.",
        "The page identifies Fonseca by My Father as Nicaraguan-made with Nicaraguan binder and filler.",
        "Use exact Cedros coverage and line-reference coverage for the Robusto.",
      ]
    );
  }

  if (/JUDGE/.test(productName)) {
    return sourcedBrandReviewProfile(
      "My Father",
      "My Father The Judge Grand Robusto",
      "Cigar Aficionado",
      "https://www.cigaraficionado.com/ratings/24975/name/my-father-the-judge-grand-robusto-grande",
      "98 Cigar Aficionado Cigar of the Year line-reference rating",
      [
        "Cigar Aficionado's Judge Grand Robusto page lists a 98-point Cigar Aficionado review.",
        "The page identifies the Grande format as Nicaraguan with Ecuador wrapper.",
        "Use exact coverage for Grand Robusto and line-reference coverage for Corona Gorda and Toro formats.",
      ]
    );
  }

  if (/LA GRAN OFERTA/.test(productName)) {
    return sourcedBrandReviewProfile(
      "My Father",
      "My Father La Gran Oferta Robusto",
      "Cigar Aficionado",
      "https://www.cigaraficionado.com/ratings/25385/name/my-father-la-gran-oferta-robusto-robusto",
      "90 Cigar Aficionado exact or line-reference rating",
      [
        "Cigar Aficionado rates My Father La Gran Oferta Robusto at 90 points.",
        "The page identifies the line as Nicaraguan-made with Ecuador wrapper.",
        "Use this as line-reference coverage for the La Gran Oferta assortment product.",
      ]
    );
  }

  if (/LA OPULENCIA/.test(productName)) {
    return sourcedBrandReviewProfile(
      "My Father",
      "My Father La Opulencia Robusto",
      "Cigar Aficionado",
      "https://www.cigaraficionado.com/ratings/20403/name/my-father-la-opulencia-robusto-robusto",
      "92 Cigar Aficionado line-reference rating",
      [
        "Cigar Aficionado's La Opulencia Robusto page lists a 92-point Cigar Aficionado review.",
        "The page identifies the Mexican-wrapper La Opulencia blend from Nicaragua.",
        "Use exact coverage for Robusto and line-reference coverage for Toro.",
      ]
    );
  }

  if (/LA PROMESA/.test(productName)) {
    return sourcedBrandReviewProfile(
      "My Father",
      "My Father La Promesa Robusto Grande",
      "Cigar Aficionado",
      "https://www.cigaraficionado.com/ratings/21675/name/my-father-la-promesa-robusto-grande-toro",
      "87 Cigar Insider line-reference rating",
      [
        "Cigar Aficionado's La Promesa Robusto Grande page lists an 87-point Cigar Insider review.",
        "The page identifies the line as Nicaraguan-made with Ecuador wrapper.",
        "Use this as line-reference coverage for La Promesa Toro and Lancero products.",
      ]
    );
  }

  if (/LE BIJOU/.test(productName)) {
    return sourcedBrandReviewProfile(
      "My Father",
      "My Father Le Bijou 1922 Torpedo Box Pressed",
      "Cigar Aficionado",
      "https://www.cigaraficionado.com/ratings/18642/name/my-father-le-bijou-1922-torpedo-box-pressed-figurado",
      "97 Cigar Aficionado Cigar of the Year exact review",
      [
        "Cigar Aficionado rates the Le Bijou 1922 Torpedo Box Pressed at 97 points and named it Cigar of the Year.",
        "The page identifies Le Bijou as a Nicaraguan line with Nicaraguan wrapper, binder, and filler.",
        "Use exact coverage for Torpedo and line-reference coverage for Churchill, Petite Robusto, and Toro formats.",
      ]
    );
  }

  if (/LA ANTIGUEDAD/.test(productName)) {
    return sourcedBrandReviewProfile(
      "My Father",
      "La Antiguedad Super Toro",
      "Cigar Aficionado",
      "https://www.cigaraficionado.com/rating/la-antiguedad-super-toro",
      "92 Cigar Aficionado line-reference rating",
      [
        "Cigar Aficionado rates La Antiguedad Super Toro at 92 points.",
        "The page identifies the line as Nicaraguan with Ecuador wrapper.",
        "Use exact Super Toro coverage and line-reference coverage for Toro Gordo.",
      ]
    );
  }

  if (/NO\.?\s*[135]/.test(productName)) {
    return sourcedBrandReviewProfile(
      "My Father",
      "My Father No. 1 Robusto",
      "Cigar Aficionado",
      "https://www.cigaraficionado.com/ratings/22009/name/my-father-no.-1-robusto",
      "92 Cigar Aficionado No. 1 line-reference rating",
      [
        "Cigar Aficionado rates My Father No. 1 Robusto at 92 points.",
        "The page identifies the core My Father profile as Nicaraguan-made with Ecuador wrapper.",
        "Use exact No. 1 coverage and line-reference coverage for No. 3 Cremas and No. 5 Toro.",
      ]
    );
  }

  return sourcedBrandReviewProfile(
    "My Father",
    "My Father cigar lines",
    "Cigar Aficionado",
    "https://www.cigaraficionado.com/brand/my-father",
    "Cigar Aficionado brand-profile ratings coverage",
    [
      "Cigar Aficionado's My Father brand page lists My Father, Le Bijou 1922, The Judge, and Connecticut product lines.",
      "The profile notes Cigar of the Year recognition for Le Bijou 1922.",
      "Use this as brand-profile coverage for samplers until component-level reviews are added.",
    ]
  );
}

function getFactoryReviewProfile(productName: string) {
  if (/FACTORY SMOKES/.test(productName)) {
    if (/SUN\s*GROWN/.test(productName)) {
      return sourcedBrandReviewProfile(
        "Factory",
        "Factory Smokes Sun Grown",
        "Neptune Cigar",
        "https://www.neptunecigar.com/cigars/factory-smokes-sungrown-robusto",
        "4.03/5 from 91 Neptune customer reviews",
        [
          "Neptune lists Factory Smokes Sun Grown Robusto with a 4.03 overall customer rating from 91 reviews.",
          "The page identifies Sun Grown Robusto customer-review coverage and reviewer descriptors.",
          "Use exact Robusto coverage and line-reference coverage for Toro.",
        ]
      );
    }

    if (/SWEET/.test(productName)) {
      return sourcedBrandReviewProfile(
        "Factory",
        "Factory Smokes Sweets",
        "Neptune Cigar",
        "https://www.neptunecigar.com/cigar/factory-smokes-sweets",
        "4.19/5 from 376 Neptune customer reviews",
        [
          "Neptune lists Factory Smokes Sweets with a 4.19 overall customer rating from 376 reviews.",
          "The page groups Belicoso, Churchill, Robusto, and Toro review coverage.",
          "Use this as customer-review line coverage for Sweet formats.",
        ]
      );
    }

    if (/SHADE/.test(productName)) {
      return sourcedBrandReviewProfile(
        "Factory",
        "Factory Smokes Shade",
        "Neptune Cigar",
        "https://www.neptunecigar.com/cigar/factory-smokes-shade",
        "4.14/5 from 273 Neptune customer reviews",
        [
          "Neptune lists Factory Smokes Shade with a 4.14 overall customer rating from 273 reviews.",
          "The page groups Churchill, Gordito, Robusto, and Toro review coverage.",
          "Use this as customer-review line coverage for Shade formats.",
        ]
      );
    }

    return sourcedBrandReviewProfile(
      "Factory",
      "Factory Smokes Maduro",
      "Neptune Cigar",
      "https://www.neptunecigar.com/cigar/factory-smokes-maduro",
      "4.12/5 from 567 Neptune customer reviews",
      [
        "Neptune lists Factory Smokes Maduro with a 4.12 overall customer rating from 567 reviews.",
        "The page groups Churchill, Gordito, Robusto, and Toro review coverage.",
        "Use this as customer-review line coverage for Maduro formats.",
      ]
    );
  }

  if (/FACTORY THROWOUTS/.test(productName)) {
    return sourcedBrandReviewProfile(
      "Factory",
      "Factory Throw-Outs",
      "Cigars International",
      "https://www.cigarsinternational.com/p/factory-throwouts-cigars/1479955/",
      "4.5/5 from 1,938 Cigars International customer ratings",
      [
        "Cigars International lists Factory Throw-Outs with a 4.5 out of 5 customer rating from 1,938 ratings.",
        "The page groups No. 49, No. 59, and No. 99 natural and sweet variants.",
        "Use this as customer-review line coverage for Factory Throw-Outs products.",
      ]
    );
  }

  return undefined;
}

function neptuneReviewProfile(brandName: string, lineName: string, sourceUrl: string, rating: string) {
  return sourcedBrandReviewProfile(
    brandName,
    lineName,
    "Neptune Cigar",
    sourceUrl,
    rating,
    [
      "The Neptune page exposes customer review coverage for the named product family.",
      "Use this as customer-review coverage for related vitolas in the same line.",
      "The source is retailer/customer coverage rather than an exact publication score.",
    ]
  );
}

function finalCoverageProfile(
  brandName: string,
  lineName: string,
  sourceName: string,
  sourceUrl: string,
  rating: string,
  matchLevel: string
) {
  return sourcedBrandReviewProfile(brandName, lineName, sourceName, sourceUrl, rating, [
    `${sourceName} provides ${matchLevel} Ratings & Reviews coverage for ${lineName}.`,
    "This source is mapped only to catalog products that match the named product, size, or line.",
    "The customer-facing Ratings & Reviews panel displays the source name, rating, and link.",
  ]);
}

function noPublicReviewStatusProfile(brandName: string, lineName: string, sourceName: string, sourceUrl: string) {
  return sourcedBrandReviewProfile(brandName, lineName, sourceName, sourceUrl, "No public customer or publication rating found for this exact line", [
    `${sourceName} verifies the exact ${lineName} product line, but no public customer aggregate or publication score was found.`,
    "This status is shown to avoid leaving the Ratings & Reviews panel blank while avoiding invented ratings.",
    "Replace this with a real rating or review page as soon as a source becomes available.",
  ]);
}

function getFinalCoverageReviewProfile(productName: string) {
  if (/^ACID\b/.test(productName)) {
    if (/KUBA KUBA/.test(productName)) {
      return neptuneReviewProfile("ACID", "ACID Kuba Kuba", "https://www.neptunecigar.com/cigars/acid-kuba-kuba", "Neptune customer-review product page");
    }

    if (/TOAST/.test(productName)) {
      return finalCoverageProfile(
        "ACID",
        "ACID Toast",
        "Neptune Cigar",
        "https://www.neptunecigar.com/cigars/acid-toast",
        "Overall 4.48/5 from 52 Neptune customer reviews",
        "exact product"
      );
    }

    if (/ATOM|COLD INFUSION|GOLD|HOLISTIC/.test(productName)) {
      return finalCoverageProfile(
        "ACID",
        "ACID Yellow",
        "Neptune Cigar",
        "https://www.neptunecigar.com/cigar/acid-yellow",
        "Overall 4.48/5 from 294 Neptune customer reviews",
        "line-level"
      );
    }

    if (/PLUSH|C-?NOTE|EXTRA ORDINARY LARRY|MORADO/.test(productName)) {
      return finalCoverageProfile(
        "ACID",
        "ACID Purple",
        "Neptune Cigar",
        "https://www.neptunecigar.com/cigar/acid-purple",
        "Overall 4.44/5 from 359 Neptune customer reviews",
        "line-level"
      );
    }

    if (/RED/.test(productName)) {
      return finalCoverageProfile(
        "ACID",
        "ACID Red",
        "Neptune Cigar",
        "https://www.neptunecigar.com/cigars/acid-liquid",
        "Rated 3.28/5 by 300 Neptune aficionados",
        "line-reference product"
      );
    }

    return finalCoverageProfile(
      "ACID",
      "ACID Blue",
      "Neptune Cigar",
      "https://www.neptunecigar.com/cigar/acid-blue",
      "Neptune line page with User Ratings & Reviews",
      "line-level"
    );
  }

  if (/^KUBA KUBA\b/.test(productName)) {
    return neptuneReviewProfile("ACID", "ACID Kuba Kuba", "https://www.neptunecigar.com/cigars/acid-kuba-kuba", "Neptune customer-review product page");
  }

  if (/^PUNCH\b/.test(productName)) {
    if (/GRAN PURO NICARAGUA/.test(productName)) {
      return finalCoverageProfile(
        "Punch",
        "Punch Gran Puro Nicaragua",
        "CIGAR.com",
        "https://www.cigar.com/p/punch-gran-puro-nicaragua-cigars/1509726/",
        "4/5 from 27 CIGAR.com customer ratings",
        "line-level"
      );
    }

    if (/RARE COROJO/.test(productName)) {
      return finalCoverageProfile(
        "Punch",
        "Punch Rare Corojo",
        "CIGAR.com",
        "https://www.cigar.com/p/punch-rare-corojo-cigars/2019811/",
        "4.5/5 from 99 CIGAR.com customer ratings",
        "line-level"
      );
    }

    if (/DIABLO/.test(productName)) {
      return finalCoverageProfile(
        "Punch",
        "Punch Diablo Diabolus",
        "Cigar Aficionado",
        "https://www.cigaraficionado.com/ratings/22981/name/punch-diablo-diabolus-robusto",
        "91 Cigar Aficionado Diabolus line-reference rating",
        "line-reference product"
      );
    }

    if (/SIGNATURE/.test(productName)) {
      return finalCoverageProfile(
        "Punch",
        "Punch Signature",
        "Cigar Aficionado",
        "https://www.cigaraficionado.com/ratings/18072/name/punch-signature-robusto-robusto",
        "91 Cigar Aficionado Signature Robusto line-reference rating",
        "line-reference product"
      );
    }

    if (/AFTER DINNER EMS/.test(productName)) {
      return finalCoverageProfile(
        "Punch",
        "Punch Clasico After Dinner EMS",
        "Cigar Aficionado",
        "https://www.cigaraficionado.com/rating/punch-clasico-after-dinner-ems",
        "85 Cigar Aficionado After Dinner EMS exact rating",
        "exact product"
      );
    }

    return finalCoverageProfile(
      "Punch",
      "Punch Clasico",
      "Cigars International",
      "https://www.cigarsinternational.com/p/punch-clasico-cigars/1411867/",
      "4.7/5 from 856 Cigars International customer ratings",
      "line-level"
    );
  }

  if (/^COHIBA\b/.test(productName)) {
    if (/BLUE/.test(productName)) {
      return finalCoverageProfile(
        "Cohiba",
        "Cohiba Blue",
        "Cigar Aficionado",
        "https://www.cigaraficionado.com/ratings/19906/name/cohiba-blue-robusto",
        "86 Cigar Aficionado Cohiba Blue Robusto line-reference rating",
        "line-reference product"
      );
    }

    if (/BLACK/.test(productName)) {
      return finalCoverageProfile(
        "Cohiba",
        "Cohiba Black",
        "JR Cigars",
        "https://www.jrcigars.com/cigars/handmade-cigars/cohiba-cigars/cohiba-black/",
        "4.18/5 from 1,393 JR Cigars customer reviews",
        "line-level"
      );
    }

    if (/CONNECTICUT/.test(productName)) {
      return finalCoverageProfile(
        "Cohiba",
        "Cohiba Connecticut",
        "CIGAR.com",
        "https://www.cigar.com/p/cohiba-connecticut-cigars/2019644/",
        "4.5/5 from 75 CIGAR.com customer ratings",
        "line-level"
      );
    }

    if (/NICARAG/.test(productName)) {
      return finalCoverageProfile(
        "Cohiba",
        "Cohiba Nicaragua",
        "CIGAR.com",
        "https://www.cigar.com/product/cohiba-nicaragua/CHF-PM-1000.html",
        "4.5/5 from 200 CIGAR.com customer ratings",
        "line-level"
      );
    }

    if (/ROYALE/.test(productName)) {
      return finalCoverageProfile(
        "Cohiba",
        "Cohiba Royale",
        "CIGAR.com",
        "https://www.cigar.com/p/cohiba-royale-cigars/2030634/",
        "4.5/5 from 18 CIGAR.com customer ratings",
        "line-level"
      );
    }

    return finalCoverageProfile(
      "Cohiba",
      "Cohiba Red Dot",
      "JR Cigars",
      "https://www.jrcigars.com/cigars/handmade-cigars/cohiba-cigars/cohiba-red-dot/",
      "4.18/5 from 1,572 JR Cigars customer reviews",
      "line-level"
    );
  }

  if (/^QUORUM\b/.test(productName)) {
    return neptuneReviewProfile("Quorum", "Quorum", "https://www.neptunecigar.com/cigar/quorum", "Neptune customer-review brand and line page");
  }

  if (/^BRICK HOUSE\b/.test(productName)) {
    return sourcedBrandReviewProfile(
      "Brick House",
      "Brick House",
      "Cigar Aficionado",
      "https://www.cigaraficionado.com/ratings/26184/name/brick-house-corona",
      "Cigar Aficionado line-reference rating coverage",
      [
        "Cigar Aficionado's Brick House Corona page provides public rating coverage for the Brick House family.",
        "Use this as line-reference coverage for Natural, Maduro, Connecticut, and sampler products.",
        "The mapped source is line-reference coverage unless the exact vitola is the Corona.",
      ]
    );
  }

  if (/^DREW ESTATE JAVA\b|^JAVA\b/.test(productName)) {
    if (/MADURO/.test(productName)) {
      return neptuneReviewProfile("Java", "Java by Drew Estate", "https://www.neptunecigar.com/cigars/java-maduro-toro", "Neptune customer-review product page");
    }

    return neptuneReviewProfile("Java", "Java by Drew Estate", "https://www.neptunecigar.com/java-cigar", "Neptune customer-review brand and line page");
  }

  if (/^JM'?S?\b|^JM DOMINICAN\b/.test(productName)) {
    return sourcedBrandReviewProfile(
      "JM's Dominican",
      "JM's Dominican",
      "Cigars.com",
      "https://www.cigars.com/item/jms-dominican/connecticut-robusto/JMDCR.html",
      "Cigars.com product-review page",
      [
        "Cigars.com provides product-page coverage for the JM's Dominican Connecticut Robusto.",
        "Use this as customer/product page coverage for JM's Dominican Connecticut, Maduro, Sumatra, and Corojo formats.",
        "The source is product-page coverage rather than an exact publication score.",
      ]
    );
  }

  if (/^DAVIDOFF WINSTON CHURCHILL/.test(productName)) {
    return sourcedBrandReviewProfile(
      "Davidoff",
      "Davidoff Winston Churchill The Late Hour",
      "Cigar Aficionado",
      "https://www.cigaraficionado.com/ratings/20277/name/davidoff-winston-churchill-the-late-hour-churchill",
      "86 Cigar Aficionado Churchill line-reference rating",
      [
        "Cigar Aficionado rates the Winston Churchill The Late Hour Churchill at 86 points and lists later reviews.",
        "The page identifies the Churchill as a Dominican Davidoff with Ecuador wrapper, Mexican binder, and Dominican/Nicaraguan filler.",
        "Use this as line-reference coverage for Winston Churchill tins and Late Hour packs.",
      ]
    );
  }

  if (/^TABAK\b/.test(productName)) {
    return neptuneReviewProfile("Tabak", "Tabak Especial", "https://www.neptunecigar.com/tabak-especial-cigar", "Neptune customer-review brand and line page");
  }

  if (/^DEADWOOD\b/.test(productName)) {
    return neptuneReviewProfile("Deadwood", "Deadwood", "https://www.neptunecigar.com/cigars/deadwood-fat-bottom-betty", "Neptune customer-review product page");
  }

  if (/^AJ FERNANDEZ\b|^SAN LOTANO\b/.test(productName)) {
    return neptuneReviewProfile("AJ Fernandez", "AJ Fernandez New World and San Lotano", "https://www.neptunecigar.com/cigar/new-world", "Neptune customer-review brand and line page");
  }

  if (/^NUB\b|^TASTE OF OLIVA\b/.test(productName)) {
    return sourcedBrandReviewProfile(
      "Nub",
      "Nub by Oliva",
      "CIGAR.com",
      "https://www.cigar.com/p/nub-by-oliva-cigars/1411708",
      "CIGAR.com customer-review and brand-profile page",
      [
        "CIGAR.com's Nub by Oliva page provides customer-review and line-profile coverage for Nub formats.",
        "Use this as broad line coverage for Nub Cameroon, Connecticut, Habano, Maduro, and sampler products.",
        "The source is retailer/customer coverage rather than an exact expert score.",
      ]
    );
  }

  if (/^PARTAGAS\b/.test(productName)) {
    if (/BLACK LABEL/.test(productName)) {
      return sourcedBrandReviewProfile(
        "Partagas",
        "Partagas Black Label",
        "Cigar World",
        "https://www.cigarworld.com/cigars/partagas/black-label/",
        "Cigar World line profile with 90 Cigar Insider rating context",
        [
          "Cigar World's Partagas Black Label page notes 90-rating context and groups the line profile.",
          "Use this as Black Label line coverage for boxes, tubos, and tins.",
          "The source is line-profile coverage rather than an exact vitola score.",
        ]
      );
    }

    if (/CORTADO ROBUSTO/.test(productName)) {
      return finalCoverageProfile(
        "Partagas",
        "Partagas Cortado Robusto",
        "Cigar Aficionado",
        "https://www.cigaraficionado.com/rating/partagas-cortado-robusto",
        "84 Cigar Aficionado Cortado Robusto exact rating",
        "exact product"
      );
    }

    if (/CORTADO TORO/.test(productName)) {
      return finalCoverageProfile(
        "Partagas",
        "Partagas Cortado Toro",
        "Cigar Aficionado",
        "https://www.cigaraficionado.com/ratings/24719/name/partagas-cortado-toro",
        "89 Cigar Aficionado Cortado Toro exact rating",
        "exact product"
      );
    }

    return undefined;
  }

  if (/^CAMACHO\b/.test(productName)) {
    return sourcedBrandReviewProfile(
      "Camacho",
      "Camacho cigar lines",
      "Holt's Cigar Company",
      "https://www.holts.com/cigars/all-cigar-brands/brand/camacho",
      "Holt's customer-rating brand profile",
      [
        "Holt's Camacho brand page provides brand/customer-rating coverage across Camacho lines.",
        "Use this as broad customer-review coverage for Connecticut, Corojo, Ecuador, Nicaragua, and Triple Maduro formats.",
        "The source is retailer/customer coverage rather than an exact publication score.",
      ]
    );
  }

  if (/^(ROCKY PATEL|RP)\b/.test(productName) || /^EDGE 20TH ANNIVERSARY/.test(productName) || /^DARK STAR/.test(productName)) {
    if (/LB1/.test(productName)) {
      return finalCoverageProfile(
        "Rocky Patel",
        "Rocky Patel LB1 Robusto",
        "Neptune Cigar",
        "https://www.neptunecigar.com/cigars/rocky-patel-lb1-robusto",
        "Overall 4.38/5 from 21 Neptune customer reviews",
        "line-reference product"
      );
    }

    if (/IT'?S A BOY|IT'?S A GIRL/.test(productName)) {
      return finalCoverageProfile(
        "Rocky Patel",
        "Rocky Patel It's a Boy/Girl",
        "CIGAR.com",
        "https://www.cigar.com/product/rocky-patel-its-a-boy-girl/RPK-PM.html",
        "5/5 from 17 CIGAR.com customer reviews",
        "line-level"
      );
    }

    if (/2006 VINTAGE/.test(productName)) {
      return finalCoverageProfile(
        "Rocky Patel",
        "Rocky Patel Vintage 2006",
        "Cigars International",
        "https://www.cigarsinternational.com/p/rocky-patel-vintage-2006-san-andreas/2008193/",
        "4.5/5 from 18 Cigars International customer ratings",
        "line-level"
      );
    }

    if (/1990/.test(productName)) {
      return finalCoverageProfile(
        "Rocky Patel",
        "Rocky Patel Vintage 1990",
        "Neptune Cigar",
        "https://www.neptunecigar.com/cigar/rocky-patel-vintage-1990",
        "Overall 4.51/5 from 217 Neptune customer reviews",
        "line-level"
      );
    }

    if (/JUNIORS SUNGROWN|SUN\s*GROWN/.test(productName)) {
      return finalCoverageProfile(
        "Rocky Patel",
        "Rocky Patel Sun Grown",
        "Rocky Patel",
        "https://www.rockypatel.com/cigar/sun-grown/",
        "90 brand-cited Cigar Aficionado rating",
        "line-level"
      );
    }

    if (/EDGE/.test(productName)) {
      return finalCoverageProfile(
        "Rocky Patel",
        "The Edge 20th Anniversary Robusto",
        "Cigar Aficionado",
        "https://www.cigaraficionado.com/rating/the-edge-20th-anniversary-robusto",
        "88 Cigar Insider Edge 20th Anniversary exact rating",
        "exact product"
      );
    }

    if (/HONDURAN/.test(productName)) {
      return finalCoverageProfile(
        "Rocky Patel",
        "Rocky Patel Honduran Rated 95 Sampler",
        "Neptune Cigar",
        "https://www.neptunecigar.com/cigars/rocky-patel-honduran-rated-95-4-cigar-sampler",
        "Overall 4.69/5 from 27 Neptune customer reviews",
        "exact sampler"
      );
    }

    if (/DARK STAR/.test(productName)) {
      return finalCoverageProfile(
        "Rocky Patel",
        "Rocky Patel Dark Star Robusto",
        "Cigar World",
        "https://www.cigarworld.com/cigars/review/rocky-patel-dark-star-robusto-a-cigar-worth-repeating/",
        "94/100 Cigar World member review",
        "exact product"
      );
    }
  }

  if (/^HOYO\b/.test(productName)) {
    if (/EXCALIBUR MINIATURES/.test(productName)) {
      return finalCoverageProfile(
        "Hoyo de Monterrey",
        "Hoyo Excalibur Miniatures",
        "Mike's Cigars",
        "https://mikescigars.com/excalibur-miniatures",
        "93% Mike's Cigars customer rating from 3 reviews",
        "exact product"
      );
    }

    if (/EXCALIBUR/.test(productName)) {
      return finalCoverageProfile(
        "Hoyo de Monterrey",
        "Hoyo Excalibur",
        "CIGAR.com",
        "https://www.cigar.com/p/hoyo-de-monterrey-excalibur-cigarillos-cigars/1480548/",
        "4.5/5 from 339 CIGAR.com customer ratings",
        "line-level"
      );
    }

    if (/OSCURO/.test(productName)) {
      return finalCoverageProfile(
        "Hoyo de Monterrey",
        "Hoyo de Monterrey Oscuro",
        "Cigar Aficionado",
        "https://www.cigaraficionado.com/ratings/25968/name/hoyo-de-monterrey-oscuro-toro-toro",
        "89 Cigar Aficionado Oscuro Toro exact rating",
        "line-level"
      );
    }
  }

  if (/^BOLIVAR COFRADIA/.test(productName)) {
    return finalCoverageProfile(
      "Bolivar",
      "Bolivar Cofradia",
      "CIGAR.com",
      "https://www.cigar.com/p/bolivar-cofradia-cigars/2031074/",
      "4.5/5 from 25 CIGAR.com customer ratings",
      "line-level"
    );
  }

  if (/^SANCHO PANZA EXTRA FUERTE/.test(productName)) {
    return finalCoverageProfile(
      "Sancho Panza",
      "Sancho Panza Extra Fuerte Madrid",
      "Cigar Aficionado",
      "https://www.cigaraficionado.com/ratings/14312/name/sancho-panza-extra-fuerte-madrid",
      "91 Cigar Aficionado Madrid/Toro exact rating",
      "exact product"
    );
  }

  if (/^EL REY DEL MUNDO/.test(productName)) {
    if (/NATURAL/.test(productName)) {
      return finalCoverageProfile(
        "El Rey del Mundo",
        "El Rey del Mundo Natural",
        "CIGAR.com",
        "https://www.cigar.com/product/el-rey-del-mundo-natural/ERB-PM.html",
        "5/5 from 1 CIGAR.com customer rating",
        "line-level"
      );
    }

    return finalCoverageProfile(
      "El Rey del Mundo",
      "El Rey del Mundo Oscuro",
      "Cigars International",
      "https://www.cigarsinternational.com/p/el-rey-del-mundo-cigars/1411007/",
      "4.5/5 from 216 Cigars International customer ratings",
      "line-level"
    );
  }

  if (/^CAO\b/.test(productName)) {
    if (/FLATHEAD/.test(productName)) {
      return finalCoverageProfile(
        "CAO",
        "CAO Flathead",
        "Neptune Cigar",
        "https://www.neptunecigar.com/cigar/cao-flathead",
        "Overall 4.49/5 from 529 Neptune customer reviews",
        "line-level"
      );
    }

    if (/NICARAGUA/.test(productName)) {
      return finalCoverageProfile(
        "CAO",
        "CAO Nicaragua",
        "Neptune Cigar",
        "https://www.neptunecigar.com/cigar/cao-nicaragua",
        "Overall 4.31/5 from 37 Neptune customer reviews",
        "line-level"
      );
    }

    if (/BRAZILIA/.test(productName)) {
      return finalCoverageProfile(
        "CAO",
        "CAO Brazilia",
        "Neptune Cigar",
        "https://www.neptunecigar.com/cigar/cao-brazilia",
        "Overall 4.48/5 from 499 Neptune customer reviews",
        "line-level"
      );
    }

    if (/BX3/.test(productName)) {
      return finalCoverageProfile(
        "CAO",
        "CAO BX3",
        "Neptune Cigar",
        "https://www.neptunecigar.com/cigar/cao-bx3",
        "Overall 4.33/5 from 84 Neptune customer reviews",
        "line-level"
      );
    }
  }

  if (/^UNDERCROWN\b|^LIGA UNDERCROWN\b/.test(productName)) {
    if (/UC10|\b10\b/.test(productName)) {
      return finalCoverageProfile(
        "Drew Estate",
        "Liga Undercrown 10",
        "Neptune Cigar",
        "https://www.neptunecigar.com/cigar/liga-undercrown-10",
        "Overall 4.69/5 from 234 Neptune customer reviews",
        "line-level"
      );
    }

    if (/SHADE|CONNECTICUT/.test(productName)) {
      return finalCoverageProfile(
        "Drew Estate",
        "Liga Undercrown Connecticut Shade",
        "Neptune Cigar",
        "https://www.neptunecigar.com/cigar/liga-undercrown-connecticut-shade",
        "Overall 4.57/5 from 297 Neptune customer reviews",
        "line-level"
      );
    }

    return finalCoverageProfile(
      "Drew Estate",
      "Liga Undercrown Maduro",
      "Neptune Cigar",
      "https://www.neptunecigar.com/cigar/liga-undercrown-maduro",
      "Overall 4.59/5 from 659 Neptune customer reviews",
      "line-level"
    );
  }

  if (/^NICA RUSTICA\b/.test(productName)) {
    return finalCoverageProfile(
      "Drew Estate",
      "Nica Rustica",
      "Neptune Cigar",
      "https://www.neptunecigar.com/cigar/nica-rustica",
      "Overall 4.37/5 from 324 Neptune customer reviews",
      "line-level"
    );
  }

  if (/^THE UPSETTERS\b/.test(productName)) {
    return finalCoverageProfile(
      "Foundation",
      "The Upsetters",
      "CIGAR.com",
      "https://www.cigar.com/product/the-upsetters/UPS-PM.html",
      "4.5/5 from 24 CIGAR.com customer reviews",
      "line-level"
    );
  }

  if (/^LA ANTI[GQ]UEDAD\b/.test(productName)) {
    return finalCoverageProfile(
      "My Father",
      "My Father La Antiguedad",
      "CIGAR.com",
      "https://www.cigar.com/p/my-father-la-antiguedad-cigars/1483013/",
      "4.5/5 from 33 CIGAR.com customer reviews",
      "line-level"
    );
  }

  if (/^LA GLORIA CUBANA\b/.test(productName)) {
    if (/SERIE R/.test(productName)) {
      return finalCoverageProfile(
        "La Gloria Cubana",
        "La Gloria Cubana Serie R",
        "Neptune Cigar",
        "https://www.neptunecigar.com/cigar/la-gloria-cubana-serie-r",
        "Neptune Serie R customer-review line page",
        "line-level"
      );
    }

    return finalCoverageProfile(
      "La Gloria Cubana",
      "La Gloria Cubana",
      "Cigars International",
      "https://www.cigarsinternational.com/p/la-gloria-cubana-cigars/2067489/",
      "4.64/5 from 169 Cigars International customer ratings",
      "line-level"
    );
  }

  if (/^LA GLORIA ESTELI/.test(productName)) {
    return finalCoverageProfile(
      "La Gloria Cubana",
      "La Gloria Cubana Serie R Esteli",
      "Cigar Dojo",
      "https://cigardojo.com/2013/10/la-gloria-cubana-serie-r-esteli-cigar-review/",
      "85% Cigar Dojo Serie R Esteli No. 54 review",
      "line-reference product"
    );
  }

  if (/^LA MIRADA HABANO/.test(productName)) {
    return finalCoverageProfile(
      "La Mirada",
      "La Mirada Habano Viejo",
      "Cigar Public",
      "https://cigarpublic.com/2022/10/06/la-mirada-habano/",
      "Cigar Public Habano Viejo review page",
      "line-reference product"
    );
  }

  if (/^LA PALINA NICARAGUA/.test(productName)) {
    return finalCoverageProfile(
      "La Palina",
      "La Palina Nicaragua Connecticut",
      "CIGAR.com",
      "https://www.cigar.com/p/la-palina-nicaragua-connecticut-cigar-cigars/2046411/",
      "5/5 from 1 CIGAR.com customer review and 90-rating context",
      "component line-reference"
    );
  }

  if (/^LA AURORA 120TH/.test(productName)) {
    return finalCoverageProfile(
      "La Aurora",
      "La Aurora 120th Anniversary Robusto",
      "Cigar Aficionado",
      "https://www.cigaraficionado.com/ratings/24932/name/la-aurora-120th-anniversary-robusto-robusto",
      "87 Cigar Aficionado Robusto exact rating",
      "exact product"
    );
  }

  if (/^LA ESTRELLA CUBANA HABANO/.test(productName)) {
    return finalCoverageProfile(
      "La Estrella Cubana",
      "La Estrella Cubana Habano",
      "JR Cigars",
      "https://www.jrcigars.com/cigars/handmade-cigars/la-estrella-cubana-cigars/la-estrella-cubana-habano/",
      "4.14/5 from 29 JR Cigars customer reviews",
      "line-level"
    );
  }

  if (/^FLOR DE LAS ANTILLAS\b/.test(productName)) {
    if (/MADURO/.test(productName)) {
      return finalCoverageProfile(
        "My Father",
        "Flor de las Antillas Maduro",
        "Cigar Aficionado",
        "https://www.cigaraficionado.com/ratings/19859/name/flor-de-las-antillas-maduro-corona",
        "92 Cigar Aficionado Maduro Corona line-reference rating",
        "line-reference product"
      );
    }

    if (/TUBO/.test(productName)) {
      return finalCoverageProfile(
        "My Father",
        "Flor de las Antillas Tubo Toro",
        "Cigar Aficionado",
        "https://www.cigaraficionado.com/ratings/18926/name/flor-de-las-antillas-tubo-toro",
        "90 Cigar Aficionado Tubo Toro exact rating",
        "exact product"
      );
    }

    return finalCoverageProfile(
      "My Father",
      "Flor de las Antillas Toro",
      "Cigar Aficionado",
      "https://www.cigaraficionado.com/ratings/16207/name/flor-de-las-antillas-toro",
      "96 Cigar Aficionado Toro line-reference rating",
      "line-reference product"
    );
  }

  if (/^LA DUENA\b|^LA DUEÑA\b/.test(productName)) {
    return finalCoverageProfile(
      "My Father",
      "La Duena Robusto No. 5",
      "Cigar Aficionado",
      "https://www.cigaraficionado.com/ratings/16017/name/la-duena-robusto-no-5",
      "89 Cigar Insider Robusto No. 5 line-reference rating",
      "line-reference product"
    );
  }

  if (/^JAIME GARCIA\b/.test(productName)) {
    return finalCoverageProfile(
      "My Father",
      "Jaime Garcia Reserva Especial",
      "Cigar Aficionado",
      "https://www.cigaraficionado.com/ratings/14833/name/14833",
      "90 Cigar Aficionado Petit Robusto line-reference rating",
      "line-reference product"
    );
  }

  if (/^DON PEPIN/.test(productName)) {
    return finalCoverageProfile(
      "My Father",
      "Don Pepin Garcia Original Invictos",
      "Cigar Aficionado",
      "https://www.cigaraficionado.com/ratings/25715/name/don-pepin-garcia-original-invictos-robusto",
      "92 Cigar Aficionado Invictos line-reference rating",
      "line-reference product"
    );
  }

  if (/^EL CENTURION/.test(productName)) {
    if (/H-?2K/.test(productName)) {
      return finalCoverageProfile(
        "My Father",
        "El Centurion H-2K-CT Toro Box Pressed",
        "Cigar Aficionado",
        "https://www.cigaraficionado.com/ratings/24755/name/el-centurion-h-2k-ct-toro-box-pressed-toro",
        "93 Cigar Aficionado H-2K-CT Toro exact rating",
        "exact product"
      );
    }

    return finalCoverageProfile(
      "My Father",
      "El Centurion Robusto",
      "Cigar Aficionado",
      "https://www.cigaraficionado.com/ratings/20185/name/el-centurion-robusto-toro",
      "89 Cigar Aficionado Robusto line-reference rating",
      "line-reference product"
    );
  }

  if (/^TATUAJE\b/.test(productName)) {
    if (/BLACK/.test(productName)) {
      return finalCoverageProfile(
        "Tatuaje",
        "Tatuaje Black",
        "Cigar Aficionado",
        "https://www.cigaraficionado.com/ratings/26689/name/tatuaje-black-petite-lancero",
        "96 Cigar Aficionado Black Petite Lancero line-reference rating",
        "line-reference product"
      );
    }

    if (/HAVANA VI/.test(productName)) {
      return finalCoverageProfile(
        "Tatuaje",
        "Tatuaje Havana VI",
        "Cigar Aficionado",
        "https://www.cigaraficionado.com/ratings/17777/name/tatuaje-havana-vi-artistas",
        "91 Cigar Aficionado Havana VI Artistas line-reference rating",
        "line-reference product"
      );
    }

    if (/NEGOCIANT/.test(productName)) {
      return finalCoverageProfile(
        "Tatuaje",
        "Tatuaje Negociant Monopole",
        "Neptune Cigar",
        "https://www.neptunecigar.com/cigar/tatuaje-negociant",
        "Overall 4.48/5 from 34 Neptune customer reviews",
        "line-level"
      );
    }

    if (/10TH/.test(productName)) {
      return finalCoverageProfile(
        "Tatuaje",
        "Tatuaje 10th Capa Especial",
        "Cigar Aficionado",
        "https://www.cigaraficionado.com/rating/tatuaje-10th-capa-especial-belle-encre",
        "91 Cigar Aficionado 10th Capa Especial line-reference rating",
        "line-reference product"
      );
    }

    return finalCoverageProfile(
      "Tatuaje",
      "Tatuaje Havana VI",
      "Cigar Aficionado",
      "https://www.cigaraficionado.com/ratings/17777/name/tatuaje-havana-vi-artistas",
      "91 Cigar Aficionado Havana VI Artistas line-reference rating",
      "line-reference product"
    );
  }

  if (/^LA AROMA DE CUBA/.test(productName)) {
    return finalCoverageProfile(
      "La Aroma de Cuba",
      "La Aroma de Cuba Robusto",
      "Cigar Aficionado",
      "https://www.cigaraficionado.com/ratings/25712/name/la-aroma-de-cuba-robusto-robusto",
      "94 Cigar Aficionado Robusto line-reference rating",
      "line-reference product"
    );
  }

  if (/^EPC ENCORE|^E\.?P\.?\s*CARRILLO ENCORE/.test(productName)) {
    return finalCoverageProfile(
      "E.P. Carrillo",
      "E.P. Carrillo Encore Majestic",
      "Cigar Aficionado",
      "https://www.cigaraficionado.com/ratings/23967/name/e.p.-carrillo-encore-majestic-miscellaneous",
      "95 Cigar Aficionado Encore Majestic exact rating",
      "exact product"
    );
  }

  if (/^20 ACRE FARM/.test(productName)) {
    return finalCoverageProfile(
      "20 Acre Farm",
      "20 Acre Farm Toro",
      "Cigar Aficionado",
      "https://www.cigaraficionado.com/rating/20-acre-farm-toro",
      "90 Cigar Aficionado Toro line-reference rating",
      "line-reference product"
    );
  }

  if (/^KNUCKLE SANDWICH/.test(productName)) {
    return finalCoverageProfile(
      "Espinosa",
      "Knuckle Sandwich Habano",
      "Cigar Aficionado",
      "https://www.cigaraficionado.com/ratings/24453/name/espinosa-knuckle-sandwich-habano-corona-gorda-r-toro",
      "92 Cigar Aficionado Habano line-reference rating",
      "line-reference product"
    );
  }

  if (/^ASHTON\b/.test(productName)) {
    if (/VSG/.test(productName)) {
      return finalCoverageProfile(
        "Ashton",
        "Ashton Virgin Sun Grown Eclipse",
        "Cigar Aficionado",
        "https://www.cigaraficionado.com/top25cigar/ashton-virgin-sun-grown-eclipse-2010",
        "92 Cigar Aficionado Top 25 Eclipse line-reference rating",
        "line-reference product"
      );
    }

    if (/MONARCH/.test(productName)) {
      return finalCoverageProfile(
        "Ashton",
        "Ashton Classic Monarch",
        "Cigar Aficionado",
        "https://www.cigaraficionado.com/ratings/5306/name/ashton-classic-monarch-toro",
        "88 Cigar Aficionado Monarch exact rating",
        "exact product"
      );
    }

    if (/AGED|MADURO|ESQUIRE/.test(productName)) {
      return finalCoverageProfile(
        "Ashton",
        "Ashton Aged Maduro",
        "CIGAR.com",
        "https://www.cigar.com/p/ashton-aged-maduro-cigars/1410638/",
        "5/5 from 42 CIGAR.com customer reviews",
        "line-level"
      );
    }

    if (/CABINET/.test(productName)) {
      return finalCoverageProfile(
        "Ashton",
        "Ashton Cabinet",
        "CIGAR.com",
        "https://www.cigar.com/p/ashton-cabinet-selection-cigars/1410642/",
        "5/5 from 39 CIGAR.com customer reviews",
        "line-level"
      );
    }

    return finalCoverageProfile(
      "Ashton",
      "Ashton Classic",
      "CIGAR.com",
      "https://www.cigar.com/p/ashton-tins-cigars/2000689/",
      "4.5/5 from 132 CIGAR.com customer reviews",
      "line-level"
    );
  }

  if (/^AVO\b/.test(productName)) {
    if (/SYNCRO CARIBE/.test(productName)) {
      return finalCoverageProfile(
        "AVO",
        "AVO Syncro Caribe",
        "CIGAR.com",
        "https://www.cigar.com/product/avo-syncro-caribe/ASC-PM.html",
        "4.5/5 from 3 CIGAR.com customer reviews",
        "line-level"
      );
    }

    if (/SYNCRO NICARAGUA/.test(productName)) {
      return finalCoverageProfile(
        "AVO",
        "AVO Syncro Nicaragua Toro",
        "Cigar Aficionado",
        "https://www.cigaraficionado.com/ratings/21931/name/avo-syncro-nicaragua-toro-toro",
        "90 Cigar Aficionado Toro exact rating",
        "exact product"
      );
    }

    return finalCoverageProfile(
      "AVO",
      "AVO Classic Robusto",
      "Cigar Aficionado",
      "https://www.cigaraficionado.com/ratings/8666/name/avo-classic-robusto",
      "89 Cigar Aficionado Robusto exact rating",
      "exact product"
    );
  }

  if (/^ZINO PLATINUM/.test(productName)) {
    if (/CHUBBY/.test(productName)) {
      return finalCoverageProfile(
        "Zino",
        "Zino Platinum Scepter Series Chubby",
        "Cigar Aficionado",
        "https://www.cigaraficionado.com/top25cigar/zino-platinum-scepter-series-chubby-tubos-2005",
        "91 Cigar Aficionado Top 25 Chubby line-reference rating",
        "line-reference product"
      );
    }

    return finalCoverageProfile(
      "Zino",
      "Zino Platinum Scepter Series Grand Master",
      "Cigar Aficionado",
      "https://www.cigaraficionado.com/ratings/9146/name/zino-platinum-scepter-series-grand-master",
      "86 Cigar Aficionado Grand Master exact rating",
      "exact product"
    );
  }

  if (/^LA AURORA\s+PREFERIDO/.test(productName)) {
    if (/RUBY|MADURO/.test(productName)) {
      return finalCoverageProfile(
        "La Aurora",
        "La Aurora Preferidos 1903 Edition Ruby",
        "Cigar Aficionado",
        "https://www.cigaraficionado.com/ratings/23686/name/la-aurora-preferidos-1903-edition-ruby-perfecto-tubo-figurado",
        "87 Cigar Insider Ruby Perfecto Tubo exact rating",
        "exact product"
      );
    }

    return finalCoverageProfile(
      "La Aurora",
      "La Aurora Preferidos Gold",
      "Cigar Aficionado",
      "https://www.cigaraficionado.com/ratings/16514/name/aurora-preferidos-gold-figurado",
      "91 Cigar Aficionado Preferidos Gold line-reference rating",
      "line-reference product"
    );
  }

  if (/^ANTANO 1970|^JOYA\b/.test(productName)) {
    if (/ANTANO 1970|ANTANO CT/.test(productName)) {
      return finalCoverageProfile(
        "Joya de Nicaragua",
        "Joya de Nicaragua Antano 1970 Gran Consul",
        "Cigar Aficionado",
        "https://www.cigaraficionado.com/rating/joya-de-nicaragua-antano-1970-gran-consul",
        "92 Cigar Aficionado Gran Consul line-reference rating",
        "line-reference product"
      );
    }

    if (/RED/.test(productName)) {
      return finalCoverageProfile(
        "Joya de Nicaragua",
        "Joya Red Robusto",
        "Cigar Aficionado",
        "https://www.cigaraficionado.com/ratings/23473/name/joya-red-robusto-robusto",
        "91 Cigar Aficionado Robusto exact rating",
        "exact product"
      );
    }

    if (/BLACK/.test(productName)) {
      return finalCoverageProfile(
        "Joya de Nicaragua",
        "Joya Black Doble Robusto",
        "Cigar Aficionado",
        "https://www.cigaraficionado.com/ratings/21948/name/joya-black-doble-robusto-robusto",
        "91 Cigar Aficionado Doble Robusto line-reference rating",
        "line-reference product"
      );
    }

    if (/SILVER/.test(productName)) {
      return finalCoverageProfile(
        "Joya de Nicaragua",
        "Joya Silver Robusto",
        "Cigar Aficionado",
        "https://www.cigaraficionado.com/ratings/23413/name/joya-silver-robusto",
        "93 Cigar Aficionado Silver Robusto line-reference rating",
        "line-reference product"
      );
    }
  }

  if (/^ALADINO\b/.test(productName)) {
    if (/CAMEROON/.test(productName)) {
      return finalCoverageProfile(
        "Aladino",
        "Aladino Cameroon Robusto",
        "Cigar Aficionado",
        "https://www.cigaraficionado.com/ratings/26545/name/aladino-cameroon-robusto-robusto",
        "91 Cigar Aficionado Cameroon Robusto exact rating",
        "exact product"
      );
    }

    if (/CONNECTICUT/.test(productName)) {
      return finalCoverageProfile(
        "Aladino",
        "Aladino Connecticut",
        "Cigar Aficionado",
        "https://www.cigaraficionado.com/rating/aladino-connecticut-queens",
        "87 Cigar Aficionado Connecticut Queens line-reference rating",
        "line-reference product"
      );
    }

    if (/85 ANIVERSARIO/.test(productName)) {
      return finalCoverageProfile(
        "Aladino",
        "Aladino 85 Aniversario Reserva Toro",
        "Cigar Aficionado",
        "https://www.cigaraficionado.com/top25cigar/aladino-85-aniversario-reserva-toro-2025",
        "93 Cigar Aficionado Top 25 Toro exact rating",
        "exact product"
      );
    }

    if (/VINTAGE/.test(productName)) {
      return finalCoverageProfile(
        "Aladino",
        "Aladino Vintage Selection",
        "Blind Man's Puff",
        "https://blindmanspuff.com/blind-cigar-review-jre-aladino-habano-vintage-selection-rothschild/",
        "91 Blind Man's Puff Vintage Selection Rothschild review",
        "line-reference product"
      );
    }

    return finalCoverageProfile(
      "Aladino",
      "Aladino Robusto",
      "Cigar Aficionado",
      "https://www.cigaraficionado.com/ratings/20065/name/aladino-robusto-robusto",
      "93 Cigar Aficionado Robusto exact rating",
      "exact product"
    );
  }

  if (/^LEAF BY OSCAR/.test(productName)) {
    return finalCoverageProfile(
      "Oscar Valladares",
      "Leaf by Oscar Connecticut",
      "CIGAR.com",
      "https://www.cigar.com/product/leaf-by-oscar-connecticut/LO1-PM.html",
      "4.5/5 from 22 CIGAR.com customer reviews",
      "line-level"
    );
  }

  if (/^OSCAR 2012 MADURO/.test(productName)) {
    return finalCoverageProfile(
      "Oscar Valladares",
      "Oscar Valladares 2012 Maduro Toro",
      "Cigars Daily",
      "https://cigarsdaily.com/product/oscar-valladares-2012-maduro-toro-6x52/",
      "Customer reviews include 1/5 and 5/5 ratings",
      "exact product"
    );
  }

  if (/^OLMEC\b/.test(productName)) {
    return finalCoverageProfile(
      "Foundation",
      "Olmec Maduro Robusto",
      "Cigar Aficionado",
      "https://www.cigaraficionado.com/ratings/24337/name/olmec-maduro-robusto-robusto",
      "90 Cigar Insider Maduro Robusto line-reference rating",
      "line-reference product"
    );
  }

  if (/^PLASENCIA ALMA FUERTE/.test(productName)) {
    return finalCoverageProfile(
      "Plasencia",
      "Plasencia Alma Fuerte Robustus I",
      "Cigar Aficionado",
      "https://www.cigaraficionado.com/ratings/21748/name/plasencia-alma-fuerte-robustus-i",
      "91 Cigar Aficionado Robustus I line-reference rating",
      "line-reference product"
    );
  }

  if (/^PLASENCIA EXPLORER SAMPLER/.test(productName)) {
    return finalCoverageProfile(
      "Plasencia",
      "Plasencia Explorer Collection Sampler",
      "Famous Smoke Shop",
      "https://www.famous-smoke.com/plasencia-coleccin-explorador-6-cigar-sampler-cigars-varies-sampler-of-6",
      "Exact sampler page cites rated component Plasencia selections",
      "exact sampler"
    );
  }

  if (/^PLASENCIA TRIUNFAL/.test(productName)) {
    return noPublicReviewStatusProfile(
      "Plasencia",
      "Plasencia Triunfal 2026",
      "Neptune Cigar",
      "https://www.neptunecigar.com/cigars/plasencia-triunfal-61-4--54"
    );
  }

  if (/^CHARTER OAK HABANO/.test(productName)) {
    return finalCoverageProfile(
      "Foundation",
      "Charter Oak CT Habano",
      "Cigar Aficionado",
      "https://origin.cigaraficionado.com/ratings/25910/name/charter-oak-ct-habano-lonsdale-toro",
      "90 Cigar Aficionado CT Habano line-reference rating",
      "line-reference product"
    );
  }

  if (/^ASYLUM\b/.test(productName)) {
    if (/^ASYLUM 13\b/.test(productName) && !/OGRE/.test(productName)) {
      return finalCoverageProfile(
        "Asylum",
        "Asylum 13",
        "CIGAR.com",
        "https://www.cigar.com/product/asylum-13-cigars/TU2-PM.html",
        "5/5 from 25 CIGAR.com customer reviews",
        "line-level"
      );
    }

    if (/OGRE/.test(productName)) {
      return finalCoverageProfile(
        "Asylum",
        "Asylum 13 Ogre 7x70",
        "Cigars Daily",
        "https://cigarsdaily.com/product/asylum-13-ogre-7x70/",
        "4/5 from 2 Cigars Daily customer reviews",
        "line-reference product"
      );
    }

    if (/INSIDIOUS/.test(productName) && !/MADURO/.test(productName)) {
      return finalCoverageProfile(
        "Asylum",
        "Asylum Insidious",
        "Cigars International",
        "https://www.cigarsinternational.com/product/asylum-insidious/T12-PM.html",
        "5/5 from 67 Cigars International customer ratings",
        "line-level"
      );
    }

    if (/INSIDIOUS MADURO/.test(productName)) {
      return finalCoverageProfile(
        "Asylum",
        "Asylum Insidious Maduro",
        "Cigars International",
        "https://www.cigarsinternational.com/product/asylum-insidious-maduro/T15-PM.html",
        "4.5/5 from 28 Cigars International customer ratings",
        "line-level"
      );
    }
  }

  if (/^KAREN BERGER CONNECTICUT/.test(productName)) {
    return finalCoverageProfile(
      "Karen Berger",
      "K by Karen Berger Connecticut",
      "Karen Berger Cigars",
      "https://karenbergercigars.com/connecticut/",
      "93 Cigar Journal line rating",
      "line-level"
    );
  }

  if (/^KAREN BERGER HABANO/.test(productName)) {
    return finalCoverageProfile(
      "Karen Berger",
      "K by Karen Berger Habano",
      "Neptune Cigar",
      "https://www.neptunecigar.com/cigar/k-by-karen-berger-habano",
      "Neptune Habano customer-review line page",
      "line-level"
    );
  }

  if (/^KAREN BERGER SAMPLER/.test(productName)) {
    return finalCoverageProfile(
      "Karen Berger",
      "K by Karen Berger Connecticut",
      "Karen Berger Cigars",
      "https://karenbergercigars.com/connecticut/",
      "93 Cigar Journal component-line rating",
      "component line-reference"
    );
  }

  if (/^KAREN BERGER MADURO/.test(productName)) {
    return finalCoverageProfile(
      "Karen Berger",
      "Karen Berger Maduro Toro",
      "Cigarworld.de",
      "https://www.cigarworld.de/en/zigarren/nicaragua/karen-berger-maduro-toro-90017430_50933",
      "92 Cigar Journal exact Toro rating",
      "line-reference product"
    );
  }

  if (/^NEW CUBA CONNECTICUT|^NEW CUBA SUPERIOR CONNECTICUT/.test(productName)) {
    return finalCoverageProfile(
      "New Cuba",
      "New Cuba Connecticut",
      "Neptune Cigar",
      "https://www.neptunecigar.com/cigar/new-cuba-connecticut",
      "Overall 3.9/5 from 49 Neptune customer reviews",
      "line-level"
    );
  }

  if (/^NEW CUBA COROJO/.test(productName)) {
    if (/TORO/.test(productName)) {
      return finalCoverageProfile(
        "New Cuba",
        "New Cuba Corojo Toro",
        "Neptune Cigar",
        "https://www.neptunecigar.com/cigars/new-cuba-corojo-toro",
        "Neptune exact product page with User Ratings & Reviews",
        "exact product"
      );
    }

    return finalCoverageProfile(
      "New Cuba",
      "New Cuba Corojo Titan",
      "Neptune Cigar",
      "https://www.neptunecigar.com/cigars/new-cuba-corojo-titan",
      "Overall 3.67/5 from 21 Neptune customer reviews",
      "line-reference product"
    );
  }

  if (/^PERLA DEL MAR MADURO|^PERLA DEL MAR TORO GRANDE MADURO/.test(productName)) {
    return finalCoverageProfile(
      "Perla del Mar",
      "Perla del Mar Maduro",
      "Cigars International",
      "https://www.cigarsinternational.com/product/perla-del-mar-maduro/PDU-PM.html",
      "4.5/5 from 27 Cigars International customer ratings",
      "line-level"
    );
  }

  if (/^PERLA DEL MAR SHADE/.test(productName)) {
    return finalCoverageProfile(
      "Perla del Mar",
      "Perla del Mar Shade",
      "Neptune Cigar",
      "https://www.neptunecigar.com/cigar/perla-del-mar-shade",
      "Overall 4.35/5 from 128 Neptune customer reviews",
      "line-level"
    );
  }

  if (/^BACCARAT MADURO/.test(productName)) {
    return finalCoverageProfile(
      "Baccarat",
      "Baccarat The Game Maduro Rothschild",
      "Cigars Daily",
      "https://cigarsdaily.com/product/baccarat-the-game-maduro-rothschild-5x50/",
      "4.57/5 from 7 Cigars Daily customer reviews",
      "line-reference product"
    );
  }

  if (/^BACCARAT NATURAL/.test(productName)) {
    return finalCoverageProfile(
      "Baccarat",
      "Baccarat Natural",
      "Cigar World",
      "https://www.cigarworld.com/cigars/baccarat/baccarat-natural/reviews/",
      "Cigar World customer review page",
      "line-level"
    );
  }

  if (/^NEW CUBA COROJO TITAN/.test(productName)) {
    return finalCoverageProfile(
      "New Cuba",
      "New Cuba Corojo Titan",
      "Neptune Cigar",
      "https://www.neptunecigar.com/cigars/new-cuba-corojo-titan",
      "Overall 3.67/5 from 21 Neptune customer reviews",
      "exact product"
    );
  }

  if (/^CACTUS JOE COFFEE/.test(productName)) {
    return noPublicReviewStatusProfile(
      "Cactus Joe",
      "Cactus Joe Coffee",
      "Sunset Wholesale West",
      "https://sunsetwholesalewest.com/premium-cigars/"
    );
  }

  if (/^ASYLUM SERENITY INSANITY/.test(productName)) {
    return finalCoverageProfile(
      "Asylum",
      "Asylum Serenity Now",
      "Cigar Dojo",
      "https://cigardojo.com/2025/03/asylum-serenity-now-54x6/",
      "89% Cigar Dojo Serenity Now 54x6 review",
      "line-reference product"
    );
  }

  if (/^SCHIZO MADURO/.test(productName)) {
    return finalCoverageProfile(
      "Schizo",
      "Schizo Maduro",
      "Cigars International",
      "https://www.cigarsinternational.com/product/schizo-maduro/SZP-PM.html",
      "4.5/5 from 176 Cigars International customer ratings",
      "line-level"
    );
  }

  if (/^SCHIZO\b/.test(productName)) {
    return finalCoverageProfile(
      "Schizo",
      "Schizo",
      "Cigars International",
      "https://www.cigarsinternational.com/product/schizo/SZO-PM.html",
      "4.5/5 from 137 Cigars International customer ratings",
      "line-level"
    );
  }

  if (/^GRAN HABANO/.test(productName)) {
    if (/#?1\b/.test(productName)) {
      return finalCoverageProfile(
        "Gran Habano",
        "Gran Habano #1 Connecticut",
        "CIGAR.com",
        "https://www.cigar.com/p/gran-habano-1-connecticut-cigars/1411176/",
        "CIGAR.com customer-review line page",
        "line-level"
      );
    }

    return finalCoverageProfile(
      "Gran Habano",
      "Gran Habano #5 Corojo",
      "CIGAR.com",
      "https://www.cigar.com/product/gran-habano-5-corojo/GAL-PM.html",
      "5/5 from 16 CIGAR.com customer reviews",
      "line-level"
    );
  }

  if (/^DIESEL\b/.test(productName)) {
    if (/SHERRY CASK/.test(productName)) {
      return finalCoverageProfile(
        "Diesel",
        "Diesel Whiskey Row Sherry Cask",
        "Cigars International",
        "https://www.cigarsinternational.com/p/diesel-whiskey-row-sherry-cask/2024169/",
        "4.5/5 from 131 Cigars International customer ratings",
        "line-level"
      );
    }

    return finalCoverageProfile(
      "Diesel",
      "Diesel Whiskey Row",
      "CIGAR.com",
      "https://www.cigar.com/product/diesel-whiskey-row/J64-PM.html",
      "4.5/5 from 111 CIGAR.com customer reviews",
      "line-level"
    );
  }

  if (/^CHILLIN MOOSE/.test(productName)) {
    return finalCoverageProfile(
      "Chillin' Moose",
      "Chillin' Moose",
      "Cigars International",
      "https://www.cigarsinternational.com/p/chillin-moose-cigars/2067500/",
      "4.56/5 from 267 Cigars International customer ratings",
      "line-level"
    );
  }

  if (/^SHADY MOOSE/.test(productName)) {
    return finalCoverageProfile(
      "Chillin' Moose",
      "Shady Moose",
      "CIGAR.com",
      "https://www.cigar.com/p/shady-moose-cigars/2043169/",
      "4.5/5 from 13 CIGAR.com customer reviews",
      "line-level"
    );
  }

  if (/^CAZADORES\b/.test(productName)) {
    return finalCoverageProfile(
      "Alec Bradley",
      "Alec Bradley Cazadores Toro",
      "Cigars International",
      "https://www.cigarsinternational.com/p/alec-bradley-cazadores-cigar/2066946/",
      "4.23/5 from 84 Cigars International customer ratings",
      "line-level"
    );
  }

  if (/^H UPMANN THE BANKER DAYTRADER/.test(productName)) {
    return finalCoverageProfile(
      "H. Upmann",
      "H. Upmann The Banker Day Trader",
      "CIGAR.com",
      "https://www.cigar.com/product/h-upmann-banker-day-trader/HBD-PM.html",
      "5/5 from 1 CIGAR.com customer review",
      "line-level"
    );
  }

  if (/^H\.?UPMANN ROBUSTO BY AJ/.test(productName)) {
    return finalCoverageProfile(
      "H. Upmann",
      "H. Upmann by AJ Fernandez",
      "CIGAR.com",
      "https://www.cigar.com/product/h-upmann-by-aj-fernandez/HUU-PM.html",
      "4.5/5 from 64 CIGAR.com customer reviews",
      "line-level"
    );
  }

  if (/^VILLIGER MINI/.test(productName)) {
    if (/ESPRESSO/.test(productName)) {
      return finalCoverageProfile(
        "Villiger",
        "Villiger Mini Espresso",
        "Cigar Smoke Shop",
        "https://cigarsmokeshop.net/proddetail.php?prod=Villiger+Mini+Espresso",
        "3/5 from 25 Cigar Smoke Shop user ratings",
        "exact product"
      );
    }

    return finalCoverageProfile(
      "Villiger",
      "Villiger Mini Cigarillos",
      "Cigars International",
      "https://www.cigarsinternational.com/p/villiger-mini-red-vanilla-cigarillos-cigars/2019937/",
      "4.5/5 from 68 Cigars International customer ratings",
      "line-level"
    );
  }

  if (/^JOYA.*CABINETTA/.test(productName)) {
    return finalCoverageProfile(
      "Joya de Nicaragua",
      "Joya de Nicaragua Cabinetta",
      "CIGAR.com",
      "https://www.cigar.com/product/joya-de-nicaragua-cabinetta/JNC-PM.html",
      "4.5/5 from 18 CIGAR.com customer reviews",
      "line-level"
    );
  }

  if (/^6 X 60 SAMPLER/.test(productName)) {
    return finalCoverageProfile(
      "J.C. Newman",
      "J.C. Newman 6x60 Sesenta Sampler",
      "Best Cigar Prices",
      "https://www.bestcigarprices.com/cigar-directory/samplers-cigars/j.c.-newman-6x60-sesenta-4-pack-sampler-221712/",
      "5/5 from 12 Best Cigar Prices customer ratings",
      "exact sampler"
    );
  }

  if (/^AGING ROOM NICARAGUA MAESTRO SAMPLER/.test(productName)) {
    return finalCoverageProfile(
      "Aging Room",
      "Aging Room Quattro Nicaragua Maestro",
      "Cigar Aficionado",
      "https://www.cigaraficionado.com/top25cigar/aging-room-quattro-nicaragua-maestro-2019",
      "96 Cigar Aficionado Cigar of the Year component rating",
      "component line-reference"
    );
  }

  if (/^OMAR ORTEZ/.test(productName)) {
    return finalCoverageProfile(
      "Omar Ortez",
      "Omar Ortez",
      "Cigars.com",
      "https://www.cigars.com/cigars/handmade-cigars/omar-ortez-cigars/",
      "4.8 average Cigars.com customer review across Omar Ortez lines",
      "component line-level"
    );
  }

  if (/^COJIMAR HONEY BLUEBERRY/.test(productName)) {
    return noPublicReviewStatusProfile(
      "Cojimar",
      "Cojimar Honey Blueberry",
      "Cojimar",
      "https://www.cojimars.com/cigars"
    );
  }

  if (/^OUTCAST/.test(productName)) {
    return finalCoverageProfile(
      "Outcast",
      "Outcast",
      "Mike's Cigars",
      "https://mikescigars.com/cigars/brands/outcast",
      "100% from 4 Mike's Cigars customer reviews",
      "line-level"
    );
  }

  if (/^ALEC BRADLEY TORO.*FRESH PACK/.test(productName)) {
    return finalCoverageProfile(
      "Alec Bradley",
      "Alec Bradley Toro Fresh Pack",
      "Cigars.com",
      "https://www.cigars.com/item/alec-bradley-cigars/toro-fresh-pack-54pks/AB4TFP.html",
      "Cigars.com fresh-pack page cites all components above 90 rating",
      "component line-reference"
    );
  }

  if (/^ODYSSEY CONNECTICUT/.test(productName)) {
    return finalCoverageProfile(
      "Odyssey",
      "Odyssey Connecticut",
      "Cigars International",
      "https://www.cigarsinternational.com/p/odyssey-connecticut-cigars/1510048/",
      "4.5/5 from 304 Cigars International customer ratings",
      "line-level"
    );
  }

  if (/^CASA MAGNA COLORADO/.test(productName)) {
    return finalCoverageProfile(
      "Casa Magna",
      "Casa Magna Colorado Robusto",
      "Cigar Aficionado",
      "https://www.cigaraficionado.com/ratings/16482/name/casa-magna-colorado-robusto",
      "94 Cigar Aficionado listed review / 93 Cigar of the Year context",
      "exact product"
    );
  }

  if (/^TATASCAN CONNECTICUT/.test(productName)) {
    return finalCoverageProfile(
      "Tatascan",
      "Tatascan Connecticut",
      "JR Cigars",
      "https://www.jrcigars.com/cigars/handmade-cigars/tatascan-connecticut/",
      "5/5 from 1 JR Cigars customer review",
      "line-level"
    );
  }

  if (/^TRINIDAD ESPIRITU SERIES 3/.test(productName)) {
    return finalCoverageProfile(
      "Trinidad",
      "Trinidad Espiritu Series No. 3",
      "CIGAR.com",
      "https://www.cigar.com/p/trinidad-espiritu-series-no-3-cigars/2045559/",
      "5/5 from 1 CIGAR.com customer review and 95 Cigar Aficionado rating context",
      "line-level"
    );
  }

  if (/^TRADER JACKS MIDNIGHT/.test(productName)) {
    return finalCoverageProfile(
      "Trader Jack's",
      "Trader Jack's Midnight",
      "Cigar World",
      "https://www.cigarworld.com/cigars/trader-jacks/midnight/reviews/",
      "Cigar World customer review page",
      "line-level"
    );
  }

  if (/^TRADER JACKS/.test(productName)) {
    return finalCoverageProfile(
      "Trader Jack's",
      "Trader Jack's Bag",
      "LM Cigars",
      "https://lmcigars.com/product/trader-jacks-bag/",
      "4.96/5 from 27 LM Cigars customer reviews",
      "line-level"
    );
  }

  if (/^HAVANA Q/.test(productName)) {
    return finalCoverageProfile(
      "Havana Q",
      "Havana Q by Quorum Double Robusto",
      "Leaf Enthusiast",
      "https://www.leafenthusiast.com/cigar-review-havana-q-by-quorum/",
      "8.5/10 Leaf Enthusiast Double Robusto review",
      "line-reference product"
    );
  }

  if (/^CAZADORES NICARAGUA/.test(productName)) {
    return finalCoverageProfile(
      "La Aurora",
      "La Aurora Cazadores Nicaragua Robusto",
      "Cigar Aficionado",
      "https://www.cigaraficionado.com/ratings/25862/name/la-aurora-cazadores-nicaragua-robusto-robusto",
      "89 Cigar Aficionado Nicaragua Robusto line-reference rating",
      "line-reference product"
    );
  }

  if (/^NATIONAL BRAND.*IMPERIAL MADURO/.test(productName)) {
    return finalCoverageProfile(
      "National Brand",
      "National Imperial Maduro",
      "Best Cigar Prices",
      "https://www.bestcigarprices.com/cigar-directory/national-cigars/national-imperial-maduro-9824/",
      "5/5 from 8 Best Cigar Prices customer ratings",
      "exact product"
    );
  }

  if (/^NATIONAL BRAND CHURCHILL/.test(productName)) {
    return finalCoverageProfile(
      "National Brand",
      "National Brand Churchill",
      "Neptune Cigar",
      "https://www.neptunecigar.com/cigars/national-brand-churchill",
      "Overall 4.18/5 from 52 Neptune customer reviews",
      "exact product"
    );
  }

  if (/^BRIOSO/.test(productName)) {
    return finalCoverageProfile(
      "Brioso",
      "Brioso",
      "Cigar World",
      "https://www.cigarworld.com/cigars/brioso/brioso/reviews/",
      "Cigar World customer review page",
      "line-level"
    );
  }

  if (/^AL CAPONE/.test(productName)) {
    return finalCoverageProfile(
      "Al Capone",
      "Al Capone Sweets Filtered",
      "Cigar Chief",
      "https://cigarchief.com/shop/al-capone-sweets-filtered/",
      "3.50/5 from 2 Cigar Chief customer reviews",
      "line-reference product"
    );
  }

  return undefined;
}

function getArturoFuenteDonCarlosReviewProfile(productName: string) {
  if (/ROBUSTO/.test(productName) && !/DBL|DOUBLE/.test(productName)) {
    return arturoFuenteCigarAficionadoProfile(
      "Don Carlos Robusto",
      "https://www.cigaraficionado.com/ratings/22809/name/arturo-fuente-don-carlos-robusto",
      "94 Cigar Aficionado listed review",
      [
        "Cigar Aficionado lists Don Carlos Robusto reviews including a 94-point Cigar Aficionado entry.",
        "The review page identifies the Robusto as a Cameroon-wrapped Dominican Fuente cigar.",
        "Visible tasting notes emphasize citrus, tea, honey, wood, raisin, herbal tones, and brown sugar.",
      ]
    );
  }

  if (/NO\.?\s*2/.test(productName)) {
    return arturoFuenteCigarAficionadoProfile(
      "Don Carlos",
      "https://www.cigaraficionado.com/ratings/16969/name/arturo-fuente-don-carlos-no-2",
      "94 Cigar Aficionado exact review",
      [
        "Cigar Aficionado gives the Don Carlos No. 2 a 94-point rating and notes Top 25 recognition.",
        "The page describes the Don Carlos line as Cameroon-wrapped and built with aged Fuente tobaccos.",
        "Visible tasting notes center on nut, cocoa, spice, and sweet cedar.",
      ]
    );
  }

  return arturoFuenteCigarAficionadoProfile(
    "Don Carlos Double Robusto",
    "https://www.cigaraficionado.com/ratings/16969/name/arturo-fuente-don-carlos-no-2",
    "94 Cigar Aficionado Don Carlos No. 2 line-reference rating",
    [
      "Cigar Aficionado's Don Carlos No. 2 page provides source-backed Don Carlos line context and a 94-point anchor rating.",
      "The page describes the line as Cameroon-wrapped with Dominican filler and binder tobaccos.",
      "Use this as line-level Don Carlos coverage for non-No. 2 sizes until exact vitola reviews are added.",
    ]
  );
}

function getArturoFuenteHemingwayReviewProfile(productName: string) {
  if (/BEST SELLER/.test(productName)) {
    return arturoFuenteCigarAficionadoProfile(
      "Hemingway Best Seller",
      "https://www.cigaraficionado.com/ratings/20270/name/arturo-fuente-hemingway-best-seller",
      "91 Cigar Insider / 90 Cigar Aficionado listed review",
      [
        "Cigar Aficionado's page lists Best Seller reviews including 91-point and 90-point entries.",
        "The page identifies the cigar as a Cameroon-wrapped Fuente perfecto.",
        "Visible tasting notes include almond, sweet spice, candied orange peel, and gingerbread.",
      ]
    );
  }

  if (/CLASSIC/.test(productName)) {
    return arturoFuenteCigarAficionadoProfile(
      "Hemingway Classic",
      "https://www.cigaraficionado.com/ratings/20268/name/arturo-fuente-hemingway-classic",
      "92 Cigar Aficionado exact review",
      [
        "Cigar Aficionado lists multiple 92-point Hemingway Classic reviews.",
        "The page identifies the Classic as a Cameroon-wrapped Dominican figurado.",
        "Visible tasting notes emphasize toast, wood, tea, cashew, and caramel.",
      ]
    );
  }

  if (/MASTERPIECE/.test(productName)) {
    return arturoFuenteCigarAficionadoProfile(
      "Hemingway Masterpiece",
      "https://www.cigaraficionado.com/ratings/23617/name/arturo-fuente-hemingway-masterpiece-figurado",
      "92 Cigar Aficionado exact review",
      [
        "Cigar Aficionado lists a 92-point review for the nine-inch Hemingway Masterpiece.",
        "The page identifies the cigar as a Cameroon-wrapped Dominican figurado.",
        "Visible tasting notes include chocolate, coconut, macadamia, bitter orange peel, and herbs.",
      ]
    );
  }

  if (/SHORT STORY/.test(productName)) {
    return arturoFuenteCigarAficionadoProfile(
      "Hemingway Short Story",
      "https://www.cigaraficionado.com/ratings/22689/name/arturo-fuente-hemingway-short-story",
      "92 Cigar Aficionado exact review",
      [
        "Cigar Aficionado gives the Hemingway Short Story a 92-point rating.",
        "The page identifies the Short Story as a four-inch Cameroon-wrapped Dominican figurado.",
        "Visible tasting notes include toasted almond, spice, wood, caramel, coffee, chocolate, and vanilla.",
      ]
    );
  }

  if (/SIGNATURE/.test(productName)) {
    return arturoFuenteCigarAficionadoProfile(
      "Hemingway Signature",
      "https://www.cigaraficionado.com/ratings/20272/name/arturo-fuente-hemingway-signature",
      "92 Cigar Aficionado listed review",
      [
        "Cigar Aficionado's Hemingway Signature page lists 92-point Cigar Aficionado reviews.",
        "The page identifies the Signature as a six-inch Cameroon-wrapped Dominican figurado.",
        "Visible tasting notes emphasize wood, nutmeg, citrus, walnut, fruit, and earthy tones across listed reviews.",
      ]
    );
  }

  if (/MADURO/.test(productName)) {
    return arturoFuenteCigarAficionadoProfile(
      "Hemingway Work of Art Maduro",
      "https://www.cigaraficionado.com/ratings/20858/name/arturo-fuente-hemingway-work-of-art-maduro-figurado",
      "92 Cigar Aficionado exact review",
      [
        "Cigar Aficionado gives the Hemingway Work of Art Maduro a 92-point rating.",
        "The page identifies the cigar as a Connecticut Broadleaf-wrapped Dominican figurado.",
        "Visible tasting notes include wood, leather, licorice, and chocolate.",
      ]
    );
  }

  return arturoFuenteCigarAficionadoProfile(
    "Hemingway Work of Art",
    "https://www.cigaraficionado.com/ratings/23615/name/arturo-fuente-hemingway-work-of-art",
    "95 Cigar Aficionado listed review",
    [
      "Cigar Aficionado's Hemingway Work of Art page lists a 95-point Cigar Aficionado review.",
      "The page identifies the cigar as a Cameroon-wrapped Dominican figurado.",
      "Visible tasting notes mention almond, cinnamon, spice, baked apple, raisin, and a woody finish.",
    ]
  );
}

function getArturoFuenteChateauReviewProfile(productName: string) {
  if (/CUBAN BELICOSO/.test(productName)) {
    return arturoFuenteCigarAficionadoProfile(
      "Chateau Fuente Cuban Belicoso Sun Grown",
      "https://www.cigaraficionado.com/rating/arturo-fuente-chateau-fuente-sungrown-cuban-belicoso",
      "92 Cigar Aficionado profile rating",
      [
        "Cigar Aficionado's Cuban Belicoso Sun Grown page lists a 92-point review.",
        "The page identifies the cigar as an Ecuador-wrapped Dominican figurado.",
        "Visible tasting notes include wood, leather, nut, black cherry, and medium-full body.",
      ]
    );
  }

  if (/KING T/.test(productName)) {
    return arturoFuenteCigarAficionadoProfile(
      "Chateau Fuente King T",
      "https://www.cigaraficionado.com/ratings/23567/name/arturo-fuente-chateau-fuente-king-t-tubo",
      "93 Cigar Aficionado listed review",
      [
        "Cigar Aficionado's King T page lists a 93-point Cigar Aficionado review.",
        "The page identifies King T as a Connecticut Shade-wrapped Dominican Churchill.",
        "Visible tasting notes include orange peel, graham cracker, nuts, and even combustion.",
      ]
    );
  }

  if (/KING B/.test(productName)) {
    return arturoFuenteCigarAficionadoProfile(
      "Chateau Fuente King B",
      "https://www.cigaraficionado.com/ratings/14774/name/arturo-fuente-chateau-fuente-kingb",
      "90 Cigar Aficionado exact review",
      [
        "Cigar Aficionado gives Chateau Fuente King B a 90-point rating.",
        "The page identifies the cigar as an Ecuador-wrapped Dominican figurado.",
        "Visible tasting notes include wood, coffee, and nutty flavors.",
      ]
    );
  }

  if (/QUEEN B/.test(productName)) {
    return arturoFuenteCigarAficionadoProfile(
      "Chateau Fuente Queen B",
      "https://www.cigaraficionado.com/ratings/15580/name/arturo-fuente-chateau-fuente-queen-b-figurado",
      "91 Cigar Aficionado exact review",
      [
        "Cigar Aficionado gives Chateau Fuente Queen B a 91-point rating.",
        "The page identifies the cigar as an Ecuador-wrapped Dominican figurado.",
        "Visible tasting notes emphasize toast, coffee bean, and nutty qualities.",
      ]
    );
  }

  if (/ROYAL SALUTE/.test(productName) && /SUN\s*GROWN|SUNGROWN/.test(productName)) {
    return arturoFuenteCigarAficionadoProfile(
      "Chateau Fuente Royal Salute Sun Grown",
      "https://www.cigaraficionado.com/ratings/25384/name/arturo-fuente-chateau-fuente-royal-salute-sun-grown",
      "89 Cigar Aficionado exact review",
      [
        "Cigar Aficionado gives Chateau Fuente Royal Salute Sun Grown an 89-point rating.",
        "The page identifies the cigar as an Ecuador-wrapped Dominican double corona.",
        "Visible tasting notes include cinnamon, wood, toast, vanilla, caramel, and a dry woody finish.",
      ]
    );
  }

  if (/ROYAL SALUTE/.test(productName) && /MADURO/.test(productName)) {
    return arturoFuenteCigarAficionadoProfile(
      "Chateau Fuente Royal Salute Maduro",
      "https://www.cigaraficionado.com/rating/arturo-fuente-chateau-fuente-maduro-1",
      "88 Cigar Aficionado Chateau Maduro line-reference rating",
      [
        "Cigar Aficionado's Chateau Fuente Maduro page gives the Connecticut Broadleaf-wrapped line an 88-point review.",
        "The source is a Chateau Maduro line reference for the same wrapper family, not an exact Royal Salute vitola review.",
        "Visible tasting notes include meaty, rich, bacon, and woody flavors.",
      ]
    );
  }

  if (/ROYAL SALUTE/.test(productName)) {
    return arturoFuenteCigarAficionadoProfile(
      "Chateau Fuente Royal Salute",
      "https://www.cigaraficionado.com/ratings/24411/name/arturo-fuente-chateau-fuente-royal-salute-double-corona",
      "88 Cigar Aficionado exact review",
      [
        "Cigar Aficionado gives Chateau Fuente Royal Salute an 88-point rating.",
        "The page identifies the cigar as a Connecticut Shade-wrapped Dominican double corona.",
        "Visible tasting notes include cream, wood, lemon peel, minerals, and vanilla.",
      ]
    );
  }

  if (/PYRAMID/.test(productName)) {
    return arturoFuenteCigarAficionadoProfile(
      "Chateau Fuente Pyramid",
      "https://www.cigaraficionado.com/ratings/26353/name/arturo-fuente-chateau-fuente-pyramid-figurado",
      "92 Cigar Aficionado listed review",
      [
        "Cigar Aficionado's Chateau Fuente Pyramid page lists a 92-point review.",
        "The page identifies the cigar as a Connecticut Shade-wrapped Dominican figurado.",
        "Visible tasting notes include cinnamon bun, nutmeg, herbs, almond, and mild body.",
      ]
    );
  }

  if (/DOUBLE CHATEAU|DBL CHATEAU/.test(productName) && /SUN\s*GROWN|SUNGROWN/.test(productName)) {
    return arturoFuenteCigarAficionadoProfile(
      "Double Chateau Fuente Sun Grown",
      "https://www.cigaraficionado.com/ratings/14705/name/arturo-fuente-double-chateau-fuente-sun-grown",
      "89 Cigar Aficionado exact review",
      [
        "Cigar Aficionado gives Double Chateau Fuente Sun Grown an 89-point review.",
        "The page identifies the cigar as an Ecuador-wrapped Dominican Churchill.",
        "Visible tasting notes include strong spice, dried apple sweetness, and full-bodied flavor.",
      ]
    );
  }

  if (/DOUBLE CHATEAU|DBL CHATEAU/.test(productName) && /MADURO/.test(productName)) {
    return arturoFuenteCigarAficionadoProfile(
      "Double Chateau Fuente Maduro",
      "https://www.cigaraficionado.com/ratings/23242/name/arturo-fuente-double-chateau-fuente-maduro",
      "90 Cigar Aficionado exact review",
      [
        "Cigar Aficionado gives Double Chateau Fuente Maduro a 90-point review.",
        "The page identifies the cigar as a Connecticut Broadleaf-wrapped Dominican Churchill.",
        "Visible tasting notes include earth, leather, chocolate, coffee, herb, and spice.",
      ]
    );
  }

  if (/DOUBLE CHATEAU|DBL CHATEAU/.test(productName)) {
    return arturoFuenteNeptuneProfile(
      "Double Chateau Fuente Natural",
      "https://www.neptunecigar.com/cigars/arturo-fuente-double-chateau-fuente",
      "4.61/5 from 177 Neptune customer reviews",
      [
        "Neptune lists Double Chateau Fuente Natural with a 4.61 overall customer rating from 177 reviews.",
        "The page identifies the cigar as a Connecticut Shade-wrapped Dominican Churchill.",
        "Visible customer notes describe smooth, mild, nutty, creamy, and consistent construction impressions.",
      ]
    );
  }

  if (/MADURO/.test(productName)) {
    return arturoFuenteCigarAficionadoProfile(
      "Chateau Fuente Maduro",
      "https://www.cigaraficionado.com/rating/arturo-fuente-chateau-fuente-maduro-1",
      "88 Cigar Aficionado exact review",
      [
        "Cigar Aficionado gives Chateau Fuente Maduro an 88-point rating.",
        "The page identifies the cigar as a Connecticut Broadleaf-wrapped Dominican robusto.",
        "Visible tasting notes include meaty, rich, bacon, and woody flavors.",
      ]
    );
  }

  if (/SUN\s*GROWN|SUNGROWN|\bSG\b/.test(productName)) {
    return arturoFuenteCigarAficionadoProfile(
      "Chateau Fuente Sun Grown",
      "https://www.cigaraficionado.com/article/best-bargain-cigars-of-2012-16858",
      "90 Cigar Aficionado article-listed review",
      [
        "Cigar Aficionado's 2012 bargain list includes Chateau Fuente Sungrown Robusto at 90 points.",
        "Use this as line-level Sun Grown Chateau coverage when exact vitola review coverage is not present.",
        "The article also lists Chateau Fuente Sungrown Cuban Belicoso at 90 points and Double Chateau Fuente Sun Grown at 89 points.",
      ]
    );
  }

  return arturoFuenteCigarAficionadoProfile(
    "Chateau Fuente Natural",
    "https://www.cigaraficionado.com/ratings/15458/name/arturo-fuente-chateau-fuente-natural-robusto",
    "86 Cigar Aficionado exact review",
    [
      "Cigar Aficionado gives Chateau Fuente Natural an 86-point rating.",
      "The page identifies the cigar as a Connecticut Shade-wrapped Dominican robusto.",
      "Visible tasting notes include mild body, even burn, stony-mineral tones, and a short finish.",
    ]
  );
}

function getArturoFuenteGranReservaReviewProfile(productName: string) {
  if (/CANONES|CA.?ONES/.test(productName) && /MADURO/.test(productName)) {
    return arturoFuenteCigarAficionadoProfile(
      "Canones Maduro",
      "https://www.cigaraficionado.com/ratings/8617/name/arturo-fuente-canones-maduro",
      "88 Cigar Aficionado exact review",
      [
        "Cigar Aficionado gives Canones Maduro an 88-point rating and lists additional 88-point reviews.",
        "The page identifies the cigar as a Connecticut Broadleaf-wrapped Dominican A-size cigar.",
        "Visible tasting notes include cedar, vanilla, spice, char, floral quality, sweet cream, and chocolate across listed reviews.",
      ]
    );
  }

  if (/CANONES|CA.?ONES/.test(productName)) {
    return arturoFuenteCigarAficionadoProfile(
      "Canones",
      "https://www.cigaraficionado.com/article/best-bargain-cigars-of-2011-16315",
      "88 Cigar Aficionado article-listed review",
      [
        "Cigar Aficionado's 2011 bargain list includes Arturo Fuente Canones at 88 points.",
        "The list identifies the cigar as Dominican, 8 1/2 inches by 52 ring gauge, and value-focused.",
        "Use this as line-level Canones coverage for the natural wrapper until an exact rating page is added.",
      ]
    );
  }

  if (/CAZADORES/.test(productName)) {
    return sourcedArturoFuenteReviewProfile(
      "Cazadores Natural",
      "Cigar Chief",
      "https://cigarchief.com/shop/arturo-fuente-cazadores/",
      "2.5/5 from 2 customer reviews; retailer-cited 87 Cigar Aficionado score",
      [
        "Cigar Chief lists two customer reviews for Arturo Fuente Cazadores and cites an 87 Cigar Aficionado score.",
        "The page identifies the cigar as a 6 by 50 Dominican medium-bodied Cazadores format.",
        "Visible customer sentiment is mixed, so this is retailer/customer coverage rather than an exact expert-review model.",
      ]
    );
  }

  if (/CHURCHILL/.test(productName) && /MADURO/.test(productName)) {
    return arturoFuenteCigarAficionadoProfile(
      "Churchill Maduro",
      "https://www.cigaraficionado.com/ratings/17048/name/arturo-fuente-churchill-maduro",
      "93 Cigar Aficionado listed review",
      [
        "Cigar Aficionado's Churchill Maduro page lists a 93-point Cigar Aficionado review.",
        "The page identifies the cigar as a Connecticut Broadleaf-wrapped Dominican Churchill.",
        "Visible tasting notes include leather, char, dark chocolate, licorice, almonds, and wood across listed reviews.",
      ]
    );
  }

  if (/CHURCHILL/.test(productName)) {
    return arturoFuenteCigarAficionadoProfile(
      "Churchill Natural",
      "https://www.cigaraficionado.com/rating/arturo-fuente",
      "90 Cigar Aficionado exact review",
      [
        "Cigar Aficionado gives Arturo Fuente Churchill a 90-point rating.",
        "The page identifies the cigar as a Cameroon-wrapped Dominican Churchill.",
        "Visible tasting notes include gingerbread, cinnamon, leather, salt, and wood.",
      ]
    );
  }

  if (/CORONA IMPERIAL/.test(productName)) {
    return arturoFuenteCigarAficionadoProfile(
      "Corona Imperial Maduro",
      "https://www.cigaraficionado.com/ratings/6613/name/arturo-fuente-corona-imperial-maduro-toro",
      "88 Cigar Insider exact review",
      [
        "Cigar Aficionado's rating page lists Corona Imperial Maduro at 88 points.",
        "The page identifies the cigar as a Connecticut Broadleaf-wrapped Dominican toro/lonsdale-format cigar.",
        "Visible tasting notes include spice, caramel sweetness, and leather.",
      ]
    );
  }

  if (/CUBAN CORONA/.test(productName) && /MADURO/.test(productName)) {
    return arturoFuenteCigarAficionadoProfile(
      "Cuban Corona Maduro",
      "https://www.cigaraficionado.com/ratings/26533/name/arturo-fuente-cuban-corona-maduro-corona",
      "90 Cigar Aficionado exact review",
      [
        "Cigar Aficionado gives Cuban Corona Maduro a 90-point rating.",
        "The page identifies the cigar as a Connecticut Broadleaf-wrapped Dominican corona.",
        "Visible tasting notes include hickory wood, earth, raisin, and fig jam.",
      ]
    );
  }

  if (/CUBAN CORONA/.test(productName)) {
    return arturoFuenteCigarAficionadoProfile(
      "Cuban Corona",
      "https://www.cigaraficionado.com/ratings/24732/name/arturo-fuente-cuban-corona-corona",
      "92 Cigar Aficionado exact review",
      [
        "Cigar Aficionado gives Cuban Corona a 92-point rating.",
        "The page identifies the cigar as a Cameroon-wrapped Dominican corona.",
        "Visible tasting notes include baking spices, molasses, walnut, raisin, and dried fig.",
      ]
    );
  }

  if (/FLOR FINA|8-5-8/.test(productName) && /MADURO/.test(productName)) {
    return arturoFuenteCigarAficionadoProfile(
      "Flor Fina Maduro 8-5-8",
      "https://www.cigaraficionado.com/ratings/11909/name/arturo-fuente-flor-fina-maduro-8-5-8-toro",
      "87 Cigar Aficionado exact review",
      [
        "Cigar Aficionado gives Flor Fina Maduro 8-5-8 an 87-point rating.",
        "The page identifies the cigar as a Connecticut Broadleaf-wrapped Dominican toro.",
        "Visible tasting notes include cinnamon, cocoa, toasted almonds, and a papery finish.",
      ]
    );
  }

  if (/FLOR FINA|8-5-8/.test(productName)) {
    return arturoFuenteCigarAficionadoProfile(
      "Flor Fina 8-5-8",
      "https://www.cigaraficionado.com/ratings/8610/name/arturo-fuente-flor-fina-8-5-8",
      "89 Cigar Aficionado exact review",
      [
        "Cigar Aficionado's Flor Fina 8-5-8 page lists an 89-point review and additional listed reviews.",
        "The page identifies the cigar as a Cameroon-wrapped Dominican toro-format cigar.",
        "Visible tasting notes include nuts, chocolate, cedar, sweet spice, roasted chestnut, and bittersweet chocolate across listed reviews.",
      ]
    );
  }

  if (/PETIT CORONA/.test(productName)) {
    return arturoFuenteCigarAficionadoProfile(
      "Petit Corona",
      "https://www.cigaraficionado.com/ratings/23009/name/arturo-fuente-petit-corona-petit-corona",
      "91 Cigar Aficionado exact review",
      [
        "Cigar Aficionado gives Petit Corona a 91-point rating and lists another 91-point review.",
        "The page identifies the cigar as a Cameroon-wrapped Dominican petit corona.",
        "Visible tasting notes include wheat, honey, spice, graham cracker, vanilla, citrus, clove, and coffee bean.",
      ]
    );
  }

  if (/ROTH/.test(productName) && /MADURO/.test(productName)) {
    return arturoFuenteCigarAficionadoProfile(
      "Rothschild Maduro",
      "https://www.cigaraficionado.com/ratings/5150/name/arturo-fuente-rothschild-maduro",
      "88 Cigar Aficionado exact review",
      [
        "Cigar Aficionado gives Rothschild Maduro an 88-point rating.",
        "The page identifies the cigar as a Connecticut Broadleaf-wrapped Dominican robusto.",
        "Visible tasting notes include nuts, vanilla, cedar, and citrus.",
      ]
    );
  }

  if (/ROTH/.test(productName)) {
    return arturoFuenteCigarAficionadoProfile(
      "Rothschild Natural",
      "https://www.cigaraficionado.com/ratings/13627/name/arturo-fuente-rothschild-robusto",
      "87 Cigar Aficionado exact review",
      [
        "Cigar Aficionado gives Rothschild Natural an 87-point rating and lists older reviews up to 90 points.",
        "The page identifies the cigar as a Cameroon-wrapped Dominican robusto.",
        "Visible tasting notes include simple woody and nutty impressions with even draw and burn.",
      ]
    );
  }

  if (/SPANISH LONSDALE/.test(productName)) {
    return arturoFuenteCigarAficionadoProfile(
      "Spanish Lonsdale",
      "https://www.cigaraficionado.com/ratings/19999/name/arturo-fuente-spanish-lonsdale-lonsdale",
      "88 Cigar Aficionado exact review",
      [
        "Cigar Aficionado gives Spanish Lonsdale an 88-point rating.",
        "The page identifies the cigar as a Cameroon-wrapped Dominican lonsdale.",
        "Visible tasting notes include earth, malted chocolate, lemon citrus, sweetness, and a chalky finish.",
      ]
    );
  }

  return undefined;
}

function getArturoFuenteValueReviewProfile(productName: string) {
  if (/BREVAS ROYALE/.test(productName) && /MADURO/.test(productName)) {
    return arturoFuenteNeptuneProfile(
      "Brevas Royale Maduro",
      "https://www.neptunecigar.com/cigars/arturo-fuente-maduro-brevas-royale",
      "4.29/5 from 130 Neptune customer reviews",
      [
        "Neptune lists Brevas Royale Maduro with a 4.29 overall customer rating from 130 reviews.",
        "The page's visible review terms include sweet, smooth, mild, good flavor, good construction, and good price.",
        "Use this as retailer/customer sentiment coverage rather than an expert score.",
      ]
    );
  }

  if (/BREVAS ROYALE/.test(productName)) {
    return arturoFuenteNeptuneProfile(
      "Brevas Royale Natural",
      "https://www.neptunecigar.com/cigars/arturo-fuente-brevas-royale",
      "4.3/5 from 165 Neptune customer reviews",
      [
        "Neptune lists Brevas Royale Natural with a 4.3 overall customer rating from 165 reviews.",
        "The page's visible review terms include sweet, smooth, mild, mellow, good price, and good construction.",
        "Use this as retailer/customer sentiment coverage for Natural, It's A Boy, and It's A Girl Brevas Royale packaging.",
      ]
    );
  }

  if (/CUBANITOS/.test(productName) && /MADURO/.test(productName)) {
    return arturoFuenteNeptuneProfile(
      "Cubanitos Maduro",
      "https://www.neptunecigar.com/cigars/arturo-fuente-maduro-cubanitos",
      "4.3/5 from 8 Neptune customer reviews",
      [
        "Neptune lists Cubanitos Maduro with a 4.3 overall customer rating from 8 reviews.",
        "The page identifies the cigarillo as a Connecticut Broadleaf-wrapped Dominican small format.",
        "Visible customer notes describe it as a quick-smoke option with cocoa, leather, coffee, and morning-cigar impressions.",
      ]
    );
  }

  if (/CUBANITOS/.test(productName)) {
    return arturoFuenteNeptuneProfile(
      "Cubanitos Natural",
      "https://www.neptunecigar.com/cigars/arturo-fuente-cubanitos",
      "85 Neptune customer reviews",
      [
        "Neptune lists Cubanitos Natural with 85 customer reviews.",
        "Visible customer notes describe it as a small-format Fuente with mild flavor, good value, and morning-coffee use cases.",
        "Use this as retailer/customer sentiment coverage because no exact publication score was found for the natural Cubanitos SKU.",
      ]
    );
  }

  if (/CURLY HEAD/.test(productName) && /MADURO/.test(productName)) {
    return arturoFuenteNeptuneProfile(
      "Curly Head Maduro",
      "https://www.neptunecigar.com/cigars/arturo-fuente-maduro-curly-head-deluxe",
      "4.31/5 from 144 Neptune customer reviews",
      [
        "Neptune lists Curly Head Deluxe Maduro with a 4.31 overall customer rating from 144 reviews.",
        "The page's visible review terms include sweet, smooth, mild, good flavor, favorite, and good price.",
        "Use this as retailer/customer sentiment coverage for the maduro Curly Head family.",
      ]
    );
  }

  if (/CURLY HEAD/.test(productName) && /DLX|DELUXE/.test(productName)) {
    return arturoFuenteNeptuneProfile(
      "Curly Head Deluxe Natural",
      "https://www.neptunecigar.com/cigars/arturo-fuente-curly-head-deluxe",
      "4.21/5 from 134 Neptune customer reviews",
      [
        "Neptune lists Curly Head Deluxe Natural with a 4.21 overall customer rating from 134 reviews.",
        "The page's visible review terms include sweet, smooth, mild, mellow, good price, and good construction.",
        "Use this as retailer/customer sentiment coverage rather than an expert score.",
      ]
    );
  }

  if (/CURLY HEAD/.test(productName)) {
    return arturoFuenteNeptuneProfile(
      "Curly Head Natural",
      "https://www.neptunecigar.com/cigars/arturo-fuente-curly-head",
      "4.2/5 from 161 Neptune customer reviews",
      [
        "Neptune lists Curly Head Natural with a 4.2 overall customer rating from 161 reviews.",
        "The page's visible review terms include sweet, smooth, mild, mellow, good price, and everyday.",
        "Use this as retailer/customer sentiment coverage for Natural and Claro Curly Head products.",
      ]
    );
  }

  if (/EXQUISITOS/.test(productName) && /MADURO/.test(productName)) {
    return arturoFuenteNeptuneProfile(
      "Exquisitos Maduro",
      "https://www.neptunecigar.com/cigars/arturo-fuente-maduro-exquisitos",
      "4.45/5 from 247 Neptune customer reviews",
      [
        "Neptune lists Exquisitos Maduro with a 4.45 overall customer rating from 247 reviews.",
        "The page's visible review terms include sweet, smooth, mild, good flavor, favorite, creamy, and full of flavor.",
        "Use this as retailer/customer sentiment coverage rather than an expert score.",
      ]
    );
  }

  if (/EXQUISITOS/.test(productName)) {
    return arturoFuenteNeptuneProfile(
      "Exquisitos Natural",
      "https://www.neptunecigar.com/cigars/arturo-fuente-exquisitos",
      "4.29/5 from 153 Neptune customer reviews",
      [
        "Neptune lists Exquisitos Natural with a 4.29 overall customer rating from 153 reviews.",
        "The page's visible review terms include sweet, smooth, mild, mellow, good price, and everyday.",
        "Use this as retailer/customer sentiment coverage for the small-format natural Exquisitos.",
      ]
    );
  }

  return undefined;
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

  const reviewProfile = getFactoryReviewProfile(productName);
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
    size,
    reviewProfile
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

    return combineResearchDetails(base, { wrapper: "African Cameroon" }, size, getArturoFuenteDonCarlosReviewProfile(productName));
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

    return combineResearchDetails(base, { wrapper }, size, getArturoFuenteHemingwayReviewProfile(productName));
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

    return combineResearchDetails(base, { wrapper }, size, getArturoFuenteChateauReviewProfile(productName));
  }

  const granReservaSize = /CANONES|CA.?ONES/.test(productName)
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

    return combineResearchDetails(base, { wrapper }, granReservaSize, getArturoFuenteGranReservaReviewProfile(productName));
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

  const reviewProfile = getPerdomoReviewProfile(productName);

  if (/4 PACK|SAMPLER/.test(productName)) {
    return combineResearchDetails(assortedResearchDetails(), reviewProfile);
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
      size,
      reviewProfile
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
      size,
      reviewProfile
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
      size,
      reviewProfile
    );
  }

  if (/INMENSO/.test(productName)) {
    return combineResearchDetails(
      researchedBlend(
        "Nicaragua",
        /MADURO/.test(productName) ? "Nicaraguan Maduro" : "Nicaraguan Sun Grown",
        "Cuban-seed Nicaraguan",
        "Cuban-seed Nicaraguan",
        "Medium-Full"
      ),
      reviewProfile
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
      size,
      reviewProfile
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
      size,
      reviewProfile
    );
  }

  return undefined;
}

function getOlivaResearch(productName: string) {
  if (!/^OLIVA\b/.test(productName)) {
    return undefined;
  }

  const reviewProfile = getOlivaReviewProfile(productName);

  if (/SAMPLER/.test(productName)) {
    return combineResearchDetails(assortedResearchDetails(), reviewProfile);
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
      size,
      reviewProfile
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
      size,
      reviewProfile
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
      size,
      reviewProfile
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
      size,
      reviewProfile
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
      size,
      reviewProfile
    );
  }

  return undefined;
}

function getMacanudoResearch(productName: string) {
  if (!/^MACANUDO\b/.test(productName)) {
    return undefined;
  }

  const reviewProfile = getMacanudoReviewProfile(productName);

  if (/SAMPLER/.test(productName)) {
    return combineResearchDetails(assortedResearchDetails(), reviewProfile);
  }

  if (/GOLD/.test(productName)) {
    const size = /ASCOT/.test(productName)
      ? researchedSize("Ascot", '4.25"', "32")
      : researchedSize("Crystal", '5.5"', "50");

    return combineResearchDetails(
      researchedBlend("Dominican Republic", "Connecticut Shade", "Mexican San Andres", "Dominican Republic, Mexico", "Mild"),
      size,
      reviewProfile
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
      size,
      reviewProfile
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
      size,
      reviewProfile
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
      size,
      reviewProfile
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
      size,
      reviewProfile
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
      size,
      reviewProfile
    );
  }

  return undefined;
}

function getMontecristoResearch(productName: string) {
  if (!/^MONTECRISTO\b/.test(productName)) {
    return undefined;
  }

  const reviewProfile = getMontecristoReviewProfile(productName);

  if (/SAMPLER|FRESHLOC/.test(productName)) {
    return combineResearchDetails(assortedResearchDetails(), reviewProfile);
  }

  if (/1935 ANNIVERSARY/.test(productName)) {
    const size = /NO\.?\s*2/.test(productName)
      ? researchedSize("No. 2", '6.125"', "52")
      : researchedSize("Toro", '6"', "54");

    return combineResearchDetails(
      researchedBlend("Nicaragua", "Nicaragua", "Nicaragua", "Nicaragua", "Medium-Full"),
      size,
      reviewProfile
    );
  }

  if (/ESPADA/.test(productName)) {
    const size = /GUARD/.test(productName)
      ? researchedSize("Guard", '6"', "50")
      : researchedSize("Ricasso", '5"', "54");

    return combineResearchDetails(
      researchedBlend("Nicaragua", "Nicaraguan Habano Jalapa", "Nicaraguan Habano Jalapa", "Nicaraguan Habano", "Medium-Full"),
      size,
      reviewProfile
    );
  }

  if (/NICARAGUA SERIES/.test(productName)) {
    return combineResearchDetails(
      researchedBlend("Nicaragua", "Nicaragua", "Nicaragua", "Nicaragua", "Full"),
      researchedSize("Toro", '6"', "54"),
      reviewProfile
    );
  }

  if (/PLATINUM/.test(productName)) {
    const size = /CHURCHILL/.test(productName)
      ? researchedSize("Churchill", '7"', "50")
      : researchedSize("Rothchilde", '5"', "50");

    return combineResearchDetails(
      researchedBlend("Dominican Republic", "San Andres", "Dominican Republic", "Dominican Republic, Nicaragua, Peru", "Medium-Full"),
      size,
      reviewProfile
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
      size,
      reviewProfile
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
      size,
      reviewProfile
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
      ]),
      sourcedRockyPatelReviewProfile("Vintage 1990", "https://www.rockypatel.com/cigar/vintage-1990/", "92 brand-cited rating", [
        "Brand profile lists Vintage 1990 sizes including Juniors, Robusto, Churchill, Toro, Torpedo, and Sixty.",
        "The page cites a 92 rating and Cigar Aficionado Top 25 placements in 2004 and 2006.",
        "Rocky Patel describes the blend as medium-bodied leaning milder with an aged Honduran Broadleaf wrapper.",
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
      ]),
      sourcedRockyPatelReviewProfile("Vintage 1992", "https://www.rockypatel.com/cigar/vintage-1992/", "92 brand-cited rating", [
        "Brand profile lists Vintage 1992 sizes including Juniors, Robusto, Churchill, Toro, Torpedo, and Sixty.",
        "The page cites a 92 rating and notes Cigar Aficionado and Cigar Journal award recognition.",
        "Rocky Patel describes the blend around an aged Ecuadorian Sumatra wrapper with Dominican and Nicaraguan fillers.",
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
      ]),
      sourcedRockyPatelReviewProfile("Vintage 1999", "https://www.rockypatel.com/cigar/vintage-1999/", "91 brand-cited profile rating", [
        "Brand profile lists Vintage 1999 sizes from Minis and Juniors through Churchill, Toro, Torpedo, and Sixty.",
        "The page cites 91 ratings from Cigar Snob and Cigar Journal, plus an 88 Cigar Aficionado rating.",
        "Rocky Patel describes the line as a mild Connecticut-shade Vintage cigar.",
      ])
    );
  }

  if (/DECADE/.test(productName)) {
    return combineResearchDetails(
      researchedBlend("Honduras", "Ecuadorian Sumatra", "Mexico", "Honduras, Panama", "Medium-Full"),
      researchedSizeFromMap(productName, [
        [/ROBUSTO/, "Robusto", '5"', "50"],
        [/TORO|DELUXE TUBO/, "Toro", '6.5"', "52"],
      ]),
      sourcedRockyPatelReviewProfile("Decade", "https://www.rockypatel.com/cigar/decade/", "95 brand-cited rating", [
        "Brand profile lists Decade sizes including Robusto, Toro, Toro Tubo, Torpedo, and Emperor.",
        "The page cites a 95 Cigar Aficionado rating and a 2008 Cigar Aficionado Top 25 placement.",
        "Rocky Patel describes the Decade as a 10th-anniversary blend built around a Sumatra wrapper and a rare filler component.",
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
    const reviewProfile = /A-10/.test(productName)
      ? sourcedRockyPatelReviewProfile("The Edge A-10", "https://www.rockypatel.com/cigar/the-edge-a-10/", "90 brand-cited rating", [
          "Brand profile lists The Edge A-10 in Robusto, Toro, and Sixty sizes.",
          "The page cites a 90 Cigar Aficionado rating for the A-10 barber-pole Edge variant.",
          "Rocky Patel describes the A-10 as a Corojo and Maduro wrapper combination released for the Edge anniversary.",
        ])
      : /MADURO/.test(productName)
        ? sourcedRockyPatelReviewProfile("The Edge Maduro", "https://www.rockypatel.com/cigar/the-edge-maduro/", "92 brand-cited rating", [
            "Brand profile lists The Edge Maduro in Robusto, Toro, Torpedo, Battalion, and larger formats.",
            "The page cites a 92 Cigar Aficionado rating, a 91 Cigar Snob rating, and a 90 Cigar Journal rating.",
            "Rocky Patel positions the Maduro wrapper line around consistency, smooth burn, and value.",
          ])
        : /HABANO/.test(productName)
          ? sourcedRockyPatelReviewProfile("The Edge Habano", "https://www.rockypatel.com/cigar/the-edge-habano/", "94 brand-cited rating", [
              "Brand profile lists The Edge Habano in Toro, Torpedo, and Battalion sizes.",
              "The page cites a 94 Cigar Aficionado rating and a 2015 Cigar Aficionado Top 25 placement.",
              "Rocky Patel describes the Habano as a Nicaraguan-rolled Edge with Ecuadorian Habano wrapper and Nicaraguan tobaccos.",
            ])
          : /SUMATRA/.test(productName)
            ? sourcedRockyPatelReviewProfile("The Edge Sumatra", "https://www.rockypatel.com/cigar/the-edge-sumatra/", "91 brand-cited rating", [
                "Brand profile lists The Edge Sumatra in Toro and Torpedo sizes.",
                "The page cites a 91 Cigar Aficionado rating and a 2007 Cigar Aficionado Top 25 placement.",
                "Rocky Patel describes the Sumatra as an Ecuadorian Sumatra-wrapped Edge rolled in Honduras.",
              ])
            : sourcedRockyPatelReviewProfile("The Edge Corojo", "https://www.rockypatel.com/cigar/the-edge-corojo/", "94 brand-cited profile rating", [
                "Brand profile lists The Edge Corojo in Robusto, Toro, Torpedo, Battalion, and larger formats.",
                "The page cites a 94 Cigar Journal rating, plus 90 ratings from Cigar Aficionado and Cigar Snob.",
                "Rocky Patel positions the Corojo line around consistency, smooth burn, and value.",
              ]);

    return combineResearchDetails(
      researchedBlend("Honduras", wrapper, binder, filler, "Medium-Full"),
      researchedSizeFromMap(productName, [
        [/A-10|TORO|TORPEDO/, /TORPEDO/.test(productName) ? "Torpedo" : "Toro", '6"', "52"],
        [/BAT|BATTALION|GORDO/, "Battalion", '6"', "60"],
        [/ROBUSTO/, "Robusto", '5.5"', "50"],
      ]),
      reviewProfile
    );
  }

  if (/^ROCKY PATEL SIXTY\b/.test(productName)) {
    return combineResearchDetails(
      researchedBlend("Nicaragua", "Mexican San Andres Maduro", "Nicaragua", "Nicaragua", "Medium-Full"),
      researchedSizeFromMap(productName, [
        [/ROBUSTO/, "Robusto", '5.5"', "50"],
        [/SIXTY/, "Sixty", '6"', "60"],
        [/TORO/, "Toro", '6.5"', "52"],
      ]),
      sourcedRockyPatelReviewProfile("SIXTY", "https://www.rockypatel.com/cigar/sixty/", "96 brand-cited rating", [
        "Brand profile lists the Sixty line in Robusto, Toro, and Sixty sizes.",
        "The page cites a 96 rating and identifies the line as Cigar Aficionado's No. 1 Cigar of the Free World.",
        "Rocky Patel describes the line as a 60th-birthday release aged at least two years after rolling.",
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
      ]),
      sourcedRockyPatelReviewProfile("Sun Grown Maduro", "https://www.rockypatel.com/cigar/sun-grown-maduro/", "95 brand-cited rating", [
        "Brand profile lists Sun Grown Maduro in Robusto, Toro, Sixty, Lancero, and Petite Belicoso sizes.",
        "The page cites a 95 Cigar Aficionado rating and a No. 2 ranking in Cigar Aficionado's 2016 Top 25.",
        "Rocky Patel describes the line as a Nicaraguan cigar with an oily Broadleaf wrapper.",
      ])
    );
  }

  if (/SUN GROWN/.test(productName)) {
    return combineResearchDetails(
      researchedBlend("Honduras", "Ecuadorian Sun Grown", "Nicaragua", "Dominican Republic, Nicaragua", "Medium-Full"),
      researchedSizeFromMap(productName, [
        [/DELUXE TUBO|TORO/, "Toro", '6"', "52"],
      ]),
      sourcedRockyPatelReviewProfile("Sun Grown", "https://www.rockypatel.com/cigar/sun-grown/", "92 brand-cited profile rating", [
        "Brand profile lists Sun Grown sizes including Juniors, Petite Corona, Robusto, Toro, Torpedo, and Sixty.",
        "The page cites a 92 Cigar Snob rating, plus 91 ratings from Cigar Aficionado and Cigar Journal.",
        "Rocky Patel describes the line as medium-plus with an Ecuadorian Sumatra wrapper.",
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
      ]),
      sourcedRockyPatelReviewProfile("Number 6", "https://www.rockypatel.com/cigar/number-6/", "95 brand-cited rating", [
        "Brand profile lists Number 6 in Corona, Robusto, Toro, and Sixty sizes.",
        "The page cites a 95 Cigar Aficionado rating and a No. 9 Cigar of the Year placement in 2020.",
        "Rocky Patel describes Number 6 as a medium-bodied Honduran Corojo-wrapped blend.",
      ])
    );
  }

  return undefined;
}

function getRomeoResearch(productName: string) {
  if (!/^ROMEO\b|^RYJ\b/.test(productName)) {
    return undefined;
  }

  const reviewProfile = getRomeoReviewProfile(productName);

  if (/SAMPLER|FRESH PACK/.test(productName)) {
    return combineResearchDetails(assortedResearchDetails(), reviewProfile);
  }

  if (/SPAIN MINI/.test(productName)) {
    return combineResearchDetails(
      researchedBlend("Spain", "Natural tobacco leaf", "Cuban-seed tobacco", "Cuban-seed tobacco", "Mild"),
      researchedSize("Mini", '3.25"', "20"),
      reviewProfile
    );
  }

  if (/RESERVA REAL.*TWISTED/.test(productName)) {
    return combineResearchDetails(
      researchedBlend("Dominican Republic", "Ecuadorian Connecticut and Connecticut Broadleaf Maduro", "Nicaragua", "Dominican Republic, Nicaragua", "Mild-Medium"),
      researchedSize("Twisted Toro", '6"', "54"),
      reviewProfile
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
      ]),
      reviewProfile
    );
  }

  if (/CONN\.?NICARAGUA|CONNECTICUT NICARAGUA/.test(productName)) {
    return combineResearchDetails(
      researchedBlend("Nicaragua", "Ecuadorian Connecticut", "Nicaragua", "Nicaragua", "Medium"),
      researchedSizeFromMap(productName, [
        [/BULLY/, "Bully", '5"', "50"],
        [/TORO/, "Toro", '6"', "52"],
      ]),
      reviewProfile
    );
  }

  if (/1875 NICARAGUA/.test(productName)) {
    return combineResearchDetails(
      researchedBlend("Nicaragua", "Nicaragua", "Nicaragua", "Nicaragua", "Medium-Full"),
      researchedSizeFromMap(productName, [
        [/ROBUSTO|BX\/10/, "Robusto", '5"', "50"],
      ]),
      reviewProfile
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
      ]),
      reviewProfile
    );
  }

  if (/RESERVE/.test(productName)) {
    return combineResearchDetails(
      researchedBlend("Honduras", "Ecuadorian Sumatra", "Nicaragua", "Dominican Republic, Nicaragua", "Medium-Full"),
      researchedSizeFromMap(productName, [
        [/CHURCHILL/, "Churchill", '7"', "50"],
        [/ROBUSTO|ROTHSCHILDE/, "Robusto", '5"', "50"],
        [/TORO/, "Toro", '6"', "50"],
      ]),
      reviewProfile
    );
  }

  if (/ROMEO BY RYJ|ROMEO BY ROMEO/.test(productName)) {
    return combineResearchDetails(
      researchedBlend("Dominican Republic", "Ecuadorian Habano", "Dominican Republic", "Dominican Republic, Nicaragua", "Medium-Full"),
      researchedSizeFromMap(productName, [
        [/CHURCHILL/, "Churchill", '7"', "50"],
        [/ROBUSTO/, "Robusto", '5"', "52"],
        [/TORO/, "Toro", '6"', "54"],
      ]),
      reviewProfile
    );
  }

  if (/150TH/.test(productName)) {
    return combineResearchDetails(
      researchedBlend("Dominican Republic", "Ecuadorian Habano", "Dominican Republic", "Dominican Republic, Nicaragua", "Medium"),
      researchedSize("Toro", '6"', "54"),
      reviewProfile
    );
  }

  return undefined;
}

function getTatianaResearch(productName: string) {
  if (!/^TATIANA\b/.test(productName)) {
    return undefined;
  }

  const reviewProfile = getTatianaReviewProfile(productName);

  if (/SAMPLER/.test(productName)) {
    return combineResearchDetails(assortedResearchDetails(), reviewProfile);
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
    size,
    reviewProfile
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

  const reviewProfile = getFactoryReviewProfile(productName);

  return combineResearchDetails(
    researchedBlend("United States", /SWEET/.test(productName) ? "Sumatra" : "Ecuadorian Sun Grown", "Various", "Dominican Republic", "Mild-Medium"),
    researchedSizeFromMap(productName, [
      [/#49/, "No. 49", '5.5"', "49"],
      [/#59/, "No. 59", '6.25"', "45"],
      [/#99/, "No. 99", '7.25"', "52"],
    ]),
    reviewProfile
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

  const reviewProfile = /^MY FATHER\b/.test(productName) ? getMyFatherReviewProfile(productName) : undefined;

  if (/SAMPLER/.test(productName)) {
    return combineResearchDetails(assortedResearchDetails(), reviewProfile);
  }

  if (/BLUE/.test(productName)) {
    return combineResearchDetails(
      researchedBlend("Nicaragua", "Nicaraguan Corojo", "Nicaraguan", "Nicaraguan", "Medium-Full"),
      researchedSizeFromMap(productName, [
        [/PETIT ROBUSTO/, "Petit Robusto", '4.5"', "50"],
        [/TORO GORDO/, "Toro Gordo", '6"', "60"],
        [/ROBUSTO/, "Robusto", '5.25"', "52"],
        [/TORO/, "Toro", '6"', "54"],
      ]),
      reviewProfile
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
      ]),
      reviewProfile
    );
  }

  if (/FLOR DE LAS ANTILLAS/.test(productName)) {
    return combineResearchDetails(
      researchedBlend("Nicaragua", "Nicaraguan Sun Grown", "Nicaragua", "Nicaragua", "Medium"),
      researchedSizeFromMap(productName, [
        [/ROBUSTO/, "Robusto", '5"', "50"],
        [/TORO/, "Toro", '6"', "52"],
      ]),
      reviewProfile
    );
  }

  if (/JAIME GARCIA/.test(productName)) {
    return combineResearchDetails(
      researchedBlend("Nicaragua", "Connecticut Broadleaf Maduro", "Nicaragua", "Nicaragua", "Medium-Full"),
      researchedSizeFromMap(productName, [
        [/ROBUSTO/, "Robusto", '5.25"', "52"],
        [/TORO/, "Toro", '6"', "54"],
      ]),
      reviewProfile
    );
  }

  if (/LE BIJOU/.test(productName)) {
    return combineResearchDetails(
      researchedBlend("Nicaragua", "Ecuadorian Habano Oscuro", "Nicaragua", "Nicaragua", "Full"),
      researchedSizeFromMap(productName, [
        [/TORO/, "Toro", '6"', "52"],
        [/PETIT ROBUSTO/, "Petit Robusto", '4.5"', "50"],
      ]),
      reviewProfile
    );
  }

  return combineResearchDetails(
    researchedBlend("Nicaragua", "Ecuadorian Habano Rosado", "Nicaragua", "Nicaragua", "Medium-Full"),
    researchedSizeFromMap(productName, [
      [/ROBUSTO/, "Robusto", '5.25"', "52"],
      [/TORO/, "Toro", '6"', "52"],
      [/TORPEDO/, "Torpedo", '6.125"', "52"],
    ]),
    reviewProfile
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
    return combineResearchDetails(base, researchedSize("Brevas Royale", '5.5"', "42"), getArturoFuenteValueReviewProfile(productName));
  }

  if (/CUBANITOS/.test(productName)) {
    return combineResearchDetails(base, researchedSize("Cubanitos", '4.5"', "32"), getArturoFuenteValueReviewProfile(productName));
  }

  if (/CURLY HEAD/.test(productName)) {
    return combineResearchDetails(base, researchedSize("Curly Head", '6.5"', "43"), getArturoFuenteValueReviewProfile(productName));
  }

  if (/EXQUISITOS/.test(productName)) {
    return combineResearchDetails(base, researchedSize("Exquisitos", '4.5"', "33"), getArturoFuenteValueReviewProfile(productName));
  }

  return undefined;
}

function getGurkhaResearch(productName: string) {
  if (!/^GURKHA\b/.test(productName)) {
    return undefined;
  }

  const reviewProfile = getGurkhaReviewProfile(productName);

  if (/SAMPLER/.test(productName)) {
    return combineResearchDetails(assortedResearchDetails(), reviewProfile);
  }

  if (/BOURBON/.test(productName)) {
    return combineResearchDetails(
      researchedBlend("Dominican Republic", "Connecticut Shade", "Dominican", "Dominican", "Mild-Medium"),
      researchedSizeFromMap(productName, [
        [/CORONA/, "Corona", '5"', "42"],
        [/TORO/, "Toro", '6"', "50"],
        [/CHURCHILL/, "Churchill", '7"', "50"],
      ]),
      reviewProfile
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
      ]),
      reviewProfile
    );
  }

  if (/PRIVATE SELECT/.test(productName)) {
    return combineResearchDetails(
      researchedBlend("Dominican Republic", "Connecticut Shade", "Dominican", "Dominican", "Mild-Medium"),
      researchedSizeFromMap(productName, [
        [/CORONA/, "Corona", '5"', "42"],
        [/CHURCHILL/, "Churchill", '7.25"', "52"],
      ]),
      reviewProfile
    );
  }

  if (/CASTLE HALL NICARAGUA/.test(productName)) {
    return combineResearchDetails(
      researchedBlend("Nicaragua", "Ecuadorian Habano", "Nicaraguan", "Nicaraguan", "Medium"),
      researchedSizeFromMap(productName, [
        [/ROBUSTO/, "Robusto", '5"', "52"],
        [/TORO/, "Toro", '6"', "54"],
      ]),
      reviewProfile
    );
  }

  if (/CASTLE HALL/.test(productName)) {
    return combineResearchDetails(
      researchedBlend("Dominican Republic", "Ecuadorian Connecticut", "Ecuadorian Habano", "Dominican Republic, Nicaragua", "Mild-Medium"),
      researchedSizeFromMap(productName, [
        [/ROBUSTO/, "Robusto", '5"', "52"],
        [/TORO/, "Toro", '6"', "54"],
      ]),
      reviewProfile
    );
  }

  if (/CELLAR RESV 12YR PLATINUM/.test(productName)) {
    return combineResearchDetails(
      researchedBlend("Nicaragua", "Ecuadorian Habano Oscuro", "Nicaragua", "Nicaragua", "Medium-Full"),
      researchedSizeFromMap(productName, [
        [/SOLARA/, "Solara", '5"', "58"],
        [/HEDONISM/, "Hedonism", '6"', "58"],
        [/KRAKEN/, "Kraken", '6"', "60"],
      ]),
      reviewProfile
    );
  }

  if (/CELLAR RESV 15YR MADURO/.test(productName)) {
    return combineResearchDetails(
      researchedBlend("Dominican Republic", "Brazilian Arapiraca Maduro", "Dominican Olor", "Dominican Republic", "Medium-Full"),
      researchedSizeFromMap(productName, [
        [/SOLARO|SOLARA/, "Solara", '5"', "58"],
        [/HEDONISM/, "Hedonism", '6"', "58"],
      ]),
      reviewProfile
    );
  }

  if (/CELLAR RESV 15YR/.test(productName)) {
    return combineResearchDetails(
      researchedBlend("Dominican Republic", "Dominican Criollo 98", "Dominican Olor", "15 Year Dominican", "Medium-Full"),
      researchedSizeFromMap(productName, [
        [/SOLARO|SOLARA|DBL ROBUSTO/, "Solara", '5"', "58"],
        [/HEDONISM/, "Hedonism", '6"', "58"],
        [/PRISONER|CHURCHILL/, "Prisoner", '7"', "54"],
      ]),
      reviewProfile
    );
  }

  if (/CELLAR RESV 18YR/.test(productName)) {
    return combineResearchDetails(
      researchedBlend("Dominican Republic", "Corojo", "Dominican", "Dominican", "Medium-Full"),
      researchedSizeFromMap(productName, [
        [/HEDONISM|GRAND ROTHSCHILD|HEDONSIM/, "Grand Rothschild", '6"', "58"],
      ]),
      reviewProfile
    );
  }

  if (/GHOST/.test(productName)) {
    return combineResearchDetails(
      researchedBlend("Dominican Republic", "Brazilian Arapiraca Maduro", "Dominican Criollo 98", "Dominican Republic, Nicaragua", "Medium-Full"),
      researchedSizeFromMap(productName, [
        [/ASURA|TORO/, "Asura Toro", '6"', "54"],
        [/SHADOW|ROBUSTO/, "Shadow Robusto", '5"', "52"],
      ]),
      reviewProfile
    );
  }

  if (/HERITAGE MADURO/.test(productName)) {
    return combineResearchDetails(
      researchedBlend("Nicaragua", "Mexican San Andres Maduro", "Nicaragua", "Nicaragua", "Medium-Full"),
      researchedSize("Robusto", '5"', "50"),
      reviewProfile
    );
  }

  if (/NICARAGUA SERIES/.test(productName)) {
    return combineResearchDetails(
      researchedBlend("Dominican Republic", "Corojo", "Cameroon", "Criollo 98, USA, Nicaraguan", "Full"),
      researchedSizeFromMap(productName, [
        [/ROBUSTO/, "Robusto", '5"', "52"],
        [/TORO/, "Toro", '6"', "54"],
      ]),
      reviewProfile
    );
  }

  if (/ROYAL CHALLENGE/.test(productName)) {
    return combineResearchDetails(
      researchedBlend("Dominican Republic", "Ecuadorian Connecticut", "Honduran Habano", "Dominican Republic, Nicaragua", "Mild-Medium"),
      researchedSizeFromMap(productName, [
        [/ROBUSTO/, "Robusto", '5"', "50"],
        [/TORO/, "Toro", '6"', "50"],
      ]),
      reviewProfile
    );
  }

  if (/YEAR OF DRAGON|YEAR OF THE DRAGON/.test(productName)) {
    return combineResearchDetails(
      researchedBlend("Nicaragua", "Mexican San Andres", "Ecuadorian", "Dominican Republic, Nicaragua", "Medium-Full"),
      researchedSize("Figurado", '6.625"', "52"),
      reviewProfile
    );
  }

  return reviewProfile;
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
        [/SIXTY/, "Sixty", '6"', "60"],
        [/TORO/, "Toro", '6.5"', "52"],
        [/ROBUSTO/, "Robusto", '5.5"', "50"],
      ]),
      sourcedRockyPatelReviewProfile("Fifteenth Anniversary", "https://www.rockypatel.com/cigar/fifteenth-anniversary/", "93 brand-cited rating", [
        "Brand profile lists Fifteenth Anniversary in Corona Gorda, Robusto, Toro, Toro Tubo, Torpedo, and Sixty sizes.",
        "The page cites a 93 Cigar Aficionado rating and four Cigar Aficionado Top 25 appearances.",
        "Rocky Patel describes the line as a box-pressed Nicaraguan anniversary blend.",
      ])
    );
  }

  if (/2003 VINTAGE CAMEROON/.test(productName)) {
    return combineResearchDetails(
      researchedBlend("Honduras", "Cameroon", "Nicaragua", "Dominican Republic, Nicaragua", "Medium"),
      researchedSize("Toro", '6.5"', "52"),
      sourcedRockyPatelReviewProfile("Vintage 2003 Cameroon", "https://www.rockypatel.com/cigar/vintage-2003/", "93 brand-cited rating", [
        "Brand profile lists Vintage 2003 Cameroon in Juniors, Robusto, Churchill, Toro, Torpedo, and Sixty sizes.",
        "The page cites a 93 Cigar Aficionado rating and a 2017 Cigar Aficionado Top 25 placement.",
        "Rocky Patel describes the line as a medium-bodied Vintage series cigar with an aged Cameroon wrapper.",
      ])
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
      ]),
      sourcedRockyPatelReviewProfile("A.L.R. Second Edition", "https://www.rockypatel.com/cigar/alr-second-edition/", "96 brand-cited rating", [
        "Brand profile lists A.L.R. Second Edition in Robusto, Toro, and Sixty sizes.",
        "The page cites a 96 Cigar Aficionado rating and a No. 5 Cigar Aficionado Top 25 placement in 2019.",
        "Rocky Patel describes the line as an aged, limited-production San Andres-wrapped blend.",
      ])
    );
  }

  if (/GRAND RESERVE/.test(productName)) {
    return combineResearchDetails(
      researchedBlend("Nicaragua", "Proprietary", "Proprietary", "Proprietary", "Medium"),
      researchedSizeFromMap(productName, [
        [/ROBUSTO/, "Robusto", '5"', "50"],
        [/TORO/, "Toro", '6.5"', "52"],
        [/SIXTY/, "Sixty", '6"', "60"],
      ]),
      sourcedRockyPatelReviewProfile("Grand Reserve", "https://www.rockypatel.com/cigar/grand-reserve/", "93 brand-cited profile rating", [
        "Brand profile lists Grand Reserve in Robusto, Toro, and Sixty sizes.",
        "The page cites a 93 profile rating and a Cigar Journal No. 1 Top 25 placement in 2018.",
        "Rocky Patel describes Grand Reserve as a medium-bodied international-market blend rolled in Honduras.",
      ])
    );
  }

  if (/GOLD LABEL/.test(productName)) {
    return combineResearchDetails(
      researchedBlend("Nicaragua", "Sumatra", "Connecticut Shade and Connecticut Broadleaf", "Nicaraguan Jalapa and Esteli", "Medium-Full"),
      researchedSize("Toro", '6.5"', "52"),
      sourcedRockyPatelReviewProfile("Gold Label", "https://www.rockypatel.com/cigar/gold-label/", "94 brand-cited profile rating", [
        "Brand profile cites a 94 profile rating for Gold Label.",
        "The page describes an Ecuadorian Habano wrapper with Connecticut Shade and Broadleaf binders.",
        "Rocky Patel frames Gold Label around earthy notes, caramel, coffee, and lingering sweetness.",
      ])
    );
  }

  if (/EMERALD/.test(productName)) {
    return combineResearchDetails(
      researchedBlend("Nicaragua", "Ecuadorian Habano", "Nicaragua and Mexico", "Nicaragua, Honduras", "Medium"),
      researchedSize("Robusto", '5.5"', "50"),
      sourcedRockyPatelReviewProfile("Emerald", "https://www.rockypatel.com/cigar/emerald/", "95 brand-cited profile rating", [
        "Brand profile cites a 95 profile rating for Emerald.",
        "The page lists Robusto, Toro, and Sixty sizes for the line.",
        "Rocky Patel describes Emerald as a medium-bodied box-pressed cigar with an Ecuadorian Habano wrapper.",
      ])
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

  const reviewProfile = /^MY FATHER\b/.test(productName) ? getMyFatherReviewProfile(productName) : undefined;

  if (/SAMPLER|HUMID BAG/.test(productName)) {
    return combineResearchDetails(assortedResearchDetails(), reviewProfile);
  }

  if (/FONSECA/.test(productName)) {
    return combineResearchDetails(
      researchedBlend("Nicaragua", /MX EDITION/.test(productName) ? "Mexican San Andres" : "Corojo 99", "Nicaragua", "Nicaragua", "Medium"),
      researchedSizeFromMap(productName, [
        [/ROBUSTO/, "Robusto", '5"', "50"],
        [/TORO/, "Toro", '6.25"', "52"],
        [/CEDROS/, "Cedros", '6.25"', "52"],
      ]),
      reviewProfile
    );
  }

  if (/JUDGE/.test(productName)) {
    return combineResearchDetails(
      researchedBlend("Nicaragua", "Sumatra Oscuro", "Corojo Criollo", "Nicaragua", "Full"),
      researchedSizeFromMap(productName, [
        [/CORONA GORDA/, "Corona Gorda", '5.625"', "46"],
        [/TORO/, "Box-Pressed Toro", '6"', "56"],
      ]),
      reviewProfile
    );
  }

  if (/LA GRAN OFERTA/.test(productName)) {
    return combineResearchDetails(
      researchedBlend("Nicaragua", "Habano Rosado", "Nicaragua", "Nicaragua Habano-Criollo", "Medium"),
      researchedSize("Assorted", "Assorted", "Assorted"),
      reviewProfile
    );
  }

  if (/LA PROMESA/.test(productName)) {
    return combineResearchDetails(
      researchedBlend("Nicaragua", "Ecuadorian Habano Rosado Oscuro", "Nicaragua", "Nicaragua", "Medium-Full"),
      researchedSizeFromMap(productName, [
        [/LANCERO/, "Lancero", '7.5"', "38"],
      ]),
      reviewProfile
    );
  }

  if (/LE BIJOU/.test(productName)) {
    return combineResearchDetails(
      researchedBlend("Nicaragua", "Habano Oscuro-Oscuro", "Nicaragua", "Nicaragua", "Full"),
      researchedSizeFromMap(productName, [
        [/CHURCHILL/, "Churchill", '7"', "50"],
        [/PETITE ROBUSTO|PETIT ROBUSTO/, "Petit Robusto", '4.5"', "50"],
        [/TORPEDO/, "Torpedo Box Pressed", '6.125"', "52"],
      ]),
      reviewProfile
    );
  }

  if (/NO\.?3 CREMAS/.test(productName)) {
    return combineResearchDetails(
      researchedBlend("Nicaragua", "Ecuadorian Habano Rosado", "Nicaragua", "Nicaragua", "Medium-Full"),
      researchedSize("Cremas", '6.5"', "44"),
      reviewProfile
    );
  }

  if (/LA DUENA/.test(productName)) {
    return combineResearchDetails(
      researchedBlend("Nicaragua", "Connecticut Broadleaf", "Connecticut Broadleaf and Nicaragua", "Connecticut Broadleaf and Nicaragua", "Medium-Full"),
      researchedSizeFromMap(productName, [
        [/NO\.?\s*7|\b7\b/, "No. 7 Petit Lancero", '6"', "42"],
        [/NO\.?\s*13|\b13\b/, "No. 13 Toro Gordo", '6"', "56"],
      ]),
      reviewProfile
    );
  }

  if (/EL CENTURION H-?2K-?CT/.test(productName)) {
    return combineResearchDetails(
      researchedBlend("Nicaragua", "Hybrid Habano 2000 Connecticut", "Nicaragua", "Nicaragua", "Medium-Full"),
      researchedSize("Toro", '6"', "52"),
      reviewProfile
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

  const reviewProfile = getMacanudoReviewProfile(productName);

  if (/SAMPLER/.test(productName)) {
    return combineResearchDetails(assortedResearchDetails(), reviewProfile);
  }

  if (/INSPIRADO GREEN/.test(productName)) {
    return combineResearchDetails(
      researchedBlend("Dominican Republic", "Brazilian Arapiraca", "Indonesia", "Colombia, Dominican Republic", "Medium"),
      researchedSizeFromMap(productName, [
        [/ROBUSTO/, "Robusto", '5"', "52"],
        [/TORO/, "Toro", '6"', "50"],
      ]),
      reviewProfile
    );
  }

  if (/INSPIRADO (ORANGE|RED|WHITE).*MINIS/.test(productName)) {
    return combineResearchDetails(researchedSize("Mini", '3"', "20"), reviewProfile);
  }

  if (/MINIATURES/.test(productName)) {
    return combineResearchDetails(
      researchedBlend("Dominican Republic", "Connecticut Shade", "Mexican San Andres", "Dominican Republic, Mexico", "Mild"),
      researchedSize("Miniature", '3.25"', "26"),
      reviewProfile
    );
  }

  if (/\bM ESPRESSO W\/ CREAM\b|M ESPRESSO/.test(productName)) {
    return combineResearchDetails(
      researchedBlend("Nicaragua", "Indonesian barber pole", "Philippine", "Nicaraguan", "Medium"),
      researchedSize("Toro", '6"', "50"),
      reviewProfile
    );
  }

  return undefined;
}

function getMontecristoRemainingResearch(productName: string) {
  if (!/^MONTECRISTO\b/.test(productName)) {
    return undefined;
  }

  const reviewProfile = getMontecristoReviewProfile(productName);

  if (/SAMPLER|FRESHLOC/.test(productName)) {
    return combineResearchDetails(assortedResearchDetails(), reviewProfile);
  }

  if (/1935 ANNIVERSARY|ESPADA|NICARAGUA SERIES|PLATINUM|WHITE|CLASSIC/.test(productName)) {
    return undefined;
  }

  if (/MEMORIES/.test(productName)) {
    return combineResearchDetails(
      researchedBlend("Dominican Republic", "Connecticut Shade", "Dominican Republic", "Dominican Republic", "Mild"),
      researchedSize("Memories", '4"', "33"),
      reviewProfile
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
    ]),
    reviewProfile
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

  const reviewProfile = getRomeoReviewProfile(productName);

  if (/SAMPLER|FRESH PACK/.test(productName)) {
    return combineResearchDetails(assortedResearchDetails(), reviewProfile);
  }

  if (/HABANA RESV|HABANA RESERVE/.test(productName)) {
    return combineResearchDetails(
      researchedBlend("Honduras", "Nicaraguan", "Nicaraguan", "Honduras, Nicaragua", "Medium-Full"),
      researchedSizeFromMap(productName, [
        [/AMORES/, "Amores", '4"', "33"],
      ]),
      reviewProfile
    );
  }

  if (/VINTAGE/.test(productName)) {
    return combineResearchDetails(
      researchedBlend("Dominican Republic", "Ecuadorian Connecticut", "Mexican", "Dominican Republic", "Mild-Medium"),
      researchedSizeFromMap(productName, [
        [/CORONA/, "Corona", '5.5"', "44"],
      ]),
      reviewProfile
    );
  }

  if (/GRAN TORO/.test(productName)) {
    return combineResearchDetails(
      researchedBlend("Dominican Republic", "Ecuadorian Habano", "Dominican Republic", "Dominican Republic, Nicaragua", "Medium-Full"),
      researchedSize("Gran Toro", '6"', "54"),
      reviewProfile
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
  const category = getCatalogCategory(item);
  const lineResearchDetails = getResearchedLineEnrichment(item);
  const researchedDetails = getResearchedCatalogEnrichment(item.slug);
  const finalCoverageDetails = lineResearchDetails.expertReview ||
    lineResearchDetails.reviewProfile ||
    researchedDetails.expertReview ||
    researchedDetails.reviewProfile ||
    !isCigarCategoryAndName(category, item.product)
    ? undefined
    : getFinalCoverageReviewProfile(item.product.toUpperCase());
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
  }, { ...parsedDetails, ...lineResearchDetails, ...finalCoverageDetails, ...researchedDetails });
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
