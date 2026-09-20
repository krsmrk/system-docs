---
title: qutebrowser: daily-driver browser
slug: qutebrowser
summary: The keyboard-driven browser as default: ABP + hostlist blocking, pass-store logins, userscripts, manual sessions.
order: 8
---

Configured in [`nixos_config/modules/home/qutebrowser.nix`](https://github.com/krsmrk/nixos_config/blob/main/modules/home/qutebrowser.nix)
(home-manager module; userscripts vendored next to it). Launch with **Mod+Q**,
or any URL handed to `xdg-open` — qutebrowser is the `x-scheme-handler/https`
default. Firefox stays installed as the fallback for extension-grade blocking
(uBlock Origin et al.), not for daily use.

The full binding reference — custom binds (accent-bordered key chips) plus
the stock defaults of qutebrowser 3.7.0, per mode, in one thematic table set — is the
[qutebrowser app page](/apps/qutebrowser.html). This guide covers the
workflows on top.

## Modes in 30 seconds

qutebrowser is vim for the web. Normal mode is where you live:

- `o` opens a URL in the statusbar prompt (with search-engine completion),
  `O` in a new tab, `wo` in a window. With no URL typed, the prompt
  pre-fills `:open` and you type a search — the default engine is **qwant**,
  with ddg/ghs/nws/aws/no/hm/w as one-letter engines (see `:set`
  `url.searchengines`).
- `f` enters **hint mode**: every clickable element gets a two-letter tag;
  type it to follow. `F` opens in a new tab, `;y` yanks the URL, `;d`
  downloads. `Esc` leaves.
- `:` enters command mode — completion works like fuzzel (`Tab`/`Shift+Tab`
  to select, `Enter` runs). Everything on the app page is a command.
- `i` (insert mode) is for typing into web forms; **Ctrl+E** there opens the
  focused text field in **nvim via ghostty** (the `editor.command` setting).
  Save and quit to push the text back.
- `v` is caret mode: vim motions (`h j k l w e b 0 $`) select text
  keyboard-only; `y` yanks it.

## Quickmarks, bookmarks, sessions

- `m` saves the current page as a **quickmark** under a key; `b`/`B`/`wb`
  load it in the current tab / a new tab / a new window. Curated set in
  `url.quickmarks`: `gh` (github), `nw` (nixos wiki), `sd` (system docs),
  `aw` (aws console), `no` (nixpkgs), `hm` (home-manager options), `qb`
  (qutebrowser docs). `b` + the key jumps straight there.
- `M` bookmarks a page (GUI list via `Sb`, searchable).
- Sessions are **manual** (no state restored at startup — the start page is
  the system manual):

  ```
  :session-save work        # snapshot all tabs
  :session-load work        # restore (lazy: tabs fetch when focused)
  :session-delete work
  :session-load _autosave   # crash recovery — checkpointed every 15s
  ```

  `session.lazy_restore` is on, so a 40-tab session loads instantly and
  fetches tabs as you focus them.

## Blocking & per-site control

Two engines run side by side: **Brave's ABP engine** (EasyList/EasyPrivacy,
auto-updated) and a **StevenBlack hosts list** (ads + fakenews + gambling +
porn + social, ~170k domains, pinned in the store).

When a site breaks:

- `,u` toggles **ad blocking** for the current host (and reloads).
- `;j` toggles **JavaScript** for the current host.
- The stock `t`-prefixed family toggles JS/plugins/images/cookies for host,
  host+subdomains or exact URL — `ts` for JavaScript (`tsh` temp,
  `tSH` host+subdomains, `tsu` exact URL), `tc` for cookies, etc.

All per-site toggles land in `autoconfig.yml` — undo one with
`:config-unset -u *://example.com/* <option>`, or edit that file.

## Login filling (pass + fuzzel)

`zl` opens **fuzzel** over your pass store and fills username + password.
`zul`/`zpl` fill a single field, `zol` fills an OTP code (`pass-otp`). The
site's domain must appear in the pass path — e.g. `web/github.com/stefan`
is found on github.com. Insert OTP entries with `pass otp insert`. The
script types into the form directly — nothing lands on the clipboard.

## Userscripts

Vendored from upstream (GPLv3) in `nixos_config/modules/home/qutebrowser-userscripts/`,
wrapped with pinned runtime deps:

| Bind | Script | What it does |
| --- | --- | --- |
| `,m` | view_in_mpv | Moves the page's videos into **mpv** (yt-dlp backend); the page itself stays usable — placeholders restore on click |
| `,r` | readability | Reader mode in a new tab, restyled with the Nord palette |
| `,q` | qr | Renders the current URL as a QR code in a tab — scan it to continue on the phone |

## Text editing & file pickers

- **Ctrl+E** in any web text field opens it in ghostty + nvim (cursor lands
  on your position). Save and close to push the text back.
- Upload forms open **yazi in ghostty** — single/multi-file and folder
  pickers (`fileselect.*`). Pick files with Space, accept with Enter.
- Downloads prompt for a location (yazi-based folder completion applies);
  `Ctrl+p` inside the prompt previews PDFs via PDF.js instead. zathura
  handles everything you open from the downloads list.

## Nord chrome

Tabs on top (auto-hidden to one line), statusbar matching waybar, cyan
hints/completions. `,b` toggles the statusbar when watching something
fullscreen-ish, `,d` flips the preferred color scheme for sites that only
ship one.

## When Wayland rendering misbehaves

The config pins `qt.force_platform = "wayland"`. On a broken site or after a
Qt upgrade glitch: `:config-unset qt.force_platform` then `:restart` — falls
back to XWayland. Put it back with `:config-set qt.force_platform wayland`.