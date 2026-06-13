import { mkdir, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { execFileSync, spawnSync } from "node:child_process";

const root = process.cwd();
const guideDir = resolve(
  root,
  "output/social/facebook-planner-month-2026-06-09/strength-is-the-blend-guide",
);
const storyDir = join(guideDir, "story-assets");
const videoDir = join(guideDir, "video-assets");

const force = process.argv.includes("--force");
const forceTts = force || process.argv.includes("--force-tts");
const voice = "am_michael";
const speechSpeed = "0.78";

const feedSlides = [
  "01-strength-is-the-blend-cover-4x5.jpg",
  "02-three-dials-4x5.jpg",
  "03-blend-drives-impact-4x5.jpg",
  "04-wrapper-is-not-rank-4x5.jpg",
  "05-size-and-pace-change-it-4x5.jpg",
  "06-how-to-choose-4x5.jpg",
].map((file) => join(guideDir, file));

const storySlides = [
  "story-01-strength-is-the-blend-cover-9x16.jpg",
  "story-02-three-dials-9x16.jpg",
  "story-03-blend-drives-impact-9x16.jpg",
  "story-04-wrapper-is-not-rank-9x16.jpg",
  "story-05-size-and-pace-change-it-9x16.jpg",
  "story-06-how-to-choose-9x16.jpg",
].map((file) => join(storyDir, file));

const scripts = {
  feed: [
    "Yuzu Cigar Club.",
    "Here is the myth fix.",
    "Strength is not a wrapper color ladder.",
    "A dark wrapper can bring cocoa, earth, sweetness, or a heavier texture.",
    "But nicotine impact comes from the full blend.",
    "Read three dials separately.",
    "Strength is what you feel physically.",
    "Body is the weight of the smoke.",
    "Flavor is what you taste.",
    "Now look deeper.",
    "Filler, binder, wrapper, priming, origin, fermentation, age, size, and pace all matter.",
    "Higher primings, like ligero, can raise impact.",
    "But the whole recipe still decides the cigar.",
    "So use wrapper color as a clue, not a verdict.",
    "Choose your next cigar from notes, not assumptions.",
    "Adult twenty one plus only. Education only.",
  ].join(" "),
  story: [
    "Strength is not a wrapper color ladder.",
    "Start with the blend.",
    "Filler, binder, wrapper, priming, origin, age, size, and pace all change the read.",
    "Track strength, body, and flavor as three separate notes.",
    "Use color as a clue, not the answer.",
    "Adult twenty one plus only. Education only.",
  ].join(" "),
};

const outputs = {
  feedScript: join(videoDir, "strength-is-the-blend-feed-voiceover-script.txt"),
  storyScript: join(videoDir, "strength-is-the-blend-story-voiceover-script.txt"),
  feedRawVoice: join(videoDir, "strength-is-the-blend-feed-voiceover-raw.wav"),
  storyRawVoice: join(videoDir, "strength-is-the-blend-story-voiceover-raw.wav"),
  feedVoice: join(videoDir, "strength-is-the-blend-feed-voiceover-master.wav"),
  storyVoice: join(videoDir, "strength-is-the-blend-story-voiceover-master.wav"),
  feedVideo: join(videoDir, "strength-is-the-blend-feed-slideshow-voiceover.mp4"),
  storyVideo: join(videoDir, "strength-is-the-blend-story-slideshow-voiceover.mp4"),
  feedPreview: join(videoDir, "strength-is-the-blend-feed-video-preview.jpg"),
  storyPreview: join(videoDir, "strength-is-the-blend-story-video-preview.jpg"),
  manifest: join(videoDir, "strength-is-the-blend-slideshow-video-manifest.json"),
  verification: join(videoDir, "strength-is-the-blend-slideshow-video-verification.json"),
};

function commandName(name) {
  return process.platform === "win32" && name === "npx" ? "npx.cmd" : name;
}

function run(command, args, options = {}) {
  const useShell = process.platform === "win32" && command === "npx";
  const result = spawnSync(commandName(command), args, {
    cwd: root,
    encoding: "utf8",
    shell: useShell,
    stdio: options.capture ? "pipe" : "inherit",
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    const details = [result.stdout, result.stderr].filter(Boolean).join("\n");
    throw new Error(`${command} ${args.join(" ")} failed\n${details}`);
  }

  return `${result.stdout ?? ""}${result.stderr ?? ""}`;
}

function probeJson(path) {
  return JSON.parse(
    execFileSync(
      "ffprobe",
      ["-v", "error", "-show_streams", "-show_format", "-of", "json", path],
      { encoding: "utf8" },
    ),
  );
}

function mediaDuration(path) {
  const probe = probeJson(path);
  return Number.parseFloat(probe.format.duration);
}

function summarizeMedia(path) {
  const probe = probeJson(path);
  const video = probe.streams.find((stream) => stream.codec_type === "video");
  const audio = probe.streams.find((stream) => stream.codec_type === "audio");

  return {
    file: path,
    duration_seconds: Number.parseFloat(probe.format.duration),
    size_bytes: Number.parseInt(probe.format.size, 10),
    video: video
      ? {
          codec: video.codec_name,
          width: video.width,
          height: video.height,
          pixel_format: video.pix_fmt,
          frame_rate: video.avg_frame_rate,
        }
      : null,
    audio: audio
      ? {
          codec: audio.codec_name,
          sample_rate: Number.parseInt(audio.sample_rate, 10),
          channels: audio.channels,
          channel_layout: audio.channel_layout,
        }
      : null,
  };
}

function audioLevels(path) {
  const nullDevice = process.platform === "win32" ? "NUL" : "/dev/null";
  const output = run(
    "ffmpeg",
    ["-hide_banner", "-i", path, "-af", "volumedetect", "-f", "null", nullDevice],
    { capture: true },
  );

  const meanMatch = output.match(/mean_volume:\s*(-?\d+(?:\.\d+)?) dB/);
  const maxMatch = output.match(/max_volume:\s*(-?\d+(?:\.\d+)?) dB/);

  return {
    mean_volume_db: meanMatch ? Number.parseFloat(meanMatch[1]) : null,
    max_volume_db: maxMatch ? Number.parseFloat(maxMatch[1]) : null,
  };
}

async function writeNarrationScripts() {
  await mkdir(videoDir, { recursive: true });
  await writeFile(outputs.feedScript, `${scripts.feed}\n`);
  await writeFile(outputs.storyScript, `${scripts.story}\n`);
}

function generateVoiceover(scriptPath, outputPath) {
  if (existsSync(outputPath) && !forceTts) {
    return;
  }

  run("npx", [
    "hyperframes",
    "tts",
    relative(root, scriptPath),
    "--voice",
    voice,
    "--speed",
    speechSpeed,
    "--output",
    relative(root, outputPath),
  ]);
}

function masterVoiceover(inputPath, outputPath) {
  if (existsSync(outputPath) && !force) {
    return;
  }

  run("ffmpeg", [
    "-y",
    "-i",
    inputPath,
    "-af",
    "loudnorm=I=-18:TP=-3:LRA=11",
    "-ar",
    "48000",
    "-ac",
    "2",
    outputPath,
  ]);
}

function slideshowFilter({ width, height, slideCount, slideDuration, fadeDuration }) {
  const filters = [];

  for (let index = 0; index < slideCount; index += 1) {
    filters.push(
      `[${index}:v]scale=${width}:${height}:force_original_aspect_ratio=decrease,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=30,format=yuv420p[v${index}]`,
    );
  }

  let previous = "v0";
  for (let index = 1; index < slideCount; index += 1) {
    const label = index === slideCount - 1 ? "vout" : `x${index}`;
    const offset = index * (slideDuration - fadeDuration);
    filters.push(
      `[${previous}][v${index}]xfade=transition=fade:duration=${fadeDuration.toFixed(
        3,
      )}:offset=${offset.toFixed(3)}[${label}]`,
    );
    previous = label;
  }

  return filters.join(";");
}

function renderSlideshow({ slides, audioPath, outputPath, width, height }) {
  if (existsSync(outputPath) && !force) {
    return;
  }

  const fadeDuration = 0.45;
  const audioDuration = mediaDuration(audioPath);
  const slideDuration = (audioDuration + (slides.length - 1) * fadeDuration) / slides.length;
  const inputs = slides.flatMap((slide) => ["-loop", "1", "-t", slideDuration.toFixed(3), "-i", slide]);
  const filter = slideshowFilter({
    width,
    height,
    slideCount: slides.length,
    slideDuration,
    fadeDuration,
  });

  run("ffmpeg", [
    "-y",
    ...inputs,
    "-i",
    audioPath,
    "-filter_complex",
    filter,
    "-map",
    "[vout]",
    "-map",
    `${slides.length}:a`,
    "-c:v",
    "libx264",
    "-preset",
    "medium",
    "-crf",
    "18",
    "-pix_fmt",
    "yuv420p",
    "-r",
    "30",
    "-c:a",
    "aac",
    "-b:a",
    "160k",
    "-movflags",
    "+faststart",
    "-shortest",
    outputPath,
  ]);
}

function renderPreview({ videoPath, outputPath, width, height, sampleRate }) {
  if (existsSync(outputPath) && !force) {
    return;
  }

  const resolvedSampleRate = sampleRate ?? mediaDuration(videoPath) / 6;
  run("ffmpeg", [
    "-y",
    "-i",
    videoPath,
    "-vf",
    `fps=1/${resolvedSampleRate.toFixed(3)},scale=${width}:${height},tile=6x1`,
    "-frames:v",
    "1",
    "-update",
    "1",
    outputPath,
  ]);
}

async function writeManifests() {
  const verification = {
    generated_at: new Date().toISOString(),
    voice,
    speech_speed: Number.parseFloat(speechSpeed),
    audio_gate: "voiceover only; no music bed, no synthetic drone",
    feed: {
      media: summarizeMedia(outputs.feedVideo),
      audio_levels: audioLevels(outputs.feedVideo),
    },
    story: {
      media: summarizeMedia(outputs.storyVideo),
      audio_levels: audioLevels(outputs.storyVideo),
    },
  };

  const manifest = {
    generated_at: verification.generated_at,
    topic: "Strength Is The Blend voiceover slideshow videos",
    voice,
    speech_speed: Number.parseFloat(speechSpeed),
    feed_video: outputs.feedVideo,
    story_video: outputs.storyVideo,
    feed_preview: outputs.feedPreview,
    story_preview: outputs.storyPreview,
    feed_voiceover_script: outputs.feedScript,
    story_voiceover_script: outputs.storyScript,
    feed_voiceover_audio: outputs.feedVoice,
    story_voiceover_audio: outputs.storyVoice,
    verification: outputs.verification,
    source_feed_cards: feedSlides,
    source_story_cards: storySlides,
    compliance:
      "Adult 21+ only. Education/community framing. Voiceover only, no music bed. No marketplace, pricing, inventory, giveaway, sample, order-request, or health-claim language.",
  };

  await writeFile(outputs.verification, `${JSON.stringify(verification, null, 2)}\n`);
  await writeFile(outputs.manifest, `${JSON.stringify(manifest, null, 2)}\n`);
}

async function main() {
  await writeNarrationScripts();

  generateVoiceover(outputs.feedScript, outputs.feedRawVoice);
  generateVoiceover(outputs.storyScript, outputs.storyRawVoice);
  masterVoiceover(outputs.feedRawVoice, outputs.feedVoice);
  masterVoiceover(outputs.storyRawVoice, outputs.storyVoice);

  renderSlideshow({
    slides: feedSlides,
    audioPath: outputs.feedVoice,
    outputPath: outputs.feedVideo,
    width: 1080,
    height: 1350,
  });
  renderSlideshow({
    slides: storySlides,
    audioPath: outputs.storyVoice,
    outputPath: outputs.storyVideo,
    width: 1080,
    height: 1920,
  });
  renderPreview({
    videoPath: outputs.feedVideo,
    outputPath: outputs.feedPreview,
    width: 180,
    height: 225,
  });
  renderPreview({
    videoPath: outputs.storyVideo,
    outputPath: outputs.storyPreview,
    width: 180,
    height: 320,
  });

  await writeManifests();

  console.log(`Rendered feed video: ${outputs.feedVideo}`);
  console.log(`Rendered story video: ${outputs.storyVideo}`);
  console.log(`Verification: ${outputs.verification}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
