---
title: Screenshots & clipboard
slug: screenshots-clipboard
summary: screenshots, capture tools, opt-in clipboard history
order: 4
app: niri
verified: 17be888
---

## Screenshots

Bindings are in `modules/home/niri.nix`. The `Print` and `Mod+G` families run
the same niri actions, for keyboards with and without a Print key.

| keys | action |
|---|---|
| `Print` | Open niri's screenshot UI: region, window or screen; file or clipboard per shot |
| `Ctrl+Print` | Screenshot focused window |
| `Shift+Print` | Screenshot whole screen |
| `Mod+G` / `Mod+Ctrl+G` / `Mod+Shift+G` | Same three actions |
| `Mod+Shift+S` | Copy a region to the clipboard, no UI or preview (`grim -g "$(slurp)"` piped to `wl-copy`) |

niri saves files to `~/Pictures/Screenshots/` as
`Screenshot from %Y-%m-%d %H-%M-%S.png`. The directory is created on the first
shot.

## Capture tools

Wrappers in `modules/home/capture.nix`. Each puts its result on the clipboard
and confirms with a toast.

| keys | action |
|---|---|
| `Mod+Ctrl+S` | Annotate: select a region, draw arrows, boxes, blur or text in satty; `Enter` copies and saves |
| `Mod+Shift+T` | OCR: select a region; the recognised text (English and German) is copied |
| `Mod+Shift+C` | Colour picker: click a pixel; `#rrggbb` is copied |
| `Mod+Shift+R` | Screen recording: choose region or screen, with or without audio; press again to stop. Saved to `~/Videos/Recordings` and copied as a file, so it pastes into chat apps |

## Clipboard history

Clipboard history is off by default, so copied passwords are not archived.
`cliphist` stores the history, `wl-clip-persist` keeps the current clipboard
available after the source app exits, and `cliprec` arms and disarms recording.

| keys | action |
|---|---|
| `Mod+Ctrl+V` | Arm/disarm recording (`cliprec menu`) |
| `Mod+Shift+V` | Recall from history: `cliphist list` → fuzzel dmenu → `cliphist decode` → `wl-copy` |

The cliprec menu is a fuzzel dmenu whose prompt shows the current state, e.g.
`on (42 min left)`. Entries:

- **Record for 15 minutes / 1 hour / 4 hours / until session end**
- **Stop recording** · **Stop + wipe history** · **Wipe history now**

While armed, two `wl-paste --watch` watchers store text and image selections in
cliphist, up to 100 entries. `Mod+Shift+V` shows only what was recorded while
armed. Typical use: arm with `Mod+Ctrl+V`, copy, recall with `Mod+Shift+V`.

## History wiping

History is wiped:

- at session start (`cliphist wipe` in niri's autostart)
- on lock. Every lock path runs the `lock` script (`swaylock -f`,
  `cliphist wipe`, and `wl-copy --clear` for the clipboard and primary
  selection): `Ctrl+Alt+L`, `Mod+Escape`, the session menu, swayidle's 15-minute
  timeout, and suspend (before-sleep event).

After unlocking, history is empty and nothing copied before the lock can be
pasted. The archive in `~/.local/share/cliphist` exists only while recording is
armed.

## Commands

```bash
cliprec status    # on/off and time left
cliprec stop      # disarm, keep history
cliphist wipe     # delete the archive now
```

cliprec's toasts ("Clipboard history ON (15 min)", "…OFF") also stay in the
control center (`Mod+Shift+N`).

See also: [niri bindings](../apps/niri.html) ·
[troubleshooting](./troubleshooting.html) for lock-screen issues.
