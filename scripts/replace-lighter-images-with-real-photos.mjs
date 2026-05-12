import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import sharp from "sharp";

const projectRoot = process.cwd();
const assetDir = path.join(projectRoot, "public", "assets", "inventory", "lighters");
const auditDir = path.join(projectRoot, "output", "image-audit", "real-lighter-search");
const candidatesDir = path.join(auditDir, "candidates");
const sourceLogPath = path.join(projectRoot, "docs", "lighter-image-sources.json");
const userAgent =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36";

const preferredHosts = [
  "kmtdis.com",
  "canadiandistributor.ca",
  "usglobalimports.com",
  "iaicorporation.com",
  "thescorchtorch.com",
  "blazerproducts.com",
  "mavenproducts.com",
  "vector-kgm.com",
  "newportbutane.com",
  "specialblue.com",
  "canvape.com",
  "goldencedarwholesale.com",
  "lighterusa.com",
  "pipedreams.co",
  "valleydistro.com",
  "rrrwholesale.com",
  "epicwholesale.com",
  "aaaglasspipes.com",
];

function decodeHtml(value) {
  return value
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function compactProductName(product) {
  return product
    .replace(/^#/, "")
    .replace(/\bDISPLAY\b/gi, "")
    .replace(/\bDISPLA\b/gi, "")
    .replace(/\bDISLPLAY\b/gi, "")
    .replace(/\bFLAME\b/gi, "")
    .replace(/\bTORCH\b/gi, "torch")
    .replace(/\s+/g, " ")
    .trim();
}

function productTokens(product) {
  return compactProductName(product)
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length >= 3 && !["the", "with", "and", "for", "assort", "display"].includes(token));
}

function candidateScore(item, candidate, index) {
  const host = new URL(candidate.murl).hostname.replace(/^www\./, "").toLowerCase();
  const haystack = `${candidate.t ?? ""} ${candidate.purl ?? ""} ${candidate.murl ?? ""}`.toLowerCase();
  const tokens = productTokens(item.product);
  const matchedTokens = tokens.filter((token) => haystack.includes(token)).length;
  const distinctiveTokens = tokens.filter(
    (token) => !["scorch", "torch", "lighter", "flame", "single", "display", "assort", "maven", "tesla", "techno"].includes(token)
  );
  const matchedDistinctiveTokens = distinctiveTokens.filter((token) => haystack.includes(token)).length;
  let score = 80 - index * 2 + matchedTokens * 9 + matchedDistinctiveTokens * 16;

  if (haystack.includes(item.sku)) score += 40;
  if (preferredHosts.some((preferredHost) => host.endsWith(preferredHost))) score += 25;
  if (/\.(jpe?g|png|webp)(?:[?#].*)?$/i.test(candidate.murl)) score += 8;
  if (/\b(single|individual|lighter-only)\b/i.test(haystack)) score += 14;
  if (/\b(box|packaging|carton|case)\b/i.test(haystack)) score -= 18;
  if (/watermark|logo|clipart|vector|icon/i.test(candidate.murl)) score -= 20;
  if (/pinterest|facebook|ebay|amazon|walmart|reddit/i.test(host)) score -= 15;

  return score;
}

async function searchBingImages(item) {
  const queries = [
    `${item.sku} ${item.product} lighter only`,
    `${item.sku} ${compactProductName(item.product)} individual lighter`,
    `${compactProductName(item.product)} lighter only no box no packaging`,
  ];
  const candidates = [];
  const seen = new Set();
  const regex = /class="iusc"[^>]*\sm="([^"]+)"/g;

  for (const query of queries) {
    const url = `https://www.bing.com/images/search?q=${encodeURIComponent(query)}&form=HDRSC2&first=1`;
    const response = await fetch(url, { headers: { "user-agent": userAgent } });

    if (!response.ok) {
      throw new Error(`Bing image search failed for ${item.sku}: ${response.status}`);
    }

    const html = await response.text();
    regex.lastIndex = 0;
    let match;

    while ((match = regex.exec(html))) {
      try {
        const payload = JSON.parse(decodeHtml(match[1]));
        if (!payload.murl || seen.has(payload.murl)) continue;
        seen.add(payload.murl);
        candidates.push({
          murl: payload.murl,
          purl: payload.purl ?? "",
          t: payload.t ?? "",
          query,
        });
      } catch {
        // Ignore malformed search metadata and keep scanning.
      }
    }
  }

  return candidates
    .map((candidate, index) => ({ ...candidate, score: candidateScore(item, candidate, index) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 8);
}

async function fetchWithTimeout(url, timeoutMs = 16000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      headers: { "user-agent": userAgent, accept: "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8" },
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    return Buffer.from(await response.arrayBuffer());
  } finally {
    clearTimeout(timeout);
  }
}

function getMaskBounds(mask, width, height, xStart, xEnd, yStart, yEnd) {
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;

  for (let y = yStart; y < yEnd; y += 1) {
    const offset = y * width;
    for (let x = xStart; x < xEnd; x += 1) {
      if (!mask[offset + x]) continue;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }

  if (maxX < minX || maxY < minY) return null;
  return { minX, minY, maxX, maxY };
}

function findColumnClusters(mask, width, height) {
  const scanBottom = Math.floor(height * 0.78);
  const threshold = Math.max(6, Math.floor(scanBottom * 0.018));
  const hist = new Array(width).fill(0);

  for (let y = 0; y < scanBottom; y += 1) {
    const offset = y * width;
    for (let x = 0; x < width; x += 1) {
      if (mask[offset + x]) hist[x] += 1;
    }
  }

  const clusters = [];
  const maxGap = Math.max(3, Math.floor(width * 0.025));
  let start = null;
  let last = null;

  for (let x = 0; x < width; x += 1) {
    if (hist[x] >= threshold) {
      if (start === null) start = x;
      last = x;
    } else if (start !== null && x - last > maxGap) {
      clusters.push({ start, end: last });
      start = null;
      last = null;
    }
  }

  if (start !== null) clusters.push({ start, end: last });

  return clusters
    .map((cluster) => {
      const widthSpan = cluster.end - cluster.start + 1;
      const center = cluster.start + widthSpan / 2;
      const maskWeight = hist.slice(cluster.start, cluster.end + 1).reduce((sum, value) => sum + value, 0);
      return { ...cluster, widthSpan, center, maskWeight };
    })
    .filter((cluster) => cluster.widthSpan >= width * 0.035);
}

async function prepareSingleLighterImage(buffer, item, candidate) {
  const originalMetadata = await sharp(buffer, { failOn: "none", animated: false }).metadata();
  const baseBuffer = await sharp(buffer, { failOn: "none", animated: false })
    .rotate()
    .flatten({ background: "#ffffff" })
    .resize({
      width: 1400,
      height: 1400,
      fit: "inside",
      withoutEnlargement: true,
    })
    .png()
    .toBuffer();
  const { data, info } = await sharp(baseBuffer).raw().toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;
  const mask = new Uint8Array(width * height);
  const cornerSamples = [];

  for (const [sampleX, sampleY] of [
    [0, 0],
    [width - 1, 0],
    [0, height - 1],
    [width - 1, height - 1],
    [Math.floor(width * 0.05), Math.floor(height * 0.05)],
    [Math.floor(width * 0.95), Math.floor(height * 0.05)],
    [Math.floor(width * 0.05), Math.floor(height * 0.95)],
    [Math.floor(width * 0.95), Math.floor(height * 0.95)],
  ]) {
    const i = (sampleY * width + sampleX) * channels;
    cornerSamples.push([data[i], data[i + 1], data[i + 2]]);
  }

  const background = [0, 1, 2].map((channel) => {
    const values = cornerSamples.map((sample) => sample[channel]).sort((a, b) => a - b);
    return values[Math.floor(values.length / 2)];
  });

  for (let y = 0; y < height; y += 1) {
    const row = y * width;
    for (let x = 0; x < width; x += 1) {
      const i = (row + x) * channels;
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const max = Math.max(r, g, b);
      const min = Math.min(r, g, b);
      const saturation = max - min;
      const backgroundDistance = Math.hypot(r - background[0], g - background[1], b - background[2]);
      const nonWhite = !(r > 242 && g > 242 && b > 242);
      const nonShadow = !(r > 225 && g > 225 && b > 225 && saturation < 15);
      mask[row + x] = backgroundDistance > 42 && nonWhite && nonShadow ? 1 : 0;
    }
  }

  const clusters = findColumnClusters(mask, width, height);
  const fullBounds = getMaskBounds(mask, width, height, 0, width, 0, height) ?? {
    minX: 0,
    minY: 0,
    maxX: width - 1,
    maxY: height - 1,
  };
  const sourceText = `${item.product} ${candidate.t ?? ""} ${candidate.purl ?? ""} ${candidate.murl ?? ""}`;
  const forceSingleCrop = /\b(MAVEN|TECHNO|TESLA)\b/i.test(item.product) || /EAGLE TORCH MONEY CLIP|NEWPORT ZERO|FANCY DESIGNS|ASSORTED COLORS/i.test(item.product);
  const displayLike =
    forceSingleCrop ||
    /\b(DISPLAY|DISPLA|DISLPLAY|ASSORT|ASST|COLLECTION|COUNT)\b|(?:\d+\s*CT)|(?:\d+\s*PCS)|(?:\d+\s*PIECES)/i.test(sourceText);
  const imageCenter = width / 2;
  const scoredClusters = clusters
    .map((cluster) => ({
      ...cluster,
      score: cluster.maskWeight / 1000 + cluster.widthSpan * 2 - Math.abs(cluster.center - imageCenter) * 0.75,
    }))
    .sort((a, b) => b.score - a.score);
  const isolatedDisplayCluster = scoredClusters
    .filter((cluster) => cluster.widthSpan < width * 0.35 && (cluster.center > width * 0.58 || cluster.center < width * 0.42))
    .sort((a, b) => b.center - a.center || a.widthSpan - b.widthSpan)[0];
  const selectedCluster =
    (displayLike ? isolatedDisplayCluster : null) ?? scoredClusters[0] ?? { start: fullBounds.minX, end: fullBounds.maxX, center: imageCenter };

  let bounds = fullBounds;

  if (displayLike || clusters.length >= 3) {
    const targetCenter = selectedCluster.center ?? imageCenter;
    const targetWidth = Math.max(120, Math.min(width * 0.16, (fullBounds.maxX - fullBounds.minX + 1) * 0.22));
    const xStart = Math.max(0, Math.floor(targetCenter - targetWidth / 2));
    const xEnd = Math.min(width, Math.ceil(targetCenter + targetWidth / 2));
    bounds =
      getMaskBounds(mask, width, height, xStart, xEnd, 0, Math.floor(height * 0.92)) ??
      getMaskBounds(mask, width, height, xStart, xEnd, 0, height) ??
      fullBounds;
  }

  const objectWidth = bounds.maxX - bounds.minX + 1;
  const objectHeight = bounds.maxY - bounds.minY + 1;
  const paddingX = Math.max(18, Math.floor(objectWidth * (displayLike ? 0.04 : 0.12)));
  const paddingY = Math.max(24, Math.floor(objectHeight * 0.12));
  const left = Math.max(0, bounds.minX - paddingX);
  const top = Math.max(0, bounds.minY - paddingY);
  const right = Math.min(width, bounds.maxX + paddingX + 1);
  const bottom = Math.min(height, bounds.maxY + paddingY + 1);
  const cropWidth = Math.max(1, right - left);
  const cropHeight = Math.max(1, bottom - top);

  const treatment = displayLike || clusters.length >= 3 ? "single-product crop from real product photo" : "real product photo normalized";

  const output = await sharp(baseBuffer)
    .extract({ left, top, width: cropWidth, height: cropHeight })
    .resize({ width: 900, height: 900, fit: "contain", background: "#ffffff" })
    .jpeg({ quality: 88, mozjpeg: true })
    .toBuffer();

  return {
    buffer: output,
    treatment,
    sourceWidth: originalMetadata.width,
    sourceHeight: originalMetadata.height,
    crop: { left, top, width: cropWidth, height: cropHeight },
    clusters: clusters.length,
  };
}

async function chooseRealPhoto(item) {
  const candidates = await searchBingImages(item);
  await writeFile(path.join(candidatesDir, `${item.sku}.json`), JSON.stringify(candidates, null, 2));

  for (const candidate of candidates) {
    try {
      const sourceBuffer = await fetchWithTimeout(candidate.murl);
      const sourceMetadata = await sharp(sourceBuffer, { failOn: "none", animated: false }).metadata();
      if (!sourceMetadata.width || !sourceMetadata.height || sourceMetadata.width < 180 || sourceMetadata.height < 180) {
        continue;
      }

      const prepared = await prepareSingleLighterImage(sourceBuffer, item, candidate);
      await writeFile(path.join(candidatesDir, `${item.sku}-source${path.extname(new URL(candidate.murl).pathname) || ".img"}`), sourceBuffer);

      return {
        ...candidate,
        ...prepared,
        originalWidth: sourceMetadata.width,
        originalHeight: sourceMetadata.height,
      };
    } catch (error) {
      console.warn(`${item.sku}: candidate failed: ${candidate.murl} (${error.message})`);
    }
  }

  throw new Error(`No usable real image candidate found for ${item.sku}`);
}

const inventoryModule = await import("../src/lib/imported-inventory.ts");
const importedInventory = inventoryModule.importedInventory ?? inventoryModule.default?.importedInventory;
const allLighters = importedInventory.filter((item) => item.category === "Lighters / Torch");
const partialRun = Boolean(process.env.LIGHTER_SKUS || process.env.LIGHTER_LIMIT);
const lighters = allLighters
  .filter((item) => !process.env.LIGHTER_SKUS || process.env.LIGHTER_SKUS.split(",").includes(item.sku))
  .slice(0, Number.parseInt(process.env.LIGHTER_LIMIT ?? "", 10) || undefined);
let existingSourceLog = [];

if (partialRun) {
  try {
    existingSourceLog = JSON.parse(await readFile(sourceLogPath, "utf8"));
  } catch {
    existingSourceLog = [];
  }
}

const sourceLog = [];

await mkdir(assetDir, { recursive: true });
await mkdir(candidatesDir, { recursive: true });

for (const [index, item] of lighters.entries()) {
  console.log(`[${index + 1}/${lighters.length}] ${item.sku} ${item.product}`);

  try {
    const result = await chooseRealPhoto(item);
    const assetPath = `/assets/inventory/lighters/${item.sku}-single-lighter.jpg`;
    await writeFile(path.join(projectRoot, "public", assetPath), result.buffer);
    sourceLog.push({
      sku: item.sku,
      title: item.product,
      source: result.treatment,
      sourcePageUrl: result.purl,
      sourceImageUrl: result.murl,
      sourceSearchQuery: result.query,
      asset: assetPath,
      width: 900,
      height: 900,
      originalWidth: result.originalWidth,
      originalHeight: result.originalHeight,
      crop: result.crop,
      clustersDetected: result.clusters,
    });
  } catch (error) {
    console.error(`${item.sku}: ${error.message}`);
    sourceLog.push({
      sku: item.sku,
      title: item.product,
      source: "No usable real product image found from SKU/name image search",
      asset: `/assets/inventory/lighters/${item.sku}-single-lighter.jpg`,
      width: 900,
      height: 900,
      error: error.message,
    });
  }
}

if (partialRun && existingSourceLog.length > 0) {
  const updatesBySku = new Map(sourceLog.map((item) => [item.sku, item]));
  const mergedLog = existingSourceLog.map((item) => updatesBySku.get(item.sku) ?? item);
  const knownSkus = new Set(mergedLog.map((item) => item.sku));
  for (const item of sourceLog) {
    if (!knownSkus.has(item.sku)) mergedLog.push(item);
  }
  await writeFile(sourceLogPath, `${JSON.stringify(mergedLog, null, 2)}\n`);
} else {
  await writeFile(sourceLogPath, `${JSON.stringify(sourceLog, null, 2)}\n`);
}
