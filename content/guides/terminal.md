---
title: "Terminal: ghostty and tmux"
slug: terminal
summary: ghostty essentials, the Ctrl+Space prefix, sessions that survive reboots, and the sessionizer.
order: 5
app: tmux
verified: 0bd451a
ignore-keys: Ctrl+Space Ctrl+s, Ctrl+Space Ctrl+r
---

Two layers: **ghostty** draws the window, **tmux** owns what runs inside it.
The full bind tables are on the [ghostty](../apps/ghostty.html) and
[tmux](../apps/tmux.html) app pages; this guide is the workflow on top.

## ghostty

`Mod+Return` or `Mod+T` opens a window (both spawn `ghostty`). Terminal apps
launched from fuzzel (`Mod+D`) run in `ghostty -e`, as do the session menu
(`Mod+P`) and sysmenu (`Mod+Shift+U`). Config: `~/.config/ghostty/config`
(yadm-managed).

- Font is **Iosevka Skiouros** at 11 pt, all four styles named explicitly;
  cells are stretched 5 % in both directions. Theme **Nordfox**, zero window
  padding, flat Adwaita toolbar.
- `F11` toggles fullscreen - the one custom bind, added next to stock
  `Ctrl+Return`.
- **Shell integration** is on for zsh (`cursor,title,path,ssh-env,ssh-terminfo`):
  prompts are marked, so `Ctrl+Shift+PageUp` / `Ctrl+Shift+PageDown` jump
  between previous commands. The ssh helpers install `xterm-ghostty`'s terminfo
  on a remote host at first connect and fall back to `xterm-256color` when that
  fails; `ghostty +ssh-cache` lists what has been set up.
- Closing a surface never asks for confirmation (`confirm-close-surface = false`).

| keys | action |
|---|---|
| `Ctrl+Shift+C` / `Ctrl+Shift+V` | copy selection / paste clipboard |
| `Shift+PageUp` / `Shift+PageDown` | scroll the scrollback a page |
| `Ctrl+Shift+F` | search the scrollback (`Escape` ends it) |
| `Ctrl+Equal` / `Ctrl+Minus` / `Ctrl+0` | font size up / down / reset |
| `Ctrl+Shift+P` | command palette (every action, searchable) |
| `Ctrl+Comma` / `Ctrl+Shift+Comma` | open / reload the config |
| `Ctrl+Shift+J` | write the pane contents to the clipboard |

Tabs (`Ctrl+Shift+T`) and splits (`Ctrl+Shift+O`, `Ctrl+Shift+E`) exist, but
tmux owns that job here.

## tmux: prefix and sessions

The prefix is **Ctrl+Space** (stock `C-b` is unbound). Under keyd that is Caps
Lock held plus Space, one hand. `Ctrl+Space Ctrl+Space` sends a literal
Ctrl+Space through to the pane. `Ctrl+Space ?` lists every bind,
`Ctrl+Space /` then a key tells you what that key does.

```bash
t              # tmux new-session -A -s main: attach "main" or create it
ta             # attach the most recent session
tms            # sessionizer, see below
```

Config: `~/.config/tmux/tmux.conf` (yadm). `Ctrl+Space R` reloads it and
confirms with "Reloaded." in the status line. Windows and panes count from 1,
windows renumber when one closes, and automatic renaming is off - a window is
called what you named it (`Ctrl+Space ,`). The status bar sits at the top and
shows the session name on the right.

### Surviving reboots

resurrect and continuum come from nixpkgs (`tmuxPlugins.resurrect`,
`tmuxPlugins.continuum` in the system config) and are loaded by `run-shell`
at the end of `tmux.conf`.

- **continuum auto-saves every 15 minutes** (plugin default) while a client is
  attached, into `~/.tmux/resurrect/` as timestamped text files; `last` points
  at the newest.
- **Restore is automatic**: `@continuum-restore` is on, so the first tmux
  server after a boot restores the last save by itself. Run `t` after login
  and the layout is back.
- Saved: sessions, windows, panes, layouts, each pane's cwd, and running
  programs from resurrect's default list (vi/vim/nvim, man, less, tail, top,
  htop and a few more). Shell history and pane contents are **not** saved;
  other programs come back as an empty shell in the right directory.
- Manual: `Ctrl+Space Ctrl+s` saves now, `Ctrl+Space Ctrl+r` restores the
  last save (plugin defaults; these two are bound by the plugin, so they do not
  appear in the extracted tables).

### The sessionizer: `tms`

`tms` (in `~/.zsh_aliases`) pipes zoxide's frecency list through fzf and turns
the pick into a session named after the directory's basename: outside tmux it
attaches or creates (`new-session -A`), inside tmux it creates the session if
needed and `switch-client`s to it. One keystroke sequence from any shell to a
project session. `Ctrl+Space s` is the stock session browser, `Ctrl+Space d`
detaches.

## Windows and panes

| keys | action |
|---|---|
| `Ctrl+Space c` | new window in the pane's cwd |
| `Ctrl+Space Space` | flip to the last window and back |
| `Ctrl+Space 1` … `9`, `Ctrl+Space w` | jump to window N, tree browser |
| `Ctrl+Space \|` / `Ctrl+Space _` | split side by side / stacked, same cwd |
| `Alt+h` `Alt+j` `Alt+k` `Alt+l` | jump between panes, **no prefix** |
| `Ctrl+Space Ctrl+h` … `Ctrl+Space Ctrl+l` | resize by 8, repeatable while held |
| `Ctrl+Space l` | cycle the preset layouts |
| `Ctrl+Space z` | zoom one pane to the full window (again to undo) |
| `Ctrl+Space x` | kill the pane, no confirmation |
| `Ctrl+Space m` / `` Ctrl+Space ` `` | mark a pane (red border) / jump back to it |
| `Ctrl+Space j` / `Ctrl+Space J` | pull a pane in from another window, beside / below |
| `Ctrl+Space g` | lazygit in a 90 % popup at the pane's cwd |
| `Ctrl+Space h` | scratch notes: nvim `~/scratch/notes.md` in a side split |

The mouse is on: click focuses a pane, drag selects, the wheel scrolls into
history (24000 lines per pane). The ghostty window title follows the pane title,
which the zsh hooks set to the running command, or the cwd when idle.

## Copy mode

`Ctrl+Space [` enters copy mode with vi keys; `Ctrl+Space PageUp` enters it
half a page up. Motions are vim's (`h j k l w b 0 $ gg G`, `/` and `?` search,
`n` / `N` repeat).

| keys | action |
|---|---|
| `v` | start the selection (stock `Space`) |
| `r` | toggle rectangle selection |
| `y` | yank the selection and leave copy mode |
| `q` | leave without yanking |
| `Ctrl+Space P` | paste the most recent buffer |

Yanks land in the tmux buffer **and** the Wayland clipboard: `set-clipboard on`
lets tmux write it through OSC 52, which ghostty forwards (it asks once for
permission). Mouse drag + release and double / triple click copy the same way.

## When it misbehaves

| symptom | do this |
|---|---|
| config edit not taking effect | `Ctrl+Space R`, or `tmux source ~/.config/tmux/tmux.conf` |
| a pane border is red | it is marked - `Ctrl+Space m` toggles, `Ctrl+Space M` clears |
| everything stuck | `tmux kill-server` - the next `t` restores the last continuum save |
| restore brought back a stale layout | `Ctrl+Space Ctrl+s` after fixing it, so the next save wins |

See also: [shell tricks](./shell-tricks.html) for the zsh side of the prompt ·
[the keyboard grammar](./keyboard-grammar.html) for why Ctrl is Caps Lock ·
[niri workflows](./niri-workflows.html) for the terminal binds at the compositor layer.
