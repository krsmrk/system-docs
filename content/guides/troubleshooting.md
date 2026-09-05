---
title: Troubleshooting
slug: troubleshooting
summary: symptom → command → what to check next, for the failures that actually happen.
order: 7
---

Every lock/session component here is a systemd **user** unit; system stuff is
root. Pick **GNOME in GDM** whenever niri misbehaves — it's the configured
fallback session.

## niri won't start (black screen, session bounces back)

niri runs as a systemd **user** unit launched by GDM (there is no greetd).

```bash
journalctl --user -u niri.service -b 0 --no-pager   # compositor log
systemctl status display-manager.service            # GDM itself (unit is display-manager, PID gdm)
journalctl -u display-manager.service -b
```

What to check next: a broken `config.kdl` — the file is generated from
`modules/home/niri.nix`, so fix the module and rebuild; and switch sessions via
GDM's gear menu (GNOME) to keep working. From a TTY (`Ctrl+Alt+F2`) you can
rollback (below) or rebuild headlessly.

## Locked out / lock screen oddities

All lock paths run the `lock` script (`swaylock -f` + `cliphist wipe`):
`Ctrl+Alt+L`, `Mod+Escape`, session menu, 15-min idle timeout, before-sleep.

| symptom | check |
|---|---|
| password rejected, red ring | caps lock indicator is on the ring (`show-failed-attempts` is on) — keyd remaps capslock, mind the layout (us vs de, `Mod+Space`) |
| lock never triggers | `systemctl --user status swayidle.service` — its timeouts are 900 s lock / 1200 s monitors-off |
| screen stays unlocked after suspend | swayidle's `before-sleep` event runs `lock`; check `journalctl --user -u swayidle.service` |
| want to lock right now | run `lock` in a terminal, or `Mod+Escape` |

swaylock authenticates via PAM (`security.pam.services.swaylock`).

## Screen sharing / portals broken

Screencast goes through the **gnome portal** (file chooser: gtk fallback), wired
by `modules/nixos/niri.nix`.

```bash
systemctl --user status xdg-desktop-portal.service
```

What to check next: Electron apps run native Wayland via `NIXOS_OZONE_WL=1` —
if a browser window misbehaves, try its X11/xwayland mode before blaming the
portal; portals come up with `graphical-session.target`.

## Keyring & SSH agents

- **SSH keys**: plain `ssh-agent` as a user unit, socket `$XDG_RUNTIME_DIR/ssh-agent`.
  Passphrase prompts are a Nord fuzzel dialog (`SSH_ASKPASS` in common.nix) that
  validates the passphrase and caches the key via AddKeysToAgent. `ssh-add -l`
  lists loaded keys. `gcr-ssh-agent` is deliberately off — don't re-enable it.
- **gpg**: `gpg-agent` + `pass` (common.nix).
- **gnome-keyring**: enabled by the niri system module for session secrets.

Symptom "ssh prompts forever": the fuzzel askpass only validates keys in
`~/.ssh/id_*`; keys referenced via `IdentityFile` elsewhere fall back to a
generic prompt.

## Audio

```bash
wpctl status                        # sinks, sources, per-app streams
wpctl set-volume @DEFAULT_AUDIO_SINK@ 50%
```

XF86 keys call `swayosd-client` (OSD: `systemctl --user status swayosd.service`).
For routing and per-app mixing use volmenu (`Mod+Shift+A`) — it drives wpctl.

## Flatpak

Apps are managed declaratively (nix-flatpak): Flathub + the declared package set
are authoritative, and anything installed imperatively is **removed at the next
activation** (`uninstallUnmanaged`). Updates run weekly on a timer.

| symptom | check |
|---|---|
| app disappeared | was it in the declared set? (`flatpak list`) — add it to `modules/nixos/flatpak.nix`/context module, rebuild |
| permission issue | overrides in `~/.local/share/flatpak/overrides/`; adjust with `flatpak override --user` (see flatpak-override(1)) |
| stale app after update | `flatpak update` manually; the timer only runs weekly |

## Rollback after a bad update

Pick the previous generation in the systemd-boot menu (boot-menu editing is
disabled — select only), or from a session/TTY:

```bash
bootctl list
just rollback            # nh os rollback
```

Rebuilding with `--rollback` (`sudo nixos-rebuild switch --rollback`) also flips
the live system, not just the next boot.

## Reading the update notifications

- Toasts come from `modules/home/update-notify.nix`: a user path unit watches
  `/nix/var/nix/profiles` (staged generations) and one watches
  `/var/lib/fwupd/metadata/lvfs` (firmware); a root OnFailure unit toasts
  auto-upgrade failures into running sessions. Dedupe markers live in
  `~/.cache/update-notify/` — delete them to re-test.
- Read the backlog: swaync control center (`Mod+Shift+N`).
- Follow up: sysmenu (`Mod+Shift+U`) → "Upgrade timer & journal" or
  "Staged diff (nvd)" — see [maintenance](./maintenance.html).

See also: [maintenance](./maintenance.html) · the niri app page
([../apps/niri.html](../apps/niri.html)).