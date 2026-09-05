---
title: Shell tricks (zsh)
slug: shell-tricks
summary: vi mode, atuin, fzf-tab, and the aliases worth remembering.
order: 5
---

Sources: `~/.zshrc` and `~/.zsh_aliases` (both yadm-managed). `reload` restarts
the shell after edits.

## vi mode

`bindkey -v` with `KEYTIMEOUT=1` — Esc flips to NORMAL mode instantly (no
0.4 s lag). `i`/`a`/`o` to go back to INSERT. History and completion work in
both modes; the bindings below are wired for both where it matters.

| key (mode) | action |
|---|---|
| `v` (normal) | edit the current command line in `$EDITOR` (edit-command-line) |
| `Esc Esc` (any) | toggle `sudo` prefix on the line; empty line → sudo-repeat last command |
| `Alt+q` (any) | push-line — park the command, run something else, it pops back |
| `Ctrl+X b` (any) | copybuffer — current command line → clipboard |
| `Ctrl+X p` (any) | copypath — cwd → clipboard |
| `/` (normal) | atuin history search |
| `Ctrl+R` (any mode) | atuin history search (bound explicitly in vicmd too) |

## Suggestion acceptance

zsh-autosuggestions shows inline ghost text. `Alt+f` / `Ctrl+F` accept one word;
`End` or `Ctrl+E` accept the whole suggestion; `→` accepts one character. These
are custom `forward-word`-based bindings so they fire in vi mode.

## fzf

| key | action |
|---|---|
| `Tab` | classic completion, with fzf's `**` trigger (`cd **<Tab>`, `kill **<Tab>`) |
| `Shift+Tab` | fzf-tab's fuzzy menu completion (fzf-tab grabbed Tab, so this moved there) |
| `Ctrl+T` | fuzzy file picker, bat preview on the right |
| `Alt+C` | fuzzy cd, eza tree preview |
| `Ctrl+G` then `F/B/H/T/R/S` | fzf-git.sh: files, branches, commit hashes, tags, remotes, status — inserted into the command line |

fzf-tab stays active for everything else: case-insensitive, fuzzy matching on
`-`/`.`/`_`, arrow-key menu, Nord-colored group labels. `cd -<Tab>` completes the
numbered directory stack (auto_pushd is on; `cd -2` rewinds two dirs).

## atuin

Shell history lives in atuin's synced, encrypted database — not just
`~/.histfile` (which still feeds autosuggestions). `Ctrl+R` / `/` open the
full-screen search; type to filter, Enter to run. Config: `~/.config/atuin/config.toml`
(stock defaults). History is shared across machines via atuin sync.

## Aliases: the gems

**Listing & navigation** — `ll`, `la`, `lt` (tree) via lsd · `..`, `...`, `....` ·
`-` (previous dir) · `mkcd <dir>` · named dirs `~cfg` = `~/nixos_config`,
`~dev` = `~/dev` (complete too) · `cdpath=(~/dev)` so `cd phi` works from anywhere.

**Modern defaults**

| alias | is |
|---|---|
| `cat` | `bat --paging=never` (`\cat` for raw) |
| `top` | `btop` |
| `df` | `duf` (`\df` for GNU) |
| `diff` | `git diff --no-index` |
| `dus` | `dua` (`dua i` = interactive cleanup) |
| `v` | `nvim` |
| `t` | tmux: attach to `main` or create it |
| `o` | `xdg-open` |
| `c` | clear |

**Global aliases** — expand anywhere in a line: `G` `| grep`, `L` `| less -R`,
`H` `| head`, `T` `| tail`, `C` `| wc -l`, `J` `| jq`, `X` `| xargs`,
`.F` `| fzf`, `N2` `2>/dev/null`, `DN` `>/dev/null 2>&1`, `Y` `| wl-copy`.

**git** — `g` (git), `gs`/`gss` (status), `gaa`, `gcm` (-m), `gc!` (amend),
`gp`, `gpsup` (push + upstream), `gl` (graph log), `gd`/`gds` (side-by-side delta),
`gco`/`gsw`, `gpl` (pull --rebase --autostash), `gundo` (soft reset one),
`lg` (lazygit), `gcof` (fzf branch picker).

**NixOS** — `nrs` (`nh os switch`), `nrt` (`nh os test` — activate, boot default
untouched, the safe one), `nrc` (`nh os boot`), `nclean` (`nh clean all`),
`nss` (search nixpkgs), `ns nixpkgs#foo` (ad-hoc shell), `nd` (devshell),
`gen-diff`, `gen-list`, `j`/`jr` (just / just --list).

**systemd** — `jctl`, `jctlf <unit>` (follow), `jctle` (errors this boot),
`sysfailed` (failed units), `scu` (user units), `pgfl`.

**Handy functions** — `bak <file>` (timestamped copy), `tmpd` (cd into fresh
scratch dir), `ex <archive>` (extract via ouch), `fv` (fzf → nvim), `fkill`
(fzf → kill), `tms` (fzf sessionizer for tmux), `weather`, `myip`,
`http-serve` (cwd on localhost:8000).

## Extras worth knowing

- **zmv**: `zmv -n '(*).jpeg' '$1.jpg'` — pattern rename, `-n` = dry run.
- **Long commands notify**: anything running ≥30 s sends a swaync toast when done.
- **carapace** supplies completions for hundreds of CLIs on top of compinit.
- **nix-your-shell** makes `nix develop`/`nix shell` spawn zsh.

See also: [dev-workflow](./dev-workflow.html) (direnv + devshells) ·
[maintenance](./maintenance.html) (`nrs`/`j` recipes).