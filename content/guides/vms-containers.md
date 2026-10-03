---
title: VMs and containers
slug: vms-containers
summary: quickemu VMs and rootless podman - both run as you, with no root daemon behind them.
order: 10
verified: 0bd451a
---

Both layers run as your user: no libvirtd, no root docker socket, no group
that grants a daemon's powers. Project toolchains belong in devshells (see
[dev-workflow](./dev-workflow.html)); VMs and containers are for whole other
operating systems and for services.

## Virtual machines (quickemu)

quickemu spawns qemu directly as you (`modules/nixos/vms.nix`). `/dev/kvm` is
world-accessible, so no group membership is needed. Networking is qemu
usermode NAT: guests reach the network through the host, nothing on the LAN
can reach them, and the host firewall is untouched. VMs are persistent - the
qcow2 disk survives a shutdown, and running the same conf again resumes the
machine. Windows 11 guests get UEFI, a software TPM and Secure Boot out of the
box.

| recipe | does |
|---|---|
| `just vm-new <os> [release] [variant]` | quickget downloads the ISO into `/data/vms/<name>/` and writes `/data/vms/<name>.conf` (needs network) |
| `just vm <name>` | run the VM; the disk is created on first boot, later runs resume it |
| `just vm-list` | configured VMs plus the qemu processes currently running |
| `just vm-snap-create <name> <tag>` | snapshot including RAM state - works while the VM is running |
| `just vm-snap-apply <name> <tag>` | restore that snapshot |
| `just vm-snap-info <name>` | snapshot and disk info |
| `just vm-delete <name>` | delete disk, EFI vars and conf; asks for confirmation first |

Release spelling follows quickget, not intuition: `quickget <os>` prints the
valid releases and editions for that OS. The VM name is whatever quickget
derives from them.

```bash
just vm-new debian 12 xfce      # → /data/vms/debian-12-xfce.conf
just vm-new windows-11
just vm-new alpine v3.24        # Alpine wants the v prefix
just vm debian-12-xfce
```

### Pause now, continue next week

Snapshots capture RAM and disk together, so a session can be parked:

```bash
just vm-snap-create debian-12-xfce fresh   # while it runs
just vm-snap-apply  debian-12-xfce fresh   # later: picks up where it was
```

### On disk

`/data` is the second SSD. Each VM is one conf file plus one directory:

| path | holds |
|---|---|
| `/data/vms/<name>.conf` | a few lines: `guest_os`, `disk_img`, `iso` - edit it to add USB devices or a shared folder |
| `/data/vms/<name>/` | `disk.qcow2`, the ISO, `OVMF_VARS.fd`, a log, the ports file |
| `/data/iso/` | ISOs you bring yourself |

### Display, USB and shared folders

- The default viewer is spicy. For the GUI viewer with a USB menu run quickemu
  directly: `quickemu --vm /data/vms/<name>.conf --viewer remote-viewer`.
- USB passthrough, permanent: `usb_devices=("vid:pid")` in the conf, IDs from
  `lsusb`. At runtime: remote-viewer, View, USB device selection. Device nodes
  are root-owned; input devices and webcams already work, anything else needs
  the udev `uaccess` rule that sits commented in `modules/nixos/vms.nix`.
- Folder sharing: `public_dir="<path>"` in the conf (9p for Linux guests,
  WebDAV via spice-webdavd for Windows).

## Containers (rootless podman)

podman runs rootless (`modules/nixos/common.nix`). The `docker` command is
the podman compatibility shim, and `docker compose` delegates to
podman-compose (its banner is silenced in `~/.zshrc`). Images and containers
live in `~/.local/share/containers/storage`; unqualified image names resolve
against docker.io first, then quay.io. Containers on the default network
resolve each other by name.

Tools that want a Docker API socket get the user one. The `podman.socket`
user unit is enabled, so this is all it takes:

```bash
export DOCKER_HOST=unix://$XDG_RUNTIME_DIR/podman/podman.sock
```

### What is deliberately missing

There is no `/run/docker.sock`. That socket would hand a root podman API to
every process in your session, so one compromised process would be root. The
devcontainer CLI went with it. In practice: anything hard-wired to
`/var/run/docker.sock` must be pointed at `DOCKER_HOST` instead, and every
container is owned by you - files it writes into bind mounts are yours, and
nothing inside it can become root on the host.

### One-off containers

```bash
podman run --rm -it docker.io/library/alpine sh      # throwaway shell
docker run --rm -it alpine sh                        # same, through the shim
podman run --rm -v "$PWD":/work -w /work node:22 npm test
```

### Aliases

| alias | is |
|---|---|
| `dps` / `dpa` / `dpsw` | `docker ps` running / all / compact table (name, status, ports) |
| `dcu` / `dcd` / `dcl` | `docker compose up` / `down` / `logs -f` |
| `de <name> <cmd>` | `docker exec -it` |
| `dlog <name>` | follow logs, last 100 lines |
| `dsh` | shell into the first running container |
| `dshp` | fzf-pick a running container, shell into it |

### Cleanup

```bash
podman ps -a                         # what exists, running or not
podman system df                     # space per images / containers / volumes
podman system prune                  # stopped containers + dangling images
podman system prune -a --volumes     # everything not in use, volumes included
```

See also: [dev-workflow](./dev-workflow.html) (devshells, phi containers) ·
[shell-tricks](./shell-tricks.html) (the alias file) ·
[maintenance](./maintenance.html) (`just` recipes).
