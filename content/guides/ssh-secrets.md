---
title: SSH, secrets and agents
slug: ssh-secrets
summary: ssh-agent, passphrase dialog, agent key, pass, gpg
order: 11
verified: 0bd451a
---

**ssh-agent** holds the decrypted SSH keys for the session, **gpg-agent**
caches the GPG key that unlocks `pass`, and **gnome-keyring** serves apps that
use the Secret Service API. For common failures see
[troubleshooting](./troubleshooting.html).

## SSH key and session agent

`~/.ssh/id_ed25519` is the personal key, used for GitHub and all other hosts.
OpenSSH `ssh-agent` runs as a systemd user unit on
`$XDG_RUNTIME_DIR/ssh-agent`, and `SSH_AUTH_SOCK` points there in every
session. The system-wide `AddKeysToAgent yes` adds the key on first use: the
first `ssh` or `git push` of a session shows the passphrase dialog, and later
connections need no prompt until logout.

```bash
ssh-add -l                                  # keys in the agent (comment + type)
systemctl --user status ssh-agent.service
```

No other agent may export `SSH_AUTH_SOCK`. `gcr-ssh-agent` (gnome-keyring's
agent) is disabled because its prompter cannot be styled. Do not re-enable it,
`programs.ssh.startAgent`, or gpg's SSH support. `services.openssh` is off, so
the machine accepts no incoming SSH.

## Passphrase dialog

`SSH_ASKPASS` is `ssh-askpass-fuzzel`, a fuzzel password dialog in Nord colours.
`SSH_ASKPASS_REQUIRE=prefer` sends every prompt there while `DISPLAY` is set,
including prompts from terminals. A bare console falls back to the TTY. A GNOME
session uses seahorse's GTK prompter instead, because fuzzel needs a
layer-shell compositor.

| line | meaning |
|---|---|
| ``Request from `<command>` `` | the ssh/ssh-add command line that asked; check it for a wrong host or unexpected caller |
| `Unlock SSH key <name> (<comment>)` | the key to unlock; multiple candidates are listed by name |
| `passphrase ❯` | masked input |

For key prompts, the dialog checks the input by trial-decrypting the keys in
`~/.ssh/id_*`. A wrong passphrase re-prompts with a red "Passphrase rejected"
line. A second consecutive rejection is passed to ssh as typed, so an
unrecognised prompt type cannot loop indefinitely. Esc cancels: authentication
fails and nothing is cached.

Server password prompts are not checked, since a server password cannot
decrypt a local key. They show ssh's own text with a `password ❯` label and
pass input to ssh unchanged. Keys loaded via `IdentityFile` from outside
`~/.ssh/id_*` are checked against the `~/.ssh/id_*` keys, so the correct
passphrase is rejected once; enter it again to pass it to ssh.

## agent-ssh

The personal key stays decrypted in the agent, so any process running as you,
including a coding agent, can use it without a prompt. `agent-ssh` runs `ssh`
with a separate passphrase-protected key, `~/.ssh/id_agent_ed25519`, and
bypasses the session agent:

```bash
agent-ssh ai_server            # preferred: server alias
agent-ssh <user>@<host>        # ad hoc; still uses the agent key
```

| option | effect |
|---|---|
| `-i ~/.ssh/id_agent_ed25519` + `IdentitiesOnly=yes` | offers only the agent key |
| `SSH_AUTH_SOCK` unset | session agent cannot supply a key |
| `AddKeysToAgent=no` | decrypted key is not cached; the next call prompts again |
| `SSH_ASKPASS_REQUIRE=force` | always uses the fuzzel dialog, which shows the requesting command |
| `StrictHostKeyChecking=accept-new` | accepts unknown hosts; a changed host key still fails |

Each connection shows the dialog: check the command line, then type the
passphrase or press Esc. Never pass this passphrase through a coding agent's
context. The key was generated manually (`ssh-keygen -t ed25519 -a 100`); only
its `.pub` goes into the servers' `authorized_keys`.

## ai_server alias

home-manager writes `~/.ssh/config` with a single block, `Host ai_server`
(named after the ansible inventory in `~/dev/server_setup`). It sets the host
name, the `ai_ops` user, the agent key with `IdentitiesOnly`, and
`AddKeysToAgent no`. All other hosts resolve against `/etc/ssh/ssh_config`.

- `ssh ai_server` uses the agent key without the wrapper. Tools that read
  `~/.ssh/config`, such as pi's ssh tools, see a named host. `AddKeysToAgent no`
  keeps the key out of the session agent on this path as well.
- `agent-ssh ai_server` is the same connection with the wrapper's settings
  added. Use this form for automation.

Connections are multiplexed (`ControlMaster auto`, `ControlPersist 10m`,
sockets at `~/.ssh/cm-*`), so the passphrase is needed once per ten minutes of
activity rather than per command. While a master socket is open, any process
running as you can use it without a prompt. The next connection removes a
stale socket left by a reboot.

## pass and gpg

`pass` stores secrets in `~/.password-store`, one file per entry, encrypted to
your gpg key. `gpg-agent` runs as a user unit and caches the unlocked key, so
only the first `pass show` of a session asks for the gpg passphrase.

```bash
pass                              # list entries as a tree
pass show path/to/entry           # decrypt (first call prompts)
pass show -c path/to/entry        # copy to clipboard
pass insert path/to/entry
systemctl --user status gpg-agent.service
```

The pinentry depends on the caller. Interactive shells export
`PINENTRY_USER_DATA=tty`, so terminal callers get the curses prompt. Processes
started from the session without a shell, such as qutebrowser's pass filling,
get the GNOME dialog. Both unlock the same agent cache.

OTP is available only in the browser: the command-line `pass` has no `otp`
subcommand, and the `pass-otp` extension is wired into qutebrowser's userscript
only. Login filling (`zl`, `zol`, the pass path layout, adding OTP entries) is
covered in the [qutebrowser guide](./qutebrowser.html). phi reads the same
store: at start it resolves credentials declared with `backend: pass` and
`ref: path/to/entry`, so API keys stay in pass and out of config files.

## gnome-keyring

`gnome-keyring-daemon` starts at login and PAM unlocks it with your login
password. It provides `org.freedesktop.secrets` on the session bus for desktop
apps that store tokens there. It plays no part in SSH (its agent is disabled)
or `pass`.

See also: [troubleshooting](./troubleshooting.html) · [qutebrowser](./qutebrowser.html)
(login filling) · [dev-workflow](./dev-workflow.html) (coding agents).
