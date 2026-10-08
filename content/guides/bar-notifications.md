---
title: Bar and notifications
slug: bar-notifications
summary: waybar, swaync, do-not-disturb, OSD, toast sources
order: 3
app: waybar
verified: 0bd451a
---

waybar (bar), swaync (notifications) and swayosd (on-screen display) run as
systemd user units under `graphical-session.target` rather than niri autostart
entries, so they restart after a crash. Sources: `modules/home/waybar.nix`,
`modules/home/swaync.nix`, `modules/home/update-notify.nix`; hardware keys are
bound in `modules/home/niri.nix`. The full click table is on the
[waybar app page](../apps/waybar.html).

## Bar layout

The bar background is transparent; modules sit in Nord-coloured pills along the
top edge.

| pill | modules | shows |
|---|---|---|
| left | workspace dots, window title | One dot per workspace in its colour (1 cyan, 2 green, 3 mauve, …). The focused dot is stretched, an urgent one pulses, empty ones stay visible. Then the focused window's title, truncated at 70 characters |
| center | clock | `YYYY-MM-DD HH:MM` and the time zone abbreviation. Hover for a calendar (Monday first, ISO week numbers, today highlighted) |
| right | bell, status | Bell with unread count; keyboard layout (`us`/`de`), CPU %, memory %, Wi-Fi signal % (or `wired`), battery (hidden if absent), volume, tray |

Numbers are zero-padded, so pill widths stay constant. Red marks error states
only: network disconnected, audio muted, battery below 15 %. Hover the network
module for ESSID, interface, IP and gateway; hover the battery for power draw
and time to empty.

## Clicking and scrolling

| where | pointer | action | key equivalent |
|---|---|---|---|
| workspace dots | `Scroll Up` / `Scroll Down` | Focus workspace above / below | `Mod+I` / `Mod+U` |
| bell | `Mouse Left Click` | Toggle control center | `Mod+Shift+N` |
| bell | `Mouse Right Click` | Close all notifications | - |
| layout | `Mouse Left Click` / `Mouse Right Click` | Next / previous layout | `Mod+Space` |
| layout | `Scroll Up` / `Scroll Down` | Previous / next layout | `Mod+Space` |
| volume | `Mouse Left Click` | Mute / unmute default sink | `XF86AudioMute` |
| clock | `Mouse Left Click` | Toggle local time / UTC | - |

The volume module only mutes. For device routing and per-app volume use
volmenu (`Mod+Shift+A`).

## Notifications

New notifications appear as banners in the top-right corner for 5 seconds;
critical ones stay until dismissed. They then move to the control center, and
the bell counts them until you dismiss them there or press Clear.
Notifications are grouped per app and support action buttons, inline replies
and 2FA codes.

| keys | action |
|---|---|
| `Mod+Shift+N` | Toggle control center (history, actions, Clear, do-not-disturb switch) |
| `Mod+N` | Toggle do-not-disturb |

Do-not-disturb suppresses banners. Notifications still reach the control
center, the count keeps rising, and the bell is shown grey with a slash. The
bell polls swaync every 3 s, so the count can lag.

```bash
swaync-client -t                           # toggle control center
swaync-client -d                           # toggle do-not-disturb, print new state
swaync-client -C                           # close all notifications
swaync-client -c                           # unread count
notify-send "title" "body"                 # test notification
notify-send -u critical "title" "body"     # stays until dismissed
```

## Toast sources

| source | toast | follow-up |
|---|---|---|
| update-notify (path unit on the system profile, plus once per login) | "NixOS update staged", "NixOS kernel updated" | Reboot when convenient; see [maintenance](./maintenance.html) |
| firmware-notify (path unit on the fwupd metadata) | "Firmware updates available", one line per device | sysmenu (`Mod+Shift+U`) → Firmware, or `fwupdmgr update` |
| auto-upgrade failure (root unit, or a check at session start if you were logged out) | "NixOS auto-upgrade FAILED" (critical) | `journalctl -u nixos-upgrade.service` |
| netmenu (`Mod+Shift+W`) | "Wi-Fi: Connected to …", critical "Failed …" | - |
| sysmenu (`Mod+Shift+U`) | "Power profile: old → new" | - |
| cliprec (`Mod+Ctrl+V`) | "Clipboard history ON (15 min)" / "… OFF" | See [screenshots & clipboard](./screenshots-clipboard.html) |
| zsh `notify` prefix | "done (NNs)" and the command, if it ran 30 s or longer | - |

`notify` is opt-in per command: `notify nh os switch` sends a toast when the
rebuild finishes. For a pipeline, wrap it in a shell:
`notify zsh -c 'make -j8 && ./test.sh'`.

## Hardware keys

Volume, mute and media keys call `swayosd-client`, which draws an on-screen
slider; the bar's volume module updates as well. Brightness keys call the
`brightness` script, which uses the same OSD. All keys except mic mute also
work on the lock screen.

| keys | action |
|---|---|
| `XF86AudioRaiseVolume` / `XF86AudioLowerVolume` | Default sink volume ±5 |
| `XF86AudioMute` | Mute / unmute output |
| `XF86AudioMicMute` | Mute / unmute microphone (ignored while locked) |
| `XF86AudioPlay` / `XF86AudioNext` / `XF86AudioPrev` | Play-pause / next / previous (playerctl) |
| `XF86MonBrightnessUp` / `XF86MonBrightnessDown` | Brightness up / down on the focused output (backlight or DDC/CI) |

## Restarting services

```bash
systemctl --user status waybar.service swaync.service swayosd.service
systemctl --user restart waybar.service     # bar missing or a pill stuck
systemctl --user restart swaync.service     # no banners, bell count frozen
systemctl --user restart swayosd.service    # no OSD on volume keys
journalctl --user -u waybar.service -b      # crash log
```

waybar and swaync restart on failure, swayosd always. A rebuild that changes
the bar config restarts waybar. An empty right-hand pill means the bell script
cannot reach swaync; restart swaync and the bar recovers on its next 3-second
poll. Nord colours are hard-coded in `waybar.nix` and `swaync.nix` (swaync via
`:root` CSS variables), so a theme change needs a rebuild.

See also: [niri workflows](./niri-workflows.html) for the menus that send these
toasts · [troubleshooting](./troubleshooting.html) for audio and lock-screen
issues · [maintenance](./maintenance.html) for update notifications.
