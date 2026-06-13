import { mkdir, readFile, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { chromium } from "playwright";

const root = process.cwd();
const guideDir = resolve(root, "output/social/facebook-planner-month-2026-06-09/strength-is-the-blend-guide");
const videoDir = join(guideDir, "video-assets");
const sourceImage = join(guideDir, "source-images/generated-three-dials.png");
const heygenVideo = join(videoDir, "strength-is-the-blend-heygen-avatar-lead-captioned-720p.mp4");
const backgroundPath = join(videoDir, "strength-is-the-blend-heygen-avatar-lead-background.png");
const outputPath = join(videoDir, "strength-is-the-blend-heygen-avatar-lead-polished-720x1280.mp4");
const previewPath = join(videoDir, "strength-is-the-blend-heygen-avatar-lead-polished-preview.jpg");

const width = 720;
const height = 1280;

async function main() {
  await mkdir(videoDir, { recursive: true });
  await renderBackground();
  composeVideo();
  renderPreview();
  console.log(`Rendered polished HeyGen avatar lead: ${outputPath}`);
}

async function renderBackground() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 });
  await page.setContent(await backgroundHtml(), { waitUntil: "networkidle" });
  await page.screenshot({ path: backgroundPath, type: "png" });
  await browser.close();
}

async function backgroundHtml() {
  const imageData = await readFile(sourceImage);
  const imageUri = `data:image/png;base64,${imageData.toString("base64")}`;
  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <style>
    * { box-sizing: border-box; }
    body {
      margin: 0;
      width: ${width}px;
      height: ${height}px;
      overflow: hidden;
      background: #080604;
      color: #f7efe2;
      font-family: Arial, Helvetica, sans-serif;
    }
    .stage {
      position: relative;
      width: 100%;
      height: 100%;
      background:
        linear-gradient(180deg, rgba(8, 6, 4, .78), rgba(8, 6, 4, .54) 34%, rgba(8, 6, 4, .74) 68%, rgba(8, 6, 4, .94)),
        url("${imageUri}") center / cover no-repeat;
    }
    .stage::before {
      content: "";
      position: absolute;
      inset: 0;
      background:
        radial-gradient(circle at 18% 12%, rgba(202, 157, 86, .20), transparent 28%),
        linear-gradient(90deg, rgba(0,0,0,.48), transparent 40%, rgba(0,0,0,.38));
    }
    .top {
      position: absolute;
      left: 42px;
      right: 42px;
      top: 52px;
    }
    .kicker {
      color: #d6a95c;
      font-size: 19px;
      font-weight: 900;
      line-height: 1;
      letter-spacing: 0;
      text-transform: uppercase;
    }
    h1 {
      margin: 18px 0 0;
      font-size: 58px;
      line-height: .96;
      letter-spacing: 0;
      text-transform: uppercase;
      font-weight: 900;
      text-shadow: 0 3px 20px rgba(0,0,0,.55);
    }
    .rule {
      width: 156px;
      height: 4px;
      margin-top: 24px;
      background: #d6a95c;
      border-radius: 1px;
    }
    .avatar-frame {
      position: absolute;
      left: 0;
      right: 0;
      top: 436px;
      height: 408px;
      border-top: 3px solid rgba(214,169,92,.95);
      border-bottom: 3px solid rgba(214,169,92,.95);
      box-shadow: 0 24px 56px rgba(0,0,0,.42);
    }
    .notes {
      position: absolute;
      left: 36px;
      right: 36px;
      top: 878px;
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 12px;
    }
    .note {
      min-height: 116px;
      padding: 17px 13px 15px;
      border: 1px solid rgba(214,169,92,.55);
      background: rgba(12, 8, 5, .76);
    }
    .note strong {
      display: block;
      color: #d6a95c;
      font-size: 18px;
      line-height: 1;
      text-transform: uppercase;
      letter-spacing: 0;
    }
    .note span {
      display: block;
      margin-top: 10px;
      color: #f7efe2;
      font-size: 17px;
      line-height: 1.18;
      font-weight: 700;
    }
    .caption-bed {
      position: absolute;
      left: 70px;
      right: 70px;
      bottom: 72px;
      height: 118px;
      background: linear-gradient(180deg, rgba(0,0,0,.18), rgba(0,0,0,.50));
      border-radius: 8px;
    }
    .footer {
      position: absolute;
      left: 42px;
      right: 42px;
      bottom: 28px;
      display: flex;
      justify-content: space-between;
      color: rgba(247,239,226,.82);
      font-size: 16px;
      line-height: 1;
      font-weight: 800;
      text-transform: uppercase;
    }
  </style>
</head>
<body>
  <main class="stage">
    <section class="top">
      <div class="kicker">Yuzu Cigar Club Lesson</div>
      <h1>Strength<br />Is The Blend</h1>
      <div class="rule"></div>
    </section>
    <div class="avatar-frame"></div>
    <section class="notes">
      <div class="note"><strong>Strength</strong><span>What you feel physically</span></div>
      <div class="note"><strong>Body</strong><span>How smoke fills the palate</span></div>
      <div class="note"><strong>Flavor</strong><span>What you taste and name</span></div>
    </section>
    <div class="caption-bed"></div>
    <footer class="footer">
      <span>Adult 21+ Only</span>
      <span>Education Only</span>
    </footer>
  </main>
</body>
</html>`;
}

function composeVideo() {
  const filter =
    "[0:v]loop=loop=-1:size=1:start=0,trim=duration=45.804,setpts=PTS-STARTPTS[bg];" +
    "[1:v]format=rgba,colorkey=0x000000:0.06:0.05[fg];" +
    "[bg][fg]overlay=0:0:shortest=1,format=yuv420p[outv]";
  run("ffmpeg", [
    "-y",
    "-i",
    backgroundPath,
    "-i",
    heygenVideo,
    "-filter_complex",
    filter,
    "-map",
    "[outv]",
    "-map",
    "1:a",
    "-c:v",
    "libx264",
    "-preset",
    "medium",
    "-crf",
    "20",
    "-c:a",
    "aac",
    "-b:a",
    "192k",
    "-movflags",
    "+faststart",
    outputPath,
  ]);
}

function renderPreview() {
  run("ffmpeg", [
    "-y",
    "-i",
    outputPath,
    "-vf",
    "fps=1/9,scale=240:-1,tile=6x1:padding=8:margin=8:color=0x080604",
    "-frames:v",
    "1",
    previewPath,
  ]);
}

function run(command, args) {
  const result = spawnSync(command, args, { stdio: "inherit" });
  if (result.status !== 0) {
    throw new Error(`${command} failed with exit code ${result.status}`);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
