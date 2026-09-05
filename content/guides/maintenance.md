---
title: NixOS maintenance
slug: maintenance
summary: switch, update, rollback - the daily driver commands.
order: 1
---

Everything lives in the flake at `/home/stefan/nixos_config`. `just` runs from
anywhere (`j` / `j --list` are aliased in zsh).

## justfile recipes (`~/nixos_config/justfile`)

| recipe | does |
|---|---|
| `just build` | build a generation without activating (nom output via `nh`) |
| `just switch` | activate now **and** make it the boot default - the everyday rebuild |
| `just test` | activate now, bootloader untouched - reboot reverts it; `just switch` promotes |
| `just diff` | `nvd diff /run/current-system ./result` - what the last `just build` would change |
| `just update` | `nix flake update` - refresh all inputs (home-manager follows nixpkgs) |
| `just update-input phi` | refresh one input only (commit `~/dev/phi` first) |
| `just gc` | store garbage-collect + optimise (`nh clean all`) |
| `just fmt` | treefmt over the repo (nix + shell) |
| `just check` | full gate: fmt + shellcheck of wrappers + eval/build of the toplevel |
| `just rollback` | roll back to the previous generation, set as boot default |
| `just update-docs` | extract keybindings from the live config and push them to [system-docs](https://github.com/krsmrk/system-docs) (this site) |

Bare `nh os switch` also works from any directory (`NH_FLAKE` is set system-wide),
same for `nh os build`, `nh os test`, `nh os rollback`. The classic spelling is
`sudo nixos-rebuild switch --flake /home/stefan/nixos_config#box` - that is exactly
what the sysmenu rebuild entry runs.

**Flakes only see git-tracked files** - `git add` new/renamed files *before* rebuilding.

## Automatic updates (auto-upgrade.nix)

`system.autoUpgrade` runs **Mon–Fri at 12:00 ±30 min** (fixed offset, so the minute
stays constant). With `operation = "boot"` it only *stages* a generation: it refreshes
the `nixpkgs` input, builds, and flips the boot entry - nothing running is touched,
no service restarts, no reboot. The staged generation activates on your next reboot.
A missed slot (machine off) fires right after the next boot (`persistent = true`).

Two guards make it meeting-safe:

- **WIP guard**: the flake is referenced by path, so the midday build compiles the
  working tree. An `ExecStartPre` refuses to run while any tracked file except
  `flake.lock` differs from HEAD - the run fails and toasts instead of staging WIP.
- **Stage-only**: nothing running is touched, so a build can never restart services
  under you. Manual rebuilds (`nh`, sysmenu) are not guarded.

The refreshed `flake.lock` is left **uncommitted** after each run - commit it with
your normal flow. `phi` and `nix-flatpak` inputs stay pinned; they only move on a
manual `nix flake update <input>`. Meeting in 5 minutes?
`sudo systemctl stop nixos-upgrade.timer` (restart it afterwards).

## What the notifications mean (update-notify.nix)

- **"NixOS update staged - Reboot when convenient"**: a boot-staged generation is
  waiting; rebooting activates it. One toast per generation, deduped in `~/.cache`.
- **"NixOS kernel updated - Reboot to load the new kernel"**: you already ran a
  manual `switch`, but the kernel/modules changed - the one thing a switch cannot
  swap live.
- **"Firmware updates available"**: fwupd metadata refreshed; apply via sysmenu →
  Firmware, or `fwupdmgr update`.
- **"NixOS auto-upgrade FAILED"** (critical): offline, eval error, or WIP-guard
  refusal. Read it with `journalctl -u nixos-upgrade.service` or sysmenu →
  "Upgrade timer & journal". Failures while logged out are re-toasted at the next
  session start.

Audit commands (also in sysmenu, `Mod+Shift+U`):

```bash
systemctl list-timers nixos-upgrade.timer    # next/last trigger
journalctl -u nixos-upgrade.service          # what it did / build log
nvd diff /run/booted-system /nix/var/nix/profiles/system   # staged delta
bootctl list                                 # generations on disk
```

## Diffs

```bash
nvd diff /run/current-system ./result                          # after just build
nvd diff /run/booted-system /nix/var/nix/profiles/system       # what the next boot gets
nix profile diff-closures --profile /nix/var/nix/profiles/system  # closure sizes per gen (gen-diff alias)
```

## Rollbacks

Pick the previous generation in the systemd-boot menu (entries are kept up to
`configurationLimit = 15`; the boot-menu **editor is disabled** on box - you can
select an entry, not edit its cmdline), or from a running system:

```bash
just rollback                                # nh os rollback
sudo nixos-rebuild switch --rollback         # same, classic spelling
```

## When a build fails

| symptom | do this |
|---|---|
| eval error | fix the nix, then `nix flake check` - it evals + builds the toplevel |
| new file not picked up | flakes only see tracked files: `git add` it |
| auto-upgrade failed with a WIP list | commit or revert those files, or run a manual rebuild if the tree is meant to go live |
| offline at 12:00 | nothing to do - the missed slot catches up after the next boot |
| flake.lock dirty after an auto-run | expected; commit it |

Firmware is a separate layer: metadata refreshes hourly, applying stays manual
(`fwupdmgr update`, or sysmenu → Firmware).

See also: [troubleshooting](./troubleshooting.html) · the niri app page
([../apps/niri.html](../apps/niri.html)) for sysmenu access via `Mod+Shift+U`.