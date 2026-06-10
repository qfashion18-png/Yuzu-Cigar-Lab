import { mkdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import sharp from "sharp";

const root = process.cwd();
const logoImage = resolve(root, "public/assets/yuzu-logo.png");
const outputDir = resolve(
  root,
  "output/social/facebook-planner-month-2026-06-09/how-to-ash-expanded-guide",
);
const storyOutputDir = resolve(outputDir, "story-assets");
const sourcePhotoDir = resolve(outputDir, "source-photos");
const sourcePhotos = {
  cover: resolve(sourcePhotoDir, "how-to-ash-premium-photoreal-source.png"),
  step1: resolve(sourcePhotoDir, "how-to-ash-step-1-let-it-build-photo.png"),
  step2: resolve(sourcePhotoDir, "how-to-ash-step-2-move-over-tray-photo.png"),
  step3: resolve(sourcePhotoDir, "how-to-ash-step-3-roll-gently-photo.png"),
  step4: resolve(sourcePhotoDir, "how-to-ash-step-4-reset-check-photo.png"),
};
const pageAssetPath = resolve(
  root,
  "output/social/facebook-planner-month-2026-06-09/page-assets/2026-06-09-how-to-ash-a-cigar-fb-page-4x5.jpg",
);

const size = { width: 1080, height: 1350 };
const palette = {
  cream: "#f8efe1",
  muted: "#d7c7ad",
  gold: "#e9bd59",
  green: "#12352f",
  dark: "#080704",
  panel: "#0c0a06",
  line: "#e9bd59",
  ash: "#c8c0b0",
  ember: "#d56a30",
  cigar: "#7c3f1d",
};

const slides = [
  {
    file: "01-how-to-ash-cover-4x5.jpg",
    storyFile: "story-01-how-to-ash-cover-9x16.jpg",
    eyebrow: "VISUAL GUIDE",
    title: "HOW TO ASH",
    subtitle: "A cleaner cigar habit in four calm moves.",
    step: "GUIDE",
    kind: "poster",
    photo: sourcePhotos.cover,
    storyPromptLabel: "THE HABIT",
    storyPrompt: "Let the ash release. Do not chase it.",
    bullets: [
      "Let the ash build before you move.",
      "Bring the cigar over the tray first.",
      "Roll gently; do not jab or chase it.",
      "Reset the rest and check the burn line.",
    ],
  },
  {
    file: "02-let-it-build-4x5.jpg",
    storyFile: "story-02-let-it-build-9x16.jpg",
    eyebrow: "STEP 1",
    title: "LET IT BUILD",
    subtitle: "Ash releases cleaner when you stop rushing it.",
    step: "01",
    kind: "build",
    photo: sourcePhotos.step1,
    storyPromptLabel: "WATCH FOR",
    storyPrompt: "A firm ash cap before you move.",
    bullets: [
      "Give the ash time to firm up.",
      "Constant tapping can disturb the burn.",
      "Move only when the ash looks heavy or loose.",
    ],
  },
  {
    file: "03-move-over-the-tray-4x5.jpg",
    storyFile: "story-03-move-over-the-tray-9x16.jpg",
    eyebrow: "STEP 2",
    title: "MOVE OVER TRAY",
    subtitle: "Put the landing zone under the cigar first.",
    step: "02",
    kind: "tray",
    photo: sourcePhotos.step2,
    storyPromptLabel: "THE MOVE",
    storyPrompt: "Keep it level over the tray.",
    bullets: [
      "Keep the cigar level as you move.",
      "Hold it over the tray before release.",
      "Let gravity do the quiet work.",
    ],
  },
  {
    file: "04-roll-gently-4x5.jpg",
    storyFile: "story-04-roll-gently-9x16.jpg",
    eyebrow: "STEP 3",
    title: "ROLL GENTLY",
    subtitle: "The ash should release, not get knocked off.",
    step: "03",
    kind: "roll",
    photo: sourcePhotos.step3,
    storyPromptLabel: "THE MOVE",
    storyPrompt: "Touch, rotate, stop.",
    bullets: [
      "Touch the ash to the tray edge.",
      "Rotate the cigar softly.",
      "If it holds, wait a little longer.",
    ],
  },
  {
    file: "05-reset-and-check-4x5.jpg",
    storyFile: "story-05-reset-and-check-9x16.jpg",
    eyebrow: "STEP 4",
    title: "RESET AND CHECK",
    subtitle: "A clean rest keeps the next draw simple.",
    step: "04",
    kind: "reset",
    photo: sourcePhotos.step4,
    storyPromptLabel: "RESET",
    storyPrompt: "Clean rest, then check the burn line.",
    bullets: [
      "Set the cigar back without crushing the foot.",
      "Brush loose ash away from the rest.",
      "Glance at the burn line before continuing.",
    ],
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

  if (current) {
    lines.push(current);
  }

  return lines;
}

function textBlock({ x, y, lines, size: fontSize, color, family = "Arial", weight = 700, lineGap = 1.22 }) {
  const spans = lines
    .map((line, index) => {
      const dy = index === 0 ? 0 : fontSize * lineGap;
      return `<tspan x="${x}" dy="${dy}">${escapeXml(line)}</tspan>`;
    })
    .join("");

  return `<text x="${x}" y="${y}" fill="${color}" font-family="${family}" font-size="${fontSize}" font-weight="${weight}" letter-spacing="0">${spans}</text>`;
}

function bulletList(items, x, y, width, fontSize = 31) {
  let cursorY = y;
  const pieces = [];

  for (const item of items) {
    const lines = wrapText(item, Math.floor(width / (fontSize * 0.5)));
    pieces.push(`<circle cx="${x}" cy="${cursorY - fontSize * 0.28}" r="7" fill="${palette.gold}"/>`);
    pieces.push(
      textBlock({
        x: x + 28,
        y: cursorY,
        lines,
        size: fontSize,
        color: palette.cream,
        family: "Arial",
        weight: 700,
        lineGap: 1.15,
      }),
    );
    cursorY += lines.length * fontSize * 1.15 + 25;
  }

  return pieces.join("");
}

function overlay(slide) {
  const titleLines = slide.title.length > 14 ? wrapText(slide.title, 15) : [slide.title];
  const subtitleLines = wrapText(slide.subtitle, 40);
  const isPoster = slide.kind === "poster";
  const displayBullets = isPoster ? slide.bullets : slide.bullets.slice(0, 2);
  const bulletWidth = isPoster ? 790 : 720;
  const panelHeight = isPoster ? 595 : 474;
  const panelY = isPoster ? 192 : 206;
  const bulletY = isPoster ? 570 : 582;
  const badgeX = isPoster ? 884 : 918;
  const badgeRadius = isPoster ? 64 : 58;
  const titleSize = isPoster ? 76 : slide.title.length > 13 ? 58 : 66;
  const subtitleSize = isPoster ? 34 : 32;

  return Buffer.from(`
    <svg width="${size.width}" height="${size.height}" viewBox="0 0 ${size.width} ${size.height}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="fade" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stop-color="#030201" stop-opacity="0.78"/>
          <stop offset="0.42" stop-color="#030201" stop-opacity="0.63"/>
          <stop offset="0.7" stop-color="#030201" stop-opacity="0.16"/>
          <stop offset="1" stop-color="#030201" stop-opacity="0.34"/>
        </linearGradient>
      </defs>
      <rect width="1080" height="1350" fill="url(#fade)"/>
      <rect x="54" y="54" width="972" height="1242" fill="none" stroke="${palette.gold}" stroke-width="4"/>
      <rect x="78" y="${panelY}" width="${isPoster ? 835 : 780}" height="${panelHeight}" rx="22" fill="${palette.panel}" opacity="${isPoster ? 0.72 : 0.78}" stroke="${palette.gold}" stroke-width="3"/>
      <text x="82" y="126" fill="${palette.gold}" font-family="Arial" font-size="28" font-weight="900" letter-spacing="0">YUZU CIGAR CLUB</text>
      <line x1="82" y1="149" x2="352" y2="149" stroke="${palette.gold}" stroke-width="5"/>
      <rect x="922" y="84" width="88" height="88" rx="22" fill="#050505" stroke="${palette.gold}" stroke-width="2"/>
      <text x="114" y="${panelY + 62}" fill="${palette.gold}" font-family="Arial" font-size="22" font-weight="900" letter-spacing="0">${escapeXml(slide.eyebrow)}</text>
      ${textBlock({ x: 114, y: isPoster ? 355 : 356, lines: titleLines, size: titleSize, color: palette.cream, family: "Georgia", weight: 900, lineGap: 0.95 })}
      ${textBlock({ x: 116, y: isPoster ? 490 : 500, lines: subtitleLines, size: subtitleSize, color: palette.cream, family: "Georgia", weight: 700, lineGap: 1.12 })}
      ${bulletList(displayBullets, 122, bulletY, bulletWidth, isPoster ? 26 : 28)}
      <circle cx="${badgeX}" cy="${panelY + 64}" r="${badgeRadius}" fill="${palette.green}" stroke="${palette.gold}" stroke-width="4"/>
      <text x="${badgeX}" y="${panelY + 77}" fill="${palette.gold}" text-anchor="middle" font-family="Arial" font-size="${slide.step === "GUIDE" ? 24 : 34}" font-weight="900" letter-spacing="0">${escapeXml(slide.step)}</text>
      <rect x="78" y="1178" width="320" height="74" rx="14" fill="${palette.gold}"/>
      <text x="238" y="1225" fill="#11100b" text-anchor="middle" font-family="Arial" font-size="24" font-weight="900" letter-spacing="0">SAVE THIS GUIDE</text>
      <text x="82" y="1282" fill="${palette.cream}" font-family="Arial" font-size="21" font-weight="700" letter-spacing="0">21+ ONLY / NO MARKETPLACE POSTS</text>
    </svg>
  `);
}

function storyOverlay(slide, index, total) {
  const storySize = { width: 1080, height: 1920 };
  const titleLines = slide.title.length > 13 ? wrapText(slide.title, 13) : [slide.title];
  const subtitleLines = wrapText(slide.subtitle, 31);
  const isPoster = slide.kind === "poster";
  const displayBullets = isPoster ? slide.bullets : slide.bullets.slice(0, 2);
  const promptLines = wrapText(slide.storyPrompt, 27);
  const panelY = isPoster ? 238 : 260;
  const panelHeight = isPoster ? 760 : 700;
  const titleY = isPoster ? 408 : 444;
  const subtitleY = isPoster ? 548 : 608;
  const bulletY = isPoster ? 694 : 728;
  const badgeY = panelY + 86;
  const titleSize = isPoster ? 86 : slide.title.length > 13 ? 72 : 82;
  const bulletSize = isPoster ? 30 : 34;

  return Buffer.from(`
    <svg width="${storySize.width}" height="${storySize.height}" viewBox="0 0 ${storySize.width} ${storySize.height}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="storyFade" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stop-color="#030201" stop-opacity="0.86"/>
          <stop offset="0.34" stop-color="#030201" stop-opacity="0.58"/>
          <stop offset="0.62" stop-color="#030201" stop-opacity="0.18"/>
          <stop offset="1" stop-color="#030201" stop-opacity="0.84"/>
        </linearGradient>
        <linearGradient id="storyPanelFade" x1="0" x2="1" y1="0" y2="0">
          <stop offset="0" stop-color="${palette.panel}" stop-opacity="0.9"/>
          <stop offset="0.72" stop-color="${palette.panel}" stop-opacity="0.78"/>
          <stop offset="1" stop-color="${palette.panel}" stop-opacity="0.42"/>
        </linearGradient>
      </defs>
      <rect width="1080" height="1920" fill="url(#storyFade)"/>
      <rect x="54" y="88" width="972" height="1704" fill="none" stroke="${palette.gold}" stroke-width="4"/>
      <text x="84" y="154" fill="${palette.gold}" font-family="Arial" font-size="28" font-weight="900" letter-spacing="0">YUZU CIGAR CLUB</text>
      <line x1="84" y1="177" x2="354" y2="177" stroke="${palette.gold}" stroke-width="5"/>
      <text x="84" y="220" fill="${palette.muted}" font-family="Arial" font-size="22" font-weight="800" letter-spacing="0">STORY ${index + 1}/${total}</text>
      <rect x="906" y="112" width="92" height="92" rx="22" fill="#050505" stroke="${palette.gold}" stroke-width="2"/>
      <rect x="78" y="${panelY}" width="924" height="${panelHeight}" rx="26" fill="url(#storyPanelFade)" stroke="${palette.gold}" stroke-width="3"/>
      <text x="116" y="${panelY + 72}" fill="${palette.gold}" font-family="Arial" font-size="24" font-weight="900" letter-spacing="0">${escapeXml(slide.eyebrow)}</text>
      <circle cx="880" cy="${badgeY}" r="${isPoster ? 66 : 62}" fill="${palette.green}" stroke="${palette.gold}" stroke-width="4"/>
      <text x="880" y="${badgeY + 14}" fill="${palette.gold}" text-anchor="middle" font-family="Arial" font-size="${slide.step === "GUIDE" ? 24 : 36}" font-weight="900" letter-spacing="0">${escapeXml(slide.step)}</text>
      ${textBlock({ x: 116, y: titleY, lines: titleLines, size: titleSize, color: palette.cream, family: "Georgia", weight: 900, lineGap: 0.92 })}
      ${textBlock({ x: 118, y: subtitleY, lines: subtitleLines, size: isPoster ? 37 : 36, color: palette.cream, family: "Georgia", weight: 700, lineGap: 1.08 })}
      ${bulletList(displayBullets, 128, bulletY, isPoster ? 790 : 760, bulletSize)}
      <rect x="78" y="1330" width="924" height="266" rx="26" fill="${palette.green}" opacity="0.9" stroke="${palette.gold}" stroke-width="3"/>
      <text x="118" y="1398" fill="${palette.gold}" font-family="Arial" font-size="24" font-weight="900" letter-spacing="0">${escapeXml(slide.storyPromptLabel)}</text>
      ${textBlock({ x: 118, y: 1470, lines: promptLines, size: 44, color: palette.cream, family: "Georgia", weight: 900, lineGap: 1.04 })}
      <text x="118" y="1636" fill="${palette.cream}" font-family="Arial" font-size="29" font-weight="900" letter-spacing="0">FULL GUIDE ON THE PAGE</text>
      <text x="118" y="1698" fill="${palette.muted}" font-family="Arial" font-size="23" font-weight="800" letter-spacing="0">21+ ONLY / NO MARKETPLACE POSTS</text>
    </svg>
  `);
}

async function renderSlide(slide) {
  const base = await sharp(slide.photo)
    .resize(size.width, size.height, { fit: "cover", position: "center" })
    .modulate({ brightness: 0.98, saturation: 1.03 })
    .jpeg({ quality: 92 })
    .toBuffer();
  const logo = await sharp(logoImage).resize(58, 58).png().toBuffer();

  return sharp(base)
    .composite([
      { input: overlay(slide), top: 0, left: 0 },
      { input: logo, top: 99, left: 937 },
    ])
    .jpeg({ quality: 94, mozjpeg: true })
    .toBuffer();
}

async function renderStorySlide(slide, index, total) {
  const storySize = { width: 1080, height: 1920 };
  const base = await sharp(slide.photo)
    .resize(storySize.width, storySize.height, { fit: "cover", position: "center" })
    .modulate({ brightness: 0.98, saturation: 1.04 })
    .jpeg({ quality: 96 })
    .toBuffer();
  const logo = await sharp(logoImage).resize(62, 62).png().toBuffer();

  return sharp(base)
    .composite([
      { input: storyOverlay(slide, index, total), top: 0, left: 0 },
      { input: logo, top: 127, left: 921 },
    ])
    .jpeg({ quality: 95, mozjpeg: true })
    .toBuffer();
}

async function renderContactSheet(outputs) {
  const thumbWidth = 360;
  const thumbHeight = 450;
  const gap = 28;
  const labelHeight = 42;
  const sheetWidth = thumbWidth * 3 + gap * 4;
  const sheetHeight = (thumbHeight + labelHeight) * 2 + gap * 3;
  const background = sharp({
    create: {
      width: sheetWidth,
      height: sheetHeight,
      channels: 3,
      background: palette.dark,
    },
  });

  const composites = [];
  for (const [index, output] of outputs.entries()) {
    const row = Math.floor(index / 3);
    const col = index % 3;
    const x = gap + col * (thumbWidth + gap);
    const y = gap + row * (thumbHeight + labelHeight + gap);
    const thumb = await sharp(output.buffer)
      .resize(thumbWidth, thumbHeight, { fit: "cover" })
      .jpeg({ quality: 88 })
      .toBuffer();
    const label = Buffer.from(`
      <svg width="${thumbWidth}" height="${labelHeight}" xmlns="http://www.w3.org/2000/svg">
        <rect width="100%" height="100%" fill="${palette.dark}"/>
        <text x="0" y="29" fill="${palette.gold}" font-family="Arial" font-size="24" font-weight="900">${escapeXml(output.label)}</text>
      </svg>
    `);
    composites.push({ input: thumb, top: y, left: x });
    composites.push({ input: label, top: y + thumbHeight + 8, left: x });
  }

  return background.composite(composites).jpeg({ quality: 92, mozjpeg: true }).toBuffer();
}

async function renderStoryContactSheet(outputs) {
  const thumbWidth = 216;
  const thumbHeight = 384;
  const gap = 26;
  const labelHeight = 42;
  const sheetWidth = thumbWidth * outputs.length + gap * (outputs.length + 1);
  const sheetHeight = thumbHeight + labelHeight + gap * 2 + 20;
  const background = sharp({
    create: {
      width: sheetWidth,
      height: sheetHeight,
      channels: 3,
      background: palette.dark,
    },
  });

  const composites = [];
  for (const [index, output] of outputs.entries()) {
    const x = gap + index * (thumbWidth + gap);
    const y = gap;
    const thumb = await sharp(output.buffer)
      .resize(thumbWidth, thumbHeight, { fit: "cover" })
      .jpeg({ quality: 88 })
      .toBuffer();
    const label = Buffer.from(`
      <svg width="${thumbWidth}" height="${labelHeight}" xmlns="http://www.w3.org/2000/svg">
        <rect width="100%" height="100%" fill="${palette.dark}"/>
        <text x="0" y="29" fill="${palette.gold}" font-family="Arial" font-size="22" font-weight="900">${escapeXml(output.label)}</text>
      </svg>
    `);
    composites.push({ input: thumb, top: y, left: x });
    composites.push({ input: label, top: y + thumbHeight + 8, left: x });
  }

  return background.composite(composites).jpeg({ quality: 92, mozjpeg: true }).toBuffer();
}

async function main() {
  await mkdir(outputDir, { recursive: true });
  await mkdir(storyOutputDir, { recursive: true });
  const rendered = [];
  const storyRendered = [];

  for (const [index, slide] of slides.entries()) {
    const buffer = await renderSlide(slide);
    const path = join(outputDir, slide.file);
    await writeFile(path, buffer);
    rendered.push({ path, buffer, label: slide.eyebrow });

    const storyBuffer = await renderStorySlide(slide, index, slides.length);
    const storyPath = join(storyOutputDir, slide.storyFile);
    await writeFile(storyPath, storyBuffer);
    storyRendered.push({ path: storyPath, buffer: storyBuffer, label: slide.eyebrow });
  }

  await writeFile(pageAssetPath, rendered[0].buffer);
  const contactSheet = await renderContactSheet(rendered);
  await writeFile(join(outputDir, "how-to-ash-expanded-guide-contact-sheet.jpg"), contactSheet);
  const storyContactSheet = await renderStoryContactSheet(storyRendered);
  await writeFile(join(storyOutputDir, "how-to-ash-story-contact-sheet.jpg"), storyContactSheet);

  const caption = [
    "How to ash a cigar without making it a performance.",
    "",
    "1. Let it build. Give the ash time to firm up; constant tapping can disturb the burn and scatter ash.",
    "2. Move over the tray before it looks heavy. Keep the cigar level and let the tray catch the release.",
    "3. Roll gently. Touch the ash to the tray edge and rotate the cigar softly. If it does not release, wait a little longer.",
    "4. Reset the rest. Keep loose ash off the table and glance at the burn line before continuing.",
    "",
    "The habit: do not chase the ash. Let it tell you when it is ready.",
    "",
    "What habit made your ash cleaner? 21+ only.",
    "",
    "Yuzu Cigar Club. Adult 21+ only. No marketplace posts, pricing, inventory, or health claims.",
  ].join("\n");

  await writeFile(join(outputDir, "facebook-caption-how-to-ash-expanded.txt"), caption);
  await writeFile(
    join(outputDir, "how-to-ash-expanded-guide-manifest.json"),
    `${JSON.stringify(
      {
        generated_at: new Date().toISOString(),
        topic: "How to ash a cigar",
        source_images: sourcePhotos,
        updated_page_asset: pageAssetPath,
        caption: join(outputDir, "facebook-caption-how-to-ash-expanded.txt"),
        slides: slides.map((slide) => ({
          title: slide.title,
          file: join(outputDir, slide.file),
          role: slide.kind === "poster" ? "feed cover and comment visual" : "step card",
        })),
        story_assets: slides.map((slide) => ({
          title: slide.title,
          file: join(storyOutputDir, slide.storyFile),
          role: slide.kind === "poster" ? "story cover" : "story step card",
        })),
        contact_sheet: join(outputDir, "how-to-ash-expanded-guide-contact-sheet.jpg"),
        story_contact_sheet: join(storyOutputDir, "how-to-ash-story-contact-sheet.jpg"),
        compliance:
          "Adult 21+ only. Education/community framing. No marketplace, pricing, inventory, or health-claim language.",
      },
      null,
      2,
    )}\n`,
  );

  console.log(`Rendered ${rendered.length} guide slides to ${outputDir}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
