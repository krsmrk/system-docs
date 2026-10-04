---
title: "Neovim: keymap and sandbox"
slug: neovim
summary: the Space-leader scheme, where each plugin's keys live, and how v / va / V decide what nvim can touch.
order: 13
app: nvim
---

Config: `~/.config/nvim` (yadm, plain Lua with lazy.nvim). The scheme is
documented at the top of `core/keybindings.lua`; the
[Neovim app page](../apps/nvim.html) lists every bind, and the extractor refuses
to publish if a `<leader>` map exists that the page does not list.

## The scheme: every key is a first letter

Space is the leader. Each group key is the first letter of a word, so you can
reconstruct a bind instead of memorising it:

| group | word | lives in |
|---|---|---|
| `Space a` | **a**ssistant - CodeCompanion chat and inline edits | `plugins/ai.lua` |
| `Space c` | **c**ode - what the `gr*` defaults do not cover | `snacks`, `conform`, `neogen` |
| `Space d` | **d**ebug - gdb words: b c n s f q | `plugins/dap.lua` |
| `Space f` | **f**ind - pickers; they close after you choose | `plugins/snacks.lua` |
| `Space g` | **g**it - hunks, blame, diffs, lazygit | `plugins/git.lua`, `snacks` |
| `Space l` | **l**ists - trouble panels that stay open | `plugins/trouble.lua` |
| `Space o` | **o**ptions - toggles; which-key shows on/off | `plugins/snacks.lua` |
| `Space p` | **p**i - your agent CLI via sidekick | `plugins/ai.lua` |
| `Space s` | **s**ubstitute - project-wide search and replace | `plugins/grug-far.lua` |
| `Space t` / `Space u` | **t**erminal / **u**ndo tree | `snacks`, `core/keybindings.lua` |

Two rules cover most of the rest:

- **Double tap is the group's main action**: `Space f f` files, `Space g g`
  lazygit, `Space a a` chat, `Space p p` the agent, `Space s s` substitute.
- **Shift widens the scope**: `Space f s` / `Space f S` file / workspace
  symbols, `Space g b` / `Space g B` line / file blame, `Space l d` /
  `Space l D` file / workspace diagnostics.

Pause after Space and which-key shows the group.

## What stays Neovim's own

The built-in LSP keys keep their meaning - `K` hover, `grn` rename, `gra` code
action, `[d` / `]d` diagnostics, `an` / `in` incremental selection. Five of them
open a snacks picker instead of the quickfix list (`gd`, `grr`, `gri`, `grt`,
`gO`), and jump straight there on a single hit. Everything else you reach for
is a small addition: `]r` / `[r` walk references of the word under the cursor,
`]h` / `[h` walk git hunks, `s` / `S` are flash (jump by label), `-` opens the
parent directory in oil.

mini.ai adds text objects: `f` function, `c` class, `u` call, `g` whole buffer
(`vif`, `dac`, `cig`). The "next / last" variants moved to `aN` `iN` `aL` `iL`,
so `n` and `l` stay free.

## Three ways to start it

| alias | what you get |
|---|---|
| `v` | `nvim-sandbox`: nvim inside a nono (Landlock) sandbox. The project is read-write; `~/.ssh`, `~/.gnupg`, the password store, other projects and shell configs are out of reach; no D-Bus, niri or tmux sockets. **No AI keys.** |
| `va` | the same sandbox plus the AI provider keys (CodeCompanion), fetched from pass / op before the sandbox is entered |
| `V` | plain unsandboxed nvim - for dotfiles and agent (sidekick / phi) sessions |

`fv` (fzf → file) opens through the sandbox. Sidekick (`Space p`) is off
inside the sandbox by design, and the system clipboard is opt-in with
`NVIM_SANDBOX_CLIPBOARD=1`, because the Wayland socket would let any plugin read
whatever you copied. Without `nono`, or with `$HOME` as the project root
(yadm dotfiles), the wrapper warns and runs plain nvim.

## Updating plugins without trusting day zero

Plugin updates go through a cooldown: `:LazyCooldown [days]` only lets an
update through once the commit has been seen for a week, tracked in
`~/.local/state/nvim/lazy-cooldown.json`, and `lazy-lock.json` pins every
plugin. The blink.cmp binary is built from source, and tools (LSP servers,
formatters) come from Nix first - Mason is only the fallback.

## AI keys

Providers (ollama cloud, openrouter, and requesty on the work profile) live in
`core/ai-providers.lua`, a yadm alternate per class that mirrors phi's config.
With `va` the wrapper reads the routes from that file and hands the keys in as
`NVIM_SANDBOX_KEY_<ROUTE>`; `core/sandbox-keys.lua` moves them out of the
environment at startup so child processes never inherit them. In a proposed
diff, `ga` accepts, `gA` accepts everything in the buffer and `gx` rejects.
