---
title: niri workflows
slug: niri-workflows
summary: columns, workspaces, and the launcher menus that drive box.
order: 2
---

Source of truth: `/home/stefan/nixos_config/modules/home/niri.nix` →
`~/.config/niri/config.kdl` (nix-managed — edit the module, rebuild, don't edit
the file). In-app cheat sheet: `Mod+Shift+/` (hotkey overlay). `niri msg`
introspects the running session.

## Mental model

Each **workspace** is a horizontal strip of **columns**; windows stack vertically
inside a column. Workspaces themselves scroll vertically. Workspaces are created
on demand — config declares three persistent ones named `1`–`3` so the bar always
shows three. Gaps 8 px, default column width 50%, presets ⅓ / ½ / ⅔.

## Focus & movement

Vim keys are primary, arrows mirror them. Horizontal focus/movement **wraps**
around the column strip; moves do not.

| keys | action |
|---|---|
| `Mod+H` / `Mod+L` (or arrows) | focus column left/right, wraps at the edges |
| `Mod+J` / `Mod+K` (or arrows) | focus window down/up inside the column |
| `Mod+Shift+H/L/J/K` | move column / window |
| `Mod+[` / `Mod+]` | focus previous/next **monitor** |
| `Mod+Shift+[` / `Mod+Shift+]` | move column to previous/next monitor |
| `Mod+U` / `Mod+I` | workspace down / up |
| `Mod+Ctrl+U` / `Mod+Ctrl+I` | move column to workspace down / up |
| `Mod+1…9` | jump to workspace N |
| `Mod+Shift+1…9` | move column to workspace N |

## Columns & windows

| keys | action |
|---|---|
| `Mod+V` | cycle preset widths (⅓ / ½ / ⅔) |
| `Mod+W` | expand column to available width |
| `Mod+-` / `Mod+=` | width −10% / +10% |
| `Mod+Shift+-` / `Mod+Shift+=` | window height −10% / +10% |
| `Mod+F` | maximize window to screen edges (bar stays, no gaps/ring) |
| `Mod+Shift+F` | true fullscreen |
| `Mod+C` | center column |
| `Mod+O` | toggle overview (all workspaces at a glance) |
| `Mod+,` / `Mod+.` | pull window into column / expel it out |
| `Mod+Alt+S` | toggle window floating |
| `Mod+Shift+Space` | switch focus floating ↔ tiling |
| `Mod+X` | close window |
| `Mod+Ctrl+Shift+I` | hand all keys to the focused window (VMs/remote desktop) |

## Launchers & fold-out menus

`Mod+D` opens **fuzzel** (app launcher). The fold-outs are fuzzel dmenu loops,
sources in `/home/stefan/nixos_config/hosts/box/scripts/`:

| keys | menu | covers |
|---|---|---|
| `Mod+Shift+B` | `btmenu` | bluetooth power, scan, pair/trust/connect/disconnect, blueman-manager on demand |
| `Mod+Shift+W` | `netmenu` | Wi-Fi scan+connect, saved profiles, radio toggle; results toast via swaync |
| `Mod+Shift+A` | `volmenu` | default sink/source switching, per-app stream volume/mute (wpctl) |
| `Mod+P` | `session-menu` | Lock / Logout / Suspend / Reboot / Power off (gum TUI in ghostty) |
| `Mod+Shift+U` | `sysmenu` | staged diff (nvd), upgrade timer & journal, generations, power profile, rebuild switch, rollback, firmware |

Plain app binds: `Mod+Return`/`Mod+T` ghostty · `Mod+D` fuzzel · `Mod+B` firefox ·
`Mod+E` nautilus · `Mod+N` toggle do-not-disturb · `Mod+Shift+N` swaync control
center. Hardware keys (volume/brightness/media) run through swayosd with an OSD;
mic mute deliberately requires unlock.

## Keyboard layout

`us,de` is configured in xkb (plain XKB — no IBus/fcitx5, niri shows an
indicator). `Mod+Space` switches to the next layout; `us` is the default. The
layout indicator reacts to capslock remapping done by **keyd** (capslock →
ctrl/esc), which works in both niri and GNOME sessions.

## Session

`Ctrl+Alt+L` or `Mod+Escape` locks (swaylock + cliphist wipe). `Mod+Shift+P`
powers off monitors, `Mod+Shift+Q` quits niri. Idle: lock after 15 min, monitors
off after 20 min (swayidle user unit).

See also: the full bind tables on the niri app page
([../apps/niri.html](../apps/niri.html)) ·
[screenshots & clipboard](./screenshots-clipboard.html) ·
[maintenance](./maintenance.html).