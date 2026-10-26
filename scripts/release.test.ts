// @vitest-environment node
import { execFileSync, spawnSync } from "node:child_process";
import {
  chmodSync,
  copyFileSync,
  cpSync,
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

const gitIn = (cwd: string, ...args: string[]) =>
  execFileSync("git", args, {
    cwd,
    encoding: "utf8",
    stdio: "pipe",
    timeout: SPAWN_TIMEOUT,
  }).trim();
const git = (...args: string[]) => gitIn(repo, ...args);

const tag = (...args: string[]) => {
  const run = spawnSync(process.execPath, ["scripts/release.ts", "tag", ...args], {
    cwd: repo,
    encoding: "utf8",
    timeout: SPAWN_TIMEOUT,
  });
  return { status: run.status, out: run.stdout + run.stderr };
};

const writeRecord = (record: object, dir = repo) => {
  const records = join(dir, ".spec-sync", "gate-records");
  mkdirSync(records, { recursive: true });
  writeFileSync(
    join(records, `${gitIn(dir, "rev-parse", "HEAD^{tree}")}.json`),
    JSON.stringify(record),
  );
};

// Each test's repo is a copy of a starting repo built once per file (#325): building it takes git
// processes (init, add, commit, update-ref), and each test spawning its own in the hook made the
// hook wait on process starts, which a loaded gate slowed past the 10 s hook timeout. A copy is
// file system work only. Built once, the starting repo gets a timeout that matches spawning a
// handful of git processes on a loaded machine.
const HOOK_SPAWN_TIMEOUT = 60_000;
// The tests are spawn-bound the same way (#604): each runs a serial chain of 7–12 processes (git,
// node with the script, npm ls) and does no work of its own. Alone they take 0.25–1.6 s; under two
// concurrent merge gates the file took 62–69 s instead of 18 s and three of them passed the 5 s
// default. A test's timeout matches the hooks'. A synchronous test is only failed once it returns, so
// each spawn ends itself well below that: a hung process is killed and its test fails.
vi.setConfig({ testTimeout: HOOK_SPAWN_TIMEOUT });
const SPAWN_TIMEOUT = 20_000;
const fresh = (prefix: string) => mkdtempSync(join(tmpdir(), prefix));
const copyOf = (template: string) => {
  const dir = fresh("suite-ui-release-");
  cpSync(template, dir, { recursive: true, preserveTimestamps: true });
  return dir;
};
let start: string;

beforeAll(() => {
  start = fresh("suite-ui-release-start-");
  mkdirSync(join(start, "scripts"));
  copyFileSync(script, join(start, "scripts", "release.ts"));
  writeFileSync(join(start, "package.json"), JSON.stringify({ version: "9.9.9" }));
  writeFileSync(join(start, ".gitignore"), ".spec-sync/\nnode_modules/\n");
  // No template: without its sample hooks there is less to copy per test.
  gitIn(start, "init", "-q", "--template=", "-b", "main");
  // Commit and push start a detached `git maintenance run --auto` that outlives the git call and
  // holds .git/objects/maintenance.lock while a copy or cleanup walks the repo (#556). The setting
  // travels with every copy of the starting repo.
  gitIn(start, "config", "maintenance.auto", "false");
  gitIn(start, "add", ".");
  gitIn(start, "-c", "user.name=t", "-c", "user.email=t@t", "commit", "-q", "-m", "init");
  gitIn(start, "update-ref", "refs/remotes/origin/main", "HEAD");
}, HOOK_SPAWN_TIMEOUT);

afterAll(() => {
  rmSync(start, { recursive: true, force: true });
});

beforeEach(() => {
  repo = copyOf(start);
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
    const run = tag("--dry-run");
    expect(run.status).toBe(1);
    expect(run.out).toContain("is not green");
  });

  it("refuses a record of another profile", () => {
    writeRecord({ profile: "local", exit: 0 });
    const run = tag("--dry-run");
    expect(run.status).toBe(1);
    expect(run.out).toContain("is not green");
  });

  it("refuses off main", () => {
    writeRecord({ profile: "merge", exit: 0 });
    git("checkout", "-q", "-b", "ticket/1");
    const run = tag("--dry-run");
    expect(run.status).toBe(1);
    expect(run.out).toContain("HEAD is not on main");
  });

  // #138: a commit that is not on origin/main yet (main not pushed) gets no tag.
  it("refuses a commit that is not on origin/main", () => {
    writeFileSync(join(repo, "next.txt"), "x");
    git("add", ".");
    git("-c", "user.name=t", "-c", "user.email=t@t", "commit", "-q", "-m", "unpushed");
    writeRecord({ profile: "merge", exit: 0 });
    const run = tag("--dry-run");
    expect(run.status).toBe(1);
    expect(run.out).toContain(`${git("rev-parse", "HEAD")} is not on origin/main`);
    expect(git("tag", "-l")).toBe("");
  });

  // #138: an existing tag of the version is never moved or created twice.
  it("refuses when the version's tag exists already", () => {
    writeRecord({ profile: "merge", exit: 0 });
    git("tag", "v9.9.9");
    const before = git("rev-parse", "refs/tags/v9.9.9");
    const run = tag("--dry-run");
    expect(run.status).toBe(1);
    expect(run.out).toContain("v9.9.9 exists already — no tag");
    expect(git("rev-parse", "refs/tags/v9.9.9")).toBe(before);
  });

  // #138: a push that fails takes the local tag back. The remote is a path that does not exist, so
  // nothing leaves the machine.
  it("deletes the local tag again when the push fails", () => {
    writeRecord({ profile: "merge", exit: 0 });
    git("remote", "add", "origin", join(repo, ".no-such-remote.git"));
    const run = tag();
    expect(run.status).toBe(1);
    expect(run.out).toContain("pushing v9.9.9 failed — the local tag is deleted again");
    expect(git("tag", "-l")).toBe("");
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
// exit never undoes the tag. A fake `npx` on PATH records its arguments, prints the given toolkit JSON and
// exits with the given code; the log line follows the envelope's top-level `outcome`.
describe("release:tag review", () => {
  // Verbatim stdout of `npx --no-install spec-sync review tag v0.100.1..v0.100.1 --dry-run` (toolkit v0.26.0).
  const realEmptyRange = `{
  "command": "review",
  "ok": true,
  "exit": 0,
  "durationMs": 761,
  "notes": [
    "v0.100.1..v0.100.1 is empty — no Codex call, no issue"
  ],
  "mode": "tag",
  "range": "v0.100.1..v0.100.1",
  "title": "Codex review v0.100.1",
  "outcome": "not-triaged"
}`;

  const tagWithReview = (
    exit: number,
    outcome?: string,
    note = "",
    extra: { class?: string; error?: string } = {},
    raw?: string,
  ) => {
    const bin = join(repo, ".bin");
    mkdirSync(bin);
    const json =
      raw ??
      (outcome === undefined
        ? ""
        : JSON.stringify({
            command: "review",
            ok: exit === 0,
            exit,
            notes: [note],
            outcome,
            ...extra,
          }));
    writeFileSync(join(repo, "npx-out"), json);
    writeFileSync(
      join(bin, "npx"),
      `#!/bin/sh\necho "$@" > "${join(repo, "npx-args")}"\ncat "${join(repo, "npx-out")}"\nexit ${exit}\n`,
    );
    chmodSync(join(bin, "npx"), 0o755);
    const origin = join(repo, ".origin.git");
    execFileSync("git", ["init", "-q", "--bare", origin], { timeout: SPAWN_TIMEOUT });
    gitIn(origin, "config", "maintenance.auto", "false");
    git("remote", "add", "origin", origin);
    const run = spawnSync(process.execPath, ["scripts/release.ts", "tag"], {
      cwd: repo,
      encoding: "utf8",
      env: { ...process.env, PATH: `${bin}:${process.env.PATH}` },
      timeout: SPAWN_TIMEOUT,
    });
    const args = existsSync(join(repo, "npx-args"))
      ? readFileSync(join(repo, "npx-args"), "utf8").trim()
      : "";
    return { status: run.status, out: run.stdout + run.stderr, err: run.stderr, args };
  };

  // The previous tag, a commit after it and its green merge record: built once, copied per test.
  let tagged: string;
  beforeAll(() => {
    tagged = copyOf(start);
    writeFileSync(
      join(tagged, ".gitignore"),
      ".spec-sync/\nnode_modules/\n.bin/\n.origin.git/\nnpx-args\nnpx-out\n",
    );
    gitIn(tagged, "tag", "v9.9.8");
    gitIn(tagged, "add", ".");
    gitIn(tagged, "-c", "user.name=t", "-c", "user.email=t@t", "commit", "-q", "-m", "next");
    gitIn(tagged, "update-ref", "refs/remotes/origin/main", "HEAD");
    writeRecord({ profile: "merge", exit: 0 }, tagged);
  }, HOOK_SPAWN_TIMEOUT);

  afterAll(() => {
    rmSync(tagged, { recursive: true, force: true });
  });

  beforeEach(() => {
    rmSync(repo, { recursive: true, force: true });
    repo = copyOf(tagged);
  });

  it("reviews the range from the previous tag without installing", () => {
    const run = tagWithReview(0, "clean");
    expect(run.status).toBe(0);
    expect(run.args).toBe("--no-install spec-sync review tag v9.9.8..v9.9.9");
    expect(run.err).toContain("Codex review v9.9.8..v9.9.9 clean");
  });

  it("keeps the tag on open critical/high findings", () => {
    const run = tagWithReview(1, "findings");
    expect(run.status).toBe(0);
    expect(run.err).toContain("critical/high findings open — v9.9.9 stays");
    expect(git("tag", "-l", "v9.9.9")).toBe("v9.9.9");
  });

  it("reports non-blocking findings, not clean", () => {
    const run = tagWithReview(0, "findings");
    expect(run.err).toContain("has findings below high");
    expect(run.err).not.toContain("clean");
  });

  it("logs a skipped Codex run as skipped, not clean, and keeps the tag", () => {
    const run = tagWithReview(0, "skipped", "skipped — limit: usage", { class: "limit" });
    expect(run.status).toBe(0);
    expect(run.err).toContain(
      "Codex review v9.9.8..v9.9.9 skipped — limit (logged, no Claude fallback",
    );
    expect(run.err).not.toContain("clean");
    expect(git("tag", "-l", "v9.9.9")).toBe("v9.9.9");
  });

  it("logs an already reviewed tag", () => {
    const run = tagWithReview(0, "already-reviewed", "tag v9.9.9 already reviewed in #7");
    expect(run.err).toContain("already reviewed — tag v9.9.9 already reviewed in #7");
    expect(run.err).not.toContain("clean");
  });

  it("logs an empty range", () => {
    const run = tagWithReview(0, "not-triaged", "v9.9.8..v9.9.9 is empty");
    expect(run.err).toContain("Codex review v9.9.8..v9.9.9 is empty — no Codex call");
    expect(run.err).not.toContain("clean");
  });

  it("reads the real toolkit envelope of an empty range", () => {
    const run = tagWithReview(0, undefined, "", {}, realEmptyRange);
    expect(run.err).toContain("Codex review v9.9.8..v9.9.9 is empty — no Codex call");
  });

  it("logs a non-findings exit 1 with its error, not as findings", () => {
    const run = tagWithReview(
      1,
      undefined,
      "",
      {},
      JSON.stringify({
        command: "review",
        ok: false,
        exit: 1,
        notes: [],
        error: "gh issue create failed",
      }),
    );
    expect(run.status).toBe(0);
    expect(run.err).toContain(
      "ended with exit 1, outcome unreadable (gh issue create failed) — v9.9.9 stays",
    );
    expect(run.err).not.toContain("critical/high");
  });

  it("logs the error of a precondition exit", () => {
    const run = tagWithReview(
      4,
      undefined,
      "",
      {},
      JSON.stringify({
        command: "review",
        ok: false,
        exit: 4,
        notes: [],
        error: "no review config",
      }),
    );
    expect(run.err).toContain(
      "ended with exit 4, outcome unreadable (no review config) — v9.9.9 stays",
    );
    expect(git("tag", "-l", "v9.9.9")).toBe("v9.9.9");
  });

  it("logs exit 2 as unprovable and keeps the tag", () => {
    const run = tagWithReview(2);
    expect(run.status).toBe(0);
    expect(run.err).toContain("unprovable (exit 2), rerun npx spec-sync review tag v9.9.8..v9.9.9");
    expect(git("tag", "-l", "v9.9.9")).toBe("v9.9.9");
  });

  it("never reads exit 0 without JSON as clean", () => {
    const run = tagWithReview(0);
    expect(run.err).toContain("outcome unreadable — v9.9.9 stays");
    expect(run.err).not.toContain("clean");
  });

  it("runs no review without a previous tag", () => {
    git("tag", "-d", "v9.9.8");
    const run = tagWithReview(0, "clean");
    expect(run.status).toBe(0);
    expect(run.err).toContain("no previous tag before v9.9.9 — no Codex review");
    expect(run.args).toBe("");
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
      timeout: SPAWN_TIMEOUT,
    });
    return { status: run.status, err: run.stderr };
  };

  // #138: only the ledger arguments go to the gate; a second `--profile` would record another
  // profile's run as the merge gate. Refused before anything else runs.
  it("refuses --profile local with exit 1 and records nothing", () => {
    const run = spawnSync(
      process.execPath,
      ["scripts/release.ts", "record", "--profile", "local"],
      { cwd: repo, encoding: "utf8", timeout: SPAWN_TIMEOUT },
    );
    expect(run.status).toBe(1);
    expect(run.stderr).toContain(
      'only --issue <value> and --run <value> go to the gate, not "--profile"',
    );
    expect(existsSync(join(repo, ".spec-sync", "gate-records"))).toBe(false);
  });

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
