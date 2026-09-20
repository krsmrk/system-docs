---
title: The keyboard grammar
slug: keyboard-grammar
summary: keyd, vi home row, and the modifier rules that make every app predictable.
order: 0
---

The binds on this site are not ninety unrelated facts. They are one small
language, spoken by five layers in a strict order. Learn the grammar once and
an unbound key starts to feel wrong, because you can *derive* what it should do.

## The five layers, in the order they see your keys

Each layer either consumes a key or passes it down:

| layer | role | owns |
|---|---|---|
| [keyd](../apps/keyd.html) | evdev remap, below XKB/Wayland | what Ctrl and Esc physically **are** |
| [niri](../apps/niri.html) | compositor | the global keys: windows, workspaces, menus |
| [tmux](../apps/tmux.html) | terminal multiplexer | panes, windows, sessions |
| [zsh](../apps/zsh.html) | line editor | the command line itself |
| the app | qutebrowser, yazi, … | its own vocabulary |

keyd transforms every key first - so "Ctrl" in *any* row of *any* table on this
site means **the Caps Lock key, held**. niri grabs its binds next; a terminal
never sees them. Inside the terminal, tmux grabs prefix chords; inside tmux,
zsh grabs its widgets; whatever survives reaches the running program.

## Ctrl is the Caps Lock key

[keyd](../apps/keyd.html) gives one keycap two jobs: tap it and you get
**Escape**; hold it - or press any other key while it is down - and it is
**Control**. The left Ctrl keycap becomes the real Caps Lock instead.

This single fact carries the whole system:

- The vi-style grammar everywhere needs a cheap Esc - and there is no cheaper
  one than a home-row-adjacent tap.
- tmux's prefix (Ctrl+Space) is a one-hand hold, not a two-hand stretch.
- zsh's `Esc Esc` sudo trick (rendered as `Ctrl+Alt+Escape` in the tables) is a
  double-tap of the same thumb.

## The vi home row is the lingua franca

H/J/K/L mean movement in every layer that has a concept of movement:

- **niri**: H/L walk columns, J/K walk windows inside a column.
- **tmux**: Alt+H/J/K/L jump panes - and copy mode is vi keys outright.
- **zsh**: NORMAL mode (Esc) is a vi line editor; `v` escalates to $EDITOR.
- **qutebrowser**: J/K are tabs, H/L history, `f` hints, gg/G top/bottom.
- **yazi / zathura**: stock navigation is vim motions already.

Arrows always work too (niri mirrors every focus bind), but the home row is the
design center.

## Modifier semantics

The same modifiers mean comparable things across layers - that is the grammar:

| modifier | in niri | in tmux | in qutebrowser |
|---|---|---|---|
| plain | focus it | prefix + one key: window/pane verbs | stock verb |
| Shift | **take it along** (move, not focus) | secondary form (U/D joins) | - |
| Ctrl | variant: carry to workspace; window-shot | resize steps after prefix | - |
| Alt | the floating exception (Mod+Alt+S) | prefix-less pane jumps | - |

Patterns worth internalizing:

- **Shift = stronger/take-along** in niri: focus → move, monitor-focus →
  monitor-move, workspace-jump → workspace-carry, screenshot-UI → full-screen.
- **Mnemonic letters over positions**: D fuzzel, B firefox, Q qutebrowser,
  E nautilus; the fold-out menus are Shift + initial (Buetooth, Wifi, Audio);
  P = power family (session menu, monitor-off).
- **qutebrowser customs hide behind the `,` leader** (and `z…` for pass-store
  fills) so the stock vocabulary can never be clobbered - case is the binding:
  `;j` is not `,J`.
- **zsh two-step prefixes**: Ctrl+X then a letter (b buffer, p path), Esc Esc
  for sudo.

## Deliberately unbound and deliberately different

Some non-bindings are load-bearing:

- **Mod+S in niri is free** (freed in commit 138da3c) - do not rebind it
  without checking with Stefan first.
- **niri declares binds from scratch**: stock assignments like Mod+Q =
  close-window do not exist; close is Mod+X.
- **qutebrowser stock M/m** (bookmark-add, quickmark-save) stay untouched by
  customs, by design.
- **The mic mute key works only unlocked** - a lock screen shouldn't flip mic
  state; every other hardware key works while locked.
- **Mod+Ctrl+Shift+I** hands the whole keyboard to the focused window (VMs,
  remote desktops) - the one escape hatch that silences this grammar itself.

## How this manual stays honest

Keybind data is *extracted* from the live config (`just update-docs` in
nixos_config): keys, commands and file:line provenance are mechanical truth.
The structure you are reading - groups, labels, the prose on this site - is a
hand-maintained layer in `nixos_config/scripts/extract/manual/`. The extractor
cross-checks both directions and refuses to publish if they drift: a new bind
that nobody has curated, or a curated entry whose bind is gone, fails the sync.
Binds set by this config render with an accent border on their key chips;
plain-bordered rows are upstream stock defaults.
The tables can therefore be trusted exactly as far as the config can - and no
further than the last sync.