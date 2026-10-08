---
title: NixOS maintenance
slug: maintenance
summary: rebuild, update, rollback, automatic upgrades
order: 1
verified: 0bd451a
---

The system config is the flake at `~/nixos_config`. Run recipes from inside
that directory; zsh aliases `just` to `j` (`j --list` lists recipes).

## justfile recipes (`~/nixos_config/justfile`)

| recipe | does |
|---|---|
| `just build` | build a generation without activating it (nom output via `nh`) |
| `just switch` | activate and set as boot default; the everyday rebuild |
| `just test` | activate without touching the bootloader; a reboot reverts it, `just switch` keeps it |
| `just diff` | `nvd diff /run/current-system ./result`: changes in the last `just build` |
| `just update` | `nix flake update`: refresh all inputs (home-manager follows nixpkgs) |
| `just update-input phi` | refresh one input (commit `~/dev/phi` first) |
| `just gc` | garbage-collect and optimise the store (`nh clean all`) |
| `just fmt` | run treefmt over the repo (nix + shell) |
| `just check` | treefmt, shellcheck of the wrappers, eval and build of the toplevel |
| `just rollback` | switch to the previous generation and set it as boot default |
| `just update-docs` | extract keybindings from the live config and push them to [system-docs](https://github.com/krsmrk/system-docs) |

`NH_FLAKE` is set system-wide, so `nh os switch`, `nh os build`, `nh os test`
and `nh os rollback` also work from any directory. The sysmenu rebuild entry
runs `sudo nixos-rebuild switch --flake ~/nixos_config#box`.

Flakes only see git-tracked files: `git add` new or renamed files before
rebuilding.

## Automatic updates (auto-upgrade.nix)

`system.autoUpgrade` runs Mon–Fri between 12:00 and 12:30. The delay is fixed per
machine, so the start time is the same every day. With `operation = "boot"` it refreshes the
`nixpkgs`, `home-manager` and `nix-index-database` inputs, builds, and sets the
new generation as boot default. It does not activate anything, restart
services or reboot; the new generation takes effect on the next reboot. If the
machine is off at the scheduled time, the run starts right after the next boot
(`persistent = true`).

The flake is referenced by path, so the build uses the working tree. An
`ExecStartPre` guard refuses to run while any tracked file other than
`flake.lock` differs from HEAD; the run fails with a notification instead of
staging uncommitted work. Manual rebuilds (`nh`, sysmenu) are not guarded.

Each run leaves the refreshed `flake.lock` uncommitted; commit it as part of
your normal workflow. `phi` and `nix-flatpak` stay pinned and change only on a
manual `nix flake update <input>`. To skip a run (before a meeting, say), use
`sudo systemctl stop nixos-upgrade.timer` and start it again afterwards.

## Notifications (update-notify.nix)

- **"NixOS update staged - Reboot when convenient"**: a staged generation is
  waiting; reboot to activate it. Shown once per generation (state in
  `~/.cache`).
- **"NixOS kernel updated - Reboot to load the new kernel"**: a manual `switch`
  changed the kernel or kernel modules, which only take effect after a reboot.
- **"Firmware updates available"**: fwupd metadata has new updates; apply them
  via sysmenu → Firmware or `fwupdmgr update`.
- **"NixOS auto-upgrade FAILED"** (critical): offline, eval error, or the WIP
  guard refused. Check `journalctl -u nixos-upgrade.service` or sysmenu →
  "Upgrade timer & journal". Failures that happen while logged out are shown
  again at the next login.

Audit commands (also in sysmenu, `Mod+Shift+U`):

```bash
systemctl list-timers nixos-upgrade.timer    # next/last trigger
journalctl -u nixos-upgrade.service          # run and build log
nvd diff /run/booted-system /nix/var/nix/profiles/system   # staged changes
bootctl list                                 # generations on disk
```

## Diffs

```bash
nvd diff /run/current-system ./result                          # after just build
nvd diff /run/booted-system /nix/var/nix/profiles/system       # what the next boot gets
nix profile diff-closures --profile /nix/var/nix/profiles/system  # closure changes per generation (gen-diff alias)
```

## Rollbacks

Select an earlier generation in the systemd-boot menu, which keeps up to
`configurationLimit = 15` entries. The boot-menu editor is disabled, so kernel
command lines cannot be edited there. From a running system:

```bash
just rollback                                # nh os rollback
sudo nixos-rebuild switch --rollback         # equivalent
```

## Build failures

| symptom | fix |
|---|---|
| eval error | fix the nix, then run `nix flake check` (evaluates and builds the toplevel) |
| new file not picked up | `git add` it; flakes only see tracked files |
| auto-upgrade failed with a WIP list | commit or revert those files, or rebuild manually if the working tree should go live |
| offline at 12:00 | none; the run catches up after the next boot |
| flake.lock modified after an automatic run | expected; commit it |

fwupd refreshes firmware metadata hourly. Applying firmware updates is manual:
`fwupdmgr update` or sysmenu → Firmware.

See also: [troubleshooting](./troubleshooting.html) · [niri](../apps/niri.html)
(sysmenu on `Mod+Shift+U`).
