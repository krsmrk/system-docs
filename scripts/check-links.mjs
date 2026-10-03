// Link checker for the built site: every relative href/src in dist/*.html
// must resolve to a file, every #fragment to an id on the target page, and
// nothing may use a root-absolute path (GitHub Pages serves the site under
// /system-docs/, so "/apps/x.html" would escape it). Exit 1 on any problem.
//   node scripts/check-links.mjs

import { readdirSync, readFileSync, statSync, existsSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";

const root = resolve(new URL("..", import.meta.url).pathname);
const dist = join(root, "dist");

// The 404 page is served by GitHub Pages at ANY missing URL, so it is the one
// page that must use root-absolute paths under the Pages base.
const PAGES_BASE = "/system-docs/";
const ABSOLUTE_OK = new Set(["404.html"]);

const files = [];
(function walk(d) {
  for (const f of readdirSync(d)) {
    const p = join(d, f);
    if (statSync(p).isDirectory()) walk(p);
    else if (p.endsWith(".html")) files.push(p);
  }
})(dist);

const idCache = new Map();
const idsOf = (file) => {
  let ids = idCache.get(file);
  if (!ids) {
    ids = new Set([...readFileSync(file, "utf8").matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]));
    idCache.set(file, ids);
  }
  return ids;
};

let problems = 0;
let checked = 0;
for (const file of files) {
  const rel = relative(dist, file);
  const html = readFileSync(file, "utf8");
  for (const m of html.matchAll(/\s(?:href|src)="([^"]+)"/g)) {
    const url = m[1];
    if (/^(https?:|mailto:|data:)/.test(url)) continue;
    checked++;
    if (url.startsWith("#")) {
      if (!idsOf(file).has(url.slice(1))) {
        problems++;
        console.log(`${rel}: missing anchor ${url}`);
      }
      continue;
    }
    let target;
    if (url.startsWith("/")) {
      if (!ABSOLUTE_OK.has(rel) || !url.startsWith(PAGES_BASE)) {
        problems++;
        console.log(`${rel}: root-absolute path ${url} (breaks under ${PAGES_BASE})`);
        continue;
      }
      target = join(dist, url.slice(PAGES_BASE.length));
    } else {
      target = resolve(dirname(file), url.split("#")[0]);
    }
    const [path, frag] = target.split("#");
    if (!existsSync(path)) {
      problems++;
      console.log(`${rel}: broken link ${url}`);
      continue;
    }
    if (frag && path.endsWith(".html") && !idsOf(path).has(frag)) {
      problems++;
      console.log(`${rel}: missing anchor ${url}`);
    }
  }
}
console.log(`check-links: ${checked} links in ${files.length} pages, ${problems} problem(s)`);
process.exit(problems === 0 ? 0 : 1);
