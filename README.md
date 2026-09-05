# system-docs

Web-based documentation for my NixOS system: keybinding cheat sheets
(auto-generated from the live configuration in
[`krsmrk/nixos_config`](https://github.com/krsmrk/nixos_config)) plus
hand-written usage guides. Nord-themed, fully static, zero-dependency output.

Live: <https://krsmrk.github.io/system-docs>

## Layout

- `data/keybinds.json` — generated binding data (see `SPEC.md` for the schema).
  Pushed from `nixos_config` via `just update-docs`.
- `content/guides/*.md` — hand-written guides (front matter: title, slug,
  summary, order).
- `src/` — build script, widgets (per-app filter, ISO/DE keyboard visual,
  theme toggle), Nord stylesheet.
- `dist/` — build output (deployed to GitHub Pages).

## Develop

```sh
npm install
npm run build   # → dist/
npm run dev     # → http://localhost:4321 (rebuild + serve)
npm run check   # tsc --noEmit
```

## Updating keybinding data

In `nixos_config`: `just update-docs` extracts bindings from the live config
(`~/.config/niri/config.kdl`, `~/.config/yazi/keymap.toml`, `~/.zshrc`,
waybar module) and pushes an updated `data/keybinds.json` here.

See `SPEC.md` for all contracts.
