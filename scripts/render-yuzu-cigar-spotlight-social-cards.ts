import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import { chromium } from "playwright";

import { getCatalogProductBySlug, type CatalogProduct } from "@/lib/catalog";
import { formatCatalogPrice } from "@/lib/catalog-pricing";

type SpotlightCardConfig = {
  slug: string;
  fileStem: string;
  label: string;
  displayName: string;
  hook: string;
  salesAngle: string;
  tastingNotes: string[];
  caption: string;
  images: SpotlightImage[];
};

type SpotlightImage = {
  src: string;
  label: string;
  variant: "main" | "detail" | "close";
};

const outputDir = path.resolve("output/social/yuzu-cigar-spotlight-cards-2026-06-12");
const cardsDir = path.join(outputDir, "cards");
const htmlDir = path.join(outputDir, "html");
const publicDir = path.resolve("public");
const logoPath = "/assets/yuzu-logo.png";

const spotlightCards: SpotlightCardConfig[] = [
  {
    slug: "plasencia-triunfal-2026-10-bx",
    fileStem: "01-plasencia-triunfal-2026",
    label: "Celebration Toro",
    displayName: "Plasencia Triunfal 2026 Toro",
    hook: "A limited 10-count box with polished Honduran character, made for collectors, gifts, and lounge nights.",
    salesAngle: "Join Yuzu to unlock the member price and add a celebration-worthy box before the window closes.",
    tastingNotes: ["Cedar", "Cocoa", "Cream", "Baking spice"],
    caption:
      "Cigar Spotlight: Plasencia Triunfal 2026 Toro. A 10-count celebratory box with Honduran wrapper, Honduran binder, Honduran and Nicaraguan filler, and a medium profile built for collectors and gifting. Join Yuzu Cigar Club to unlock member pricing and shop the box. 21+ only. Age verification and adult signature delivery required.",
    images: [
      { src: "source-images/plasencia-triunfal-2026-product-hero.png", label: "Open box", variant: "main" },
      { src: "source-images/plasencia-triunfal-2026-press-box.jpeg", label: "Closed box", variant: "detail" },
      { src: "source-images/plasencia-triunfal-2026-cigar-strip.png", label: "Long cigar close-up", variant: "close" },
    ],
  },
  {
    slug: "my-father-don-pepin-clasicos-20th-20-bx",
    fileStem: "02-my-father-don-pepin-clasicos-20th",
    label: "Anniversary Full Body",
    displayName: "My Father Don Pepin Clasicos 20th",
    hook: "A 20-count anniversary box with the full Nicaraguan profile My Father fans want in the humidor.",
    salesAngle: "A serious box for seasoned smokers, special gifts, and members who like their cigars with story and strength.",
    tastingNotes: ["Pepper", "Cedar", "Leather", "Cocoa"],
    caption:
      "Cigar Spotlight: My Father Don Pepin Clasicos 20th. A full-strength 20-count Toro Extra box with Nicaraguan Habano wrapper, Nicaraguan binder, and Nicaraguan filler. Expect pepper, cedar, leather, cocoa, and a long evening format. Shop through Yuzu Cigar Club for member pricing. 21+ only. Age verification and adult signature delivery required.",
    images: [
      { src: "source-images/my-father-don-pepin-clasicos-20th-open-box.jpg", label: "Open box", variant: "main" },
      { src: "source-images/my-father-don-pepin-clasicos-20th-closed-box.jpg", label: "Closed box", variant: "detail" },
      { src: "source-images/my-father-don-pepin-clasicos-20th-cigar-strip.png", label: "Long cigar close-up", variant: "close" },
    ],
  },
  {
    slug: "oliva-serie-v-melanio-soccer-edition-24-bx",
    fileStem: "03-oliva-serie-v-melanio-soccer-edition",
    label: "Limited 24-Count Set",
    displayName: "Oliva Serie V Melanio Soccer Edition",
    hook: "A 24-count humidor-style set with natural and maduro Melanio cigars for a collector-grade Yuzu box moment.",
    salesAngle: "A premium member play for buyers who want a special occasion box with a big-format Melanio profile.",
    tastingNotes: ["Coffee", "Cocoa", "Spice", "Sweet earth"],
    caption:
      "Cigar Spotlight: Oliva Serie V Melanio Soccer Edition. This 24-count limited set brings the Melanio profile in a 6 x 60 double toro format with natural and maduro cigars. Nicaraguan binder and filler deliver coffee, cocoa, spice, and sweet earth. Join Yuzu Cigar Club to shop member-priced boxes. 21+ only. Age verification and adult signature delivery required.",
    images: [
      { src: "source-images/oliva-serie-v-melanio-soccer-edition-open-set.png", label: "Open set", variant: "main" },
      { src: "source-images/oliva-serie-v-melanio-soccer-edition-ball-box.png", label: "Closed humidor", variant: "detail" },
      { src: "source-images/oliva-serie-v-melanio-soccer-edition-exact-single-strip.png", label: "Single cigar close-up", variant: "close" },
    ],
  },
  {
    slug: "liga-privada-h99-papas-fritas-10-bx",
    fileStem: "04-liga-privada-h99-papas-fritas",
    label: "Short Luxury Smoke",
    displayName: "Liga Privada H99 Papas Fritas",
    hook: "A compact 10-count Liga Privada box for premium H99 flavor in a shorter smoke window.",
    salesAngle: "A smart add-on for members who want Drew Estate depth without committing to a long session.",
    tastingNotes: ["Cedar", "Earth", "Pepper", "Dark sweetness"],
    caption:
      "Cigar Spotlight: Liga Privada H99 Papas Fritas. A 10-count 4.5 x 44 box with Connecticut Corojo wrapper, Mexican San Andres binder, and Nicaraguan and Honduran filler. Compact format, premium construction, and a focused medium-full profile. Shop through Yuzu Cigar Club. 21+ only. Age verification and adult signature delivery required.",
    images: [
      { src: "source-images/liga-privada-h99-papas-fritas-open.jpg", label: "Open box", variant: "main" },
      { src: "source-images/liga-privada-h99-papas-fritas-close.jpg", label: "Closed box", variant: "detail" },
      { src: "source-images/liga-privada-h99-papas-fritas-cigar-strip.png", label: "Long cigar close-up", variant: "close" },
    ],
  },
];

async function main() {
  mkdirSync(cardsDir, { recursive: true });
  mkdirSync(htmlDir, { recursive: true });

  const cards = spotlightCards.map((config) => {
    const product = getRequiredProduct(config.slug);

    return { config, product };
  });

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    deviceScaleFactor: 1,
    viewport: { width: 1080, height: 1350 },
  });

  const exportedCards: Array<{ title: string; pngPath: string; htmlPath: string }> = [];

  for (const card of cards) {
    const html = renderCardHtml(card.config, card.product);
    const htmlPath = path.join(htmlDir, `${card.config.fileStem}.html`);
    const pngPath = path.join(cardsDir, `${card.config.fileStem}.png`);
    const page = await context.newPage();

    writeFileSync(htmlPath, html);
    await page.setContent(html, { waitUntil: "load" });
    await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => undefined);
    await page.screenshot({ path: pngPath, clip: { x: 0, y: 0, width: 1080, height: 1350 } });
    await page.close();

    exportedCards.push({ title: card.config.displayName, pngPath, htmlPath });
  }

  const contactSheetHtml = renderContactSheetHtml(exportedCards);
  const contactSheetHtmlPath = path.join(htmlDir, "contact-sheet.html");
  const contactSheetPath = path.join(outputDir, "yuzu-cigar-spotlight-contact-sheet.png");
  const contactPage = await context.newPage();

  writeFileSync(contactSheetHtmlPath, contactSheetHtml);
  await contactPage.setViewportSize({ width: 1440, height: 1880 });
  await contactPage.setContent(contactSheetHtml, { waitUntil: "load" });
  await contactPage.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => undefined);
  await contactPage.screenshot({ path: contactSheetPath, clip: { x: 0, y: 0, width: 1440, height: 1880 } });
  await contactPage.close();

  await browser.close();

  const captionsPath = path.join(outputDir, "CAPTIONS.md");
  const readmePath = path.join(outputDir, "README.md");

  writeFileSync(captionsPath, renderCaptions(cards));
  writeFileSync(readmePath, renderReadme(exportedCards, contactSheetPath, captionsPath));

  console.log(JSON.stringify({
    outputDir,
    cards: exportedCards,
    contactSheet: contactSheetPath,
    captions: captionsPath,
    readme: readmePath,
  }, null, 2));
}

function getRequiredProduct(slug: string) {
  const product = getCatalogProductBySlug(slug);

  if (!product) {
    throw new Error(`Missing catalog product for slug: ${slug}`);
  }

  return product;
}

function renderCardHtml(config: SpotlightCardConfig, product: CatalogProduct) {
  const images = config.images.length > 0
    ? config.images
    : [
        { src: product.image, label: "Full box", variant: "main" },
        { src: product.image, label: "Box detail", variant: "detail" },
        { src: product.image, label: "Close view", variant: "close" },
      ] satisfies SpotlightImage[];
  const memberSavings = Math.max(0, product.nonMemberPrice - product.memberPrice);
  const detailRows: Array<[string, string]> = [
    ["Box", product.packageLabel],
    ["Format", [product.vitola, product.length && `${product.length} x ${product.gauge}`].filter(Boolean).join(" ") || "Catalog format"],
    ["Strength", product.strength ?? "Catalog"],
    ["Origin", product.origin ?? "Catalog"],
    ["Wrapper", product.wrapper ?? "Catalog"],
    ["Binder", product.binder ?? "Catalog"],
    ["Filler", product.filler ?? "Catalog"],
    ["Profile", config.tastingNotes.join(" / ")],
  ];
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>${escapeHtml(config.displayName)} | Yuzu Cigar Club</title>
  <style>
    * { box-sizing: border-box; }
    body {
      margin: 0;
      width: 1080px;
      height: 1350px;
      overflow: hidden;
      background: #030504;
      color: #f8edd7;
      font-family: Inter, Arial, sans-serif;
    }
    .card {
      position: relative;
      width: 1080px;
      height: 1350px;
      padding: 44px;
      background:
        radial-gradient(circle at 10% 6%, rgba(220,169,58,0.26), transparent 280px),
        radial-gradient(circle at 90% 18%, rgba(43,118,78,0.22), transparent 340px),
        linear-gradient(140deg, #07110d 0%, #030504 48%, #0b2017 100%);
      isolation: isolate;
    }
    .card::before {
      content: "";
      position: absolute;
      inset: 24px;
      border: 2px solid rgba(220,169,58,0.58);
      pointer-events: none;
      z-index: -1;
    }
    .card::after {
      content: "";
      position: absolute;
      inset: 0;
      background:
        linear-gradient(135deg, rgba(248,237,215,0.055) 0 1px, transparent 1px 24px),
        linear-gradient(45deg, rgba(220,169,58,0.04), transparent 42%);
      opacity: 0.48;
      pointer-events: none;
      z-index: -1;
    }
    .masthead {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 24px;
      height: 78px;
      border-bottom: 1px solid rgba(220,169,58,0.42);
      padding-bottom: 22px;
    }
    .brand {
      display: flex;
      align-items: center;
      gap: 18px;
      min-width: 0;
    }
    .logo {
      width: 58px;
      height: 58px;
      object-fit: contain;
    }
    .brand-title {
      font: 800 24px/1.05 Inter, Arial, sans-serif;
      letter-spacing: 0.18em;
      color: #f8edd7;
      text-transform: uppercase;
    }
    .brand-subtitle {
      margin-top: 5px;
      font: 800 12px/1 Inter, Arial, sans-serif;
      letter-spacing: 0.28em;
      color: #dca93a;
      text-transform: uppercase;
    }
    .age {
      border: 1px solid rgba(220,169,58,0.7);
      color: #dca93a;
      padding: 12px 14px;
      font: 900 18px/1 Inter, Arial, sans-serif;
      letter-spacing: 0.1em;
    }
    .gallery {
      display: grid;
      grid-template-columns: 1.32fr 0.68fr;
      grid-template-rows: 252px 120px;
      gap: 16px;
      height: 388px;
      margin-top: 26px;
    }
    .image-frame {
      position: relative;
      overflow: hidden;
      border: 1px solid rgba(220,169,58,0.44);
      background:
        radial-gradient(circle at 50% 24%, rgba(220,169,58,0.18), transparent 210px),
        linear-gradient(145deg, rgba(16,24,18,0.96), rgba(4,9,7,0.98));
    }
    .image-frame.main {
      grid-column: 1;
      grid-row: 1;
    }
    .image-frame.detail {
      grid-column: 2;
      grid-row: 1;
    }
    .image-frame.close {
      grid-column: 1 / -1;
      grid-row: 2;
      background:
        radial-gradient(circle at 42% 50%, rgba(220,169,58,0.14), transparent 360px),
        linear-gradient(90deg, rgba(7,17,13,0.98), rgba(3,5,4,0.94) 48%, rgba(10,28,20,0.98));
    }
    .image-frame img {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      object-fit: contain;
      padding: 24px;
      filter: drop-shadow(0 24px 38px rgba(0,0,0,0.52));
    }
    .image-frame.main img {
      transform: scale(1.12);
    }
    .image-frame.detail img {
      padding: 18px;
      object-fit: contain;
      transform: scale(1.08);
    }
    .image-frame.close img {
      padding: 8px 34px;
      object-fit: contain;
      filter: drop-shadow(0 14px 24px rgba(0,0,0,0.58));
      transform: none;
    }
    .image-label {
      position: absolute;
      left: 14px;
      bottom: 12px;
      border: 1px solid rgba(220,169,58,0.5);
      background: rgba(3,5,4,0.78);
      color: #dca93a;
      padding: 8px 10px;
      font: 900 11px/1 Inter, Arial, sans-serif;
      letter-spacing: 0.12em;
      text-transform: uppercase;
    }
    .copy {
      margin-top: 28px;
    }
    .label-row {
      display: flex;
      align-items: center;
      gap: 12px;
      color: #dca93a;
      font: 900 15px/1 Inter, Arial, sans-serif;
      letter-spacing: 0.18em;
      text-transform: uppercase;
    }
    .label-pill {
      background: #dca93a;
      color: #07110d;
      padding: 10px 13px;
      letter-spacing: 0.1em;
    }
    h1 {
      margin: 20px 0 0;
      max-width: 960px;
      color: #f8edd7;
      font: 700 54px/0.94 Georgia, "Times New Roman", serif;
      letter-spacing: 0;
    }
    .hook {
      margin: 18px 0 0;
      max-width: 930px;
      color: rgba(248,237,215,0.88);
      font: 600 24px/1.22 Inter, Arial, sans-serif;
    }
    .price-strip {
      display: grid;
      grid-template-columns: 1fr 1fr 1fr;
      gap: 1px;
      margin-top: 20px;
      border: 1px solid rgba(220,169,58,0.48);
      background: rgba(220,169,58,0.48);
    }
    .price-cell {
      min-height: 94px;
      padding: 14px;
      background: rgba(7,17,13,0.93);
    }
    .price-label {
      color: #b8aa8f;
      font: 900 12px/1 Inter, Arial, sans-serif;
      letter-spacing: 0.15em;
      text-transform: uppercase;
    }
    .price-value {
      margin-top: 10px;
      color: #dca93a;
      font: 700 34px/1 Georgia, "Times New Roman", serif;
    }
    .details {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 10px;
      margin-top: 16px;
    }
    .detail {
      min-height: 70px;
      border: 1px solid rgba(220,169,58,0.34);
      background: rgba(16,24,18,0.78);
      padding: 10px;
    }
    .detail-label {
      color: #dca93a;
      font: 900 10px/1 Inter, Arial, sans-serif;
      letter-spacing: 0.15em;
      text-transform: uppercase;
    }
    .detail-value {
      margin-top: 8px;
      color: #f8edd7;
      font: 700 17px/1.12 Inter, Arial, sans-serif;
    }
    .sales-angle {
      display: grid;
      grid-template-columns: 1fr auto;
      gap: 18px;
      align-items: center;
      margin-top: 18px;
      border: 1px solid rgba(220,169,58,0.5);
      background:
        linear-gradient(90deg, rgba(220,169,58,0.14), rgba(10,28,20,0.65)),
        rgba(3,5,4,0.72);
      padding: 17px 20px;
    }
    .sales-angle p {
      margin: 0;
      color: rgba(248,237,215,0.88);
      font: 700 21px/1.18 Inter, Arial, sans-serif;
    }
    .cta {
      display: grid;
      place-items: center;
      min-width: 230px;
      min-height: 58px;
      background: #dca93a;
      color: #07110d;
      font: 950 18px/1 Inter, Arial, sans-serif;
      letter-spacing: 0.12em;
      text-transform: uppercase;
    }
    .footer {
      position: absolute;
      left: 44px;
      right: 44px;
      bottom: 36px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 18px;
      border-top: 1px solid rgba(220,169,58,0.38);
      padding-top: 18px;
      color: #b8aa8f;
      font: 800 14px/1.2 Inter, Arial, sans-serif;
      letter-spacing: 0.12em;
      text-transform: uppercase;
    }
    .footer strong {
      color: #f8edd7;
    }
  </style>
</head>
<body>
  <main class="card" aria-label="${escapeHtml(config.displayName)} social media card">
    <header class="masthead">
      <div class="brand">
        <img class="logo" src="${toPublicDataUri(logoPath)}" alt="Yuzu Cigar Club logo">
        <div>
          <div class="brand-title">Yuzu Cigar Club</div>
          <div class="brand-subtitle">Cigar Spotlight</div>
        </div>
      </div>
      <div class="age">21+</div>
    </header>

    <section class="gallery" aria-label="Product image gallery">
      ${images.map((image) => `
        <div class="image-frame ${escapeHtml(image.variant)}">
          <img src="${toAssetDataUri(image.src)}" alt="${escapeHtml(image.label)} ${escapeHtml(config.displayName)} product image">
          <span class="image-label">${escapeHtml(image.label)}</span>
        </div>
      `).join("")}
    </section>

    <section class="copy">
      <div class="label-row">
        <span class="label-pill">${escapeHtml(config.label)}</span>
        <span>${escapeHtml(product.brand)}</span>
        <span>${escapeHtml(product.availability)}</span>
      </div>
      <h1>${escapeHtml(config.displayName)}</h1>
      <p class="hook">${escapeHtml(config.hook)}</p>

      <div class="price-strip" aria-label="Pricing">
        <div class="price-cell">
          <div class="price-label">Public box</div>
          <div class="price-value">${formatCatalogPrice(product.nonMemberPrice)}</div>
        </div>
        <div class="price-cell">
          <div class="price-label">Member box</div>
          <div class="price-value">${formatCatalogPrice(product.memberPrice)}</div>
        </div>
        <div class="price-cell">
          <div class="price-label">Member advantage</div>
          <div class="price-value">${memberSavings > 0 ? formatCatalogPrice(memberSavings) : "Active"}</div>
        </div>
      </div>

      <div class="details">
        ${detailRows.map(([label, value]) => `
          <div class="detail">
            <div class="detail-label">${escapeHtml(label)}</div>
            <div class="detail-value">${escapeHtml(value || "Catalog")}</div>
          </div>
        `).join("")}
      </div>

      <div class="sales-angle">
        <p>${escapeHtml(config.salesAngle)}</p>
        <div class="cta">Shop Boxes</div>
      </div>
    </section>

    <footer class="footer">
      <span><strong>YuzuCigarClub.com</strong></span>
      <span>Age verification + adult signature delivery required</span>
    </footer>
  </main>
</body>
</html>`;
}

function renderContactSheetHtml(cards: Array<{ title: string; pngPath: string }>) {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Yuzu Cigar Spotlight Contact Sheet</title>
  <style>
    * { box-sizing: border-box; }
    body {
      margin: 0;
      width: 1440px;
      height: 1880px;
      padding: 52px;
      background: #030504;
      color: #f8edd7;
      font-family: Inter, Arial, sans-serif;
    }
    h1 {
      margin: 0 0 28px;
      font: 700 52px/1 Georgia, "Times New Roman", serif;
      color: #f8edd7;
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 28px;
    }
    figure {
      margin: 0;
      border: 1px solid rgba(220,169,58,0.46);
      background: rgba(16,24,18,0.72);
      padding: 14px;
    }
    img {
      display: block;
      width: 100%;
      aspect-ratio: 4 / 5;
      object-fit: cover;
    }
    figcaption {
      margin-top: 10px;
      color: #dca93a;
      font: 900 14px/1 Inter, Arial, sans-serif;
      letter-spacing: 0.12em;
      text-transform: uppercase;
    }
  </style>
</head>
<body>
  <h1>Yuzu Cigar Spotlight Social Cards</h1>
  <div class="grid">
    ${cards.map((card) => `
      <figure>
        <img src="${toFileDataUri(card.pngPath)}" alt="${escapeHtml(card.title)} social card">
        <figcaption>${escapeHtml(card.title)}</figcaption>
      </figure>
    `).join("")}
  </div>
</body>
</html>`;
}

function renderCaptions(cards: Array<{ config: SpotlightCardConfig; product: CatalogProduct }>) {
  return `# Yuzu Cigar Spotlight Captions

Recommended post format: use each PNG as a 4:5 feed post, or publish the four images together as a carousel.

General compliance footer for captions:

21+ only. Premium cigars are for adults of legal age. Age verification and adult signature delivery required where applicable.

${cards.map(({ config, product }, index) => `## ${index + 1}. ${config.displayName}

Asset: \`cards/${config.fileStem}.png\`

Caption:

${config.caption}

Suggested hashtags:

#YuzuCigarClub #CigarSpotlight #PremiumCigars #CigarClub #CigarLounge #${product.brand.replace(/\W+/g, "")}
`).join("\n")}
`;
}

function renderReadme(cards: Array<{ title: string; pngPath: string; htmlPath: string }>, contactSheetPath: string, captionsPath: string) {
  return `# Yuzu Cigar Spotlight Social Cards

Generated ${new Date().toISOString()}.

## Output

${cards.map((card) => `- ${card.title}: \`${relativeOutputPath(card.pngPath)}\` with editable proof HTML at \`${relativeOutputPath(card.htmlPath)}\``).join("\n")}
- Contact sheet: \`${relativeOutputPath(contactSheetPath)}\`
- Captions: \`${relativeOutputPath(captionsPath)}\`
- Research/source manifest: \`source-images/sources.json\`

## Format

- Size: 1080 x 1350 px
- Ratio: 4:5 feed post
- Gallery format: open box and closed box on the top row, with a full-width long cigar close-up strip underneath
- Source imagery: researched same-product cigar, box, and detail images saved under \`source-images/\`
- Copy: deterministic HTML/CSS type, not generated text inside an AI image

## Compliance Notes

- Cards include 21+ positioning and age verification/adult signature language.
- Captions avoid health claims and are written for adults of legal age.
- Research image sources are documented for review; confirm reuse rights or replace with owned/authorized photos before paid promotion.
`;
}

function toAssetDataUri(assetPath: string) {
  if (assetPath.startsWith("/")) {
    return toPublicDataUri(assetPath);
  }

  const filePath = path.resolve(outputDir, assetPath);

  if (!existsSync(filePath)) {
    throw new Error(`Missing researched asset: ${assetPath}`);
  }

  return toFileDataUri(filePath);
}

function toPublicDataUri(publicPath: string) {
  const filePath = path.join(publicDir, publicPath.replace(/^\//, ""));

  if (!existsSync(filePath)) {
    throw new Error(`Missing public asset: ${publicPath}`);
  }

  return toFileDataUri(filePath);
}

function toFileDataUri(filePath: string) {
  const extension = path.extname(filePath).toLowerCase();
  const mimeType = extension === ".png"
    ? "image/png"
    : extension === ".svg"
      ? "image/svg+xml"
      : "image/jpeg";

  return `data:${mimeType};base64,${readFileSync(filePath).toString("base64")}`;
}

function relativeOutputPath(filePath: string) {
  return path.relative(outputDir, filePath).replace(/\\/g, "/");
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
