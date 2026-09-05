---
title: Dev workflow
slug: dev-workflow
summary: devshell templates, direnv, the custom Iosevka build, and Pi extensions.
order: 6
---

## Devshell templates

Five templates live in `/home/stefan/nixos_config/templates/`: **rust, node,
python, go, nix**. Each ships `flake.nix` (pinned devshell + treefmt), `.envrc`
(`use flake`), `.gitignore`, and `.pre-commit-config.yaml`.

```bash
cd myproject
nix flake init -t /home/stefan/nixos_config#rust   # or #node #python #go #nix
direnv allow                                        # .envrc ships with the template
```

direnv (+ nix-direnv) activates the shell on `cd` — tools appear, `cd` away and
they're gone. For an existing repo, `echo "use flake" > .envrc && direnv allow`.
Templates carry the same `nix fmt` / `nix flake check` formatting gate as the
main config. Language versions live per project; the system only has lean
globals (node, uv, gcc, make).

- `direnv` logs are silenced (`DIRENV_LOG_FORMAT=""`).
- `, <cmd>` (comma) runs any nixpkgs package ad hoc, backed by a prebuilt
  nix-index DB — same sources as `nix run nixpkgs#<pkg>`.
- `nix develop`/`nix shell` spawn zsh (nix-your-shell).

## Custom Iosevka font

The session monospace is **Iosevka Skiouros**, built from
`/home/stefan/dev/build-iosevka` (`private-build-plans.toml` defines the
variant). The repo builds in Docker; CI (GitHub Actions, "Add build action" in
its git log) publishes the zip as a release asset on the `font-<version>` tag.
Local build per its README:

```bash
cd ~/dev/build-iosevka
docker build -t iosevka-custom .
docker run --rm -v "$PWD/dist:/usr/src/app/dist" iosevka-custom   # → ./dist/
```

The NixOS config does **not** build the font — it fetches the CI release zip and
unpacks the four core styles (Regular/Bold/Oblique/BoldOblique) in
`modules/nixos/niri.nix` (`iosevkaSkiouros`, currently v34.8.1). `/home/stefan/result`
is a leftover `nix build` symlink pointing at that store path
(`iosevka-skiouros-34.8.1`). To bump the version:

1. update `IOSEVKA_VERSION` (+ hashes) in `~/dev/build-iosevka`, push — CI builds
   and publishes the `font-<version>` tag;
2. update the `url` + `hash` in `modules/nixos/niri.nix` (`nix-prefetch-url`
   prints the hash);
3. rebuild (`just switch`).

`fonts.fontconfig.defaultFonts.monospace` is set to `Iosevka Skiouros`; Nerd
Font glyphs in waybar/fuzzel resolve via fontconfig fallback
(jetbrains-mono Nerd Font).

## Pi agent extensions

`/home/stefan/dev/pi_extensions` holds personal Pi coding-agent extensions,
loaded via a bind mount (`~/.config/phi/resources/extensions/0`) referenced in
`~/.pi/agent/settings.json` — see its `README.md`. After a fresh clone, run
`npm install` once at the repo root (npm workspaces hoist all extension
dependencies into the root `node_modules/`; per-extension dirs don't need their
own).

Pi itself (`pi-coding-agent`) is installed from nixpkgs; config and credentials
stay in `~/.config/phi` with secrets in `pass`. The **phi** wrapper (`~/dev/phi`)
is rebuilt by the flake (input pinned to `git+file:///home/stefan/dev/phi`) —
commit phi changes, then `nix flake update phi` + rebuild (see
[maintenance](./maintenance.html)).

See also: [shell-tricks](./shell-tricks.html) · [maintenance](./maintenance.html).