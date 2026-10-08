---
title: Keyboard conventions
slug: keyboard-grammar
summary: keyd, layer order, vi keys, modifier conventions
order: 0
app: keyd
verified: 0bd451a
---

Bindings follow the same rules across all layers. A key passes through the
layers below in order; each one either handles it or passes it on.

## Layers

| layer | role | handles |
|---|---|---|
| [keyd](../apps/keyd.html) | evdev remap, below XKB and Wayland | Caps Lock as Ctrl/Esc |
| [niri](../apps/niri.html) | compositor | windows, workspaces, menus |
| [tmux](../apps/tmux.html) | terminal multiplexer | panes, windows, sessions |
| [zsh](../apps/zsh.html) | line editor | the command line |
| the app | qutebrowser, yazi, … | app bindings |

keyd remaps first, so Ctrl anywhere in this manual means the Caps Lock key held.
niri handles its bindings next; terminals never receive them. Inside a
terminal, tmux takes its prefix bindings and zsh its widgets. Remaining keys
reach the running program.

## Caps Lock as Ctrl/Esc

[keyd](../apps/keyd.html) makes Caps Lock Esc when tapped and Ctrl when held or
combined with another key. The left Ctrl key becomes Caps Lock.

This puts Esc next to the home row for the vi modes, and tmux's prefix
(Ctrl+Space) needs only one hand. zsh's `Esc Esc` sudo toggle appears as
`Ctrl+Alt+Escape` in the tables.

## Vi movement keys

H/J/K/L move in every layer that has movement:

- **niri**: H/L focus columns, J/K focus windows within a column.
- **tmux**: Alt+H/J/K/L switch panes; copy mode uses vi keys.
- **zsh**: Esc enters vi normal mode; `v` opens the line in $EDITOR.
- **qutebrowser**: J/K switch tabs, H/L go back/forward, `f` shows hints,
  gg/G jump to top/bottom.
- **Neovim**: Ctrl+H/J/K/L move between windows; `Space` groups use first
  letters (see the [Neovim guide](./neovim.html)).
- **yazi, zathura**: stock vim motions.

Arrow keys also work; niri mirrors every focus binding on them.

## Modifiers

| modifier | niri | tmux | qutebrowser |
|---|---|---|---|
| none | focus | prefix + key: window and pane commands | stock binding |
| Shift | move instead of focus | alternate form (U/D joins) | - |
| Ctrl | variant: move column to workspace; window screenshot | resize steps after prefix | - |
| Alt | floating toggle (Mod+Alt+S) | pane switching without prefix | - |

- In niri, Shift turns a focus action into a move: focus column → move column,
  focus monitor → move to monitor, focus workspace → move column to workspace.
  On screenshots, Shift selects the whole screen.
- Letters are mnemonic: D fuzzel, B firefox, Q qutebrowser, E nautilus. The
  fold-out menus are Shift plus the initial (Bluetooth, Wi-Fi, Audio). P is
  power: session menu, monitors off.
- Most qutebrowser customisations sit behind the `,` leader, pass-store fills
  under `z…`, so stock bindings stay intact. Bindings are case-sensitive.
- zsh uses two-step prefixes: Ctrl+X then a letter (b buffer, p path); Esc Esc
  toggles sudo.

## Unbound keys and exceptions

- Mod+S is unbound in niri.
- niri declares all bindings from scratch, so stock defaults such as Mod+Q
  (close window) do not exist. Close is Mod+X.
- qutebrowser's stock M and m (bookmark-add, quickmark-save) are unchanged.
- Mic mute works only while unlocked. The other hardware keys also work on the
  lock screen.
- Mod+Ctrl+Shift+I passes all keys to the focused window (VMs, remote
  desktops), bypassing niri's bindings until pressed again.

## How the tables are generated

`just update-docs` in nixos_config extracts keys, commands and file:line
sources from the live config. Groups, labels and prose are maintained by hand
in `nixos_config/scripts/extract/manual/`. The sync fails if the two drift
apart: a new binding without a curated entry, or a curated entry whose binding
is gone. The tables are accurate as of the last sync.
