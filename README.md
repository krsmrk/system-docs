# system-docs

Web-based documentation for my NixOS system: keybinding cheat sheets
(auto-generated from the live configuration in
[`krsmrk/nixos_config`](https://github.com/krsmrk/nixos_config)) plus
hand-written usage guides. Nord-themed, fully static, zero-dependency output.

Live: <https://krsmrk.github.io/system-docs>

## Layout

- `data/keybinds.json` - generated binding data (see `SPEC.md` for the schema).
  Pushed from `nixos_config` via `just update-docs` (which `just switch` runs
  automatically; only real binding changes are committed).
- `content/guides/*.md` - hand-written guides (front matter: title, slug,
  summary, order, optional app / verified / ignore-keys - see `SPEC.md`).
  The build checks every key chord and every nixos_config path a guide
  mentions against the data and the local checkout, and fails on drift.
- `src/` - build script, widgets (per-app filter, ISO/DE keyboard visual,
  landing-page lookup, theme toggle), Nord stylesheet, vendored fonts.
- `scripts/` - build orchestrator + dev server, link checker.
- `dist/` - build output (deployed to GitHub Pages).

## Develop

```sh
npm install
npm run build        # → dist/ (fails on guide drift: unknown chords or paths)
npm run dev          # → http://localhost:4321/system-docs/ (rebuild + serve, 404 page included)
npm run check        # tsc --noEmit
npm run check:links  # internal links + anchors over dist/
```

The path check needs a nixos_config checkout (`~/nixos_config`, or set
`NIXOS_CONFIG`); without one it is skipped with a notice (CI).

## Updating keybinding data

In `nixos_config`: `just update-docs` extracts bindings from the live config
(`~/.config/niri/config.kdl`, `~/.config/yazi/keymap.toml`, `~/.zshrc`,
`~/.config/tmux/tmux.conf`, keyd, waybar and qutebrowser modules) plus the
curated tables (stock defaults, plus the hand-curated Neovim keymap, which is
drift-checked against `~/.config/nvim`) and the manual layer, and pushes an updated
`data/keybinds.json` here. `just switch` runs it after every rebuild. When
only provenance line numbers moved, nothing is written or committed.

See `SPEC.md` for all contracts.
