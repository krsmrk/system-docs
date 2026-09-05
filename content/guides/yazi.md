---
title: yazi — terminal file manager
slug: yazi
summary: vim-key file manager with Nord flavor, rich previews, and one custom key.
order: 4
---

## Launching

Start it with `y` from any terminal (ghostty, `Mod+Return`). `y` is a wrapper
function in `~/.zshrc`: on quit, the shell `cd`s to the directory yazi exited in —
the plain `yazi` command opens the same UI but leaves your shell where it was.
`q` quits; `Q` quits without the cd-on-exit.

## Config layout

| file | owned by | role |
|---|---|---|
| `~/.config/yazi/yazi.toml` | yadm | manager options: natural sort, dirs first, size linemode, preview wrap, openers |
| `~/.config/yazi/keymap.toml` | yadm | one addition on stock defaults (see below) |
| `~/.config/yazi/theme.toml` + `flavors/` | home-manager | Nord flavor (`modules/home/yazi.nix`, `pkgs.yaziPlugins.nord`) |
| `~/.config/yazi/plugins/` | home-manager | preview plugins + `extract-here.yazi` |

The flavor is set via `theme.flavor.dark = "nord"` (the `flavor.use` key was
removed upstream — setting it silently loads nothing). Icon colors are a
regenerated Nord-mapped icon set, built by
`modules/home/icons-nord-gen.py` → `icons-nord.toml`.

## The one custom key: `E`

yazi's builtin extract plugin is only reachable programmatically, so
`plugins/extract-here.yazi` bridges it. Hover or select an archive and press:

- `E` — extract archive here

That's the entire keymap addition (`prepend_keymap` in
`~/.config/yazi/keymap.toml`); everything else is stock v26 behavior.

## Stock navigation cheat sheet

| keys | action |
|---|---|
| `h` / `l` | parent dir / enter dir (also opens files) |
| `j` / `k` | cursor down / up |
| `gg` / `G` | top / bottom of listing |
| `H` / `L` | directory history back / forward |
| `Space` | toggle selection · `v` visual (select) mode |
| `y` / `x` / `p` / `P` | yank (copy) / cut / paste / paste-overwrite |
| `d` / `D` | trash / delete permanently |
| `a` / `A` | create file (trailing `/` = dir) / bulk create |
| `r` | rename (bulk rename when multiple files are selected — opens `$EDITOR` with the names) |
| `o` / `O` | open selected / open interactively |
| `/`, `n`, `N` | find by name, next/previous match (`?` = previous) |
| `s` / `S` | search filenames (fd) / search content (ripgrep) |
| `f` | filter the view live |
| `z` / `Z` | jump via fzf / zoxide |
| `.` | toggle hidden files |
| `t t` / `1–9` / `[` `]` | new tab / switch tab / previous/next tab |
| `w` | task manager (watch/cancel running ops) |
| `K` / `J` | scroll the preview pane |
| `;` / `:` | shell command (async / blocking) |
| `~` | help — the full stock keymap |

Selection + `r` is the bulk-rename flow: edit the list in your editor, save, yazi
applies the renames.

## Previews & openers

Preview plugins (home-manager wired): glow (markdown), piper (docx/odt/epub via
pandoc), rich-preview (rst/ipynb), miller (csv/tsv), duckdb (parquet/xlsx/db),
mediainfo (audio/subtitles), lsar (rar), allmytoes (XDG thumbnails), mime-ext
(extension fallback). PDF/HEIC/SVG/fonts preview via yazi's built-ins.

Opening files (`Enter` / `o`) routes by mime: documents → **zathura** (pdf, epub,
cbz/cbr, djvu), images → loupe, media → mpv. The same defaults are set
system-wide via `xdg.mimeApps` (`modules/home/zathura.nix`), so `xdg-open` and
yazi agree.

See also: [shell-tricks](./shell-tricks.html) for the `y` wrapper and shell
aliases · [screenshots-clipboard](./screenshots-clipboard.html).