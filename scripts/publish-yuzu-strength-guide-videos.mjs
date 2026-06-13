import { GetSecretValueCommand, SecretsManagerClient } from "@aws-sdk/client-secrets-manager";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { basename, dirname, resolve } from "node:path";

const root = process.cwd();
const graphVersion = process.env.YCC_FACEBOOK_GRAPH_VERSION || "v25.0";
const graphBaseUrl = process.env.YCC_FACEBOOK_GRAPH_BASE_URL || "https://graph.facebook.com";
const graphVideoBaseUrl = process.env.YCC_FACEBOOK_GRAPH_VIDEO_BASE_URL || "https://graph-video.facebook.com";
const secretId = process.env.YCC_FACEBOOK_SECRET_ID || "ycc/social/facebook/prod";
const awsRegion = process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || "us-east-1";

const guideDir = resolve(root, "output/social/facebook-planner-month-2026-06-09/strength-is-the-blend-guide");
const videoDir = resolve(guideDir, "video-assets");
const captionPath = resolve(guideDir, "facebook-caption-strength-is-the-blend.txt");
const feedVideoPath = resolve(videoDir, "strength-is-the-blend-feed-slideshow-voiceover.mp4");
const storyVideoPath = resolve(videoDir, "strength-is-the-blend-story-slideshow-voiceover.mp4");
const verificationPath = resolve(videoDir, "strength-is-the-blend-slideshow-video-verification.json");
const publishManifestPath = resolve(videoDir, "strength-is-the-blend-facebook-video-publish.json");

const args = new Set(process.argv.slice(2));
const force = args.has("--force");
const dryRun = args.has("--dry-run");
const skipFeed = args.has("--skip-feed");
const skipStory = args.has("--skip-story");

const title = "Strength Is The Blend";
const storyTitle = "Strength Is The Blend Story";

async function main() {
  await mkdir(dirname(publishManifestPath), { recursive: true });
  const existing = await readExistingManifest();
  const caption = await readFile(captionPath, "utf8");
  const verification = JSON.parse(await readFile(verificationPath, "utf8"));
  const credentials = await resolveFacebookCredentials();

  const manifest = {
    topic: "Strength Is The Blend voiceover video publish",
    generated_at: new Date().toISOString(),
    graph_version: graphVersion,
    page_id: credentials.pageId,
    page_name: credentials.pageName,
    feed_video: feedVideoPath,
    story_video: storyVideoPath,
    caption: captionPath,
    verification: {
      file: verificationPath,
      voice: verification.voice,
      speech_speed: verification.speech_speed,
      feed_duration_seconds: verification.feed?.media?.duration_seconds,
      story_duration_seconds: verification.story?.media?.duration_seconds,
      story_dimensions: verification.story?.media?.video
        ? {
            width: verification.story.media.video.width,
            height: verification.story.media.video.height,
          }
        : undefined,
    },
    facebook_page_video: existing.facebook_page_video,
    facebook_page_story: existing.facebook_page_story,
  };

  if (!skipFeed) {
    if (manifest.facebook_page_video?.video_id && !force) {
      manifest.facebook_page_video = {
        ...manifest.facebook_page_video,
        status: "skipped_existing",
      };
    } else if (dryRun) {
      manifest.facebook_page_video = { status: "dry_run", file: feedVideoPath };
    } else {
      manifest.facebook_page_video = await publishPageVideo({
        credentials,
        filePath: feedVideoPath,
        title,
        description: caption,
      });
      await writeJson(publishManifestPath, manifest);
    }
  }

  if (!skipStory) {
    if (manifest.facebook_page_story?.post_id && !force) {
      manifest.facebook_page_story = {
        ...manifest.facebook_page_story,
        status: "skipped_existing",
      };
    } else if (dryRun) {
      manifest.facebook_page_story = { status: "dry_run", file: storyVideoPath };
    } else {
      manifest.facebook_page_story = await publishPageVideoStory({
        credentials,
        filePath: storyVideoPath,
        title: storyTitle,
      });
      await writeJson(publishManifestPath, manifest);
    }
  }

  await writeJson(publishManifestPath, manifest);
  console.log(
    JSON.stringify(
      {
        page_id: manifest.page_id,
        page_name: manifest.page_name,
        feed: manifest.facebook_page_video,
        story: manifest.facebook_page_story,
        manifest: publishManifestPath,
      },
      null,
      2,
    ),
  );
}

async function resolveFacebookCredentials() {
  const secret = await readJsonSecret(secretId, awsRegion);
  const pageId =
    stringFromSecret(secret, ["page_graph_id", "page_id", "facebook_page_id"]) || process.env.YCC_FACEBOOK_PAGE_ID;
  const pageName = stringFromSecret(secret, ["page_name", "facebook_page_name"]);
  let pageAccessToken =
    stringFromSecret(secret, ["page_access_token", "facebook_page_access_token"]) || process.env.YCC_FACEBOOK_PAGE_ACCESS_TOKEN;
  const systemUserToken =
    stringFromSecret(secret, ["system_user_token", "access_token", "facebook_access_token", "meta_system_user_token"]) ||
    process.env.YCC_FACEBOOK_SYSTEM_USER_TOKEN;

  if (!pageId) {
    throw new Error("Missing Facebook Page ID.");
  }

  if (!pageAccessToken && systemUserToken) {
    pageAccessToken = await derivePageAccessToken(pageId, systemUserToken);
  }

  if (!pageAccessToken) {
    throw new Error("Missing Facebook Page access token.");
  }

  return {
    pageId,
    pageName,
    pageAccessToken,
  };
}

async function publishPageVideo({ credentials, filePath, title, description }) {
  const uploadUrl = `${trimTrailingSlash(graphVideoBaseUrl)}/${graphVersion}/${credentials.pageId}/videos`;
  const fileBuffer = await readFile(filePath);
  const form = new FormData();
  form.set("access_token", credentials.pageAccessToken);
  form.set("title", title);
  form.set("description", description);
  form.set("published", "true");
  form.set("source", new Blob([fileBuffer], { type: "video/mp4" }), basename(filePath));

  const response = await fetch(uploadUrl, { method: "POST", body: form });
  const payload = await response.json();
  if (!response.ok || !payload.id) {
    throw new Error(`Facebook Page video publish failed: ${graphErrorMessage(payload, response.status)}`);
  }

  const readback = await readGraphObject(payload.id, credentials, "id,permalink_url,created_time,description,title");
  return {
    status: "published",
    video_id: payload.id,
    permalink_url: readback.permalink_url,
    created_time: readback.created_time,
    title: readback.title || title,
    file: filePath,
  };
}

async function publishPageVideoStory({ credentials, filePath, title }) {
  const fileStats = await stat(filePath);
  const startUrl = `${trimTrailingSlash(graphBaseUrl)}/${graphVersion}/${credentials.pageId}/video_stories`;
  const startParams = new URLSearchParams();
  startParams.set("access_token", credentials.pageAccessToken);
  startParams.set("upload_phase", "start");

  const startResponse = await fetch(startUrl, { method: "POST", body: startParams });
  const startPayload = await startResponse.json();
  if (!startResponse.ok || !startPayload.video_id || !startPayload.upload_url) {
    throw new Error(`Facebook Page Story start failed: ${graphErrorMessage(startPayload, startResponse.status)}`);
  }

  const uploadResponse = await fetch(startPayload.upload_url, {
    method: "POST",
    headers: {
      Authorization: `OAuth ${credentials.pageAccessToken}`,
      "Content-Type": "application/octet-stream",
      offset: "0",
      file_size: String(fileStats.size),
    },
    body: await readFile(filePath),
  });
  const uploadPayload = await uploadResponse.json();
  if (!uploadResponse.ok) {
    throw new Error(`Facebook Page Story upload failed: ${graphErrorMessage(uploadPayload, uploadResponse.status)}`);
  }

  const finishPayload = await finishStoryWithRetry({
    credentials,
    videoId: startPayload.video_id,
    title,
  });

  const storyReadback = await readLatestStories(credentials);
  const matchingStory =
    storyReadback.data?.find((story) => story.post_id === finishPayload.post_id || story.media_id === startPayload.video_id) ??
    storyReadback.data?.[0];

  return {
    status: "published",
    video_id: startPayload.video_id,
    post_id: finishPayload.post_id,
    success: finishPayload.success,
    story_readback: matchingStory
      ? {
          post_id: matchingStory.post_id,
          status: matchingStory.status,
          creation_time: matchingStory.creation_time,
          media_type: matchingStory.media_type,
          media_id: matchingStory.media_id,
          url: matchingStory.url,
        }
      : undefined,
    upload_status: uploadPayload.status,
    file: filePath,
  };
}

async function finishStoryWithRetry({ credentials, videoId, title }) {
  let lastPayload;
  for (let attempt = 1; attempt <= 6; attempt += 1) {
    const finishUrl = `${trimTrailingSlash(graphBaseUrl)}/${graphVersion}/${credentials.pageId}/video_stories`;
    const finishParams = new URLSearchParams();
    finishParams.set("access_token", credentials.pageAccessToken);
    finishParams.set("upload_phase", "finish");
    finishParams.set("video_id", videoId);
    finishParams.set("title", title);

    const response = await fetch(finishUrl, { method: "POST", body: finishParams });
    const payload = await response.json();
    lastPayload = payload;
    if (response.ok && payload.success) {
      return payload;
    }

    if (attempt < 6) {
      await sleep(attempt * 2500);
    }
  }

  throw new Error(`Facebook Page Story finish failed: ${graphErrorMessage(lastPayload, 400)}`);
}

async function readLatestStories(credentials) {
  const url = new URL(`${trimTrailingSlash(graphBaseUrl)}/${graphVersion}/${credentials.pageId}/stories`);
  url.searchParams.set("fields", "post_id,status,creation_time,media_type,media_id,url");
  url.searchParams.set("limit", "10");
  url.searchParams.set("access_token", credentials.pageAccessToken);
  const response = await fetch(url);
  const payload = await response.json();
  if (!response.ok) {
    return { error: graphErrorMessage(payload, response.status) };
  }
  return payload;
}

async function readGraphObject(id, credentials, fields) {
  const url = new URL(`${trimTrailingSlash(graphBaseUrl)}/${graphVersion}/${id}`);
  url.searchParams.set("fields", fields);
  url.searchParams.set("access_token", credentials.pageAccessToken);
  const response = await fetch(url);
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(`Facebook readback failed for ${id}: ${graphErrorMessage(payload, response.status)}`);
  }
  return payload;
}

async function derivePageAccessToken(pageId, systemUserToken) {
  const accountsUrl = new URL(`${trimTrailingSlash(graphBaseUrl)}/${graphVersion}/me/accounts`);
  accountsUrl.searchParams.set("fields", "id,name,access_token");
  accountsUrl.searchParams.set("access_token", systemUserToken);
  const response = await fetch(accountsUrl);
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(`Could not derive Facebook Page token: ${graphErrorMessage(payload, response.status)}`);
  }
  const page = payload.data?.find((candidate) => candidate.id === pageId);
  if (!page?.access_token) {
    throw new Error(`Facebook Page ${pageId} was not returned by /me/accounts.`);
  }
  return page.access_token;
}

async function readJsonSecret(id, region) {
  const client = new SecretsManagerClient({ region });
  const result = await client.send(new GetSecretValueCommand({ SecretId: id }));
  const secretString = result.SecretString || (result.SecretBinary ? Buffer.from(result.SecretBinary).toString("utf8") : "");
  if (!secretString) {
    throw new Error(`Secret ${id} did not contain a string payload.`);
  }
  return JSON.parse(secretString);
}

async function readExistingManifest() {
  try {
    return JSON.parse(await readFile(publishManifestPath, "utf8"));
  } catch {
    return {};
  }
}

async function writeJson(path, value) {
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function stringFromSecret(secret, keys) {
  for (const key of keys) {
    const value = secret[key];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }
  return undefined;
}

function graphErrorMessage(payload, status) {
  if (payload?.error && typeof payload.error === "object" && typeof payload.error.message === "string") {
    return payload.error.message;
  }
  if (typeof payload?.message === "string") {
    return payload.message;
  }
  return `HTTP ${status}`;
}

function trimTrailingSlash(value) {
  return value.replace(/\/+$/, "");
}

function sleep(ms) {
  return new Promise((resolveSleep) => setTimeout(resolveSleep, ms));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
