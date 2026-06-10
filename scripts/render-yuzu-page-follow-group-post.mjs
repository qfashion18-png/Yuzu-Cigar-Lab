import { mkdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import sharp from "sharp";

const root = process.cwd();
const outputDir = resolve(root, "output/social/yuzu-page-follow-group-post-2026-06-09");
const groupAssetDir = join(outputDir, "group-specific-assets");
const sourceDir = resolve(root, "output/social/facebook-group-posts-2026-06");
const size = { width: 1080, height: 1080 };

const palette = {
  cream: "#f8efe1",
  muted: "#dbc8a6",
  gold: "#e6b85a",
  green: "#102f28",
  ink: "#070604",
  panel: "#090705",
};

const groups = [
  {
    id: "yuzu-lounge",
    label: "Yuzu Lounge",
    sourceImage: resolve(root, "public/assets/about-lounge.png"),
    outputImage: resolve(outputDir, "yuzu-page-follow-group-post-square.png"),
    eyebrow: "GROUP VOTE",
    headline: "What guide should go first?",
    subline: "Pick the next adult 21+ Yuzu cigar info post.",
    chips: ["Humidor care", "Pairings", "Wrapper basics", "Cut & light", "Lounge etiquette"],
    cta: "COMMENT YOUR VOTE",
    footer: "21+ ONLY / NO MARKETPLACE POSTS",
    brand: "YUZU CIGAR CLUB",
    isOwnedGroup: true,
  },
  {
    id: "valley-cigar-club",
    label: "Valley Cigar Club",
    sourceImage: resolve(sourceDir, "valley-cigar-club-humidor-check.png"),
    outputImage: join(groupAssetDir, "valley-cigar-club-info-prompt.png"),
    eyebrow: "PHOENIX HUMIDOR NOTE",
    headline: "What does desert air teach?",
    subline: "Share the storage cue you trust before adjusting.",
    chips: ["RH trend", "Wrapper feel", "Draw", "Cedar smell"],
    cta: "SHARE ONE CUE",
    footer: "21+ ONLY / INFORMATIONAL DISCUSSION",
    brand: "CIGAR INFO PROMPT",
  },
  {
    id: "ash-hole-cigar-club",
    label: "Ash Hole Cigar Club",
    sourceImage: resolve(sourceDir, "ash-hole-cigar-club-community-table.png"),
    outputImage: join(groupAssetDir, "ash-hole-cigar-club-info-prompt.png"),
    eyebrow: "COMMUNITY TABLE",
    headline: "What lesson do you pass on?",
    subline: "Name one cigar habit that helps newer adults.",
    chips: ["Storage", "Pairings", "Etiquette", "First cut"],
    cta: "DROP ONE LESSON",
    footer: "21+ ONLY / RESPECTFUL CIGAR TALK",
    brand: "CIGAR INFO PROMPT",
  },
  {
    id: "tap-n-ash-fan-club",
    label: "Tap N Ash Fan Club",
    sourceImage: resolve(sourceDir, "tap-n-ash-social-club-lounge-night.png"),
    outputImage: join(groupAssetDir, "tap-n-ash-fan-club-info-prompt.png"),
    eyebrow: "LOUNGE NIGHT QUESTION",
    headline: "What makes a lounge memorable?",
    subline: "Pick the detail that turns cigar talk into community.",
    chips: ["Chairs", "Music", "Patio", "Good hosts"],
    cta: "PICK ONE DETAIL",
    footer: "21+ ONLY / NO MARKETPLACE POSTS",
    brand: "CIGAR INFO PROMPT",
  },
  {
    id: "cigar-connoisseurs",
    label: "Cigar Connoisseurs",
    sourceImage: resolve(sourceDir, "cigar-connoisseurs-tasting-notes.png"),
    outputImage: join(groupAssetDir, "cigar-connoisseurs-info-prompt.png"),
    eyebrow: "NOTE-TAKER THREAD",
    headline: "Which cigar note matters most?",
    subline: "Choose the cue that makes a review useful.",
    chips: ["Aroma", "Texture", "Finish", "Pairing"],
    cta: "COMMENT A CUE",
    footer: "21+ ONLY / SUBJECTIVE NOTES",
    brand: "CIGAR INFO PROMPT",
  },
  {
    id: "black-cigar-smokers",
    label: "Black Cigar Smokers",
    sourceImage: resolve(sourceDir, "black-cigar-smokers-community-lounge.png"),
    outputImage: join(groupAssetDir, "black-cigar-smokers-info-prompt.png"),
    eyebrow: "MENTORSHIP THREAD",
    headline: "What tip welcomed you in?",
    subline: "Share one piece of cigar knowledge worth passing along.",
    chips: ["First lounge", "Wrapper", "Humidor", "Pairing"],
    cta: "PASS IT ON",
    footer: "21+ ONLY / COMMUNITY CIGAR TALK",
    brand: "CIGAR INFO PROMPT",
  },
  {
    id: "hollow-down-online-group",
    label: "Hollow Down Online Group",
    sourceImage: resolve(sourceDir, "hollow-down-online-group-podcast-lounge.png"),
    outputImage: join(groupAssetDir, "hollow-down-online-group-info-prompt.png"),
    eyebrow: "PODCAST LOUNGE QUESTION",
    headline: "What topic starts cigar talk?",
    subline: "Vote for the cigar information you would actually save.",
    chips: ["Storage", "Pairings", "Etiquette", "First cigars"],
    cta: "VOTE ONE TOPIC",
    footer: "21+ ONLY / CONVERSATION FIRST",
    brand: "CIGAR INFO PROMPT",
  },
];

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

  if (current) lines.push(current);
  return lines;
}

function textBlock({ x, y, lines, size: fontSize, color, family = "Arial", weight = 700, lineGap = 1.15, anchor = "start" }) {
  const tspans = lines
    .map((line, index) => {
      const dy = index === 0 ? 0 : fontSize * lineGap;
      return `<tspan x="${x}" dy="${dy}">${escapeXml(line)}</tspan>`;
    })
    .join("");

  return `<text x="${x}" y="${y}" fill="${color}" text-anchor="${anchor}" font-family="${family}" font-size="${fontSize}" font-weight="${weight}" letter-spacing="0">${tspans}</text>`;
}

function chip({ x, y, label, width }) {
  return `
    <rect x="${x}" y="${y}" width="${width}" height="54" rx="27" fill="${palette.green}" stroke="${palette.gold}" stroke-width="2"/>
    <text x="${x + width / 2}" y="${y + 36}" fill="${palette.cream}" text-anchor="middle" font-family="Arial" font-size="22" font-weight="900" letter-spacing="0">${escapeXml(label)}</text>
  `;
}

function chipRows(chips) {
  const widths = chips.map((label) => Math.max(170, Math.min(292, label.length * 15 + 72)));
  const rows = [];
  let row = [];
  let rowWidth = 0;

  chips.forEach((label, index) => {
    const width = widths[index];
    const nextWidth = rowWidth + width + (row.length ? 22 : 0);
    if (nextWidth > 830 && row.length) {
      rows.push(row);
      row = [];
      rowWidth = 0;
    }
    row.push({ label, width });
    rowWidth += width + (row.length > 1 ? 22 : 0);
  });

  if (row.length) rows.push(row);

  return rows
    .map((items, rowIndex) => {
      const totalWidth = items.reduce((sum, item) => sum + item.width, 0) + (items.length - 1) * 22;
      let x = 540 - totalWidth / 2;
      const y = 706 + rowIndex * 78;
      const pieces = items.map((item) => {
        const piece = chip({ x, y, label: item.label, width: item.width });
        x += item.width + 22;
        return piece;
      });
      return pieces.join("");
    })
    .join("");
}

function overlaySvg(group) {
  const headline = wrapText(group.headline, 24);
  const headlineSize = headline.length > 1 ? 56 : 62;
  const subline = wrapText(group.subline, 39);

  return Buffer.from(`
    <svg width="${size.width}" height="${size.height}" viewBox="0 0 ${size.width} ${size.height}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="shade" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stop-color="#050301" stop-opacity="0.48"/>
          <stop offset="0.45" stop-color="#050301" stop-opacity="0.58"/>
          <stop offset="1" stop-color="#050301" stop-opacity="0.84"/>
        </linearGradient>
      </defs>
      <rect width="1080" height="1080" fill="url(#shade)"/>
      <rect x="56" y="56" width="968" height="968" fill="none" stroke="${palette.gold}" stroke-width="4"/>
      <rect x="88" y="86" width="${group.isOwnedGroup ? 292 : 290}" height="50" rx="25" fill="${palette.green}" stroke="${palette.gold}" stroke-width="2"/>
      <text x="${group.isOwnedGroup ? 234 : 233}" y="119" fill="${palette.gold}" text-anchor="middle" font-family="Arial" font-size="20" font-weight="900" letter-spacing="0">${escapeXml(group.brand)}</text>

      <rect x="86" y="206" width="908" height="418" rx="22" fill="${palette.panel}" opacity="0.76" stroke="${palette.gold}" stroke-width="3"/>
      <text x="126" y="270" fill="${palette.gold}" font-family="Arial" font-size="23" font-weight="900" letter-spacing="0">${escapeXml(group.eyebrow)}</text>
      ${textBlock({ x: 126, y: 372, lines: headline, size: headlineSize, color: palette.cream, family: "Georgia", weight: 900, lineGap: 0.96 })}
      ${textBlock({ x: 128, y: headline.length > 1 ? 533 : 500, lines: subline, size: 31, color: palette.muted, family: "Georgia", weight: 700, lineGap: 1.1 })}

      ${chipRows(group.chips)}

      <rect x="326" y="908" width="428" height="64" rx="16" fill="${palette.gold}"/>
      <text x="540" y="950" fill="${palette.ink}" text-anchor="middle" font-family="Arial" font-size="24" font-weight="900" letter-spacing="0">${escapeXml(group.cta)}</text>
      <text x="540" y="1007" fill="${palette.cream}" text-anchor="middle" font-family="Arial" font-size="21" font-weight="900" letter-spacing="0">${escapeXml(group.footer)}</text>
    </svg>
  `);
}

async function renderCard(group) {
  const base = await sharp(group.sourceImage)
    .resize(size.width, size.height, { fit: "cover", position: "center" })
    .modulate({ brightness: 0.95, saturation: 1.04 })
    .png()
    .toBuffer();

  const card = await sharp(base)
    .composite([{ input: overlaySvg(group), left: 0, top: 0 }])
    .png({ compressionLevel: 9 })
    .toBuffer();

  await writeFile(group.outputImage, card);
  return { ...group, buffer: card };
}

async function renderContactSheet(outputs) {
  const thumbSize = 260;
  const labelHeight = 48;
  const gap = 24;
  const cols = 4;
  const rows = Math.ceil(outputs.length / cols);
  const width = cols * thumbSize + (cols + 1) * gap;
  const height = rows * (thumbSize + labelHeight) + (rows + 1) * gap;

  const composites = [];
  for (const [index, output] of outputs.entries()) {
    const row = Math.floor(index / cols);
    const col = index % cols;
    const x = gap + col * (thumbSize + gap);
    const y = gap + row * (thumbSize + labelHeight + gap);
    const thumb = await sharp(output.buffer).resize(thumbSize, thumbSize, { fit: "cover" }).jpeg({ quality: 86 }).toBuffer();
    const label = Buffer.from(`
      <svg width="${thumbSize}" height="${labelHeight}" viewBox="0 0 ${thumbSize} ${labelHeight}" xmlns="http://www.w3.org/2000/svg">
        <rect width="${thumbSize}" height="${labelHeight}" fill="${palette.ink}"/>
        <text x="${thumbSize / 2}" y="31" fill="${palette.gold}" text-anchor="middle" font-family="Arial" font-size="16" font-weight="900" letter-spacing="0">${escapeXml(output.label)}</text>
      </svg>
    `);
    composites.push({ input: thumb, left: x, top: y });
    composites.push({ input: label, left: x, top: y + thumbSize });
  }

  await sharp({
    create: {
      width,
      height,
      channels: 3,
      background: palette.ink,
    },
  })
    .composite(composites)
    .jpeg({ quality: 90, mozjpeg: true })
    .toFile(resolve(outputDir, "yuzu-group-follower-posts-contact-sheet.jpg"));
}

async function main() {
  await mkdir(outputDir, { recursive: true });
  await mkdir(groupAssetDir, { recursive: true });
  const outputs = [];

  for (const group of groups) {
    outputs.push(await renderCard(group));
    console.log(group.outputImage);
  }

  await renderContactSheet(outputs);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
