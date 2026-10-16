// @vitest-environment node
import { execFileSync, spawnSync } from "node:child_process";
import {
  chmodSync,
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

// The release:tag guard (SUI-FEATURE-076 AC3), run as `release.ts tag --dry-run` in a throwaway repo
// on `main` that carries a copy of the script.
const script = fileURLToPath(new URL("./release.ts", import.meta.url));
let repo: string;

const git = (...args: string[]) =>
  execFileSync("git", args, { cwd: repo, encoding: "utf8", stdio: "pipe" }).trim();

const tag = (...args: string[]) => {
  const run = spawnSync(process.execPath, ["scripts/release.ts", "tag", ...args], {
    cwd: repo,
    encoding: "utf8",
  });
  return { status: run.status, out: run.stdout + run.stderr };
};

const writeRecord = (record: object) => {
  const dir = join(repo, ".spec-sync", "gate-records");
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, `${git("rev-parse", "HEAD^{tree}")}.json`), JSON.stringify(record));
};

beforeEach(() => {
  repo = mkdtempSync(join(tmpdir(), "suite-ui-release-"));
  mkdirSync(join(repo, "scripts"));
  copyFileSync(script, join(repo, "scripts", "release.ts"));
  writeFileSync(join(repo, "package.json"), JSON.stringify({ version: "9.9.9" }));
  writeFileSync(join(repo, ".gitignore"), ".spec-sync/\nnode_modules/\n");
  git("init", "-q", "-b", "main");
  git("add", ".");
  git("-c", "user.name=t", "-c", "user.email=t@t", "commit", "-q", "-m", "init");
  git("update-ref", "refs/remotes/origin/main", "HEAD");
});

afterEach(() => {
  rmSync(repo, { recursive: true, force: true });
});

describe("release:tag", () => {
  it("refuses without a gate record", () => {
    const run = tag("--dry-run");
    expect(run.status).toBe(1);
    expect(run.out).toContain("no green gate record");
  });

  it("refuses on a dirty working tree", () => {
    writeRecord({ profile: "merge", exit: 0 });
    writeFileSync(join(repo, "stray.txt"), "x");
    const run = tag("--dry-run");
    expect(run.status).toBe(1);
    expect(run.out).toContain("uncommitted changes");
  });

  it("refuses a record with a non-zero exit", () => {
    writeRecord({ profile: "merge", exit: 1 });
    expect(tag("--dry-run").out).toContain("is not green");
  });

  it("refuses a record of another profile", () => {
    writeRecord({ profile: "local", exit: 0 });
    expect(tag("--dry-run").out).toContain("is not green");
  });

  it("refuses off main", () => {
    writeRecord({ profile: "merge", exit: 0 });
    git("checkout", "-q", "-b", "ticket/1");
    expect(tag("--dry-run").out).toContain("HEAD is not on main");
  });

  it("refuses an unknown argument and creates no tag", () => {
    writeRecord({ profile: "merge", exit: 0 });
    const run = tag("--dryrun");
    expect(run.status).toBe(1);
    expect(run.out).toContain("unknown argument --dryrun");
    expect(git("tag", "-l")).toBe("");
  });

  it("accepts the green merge record of HEAD's tree", () => {
    writeRecord({ profile: "merge", exit: 0 });
    const run = tag("--dry-run");
    expect(run.status).toBe(0);
    expect(run.out).toContain("v9.9.9 on");
    expect(git("tag", "-l")).toBe("");
  });
});

// PROC-DEV-003: after the push, `tag` runs the Codex review of the range from the previous tag; its
// exit never undoes the tag. A fake `npx` on PATH records its arguments and exits with a given code.
describe("release:tag review", () => {
  const tagWithReview = (exit: number) => {
    const bin = join(repo, ".bin");
    mkdirSync(bin);
    writeFileSync(
      join(bin, "npx"),
      `#!/bin/sh\necho "$@" > "${join(repo, "npx-args")}"\nexit ${exit}\n`,
    );
    chmodSync(join(bin, "npx"), 0o755);
    const origin = join(repo, ".origin.git");
    execFileSync("git", ["init", "-q", "--bare", origin]);
    git("remote", "add", "origin", origin);
    const run = spawnSync(process.execPath, ["scripts/release.ts", "tag"], {
      cwd: repo,
      encoding: "utf8",
      env: { ...process.env, PATH: `${bin}:${process.env.PATH}` },
    });
    const args = existsSync(join(repo, "npx-args"))
      ? readFileSync(join(repo, "npx-args"), "utf8").trim()
      : "";
    return { status: run.status, out: run.stdout + run.stderr, args };
  };

  beforeEach(() => {
    writeFileSync(
      join(repo, ".gitignore"),
      ".spec-sync/\nnode_modules/\n.bin/\n.origin.git/\nnpx-args\n",
    );
    git("tag", "v9.9.8");
    git("add", ".");
    git("-c", "user.name=t", "-c", "user.email=t@t", "commit", "-q", "-m", "next");
    git("update-ref", "refs/remotes/origin/main", "HEAD");
    writeRecord({ profile: "merge", exit: 0 });
  });

  it("reviews the range from the previous tag", () => {
    const run = tagWithReview(0);
    expect(run.status).toBe(0);
    expect(run.args).toBe("spec-sync review tag v9.9.8..v9.9.9");
    expect(run.out).toContain("Codex review v9.9.8..v9.9.9 clean");
  });

  it("keeps the tag on open critical/high findings", () => {
    const run = tagWithReview(1);
    expect(run.status).toBe(0);
    expect(run.out).toContain("critical/high findings open — v9.9.9 stays");
    expect(git("tag", "-l", "v9.9.9")).toBe("v9.9.9");
  });

  it("logs an unavailable Codex and keeps the tag", () => {
    const run = tagWithReview(2);
    expect(run.status).toBe(0);
    expect(run.out).toContain("unavailable (exit 2)");
    expect(git("tag", "-l", "v9.9.9")).toBe("v9.9.9");
  });
});

// SUI-FEATURE-076 AC4: `gate:record` holds the install against the lockfile before any gate run.
describe("gate:record", () => {
  // A package declaring `range` for left-pad, a lockfile pinning `locked`, `installed` in node_modules,
  // and a locked optional platform build that is not installed here.
  const setup = (range: string, locked: string, installed: string) => {
    const pkg = {
      name: "fixture",
      version: "9.9.9",
      dependencies: { "left-pad": range },
      optionalDependencies: { "@fixture/other-platform": "1.0.0" },
    };
    writeFileSync(join(repo, "package.json"), JSON.stringify(pkg));
    const lock = {
      name: "fixture",
      version: "9.9.9",
      lockfileVersion: 3,
      requires: true,
      packages: {
        "": pkg,
        "node_modules/left-pad": { version: locked },
        "node_modules/@fixture/other-platform": { version: "1.0.0", optional: true, os: ["aix"] },
      },
    };
    writeFileSync(join(repo, "package-lock.json"), JSON.stringify(lock));
    mkdirSync(join(repo, "node_modules", "left-pad"), { recursive: true });
    writeFileSync(
      join(repo, "node_modules", "left-pad", "package.json"),
      JSON.stringify({ name: "left-pad", version: installed }),
    );
    git("add", ".");
    git("-c", "user.name=t", "-c", "user.email=t@t", "commit", "-q", "-m", "deps");
  };

  const record = () => {
    const run = spawnSync(process.execPath, ["scripts/release.ts", "record", "--issue", "1"], {
      cwd: repo,
      encoding: "utf8",
    });
    return { status: run.status, err: run.stderr };
  };

  it("exits 4 on an in-range version that differs from the lockfile", () => {
    setup("^1.0.0", "1.2.0", "1.3.0");
    const run = record();
    expect(run.status).toBe(4);
    expect(run.err).toContain("node_modules/left-pad 1.2.0 ≠ 1.3.0");
    expect(run.err).toContain("`npm ci` im Haupt-Checkout");
    expect(existsSync(join(repo, ".spec-sync", "gate-records"))).toBe(false);
  });

  it("exits 4 on an installed version outside its declared range", () => {
    setup("^2.0.0", "1.3.0", "1.3.0");
    const run = record();
    expect(run.status).toBe(4);
    expect(run.err).toContain("npm ls reports an error");
    expect(run.err).toContain("`npm ci` im Haupt-Checkout");
  });

  it("passes a lockfile install without the optional build of another platform", () => {
    setup("^1.0.0", "1.3.0", "1.3.0");
    // A stray file stops the run right after the dependency check, before any gate.
    writeFileSync(join(repo, "stray.txt"), "x");
    const run = record();
    expect(run.status).toBe(1);
    expect(run.err).toContain("uncommitted changes");
    expect(run.err).not.toContain("npm ci");
  });
});
