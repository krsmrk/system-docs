---
title: Bar and notifications
slug: bar-notifications
summary: the three waybar pills and what clicking them does, the swaync control center, do-not-disturb, OSD on hardware keys, and which toast comes from where.
order: 3
app: waybar
verified: 0bd451a
---

The bar (waybar), the notification daemon (swaync) and the on-screen display
(swayosd) are systemd **user** units under `graphical-session.target`, not niri
autostart entries: they come up with the session and restart themselves when
they crash. Sources: `modules/home/waybar.nix`, `modules/home/swaync.nix`,
`modules/home/update-notify.nix`; the hardware keys live in
`modules/home/niri.nix`. The full click table is on the
[waybar app page](../apps/waybar.html).

## The three pills

The bar itself is transparent; what you see are Nord pills floating at the top
edge of the screen.

| pill | modules | what it shows |
|---|---|---|
| left | workspace dots, window title | one dot per workspace in its identity colour (1 cyan, 2 green, 3 mauve, …); the focused dot is stretched into a short pill, an urgent one pulses, empty ones stay visible; then the focused window's title (cut at 70 characters) |
| center | clock | `YYYY-MM-DD HH:MM` plus the zone abbreviation; hovering opens the calendar popup (Monday-first, ISO week numbers on the right, today highlighted) |
| right | bell, then the status pill | bell with the unread count; keyboard layout (`us`/`de`), CPU %, memory %, Wi-Fi signal % (or `wired`), battery (hidden on a machine without one), volume, system tray |

Numbers are zero-padded so a pill never changes width while you look at it.
Red is reserved for error states: disconnected network, muted audio, battery
below 15 %. Hover the network chip for essid, interface, IP and gateway; hover
the battery for drain and time to empty.

## Clicking and scrolling

The pointer path always mirrors a key path, so nothing is reachable only by
mouse.

| where | pointer | does | same as |
|---|---|---|---|
| workspace dots | `Scroll Up` / `Scroll Down` | focus the workspace above / below | `Mod+I` / `Mod+U` |
| bell | `Mouse Left Click` | toggle the control center | `Mod+Shift+N` |
| bell | `Mouse Right Click` | close all notifications (count back to zero) | - |
| language chip | `Mouse Left Click` / `Mouse Right Click` | next / previous layout (us ⇄ de) | `Mod+Space` |
| language chip | `Scroll Up` / `Scroll Down` | previous / next layout | `Mod+Space` |
| volume | `Mouse Left Click` | mute / unmute the default sink | `XF86AudioMute` |
| clock | `Mouse Left Click` | toggle local time ⇄ UTC (the zone abbreviation tells you which) | - |

For output/input routing and per-app volume use volmenu (`Mod+Shift+A`); the
volume chip only mutes.

## Notifications: banners, the center, the bell

A new notification shows as a banner in the top-right corner for 5 seconds
(critical ones stay until you dismiss them), then it moves to the control
center and the bell keeps counting it until you dismiss it there or press
Clear. Notifications group per app, carry their action buttons as chips, and
support inline replies and 2FA codes.

| keys | action |
|---|---|
| `Mod+Shift+N` | toggle the control center: history, action buttons, Clear, the do-not-disturb switch |
| `Mod+N` | toggle do-not-disturb |

Under do-not-disturb no banners appear, but everything still lands in the
center and the bell turns grey with a slash while the count keeps climbing.
The bell polls swaync every 3 s, so the count can lag a moment.

```bash
swaync-client -t                           # toggle the control center
swaync-client -d                           # toggle do-not-disturb, prints the new state
swaync-client -C                           # close all notifications
swaync-client -c                           # unread count (what the bell shows)
notify-send "title" "body"                 # test a toast
notify-send -u critical "title" "body"     # stays until dismissed
```

## Where toasts come from

| source | toast | then |
|---|---|---|
| update-notify (path unit on the system profile + once per login) | "NixOS update staged", "NixOS kernel updated" | reboot when convenient; meanings in [maintenance](./maintenance.html) |
| firmware-notify (path unit on the fwupd metadata) | "Firmware updates available" with one line per device | sysmenu (`Mod+Shift+U`) → Firmware, or `fwupdmgr update` |
| auto-upgrade failure (root unit, or the session-start check if you were logged out) | "NixOS auto-upgrade FAILED" (critical) | `journalctl -u nixos-upgrade.service` |
| netmenu (`Mod+Shift+W`) | "Wi-Fi: Connected to …", critical "Failed …" | - |
| sysmenu (`Mod+Shift+U`) | "Power profile: old → new" | - |
| cliprec (`Mod+Ctrl+V`) | "Clipboard history ON (15 min)" / "… OFF" | see [screenshots & clipboard](./screenshots-clipboard.html) |
| zsh `notify` prefix | "done (NNs)" plus the command, when it ran 30 s or longer | - |

The zsh toast is opt-in per command: `notify nh os switch` pings you when the
rebuild finishes; a plain `nh os switch` never does. For a pipeline wrap it:
`notify zsh -c 'make -j8 && ./test.sh'`.

## OSD on hardware keys

Volume, mute, brightness and media keys go through `swayosd-client`, which
draws an on-screen slider; the bar's volume chip updates alongside.

| keys | does |
|---|---|
| `XF86AudioRaiseVolume` / `XF86AudioLowerVolume` | default sink ±5 |
| `XF86AudioMute` | mute / unmute the output |
| `XF86AudioMicMute` | mute / unmute the microphone - ignored while locked, on purpose |
| `XF86AudioPlay` / `XF86AudioNext` / `XF86AudioPrev` | playerctl play-pause / next / previous |
| `XF86MonBrightnessUp` / `XF86MonBrightnessDown` | backlight up / down (brightnessctl) |

Every key in that table except mic mute also works on the lock screen.

## When something misbehaves

```bash
systemctl --user status waybar.service swaync.service swayosd.service
systemctl --user restart waybar.service     # bar gone, or a pill stuck
systemctl --user restart swaync.service     # no banners, bell count frozen
systemctl --user restart swayosd.service    # no slider on the volume keys
journalctl --user -u waybar.service -b      # why it died
```

waybar and swaync restart on failure, swayosd always; a rebuild that changes
the bar's config restarts it for you. An empty right-hand pill means the bell
script could not reach swaync: restart swaync, the bar recovers on its next
3-second poll. Nord colours are literals in `waybar.nix` and `swaync.nix`
(swaync via `:root` variables), so a theme change is a rebuild, not a reload.

See also: [niri workflows](./niri-workflows.html) for the menus that send
these toasts · [troubleshooting](./troubleshooting.html) for audio and
lock-screen issues · [maintenance](./maintenance.html) for the update toasts.
