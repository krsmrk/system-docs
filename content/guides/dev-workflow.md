---
title: Dev workflow
slug: dev-workflow
summary: devshell templates, direnv, the custom Iosevka build, Pi extensions, and Claude Code.
order: 9
verified: 0bd451a
---

## Devshell templates

Five templates live in `~/nixos_config/templates/`: **rust, node,
python, go, nix**. Each ships `flake.nix` (pinned devshell + treefmt), `.envrc`
(`use flake`), `.gitignore`, and `.pre-commit-config.yaml`.

```bash
cd myproject
nix flake init -t ~/nixos_config#rust   # or #node #python #go #nix
direnv allow                             # .envrc ships with the template
```

direnv (+ nix-direnv) activates the shell on `cd` - tools appear, `cd` away and
they're gone. For an existing repo, `echo "use flake" > .envrc && direnv allow`.
Templates carry the same `nix fmt` / `nix flake check` formatting gate as the
main config. Language versions live per project; the system only has lean
globals (node, uv, gcc, make).

- `direnv` logs are silenced (`DIRENV_LOG_FORMAT=""`).
- `, <cmd>` (comma) runs any nixpkgs package ad hoc, backed by a prebuilt
  nix-index DB - same sources as `nix run nixpkgs#<pkg>`.
- `nix develop`/`nix shell` spawn zsh (nix-your-shell).

## Custom Iosevka font

The session monospace is **Iosevka Skiouros**, built from
`~/dev/build-iosevka` (`private-build-plans.toml` defines the variant). The
repo builds in Docker; its GitHub Actions workflow publishes the zip as a
release asset on the `font-<version>` tag. Local build per its README:

```bash
cd ~/dev/build-iosevka
docker build -t iosevka-custom .
docker run --rm -v "$PWD/dist:/usr/src/app/dist" iosevka-custom   # → ./dist/
```

The NixOS config does **not** build the font - it fetches the CI release zip and
unpacks the four core styles (Regular/Bold/Oblique/BoldOblique) in
`modules/nixos/niri.nix` (`iosevkaSkiouros`, currently v34.8.1). To bump the
version:

1. update `IOSEVKA_VERSION` (+ hashes) in `~/dev/build-iosevka`, push - CI builds
   and publishes the `font-<version>` tag;
2. update the `url` + `hash` in `modules/nixos/niri.nix` (`nix-prefetch-url`
   prints the hash);
3. rebuild (`just switch`).

`fonts.fontconfig.defaultFonts.monospace` is set to `Iosevka Skiouros`; Nerd
Font glyphs in waybar/fuzzel resolve via fontconfig fallback
(jetbrains-mono Nerd Font).

## Pi agent extensions

`~/dev/pi_extensions` holds personal Pi coding-agent extensions,
loaded via a bind mount (`~/.config/phi/resources/extensions/0`) referenced in
`~/.pi/agent/settings.json` - see its `README.md`. After a fresh clone, run
`npm install` once at the repo root (npm workspaces hoist all extension
dependencies into the root `node_modules/`; per-extension dirs don't need their
own).

Pi itself (`pi-coding-agent`) is installed from nixpkgs; config and credentials
stay in `~/.config/phi` with secrets in `pass` (how that store works:
[ssh-secrets](./ssh-secrets.html)). The **phi** wrapper (`~/dev/phi`) is
rebuilt by the flake (a `git+file://` input pinned to that local checkout):
commit phi changes, then `nix flake update phi` + rebuild (see
[maintenance](./maintenance.html)).

## Claude Code

`claude` comes from nixpkgs through the home-manager module
(`modules/home/claude-code.nix`, `programs.claude-code.enable`): the official
native build, wrapped by the package so its helpers (ripgrep, procps,
bubblewrap, socat, alsa-lib) are on its path.

- **Self-update is off, on purpose.** The store is read-only, so the updater
  could not replace the binary anyway, and the wrapper is load-bearing: a
  binary that swapped itself out would lose the helpers and break the
  sandbox. The package sets `DISABLE_AUTOUPDATER` and
  `DISABLE_INSTALLATION_CHECKS`, so ignore any "update available" nudge.
- **Updates arrive with the system.** `just update` bumps nixpkgs,
  claude-code rides along, and `just switch` installs it; a bad version rolls
  back with the generation like everything else
  ([maintenance](./maintenance.html)).
- **`~/.claude` is yours.** The home-manager module could manage settings,
  agents, commands, skills and MCP servers declaratively, but that turns
  `settings.json` and friends into read-only store symlinks and breaks
  Claude's own interactive writes (theme, `claude config set`, onboarding).
  It is deliberately left user-writable; `claude config` edits stick.
- **SSH from the agent** goes through `agent-ssh`, the identity that always
  asks a human first - see [ssh-secrets](./ssh-secrets.html).

See also: [shell-tricks](./shell-tricks.html) · [maintenance](./maintenance.html) ·
[ssh-secrets](./ssh-secrets.html).