#!/usr/bin/env node
import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

const defaultPort = 3000;
const textEncoder = new TextEncoder();

const contentTypes = new Map([
  [".css", "text/css; charset=utf-8"],
  [".gif", "image/gif"],
  [".html", "text/html; charset=utf-8"],
  [".ico", "image/x-icon"],
  [".jpg", "image/jpeg"],
  [".jpeg", "image/jpeg"],
  [".js", "text/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".map", "application/json; charset=utf-8"],
  [".png", "image/png"],
  [".svg", "image/svg+xml; charset=utf-8"],
  [".txt", "text/plain; charset=utf-8"],
  [".webmanifest", "application/manifest+json; charset=utf-8"],
  [".webp", "image/webp"],
  [".xml", "application/xml; charset=utf-8"],
]);

export function parseArgs(args) {
  const config = {
    directory: "out",
    host: "0.0.0.0",
    port: defaultPort,
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if ((arg === "-l" || arg === "--listen") && args[index + 1]) {
      const listenConfig = parseListenArg(args[index + 1]);
      config.host = listenConfig.host;
      config.port = listenConfig.port;
      index += 1;
      continue;
    }

    if ((arg === "-p" || arg === "--port") && args[index + 1]) {
      config.port = parsePort(args[index + 1]);
      index += 1;
      continue;
    }

    if (!arg.startsWith("-")) {
      config.directory = arg;
    }
  }

  return config;
}

export function getRouteCandidates(pathname) {
  const safePath = decodeSafePath(pathname);

  if (safePath === null) {
    return [];
  }

  if (safePath === "") {
    return ["index.html"];
  }

  if (path.extname(safePath)) {
    return [safePath];
  }

  return [
    safePath,
    `${safePath}.html`,
    `${safePath.replace(/\/$/, "")}/index.html`,
  ];
}

function parseListenArg(value) {
  if (/^\d+$/.test(value)) {
    return { host: "0.0.0.0", port: parsePort(value) };
  }

  try {
    const url = new URL(value.includes("://") ? value : `tcp://${value}`);
    return {
      host: url.hostname || "0.0.0.0",
      port: parsePort(url.port || String(defaultPort)),
    };
  } catch {
    return { host: "0.0.0.0", port: parsePort(value) };
  }
}

function parsePort(value) {
  const port = Number(value);

  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`Invalid port: ${value}`);
  }

  return port;
}

function decodeSafePath(pathname) {
  let decoded;

  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    return null;
  }

  const withoutLeadingSlash = decoded.replace(/^\/+/, "");
  const normalized = path.posix.normalize(withoutLeadingSlash);

  if (normalized === "." || normalized === "") {
    return "";
  }

  if (normalized.startsWith("../") || normalized === ".." || normalized.includes("\0")) {
    return null;
  }

  return normalized;
}

async function findStaticFile(rootDirectory, pathname) {
  for (const candidate of getRouteCandidates(pathname)) {
    const fullPath = path.resolve(rootDirectory, candidate);

    if (!isInsideDirectory(rootDirectory, fullPath)) {
      continue;
    }

    const fileStat = await stat(fullPath).catch(() => null);

    if (fileStat?.isFile()) {
      return fullPath;
    }
  }

  return null;
}

function isInsideDirectory(rootDirectory, fullPath) {
  const relative = path.relative(rootDirectory, fullPath);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

function contentTypeFor(filePath) {
  return contentTypes.get(path.extname(filePath).toLowerCase()) ?? "application/octet-stream";
}

async function sendFile(response, filePath, statusCode, method) {
  const fileStat = await stat(filePath);

  response.writeHead(statusCode, {
    "Cache-Control": statusCode === 200 ? "no-cache" : "no-store",
    "Content-Length": fileStat.size,
    "Content-Type": contentTypeFor(filePath),
  });

  if (method === "HEAD") {
    response.end();
    return;
  }

  createReadStream(filePath).pipe(response);
}

async function sendNotFound(response, rootDirectory, method) {
  const notFoundFile = path.resolve(rootDirectory, "404.html");

  if (isInsideDirectory(rootDirectory, notFoundFile)) {
    const notFoundStat = await stat(notFoundFile).catch(() => null);

    if (notFoundStat?.isFile()) {
      await sendFile(response, notFoundFile, 404, method);
      return;
    }
  }

  const body = textEncoder.encode("Not found");
  response.writeHead(404, {
    "Cache-Control": "no-store",
    "Content-Length": body.byteLength,
    "Content-Type": "text/plain; charset=utf-8",
  });
  response.end(method === "HEAD" ? undefined : body);
}

export async function createStaticPreviewServer(rootDirectory) {
  const resolvedRoot = path.resolve(rootDirectory);

  return http.createServer(async (request, response) => {
    try {
      if (request.method !== "GET" && request.method !== "HEAD") {
        response.writeHead(405, { Allow: "GET, HEAD" });
        response.end();
        return;
      }

      const requestUrl = new URL(request.url ?? "/", "http://localhost");
      const filePath = await findStaticFile(resolvedRoot, requestUrl.pathname);

      if (filePath) {
        await sendFile(response, filePath, 200, request.method);
        return;
      }

      await sendNotFound(response, resolvedRoot, request.method);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unexpected static preview error";
      response.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
      response.end(message);
    }
  });
}

async function main() {
  const { directory, host, port } = parseArgs(process.argv.slice(2));
  const server = await createStaticPreviewServer(directory);

  server.listen(port, host, () => {
    const displayHost = host === "0.0.0.0" ? "localhost" : host;
    console.log(`Serving ${path.resolve(directory)} at http://${displayHost}:${port}`);
  });
}

const isMainModule = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isMainModule) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
