#!/usr/bin/env node
import { readdir } from "node:fs/promises";
import type { Server } from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { createStaticPreviewServer } from "./static-preview.mjs";

type AuditOptions = {
  followLinks: boolean;
  full: boolean;
  host: string;
  json: boolean;
  maxLinks: number;
  outDir: string;
  port: number;
  routes: string[];
  timeoutMs: number;
};

type RouteAuditResult = {
  contentType: string;
  failures: string[];
  route: string;
  routeLinks: string[];
  runtimeReferences: string[];
  status: number;
  warnings: string[];
};

type AssetAuditResult = {
  checked: number;
  failures: string[];
  warnings: string[];
};

type AuditSummary = {
  assetsChecked: number;
  baseUrl: string;
  failures: string[];
  followedLinks: number;
  notFoundProbeStatus: number | null;
  routesChecked: number;
  warnings: string[];
};

const defaultCriticalRoutes = [
  "/",
  "/about/",
  "/shop/",
  "/shop/acid-20-twenty-year-24-bx/",
  "/membership/",
  "/member-drops/",
  "/events/",
  "/events/aire-by-puro-open-event/",
  "/education/",
  "/cigar-flow/",
  "/humidor/",
  "/contact/",
  "/cart/",
  "/checkout/",
  "/checkout/cancel/",
  "/checkout/success/",
  "/account/",
  "/admin/",
  "/admin/console/",
  "/admin/newsroom/",
  "/auth/callback/",
  "/auth/logout/",
  "/privacy/",
  "/terms/",
  "/sitemap.xml",
  "/robots.txt",
  "/manifest.webmanifest",
];

const htmlFailureMarkers = [
  "Application error:",
  "Internal Server Error",
  "Unhandled Runtime Error",
  "nextjs-portal",
  "__NEXT_ERROR__",
];

const assetLikePathPattern = /\.(?:avif|css|gif|ico|jpeg|jpg|js|json|map|mjs|mp4|png|svg|txt|webmanifest|webp|woff|woff2|xml)$/iu;
const cssPathPattern = /\.css(?:[?#].*)?$/iu;

export function isExternalReference(value: string) {
  const trimmed = value.trim();

  return trimmed === "" || /^(?:[a-z][a-z0-9+.-]*:|\/\/|#)/iu.test(trimmed);
}

export function extractCssUrlReferences(css: string) {
  return [...css.matchAll(/url\((?:"([^"]+)"|'([^']+)'|([^)'"]+))\)/giu)]
    .map((match) => (match[1] ?? match[2] ?? match[3] ?? "").trim())
    .filter((value) => value !== "" && !isExternalReference(value));
}

export function extractHtmlRuntimeReferences(html: string) {
  const references = new Set<string>();

  for (const tag of html.matchAll(/<(script|link|img|source|video|audio|iframe)\b[^>]*>/giu)) {
    const tagName = tag[1].toLowerCase();
    const attributes = parseAttributes(tag[0]);

    if (tagName === "script") {
      addReference(references, attributes.get("src"));
      continue;
    }

    if (tagName === "link") {
      const rel = attributes.get("rel")?.toLowerCase() ?? "";
      const relTokens = rel.split(/\s+/u);
      const auditsHref = relTokens.some((token) =>
        ["apple-touch-icon", "icon", "manifest", "modulepreload", "preload", "stylesheet"].includes(token),
      );

      if (auditsHref) {
        addReference(references, attributes.get("href"));
      }

      continue;
    }

    addReference(references, attributes.get("src"));
    addReference(references, attributes.get("poster"));

    for (const srcsetReference of extractSrcsetReferences(attributes.get("srcset") ?? "")) {
      addReference(references, srcsetReference);
    }
  }

  return [...references];
}

export function extractHtmlRouteLinks(html: string) {
  const references = new Set<string>();

  for (const tag of html.matchAll(/<a\b[^>]*>/giu)) {
    const attributes = parseAttributes(tag[0]);
    const href = attributes.get("href")?.trim();

    if (!href || isExternalReference(href) || isAssetLikeReference(href)) {
      continue;
    }

    references.add(href);
  }

  return [...references];
}

export function routeFromOutHtmlPath(outDir: string, htmlPath: string) {
  const resolvedOutDir = path.resolve(outDir);
  const resolvedHtmlPath = path.resolve(htmlPath);
  const relativePath = path.relative(resolvedOutDir, resolvedHtmlPath);

  if (relativePath === "" || relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
    return null;
  }

  const posixPath = relativePath.split(path.sep).join("/");

  if (!posixPath.endsWith(".html") || posixPath === "404.html") {
    return null;
  }

  if (posixPath === "index.html") {
    return "/";
  }

  if (posixPath.endsWith("/index.html")) {
    return `/${posixPath.slice(0, -"index.html".length)}`;
  }

  return `/${posixPath.slice(0, -".html".length)}`;
}

function addReference(references: Set<string>, value: string | undefined) {
  if (!value) {
    return;
  }

  const trimmed = value.trim();

  if (trimmed && !isExternalReference(trimmed)) {
    references.add(trimmed);
  }
}

function parseAttributes(tag: string) {
  const withoutTagName = tag.replace(/^<\s*\/?\s*[a-z0-9:-]+/iu, "").replace(/\/?\s*>$/u, "");
  const attributes = new Map<string, string>();

  for (const match of withoutTagName.matchAll(/([^\s"'<>/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/giu)) {
    attributes.set(match[1].toLowerCase(), match[2] ?? match[3] ?? match[4] ?? "");
  }

  return attributes;
}

function extractSrcsetReferences(value: string) {
  return value
    .split(",")
    .map((candidate) => candidate.trim().split(/\s+/u)[0])
    .filter((candidate) => candidate !== "");
}

function isAssetLikeReference(reference: string) {
  const pathname = reference.split(/[?#]/u, 1)[0];

  return assetLikePathPattern.test(pathname);
}

async function runAudit(options: AuditOptions): Promise<AuditSummary> {
  const resolvedOutDir = path.resolve(options.outDir);
  const server: Server = await createStaticPreviewServer(resolvedOutDir);

  try {
    await listen(server, options.host, options.port);

    const address = server.address();

    if (!address || typeof address === "string") {
      throw new Error("Static preview server did not expose a TCP address.");
    }

    const baseHost = address.address === "0.0.0.0" ? "127.0.0.1" : address.address;
    const baseUrl = `http://${baseHost}:${address.port}`;
    const summary = await auditAgainstBaseUrl(baseUrl, resolvedOutDir, options);

    return summary;
  } finally {
    await closeServer(server);
  }
}

async function auditAgainstBaseUrl(baseUrl: string, outDir: string, options: AuditOptions): Promise<AuditSummary> {
  const failures: string[] = [];
  const warnings: string[] = [];
  const routeQueue = new Set<string>(defaultCriticalRoutes.map(normalizeRouteForFetch));
  const followedRouteKeys = new Set<string>();
  const checkedRouteKeys = new Set<string>();
  const assetReferences = new Set<string>();

  for (const route of options.routes) {
    routeQueue.add(normalizeRouteForFetch(route));
  }

  if (options.full) {
    for (const route of await findExportedHtmlRoutes(outDir)) {
      routeQueue.add(normalizeRouteForFetch(route));
    }
  }

  while (routeQueue.size > 0) {
    const nextRoute = routeQueue.values().next();

    if (nextRoute.done) {
      break;
    }

    const route = nextRoute.value;
    routeQueue.delete(route);

    if (checkedRouteKeys.has(route)) {
      continue;
    }

    checkedRouteKeys.add(route);

    const result = await auditRoute(baseUrl, route, options.timeoutMs);
    failures.push(...result.failures);
    warnings.push(...result.warnings);

    for (const reference of result.runtimeReferences) {
      const resolvedReference = resolveLocalReference(baseUrl, result.route, reference);

      if (resolvedReference) {
        assetReferences.add(resolvedReference);
      }
    }

    if (!options.followLinks) {
      continue;
    }

    for (const link of result.routeLinks) {
      const resolvedLink = resolveLocalReference(baseUrl, result.route, link);

      if (!resolvedLink || isAssetLikeReference(resolvedLink) || checkedRouteKeys.has(resolvedLink) || routeQueue.has(resolvedLink)) {
        continue;
      }

      if (followedRouteKeys.size >= options.maxLinks) {
        warnings.push(`Skipped additional internal links after --max-links=${options.maxLinks}.`);
        break;
      }

      followedRouteKeys.add(resolvedLink);
      routeQueue.add(resolvedLink);
    }
  }

  const assetResult = await auditAssets(baseUrl, assetReferences, options.timeoutMs);
  failures.push(...assetResult.failures);
  warnings.push(...assetResult.warnings);

  const notFoundProbeStatus = await auditNotFoundProbe(baseUrl, options.timeoutMs).catch((error: unknown) => {
    failures.push(`Not-found probe failed: ${errorMessage(error)}`);
    return null;
  });

  if (notFoundProbeStatus !== null && notFoundProbeStatus !== 404) {
    failures.push(`Not-found probe returned ${notFoundProbeStatus}; expected 404.`);
  }

  return {
    assetsChecked: assetResult.checked,
    baseUrl,
    failures,
    followedLinks: followedRouteKeys.size,
    notFoundProbeStatus,
    routesChecked: checkedRouteKeys.size,
    warnings,
  };
}

async function auditRoute(baseUrl: string, route: string, timeoutMs: number): Promise<RouteAuditResult> {
  const normalizedRoute = normalizeRouteForFetch(route);
  const url = new URL(normalizedRoute, baseUrl);
  const failures: string[] = [];
  const warnings: string[] = [];
  const response = await fetchWithTimeout(url, timeoutMs);
  const contentType = response.headers.get("content-type") ?? "";
  const body = await response.text();

  if (!response.ok) {
    failures.push(`Route ${normalizedRoute} returned HTTP ${response.status}.`);
  }

  if (body.trim() === "") {
    failures.push(`Route ${normalizedRoute} returned an empty response body.`);
  }

  if (isHtmlRoute(normalizedRoute, contentType)) {
    if (!/<html[\s>]/iu.test(body)) {
      failures.push(`Route ${normalizedRoute} did not return an HTML document.`);
    }

    for (const marker of htmlFailureMarkers) {
      if (body.includes(marker)) {
        failures.push(`Route ${normalizedRoute} contains framework/runtime error marker "${marker}".`);
      }
    }

    return {
      contentType,
      failures,
      route: normalizedRoute,
      routeLinks: extractHtmlRouteLinks(body),
      runtimeReferences: extractHtmlRuntimeReferences(body),
      status: response.status,
      warnings,
    };
  }

  if (!contentType) {
    warnings.push(`Route ${normalizedRoute} did not include a Content-Type header.`);
  }

  return {
    contentType,
    failures,
    route: normalizedRoute,
    routeLinks: [],
    runtimeReferences: [],
    status: response.status,
    warnings,
  };
}

async function auditAssets(baseUrl: string, initialReferences: Set<string>, timeoutMs: number): Promise<AssetAuditResult> {
  const queue = [...initialReferences];
  const checked = new Set<string>();
  const failures: string[] = [];
  const warnings: string[] = [];

  while (queue.length > 0) {
    const reference = queue.shift();

    if (!reference || checked.has(reference)) {
      continue;
    }

    checked.add(reference);

    const url = new URL(reference, baseUrl);
    const response = await fetchWithTimeout(url, timeoutMs, cssPathPattern.test(url.pathname) ? "GET" : "HEAD").catch(
      async (error: unknown) => {
        failures.push(`Asset ${reference} failed to load: ${errorMessage(error)}.`);
        return null;
      },
    );

    if (!response) {
      continue;
    }

    if (response.status === 405) {
      const fallbackResponse = await fetchWithTimeout(url, timeoutMs);

      if (!fallbackResponse.ok) {
        failures.push(`Asset ${reference} returned HTTP ${fallbackResponse.status}.`);
      }

      continue;
    }

    if (!response.ok) {
      failures.push(`Asset ${reference} returned HTTP ${response.status}.`);
      continue;
    }

    const contentType = response.headers.get("content-type") ?? "";

    if (cssPathPattern.test(url.pathname) || contentType.includes("text/css")) {
      const css = await response.text();

      for (const cssReference of extractCssUrlReferences(css)) {
        const resolvedReference = resolveLocalReference(baseUrl, reference, cssReference);

        if (resolvedReference && !checked.has(resolvedReference)) {
          queue.push(resolvedReference);
        }
      }
    }

    if (!contentType) {
      warnings.push(`Asset ${reference} did not include a Content-Type header.`);
    }
  }

  return {
    checked: checked.size,
    failures,
    warnings,
  };
}

async function auditNotFoundProbe(baseUrl: string, timeoutMs: number) {
  const response = await fetchWithTimeout(new URL("/__e2e-runtime-audit-missing-route__/", baseUrl), timeoutMs);

  await response.arrayBuffer();

  return response.status;
}

function isHtmlRoute(route: string, contentType: string) {
  return contentType.includes("text/html") || route.endsWith("/") || route.endsWith(".html");
}

function resolveLocalReference(baseUrl: string, fromRoute: string, reference: string) {
  if (isExternalReference(reference)) {
    return null;
  }

  const base = new URL(baseUrl);
  const parentUrl = new URL(fromRoute, base);
  const resolved = new URL(reference, parentUrl);

  if (resolved.origin !== base.origin) {
    return null;
  }

  return `${resolved.pathname}${resolved.search}`;
}

function normalizeRouteForFetch(route: string) {
  const withLeadingSlash = route.startsWith("/") ? route : `/${route}`;
  const parsed = new URL(withLeadingSlash, "http://runtime-audit.local");

  return `${parsed.pathname}${parsed.search}`;
}

async function findExportedHtmlRoutes(outDir: string) {
  const htmlFiles = await findFiles(outDir, (filePath) => filePath.endsWith(".html"));
  const routes: string[] = [];

  for (const htmlFile of htmlFiles) {
    const route = routeFromOutHtmlPath(outDir, htmlFile);

    if (route) {
      routes.push(route);
    }
  }

  return routes.sort();
}

async function findFiles(directory: string, predicate: (filePath: string) => boolean) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const entryPath = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      files.push(...await findFiles(entryPath, predicate));
      continue;
    }

    if (entry.isFile() && predicate(entryPath)) {
      files.push(entryPath);
    }
  }

  return files;
}

async function fetchWithTimeout(url: URL, timeoutMs: number, method = "GET") {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, {
      method,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
}

async function listen(server: Server, host: string, port: number) {
  await new Promise<void>((resolve, reject) => {
    const onError = (error: Error) => {
      server.off("listening", onListening);
      reject(error);
    };
    const onListening = () => {
      server.off("error", onError);
      resolve();
    };

    server.once("error", onError);
    server.once("listening", onListening);
    server.listen(port, host);
  });
}

async function closeServer(server: Server) {
  if (!server.listening) {
    return;
  }

  await new Promise<void>((resolve, reject) => {
    server.close((error) => {
      if (error) {
        reject(error);
        return;
      }

      resolve();
    });
  });
}

function parseArgs(args: string[]): AuditOptions {
  const options: AuditOptions = {
    followLinks: true,
    full: false,
    host: "127.0.0.1",
    json: false,
    maxLinks: 1000,
    outDir: "out",
    port: 0,
    routes: [],
    timeoutMs: 10000,
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (arg === "--help" || arg === "-h") {
      printHelp();
      process.exit(0);
    }

    if (arg === "--full") {
      options.full = true;
      continue;
    }

    if (arg === "--json") {
      options.json = true;
      continue;
    }

    if (arg === "--no-follow-links") {
      options.followLinks = false;
      continue;
    }

    if (arg === "--out-dir" && args[index + 1]) {
      options.outDir = args[index + 1];
      index += 1;
      continue;
    }

    if (arg === "--host" && args[index + 1]) {
      options.host = args[index + 1];
      index += 1;
      continue;
    }

    if (arg === "--port" && args[index + 1]) {
      options.port = parseIntegerArg("--port", args[index + 1], 0, 65535);
      index += 1;
      continue;
    }

    if (arg === "--route" && args[index + 1]) {
      options.routes.push(args[index + 1]);
      index += 1;
      continue;
    }

    if (arg === "--timeout-ms" && args[index + 1]) {
      options.timeoutMs = parseIntegerArg("--timeout-ms", args[index + 1], 1, Number.MAX_SAFE_INTEGER);
      index += 1;
      continue;
    }

    if (arg === "--max-links" && args[index + 1]) {
      options.maxLinks = parseIntegerArg("--max-links", args[index + 1], 0, Number.MAX_SAFE_INTEGER);
      index += 1;
      continue;
    }

    throw new Error(`Unknown or incomplete argument: ${arg}`);
  }

  return options;
}

function parseIntegerArg(name: string, value: string, min: number, max: number) {
  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed < min || parsed > max) {
    throw new Error(`${name} must be an integer between ${min} and ${max}.`);
  }

  return parsed;
}

function printHelp() {
  console.log(`E2E runtime audit for the built static export.

Usage:
  tsx scripts/e2e-runtime-audit.ts [options]

Options:
  --out-dir <dir>        Static export directory. Default: out
  --host <host>          Static preview host. Default: 127.0.0.1
  --port <port>          Static preview port. Default: 0 (ephemeral)
  --route <path>         Add a route to audit. Can be repeated.
  --full                 Audit every exported HTML route in out/.
  --no-follow-links      Do not follow internal links found in audited HTML.
  --max-links <count>    Maximum discovered internal links to follow. Default: 1000
  --timeout-ms <ms>      Per-request timeout. Default: 10000
  --json                 Print JSON summary.
  --help                 Show this help.
`);
}

function printSummary(summary: AuditSummary, json: boolean) {
  if (json) {
    console.log(JSON.stringify(summary, null, 2));
    return;
  }

  const status = summary.failures.length === 0 ? "passed" : "failed";

  console.log(`E2E runtime audit ${status}`);
  console.log(`Base URL: ${summary.baseUrl}`);
  console.log(`Routes checked: ${summary.routesChecked}`);
  console.log(`Internal links followed: ${summary.followedLinks}`);
  console.log(`Runtime assets checked: ${summary.assetsChecked}`);
  console.log(`Not-found probe: ${summary.notFoundProbeStatus ?? "not run"}`);
  console.log(`Warnings: ${summary.warnings.length}`);

  for (const warning of summary.warnings) {
    console.log(`- WARN ${warning}`);
  }

  if (summary.failures.length > 0) {
    console.log(`Failures: ${summary.failures.length}`);

    for (const failure of summary.failures) {
      console.log(`- FAIL ${failure}`);
    }
  }
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const summary = await runAudit(options);

  printSummary(summary, options.json);

  if (summary.failures.length > 0) {
    process.exitCode = 1;
  }
}

const isMainModule = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isMainModule) {
  main().catch((error: unknown) => {
    console.error(errorMessage(error));
    process.exit(1);
  });
}
