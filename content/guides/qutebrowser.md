---
title: "qutebrowser: default browser"
slug: qutebrowser
summary: modes, ad blocking, pass logins, userscripts, sessions
order: 8
app: qutebrowser
verified: 0bd451a
---

Config: [`nixos_config/modules/home/qutebrowser.nix`](https://github.com/krsmrk/nixos_config/blob/main/modules/home/qutebrowser.nix)
(home-manager module, with vendored userscripts in the same directory).
`Mod+Q` launches it, and it is the default `x-scheme-handler/https` handler,
so `xdg-open` opens URLs in it. Firefox remains installed as a fallback for
sites that need extension-based blocking such as uBlock Origin.

The [qutebrowser app page](../apps/qutebrowser.html) lists all custom bindings
and the stock bindings of qutebrowser 3.7.0, by mode.

## Modes

- **Normal mode:** `o` opens a URL from the status bar prompt, `O` in a new
  tab, `wo` in a new window. Text that is not a URL is searched with the
  default engine, qwant. Other engines take a short prefix: ddg, ghs, nws,
  aws, no, hm, w (see `url.searchengines` in `:set`).
- **Hint mode:** `f` labels every clickable element; type a label to follow
  it. `F` opens in a new tab, `;y` yanks the URL, `;d` downloads. `Esc` exits.
- **Command mode:** `:` opens the command line. `Tab`/`Shift+Tab` select a
  completion, `Enter` runs the command.
- **Insert mode:** `i` types into form fields; `Ctrl+E` opens the field in
  nvim (see below).
- **Caret mode:** `v` selects text with vim motions (`h j k l w e b 0 $`);
  `y` yanks it.

## Quickmarks, bookmarks, sessions

- `m` saves the current page as a **quickmark** under a key. `b`, `B` and `wb`
  open a quickmark in the current tab, a new tab or a new window. Predefined
  in `url.quickmarks`: `gh` (GitHub), `nw` (NixOS wiki), `sd` (system docs),
  `aw` (AWS console), `no` (nixpkgs), `hm` (home-manager options), `qb`
  (qutebrowser docs).
- `M` adds a bookmark. `Sb` opens the searchable bookmark list.
- Tabs are not restored at startup; the start page is the system manual. Save
  and load sessions manually:

  ```
  :session-save work        # save all tabs
  :session-load work        # restore
  :session-delete work
  :session-load _autosave   # crash recovery, saved every 15 s
  ```

  `session.lazy_restore` is on: restored tabs load when first focused.

## Ad blocking and per-site settings

Brave's ABP engine (EasyList and EasyPrivacy, auto-updated) and the StevenBlack
hosts list (ads, fakenews, gambling, porn, social; pinned in the Nix store) run
together.

To fix a broken site:

- `,u` toggles ad blocking for the current host and reloads.
- `;j` toggles JavaScript for the current host.
- The stock `t` bindings toggle a setting per site. The second letter picks the
  setting: `s` JavaScript, `p` plugins, `i` images, `c` cookies; lowercase is
  temporary, uppercase is saved. The third letter picks the scope: `h` host,
  `H` host and subdomains, `u` exact URL. Example: `tSH` saves JavaScript on
  for the host and its subdomains.

Saved per-site settings are stored in `autoconfig.yml`. Remove one with
`:config-unset -u *://example.com/* <option>`, or edit the file.

## Logins with pass

`zl` opens fuzzel over the pass store and fills username and password.
`zul` and `zpl` fill only the username or password, `zol` only the OTP code
(`pass-otp`; add entries with `pass otp insert`). The entry path must contain
the site's domain: `web/github.com/stefan` matches github.com. The script
types into the form and does not use the clipboard.

## Userscripts

Vendored from upstream (GPLv3) in `nixos_config/modules/home/qutebrowser-userscripts/`
and wrapped with pinned runtime dependencies.

| binding | script | action |
| --- | --- | --- |
| `,m` | view_in_mpv | Play the page's videos in mpv (yt-dlp backend); the page stays usable and a click restores the placeholders |
| `,r` | readability | Open reader mode in a new tab, styled with the Nord palette |
| `,q` | qr | Show the current URL as a QR code in a new tab |

## Text fields and file pickers

- `Ctrl+E` in a text field opens it in nvim in a ghostty window
  (`editor.command`), with the cursor at the same position. Save and quit to
  send the text back.
- Upload forms open yazi in ghostty for single-file, multi-file and folder
  selection (`fileselect.*`). `Space` selects, `Enter` accepts.
- Downloads prompt for a location, with yazi-based folder completion.
  `Ctrl+p` in the prompt opens a PDF in PDF.js instead. Files opened from the
  downloads list go to zathura.

## Appearance

Nord colors. The tab bar is on top and hidden when only one tab is open; the
status bar matches waybar; hints and completions are cyan. `,b` toggles the status
bar, for example when watching video. `,d` switches the preferred color
scheme for sites that only support one.

## Wayland rendering problems

The config sets `qt.force_platform = "wayland"`. If a site renders badly or a
Qt upgrade breaks rendering, run `:config-unset qt.force_platform` and then
`:restart` to fall back to XWayland. Revert with
`:config-set qt.force_platform wayland`.
