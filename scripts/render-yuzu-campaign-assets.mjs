import { mkdir, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import sharp from "sharp";

const root = process.cwd();
const campaignDir = path.resolve(root, "output/social/yuzu-campaign-2026-08-16");
const sourceDir = path.join(campaignDir, "source");
const mastersDir = path.join(campaignDir, "masters");
const logoPath = path.resolve(root, "public/assets/yuzu-logo.png");

const palette = {
  night: "#030504",
  ink: "#07110d",
  forest: "#0a1c14",
  gold: "#dca93a",
  goldLight: "#f4c96a",
  cream: "#f8edd7",
  muted: "#b8aa8f",
};

const concepts = [
  {
    slug: "quiet-ritual",
    source: "quiet-ritual-source.png",
    kicker: "YUZU CIGAR CLUB",
    headline: ["PREMIUM CIGARS.", "CURATED FOR YOU."],
    subline: ["Premium cigar culture,", "thoughtfully curated."],
    cta: "DISCOVER YUZU",
    ctaWidth: 292,
  },
  {
    slug: "membership-refined",
    source: "membership-refined-source.png",
    kicker: "YUZU MEMBERSHIP",
    headline: ["MEMBERSHIP, MADE", "MORE THOUGHTFUL."],
    subline: ["Curation, education, and", "thoughtful tools for collectors."],
    cta: "EXPLORE MEMBERSHIP",
    ctaWidth: 382,
  },
  {
    slug: "collection-in-focus",
    source: "humidor-focus-source.png",
    kicker: "DIGITAL HUMIDOR",
    headline: ["YOUR COLLECTION,", "IN FOCUS."],
    subline: ["Track conditions, aging notes,", "and every box in one view."],
    cta: "EXPLORE HUMIDOR",
    ctaWidth: 352,
  },
  {
    slug: "follow-the-craft",
    source: "cigar-flow-source.png",
    kicker: "CIGAR FLOW",
    headline: ["FOLLOW WHAT'S", "WORTH KNOWING."],
    subline: ["Maker stories, releases, and", "cigar culture covered in depth."],
    cta: "READ CIGAR FLOW",
    ctaWidth: 326,
  },
];

const formats = [
  {
    slug: "feed-4x5",
    suffix: "4x5",
    width: 1080,
    height: 1350,
    logoTop: 76,
    brandY: 104,
    subBrandY: 128,
    ageY: 100,
    kickerY: 205,
    headlineY: 286,
    headlineSize: 75,
    headlineGap: 69,
    sublineY: 470,
    sublineSize: 31,
    sublineGap: 41,
    ctaY: 594,
    footerY: 1277,
    inset: 48,
  },
  {
    slug: "square-1x1",
    suffix: "1x1",
    width: 1080,
    height: 1080,
    logoTop: 66,
    brandY: 94,
    subBrandY: 118,
    ageY: 90,
    kickerY: 180,
    headlineY: 252,
    headlineSize: 68,
    headlineGap: 63,
    sublineY: 420,
    sublineSize: 29,
    sublineGap: 38,
    ctaY: 528,
    footerY: 1012,
    inset: 42,
  },
  {
    slug: "story-9x16",
    suffix: "9x16",
    width: 1080,
    height: 1920,
    logoTop: 238,
    brandY: 268,
    subBrandY: 294,
    ageY: 264,
    kickerY: 380,
    headlineY: 476,
    headlineSize: 82,
    headlineGap: 76,
    sublineY: 680,
    sublineSize: 34,
    sublineGap: 45,
    ctaY: 818,
    footerY: 1690,
    inset: 54,
  },
];

function escapeXml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function lineBlock(lines, { x, y, size, gap, color, family, weight, spacing = 0 }) {
  return lines
    .map(
      (line, index) =>
        `<text x="${x}" y="${y + index * gap}" fill="${color}" font-family="${family}" font-size="${size}" font-weight="${weight}" letter-spacing="${spacing}">${escapeXml(line)}</text>`,
    )
    .join("");
}

function overlaySvg(concept, format) {
  const { width, height, inset } = format;
  const logoLeft = inset + 26;
  const brandLeft = logoLeft + 64;
  const copyLeft = inset + 28;
  const ageX = width - inset - 26;
  const ctaHeight = format.slug === "story-9x16" ? 70 : 64;
  const footerTop = format.footerY - 35;

  return Buffer.from(`
    <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="shade" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0" stop-color="${palette.night}" stop-opacity="0.92"/>
          <stop offset="0.42" stop-color="${palette.night}" stop-opacity="0.66"/>
          <stop offset="0.72" stop-color="${palette.night}" stop-opacity="0.18"/>
          <stop offset="1" stop-color="${palette.night}" stop-opacity="0.32"/>
        </linearGradient>
        <linearGradient id="bottom" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stop-color="${palette.night}" stop-opacity="0"/>
          <stop offset="1" stop-color="${palette.night}" stop-opacity="0.86"/>
        </linearGradient>
      </defs>
      <rect width="${width}" height="${height}" fill="url(#shade)"/>
      <rect y="${Math.round(height * 0.63)}" width="${width}" height="${Math.round(height * 0.37)}" fill="url(#bottom)"/>
      <rect x="${inset}" y="${inset}" width="${width - inset * 2}" height="${height - inset * 2}" fill="none" stroke="${palette.gold}" stroke-opacity="0.72" stroke-width="2"/>
      <text x="${brandLeft}" y="${format.brandY}" fill="${palette.cream}" font-family="Georgia, Times New Roman, serif" font-size="28" font-weight="700" letter-spacing="2">YUZU</text>
      <text x="${brandLeft}" y="${format.subBrandY}" fill="${palette.gold}" font-family="Arial, sans-serif" font-size="11" font-weight="800" letter-spacing="4">CIGAR CLUB</text>
      <rect x="${ageX - 62}" y="${format.ageY - 31}" width="62" height="48" rx="3" fill="${palette.ink}" fill-opacity="0.78" stroke="${palette.gold}" stroke-opacity="0.86"/>
      <text x="${ageX - 31}" y="${format.ageY + 1}" text-anchor="middle" fill="${palette.goldLight}" font-family="Arial, sans-serif" font-size="20" font-weight="900">21+</text>
      <line x1="${copyLeft}" y1="${format.kickerY - 24}" x2="${copyLeft + 64}" y2="${format.kickerY - 24}" stroke="${palette.gold}" stroke-width="4"/>
      <text x="${copyLeft}" y="${format.kickerY}" fill="${palette.goldLight}" font-family="Arial, sans-serif" font-size="18" font-weight="900" letter-spacing="4">${escapeXml(concept.kicker)}</text>
      ${lineBlock(concept.headline, {
        x: copyLeft,
        y: format.headlineY,
        size: format.headlineSize,
        gap: format.headlineGap,
        color: palette.cream,
        family: "Georgia, Times New Roman, serif",
        weight: 700,
        spacing: -1,
      })}
      ${lineBlock(concept.subline, {
        x: copyLeft + 2,
        y: format.sublineY,
        size: format.sublineSize,
        gap: format.sublineGap,
        color: palette.cream,
        family: "Arial, sans-serif",
        weight: 600,
      })}
      <rect x="${copyLeft}" y="${format.ctaY}" width="${concept.ctaWidth}" height="${ctaHeight}" rx="3" fill="${palette.gold}"/>
      <text x="${copyLeft + concept.ctaWidth / 2}" y="${format.ctaY + Math.round(ctaHeight * 0.64)}" text-anchor="middle" fill="${palette.ink}" font-family="Arial, sans-serif" font-size="18" font-weight="900" letter-spacing="2">${escapeXml(concept.cta)}</text>
      <line x1="${copyLeft}" y1="${footerTop}" x2="${width - inset - 28}" y2="${footerTop}" stroke="${palette.gold}" stroke-opacity="0.52"/>
      <text x="${copyLeft}" y="${format.footerY}" fill="${palette.cream}" font-family="Arial, sans-serif" font-size="17" font-weight="800" letter-spacing="3">ADULTS 21+ ONLY</text>
      <text x="${width - inset - 28}" y="${format.footerY}" text-anchor="end" fill="${palette.muted}" font-family="Arial, sans-serif" font-size="15" font-weight="700" letter-spacing="2">YUZUCIGARCLUB.COM</text>
    </svg>
  `);
}

function storyJoinSvg(width, height) {
  return Buffer.from(`
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="topFade" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stop-color="${palette.night}" stop-opacity="0.78"/>
          <stop offset="0.27" stop-color="${palette.night}" stop-opacity="0.52"/>
          <stop offset="0.43" stop-color="${palette.night}" stop-opacity="0"/>
        </linearGradient>
      </defs>
      <rect width="${width}" height="${height}" fill="url(#topFade)"/>
    </svg>
  `);
}

async function prepareBase(sourcePath, format) {
  if (format.slug !== "story-9x16") {
    return sharp(sourcePath)
      .resize(format.width, format.height, { fit: "cover", position: "center" })
      .modulate({ brightness: 0.97, saturation: 0.98 })
      .png()
      .toBuffer();
  }

  const backdrop = await sharp(sourcePath)
    .resize(format.width, format.height, { fit: "cover", position: "center" })
    .blur(28)
    .modulate({ brightness: 0.55, saturation: 0.72 })
    .png()
    .toBuffer();
  const clearImage = await sharp(sourcePath)
    .resize(format.width, 1350, { fit: "cover", position: "center" })
    .modulate({ brightness: 0.96, saturation: 0.98 })
    .png()
    .toBuffer();

  return sharp(backdrop)
    .composite([
      { input: clearImage, left: 0, top: 430 },
      { input: storyJoinSvg(format.width, format.height), left: 0, top: 0 },
    ])
    .png()
    .toBuffer();
}

async function renderAsset(concept, format, logo) {
  const sourcePath = path.join(sourceDir, concept.source);
  const base = await prepareBase(sourcePath, format);
  const logoLeft = format.inset + 26;

  return sharp(base)
    .composite([
      { input: overlaySvg(concept, format), left: 0, top: 0 },
      { input: logo, left: logoLeft, top: format.logoTop },
    ])
    .jpeg({ quality: 94, mozjpeg: true })
    .toBuffer();
}

async function renderContactSheet(items, format) {
  const isStory = format.slug === "story-9x16";
  const thumbWidth = isStory ? 270 : format.slug === "square-1x1" ? 360 : 324;
  const thumbHeight = Math.round((thumbWidth * format.height) / format.width);
  const gap = 30;
  const labelHeight = 54;
  const columns = isStory ? 4 : 2;
  const rows = Math.ceil(items.length / columns);
  const sheetWidth = columns * thumbWidth + (columns + 1) * gap;
  const sheetHeight = rows * (thumbHeight + labelHeight) + (rows + 1) * gap;
  const composites = [];

  for (const [index, item] of items.entries()) {
    const col = index % columns;
    const row = Math.floor(index / columns);
    const left = gap + col * (thumbWidth + gap);
    const top = gap + row * (thumbHeight + labelHeight + gap);
    const thumb = await sharp(item.buffer)
      .resize(thumbWidth, thumbHeight, { fit: "cover" })
      .jpeg({ quality: 88 })
      .toBuffer();
    const label = Buffer.from(`
      <svg width="${thumbWidth}" height="${labelHeight}" xmlns="http://www.w3.org/2000/svg">
        <rect width="${thumbWidth}" height="${labelHeight}" fill="${palette.night}"/>
        <text x="0" y="35" fill="${palette.gold}" font-family="Arial, sans-serif" font-size="18" font-weight="900" letter-spacing="1">${escapeXml(item.slug.toUpperCase().replaceAll("-", " "))}</text>
      </svg>
    `);
    composites.push({ input: thumb, left, top });
    composites.push({ input: label, left, top: top + thumbHeight });
  }

  return sharp({
    create: {
      width: sheetWidth,
      height: sheetHeight,
      channels: 3,
      background: palette.night,
    },
  })
    .composite(composites)
    .jpeg({ quality: 92, mozjpeg: true })
    .toBuffer();
}

async function main() {
  const missing = concepts
    .map((concept) => path.join(sourceDir, concept.source))
    .filter((filePath) => !existsSync(filePath));
  if (missing.length > 0) {
    throw new Error(`Missing campaign source image(s):\n${missing.join("\n")}`);
  }
  if (!existsSync(logoPath)) {
    throw new Error(`Missing canonical Yuzu logo: ${logoPath}`);
  }

  await Promise.all([
    mkdir(mastersDir, { recursive: true }),
    ...formats.map((format) => mkdir(path.join(campaignDir, "exports", format.slug), { recursive: true })),
  ]);

  const logo = await sharp(logoPath).resize(48, 48, { fit: "contain" }).png().toBuffer();
  const manifestAssets = [];

  for (const format of formats) {
    const rendered = [];
    for (const concept of concepts) {
      const buffer = await renderAsset(concept, format, logo);
      const filename = `yuzu-${concept.slug}-${format.suffix}-v01.jpg`;
      const outputPath = path.join(campaignDir, "exports", format.slug, filename);
      await writeFile(outputPath, buffer);
      rendered.push({ slug: concept.slug, buffer, path: outputPath });
      manifestAssets.push({ concept: concept.slug, format: format.slug, path: path.relative(campaignDir, outputPath).replaceAll("\\", "/") });

      if (format.slug === "feed-4x5") {
        const masterPath = path.join(mastersDir, `yuzu-${concept.slug}-master-4x5.png`);
        await sharp(buffer).png().toFile(masterPath);
      }
    }

    const sheet = await renderContactSheet(rendered, format);
    await writeFile(path.join(campaignDir, `${format.slug}-contact-sheet.jpg`), sheet);
    if (format.slug === "feed-4x5") {
      await writeFile(path.join(campaignDir, "contact-sheet.jpg"), sheet);
    }
  }

  await writeFile(
    path.join(campaignDir, "manifest.json"),
    `${JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        campaign: "Yuzu 21+ owned-channel campaign creative",
        renderer: "scripts/render-yuzu-campaign-assets.mjs",
        sourceImages: concepts.map((concept) => ({ concept: concept.slug, path: `source/${concept.source}` })),
        assets: manifestAssets,
        copy: concepts.map(({ slug, kicker, headline, subline, cta }) => ({ slug, kicker, headline, subline, cta, footer: "ADULTS 21+ ONLY" })),
        compliance: "Organic/owned-channel proof only unless a publisher explicitly permits adult cigar advertising and legal review approves placement. No health, price, discount, inventory, availability, giveaway, or ordering claims.",
      },
      null,
      2,
    )}\n`,
  );

  console.log(JSON.stringify({ campaignDir, assets: manifestAssets.length }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
