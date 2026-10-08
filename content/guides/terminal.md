---
title: "Terminal: ghostty and tmux"
slug: terminal
summary: ghostty, tmux prefix, persistent sessions, sessionizer
order: 5
app: tmux
verified: 0bd451a
ignore-keys: Ctrl+Space Ctrl+s, Ctrl+Space Ctrl+r
---

**ghostty** is the terminal emulator; **tmux** runs inside it and manages
sessions, windows and panes. Full binding tables are on the
[ghostty](../apps/ghostty.html) and [tmux](../apps/tmux.html) app pages.

## ghostty

`Mod+Return` and `Mod+T` open a ghostty window. Terminal apps launched from
fuzzel (`Mod+D`), the session menu (`Mod+P`) and sysmenu (`Mod+Shift+U`) run in
`ghostty -e`. Config: `~/.config/ghostty/config` (yadm).

- Font: Iosevka Skiouros 11 pt, with all four styles set explicitly; cells are
  stretched 5 % in both directions. Theme Nordfox, no window padding, flat
  Adwaita toolbar.
- `F11` toggles fullscreen, in addition to stock `Ctrl+Return`.
- Shell integration for zsh (`cursor,title,path,ssh-env,ssh-terminfo`) marks
  prompts, so `Ctrl+Shift+PageUp` / `Ctrl+Shift+PageDown` jump between
  commands. On the first SSH connection to a host, ghostty installs the
  `xterm-ghostty` terminfo there and falls back to `xterm-256color` if that
  fails. `ghostty +ssh-cache` lists the hosts set up so far.
- Closing a surface does not ask for confirmation (`confirm-close-surface = false`).

| keys | action |
|---|---|
| `Ctrl+Shift+C` / `Ctrl+Shift+V` | Copy selection / paste clipboard |
| `Shift+PageUp` / `Shift+PageDown` | Scroll one page |
| `Ctrl+Shift+F` | Search scrollback (`Escape` ends the search) |
| `Ctrl+Equal` / `Ctrl+Minus` / `Ctrl+0` | Font size up / down / reset |
| `Ctrl+Shift+P` | Open command palette |
| `Ctrl+Comma` / `Ctrl+Shift+Comma` | Open / reload config |
| `Ctrl+Shift+J` | Save screen to a temp file, paste its path |

ghostty tabs (`Ctrl+Shift+T`) and splits (`Ctrl+Shift+O`, `Ctrl+Shift+E`)
work, but tmux handles windows and panes here.

## tmux prefix and sessions

The prefix is Ctrl+Space (Caps Lock held plus Space); stock `C-b` is
unbound. `Ctrl+Space Ctrl+Space` sends a literal Ctrl+Space to the pane.
`Ctrl+Space ?` lists all bindings; `Ctrl+Space /` followed by a key shows what
that key does.

```bash
t              # tmux new-session -A -s main: attach to "main" or create it
ta             # attach to the most recent session
tms            # sessionizer, see below
```

Config: `~/.config/tmux/tmux.conf` (yadm). `Ctrl+Space R` reloads it and shows
"Reloaded." in the status line. Windows and panes are numbered from 1, windows
renumber when one closes, and automatic renaming is off: rename a window with
`Ctrl+Space ,`. The status bar is at the top, with the session name on the
right.

### Session persistence

The resurrect and continuum plugins come from nixpkgs (`tmuxPlugins.resurrect`,
`tmuxPlugins.continuum` in the system config) and are loaded by `run-shell` at
the end of `tmux.conf`.

- continuum saves every 15 minutes while a client is attached, to timestamped
  files in `~/.tmux/resurrect/`; `last` points to the newest.
- `@continuum-restore` is on: the first tmux server after boot restores the
  last save. Run `t` after login to get the layout back.
- A save contains sessions, windows, panes, layouts, each pane's cwd, and
  programs from resurrect's default list (vi/vim/nvim, man, less, tail, top,
  htop and a few more). Other programs come back as a shell in the same
  directory. Shell history and pane contents are not saved.
- `Ctrl+Space Ctrl+s` saves, `Ctrl+Space Ctrl+r` restores the last save. The
  plugin binds these, so they are missing from the app page tables.

### Sessionizer

`tms` (in `~/.zsh_aliases`) passes zoxide's directory list through fzf and
opens a session named after the chosen directory's basename. Outside tmux it
attaches or creates (`new-session -A`); inside tmux it creates the session if
needed and switches to it (`switch-client`). `Ctrl+Space s` opens the stock
session browser, `Ctrl+Space d` detaches.

## Windows and panes

| keys | action |
|---|---|
| `Ctrl+Space c` | New window in the pane's cwd |
| `Ctrl+Space Space` | Switch to last window |
| `Ctrl+Space 1` … `9`, `Ctrl+Space w` | Go to window N / open tree browser |
| `Ctrl+Space \|` / `Ctrl+Space _` | Split side by side / stacked, same cwd |
| `Alt+h` `Alt+j` `Alt+k` `Alt+l` | Focus pane left / down / up / right (no prefix) |
| `Ctrl+Space Ctrl+h` … `Ctrl+Space Ctrl+l` | Resize pane by 8 (repeatable while Ctrl is held) |
| `Ctrl+Space l` | Cycle preset layouts |
| `Ctrl+Space z` | Toggle pane zoom |
| `Ctrl+Space x` | Kill pane without confirmation |
| `Ctrl+Space m` / `` Ctrl+Space ` `` | Mark pane (red border) / jump to marked pane |
| `Ctrl+Space j` / `Ctrl+Space J` | Pull a pane from another window, beside / below |
| `Ctrl+Space g` | Open lazygit in a 90 % popup at the pane's cwd |
| `Ctrl+Space h` | Open scratch notes (`~/scratch/notes.md` in nvim) in a side split |

The mouse is enabled: click focuses a pane, drag selects, the wheel scrolls
history (24000 lines per pane). The ghostty window title follows the pane
title, which zsh sets to the running command, or to the cwd when idle.

## Copy mode

`Ctrl+Space [` enters copy mode with vi keys; `Ctrl+Space PageUp` enters it
half a page up. Motions and search are vim's (`h j k l w b 0 $ gg G`, `/`, `?`,
`n`, `N`).

| keys | action |
|---|---|
| `v` | Start selection (stock: `Space`) |
| `r` | Toggle rectangle selection |
| `y` | Yank selection and exit copy mode |
| `q` | Exit without yanking |
| `Ctrl+Space P` | Paste most recent buffer |

Yanks go to the tmux buffer and the Wayland clipboard: with `set-clipboard on`,
tmux writes the clipboard through OSC 52, which ghostty forwards after asking
for permission once. Mouse drag-and-release and double or triple click copy the
same way.

## Troubleshooting

| symptom | fix |
|---|---|
| Config edit has no effect | `Ctrl+Space R`, or `tmux source ~/.config/tmux/tmux.conf` |
| Pane border is red | The pane is marked: `Ctrl+Space m` toggles, `Ctrl+Space M` clears |
| tmux is unresponsive | `tmux kill-server`; the next `t` restores the last continuum save |
| Restore brings back a stale layout | Fix the layout, then save with `Ctrl+Space Ctrl+s` |

See also: [shell tricks](./shell-tricks.html) for zsh ·
[keyboard conventions](./keyboard-grammar.html) for Caps Lock as Ctrl ·
[niri workflows](./niri-workflows.html) for the compositor's terminal bindings.
