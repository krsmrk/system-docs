# system-docs - SPEC (binding contracts for all tasks)

Web-based documentation for Stefan's NixOS system ("box"). Fully custom static
site: **keybindings generated from live config** + hand-written usage guides.
Nord theme. Hosted on GitHub Pages (`krsmrk.github.io/system-docs`), and the
qutebrowser start page, so the landing page doubles as a lookup tool.

One manual is shared by all hosts: the keybind data comes from whichever host
runs `just update-docs` (`meta.host`), the guides describe the shared config.

## Tech

- TypeScript + esbuild + markdown-it. No other runtime deps. No framework.
- Build: `npm run build` → `dist/` (pure static HTML/CSS/JS).
- Pages: `dist/index.html`, `dist/apps/<id>.html`, `dist/guides/<slug>.html`,
  `dist/404.html`, `dist/assets/app.css`, `dist/assets/app.js` (one bundle,
  auto-inits per page), `dist/assets/bindings.json` (compact search index).
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
          "description": "Optional crafted prose: one to three sentences of design intent, rendered under the group heading.",
          "bindings": [
            {
              "keys": "Mod+H",                       // normalized, see below
              "label": "Focus column left (wraps)",  // human description
              "command": "focus-column-left-or-last", // optional: raw action
              "source": "config.kdl:158",           // optional: provenance
              "custom": true                         // optional: origin flag —
            }                                     // true = bound in this config,
          ]                                       // absent = stock default
        }
      ]
    }
  ]
}
```

There is NO custom/stock separation in group names - sections are purely
thematic. Origin is a row-level fact: binds parsed from the live config
carry `"custom": true` and render with an accent border on their key chips;
curated stock rows are plain-bordered;
unmarked. App pages show an origin legend under the description.

### Key normalization contract

Note: kbd chips render `+` separators as `<span class="kb-plus">+</span>` and
chord steps separated by `<span class="kb-seq"> </span>`.

- Modifiers, in this order: `Mod`, `Ctrl`, `Alt`, `Shift`. (niri `Mod` = Super.)
- Then the key token: letters uppercased (`H`), named keys TitleCase
  (`Return`, `Left`, `BracketLeft`, `Print`, `Minus`, `Escape`, `Space`,
  `Tab`, `XF86AudioRaiseVolume`).
- Joined with `+`, no spaces: `Mod+Shift+BracketLeft`.
- zsh: `^R` → `Ctrl+R`; `^[f` (Meta) → `Alt+f`; `^[^[` → `Ctrl+Alt+Escape`;
  `^Xb` → `Ctrl+X b` (two-step: keep space-separated tail; still normalized mods).
- Character-keyed apps (zsh, tmux) keep letter case: vicmd `v` is not `V`,
  `Alt+q` (`^[q`) is not `Alt+Q`. Only Ctrl combos uppercase, because control
  characters are caseless (`^r` = `^R`). niri/XKB-style apps uppercase letters.
- Pointer/wheel pseudo-keys: `Mouse Left Click`, `Mouse Right Click`,
  `Mouse Down`, `Mouse Drag`, `Mouse Up`, `Mouse Double Click`,
  `Mouse Triple Click`, `Scroll Up`, `Scroll Down`, `Wheel Up`,
  `Wheel Down`, `Forward`, `Back` - used by waybar (clicks) and the tmux
  copy-mode mouse binds. Multi-word keys render as chip sequences; the
  keyboard widget skips them.
- keyd rows are physical-key remaps, not chords: `keys` names the physical key
  as a single token (`CapsLock`, `LeftCtrl`); `[global]` settings surface one
  row each with a PascalCase token (`OverloadTapTimeout`) and the live value
  riding in `command`.
- Every binding MUST have `keys` and `label`. `keys` may be `""` only for
  prose-only rows; widgets must tolerate that.

## Apps covered (ids)

Extracted from live config / repo modules: `keyd` (evdev remap layer - defines
what Ctrl/Esc physically are; parsed from `~/.config/keyd/default.conf`),
`niri` (binds, media keys),
`waybar` (click/scroll, module file), `qutebrowser` (custom binds parsed
from `modules/home/qutebrowser.nix` keyBindings — NOT the generated
config.py, which goes stale between a change and the next switch),
`yazi` (custom keymap), `zsh` (vi-mode bindkeys; the fzf / fzf-git.sh
integration binds ride a curated `zsh.json` overlay as stock rows), `tmux`
(config + stock tables).
Curated stock defaults (files in `nixos_config/scripts/extract/curated/*.json`,
merged by the extractor) - thematically grouped with prose descriptions,
verified against authoritative sources:
`yazi` (all eight upstream modes, case-exact, from keymap-default.toml),
`zathura` (from upstream config.c, incl. index mode), `fuzzel`,
`ghostty` (verified with `ghostty +list-keybinds`; its custom F11 rides a
curated overlay), `tmux` stock tables (verified against a pristine
`tmux -f /dev/null list-keys`, incl. copy-mode mouse binds),
`qutebrowser` full stock reference (all modes, from the 3.7.0
`bindings.default` section).

### qutebrowser keychain spelling (documented deviation)

qutebrowser chains keep the exact qutebrowser spelling instead of
normalizing letters: `yy`, `gC`, `;b`, `tsh` are single chips, because case
IS the binding (`yy` ≠ `yY`, `o` ≠ `O`) and the keyboard widget skips
multi-key sequences anyway. Only `<tag>` keys are normalized
(`<Ctrl-T>` → `Ctrl+T`, `<back>` → `Mouse Back` pseudo-key).

## DOM contracts (build emits this; widgets consume it)

```html
<!-- app page -->
<body data-page="app" data-app="niri">
  <input class="kb-filter" type="search" placeholder="Filter bindings…" aria-label="Filter bindings">
  <div class="kb-keyboard"></div>            <!-- keyboard widget mounts here -->
  <section class="kb-group">
    <h3>Focus & movement <span class="group-count">19</span></h3>
    <p class="group-desc">Optional crafted prose under the heading.</p>
    <table class="kb-table"><tbody>
      <tr class="kb-row custom" id="k-mod-h" data-keys="Mod+H">  <!-- .custom = bound in this config -->
      <td class="kb-keys"><kbd><span class="mod">Mod</span>+<span class="key">H</span></kbd></td>   <!-- .custom rows: kbd border = accent -->
      <td class="kb-label">Focus column left (wraps)</td>
      <td class="kb-command"><code>focus-column-left-or-last</code></td>
      <td class="kb-source"><span title="…">config.kdl:158</span></td>  <!-- repo paths link to the GitHub blob @ sourceCommit -->
      </tr>
    </tbody></table>
  </section>
  <script type="application/json" id="app-data"> { ...this app object... } </script>
```

- Row anchors: every `.kb-row` carries `id="k-<keys slug>"` (first
  occurrence of a keys string wins the bare id, repeats get `-2`, `-3`…), so
  guides and the landing-page lookup can deep-link a bind; `:target` rows are
  highlighted. `.kb-source` shows `file:line` as text; sources under
  `modules/`, `hosts/`, `scripts/`… link to the GitHub blob at
  `meta.sourceCommit`, generated/yadm files get a title hint. Hidden ≤760px.
- Landing page: `body[data-page="index"]`, hero with site stats
  (`.hero-stats`: bindings/apps/guides/data-date chips), `.site-search` with
  `input.kb-search` + `.sr-list` (search widget mounts here), grid of
  `.app-card` elements (icon, title, tagline, count + custom/stock split),
  plus a guide list with per-guide `.g-date`.
- Guide pages: `body[data-page="guide"]`, `<article>` + `<nav class="toc">`
  built from h2/h3 headings at build time; `.guide-meta` under the h1 shows
  the last git commit date, the reviewed-against commit and the related app;
  checked key references render as `<a class="kb-ref" href="../apps/<id>.html#k-…"><code>…</code></a>`.
- App-page extras (round-2): `.kb-toc` chip row links to section ids
  `#g-0..n`; `h3` shows `.group-count`; rows carry `data-cmd` (lowercased
  command) for command search; app headers show icon + `.chip-link` guide chip;
  `.origin-legend` under the description states the page's custom/stock mix
  (custom rows' kbd chips get an accent border; stock rows stay plain).
- All pages share one sticky header: site title "box manual", nav
  links (Overview, Guides; active one gets `aria-current="page"`), Nord theme
  toggle (dark/light, persists localStorage, default dark, respects
  prefers-color-scheme; an inline `<script>` in `<head>` applies the stored
  or OS theme before the stylesheet loads, so there is no dark flash);
  skip-link; footer has ↑ top link (JS smooth-scroll;
  the bare `#top` anchor is a silent no-op on a second click once the hash
  is already set, so main.ts intercepts it). `@media print`
  forces a light ink-saving palette and hides interactive chrome.
- `404.html` is served by GitHub Pages at ANY missing URL, so it is the one
  page built with the absolute Pages base (`/system-docs/…`) instead of a
  relative `rel`; `scripts/check-links.mjs` enforces that split.

## Themes & assets

Fonts are vendored woff2 in `src/assets/fonts/` (Roboto Condensed + JetBrains
Mono variable, latin subsets, originally from @fontsource-variable/* - no npm
package involved) with local "Iosevka Skiouros" preferred for mono when
installed. App icons are consistent inline SVG (24px stroke,
currentColor) defined in build.mts, with the data `icon` glyph as fallback.

## Widgets (src/widgets/, bundled to assets/app.js)

1. **filter.ts** - on `body[data-page="app"]`: attach to `.kb-filter`.
   Fuzzy match (subsequence, case-insensitive, rank by tightness) over each
   `.kb-row`'s keys+label+command+group. Live-filter on input: hide
   non-matching rows, hide groups with no visible rows, show "N bindings" /
   "X of N" counter (singular-aware) next to input. Matched chars in labels
   are wrapped in `<mark>`. Query round-trips through `?q=` (replaceState),
   so filtered views are shareable. Keyboard: `/` focuses input (unless
   already in an input), `Esc` clears+blurs. Empty state when 0 matches.
2. **keyboard.ts** - on `body[data-page="app"]`: render ISO/DE keyboard
   (105-key, backslash/pipe key between Left-Shift and Z, big Enter) as a
   <div> grid. Layer chips above it derived from modifier combos present in
   the app's bindings (e.g. `none`, `Mod`, `Mod+Shift`, `Ctrl`, `Mod+Ctrl`).
   Selecting a layer highlights bound keys (accent fill) and keeps the
   physical modifier keycaps of that layer pressed down (`.held`: inset,
   accent border). Keys press on hover and deeper on mouse-down. Chips show
   per-layer binding counts (`Mod 41`). Hovering a highlighted key shows a
   tooltip with label(s). Clicking a key scrolls to & flashes the first
   matching `.kb-row`. Keys used by any layer get a persistent dot marker.
   Skip pointer pseudo-keys (Mouse/Scroll) in the keyboard.
3. **theme.ts** - dark/light toggle, localStorage `sd-theme`, sets
   `data-theme` on <html>. Auto-init everywhere.
4. **search.ts** - on `body[data-page="index"]`: cross-app lookup over
   `assets/bindings.json` (fetched on first focus/keystroke). A query that
   parses as a chord (`ctrl+r`, `Mod+Shift+N`, `Scroll Up`) lists exact key
   matches ordered by layer (keyd → niri → waybar → tmux → zsh → the app),
   i.e. in the order the layers see the key; any other query is ranked fuzzy
   search over keys+label+command+app+group. Results link to `apps/<id>.html#k-…`.
   `/` focuses, Esc clears, Enter opens the first hit, `?q=` round-trips.

## Markdown guides (content/guides/*.md)

Front matter:
```markdown
---
title: NixOS maintenance
slug: maintenance
summary: One line for the index card.
order: 1
app: niri                 # optional: related app id; key refs resolve here first
verified: bbf9656         # optional: nixos_config commit the prose was reviewed against
ignore-keys: Ctrl+Alt+F2  # optional: chords exempt from the key check (not binds)
---
```
Build renders markdown-it (GFM-ish: tables, fenced code) + TOC sidebar. Each
guide page shows its last git commit date (CI checks out full history for
this), the `verified` commit and the related app. No copy buttons.

### Guide reference checks (build-time, hard failures)

Guides are prose, so nothing stops them drifting from the config. The build
therefore treats them like the manual layer treats binds:

- every `app:` on a guide and every `guide:` on an app must exist;
- every code span that looks like a chord (`Mod+H`, `Ctrl+Space c`,
  `Scroll Up`; shorthand like `Mod+H/L` or `Mod+1…9` is skipped) must be a
  bind in `data/keybinds.json`. Spellings are normalized the way the data is
  (`Mod+[` → `Mod+BracketLeft`, `Alt+c` ↔ `Alt+C` case fallback, raw
  spelling for tmux punctuation). A unique hit is rendered as a link to the
  row; a miss fails the build unless the chord is listed under `ignore-keys:`;
- every nixos_config path in a code span or GitHub blob link
  (`modules/…`, `hosts/…`, `scripts/…`, `templates/…`, `home/…`, `lib/…`,
  `flake.nix`, `justfile`, `README.md`) must exist in the local checkout
  (`$NIXOS_CONFIG`, default `~/nixos_config`). Without a checkout - CI, the
  repo is private - this check is skipped with a notice.

`scripts/check-links.mjs` (`npm run check:links`, also in CI) then verifies
every internal href/anchor of the built site.

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
2. Load guides, cross-check app↔guide links, key references and repo paths
   (section above) - any problem is fatal.
3. Render index.html (app cards in APP_ORDER: keyd, niri, waybar,
   qutebrowser, fuzzel, ghostty, tmux, yazi, zathura, zsh; each card: icon,
   title, tagline, binding count, custom/stock split; footer: sourceCommit
   linked + data date).
4. Render apps/<id>.html per DOM contract above.
5. Render guides/*.md → guides/<slug>.html + collect index section.
6. Render 404.html with the absolute Pages base; write assets/bindings.json.
7. Copy/bundle assets: app.css from src/styles/nord.css; app.js = esbuild
   bundle of src/widgets/main.ts (imports filter, keyboard, search, theme;
   each auto-inits by body[data-page]); favicon + vendored fonts.

## Repo scripts

- `npm run build` - bundle widgets + bundle & run build.mts → dist/
- `npm run dev` - build + serve dist/ on http://localhost:4321/system-docs/
  (node http, no dep). Mirrors Pages: the bare prefix redirects, any missing
  path gets 404.html with a real 404 status.
- `npm run check` - tsc --noEmit
- `npm run check:links` - internal link/anchor check over dist/

## CI

`.github/workflows/pages.yml`: on push to `main` - checkout with
`fetch-depth: 0` (guide dates), npm ci, check, build, check:links, upload
dist/ via actions/upload-pages-artifact + actions/deploy-pages.
Needs `permissions: pages: write, id-token: write`, environment `github-pages`.

## Updating data (sync flow)

The extractor lives in nixos_config: `scripts/extract-keybinds.mjs` +
`scripts/extract/lib/{keys,parseKeyd,parseNiri,parseWaybar,parseYazi,parseZsh,parseTmux}.mjs`.
`just update-docs` there writes `data/keybinds.json` here, commits and pushes;
`just switch` runs it automatically after every rebuild (non-fatal). The
extractor leaves the file untouched when nothing but `meta` and provenance
line numbers changed, so unrelated config edits never churn this repo - the
footer's commit means "the bindings are as of this commit", not "the newest
commit". This repo's CI (`.github/workflows/pages.yml`) rebuilds + deploys on
`main`.

### Manual layer (crafted content over mechanical truth)

Extraction only produces truth: keys, commands, provenance, origin. Everything
a human reads - group taxonomy and order, labels, group prose, app blurbs -
lives in agent-crafted `nixos_config/scripts/extract/manual/<id>.json`, applied
by the extractor as a merge pass over the FULL pool (custom parses + curated
stock rows), with a two-way drift contract:

- a bind (custom or stock) no manual entry covers → sync fails (curate it)
- a manual entry no bind matches                 → sync fails (remove it)
- same keys, different commands                  → sync fails (disambiguate
  with `commandContains`; custom rows win over stock rows when keys collide)

Manual entries: `{keys, label?, commandContains?, drop?}` (label may be
omitted - falls back to the source label, e.g. for stock rows) or
`{ref: "<source group name>"}` to fold a whole curated stock group into a
thematic section in order. `drop: true` claims a row without showing it
(stock binds that a custom bind shadows identically). Apps without a manual
file pass their parsed/curated groups through untouched.

So the published tables are exactly as current as the last `just update-docs`.

### Light-theme tokens (strict Nord)

`--bg` nord5, `--bg-panel` nord6, `--bg-raised`/`--border` nord4,
`--fg` nord0, `--fg-dim` nord3, fill accent nord10 (`--accent`) with
`--on-accent` nord6 text, `--accent-2` nord9, `--link` nord10. Keyboard:
page nord5 → card nord6 → `.kb-board` island `--kbd-island`
(color-mix nord3 18% + nord4) → caps `--kbd-bg` nord6 with `--kbd-edge`
ridge; modifier text `--kbd-mod` nord10. Aurora `warn/error/ok/purple` kept
pure; only `--border-strong`/ridges/island are color-mix derived.

## Non-goals

No JS framework, no runtime deps, no analytics. The landing-page lookup is the
only cross-app search; app pages keep their own per-page filter.
