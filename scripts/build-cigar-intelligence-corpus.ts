import { existsSync } from "node:fs";
import { copyFile, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  catalogProducts,
  getCatalogProductDescription,
  getCatalogProductDisplayName,
  isCigarCatalogProduct,
  type CatalogProduct,
} from "../src/lib/catalog";

const workspaceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const defaultOutputDir = path.join(workspaceRoot, "output", "cigar-intelligence-corpus");
const maxBedrockMetadataBytes = 1024;
const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const outputDir = resolveOutputDir(getArgValue("--out") || defaultOutputDir);
const publicSiteUrl = (process.env.PUBLIC_SITE_URL || "https://www.yuzucigarclub.com").replace(/\/$/, "");

const products = catalogProducts.filter(isCigarCatalogProduct);
const records = products.map(buildCorpusRecord);
const recordsWithLocalImages = records.filter((record) => record.localImagePath);
const uniqueBrands = new Set(records.map((record) => record.product.brand).filter(Boolean));

async function main() {
  if (!dryRun) {
    await mkdir(path.join(outputDir, "documents"), { recursive: true });
    await mkdir(path.join(outputDir, "images"), { recursive: true });

    for (const record of records) {
      const documentName = `${record.key}.md`;
      await writeFile(path.join(outputDir, "documents", documentName), buildProductDocument(record.product), "utf8");
      await writeFile(
        path.join(outputDir, "documents", `${documentName}.metadata.json`),
        serializeProductMetadata(record.product),
        "utf8",
      );

      if (record.localImagePath) {
        const extension = path.extname(record.localImagePath).toLowerCase();
        const imageName = `${record.key}${extension}`;
        await copyFile(record.localImagePath, path.join(outputDir, "images", imageName));
        await writeFile(
          path.join(outputDir, "images", `${imageName}.metadata.json`),
          serializeProductMetadata(record.product, { image: true }),
          "utf8",
        );
      }
    }

    await writeFile(
      path.join(outputDir, "manifest.json"),
      `${JSON.stringify(buildManifest(), null, 2)}\n`,
      "utf8",
    );
  }

  process.stdout.write(`${JSON.stringify(buildManifest(), null, 2)}\n`);
}

function getArgValue(name: string) {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
}

function resolveOutputDir(value: string) {
  return path.isAbsolute(value) ? value : path.resolve(workspaceRoot, value);
}

function buildCorpusRecord(product: CatalogProduct) {
  const key = `${product.slug}-${product.sku.toLowerCase()}`.replace(/[^a-z0-9-]+/g, "-");
  const localImagePath = resolveLocalProductImage(product.image);
  return { key, localImagePath, product };
}

function resolveLocalProductImage(image: string) {
  if (!image.startsWith("/")) {
    return null;
  }

  const candidate = path.resolve(workspaceRoot, "public", image.replace(/^\/+/, ""));
  const publicRoot = `${path.resolve(workspaceRoot, "public")}${path.sep}`;
  if (!candidate.startsWith(publicRoot)) {
    return null;
  }

  return existsSync(candidate) ? candidate : null;
}

function buildProductDocument(product: CatalogProduct) {
  const sources = getProductSources(product);
  const fields = [
    `# ${getCatalogProductDisplayName(product.name)}`,
    "",
    `Canonical catalog name: ${product.name}`,
    `Brand: ${product.brand || "Unknown"}`,
    `SKU: ${product.sku}`,
    `Line and variant aliases: ${buildAliases(product).join(" | ")}`,
    `Vitola: ${product.vitola || "Unknown"}`,
    `Dimensions: ${[product.length, product.gauge ? `${product.gauge} ring gauge` : ""].filter(Boolean).join(" × ") || "Unknown"}`,
    `Wrapper: ${product.wrapper || "Unknown"}`,
    `Binder: ${product.binder || "Unknown"}`,
    `Filler: ${product.filler || "Unknown"}`,
    `Origin: ${product.origin || "Unknown"}`,
    `Strength: ${product.strength || "Unknown"}`,
    `Packaging: ${product.packageLabel}`,
    `Yuzu product page: ${publicSiteUrl}${product.storeHref}`,
    "",
    getCatalogProductDescription(product),
    "",
    "## Source references",
    "",
    ...(sources.length
      ? sources.map((source) => `- ${source.name}: ${source.url}`)
      : ["- Yuzu inventory/catalog record; external product reference still needs verification."]),
    "",
    "Identification rule: match brand, line/variant, vitola, wrapper, packaging, and visible band or box evidence. Do not treat this record as an exact match when those fields conflict.",
  ];

  return `${fields.join("\n")}\n`;
}

function buildProductMetadata(product: CatalogProduct, options: { image?: boolean } = {}) {
  const sources = getProductSources(product);
  const attributes: Record<string, unknown> = {
    brand: embeddedString(product.brand),
    canonicalName: embeddedString(getCatalogProductDisplayName(product.name)),
    sku: embeddedString(product.sku),
    sourceUrl: simpleString(sources[0]?.url || `${publicSiteUrl}${product.storeHref}`),
    yuzuProductUrl: simpleString(`${publicSiteUrl}${product.storeHref}`),
    modality: simpleString(options.image ? "canonical_product_image" : "canonical_product_record"),
  };
  if (product.vitola?.trim()) {
    attributes.vitola = embeddedString(product.vitola.trim());
  }

  return { metadataAttributes: attributes };
}

function serializeProductMetadata(product: CatalogProduct, options: { image?: boolean } = {}) {
  const payload = `${JSON.stringify(buildProductMetadata(product, options))}\n`;
  const bytes = Buffer.byteLength(payload, "utf8");
  if (bytes > maxBedrockMetadataBytes) {
    throw new Error(
      `Bedrock metadata sidecar exceeds ${maxBedrockMetadataBytes} bytes for SKU ${product.sku}: ${bytes}`,
    );
  }
  return payload;
}

function embeddedString(value: string) {
  return {
    value: { type: "STRING", stringValue: value },
    includeForEmbedding: true,
  };
}

function simpleString(value: string) {
  return {
    value: { type: "STRING", stringValue: value },
    includeForEmbedding: false,
  };
}

function buildAliases(product: CatalogProduct) {
  return Array.from(
    new Set(
      [
        getCatalogProductDisplayName(product.name),
        product.name,
        [product.brand, product.vitola].filter(Boolean).join(" "),
        [product.brand, product.wrapper, product.vitola].filter(Boolean).join(" "),
        product.sku,
      ].filter(Boolean),
    ),
  );
}

function getProductSources(product: CatalogProduct) {
  const sources = [
    ...(product.expertReview
      ? [{ name: product.expertReview.sourceName, url: product.expertReview.sourceUrl }]
      : []),
    ...(product.reviewProfile?.sources.map((source) => ({ name: source.sourceName, url: source.sourceUrl })) || []),
  ];
  const seen = new Set<string>();

  return sources.filter((source) => {
    if (!/^https?:\/\//i.test(source.url) || seen.has(source.url)) {
      return false;
    }
    seen.add(source.url);
    return true;
  });
}

function buildManifest() {
  return {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    dryRun,
    outputDir,
    productRecords: records.length,
    uniqueBrands: uniqueBrands.size,
    localCanonicalImages: recordsWithLocalImages.length,
    productsMissingLocalCanonicalImage: records.length - recordsWithLocalImages.length,
    bedrockLayout: {
      textPrefix: "documents/",
      imagePrefix: "images/",
      metadataSidecarSuffix: ".metadata.json",
    },
    readiness: {
      textRetrievalSeeded: records.length > 0,
      multimodalCoverageReady: false,
      reason:
        "Local catalog images are mainly box/product shots. Add licensed front/back band and real-phone capture views, then pass the golden-corpus gates before enabling the multimodal knowledge base.",
    },
  };
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.stack || error.message : String(error)}\n`);
  process.exitCode = 1;
});
