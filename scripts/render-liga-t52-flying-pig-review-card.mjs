import { copyFile, mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import sharp from "sharp";

const root = process.cwd();
const sourceImage = resolve("C:/Users/qfash/Downloads/Liga-Privada-T52-Flying-Pig.jpeg");
const logoImage = resolve(root, "public/assets/yuzu-logo.png");
const outputDir = resolve(root, "output/social/liga-privada-t52-flying-pig-review-2026-06-09");

const feedPath = resolve(outputDir, "yuzu-liga-privada-t52-flying-pig-review-card-4x5.jpg");
const squarePath = resolve(outputDir, "yuzu-liga-privada-t52-flying-pig-review-card-square.jpg");
const storyPath = resolve(outputDir, "yuzu-liga-privada-t52-flying-pig-review-story-9x16.jpg");
const contactSheetPath = resolve(outputDir, "liga-privada-t52-flying-pig-review-card-contact-sheet.jpg");
const captionPath = resolve(outputDir, "facebook-caption-liga-privada-t52-flying-pig-review-card.txt");
const manifestPath = resolve(outputDir, "liga-privada-t52-flying-pig-review-card-manifest.json");
const storyManifestPath = resolve(outputDir, "liga-privada-t52-flying-pig-review-story-manifest.json");
const sourceCopyPath = resolve(outputDir, "source-liga-privada-t52-flying-pig.jpeg");

const palette = {
  cream: "#f8efe1",
  muted: "#d8c6aa",
  gold: "#e6bd63",
  bronze: "#a56d37",
  green: "#0c2e2a",
  dark: "#060503",
  oxblood: "#38130f",
  line: "#d7aa55",
};

const product = {
  name: "Liga Privada T52 Flying Pig",
  maker: "Drew Estate",
  size: "3 15/16 x 60",
  release: "Seasonal release",
  body: "Full",
  wrapper: "Connecticut stalk-cut and stalk-cured Habano",
  binder: "Plantation-grown Brazilian Mata Fina",
  filler: "Honduran and Nicaraguan",
  profile: ["earth", "black pepper", "caramel sweetness"],
  cardProfile: ["earth", "black pepper", "caramel"],
  yuzuTake:
    "A compact powerhouse: earthy grit up front, black pepper through the middle, then a chewy caramel-sweet finish. Short format, big presence.",
};

const caption = `Liga Privada T52 Flying Pig by Drew Estate.

This seasonal 3 15/16 x 60 T52 vitola packs the full-bodied stalk-cut Habano profile into a short, dense format. Drew Estate lists the blend with a Connecticut stalk-cut and stalk-cured Habano wrapper, Brazilian Mata Fina binder, and Honduran/Nicaraguan filler, with earth, black pepper, and caramel sweetness in the profile.

Yuzu review read: gritty wrapper texture, pepper early, earth through the middle, and a sweet finish that keeps the small size from feeling small.

What would you pair with it: espresso or Cabernet?

21+ only. No buying, selling, trading, pricing, inventory, giveaways, or order requests.`;

function escapeXml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function wrapText(text, maxChars) {
  const words = text.split(/\s+/);
  const lines = [];
  let current = "";

  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length > maxChars && current) {
      lines.push(current);
      current = word;
    } else {
      current = next;
    }
  }

  if (current) {
    lines.push(current);
  }

  return lines;
}

function textBlock({ x, y, lines, size, color = palette.cream, weight = 700, lineGap = 1.12, anchor = "start" }) {
  const spans = lines
    .map((line, index) => {
      const dy = index === 0 ? 0 : size * lineGap;
      return `<tspan x="${x}" dy="${dy}">${escapeXml(line)}</tspan>`;
    })
    .join("");

  return `<text x="${x}" y="${y}" text-anchor="${anchor}" fill="${color}" font-family="Arial, Helvetica, sans-serif" font-size="${size}" font-weight="${weight}" letter-spacing="0">${spans}</text>`;
}

function specsBlock(x, y, width) {
  const rows = [
    ["SIZE", product.size],
    ["WRAPPER", "CT stalk-cut Habano"],
    ["BINDER", "Brazilian Mata Fina"],
    ["FILLER", "Honduras + Nicaragua"],
    ["BODY", product.body],
  ];

  let cursor = y;
  const pieces = [];
  for (const [label, value] of rows) {
    pieces.push(`<line x1="${x}" y1="${cursor - 20}" x2="${x + width}" y2="${cursor - 20}" stroke="${palette.line}" stroke-width="1" opacity="0.45"/>`);
    pieces.push(`<text x="${x}" y="${cursor}" fill="${palette.gold}" font-family="Arial, Helvetica, sans-serif" font-size="19" font-weight="900" letter-spacing="0">${escapeXml(label)}</text>`);
    pieces.push(`<text x="${x + 128}" y="${cursor}" fill="${palette.cream}" font-family="Arial, Helvetica, sans-serif" font-size="24" font-weight="800" letter-spacing="0">${escapeXml(value)}</text>`);
    cursor += 52;
  }
  return pieces.join("");
}

function profileChips(x, y, labels) {
  let cursor = x;
  const pieces = [];

  for (const label of labels) {
    const width = Math.max(114, label.length * 13 + 34);
    pieces.push(`<rect x="${cursor}" y="${y}" width="${width}" height="42" rx="21" fill="${palette.cream}" opacity="0.95"/>`);
    pieces.push(`<text x="${cursor + width / 2}" y="${y + 28}" text-anchor="middle" fill="${palette.oxblood}" font-family="Arial, Helvetica, sans-serif" font-size="18" font-weight="900" letter-spacing="0">${escapeXml(label.toUpperCase())}</text>`);
    cursor += width + 12;
  }

  return pieces.join("");
}

function overlaySvg({ width, height, mode }) {
  const isSquare = mode === "square";
  const titleSize = isSquare ? 64 : 66;
  const titleY = isSquare ? 150 : 156;
  const x = isSquare ? 58 : 68;
  const panelWidth = isSquare ? 512 : 540;
  const takeLines = wrapText(product.yuzuTake, isSquare ? 31 : 33);
  const titleLines = isSquare ? ["T52", "FLYING PIG"] : ["LIGA PRIVADA", "T52 FLYING", "PIG"];

  return `
  <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
    <defs>
      <linearGradient id="leftShade" x1="0" x2="1" y1="0" y2="0">
        <stop offset="0" stop-color="${palette.dark}" stop-opacity="0.96"/>
        <stop offset="0.58" stop-color="${palette.dark}" stop-opacity="0.88"/>
        <stop offset="1" stop-color="${palette.dark}" stop-opacity="0.08"/>
      </linearGradient>
      <linearGradient id="bottomShade" x1="0" x2="0" y1="0" y2="1">
        <stop offset="0" stop-color="${palette.dark}" stop-opacity="0"/>
        <stop offset="1" stop-color="${palette.dark}" stop-opacity="0.92"/>
      </linearGradient>
    </defs>
    <rect width="${width}" height="${height}" fill="url(#leftShade)"/>
    <rect y="${Math.floor(height * 0.55)}" width="${width}" height="${Math.ceil(height * 0.45)}" fill="url(#bottomShade)"/>
    <rect x="${x - 20}" y="${isSquare ? 50 : 58}" width="${panelWidth}" height="${isSquare ? 900 : 1142}" rx="0" fill="${palette.green}" opacity="0.72"/>
    <rect x="${x - 20}" y="${isSquare ? 50 : 58}" width="5" height="${isSquare ? 900 : 1142}" fill="${palette.gold}"/>
    <text x="${x}" y="${isSquare ? 92 : 104}" fill="${palette.gold}" font-family="Arial, Helvetica, sans-serif" font-size="24" font-weight="900" letter-spacing="0">YUZU REVIEW CARD</text>
    ${textBlock({
      x,
      y: titleY,
      lines: titleLines,
      size: titleSize,
      color: palette.cream,
      weight: 900,
      lineGap: 0.9,
    })}
    <text x="${x}" y="${isSquare ? 300 : 348}" fill="${palette.muted}" font-family="Arial, Helvetica, sans-serif" font-size="28" font-weight="800" letter-spacing="0">${escapeXml(product.maker)} / ${escapeXml(product.release)}</text>
    ${profileChips(x, isSquare ? 334 : 388, product.cardProfile)}
    <rect x="${x}" y="${isSquare ? 414 : 472}" width="${panelWidth - 48}" height="${isSquare ? 214 : 246}" rx="12" fill="${palette.dark}" opacity="0.72" stroke="${palette.line}" stroke-width="2"/>
    <text x="${x + 24}" y="${isSquare ? 458 : 516}" fill="${palette.gold}" font-family="Arial, Helvetica, sans-serif" font-size="21" font-weight="900" letter-spacing="0">YUZU TAKE</text>
    ${textBlock({
      x: x + 24,
      y: isSquare ? 500 : 558,
      lines: takeLines,
      size: isSquare ? 24 : 26,
      color: palette.cream,
      weight: 800,
      lineGap: 1.12,
    })}
    ${specsBlock(x, isSquare ? 700 : 800, panelWidth - 52)}
    <line x1="${x}" y1="${height - 96}" x2="${x + panelWidth - 52}" y2="${height - 96}" stroke="${palette.line}" stroke-width="2" opacity="0.7"/>
    <text x="${x}" y="${height - 58}" fill="${palette.muted}" font-family="Arial, Helvetica, sans-serif" font-size="${isSquare ? 20 : 22}" font-weight="900" letter-spacing="0">21+ ONLY / NO MARKETPLACE POST</text>
  </svg>`;
}

function storyOverlaySvg({ width, height }) {
  const titleLines = ["LIGA PRIVADA", "T52 FLYING", "PIG"];

  return `
  <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
    <defs>
      <linearGradient id="topShade" x1="0" x2="0" y1="0" y2="1">
        <stop offset="0" stop-color="${palette.dark}" stop-opacity="0.95"/>
        <stop offset="0.48" stop-color="${palette.dark}" stop-opacity="0.34"/>
        <stop offset="1" stop-color="${palette.dark}" stop-opacity="0.88"/>
      </linearGradient>
      <linearGradient id="sideShade" x1="0" x2="1" y1="0" y2="0">
        <stop offset="0" stop-color="${palette.green}" stop-opacity="0.9"/>
        <stop offset="0.58" stop-color="${palette.green}" stop-opacity="0.62"/>
        <stop offset="1" stop-color="${palette.dark}" stop-opacity="0.04"/>
      </linearGradient>
    </defs>
    <rect width="${width}" height="${height}" fill="url(#topShade)"/>
    <rect x="0" y="0" width="720" height="${height}" fill="url(#sideShade)"/>
    <rect x="66" y="118" width="5" height="982" fill="${palette.gold}"/>
    <text x="94" y="164" fill="${palette.gold}" font-family="Arial, Helvetica, sans-serif" font-size="30" font-weight="900" letter-spacing="0">YUZU STORY REVIEW</text>
    ${textBlock({
      x: 94,
      y: 260,
      lines: titleLines,
      size: 76,
      color: palette.cream,
      weight: 900,
      lineGap: 0.9,
    })}
    <text x="94" y="502" fill="${palette.muted}" font-family="Arial, Helvetica, sans-serif" font-size="31" font-weight="800" letter-spacing="0">${escapeXml(product.maker)} / ${escapeXml(product.release)}</text>
    ${profileChips(94, 552, product.cardProfile)}
    <rect x="94" y="646" width="552" height="376" rx="18" fill="${palette.dark}" opacity="0.78" stroke="${palette.line}" stroke-width="2"/>
    <text x="124" y="700" fill="${palette.gold}" font-family="Arial, Helvetica, sans-serif" font-size="24" font-weight="900" letter-spacing="0">QUICK READ</text>
    ${textBlock({
      x: 124,
      y: 752,
      lines: [
        "Full-bodied short format.",
        "Earthy grit up front.",
        "Black pepper through the middle.",
        "Caramel finish.",
      ],
      size: 30,
      color: palette.cream,
      weight: 850,
      lineGap: 1.35,
    })}
    <rect x="94" y="1238" width="572" height="304" rx="0" fill="${palette.green}" opacity="0.82"/>
    <rect x="94" y="1238" width="5" height="304" fill="${palette.gold}"/>
    ${specsBlock(126, 1308, 486)}
    <line x1="94" y1="1716" x2="682" y2="1716" stroke="${palette.line}" stroke-width="2" opacity="0.72"/>
    <text x="94" y="1762" fill="${palette.cream}" font-family="Arial, Helvetica, sans-serif" font-size="28" font-weight="900" letter-spacing="0">FULL REVIEW ON THE PAGE</text>
    <text x="94" y="1816" fill="${palette.muted}" font-family="Arial, Helvetica, sans-serif" font-size="24" font-weight="900" letter-spacing="0">21+ ONLY / NO MARKETPLACE POST</text>
  </svg>`;
}

async function renderCard({ width, height, output, mode }) {
  const imageLayer = await sharp(sourceImage)
    .rotate()
    .resize(width, height, { fit: "cover", position: mode === "square" ? "right" : "right" })
    .modulate({ brightness: 0.88, saturation: 0.9 })
    .jpeg({ quality: 96 })
    .toBuffer();

  const overlay = Buffer.from(overlaySvg({ width, height, mode }));
  const logoSize = mode === "square" ? 88 : 96;
  const logo = await sharp(logoImage)
    .resize({ width: logoSize, height: logoSize, fit: "contain" })
    .png()
    .toBuffer();

  await sharp(imageLayer)
    .composite([
      { input: overlay, left: 0, top: 0 },
      { input: logo, left: width - logoSize - 42, top: height - logoSize - 42 },
    ])
    .jpeg({ quality: 94, mozjpeg: true })
    .toFile(output);
}

async function renderStory() {
  const width = 1080;
  const height = 1920;
  const imageLayer = await sharp(sourceImage)
    .rotate()
    .resize(width, height, { fit: "cover", position: "right" })
    .modulate({ brightness: 0.86, saturation: 0.92 })
    .jpeg({ quality: 96 })
    .toBuffer();
  const overlay = Buffer.from(storyOverlaySvg({ width, height }));
  const logoSize = 112;
  const logo = await sharp(logoImage)
    .resize({ width: logoSize, height: logoSize, fit: "contain" })
    .png()
    .toBuffer();

  await sharp(imageLayer)
    .composite([
      { input: overlay, left: 0, top: 0 },
      { input: logo, left: width - logoSize - 46, top: height - logoSize - 50 },
    ])
    .jpeg({ quality: 94, mozjpeg: true })
    .toFile(storyPath);
}

async function renderContactSheet() {
  const feed = await sharp(feedPath).resize({ width: 720 }).jpeg().toBuffer();
  const square = await sharp(squarePath).resize({ width: 560 }).jpeg().toBuffer();
  const story = await sharp(storyPath).resize({ height: 900 }).jpeg().toBuffer();
  const contactWidth = 1880;
  const contactHeight = 1080;
  const svg = `
  <svg xmlns="http://www.w3.org/2000/svg" width="${contactWidth}" height="${contactHeight}">
    <rect width="${contactWidth}" height="${contactHeight}" fill="${palette.dark}"/>
    <text x="42" y="58" fill="${palette.gold}" font-family="Arial, Helvetica, sans-serif" font-size="28" font-weight="900" letter-spacing="0">Liga Privada T52 Flying Pig / review card QA</text>
    <text x="42" y="1016" fill="${palette.muted}" font-family="Arial, Helvetica, sans-serif" font-size="24" font-weight="800" letter-spacing="0">4:5 Facebook Page feed</text>
    <text x="824" y="1016" fill="${palette.muted}" font-family="Arial, Helvetica, sans-serif" font-size="24" font-weight="800" letter-spacing="0">Square support crop</text>
    <text x="1436" y="1016" fill="${palette.muted}" font-family="Arial, Helvetica, sans-serif" font-size="24" font-weight="800" letter-spacing="0">9:16 Facebook Story</text>
  </svg>`;

  await sharp({
    create: {
      width: contactWidth,
      height: contactHeight,
      channels: 4,
      background: palette.dark,
    },
  })
    .composite([
      { input: Buffer.from(svg), left: 0, top: 0 },
      { input: feed, left: 42, top: 92 },
      { input: square, left: 824, top: 184 },
      { input: story, left: 1350, top: 92 },
    ])
    .jpeg({ quality: 92, mozjpeg: true })
    .toFile(contactSheetPath);
}

async function main() {
  await mkdir(outputDir, { recursive: true });
  await copyFile(sourceImage, sourceCopyPath);
  await renderCard({ width: 1080, height: 1350, output: feedPath, mode: "feed" });
  await renderCard({ width: 1080, height: 1080, output: squarePath, mode: "square" });
  await renderStory();
  await renderContactSheet();

  const manifest = {
    generated_at: new Date().toISOString(),
    product: product.name,
    maker: product.maker,
    requested_source_image: sourceImage,
    source_copy: sourceCopyPath,
    researched_facts: {
      size: product.size,
      release: product.release,
      wrapper: product.wrapper,
      binder: product.binder,
      filler: product.filler,
      body: product.body,
      profile: product.profile,
      suggested_pairings_from_maker: ["Espresso", "Cabernet Sauvignon"],
    },
    sources: [
      "https://drewestate.com/products/liga-privada/liga-privada-t52/",
      "local user-provided real product image: C:/Users/qfash/Downloads/Liga-Privada-T52-Flying-Pig.jpeg",
    ],
    assets: {
      feed_4x5: feedPath,
      square: squarePath,
      story_9x16: storyPath,
      contact_sheet: contactSheetPath,
      caption: captionPath,
    },
    compliance_notes: [
      "Public caption includes 21+ only framing.",
      "Image and caption avoid price, inventory status, order language, discounts, giveaways, samples, and direct sales imperatives.",
      "Uses the user-provided real product image as the visual source.",
    ],
  };

  const storyManifest = {
    generated_at: new Date().toISOString(),
    asset: storyPath,
    dimensions: [1080, 1920],
    derived_from_source_image: sourceCopyPath,
    related_page_post: "https://www.facebook.com/122099394543350335/posts/122105266047350335",
    visible_story_copy: [
      "YUZU STORY REVIEW",
      "LIGA PRIVADA T52 FLYING PIG",
      "Drew Estate / Seasonal release",
      "EARTH / BLACK PEPPER / CARAMEL",
      "Full-bodied short format",
      "3 15/16 x 60",
      "CT stalk-cut Habano",
      "Brazilian Mata Fina",
      "Honduras + Nicaragua",
      "FULL REVIEW ON THE PAGE",
      "21+ ONLY / NO MARKETPLACE POST",
    ],
    compliance_notes: [
      "Uses the user-provided real product image.",
      "No price, inventory status, order language, discounts, giveaways, samples, or health claims.",
      "Story API does not attach a clickable link sticker; visible copy points viewers back to the Page post.",
    ],
  };

  await writeFile(captionPath, caption, "utf8");
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  await writeFile(storyManifestPath, `${JSON.stringify(storyManifest, null, 2)}\n`, "utf8");

  console.log(JSON.stringify(manifest.assets, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
