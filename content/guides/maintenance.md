---
title: NixOS maintenance
slug: maintenance
summary: rebuild, update, rollback, automatic upgrades with cooldown
order: 1
verified: 6c7a54e
---

The system config is the flake at `~/nixos_config`. Inside that directory run
recipes with `just`; from anywhere else use `nj` ("NixOS just", e.g.
`nj update-docs`). `njr` lists the recipes.

## justfile recipes (`~/nixos_config/justfile`)

| recipe | does |
|---|---|
| `just build` | build a generation without activating it (nom output via `nh`) |
| `just switch` | activate and set as boot default; the everyday rebuild |
| `just test` | activate without touching the bootloader; a reboot reverts it, `just switch` keeps it |
| `just diff` | `nvd diff /run/current-system ./result`: changes in the last `just build` |
| `just update` | `nix flake update`: refresh all inputs to their tips, without cooldown (home-manager follows nixpkgs) |
| `just upgrade-now` | lock nixpkgs, home-manager, nix-index-database and nixpkgs-fast to their tips and stage for the next boot; `just upgrade-now switch` activates |
| `just upgrade-status` | cooldown gate state: locked and cooled revisions, fast-lane versions, matched advisories |
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
machine, so the start time is the same every day. With `operation = "boot"` it
updates `flake.lock` through the cooldown gate, builds, and sets the new
generation as boot default. It does not activate anything, restart services or
reboot; the new generation takes effect on the next reboot. If the machine is
off at the scheduled time, the run starts right after the next boot
(`persistent = true`).

### Cooldown

The gate (`nixos-upgrade-gate`, `modules/nixos/auto-upgrade-gate.py`) locks
each input to the revision its branch had a fixed time ago, using GitHub push
times:

| input | cooldown |
|---|---|
| `nixpkgs`, `home-manager`, `nix-index-database` | 7 days, moved together |
| `nixpkgs-fast` | 1 day |

`nixpkgs-fast` provides qutebrowser, firefox, zathura and mpv (overlay in
`modules/nixos/auto-upgrade.nix`) with their runtime dependencies, such as
QtWebEngine and FFmpeg. These applications handle untrusted input and get
browser and media fixes a day after they reach nixos-unstable.

The gate never moves an input backwards: after `just upgrade-now` or
`just update` the lock stays until the cooled revision catches up. `phi`,
`nix-flatpak` and `treefmt-nix` stay pinned and change only on a manual
`nix flake update <input>`.

### Security bypass

Each run reads the NixOS security tracker (advisories with CVSS 8.8 or higher)
and the CISA catalog of known exploited vulnerabilities (KEV), both for the
last 60 days. When an affected package is part of the running or staged system
and a newer revision contains the fix, the lane that provides the package
(system or fast) moves early:

| advisory | target |
|---|---|
| CVSS 8.8 or higher | newest revision at least 24 hours old |
| KEV entry | branch tip |

The fix is confirmed through version ranges from the tracker or the CVE
record; without version data, through a change in the package's source or
patches. KEV entries map to packages by name and through aliases for Chromium
(QtWebEngine), Firefox and the Linux kernel. KEV entries without usable
version ranges do not fire; `just upgrade-status` lists them for a manual
`just upgrade-now`.

If the tracker, the KEV feed or a package evaluation fails, the cooled update
continues with the bypass reduced or off. An unreachable GitHub API fails the
run. Advisory cache: `/var/lib/nixos-upgrade/advisories.json`. Design and
rationale: `AUTO-UPGRADE-COOLDOWN.md` in the repo.

```bash
just upgrade-status                     # revisions, fast lane, advisories and why each did or did not fire
nixos-upgrade-gate run --dry-run        # decisions of the next run, lock untouched
journalctl -u nixos-upgrade.service | grep -E 'cooldown|fast-lane|bypass|advisories'
```

### Working tree and lock

The flake is referenced by path, so the build uses the working tree. An
`ExecStartPre` guard refuses to run while any tracked file other than
`flake.lock` differs from HEAD; the run fails with a notification instead of
staging uncommitted work. Manual rebuilds (`nh`, sysmenu) are not guarded.

Each run leaves the updated `flake.lock` uncommitted; commit it as part of
your normal workflow. To skip a run (before a meeting, say), use
`sudo systemctl stop nixos-upgrade.timer` and start it again afterwards.

## Notifications (update-notify.nix)

- **"NixOS update staged - Reboot when convenient"**: a staged generation is
  waiting; reboot to activate it. Shown once per generation (state in
  `~/.cache`).
- **"NixOS kernel updated - Reboot to load the new kernel"**: a manual `switch`
  changed the kernel or kernel modules, which only take effect after a reboot.
- **"NixOS security update"**: the gate moved a lane early for a CVE. The
  "update staged" notification follows when the build finishes; reboot soon.
- **"NixOS auto-upgrade: security bypass degraded"**: an advisory source or
  package evaluation failed; the cooled update still ran. Shown at most once
  a day; details in `just upgrade-status`.
- **"Firmware updates available"**: fwupd metadata has new updates; apply them
  via sysmenu → Firmware or `fwupdmgr update`.
- **"NixOS auto-upgrade FAILED"** (critical): offline, GitHub API
  unreachable, eval error, or the WIP guard refused. Check `journalctl -u nixos-upgrade.service` or sysmenu →
  "Upgrade timer & journal". Failures that happen while logged out are shown
  again at the next login.

Audit commands (also in sysmenu, `Mod+Shift+U`):

```bash
systemctl list-timers nixos-upgrade.timer    # next/last trigger
just upgrade-status                          # cooldown and bypass state
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
| auto-upgrade failed on GitHub activity | API unreachable or rate-limited (60 requests an hour without a token); the next run retries |
| package fixed upstream but not yet installed | `just upgrade-status` shows whether the bypass saw it; `just upgrade-now` takes the tips |

fwupd refreshes firmware metadata hourly. Applying firmware updates is manual:
`fwupdmgr update` or sysmenu → Firmware.

See also: [troubleshooting](./troubleshooting.html) · [niri](../apps/niri.html)
(sysmenu on `Mod+Shift+U`).
