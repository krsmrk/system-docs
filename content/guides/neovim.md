---
title: "Neovim: keymap and sandbox"
slug: neovim
summary: Space-leader groups, plugin keys, sandboxed launchers
order: 13
app: nvim
---

Config: `~/.config/nvim` (yadm; Lua with lazy.nvim). The keymap scheme is
described at the top of `core/keybindings.lua`. The
[Neovim app page](../apps/nvim.html) lists every binding.

## Leader groups

Space is the leader. Each group key is the first letter of the group's name:

| group | name | defined in |
|---|---|---|
| `Space a` | **a**ssistant: CodeCompanion chat and inline edits | `plugins/ai.lua` |
| `Space c` | **c**ode: actions not covered by the `gr*` defaults | `snacks`, `conform`, `neogen` |
| `Space d` | **d**ebug: gdb letters b c n s f q | `plugins/dap.lua` |
| `Space f` | **f**ind: pickers that close after a choice | `plugins/snacks.lua` |
| `Space g` | **g**it: hunks, blame, diffs, lazygit | `plugins/git.lua`, `snacks` |
| `Space l` | **l**ists: trouble panels that stay open | `plugins/trouble.lua` |
| `Space o` | **o**ptions: toggles, with on/off state in which-key | `plugins/snacks.lua` |
| `Space p` | **p**i: the Pi agent CLI (via phi) in a sidekick terminal | `plugins/ai.lua` |
| `Space s` | **s**ubstitute: project-wide search and replace | `plugins/grug-far.lua` |
| `Space t` / `Space u` | **t**erminal / **u**ndo tree | `snacks`, `core/keybindings.lua` |

Within a group:

- Pressing the group key twice runs its main action: `Space f f` files,
  `Space g g` lazygit, `Space a a` chat, `Space p p` the agent, `Space s s`
  substitute.
- Shift widens the scope: `Space f s` / `Space f S` file / workspace symbols,
  `Space g b` / `Space g B` line / file blame, `Space l d` / `Space l D`
  file / workspace diagnostics.

which-key shows a group's bindings after a short pause.

## Built-in keys

The default LSP keys are unchanged: `K` hover, `grn` rename, `gra` code action,
`[d` / `]d` diagnostics, `an` / `in` incremental selection. `gd`, `grr`, `gri`,
`grt` and `gO` open a snacks picker instead of the quickfix list and jump
directly on a single result.

Additions without the leader: `]r` / `[r` go to the next / previous reference
of the word under the cursor, `]h` / `[h` go to git hunks, `s` / `S` jump with
flash labels, `-` opens the parent directory in oil.

mini.ai adds text objects: `f` function, `c` class, `u` call, `g` whole buffer
(`vif`, `dac`, `cig`). Its next / last variants are on `aN` `iN` `aL` `iL`,
which keeps `n` and `l` free.

## Launchers

| alias | runs |
|---|---|
| `v` | `nvim-sandbox`: nvim in a nono (Landlock) sandbox. The project is read-write. `~/.ssh`, `~/.gnupg`, the password store, other projects and shell configs are inaccessible; D-Bus and the niri and tmux sockets are blocked. No AI keys. |
| `va` | The same sandbox plus the AI provider keys for CodeCompanion, read from pass / op before entering the sandbox |
| `V` | Unsandboxed nvim, for dotfiles and agent sessions (sidekick / phi) |

`fv` (fzf file picker) opens files in the sandbox. Sidekick (`Space p`) is
disabled inside the sandbox. The system clipboard is off unless
`NVIM_SANDBOX_CLIPBOARD=1` is set, because access to the Wayland socket lets
any plugin read the clipboard. If `nono` is missing or the project root is
`$HOME` (yadm dotfiles), the wrapper prints a warning and runs plain nvim.

## Plugin updates

`lazy-lock.json` pins every plugin. `:LazyCooldown [days]` updates a plugin
only to a commit that was first seen at least that many days ago (default 7),
tracked in `~/.local/state/nvim/lazy-cooldown.json`. The blink.cmp binary is
built from source. LSP servers and formatters come from Nix; Mason is the
fallback.

## AI keys

Providers (ollama cloud, openrouter, and requesty on the work profile) are
defined in `core/ai-providers.lua`, a per-class yadm alternate that mirrors
phi's config. With `va`, the wrapper reads the routes from that file and
passes the keys as `NVIM_SANDBOX_KEY_<ROUTE>`. At startup
`core/sandbox-keys.lua` removes them from the environment so child processes
do not inherit them.

In a proposed diff, `ga` accepts the change, `gA` accepts all changes in the
buffer, and `gx` rejects.
