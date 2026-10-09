---
title: Dev workflow
slug: dev-workflow
summary: devshell templates, direnv, Iosevka build, Pi extensions, Claude Code
order: 9
verified: 0bd451a
---

## Devshell templates

`~/nixos_config/templates/` has templates for rust, node, python, go and nix.
Each contains `flake.nix` (pinned devshell + treefmt), `.envrc` (`use flake`),
`.gitignore` and `.pre-commit-config.yaml`.

```bash
cd myproject
nix flake init -t ~/nixos_config#rust   # or #node #python #go #nix
direnv allow
```

direnv with nix-direnv loads the devshell on `cd` into the project and unloads
it on leaving. For an existing repo: `echo "use flake" > .envrc && direnv allow`.
Templates use the same `nix fmt` / `nix flake check` formatting gate as the
system config. Language versions are pinned per project; the system has only
a few global tools (node, uv, gcc, make).

- direnv logging is off (`DIRENV_LOG_FORMAT=""`).
- `, <cmd>` (comma) runs any nixpkgs package without installing it, using a
  prebuilt nix-index database; same packages as `nix run nixpkgs#<pkg>`.
- `nix develop` and `nix shell` start zsh (nix-your-shell).

## Iosevka font

The system monospace font is **Iosevka Skiouros**, a custom build from
`~/dev/build-iosevka` (`private-build-plans.toml` defines the variant). The
repo builds in Docker; its GitHub Actions workflow publishes the zip as a
release asset on the `font-<version>` tag. To build locally (per its README):

```bash
cd ~/dev/build-iosevka
docker build -t iosevka-custom .
docker run --rm -v "$PWD/dist:/usr/src/app/dist" iosevka-custom   # → ./dist/
```

The NixOS config does not build the font. `iosevkaSkiouros` in
`modules/nixos/niri.nix` fetches the CI release zip (currently v34.8.1) and
installs the Regular, Bold, Oblique and BoldOblique styles. To update:

1. Update `IOSEVKA_VERSION` and the hashes in `~/dev/build-iosevka` and push.
   CI builds and publishes the `font-<version>` tag.
2. Update `url` and `hash` in `modules/nixos/niri.nix` (`nix-prefetch-url`
   prints the hash).
3. Rebuild (`just switch`).

`fonts.fontconfig.defaultFonts.monospace` is `Iosevka Skiouros`. Nerd Font
glyphs in waybar and fuzzel come from the jetbrains-mono Nerd Font through
fontconfig fallback.

## Pi agent extensions

`~/dev/pi_extensions` holds personal extensions for the Pi coding agent. They
are loaded through a bind mount (`~/.config/phi/resources/extensions/0`)
referenced in `~/.pi/agent/settings.json`; see the repo's `README.md`. After
cloning, run `npm install` once at the repo root. npm workspaces install all
extension dependencies into the root `node_modules/`.

Pi (`pi-coding-agent`) comes from nixpkgs. Its config and credentials are in
`~/.config/phi`, with secrets in `pass` (see [ssh-secrets](./ssh-secrets.html)).
The **phi** wrapper (`~/dev/phi`) is a flake input (`git+file://`, pinned to
the local checkout). To deploy phi changes, commit them, then run
`nix flake update phi` and rebuild (see [maintenance](./maintenance.html)).

## Claude Code

`claude` comes from nixpkgs through the home-manager module
(`modules/home/claude-code.nix`, `programs.claude-code.enable`). It is the
official native build, wrapped so its helpers (ripgrep, procps, bubblewrap,
socat, alsa-lib) are on its path.

- **Self-update** is disabled. The Nix store is read-only, and a binary that
  replaced itself would lose the wrapper's helpers and break the sandbox. The
  package sets `DISABLE_AUTOUPDATER` and `DISABLE_INSTALLATION_CHECKS`; ignore
  any "update available" message.
- **Updates** come with system updates: `just update` bumps nixpkgs and
  `just switch` installs the new claude-code. Roll back a bad version with the
  generation ([maintenance](./maintenance.html)).
- **`~/.claude`** is not managed by home-manager. The module can manage
  settings, agents, commands, skills and MCP servers. That would replace
  `settings.json` and the other files with read-only store symlinks, which
  breaks Claude's own writes (theme, `claude config set`, onboarding).
  Changes you make with `claude config` persist.
- **SSH** from the agent uses `agent-ssh`, which requires you to approve and
  enter a passphrase (see [ssh-secrets](./ssh-secrets.html)).

See also: [shell-tricks](./shell-tricks.html) · [maintenance](./maintenance.html) ·
[ssh-secrets](./ssh-secrets.html).
