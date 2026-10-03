// Build orchestrator for system-docs.
//   node scripts/build.mjs          → build site into dist/
//   node scripts/build.mjs --serve  → build + serve dist/ on :4321
//
// 1. bundle src/widgets/main.ts   → dist/assets/app.js   (browser, iife)
// 2. bundle src/build.mts         → build-cache/build.mjs (node, esm)
// 3. run it                        → writes dist/*.html + assets/bindings.json
// 4. copy src/styles/nord.css      → dist/assets/app.css, favicon, fonts
//
// The dev server mirrors GitHub Pages: the site lives under /system-docs/
// (the bare prefix redirects there) and any missing path gets 404.html with
// a real 404 status, so the not-found page can be checked locally.

import { build } from "esbuild";
import { spawnSync } from "node:child_process";
import { createServer } from "node:http";
import { copyFile, mkdir, readFile, rm } from "node:fs/promises";
import { extname, join, resolve } from "node:path";

const root = resolve(new URL("..", import.meta.url).pathname);
const dist = join(root, "dist");
const cache = join(root, "build-cache");
const serve = process.argv.includes("--serve");
const PAGES_BASE = "/system-docs/";

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".map": "application/json",
  ".woff2": "font/woff2",
};

await rm(dist, { recursive: true, force: true });
await mkdir(join(dist, "assets"), { recursive: true });
await mkdir(cache, { recursive: true });

// 1. browser widgets
await build({
  entryPoints: [join(root, "src/widgets/main.ts")],
  bundle: true,
  format: "iife",
  target: "es2022",
  outfile: join(dist, "assets/app.js"),
  logLevel: "warning",
});

// 2+3. site renderer (bundle, then execute)
await build({
  entryPoints: [join(root, "src/build.mts")],
  bundle: true,
  format: "esm",
  platform: "node",
  target: "node22",
  packages: "external",
  outfile: join(cache, "build.mjs"),
  logLevel: "warning",
});
const run = spawnSync(process.execPath, [join(cache, "build.mjs")], {
  cwd: root,
  stdio: "inherit",
});
if (run.status !== 0) process.exit(run.status ?? 1);

// 4. stylesheet + favicon + fonts
await copyFile(join(root, "src/styles/nord.css"), join(dist, "assets/app.css"));
await copyFile(join(root, "src/assets/favicon.svg"), join(dist, "assets/favicon.svg"));
await mkdir(join(dist, "assets/fonts"), { recursive: true });
for (const f of ["roboto-condensed-latin-wght-normal.woff2", "jetbrains-mono-latin-wght-normal.woff2"]) {
  await copyFile(join(root, "src/assets/fonts", f), join(dist, "assets/fonts", f));
}

console.log("✓ built dist/");

if (serve) {
  const notFound = async (res) => {
    try {
      const body = await readFile(join(dist, "404.html"));
      res.writeHead(404, { "content-type": MIME[".html"] });
      res.end(body);
    } catch {
      res.writeHead(404, { "content-type": "text/plain" });
      res.end("404");
    }
  };
  const server = createServer(async (req, res) => {
    const url = new URL(req.url ?? "/", "http://x");
    if (!url.pathname.startsWith(PAGES_BASE)) {
      res.writeHead(302, { location: PAGES_BASE });
      res.end();
      return;
    }
    let path = join(dist, decodeURIComponent(url.pathname.slice(PAGES_BASE.length)));
    if (url.pathname.endsWith("/")) path = join(path, "index.html");
    try {
      const body = await readFile(path);
      res.writeHead(200, { "content-type": MIME[extname(path)] ?? "application/octet-stream" });
      res.end(body);
    } catch {
      await notFound(res);
    }
  });
  server.listen(4321, () =>
    console.log(`→ http://localhost:4321${PAGES_BASE}  (Ctrl+C to stop; re-run to rebuild)`),
  );
}
