import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { chromium } from "playwright";

const root = process.cwd();
const outputDir = resolve(
  root,
  "output/social/facebook-planner-month-2026-06-09/strength-is-the-blend-guide",
);
const storyOutputDir = resolve(outputDir, "story-assets");
const pageAssetPath = resolve(
  root,
  "output/social/facebook-planner-month-2026-06-09/page-assets/2026-06-17-strength-vs-body-fb-page-4x5.jpg",
);

const assets = {
  logo: resolve(root, "public/assets/yuzu-logo.png"),
  blendAnatomy: resolve(outputDir, "source-images/generated-blend-anatomy.png"),
  threeDials: resolve(outputDir, "source-images/generated-three-dials.png"),
  primingStalk: resolve(outputDir, "source-images/generated-priming-stalk.png"),
  wrapperShades: resolve(outputDir, "source-images/generated-wrapper-shades.png"),
  vitolaPace: resolve(outputDir, "source-images/generated-vitola-pace.png"),
  chooseNotes: resolve(outputDir, "source-images/generated-choose-notes.png"),
};

const feedSize = { width: 1080, height: 1350 };
const storySize = { width: 1080, height: 1920 };

const sources = [
  {
    label: "Tobacconist University flavor chart",
    url: "https://www.tobacconistuniversity.org/pdf/flavorchart.pdf",
    takeaway: "Strength, body, and flavor should be recorded as separate tasting dimensions.",
  },
  {
    label: "Tobacconist University wrapper color FAQ",
    url: "https://tobacconistuniversity.org/faq_cigar_wrapper_color.php",
    takeaway: "Maduro is a color and fermentation cue; it is not a standalone nicotine score.",
  },
  {
    label: "Cigar Aficionado blend anatomy",
    url: "https://www.cigaraficionado.com/article/what-s-the-most-important-part-of-a-cigar",
    takeaway: "Wrapper, binder, filler, and format all influence the finished cigar.",
  },
  {
    label: "Cigar Aficionado tobacco priming report",
    url: "https://www.cigaraficionado.com/article/drought-in-dominican-republic-means-smaller-but-better-tobacco-harvest",
    takeaway: "Higher primings such as ligero and medio tiempo tend to carry more nicotine.",
  },
  {
    label: "Cigar Advisor strength and body guide",
    url: "https://www.famous-smoke.com/cigaradvisor/cigars-101/difference-between-cigar-strength-and-body",
    takeaway: "Darker wrapper color can suggest richer flavor, but blend is the better strength signal.",
  },
  {
    label: "FDA Tobacco 21",
    url: "https://www.fda.gov/tobacco-products/retail-sales-tobacco-products/tobacco-21",
    takeaway: "Cigars are covered tobacco products under federal 21+ sales rules.",
  },
];

const slides = [
  {
    file: "01-strength-is-the-blend-cover-4x5.jpg",
    storyFile: "story-01-strength-is-the-blend-cover-9x16.jpg",
    eyebrow: "MYTH FIX",
    title: "STRENGTH IS THE BLEND",
    subtitle: "Photo-real cigar cues show why wrapper color is only one clue.",
    image: assets.blendAnatomy,
    promptLabel: "SAVE THE RULE",
    prompt: "Ask what is in the blend before trusting the shade.",
    chips: ["Filler", "Binder", "Wrapper", "Size", "Pace"],
    bullets: [
      "Strength is physical impact.",
      "Body is smoke weight.",
      "Flavor is what you taste.",
    ],
    bands: [
      {
        brand: "UNDERCROWN",
        line: "Shade",
        tone: "shade",
        feed: { left: 92, top: 812, width: 286, rotate: -12 },
        story: { left: 96, top: 1088, width: 304, rotate: -12 },
      },
      {
        brand: "OLMEC",
        line: "Maduro",
        tone: "maduro",
        feed: { left: 396, top: 846, width: 232, rotate: 4 },
        story: { left: 410, top: 1168, width: 252, rotate: 4 },
      },
    ],
  },
  {
    file: "02-three-dials-4x5.jpg",
    storyFile: "story-02-three-dials-9x16.jpg",
    eyebrow: "READ 01",
    title: "THREE DIFFERENT DIALS",
    subtitle: "Do not use one word for the whole experience.",
    image: assets.threeDials,
    promptLabel: "TASTING NOTE",
    prompt: "Log strength, body, and flavor as separate lines.",
    bullets: [
      "Strength: nicotine impact you feel.",
      "Body: smoke texture and weight.",
      "Flavor: cedar, cocoa, pepper, cream, earth, sweetness.",
    ],
    bands: [
      {
        brand: "MY FATHER",
        line: "Blue",
        tone: "blue",
        feed: { left: 104, top: 822, width: 240, rotate: -13 },
        story: { left: 94, top: 1164, width: 260, rotate: -13 },
      },
    ],
  },
  {
    file: "03-blend-drives-impact-4x5.jpg",
    storyFile: "story-03-blend-drives-impact-9x16.jpg",
    eyebrow: "READ 02",
    title: "THE BLEND DRIVES IMPACT",
    subtitle: "Filler, binder, wrapper, priming, origin, and age work together.",
    image: assets.primingStalk,
    promptLabel: "LOOK FOR",
    prompt: "Ligero, higher primings, seed, origin, and blend family.",
    bullets: [
      "Filler and binder carry much of the rhythm.",
      "Ligero and high primings often raise nicotine impact.",
      "Seed, soil, fermentation, and aging can shift the result.",
    ],
    bands: [
      {
        brand: "DON PEPIN",
        line: "20th",
        tone: "red",
        feed: { left: 596, top: 890, width: 246, rotate: -2 },
        story: { left: 600, top: 1266, width: 260, rotate: -2 },
      },
      {
        brand: "AGING ROOM",
        line: "Quattro",
        tone: "cream",
        feed: { left: 706, top: 808, width: 240, rotate: 5 },
        story: { left: 704, top: 1126, width: 260, rotate: 5 },
      },
    ],
  },
  {
    file: "04-wrapper-is-not-rank-4x5.jpg",
    storyFile: "story-04-wrapper-is-not-rank-9x16.jpg",
    eyebrow: "READ 03",
    title: "WRAPPER IS NOT RANK",
    subtitle: "Connecticut, Habano, Sumatra, Broadleaf, and Maduro are style clues.",
    image: assets.wrapperShades,
    promptLabel: "MYTH TO DROP",
    prompt: "Maduro does not automatically mean highest strength.",
    bullets: [
      "Dark can mean cocoa, earth, sweetness, or fermentation.",
      "Light can still sit over a stronger filler blend.",
      "Use wrapper color as a question, not the answer.",
    ],
    bands: [
      {
        brand: "UNDERCROWN",
        line: "Shade",
        tone: "shade",
        feed: { left: 128, top: 792, width: 238, rotate: 2 },
        story: { left: 84, top: 1118, width: 256, rotate: 2 },
      },
      {
        brand: "TABERNACLE",
        line: "CT-142",
        tone: "black",
        feed: { left: 418, top: 816, width: 238, rotate: 2 },
        story: { left: 394, top: 1176, width: 256, rotate: 2 },
      },
      {
        brand: "OLMEC",
        line: "Maduro",
        tone: "maduro",
        feed: { left: 698, top: 840, width: 224, rotate: 2 },
        story: { left: 696, top: 1230, width: 244, rotate: 2 },
      },
    ],
  },
  {
    file: "05-size-and-pace-change-it-4x5.jpg",
    storyFile: "story-05-size-and-pace-change-it-9x16.jpg",
    eyebrow: "READ 04",
    title: "SIZE AND PACE CHANGE IT",
    subtitle: "The same blend can feel different by format and final third.",
    image: assets.vitolaPace,
    promptLabel: "SESSION CUE",
    prompt: "Compare similar sizes before judging the blend.",
    bullets: [
      "Ring gauge changes the wrapper-to-filler ratio.",
      "Draw speed and smoke temperature change perception.",
      "The final third can feel heavier as heat builds.",
    ],
    bands: [
      {
        brand: "H99",
        line: "Papas Fritas",
        tone: "red",
        feed: { left: 212, top: 850, width: 222, rotate: -14 },
        story: { left: 178, top: 1236, width: 244, rotate: -14 },
      },
      {
        brand: "MY FATHER",
        line: "Blue",
        tone: "blue",
        feed: { left: 604, top: 914, width: 244, rotate: -18 },
        story: { left: 580, top: 1320, width: 266, rotate: -18 },
      },
    ],
  },
  {
    file: "06-how-to-choose-4x5.jpg",
    storyFile: "story-06-how-to-choose-9x16.jpg",
    eyebrow: "READ 05",
    title: "HOW TO CHOOSE BETTER",
    subtitle: "Build a strength map from facts and your own notes.",
    image: assets.chooseNotes,
    promptLabel: "NEXT SMOKE",
    prompt: "Pick one known anchor and move only one step stronger.",
    bullets: [
      "Ask for blend details before assuming from color.",
      "Eat first and keep water nearby for fuller cigars.",
      "Rate strength, body, flavor, and final-third effect.",
    ],
    bands: [
      {
        brand: "NICA RUSTICA",
        line: "Connecticut",
        tone: "green",
        feed: { left: 462, top: 904, width: 270, rotate: 3 },
        story: { left: 452, top: 1306, width: 294, rotate: 3 },
      },
      {
        brand: "TABERNACLE",
        line: "Broadleaf",
        tone: "black",
        feed: { left: 744, top: 780, width: 244, rotate: 7 },
        story: { left: 740, top: 1128, width: 266, rotate: 7 },
      },
    ],
  },
];

const assetDataUrls = new Map();

function mimeType(path) {
  if (path.endsWith(".png")) {
    return "image/png";
  }
  if (path.endsWith(".jpg") || path.endsWith(".jpeg")) {
    return "image/jpeg";
  }
  return "application/octet-stream";
}

async function imageDataUrl(path) {
  if (!assetDataUrls.has(path)) {
    const buffer = await readFile(path);
    assetDataUrls.set(path, `data:${mimeType(path)};base64,${buffer.toString("base64")}`);
  }
  return assetDataUrls.get(path);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function renderBullets(items) {
  return items
    .map((item) => `<li><span></span><p>${escapeHtml(item)}</p></li>`)
    .join("");
}

function renderChips(items) {
  return items.map((item) => `<span>${escapeHtml(item)}</span>`).join("");
}

function renderBandCues(bands = [], isStory = false) {
  if (bands.length === 0) {
    return "";
  }

  return bands
    .map((band) => {
      const placement = isStory ? band.story : band.feed;
      const style = [
        `left:${placement.left}px`,
        `top:${placement.top}px`,
        `width:${placement.width}px`,
        `transform:rotate(${placement.rotate}deg)`,
      ].join(";");

      return `<div class="cigar-band ${escapeHtml(band.tone)}" style="${style}">
        <span class="band-cap"></span>
        <div>
          <b>${escapeHtml(band.brand)}</b>
          <em>${escapeHtml(band.line)}</em>
        </div>
        <span class="band-cap"></span>
      </div>`;
    })
    .join("");
}

async function htmlForSlide(slide, format) {
  const isStory = format === "story";
  const size = isStory ? storySize : feedSize;
  const panelClass = slide.file.startsWith("01-") ? "panel cover-panel" : "panel";
  const titleClass = slide.title.length > 22 ? "title compact" : "title";
  const backgroundImage = await imageDataUrl(slide.image);
  const logoImage = await imageDataUrl(assets.logo);
  const bandCues = renderBandCues(slide.bands, isStory);

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <style>
      * { box-sizing: border-box; }
      html, body {
        margin: 0;
        width: ${size.width}px;
        height: ${size.height}px;
        overflow: hidden;
        background: #070604;
      }
      body {
        font-family: Arial, Helvetica, sans-serif;
        color: #f8efe1;
        letter-spacing: 0;
      }
      .card {
        position: relative;
        width: ${size.width}px;
        height: ${size.height}px;
        overflow: hidden;
        background-image:
          linear-gradient(180deg, rgba(4, 3, 2, 0.66), rgba(4, 3, 2, ${isStory ? "0.28" : "0.16"}) 48%, rgba(4, 3, 2, 0.84)),
          linear-gradient(90deg, rgba(4, 3, 2, 0.82), rgba(4, 3, 2, 0.12) 54%, rgba(4, 3, 2, 0.52)),
          url("${backgroundImage}");
        background-size: cover;
        background-position: center;
      }
      .frame {
        position: absolute;
        inset: ${isStory ? "72px 52px 94px" : "54px"};
        border: 4px solid #e8bd58;
        z-index: 7;
      }
      .brand {
        position: absolute;
        left: 82px;
        top: ${isStory ? "112px" : "96px"};
        color: #e8bd58;
        font-size: 27px;
        font-weight: 900;
        z-index: 8;
      }
      .brand::after {
        content: "";
        display: block;
        width: 270px;
        height: 5px;
        margin-top: 18px;
        background: #e8bd58;
      }
      .logo-box {
        position: absolute;
        right: 72px;
        top: ${isStory ? "100px" : "84px"};
        width: ${isStory ? "96px" : "88px"};
        height: ${isStory ? "96px" : "88px"};
        border: 2px solid #e8bd58;
        background: #050505;
        display: grid;
        place-items: center;
        z-index: 8;
      }
      .logo-box img {
        width: 58px;
        height: 58px;
        object-fit: contain;
      }
      .panel {
        position: absolute;
        left: 78px;
        right: ${isStory ? "78px" : "86px"};
        top: ${isStory ? "292px" : "228px"};
        min-height: ${isStory ? "720px" : "520px"};
        padding: ${isStory ? "40px 44px 34px" : "36px 38px 30px"};
        border: 3px solid #e8bd58;
        background: linear-gradient(90deg, rgba(7, 6, 4, 0.92), rgba(7, 6, 4, 0.78) 72%, rgba(7, 6, 4, 0.5));
        z-index: 6;
      }
      .cover-panel {
        min-height: ${isStory ? "760px" : "560px"};
      }
      .eyebrow {
        margin: 0 0 ${isStory ? "26px" : "24px"};
        color: #e8bd58;
        font-size: ${isStory ? "28px" : "24px"};
        font-weight: 900;
      }
      .title {
        margin: 0;
        max-width: 820px;
        color: #fbf2e2;
        font-family: Georgia, "Times New Roman", serif;
        font-size: ${isStory ? "72px" : "60px"};
        font-weight: 900;
        line-height: 0.92;
        letter-spacing: 0;
      }
      .title.compact {
        font-size: ${isStory ? "64px" : "54px"};
      }
      .subtitle {
        margin: ${isStory ? "22px" : "18px"} 0 0;
        max-width: 790px;
        color: #f0dfbf;
        font-family: Georgia, "Times New Roman", serif;
        font-size: ${isStory ? "34px" : "28px"};
        font-weight: 700;
        line-height: 1.1;
      }
      .chips {
        display: flex;
        flex-wrap: wrap;
        gap: 14px;
        margin-top: ${isStory ? "28px" : "24px"};
      }
      .chips span {
        border: 1px solid #e8bd58;
        background: #12352f;
        color: #f8efe1;
        padding: 12px 17px;
        font-size: ${isStory ? "24px" : "20px"};
        font-weight: 900;
      }
      .bullets {
        display: grid;
        gap: ${isStory ? "24px" : "20px"};
        margin: ${isStory ? "30px" : "26px"} 0 0;
        padding: 0;
        list-style: none;
      }
      .bullets li {
        display: grid;
        grid-template-columns: 18px minmax(0, 1fr);
        gap: 18px;
        align-items: start;
      }
      .bullets span {
        width: 12px;
        height: 12px;
        margin-top: ${isStory ? "14px" : "12px"};
        border-radius: 999px;
        background: #e8bd58;
      }
      .bullets p {
        margin: 0;
        color: #f8efe1;
        font-size: ${isStory ? "29px" : "24px"};
        font-weight: 800;
        line-height: 1.22;
      }
      .cigar-band {
        position: absolute;
        z-index: 5;
        display: grid;
        grid-template-columns: 24px minmax(0, 1fr) 24px;
        align-items: center;
        min-height: ${isStory ? "78px" : "68px"};
        padding: 8px 7px;
        border: 3px solid #f0c96c;
        border-radius: 8px;
        background:
          linear-gradient(90deg, rgba(255, 255, 255, 0.18), transparent 24%, rgba(0, 0, 0, 0.24) 72%, rgba(255, 255, 255, 0.14)),
          #17130f;
        box-shadow: 0 16px 26px rgba(0, 0, 0, 0.48);
        text-align: center;
      }
      .cigar-band div {
        min-width: 0;
        padding: 0 6px;
        border-left: 1px solid rgba(240, 201, 108, 0.64);
        border-right: 1px solid rgba(240, 201, 108, 0.64);
      }
      .cigar-band b,
      .cigar-band em {
        display: block;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        letter-spacing: 0;
      }
      .cigar-band b {
        color: #fff6e2;
        font-size: ${isStory ? "20px" : "17px"};
        font-weight: 900;
        line-height: 1;
      }
      .cigar-band em {
        margin-top: 5px;
        color: #f0c96c;
        font-size: ${isStory ? "15px" : "13px"};
        font-style: normal;
        font-weight: 900;
        text-transform: uppercase;
      }
      .band-cap {
        display: block;
        width: 19px;
        height: 34px;
        justify-self: center;
        border: 2px solid rgba(240, 201, 108, 0.82);
        border-radius: 999px;
        background: radial-gradient(circle, rgba(240, 201, 108, 0.9), rgba(44, 37, 24, 0.6) 54%, rgba(0, 0, 0, 0.2));
      }
      .cigar-band.shade {
        border-color: #e8d5a8;
        background:
          linear-gradient(90deg, rgba(255, 255, 255, 0.28), transparent 24%, rgba(0, 0, 0, 0.16) 72%, rgba(255, 255, 255, 0.2)),
          #efe2c2;
      }
      .cigar-band.shade b { color: #1a1712; }
      .cigar-band.shade em { color: #314f65; }
      .cigar-band.maduro {
        border-color: #f0c96c;
        background:
          linear-gradient(90deg, rgba(255, 255, 255, 0.16), transparent 24%, rgba(0, 0, 0, 0.24) 72%, rgba(255, 255, 255, 0.14)),
          #4a1513;
      }
      .cigar-band.blue {
        border-color: #f2d37a;
        background:
          linear-gradient(90deg, rgba(255, 255, 255, 0.16), transparent 24%, rgba(0, 0, 0, 0.24) 72%, rgba(255, 255, 255, 0.14)),
          #142a49;
      }
      .cigar-band.red {
        border-color: #f0c96c;
        background:
          linear-gradient(90deg, rgba(255, 255, 255, 0.16), transparent 24%, rgba(0, 0, 0, 0.24) 72%, rgba(255, 255, 255, 0.14)),
          #6d1711;
      }
      .cigar-band.green {
        border-color: #f0c96c;
        background:
          linear-gradient(90deg, rgba(255, 255, 255, 0.16), transparent 24%, rgba(0, 0, 0, 0.24) 72%, rgba(255, 255, 255, 0.14)),
          #173b2f;
      }
      .cigar-band.black {
        border-color: #f0c96c;
        background:
          linear-gradient(90deg, rgba(255, 255, 255, 0.12), transparent 24%, rgba(0, 0, 0, 0.32) 72%, rgba(255, 255, 255, 0.1)),
          #080706;
      }
      .cigar-band.cream {
        border-color: #1f1b13;
        background:
          linear-gradient(90deg, rgba(255, 255, 255, 0.26), transparent 24%, rgba(0, 0, 0, 0.16) 72%, rgba(255, 255, 255, 0.22)),
          #f3ead4;
      }
      .cigar-band.cream b { color: #16130d; }
      .cigar-band.cream em { color: #7b1714; }
      .prompt {
        position: absolute;
        left: 78px;
        right: 78px;
        bottom: ${isStory ? "278px" : "190px"};
        padding: ${isStory ? "32px 38px" : "24px 30px"};
        border: 3px solid #e8bd58;
        background: rgba(18, 53, 47, 0.92);
        z-index: 8;
      }
      .prompt b {
        display: block;
        color: #e8bd58;
        font-size: ${isStory ? "25px" : "21px"};
        font-weight: 900;
      }
      .prompt p {
        margin: 16px 0 0;
        max-width: 790px;
        color: #f8efe1;
        font-family: Georgia, "Times New Roman", serif;
        font-size: ${isStory ? "43px" : "31px"};
        font-weight: 900;
        line-height: 1.07;
      }
      .cta {
        position: absolute;
        left: 78px;
        bottom: ${isStory ? "166px" : "112px"};
        display: flex;
        align-items: center;
        gap: 34px;
        z-index: 8;
      }
      .cta .button {
        background: #e8bd58;
        color: #11100b;
        padding: ${isStory ? "22px 34px" : "20px 30px"};
        font-size: ${isStory ? "28px" : "24px"};
        font-weight: 900;
      }
      .cta .save {
        color: #f8efe1;
        font-size: ${isStory ? "27px" : "24px"};
        font-weight: 900;
      }
      .footer {
        position: absolute;
        left: 82px;
        right: 82px;
        bottom: ${isStory ? "116px" : "66px"};
        color: #f8efe1;
        font-size: ${isStory ? "24px" : "21px"};
        font-weight: 700;
        z-index: 8;
      }
    </style>
  </head>
  <body>
    <main class="card">
      <div class="frame"></div>
      <div class="brand">YUZU CIGAR CLUB</div>
      <div class="logo-box"><img src="${logoImage}" alt="" /></div>
      ${bandCues}
      <section class="${panelClass}">
        <p class="eyebrow">${escapeHtml(slide.eyebrow)}</p>
        <h1 class="${titleClass}">${escapeHtml(slide.title)}</h1>
        <p class="subtitle">${escapeHtml(slide.subtitle)}</p>
        ${slide.chips ? `<div class="chips">${renderChips(slide.chips)}</div>` : ""}
        <ul class="bullets">${renderBullets(slide.bullets)}</ul>
      </section>
      <aside class="prompt">
        <b>${escapeHtml(slide.promptLabel)}</b>
        <p>${escapeHtml(slide.prompt)}</p>
      </aside>
      <div class="cta">
        <div class="button">${slide.file.startsWith("01-") ? "MYTH FIX" : "TRY THIS"}</div>
        <div class="save">SAVE THIS GUIDE</div>
      </div>
      <div class="footer">21+ ONLY / EDUCATION ONLY / NO MARKETPLACE OR HEALTH CLAIMS</div>
    </main>
  </body>
</html>`;
}

async function htmlForContactSheet(kind) {
  const isStory = kind === "story";
  const imageWidth = isStory ? 180 : 252;
  const imageHeight = isStory ? 320 : 315;
  const gap = 24;
  const width = isStory ? imageWidth * slides.length + gap * (slides.length + 1) : imageWidth * 3 + gap * 4;
  const rows = isStory ? 1 : 2;
  const height = rows * (imageHeight + 48) + gap * (rows + 1) + 54;
  const images = slides
    .map(async (slide, index) => {
      const row = isStory ? 0 : Math.floor(index / 3);
      const col = isStory ? index : index % 3;
      const x = gap + col * (imageWidth + gap);
      const y = gap + row * (imageHeight + 48 + gap);
      const file = isStory ? join(storyOutputDir, slide.storyFile) : join(outputDir, slide.file);
      return `<figure style="left:${x}px;top:${y}px;width:${imageWidth}px"><img src="${await imageDataUrl(file)}" /><figcaption>${escapeHtml(slide.eyebrow)}</figcaption></figure>`;
    });
  const imageMarkup = (await Promise.all(images)).join("");

  return `<!doctype html><html><head><meta charset="utf-8" /><style>
    html, body { margin: 0; width: ${width}px; height: ${height}px; overflow: hidden; background: #080704; font-family: Arial, Helvetica, sans-serif; }
    h1 { position:absolute; left:${gap}px; bottom: 12px; margin:0; color:#e8bd58; font-size:28px; letter-spacing:0; }
    figure { position:absolute; margin:0; }
    img { width:${imageWidth}px; height:${imageHeight}px; object-fit:cover; display:block; border:2px solid #e8bd58; }
    figcaption { color:#f8efe1; font-size:20px; font-weight:900; margin-top:12px; letter-spacing:0; }
  </style></head><body>${imageMarkup}<h1>Strength Is The Blend Guide / ${isStory ? "Story" : "Feed"} QA Sheet</h1></body></html>`;
}

async function screenshotHtml(page, html, path, size) {
  await page.setViewportSize(size);
  await page.setContent(html, { waitUntil: "load" });
  await page.screenshot({ path, type: "jpeg", quality: 92, fullPage: false });
}

async function main() {
  await mkdir(outputDir, { recursive: true });
  await mkdir(storyOutputDir, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ deviceScaleFactor: 1 });

  for (const slide of slides) {
    const feedPath = join(outputDir, slide.file);
    await screenshotHtml(page, await htmlForSlide(slide, "feed"), feedPath, feedSize);

    const storyPath = join(storyOutputDir, slide.storyFile);
    await screenshotHtml(page, await htmlForSlide(slide, "story"), storyPath, storySize);

    if (slide.file.startsWith("01-")) {
      await screenshotHtml(page, await htmlForSlide(slide, "feed"), pageAssetPath, feedSize);
    }
  }

  await screenshotHtml(
    page,
    await htmlForContactSheet("feed"),
    join(outputDir, "strength-is-the-blend-guide-contact-sheet.jpg"),
    { width: 852, height: 852 },
  );
  await screenshotHtml(
    page,
    await htmlForContactSheet("story"),
    join(storyOutputDir, "strength-is-the-blend-story-contact-sheet.jpg"),
    { width: 1248, height: 470 },
  );

  await browser.close();

  const caption = [
    "Strength is not a wrapper-color ladder.",
    "",
    "A dark wrapper can bring cocoa, earth, sweetness, or heavier texture, but nicotine impact comes from the full blend: filler, binder, wrapper, priming, origin, fermentation, aging, size, and pace.",
    "",
    "This guide uses generated photo-realistic cigar scenes with brand-band cues such as Undercrown Shade, Olmec Maduro, Tabernacle, My Father Blue, Don Pepin, Aging Room Quattro, H99, and Nica Rustica Connecticut to make each lesson easier to see.",
    "",
    "Use three separate notes:",
    "1. Strength: what you feel physically.",
    "2. Body: how much the smoke fills the palate.",
    "3. Flavor: cedar, cocoa, pepper, cream, citrus, coffee, earth, or sweetness.",
    "",
    "The better question is not just \"what wrapper is it?\" It is \"what is in the blend, what size is it, and how does it feel by the final third?\"",
    "",
    "What cigar taught you that color does not tell the whole story? 21+ only.",
    "",
    "Yuzu Cigar Club. Adult 21+ only. Education only. No marketplace posts, pricing, inventory, giveaways, samples, or health claims.",
  ].join("\n");

  await writeFile(join(outputDir, "facebook-caption-strength-is-the-blend.txt"), caption);
  await writeFile(
    join(outputDir, "strength-is-the-blend-guide-manifest.json"),
    `${JSON.stringify(
      {
        generated_at: new Date().toISOString(),
        topic: "Cigar strength is based on blend and context, not wrapper color alone",
        corrected_myth: "Wrapper categories should not be presented as a nicotine ladder.",
        generated_source_images: {
          blend_anatomy: assets.blendAnatomy,
          three_dials: assets.threeDials,
          priming_stalk: assets.primingStalk,
          wrapper_shades: assets.wrapperShades,
          vitola_pace: assets.vitolaPace,
          choose_notes: assets.chooseNotes,
        },
        updated_page_asset: pageAssetPath,
        caption: join(outputDir, "facebook-caption-strength-is-the-blend.txt"),
        sources,
        slides: slides.map((slide) => ({
          title: slide.title,
          file: join(outputDir, slide.file),
          generated_source_image: slide.image,
          brand_band_cues: (slide.bands ?? []).map((band) => `${band.brand} ${band.line}`),
          role: slide.file.startsWith("01-") ? "feed cover and scheduled-page replacement asset" : "detail card",
        })),
        story_assets: slides.map((slide) => ({
          title: slide.title,
          file: join(storyOutputDir, slide.storyFile),
          role: slide.file.startsWith("01-") ? "story cover" : "story detail card",
        })),
        contact_sheet: join(outputDir, "strength-is-the-blend-guide-contact-sheet.jpg"),
        story_contact_sheet: join(storyOutputDir, "strength-is-the-blend-story-contact-sheet.jpg"),
        compliance:
          "Adult 21+ only. Education/community framing. No marketplace, pricing, inventory, giveaway, sample, order-request, or health-claim language.",
      },
      null,
      2,
    )}\n`,
  );

  console.log(`Rendered ${slides.length} feed cards and ${slides.length} story cards to ${outputDir}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
