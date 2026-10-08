---
title: Shell tricks (zsh)
slug: shell-tricks
summary: vi mode, atuin, fzf, aliases and functions
order: 6
app: zsh
verified: 0bd451a
---

Config: `~/.zshrc` and `~/.zsh_aliases` (yadm). `reload` restarts the shell
after an edit.

## vi mode

`bindkey -v` with `KEYTIMEOUT=1`, so Esc switches to normal mode without the
default 0.4 s delay. `i`, `a` or `o` return to insert mode.

| key (mode) | action |
|---|---|
| `v` (normal) | Edit the command line in `$EDITOR` (edit-command-line) |
| `Esc Esc` (any) | Toggle a `sudo` prefix; on an empty line, rerun the last command with sudo |
| `Alt+q` (any) | Push line: park the command, run another, get it back at the next prompt |
| `Ctrl+X b` (any) | Copy the command line to the clipboard (copybuffer) |
| `Ctrl+X p` (any) | Copy the cwd to the clipboard (copypath) |
| `/` (normal) | Open atuin history search |
| `Ctrl+R` (any) | Open atuin history search |

## Autosuggestions

zsh-autosuggestions shows the suggestion as inline ghost text. `Alt+f` /
`Ctrl+F` accept one word, `End` / `Ctrl+E` accept the whole suggestion, `→`
accepts one character. The word bindings use `forward-word` so they work in
vi mode.

## fzf

| key | action |
|---|---|
| `Tab` | Classic completion, with fzf's `**` trigger (`cd **<Tab>`, `kill **<Tab>`) |
| `Shift+Tab` | fzf-tab fuzzy completion menu |
| `Ctrl+T` | Pick a file (bat preview) and insert its path |
| `Alt+c` | Fuzzy cd (eza tree preview) |
| `Ctrl+G f` / `Ctrl+G b` / `Ctrl+G h` | fzf-git: insert files, branches, commit hashes |
| `Ctrl+G t` / `Ctrl+G r` / `Ctrl+G s` | fzf-git: insert tags, remotes, stashes (`Ctrl+G ?` lists all; holding Ctrl on the second key also works) |

Completion is case-insensitive, matches across `-`, `.` and `_`, and has an
arrow-key menu. fzf-tab group labels use Nord colors. `auto_pushd` is on:
`cd -<Tab>` completes the directory stack, and `cd -2` goes back two
directories.

## atuin

atuin stores shell history in an encrypted database synced across machines.
`~/.histfile` is still written and feeds autosuggestions. `Ctrl+R` or `/` opens
the full-screen search: type to filter, Enter runs. Config:
`~/.config/atuin/config.toml` (stock defaults).

## Aliases

**Listing and navigation:** `ll`, `la`, `lt` (tree) via lsd · `..`, `...`,
`....` · `-` (previous directory) · `mkcd <dir>` · named directories
`~cfg` = `~/nixos_config` and `~dev` = `~/dev` (both complete) ·
`cdpath=(~/dev)`, so `cd phi` works from any directory.

**Replacements**

| alias | runs |
|---|---|
| `cat` | `bat --paging=never` (`\cat` for the original) |
| `top` | `btop` |
| `df` | `duf` (`\df` for GNU df) |
| `diff` | `git diff --no-index` |
| `dus` | `dua` (`dua i` for interactive cleanup) |
| `v` / `va` / `V` | `nvim-sandbox` / sandbox with AI keys / plain `nvim` ([Neovim guide](./neovim.html)) |
| `t` | tmux: attach to `main` or create it |
| `o` | `xdg-open` |
| `c` | `clear` |

**Global aliases** (expand anywhere in a line): `G` `| grep`, `L` `| less -R`,
`H` `| head`, `T` `| tail`, `C` `| wc -l`, `J` `| jq`, `X` `| xargs`,
`.F` `| fzf`, `N2` `2>/dev/null`, `DN` `>/dev/null 2>&1`, `Y` `| wl-copy`.

**git:** `g` (git), `gs`/`gss` (status), `gaa`, `gcm` (commit -m), `gc!`
(amend), `gp`, `gpsup` (push and set upstream), `gl` (graph log), `gd`/`gds`
(side-by-side delta), `gco`/`gsw`, `gpl` (pull --rebase --autostash), `gundo`
(soft reset by one commit), `lg` (lazygit), `gcof` (fzf branch picker).

**NixOS:** `nrs` (`nh os switch`), `nrt` (`nh os test`: activate without
changing the boot default), `nrc` (`nh os boot`), `nclean` (`nh clean all`),
`nss` (search nixpkgs), `ns nixpkgs#foo` (ad-hoc shell), `nd` (devshell),
`gen-diff`, `gen-list`, `j`/`jr` (just / just --list).

**systemd:** `jctl`, `jctlf <unit>` (follow), `jctle` (errors this boot),
`sysfailed` (failed units), `scu` (user units), `pgfl`.

**Functions:** `bak <file>` (timestamped copy), `tmpd` (cd into a new scratch
directory), `ex <archive>` (extract via ouch), `fv` (fzf, then open in
sandboxed nvim), `fkill` (fzf, then kill), `tms` (tmux sessionizer),
`weather`, `myip`, `http-serve` (serve the cwd on localhost:8000).

## Other tools

- **zmv:** `zmv -n '(*).jpeg' '$1.jpg'` renames by pattern; `-n` is a dry run.
- **notify:** prefix a command with `notify` (`notify nh os switch`) to get a
  swaync notification when it finishes, if it ran for 30 s or longer. For
  pipelines: `notify zsh -c 'make && ./test.sh'`. Commands without the prefix
  never notify.
- **carapace** adds completions for many CLIs on top of compinit.
- **nix-your-shell** makes `nix develop` and `nix shell` start zsh.

See also: [terminal](./terminal.html) (ghostty and tmux) ·
[dev-workflow](./dev-workflow.html) (direnv and devshells) ·
[maintenance](./maintenance.html) (`nrs` and `j` recipes).
