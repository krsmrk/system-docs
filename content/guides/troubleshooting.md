---
title: Troubleshooting
slug: troubleshooting
summary: symptoms, diagnostic commands, next steps
order: 12
ignore-keys: Ctrl+Alt+F2
verified: 0bd451a
---

## niri fails to start

Symptoms: black screen, or GDM returns to the login screen. GDM starts niri as
a systemd user unit.

```bash
journalctl --user -u niri.service -b 0 --no-pager   # compositor log
systemctl status display-manager.service            # GDM (unit display-manager, process gdm)
journalctl -u display-manager.service -b
```

The usual cause is a broken `config.kdl`. It is generated from
`modules/home/niri.nix`; fix the module and rebuild. Meanwhile, choose GNOME
from GDM's gear menu. From a TTY (`Ctrl+Alt+F2`) you can roll back (see
[Rollback](#rollback)) or rebuild.

## Lock screen

Every lock path runs the `lock` script (`swaylock -f`, `cliphist wipe`,
`wl-copy --clear`): `Ctrl+Alt+L`, `Mod+Escape`, the session menu, the 15-minute
idle timeout, and before-sleep. swaylock authenticates via PAM
(`security.pam.services.swaylock`).

| symptom | check |
|---|---|
| Password rejected | The ring turns yellow when Caps Lock is on (under keyd, left Ctrl is Caps Lock). Check the keyboard layout (us or de) |
| Screen never locks | `systemctl --user status swayidle.service`; timeouts are 900 s lock, 1200 s monitors off |
| Not locked after suspend | swayidle's `before-sleep` event runs `lock`; check `journalctl --user -u swayidle.service` |
| Testing the lock | Run `lock` in a terminal, or press `Mod+Escape` |

## Screen sharing and portals

Screencasting uses the GNOME portal (file chooser falls back to GTK),
configured in `modules/nixos/niri.nix`. Portals start with
`graphical-session.target`.

```bash
systemctl --user status xdg-desktop-portal.service
```

Electron apps run as native Wayland (`NIXOS_OZONE_WL=1`). If a browser window
misbehaves, try its X11/XWayland mode before suspecting the portal.

## Keyring and SSH agents

- **ssh-agent**: user unit, socket `$XDG_RUNTIME_DIR/ssh-agent`. Passphrase
  prompts use a fuzzel dialog (`SSH_ASKPASS` in common.nix) that validates the
  passphrase and caches the key via AddKeysToAgent. `ssh-add -l` lists loaded
  keys. Do not re-enable `gcr-ssh-agent`.
- **gpg-agent**: caches the GPG key that unlocks `pass` (common.nix).
- **gnome-keyring**: started by PAM at login (part of the GNOME module);
  provides the Secret Service.

If ssh keeps prompting: the fuzzel askpass validates only keys in
`~/.ssh/id_*`. Keys set with `IdentityFile` elsewhere get a generic prompt.

Setup and usage: [SSH, secrets and agents](./ssh-secrets.html).

## Bar or notifications missing

waybar, swaync and swayosd are user units that restart after a crash. If one
hangs, restart it:

```bash
systemctl --user restart waybar.service
systemctl --user restart swaync.service
systemctl --user status swayosd.service
```

Module and toast reference: [bar and notifications](./bar-notifications.html).

## Audio

```bash
wpctl status                        # sinks, sources, per-app streams
wpctl set-volume @DEFAULT_AUDIO_SINK@ 50%
```

Hardware keys call `swayosd-client` (`systemctl --user status swayosd.service`).
For routing and per-app volume use volmenu (`Mod+Shift+A`), which wraps wpctl.

## Flatpak

nix-flatpak manages apps declaratively: Flathub and the declared package set
are authoritative, and apps installed by hand are removed at the next
activation (`uninstallUnmanaged`). Updates run weekly on a timer.

| symptom | check |
|---|---|
| App disappeared | Is it declared? (`flatpak list`) Add it to `modules/nixos/flatpak.nix` or the context module and rebuild |
| Permission problem | Overrides are in `~/.local/share/flatpak/overrides/`; adjust with `flatpak override --user` (flatpak-override(1)) |
| App outdated | Run `flatpak update`; the timer runs only weekly |

## Rollback

Select the previous generation in the systemd-boot menu (entries cannot be
edited), or from a session or TTY:

```bash
bootctl list
just rollback            # nh os rollback
```

`sudo nixos-rebuild switch --rollback` switches the running system as well as
the boot default.

## Update notifications

- Sources: `modules/home/update-notify.nix`. A user path unit watches
  `/nix/var/nix/profiles` (staged generations), another watches
  `/var/lib/fwupd/metadata/lvfs` (firmware). A root OnFailure unit sends
  auto-upgrade failures to running sessions; the cooldown gate sends
  security-bypass notices and bypass warnings the same way. Dedupe markers are in
  `~/.cache/update-notify/`; delete them to test again.
- Past notifications: control center (`Mod+Shift+N`).
- Follow-up: sysmenu (`Mod+Shift+U`) → "Upgrade timer & journal" or
  "Staged diff (nvd)"; see [maintenance](./maintenance.html).

See also: [maintenance](./maintenance.html) · [niri bindings](../apps/niri.html).
