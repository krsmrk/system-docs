---
title: VMs and containers
slug: vms-containers
summary: quickemu VMs and rootless podman, no root daemon
order: 10
verified: 0bd451a
---

VMs and containers both run as your user. There is no libvirtd, no root docker
socket, and no group that grants daemon access. Use devshells for project
toolchains (see [dev-workflow](./dev-workflow.html)); use VMs for other
operating systems and containers for services.

## Virtual machines (quickemu)

quickemu starts qemu as your user (`modules/nixos/vms.nix`). `/dev/kvm` is
world-accessible, so no group membership is needed. Networking is qemu
user-mode NAT: guests reach the network through the host, the LAN cannot reach
guests, and the host firewall is unchanged. VMs are persistent: the qcow2 disk
survives shutdown, and running the same conf again boots the same machine.
Windows 11 guests get UEFI, a software TPM and Secure Boot by default.

| recipe | does |
|---|---|
| `just vm-new <os> [release] [variant]` | download the ISO with quickget into `/data/vms/<name>/` and write `/data/vms/<name>.conf` (needs network) |
| `just vm <name>` | run the VM; the disk is created on first boot |
| `just vm-list` | list configured VMs and running qemu processes |
| `just vm-snap-create <name> <tag>` | snapshot disk and RAM; works while the VM runs |
| `just vm-snap-apply <name> <tag>` | restore a snapshot |
| `just vm-snap-info <name>` | show snapshot and disk info |
| `just vm-delete <name>` | delete disk, EFI vars and conf, after confirmation |

Release names follow quickget: `quickget <os>` prints the valid releases and
editions for an OS. quickget derives the VM name from them.

```bash
just vm-new debian 12 xfce      # → /data/vms/debian-12-xfce.conf
just vm-new windows-11
just vm-new alpine v3.24        # Alpine needs the v prefix
just vm debian-12-xfce
```

### Snapshots

Snapshots include RAM, so restoring one resumes the session where it was:

```bash
just vm-snap-create debian-12-xfce fresh   # while the VM runs
just vm-snap-apply  debian-12-xfce fresh   # later: resume from that point
```

### Files

`/data` is the second SSD. Each VM is a conf file plus a directory:

| path | holds |
|---|---|
| `/data/vms/<name>.conf` | `guest_os`, `disk_img`, `iso`; add USB devices or a shared folder here |
| `/data/vms/<name>/` | `disk.qcow2`, the ISO, `OVMF_VARS.fd`, a log, the ports file |
| `/data/iso/` | manually downloaded ISOs |

### Display, USB and shared folders

- The default viewer is spicy. For remote-viewer, which has a USB menu, run
  quickemu directly: `quickemu --vm /data/vms/<name>.conf --viewer remote-viewer`.
- Persistent USB passthrough: add `usb_devices=("vid:pid")` to the conf (IDs
  from `lsusb`). At runtime: remote-viewer → View → USB device selection.
  Device nodes are root-owned. Input devices and webcams work; other devices
  need the udev `uaccess` rule that is commented out in `modules/nixos/vms.nix`.
- Shared folder: `public_dir="<path>"` in the conf (9p for Linux guests,
  WebDAV via spice-webdavd for Windows).

## Containers (rootless podman)

podman runs rootless (`modules/nixos/common.nix`). `docker` is podman's
compatibility shim, and `docker compose` calls podman-compose (its banner is
suppressed in `~/.zshrc`). Images and containers are stored in
`~/.local/share/containers/storage`. Unqualified image names resolve against
docker.io, then quay.io. Containers on the default network resolve each other
by name.

For tools that need a Docker API socket, the `podman.socket` user unit is
enabled; point them at it:

```bash
export DOCKER_HOST=unix://$XDG_RUNTIME_DIR/podman/podman.sock
```

### No system Docker socket

There is no `/run/docker.sock`: it would give every process in the session
access to a root podman API, so any compromised process would gain root. The
devcontainer CLI was removed along with it. Point anything
hard-wired to `/var/run/docker.sock` at `DOCKER_HOST` instead. Containers are
owned by you: files written to bind mounts belong to you, and nothing inside a
container can become root on the host.

### One-off containers

```bash
podman run --rm -it docker.io/library/alpine sh      # throwaway shell
docker run --rm -it alpine sh                        # same, via the shim
podman run --rm -v "$PWD":/work -w /work node:22 npm test
```

### Aliases

| alias | runs |
|---|---|
| `dps` / `dpa` / `dpsw` | `docker ps` running / all / compact table (name, status, ports) |
| `dcu` / `dcd` / `dcl` | `docker compose up` / `down` / `logs -f` |
| `de <name> <cmd>` | `docker exec -it` |
| `dlog <name>` | follow logs, last 100 lines |
| `dsh` | shell into the first running container |
| `dshp` | pick a running container with fzf, shell into it |

### Cleanup

```bash
podman ps -a                         # all containers
podman system df                     # disk use by images, containers, volumes
podman system prune                  # stopped containers + dangling images
podman system prune -a --volumes     # everything unused, including volumes
```

See also: [dev-workflow](./dev-workflow.html) (devshells, phi containers) ·
[shell-tricks](./shell-tricks.html) (aliases) ·
[maintenance](./maintenance.html) (`just` recipes).
