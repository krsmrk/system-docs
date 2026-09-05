// Site renderer — TASK B STUB.
// Agent B replaces this file (and src/templates.ts) with the real renderer
// per SPEC.md "Build pipeline". For now it emits a placeholder index page so
// the build pipeline (scripts/build.mjs) stays exercisable end-to-end.

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";

const root = resolve(new URL("..", import.meta.url).pathname);
const data = JSON.parse(await readFile(join(root, "data/keybinds.json"), "utf8"));

await mkdir(join(root, "dist"), { recursive: true });
const items = data.apps
  .map(
    (a: { id: string; title: string }) =>
      `<li><a href="apps/${a.id}.html">${a.title}</a></li>`,
  )
  .join("\n");
await writeFile(
  join(root, "dist/index.html"),
  `<!doctype html><html><head><meta charset="utf-8"><title>system-docs</title></head><body><ul>\n${items}\n</ul></body></html>\n`,
);
console.log("stub render: index.html only (task B pending)");
