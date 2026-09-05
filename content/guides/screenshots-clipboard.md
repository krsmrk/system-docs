---
title: Screenshots & clipboard
slug: screenshots-clipboard
summary: two screenshot families, and a clipboard history that only records when you say so.
order: 3
---

## Screenshots

Three homes for screenshots in the niri config (`modules/home/niri.nix`):

| keys | what happens |
|---|---|
| `Print` | niri's built-in UI: pick region/window/screen, choose file/clipboard per shot |
| `Ctrl+Print` | screenshot the focused window (niri UI) |
| `Shift+Print` | screenshot the whole screen (niri UI) |
| `Mod+G` / `Mod+Ctrl+G` / `Mod+Shift+G` | same three actions, for boards without a Print key |
| `Mod+Shift+S` | zero-UI fast lane: `grim -g "$(slurp)"` piped to `wl-copy` - region straight to clipboard, no preview |

The Print and Mod+G families are the same niri actions on two key clusters, so the
muscle memory works on any board. `grim` + `slurp` back the fast lane.

**Where files land:** niri writes to `~/Pictures/Screenshots/` with timestamped
names - `Screenshot from %Y-%m-%d %H-%M-%S.png` (created on first shot, so
history is just the directory listing sorted by name).

## Clipboard: opt-in recording

Nothing watches your clipboard by default - copied passwords are never silently
archived (this was the security-review fix). The stack is `cliphist` (store),
`wl-clip-persist` (keeps the *live* clipboard alive when the source app exits),
and `cliprec` (the opt-in recorder).

| keys | action |
|---|---|
| `Mod+Ctrl+V` | `cliprec menu` - arm/disarm recording |
| `Mod+Shift+V` | recall history: `cliphist list` → fuzzel dmenu → `cliphist decode` → `wl-copy` |

The cliprec menu (a fuzzel dmenu, prompt shows current status like
`on (42 min left)`):

- **Record for 15 minutes / 1 hour / 4 hours / until session end**
- **Stop recording** · **Stop + wipe history** · **Wipe history now**

While armed, two `wl-paste --watch` watchers store text *and* image selections
into cliphist, capped at 100 items. Recall (`Mod+Shift+V`) only sees what was
recorded while armed.

## Where history dies

History never outlives the moment it was needed. It is wiped:

- at **session start** (`cliphist wipe` in niri's autostart),
- on **lock** - every lock path goes through the `lock` script
  (`swaylock -f` + `cliphist wipe`): `Ctrl+Alt+L`, `Mod+Escape`, the session
  menu, swayidle's 15-min timeout, and suspend (before-sleep event).

So `Mod+Shift+V` after unlocking shows an empty history. The raw archive lives in
`~/.local/share/cliphist` only while recording is armed.

## Manual control

```bash
cliprec status    # on/off + time left
cliprec stop      # disarm, keep history
cliphist wipe     # nuke the archive now
```

Toast confirmations ("Clipboard history ON (15 min)", "…OFF") come through
swaync, so they land in the control-center history too (`Mod+Shift+N`).

## Lock interplay

Because `lock` wipes the archive, the flow is: arm recording (`Mod+Ctrl+V`) →
copy what you need → `Mod+Shift+V` recall. Walk away / lock, and it's gone;that is the point. The live clipboard still persists across app exits
(wl-clip-persist), it's just not archived.

See also: the niri app page for the bind table
([../apps/niri.html](../apps/niri.html)) · [troubleshooting](./troubleshooting.html)
for lock-screen issues.