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
  strength: resolve(root, "public/assets/guides/luxury-cigar-strength.png"),
  wrappers: resolve(root, "public/assets/guides/luxury-wrapper-types.png"),
  atelier: resolve(root, "public/assets/guides/luxury-guide-atelier.png"),
  storage: resolve(root, "public/assets/guides/luxury-cigar-storage.png"),
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
    subtitle: "Wrapper color is a clue, not a nicotine ladder.",
    image: assets.strength,
    promptLabel: "SAVE THE RULE",
    prompt: "Ask what is in the blend before trusting the shade.",
    chips: ["Filler", "Binder", "Wrapper", "Size", "Pace"],
    bullets: [
      "Strength is physical impact.",
      "Body is smoke weight.",
      "Flavor is what you taste.",
    ],
  },
  {
    file: "02-three-dials-4x5.jpg",
    storyFile: "story-02-three-dials-9x16.jpg",
    eyebrow: "READ 01",
    title: "THREE DIFFERENT DIALS",
    subtitle: "Do not use one word for the whole experience.",
    image: assets.atelier,
    promptLabel: "TASTING NOTE",
    prompt: "Log strength, body, and flavor as separate lines.",
    bullets: [
      "Strength: nicotine impact you feel.",
      "Body: smoke texture and weight.",
      "Flavor: cedar, cocoa, pepper, cream, earth, sweetness.",
    ],
  },
  {
    file: "03-blend-drives-impact-4x5.jpg",
    storyFile: "story-03-blend-drives-impact-9x16.jpg",
    eyebrow: "READ 02",
    title: "THE BLEND DRIVES IMPACT",
    subtitle: "Filler, binder, wrapper, priming, origin, and age work together.",
    image: assets.wrappers,
    promptLabel: "LOOK FOR",
    prompt: "Ligero, higher primings, seed, origin, and blend family.",
    bullets: [
      "Filler and binder carry much of the rhythm.",
      "Ligero and high primings often raise nicotine impact.",
      "Seed, soil, fermentation, and aging can shift the result.",
    ],
  },
  {
    file: "04-wrapper-is-not-rank-4x5.jpg",
    storyFile: "story-04-wrapper-is-not-rank-9x16.jpg",
    eyebrow: "READ 03",
    title: "WRAPPER IS NOT RANK",
    subtitle: "Connecticut, Habano, Sumatra, Broadleaf, and Maduro are style clues.",
    image: assets.strength,
    promptLabel: "MYTH TO DROP",
    prompt: "Maduro does not automatically mean highest strength.",
    bullets: [
      "Dark can mean cocoa, earth, sweetness, or fermentation.",
      "Light can still sit over a stronger filler blend.",
      "Use wrapper color as a question, not the answer.",
    ],
  },
  {
    file: "05-size-and-pace-change-it-4x5.jpg",
    storyFile: "story-05-size-and-pace-change-it-9x16.jpg",
    eyebrow: "READ 04",
    title: "SIZE AND PACE CHANGE IT",
    subtitle: "The same blend can feel different by format and final third.",
    image: assets.storage,
    promptLabel: "SESSION CUE",
    prompt: "Compare similar sizes before judging the blend.",
    bullets: [
      "Ring gauge changes the wrapper-to-filler ratio.",
      "Draw speed and smoke temperature change perception.",
      "The final third can feel heavier as heat builds.",
    ],
  },
  {
    file: "06-how-to-choose-4x5.jpg",
    storyFile: "story-06-how-to-choose-9x16.jpg",
    eyebrow: "READ 05",
    title: "HOW TO CHOOSE BETTER",
    subtitle: "Build a strength map from facts and your own notes.",
    image: assets.atelier,
    promptLabel: "NEXT SMOKE",
    prompt: "Pick one known anchor and move only one step stronger.",
    bullets: [
      "Ask for blend details before assuming from color.",
      "Eat first and keep water nearby for fuller cigars.",
      "Rate strength, body, flavor, and final-third effect.",
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

async function htmlForSlide(slide, format) {
  const isStory = format === "story";
  const size = isStory ? storySize : feedSize;
  const panelClass = slide.file.startsWith("01-") ? "panel cover-panel" : "panel";
  const titleClass = slide.title.length > 22 ? "title compact" : "title";
  const backgroundImage = await imageDataUrl(slide.image);
  const logoImage = await imageDataUrl(assets.logo);

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
          linear-gradient(180deg, rgba(4, 3, 2, 0.78), rgba(4, 3, 2, ${isStory ? "0.42" : "0.26"}) 47%, rgba(4, 3, 2, 0.88)),
          linear-gradient(90deg, rgba(4, 3, 2, 0.9), rgba(4, 3, 2, 0.2) 52%, rgba(4, 3, 2, 0.62)),
          url("${backgroundImage}");
        background-size: cover;
        background-position: center;
      }
      .frame {
        position: absolute;
        inset: ${isStory ? "72px 52px 94px" : "54px"};
        border: 4px solid #e8bd58;
      }
      .brand {
        position: absolute;
        left: 82px;
        top: ${isStory ? "112px" : "96px"};
        color: #e8bd58;
        font-size: 27px;
        font-weight: 900;
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
        min-height: ${isStory ? "760px" : "612px"};
        padding: ${isStory ? "44px 46px" : "42px 38px"};
        border: 3px solid #e8bd58;
        background: linear-gradient(90deg, rgba(7, 6, 4, 0.92), rgba(7, 6, 4, 0.78) 72%, rgba(7, 6, 4, 0.5));
      }
      .cover-panel {
        min-height: ${isStory ? "780px" : "560px"};
      }
      .eyebrow {
        margin: 0 0 34px;
        color: #e8bd58;
        font-size: ${isStory ? "28px" : "24px"};
        font-weight: 900;
      }
      .title {
        margin: 0;
        max-width: 820px;
        color: #fbf2e2;
        font-family: Georgia, "Times New Roman", serif;
        font-size: ${isStory ? "76px" : "66px"};
        font-weight: 900;
        line-height: 0.92;
        letter-spacing: 0;
      }
      .title.compact {
        font-size: ${isStory ? "70px" : "60px"};
      }
      .subtitle {
        margin: 28px 0 0;
        max-width: 790px;
        color: #f0dfbf;
        font-family: Georgia, "Times New Roman", serif;
        font-size: ${isStory ? "38px" : "32px"};
        font-weight: 700;
        line-height: 1.1;
      }
      .chips {
        display: flex;
        flex-wrap: wrap;
        gap: 14px;
        margin-top: 44px;
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
        margin: 40px 0 0;
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
        font-size: ${isStory ? "34px" : "29px"};
        font-weight: 800;
        line-height: 1.22;
      }
      .prompt {
        position: absolute;
        left: 78px;
        right: 78px;
        bottom: ${isStory ? "282px" : "190px"};
        padding: ${isStory ? "32px 38px" : "24px 30px"};
        border: 3px solid #e8bd58;
        background: rgba(18, 53, 47, 0.92);
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
        bottom: ${isStory ? "158px" : "104px"};
        display: flex;
        align-items: center;
        gap: 34px;
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
        bottom: ${isStory ? "108px" : "62px"};
        color: #f8efe1;
        font-size: ${isStory ? "24px" : "21px"};
        font-weight: 700;
      }
    </style>
  </head>
  <body>
    <main class="card">
      <div class="frame"></div>
      <div class="brand">YUZU CIGAR CLUB</div>
      <div class="logo-box"><img src="${logoImage}" alt="" /></div>
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
        updated_page_asset: pageAssetPath,
        caption: join(outputDir, "facebook-caption-strength-is-the-blend.txt"),
        sources,
        slides: slides.map((slide) => ({
          title: slide.title,
          file: join(outputDir, slide.file),
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
