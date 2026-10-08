---
title: niri workflows
slug: niri-workflows
summary: columns, workspaces, launchers and menus
order: 2
app: niri
verified: 17be888
---

`~/nixos_config/modules/home/niri.nix` generates `~/.config/niri/config.kdl`.
Edit the module and rebuild; do not edit the generated file. Bindings are
declared from scratch, so niri's stock defaults, including the `Mod+Shift+/`
hotkey overlay, do not exist. `niri msg` inspects the running session.
Modifier conventions are in [keyboard conventions](./keyboard-grammar.html).

## Layout model

Each workspace is a horizontal strip of columns; windows stack vertically
within a column. Workspaces are stacked vertically and created on demand.
Workspaces `1`–`3` are persistent, so the bar always shows them. Gaps are 8 px,
the default column width is 50%, and the width presets are ⅓, ½ and ⅔.

## Focus and movement

Vim keys are primary; arrow keys mirror them. Horizontal focus wraps at the ends
of the column strip; moving columns does not.

| keys | action |
|---|---|
| `Mod+H` / `Mod+L` (or arrows) | Focus column left/right (wraps) |
| `Mod+J` / `Mod+K` (or arrows) | Focus window down/up within the column |
| `Mod+Shift+H/L/J/K` | Move column left/right, window down/up |
| `Mod+[` / `Mod+]` | Focus column left/right, or the adjacent monitor at the strip edge |
| `Mod+Shift+[` / `Mod+Shift+]` | Move column to previous/next monitor |
| `Mod+U` / `Mod+I` | Focus workspace down/up |
| `Mod+Ctrl+U` / `Mod+Ctrl+I` | Move column to workspace down/up |
| `Mod+1…9` | Focus workspace N |
| `Mod+Shift+1…9` | Move column to workspace N |

## Columns and windows

| keys | action |
|---|---|
| `Mod+V` | Cycle preset widths |
| `Mod+W` | Expand column to available width |
| `Mod+-` / `Mod+=` | Column width −10% / +10% |
| `Mod+Shift+-` / `Mod+Shift+=` | Window height −10% / +10% |
| `Mod+F` | Maximize window to screen edges (bar stays; no gaps or focus ring) |
| `Mod+Shift+F` | Fullscreen |
| `Mod+C` | Center column |
| `Mod+O` | Toggle overview |
| `Mod+,` / `Mod+.` | Consume window into column / expel window from column |
| `Mod+Alt+S` | Toggle window floating |
| `Mod+Shift+Space` | Switch focus between floating and tiling |
| `Mod+X` | Close window |
| `Mod+Ctrl+Shift+I` | Pass all keys to the focused window (VMs, remote desktops) |

## Launchers and menus

| keys | menu | covers |
|---|---|---|
| `Mod+Shift+B` | `btmenu` | Bluetooth power, scan, pair/trust/connect/disconnect, blueman-manager |
| `Mod+Shift+W` | `netmenu` | Wi-Fi scan and connect, saved profiles, radio toggle; results as toasts |
| `Mod+Shift+A` | `volmenu` | Default sink/source, per-app stream volume and mute (wpctl) |
| `Mod+P` | `session-menu` | Lock, log out, suspend, reboot, power off |
| `Mod+Shift+U` | `sysmenu` | Staged diff (nvd), upgrade timer and journal, generations, power profile, rebuild switch, rollback, firmware |
| `Mod+Shift+D` | `phonemenu` | KDE Connect (private hosts only): send files/clipboard, browse phone storage, ring, pair |

`btmenu`, `netmenu`, `volmenu` and `phonemenu` are fuzzel dmenu loops;
`session-menu` and `sysmenu` are gum TUIs in ghostty. Most scripts are in
`~/nixos_config/hosts/box/scripts/`.

`Mod+Shift+E` opens the emoji/Unicode picker; the selection is typed into the
focused window and copied. `Mod+Shift+M` opens a qalc calculator (units,
currencies, bases); every result is copied, and `Esc` closes it. Capture tools
(`Mod+Shift+T` OCR, `Mod+Shift+C` colour picker, `Mod+Shift+R` recording,
`Mod+Ctrl+S` annotate) are in [screenshots & clipboard](./screenshots-clipboard.html).

| keys | action |
|---|---|
| `Mod+Return` / `Mod+T` | ghostty |
| `Mod+D` | fuzzel (app launcher) |
| `Mod+Q` | qutebrowser |
| `Mod+B` | firefox (fallback browser) |
| `Mod+E` | nautilus |
| `Mod+N` | Toggle do-not-disturb |
| `Mod+Shift+N` | Toggle swaync control center |
| `Mod+Ctrl+N` | Toggle night light (wlsunset) |

Hardware keys (volume, brightness, media) show an OSD. Mic mute works only
while unlocked. Brightness keys act on the focused output: the built-in panel
via the kernel backlight, an external monitor via DDC/CI. `Mod+F12` /
`Mod+F11` do the same on keyboards without brightness keys.

## Keyboard layout

Layouts are `us,de` in plain XKB (no IBus or fcitx5); `us` is the default.
`Mod+Space` switches to the next layout. keyd's Caps Lock remap works in both
niri and GNOME sessions.

## Session

`Ctrl+Alt+L` or `Mod+Escape` locks the screen (swaylock, clipboard wipe).
`Mod+Shift+P` turns off the monitors, `Mod+Shift+Q` quits niri. swayidle locks
after 15 minutes idle and turns the monitors off after 20.

See also: [niri bindings](../apps/niri.html) ·
[screenshots & clipboard](./screenshots-clipboard.html) ·
[bar & notifications](./bar-notifications.html) ·
[maintenance](./maintenance.html) ·
[keyboard conventions](./keyboard-grammar.html).
