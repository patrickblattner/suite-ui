// @vitest-environment node
import { execFileSync, spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { TOOL_VERSIONS } from "./hygiene";
import { GITLEAKS_VERSION, isWipSubject, parseRefs, scanRanges, skipsChecks } from "./pre-push";

// The pre-push hook (#794, PROC-DEV-005 rev 5, PROC-REL-017): the secret guard on every ref, the
// preflight and the pin check unless every tip of a non-main push is a `wip:` commit.
const script = fileURLToPath(new URL("./pre-push.ts", import.meta.url));
const ZERO = "0".repeat(40);
const A = "a".repeat(40);
const B = "b".repeat(40);

describe("pre-push decisions", () => {
  it("guards with the gitleaks version hygiene pins", () => {
    expect(GITLEAKS_VERSION).toBe(TOOL_VERSIONS.gitleaks);
  });

  it("reads git's ref lines and drops anything else", () => {
    expect(parseRefs(`refs/heads/x ${A} refs/heads/x ${B}\n\n`)).toEqual([
      { localRef: "refs/heads/x", localSha: A, remoteRef: "refs/heads/x", remoteSha: B },
    ]);
  });

  it("scans the pushed range, a new ref against every remote, a deleted ref not at all", () => {
    expect(
      scanRanges(
        parseRefs(
          [
            `refs/heads/x ${A} refs/heads/x ${B}`,
            `refs/heads/y ${A} refs/heads/y ${ZERO}`,
            `(delete) ${ZERO} refs/heads/z ${B}`,
          ].join("\n"),
        ),
      ),
    ).toEqual([`${B}..${A}`, `${A} --not --remotes`]);
  });

  it("skips the checks only when every tip is WIP and main is not pushed", () => {
    const wip = () => true;
    const branch = parseRefs(`refs/heads/x ${A} refs/heads/x ${B}`);
    expect(skipsChecks(branch, wip)).toBe(true);
    expect(skipsChecks(branch, () => false)).toBe(false);
    expect(skipsChecks(parseRefs(`refs/heads/main ${A} refs/heads/main ${B}`), wip)).toBe(false);
    expect(skipsChecks(parseRefs(`(delete) ${ZERO} refs/heads/x ${B}`), wip)).toBe(false);
    expect(isWipSubject("wip: park the red state")).toBe(true);
    expect(isWipSubject("feat: add a wip: note #1")).toBe(false);
  });
});

// A real push into a bare remote with the hook installed; a fake `npx` on PATH logs its arguments
// and answers `repin --check` with exit 2 (spec server down).
describe("pre-push hook on a real push", () => {
  let dir: string;
  let work: string;
  let npxLog: string;
  let env: NodeJS.ProcessEnv;
  const git = (...args: string[]) =>
    execFileSync("git", args, { cwd: work, encoding: "utf8", stdio: "pipe" }).trim();
  const commit = (subject: string, file: string, text: string) => {
    writeFileSync(join(work, file), text);
    git("add", file);
    git("commit", "-q", "-m", subject);
  };
  const push = (ref: string) => {
    const run = spawnSync("git", ["push", "-q", "origin", ref], {
      cwd: work,
      encoding: "utf8",
      env,
    });
    return { status: run.status, out: run.stdout + run.stderr };
  };
  const npxCalls = () =>
    readFileSync(npxLog, "utf8")
      .split("\n")
      .filter((line) => line !== "");
  // Built at run time, so this file carries no token for the history scan to find.
  const fakeToken = () =>
    `ghp_${randomBytes(27)
      .toString("base64")
      .replace(/[^A-Za-z0-9]/g, "x")
      .slice(0, 36)}`;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "suite-ui-pre-push-"));
    work = join(dir, "work");
    const bin = join(dir, "bin");
    const hooks = join(dir, "hooks");
    npxLog = join(dir, "npx.log");
    writeFileSync(npxLog, "");
    for (const d of [work, bin, hooks]) mkdirSync(d);
    writeFileSync(
      join(bin, "npx"),
      `#!/bin/sh\necho "$*" >> "${npxLog}"\ncase "$*" in *repin*) exit 2;; esac\nexit 0\n`,
    );
    writeFileSync(join(hooks, "pre-push"), `#!/bin/sh\nexec node "${script}"\n`);
    chmodSync(join(bin, "npx"), 0o755);
    chmodSync(join(hooks, "pre-push"), 0o755);
    env = { ...process.env, PATH: `${bin}:${process.env.PATH}` };
    execFileSync("git", ["init", "-q", "--bare", join(dir, "origin.git")]);
    git("init", "-q", "--template=", "-b", "main");
    git("config", "user.email", "test@example.com");
    git("config", "user.name", "test");
    git("config", "maintenance.auto", "false");
    git("config", "core.hooksPath", hooks);
    git("remote", "add", "origin", join(dir, "origin.git"));
    commit("chore: start", "readme.txt", "start\n");
    git("checkout", "-q", "-b", "feat/x");
  });

  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  it("refuses a WIP push that carries a secret, before any check", () => {
    commit("wip: park", "config.txt", `token = "${fakeToken()}"\n`);
    const run = push("feat/x");
    expect(run.status).not.toBe(0);
    expect(run.out).toContain("secret guard refused");
    expect(npxCalls()).toEqual([]);
  });

  it("lets a clean WIP push through on the secret guard alone", () => {
    commit("wip: park", "notes.txt", "half done\n");
    const run = push("feat/x");
    expect(run.status).toBe(0);
    expect(run.out).toContain("preflight and repin --check skipped");
    expect(npxCalls()).toEqual([]);
  });

  it("runs the preflight, then the pin check, and passes when the spec server is down", () => {
    commit("feat: done #1", "notes.txt", "done\n");
    const run = push("feat/x");
    expect(run.status).toBe(0);
    expect(run.out).toContain("spec server unreachable");
    expect(npxCalls()).toEqual([
      "spec-sync gate --profile merge --preflight",
      "spec-sync repin --check",
    ]);
  });

  it("runs the full set on main, WIP marker or not", () => {
    git("checkout", "-q", "main");
    commit("wip: park", "notes.txt", "half done\n");
    expect(push("main").status).toBe(0);
    expect(npxCalls()[0]).toBe("spec-sync gate --profile merge --preflight");
  });
});
