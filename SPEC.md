# system-docs — SPEC (binding contracts for all tasks)

Web-based documentation for Stefan's NixOS system ("box"). Fully custom static
site: **keybindings generated from live config** + hand-written usage guides.
Nord theme. Hosted on GitHub Pages (`krsmrk.github.io/system-docs`).

## Tech

- TypeScript + esbuild + markdown-it. No other runtime deps. No framework.
- Build: `npm run build` → `dist/` (pure static HTML/CSS/JS).
- Pages: `dist/index.html`, `dist/apps/<id>.html`, `dist/guides/<slug>.html`,
  `dist/assets/app.css`, `dist/assets/app.js` (one bundle, auto-inits per page).
- Progressive enhancement: pages are complete HTML without JS; widgets only
  enhance existing DOM.

## Data: `data/keybinds.json`

```jsonc
{
  "meta": {
    "generatedAt": "2026-09-05T12:00:00Z", // ISO 8601
    "sourceCommit": "feff4bb",              // nixos_config commit, short
    "host": "box"
  },
  "apps": [
    {
      "id": "niri",                 // kebab-case, used in URL apps/niri.html
      "title": "niri",
      "tagline": "scrollable-tiling compositor",
      "description": "One or two sentences.",
      "icon": "▦",                  // single unicode glyph for the app card
      "guide": "niri-workflows",     // optional: slug of related guide
      "groups": [
        {
          "name": "Focus & movement",
          "bindings": [
            {
              "keys": "Mod+H",                       // normalized, see below
              "label": "Focus column left (wraps)",  // human description
              "command": "focus-column-left-or-last", // optional: raw action
              "source": "config.kdl:158"              // optional: provenance
            }
          ]
        }
      ]
    }
  ]
}
```

### Key normalization contract

Note: kbd chips render `+` separators as `<span class="kb-plus">+</span>` and
chord steps separated by `<span class="kb-seq"> </span>`.

- Modifiers, in this order: `Mod`, `Ctrl`, `Alt`, `Shift`. (niri `Mod` = Super.)
- Then the key token: letters uppercased (`H`), named keys TitleCase
  (`Return`, `Left`, `BracketLeft`, `Print`, `Minus`, `Escape`, `Space`,
  `Tab`, `XF86AudioRaiseVolume`).
- Joined with `+`, no spaces: `Mod+Shift+BracketLeft`.
- zsh: `^R` → `Ctrl+R`; `^[f` (Meta) → `Alt+F`; `^[^[` → `Ctrl+Alt+Escape`;
  `^Xb` → `Ctrl+X B` (two-step: keep space-separated tail; still normalized mods).
- Pointer/wheel pseudo-keys: `Mouse Left Click`, `Mouse Right Click`,
  `Scroll Up`, `Scroll Down` — used by waybar.
- Every binding MUST have `keys` and `label`. `keys` may be `""` only for
  prose-only rows; widgets must tolerate that.

## Apps covered (ids)

`niri` (binds, gestures, media keys), `waybar` (click/scroll actions),
`yazi` (keymap.toml + note about stock defaults), `zsh` (vi-mode bindkeys).
`zathura` and `fuzzel` bindings are stock-only → covered inside the guides
(niri-workflows / yazi), not as app pages.

## DOM contracts (build emits this; widgets consume it)

```html
<!-- app page -->
<body data-page="app" data-app="niri">
  <input class="kb-filter" type="search" placeholder="Filter bindings…" aria-label="Filter bindings">
  <div class="kb-keyboard"></div>            <!-- keyboard widget mounts here -->
  <section class="kb-group">
    <h3>Focus & movement</h3>
    <table class="kb-table"><tbody>
      <tr class="kb-row" data-keys="Mod+H">
        <td class="kb-keys"><kbd><span class="mod">Mod</span>+<span class="key">H</span></kbd></td>
        <td class="kb-label">Focus column left (wraps)</td>
        <td class="kb-command"><code>focus-column-left-or-last</code></td>
      </tr>
    </tbody></table>
  </section>
  <script type="application/json" id="app-data"> { ...this app object... } </script>
```

- Landing page: `body[data-page="index"]`, grid of `.app-card` elements plus a
  guides index. No widgets required on index (pure CSS grid).
- Guide pages: `body[data-page="guide"]`, `<article>` + `<nav class="toc">`
  built from h2/h3 headings at build time.
- All pages share one header: site title "system-docs — box", nav links
  (Overview, Guides), Nord theme toggle (dark/light, persists localStorage,
  default dark, respects prefers-color-scheme).

## Widgets (src/widgets/, bundled to assets/app.js)

1. **filter.ts** — on `body[data-page="app"]`: attach to `.kb-filter`.
   Fuzzy match (subsequence, case-insensitive, rank by tightness) over each
   `.kb-row`'s keys+label+command. Live-filter on input: hide non-matching
   rows, hide groups with no visible rows, show "N of M" counter next to
   input. Keyboard: `/` focuses input (unless already in an input),
   `Esc` clears+blurs. Highlight matched chars with `<mark>`? NO — keep it
   simple, just show/hide. Empty state message when 0 matches.
2. **keyboard.ts** — on `body[data-page="app"]`: render ISO/DE keyboard
   (105-key, backslash/pipe key between Left-Shift and Z, big Enter) as a
   <div> grid. Layer chips above it derived from modifier combos present in
   the app's bindings (e.g. `none`, `Mod`, `Mod+Shift`, `Ctrl`, `Mod+Ctrl`).
   Selecting a layer highlights bound keys (accent color nord8), stronger
   highlight for `Mod+Shift` etc. Hovering a highlighted key shows a tooltip
   with label(s). Clicking a key scrolls to & flashes the first matching
   `.kb-row`. Keys used by any layer get a persistent dot marker.
   Skip pointer pseudo-keys (Mouse/Scroll) in the keyboard.
3. **theme.ts** — dark/light toggle, localStorage `sd-theme`, sets
   `data-theme` on <html>. Auto-init everywhere.

## Markdown guides (content/guides/*.md)

Front matter:
```markdown
---
title: NixOS maintenance
slug: maintenance
summary: One line for the index card.
order: 1
---
```
Build renders markdown-it (GFM-ish: tables, fenced code) + TOC sidebar.
Code blocks get class `language-x` + copy button? Simple: no copy button.

## Style (src/styles/nord.css)

CSS custom props on `:root[data-theme="dark"]` / `[data-theme="light"]`:

```
nord0  #2e3440  nord1 #3b4252  nord2 #434c5e  nord3 #4c566a
nord4  #d8dee9  nord5 #e5e9f0  nord6 #eceff4
nord7  #8fbcbb  nord8 #88c0d0  nord9 #81a1c1  nord10 #5e81ac
nord11 #bf616a  nord12 #d08770 nord13 #ebcb8b nord14 #a3be8c nord15 #b48ead
```

Dark (default): bg nord0, panel nord1, borders nord2/nord3, text nord4/6,
accent nord8, links nord9, warnings nord13, error nord11.
Light: bg nord6, panel nord5, text nord0/nord3, accent nord10.
Single-column max-width ~1100px layout, sticky header. Tables: hover row
highlight. kbd chips: nord2 bg, rounded, mono font. Font stack: system-ui +
"Iosevka Skiouros", ui-monospace for code (graceful fallback to ui-monospace).

## Build pipeline (src/build.mts)

1. Read `data/keybinds.json` (validate shape; hard-fail on missing keys/label).
2. Render index.html (app cards sorted: niri, waybar, yazi, zsh, zathura,
   fuzzel; each card: icon, title, tagline, binding count, first 3 modifiers;
   footer: generatedAt + sourceCommit).
3. Render apps/<id>.html per DOM contract above.
4. Render guides/*.md → guides/<slug>.html + collect index section.
5. Copy/bundle assets: app.css from src/styles/nord.css; app.js = esbuild
   bundle of src/widgets/main.ts (imports filter, keyboard, theme; each
   auto-inits by body[data-page]).

## Repo scripts

- `npm run build` — bundle widgets + bundle & run build.mts → dist/
- `npm run dev` — build + serve dist/ on http://localhost:4321 (node http,
  ~30 lines, no dep)
- `npm run check` — tsc --noEmit

## CI

`.github/workflows/pages.yml`: on push to `main` — npm ci, npm run build,
upload dist/ via actions/upload-pages-artifact + actions/deploy-pages.
Needs `permissions: pages: write, id-token: write`, environment `github-pages`.

## Updating data (sync flow)

The extractor lives in nixos_config: `scripts/extract-keybinds.mjs` +
`scripts/extract/lib/{keys,parseNiri,parseWaybar,parseYazi,parseZsh}.mjs`.
`just update-docs` there writes `data/keybinds.json` here, commits and pushes.
This repo's CI (`.github/workflows/pages.yml`) rebuilds + deploys on `main`.

## Non-goals

No global cross-app search, no JS framework, no runtime deps, no analytics.
