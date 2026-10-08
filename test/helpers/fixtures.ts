// Fixture harness for the build and link-checker tests. Both production
// entry points derive their repo root from their own module URL, so each
// fixture is a throwaway directory that looks like a tiny system-docs repo:
//
//   <tmp>/build-cache/build.mjs   bundled src/build.mts (esbuild, once per process)
//   <tmp>/data/keybinds.json      the test's binding data
//   <tmp>/content/guides/*.md     the test's guides
//   <tmp>/nixos_config/...        optional fake checkout for the path check
//   <tmp>/node_modules            symlink to this repo's node_modules
//   <tmp>/home                    empty HOME (hermeticity)
//
// Nothing here touches real user state: HOME/XDG_* point into the fixture and
// every subprocess gets NIXOS_CONFIG pointing at either the fixture checkout
// or a path that does not exist (so the path check is skipped deterministically).

import { spawnSync } from "node:child_process";
import { existsSync, rmSync } from "node:fs";
import { cp, mkdir, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { build as esbuild } from "esbuild";

export const REPO_ROOT = fileURLToPath(new URL("../..", import.meta.url));

export interface RunResult {
  status: number;
  stdout: string;
  stderr: string;
  dir: string;
}

export interface Fixture {
  dir: string;
  run(): RunResult;
  writeData(data: unknown): Promise<void>;
  writeGuide(name: string, body: string): Promise<void>;
  read(rel: string): Promise<string>;
}

const created: string[] = [];
const bundleDirs: string[] = [];

// Bundle dirs are shared by every fixture in the process, so they outlive
// cleanupFixtures(); remove them synchronously when the test process exits.
process.on("exit", () => {
  for (const dir of bundleDirs) rmSync(dir, { recursive: true, force: true });
});

/** Remove every fixture made by this test file (call from `after`). */
export async function cleanupFixtures(): Promise<void> {
  await Promise.all(created.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
}

let bundlePromise: Promise<string> | null = null;

/** Bundle src/build.mts once per test process (esbuild is a devDependency). */
function buildBundle(): Promise<string> {
  bundlePromise ??= (async () => {
    const dir = await mkdtemp(join(tmpdir(), "sd-build-bundle-"));
    bundleDirs.push(dir);
    const outfile = join(dir, "build.mjs");
    await esbuild({
      entryPoints: [join(REPO_ROOT, "src/build.mts")],
      bundle: true,
      format: "esm",
      platform: "node",
      target: "node22",
      packages: "external",
      outfile,
      logLevel: "silent",
    });
    return outfile;
  })();
  return bundlePromise;
}

export interface TestBinding {
  keys: string;
  label: string;
  command?: string;
  source?: string;
  custom?: boolean;
}

export interface TestGroup {
  name: string;
  description?: string;
  bindings: TestBinding[];
}

export interface TestApp {
  id: string;
  title: string;
  tagline: string;
  description: string;
  icon: string;
  guide?: string;
  groups: TestGroup[];
}

export interface TestData {
  meta: { generatedAt: string; sourceCommit: string; host: string };
  apps: TestApp[];
}

/** A small but complete valid keybinds file (one app, custom + stock rows). */
export function baseData(): TestData {
  return {
    meta: { generatedAt: "2026-01-02T03:04:05.000Z", sourceCommit: "abc1234", host: "box" },
    apps: [
      {
        id: "niri",
        title: "niri",
        tagline: "scrollable tiling",
        description: "A scrollable-tiling Wayland compositor.",
        icon: "▦",
        groups: [
          {
            name: "Focus",
            description: "Move the focus around.",
            bindings: [
              {
                keys: "Mod+H",
                label: "Focus column left",
                command: "focus-column-left",
                source: "modules/home/niri.nix:10",
                custom: true,
              },
              { keys: "Mod+L", label: "Focus column right", command: "focus-column-right" },
            ],
          },
        ],
      },
    ],
  };
}

/** Front matter + body for a guide file (fields omitted when not given). */
export function guideFile(fields: Record<string, string | number>, body: string): string {
  const lines = Object.entries(fields).map(([k, v]) => `${k}: ${v}`);
  return `---\n${lines.join("\n")}\n---\n\n${body}\n`;
}

function fixtureEnv(dir: string, hasCheckout: boolean): NodeJS.ProcessEnv {
  const home = join(dir, "home");
  return {
    ...process.env,
    HOME: home,
    XDG_CONFIG_HOME: join(home, ".config"),
    XDG_STATE_HOME: join(home, ".local/state"),
    XDG_DATA_HOME: join(home, ".local/share"),
    XDG_CACHE_HOME: join(home, ".cache"),
    NIXOS_CONFIG: hasCheckout ? join(dir, "nixos_config") : join(dir, "absent-nixos_config"),
  };
}

export async function makeFixture(opts: {
  data?: unknown;
  guides?: Record<string, string>;
  nixosConfig?: Record<string, string>;
} = {}): Promise<Fixture> {
  const dir = await mkdtemp(join(tmpdir(), "sd-fixture-"));
  created.push(dir);
  const bundle = await buildBundle();

  await mkdir(join(dir, "build-cache"), { recursive: true });
  await cp(bundle, join(dir, "build-cache/build.mjs"));
  await symlink(join(REPO_ROOT, "node_modules"), join(dir, "node_modules"), "dir");
  await mkdir(join(dir, "data"), { recursive: true });
  await writeFile(join(dir, "data/keybinds.json"), JSON.stringify(opts.data ?? baseData(), null, 2));
  await mkdir(join(dir, "home"), { recursive: true });
  for (const [name, content] of Object.entries(opts.guides ?? {})) {
    const path = join(dir, "content/guides", name);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, content);
  }
  if (opts.nixosConfig !== undefined) {
    for (const [rel, content] of Object.entries(opts.nixosConfig)) {
      const path = join(dir, "nixos_config", rel);
      await mkdir(dirname(path), { recursive: true });
      await writeFile(path, content);
    }
  }
  const env = fixtureEnv(dir, opts.nixosConfig !== undefined);

  const run = (): RunResult => {
    const res = spawnSync(process.execPath, [join(dir, "build-cache/build.mjs")], {
      cwd: dir,
      env,
      encoding: "utf8",
    });
    return {
      status: res.status ?? -1,
      stdout: res.stdout ?? "",
      stderr: res.stderr ?? "",
      dir,
    };
  };

  return {
    dir,
    run,
    async writeData(data: unknown) {
      await writeFile(join(dir, "data/keybinds.json"), JSON.stringify(data, null, 2));
    },
    async writeGuide(name: string, body: string) {
      const path = join(dir, "content/guides", name);
      await mkdir(dirname(path), { recursive: true });
      await writeFile(path, body);
    },
    async read(rel: string) {
      return readFile(join(dir, rel), "utf8");
    },
  };
}

export interface LinksFixture {
  dir: string;
  run(): RunResult;
}

/**
 * Fixture for scripts/check-links.mjs: a copied checker plus a hand-written
 * dist/ tree. The checker resolves its root from its own URL, so copying the
 * script into the fixture is enough to point it at `<dir>/dist`.
 */
export async function makeLinksFixture(files: Record<string, string>): Promise<LinksFixture> {
  const dir = await mkdtemp(join(tmpdir(), "sd-links-"));
  created.push(dir);
  const scriptDir = join(dir, "scripts");
  await mkdir(scriptDir, { recursive: true });
  await writeFile(join(scriptDir, "check-links.mjs"), await readFile(join(REPO_ROOT, "scripts/check-links.mjs")));
  for (const [rel, content] of Object.entries(files)) {
    const path = join(dir, "dist", rel);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, content);
  }
  return {
    dir,
    run: () => {
      const res = spawnSync(process.execPath, [join(scriptDir, "check-links.mjs")], {
        cwd: dir,
        env: { ...process.env, HOME: join(dir, "home") },
        encoding: "utf8",
      });
      return { status: res.status ?? -1, stdout: res.stdout ?? "", stderr: res.stderr ?? "", dir };
    },
  };
}

/** True when the path exists in the fixture (convenience for assertions). */
export function existsIn(fixture: Fixture, rel: string): boolean {
  return existsSync(join(fixture.dir, rel));
}
