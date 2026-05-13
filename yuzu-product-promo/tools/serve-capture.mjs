import { createReadStream, promises as fs } from "node:fs";
import { createServer } from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "../../out");
const port = Number(process.env.PORT || 4174);

const types = new Map([
  [".css", "text/css; charset=utf-8"],
  [".html", "text/html; charset=utf-8"],
  [".ico", "image/x-icon"],
  [".js", "text/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".png", "image/png"],
  [".svg", "image/svg+xml; charset=utf-8"],
  [".txt", "text/plain; charset=utf-8"],
  [".webmanifest", "application/manifest+json; charset=utf-8"],
]);

function resolveRequest(url) {
  const parsed = new URL(url, `http://127.0.0.1:${port}`);
  let pathname = decodeURIComponent(parsed.pathname);
  if (pathname.endsWith("/")) pathname += "index.html";

  const resolved = path.resolve(root, `.${pathname}`);
  if (!resolved.startsWith(root)) return null;
  return resolved;
}

createServer(async (req, res) => {
  const filePath = resolveRequest(req.url || "/");
  if (!filePath) {
    res.writeHead(403).end("Forbidden");
    return;
  }

  try {
    const stat = await fs.stat(filePath);
    if (!stat.isFile()) throw new Error("Not a file");

    const ext = path.extname(filePath);
    res.setHeader("Content-Type", types.get(ext) || "application/octet-stream");

    if (ext === ".html") {
      const html = await fs.readFile(filePath, "utf8");
      const injected = html.replace(
        "<head>",
        "<head><script>localStorage.setItem('yuzu-age-confirmed','yes');</script>",
      );
      res.writeHead(200).end(injected);
      return;
    }

    res.writeHead(200);
    createReadStream(filePath).pipe(res);
  } catch {
    const fallback = path.join(root, "404.html");
    try {
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.writeHead(404).end(await fs.readFile(fallback, "utf8"));
    } catch {
      res.writeHead(404).end("Not found");
    }
  }
}).listen(port, "127.0.0.1", () => {
  console.log(`Capture server listening on http://127.0.0.1:${port}/`);
});
