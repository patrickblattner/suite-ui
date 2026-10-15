// @vitest-environment node
import { execFileSync, spawnSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
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
  writeFileSync(join(repo, ".gitignore"), ".spec-sync/\n");
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

// SUI-FEATURE-076 AC4: `gate:record` checks the install against the lockfile before any gate run.
describe("gate:record", () => {
  it("exits 4 without a gate run or a record when the install differs from the package", () => {
    writeFileSync(
      join(repo, "package.json"),
      JSON.stringify({ version: "9.9.9", dependencies: { "left-pad": "1.3.0" } }),
    );
    git("-c", "user.name=t", "-c", "user.email=t@t", "commit", "-q", "-am", "dep");
    const run = spawnSync(process.execPath, ["scripts/release.ts", "record", "--issue", "1"], {
      cwd: repo,
      encoding: "utf8",
    });
    expect(run.status).toBe(4);
    expect(run.stderr).toContain("`npm ci` im Haupt-Checkout");
    expect(existsSync(join(repo, ".spec-sync", "gate-records"))).toBe(false);
    // Never installs itself.
    expect(existsSync(join(repo, "node_modules"))).toBe(false);
  });
});
