// @vitest-environment node
import { execFileSync, spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { GITLEAKS_PASSES, octopusOwnLeaks as hygieneOwnLeaks, TOOL_VERSIONS } from "./hygiene";
import {
  checkPlan,
  GITLEAKS_VERSION,
  isWipSubject,
  keptLogs,
  MERGE_PASSES,
  octopusOwnLeaks,
  parseRefs,
  scanRanges,
} from "./pre-push";
import { fakeKey } from "./secret-fixtures";

// The pre-push hook (#794, PROC-DEV-005 rev 6, PROC-REL-017): the secret guard on every ref, the
// preflight on the pushed tree unless every tip of a non-main push is `wip:`.
const script = fileURLToPath(new URL("./pre-push.ts", import.meta.url));
const pkg = JSON.parse(
  readFileSync(fileURLToPath(new URL("../package.json", import.meta.url)), "utf8"),
) as { "simple-git-hooks": { "pre-push": string } };
const ZERO = "0".repeat(40);
const A = "a".repeat(40);
const B = "b".repeat(40);
const PREFLIGHT = "prepush";

describe("pre-push decisions", () => {
  it("guards with the gitleaks version hygiene pins", () => {
    expect(GITLEAKS_VERSION).toBe(TOOL_VERSIONS.gitleaks);
  });

  // #811: the hook scans merges the way hygiene scans history, octopus merges included.
  it("scans merges with hygiene's passes", () => {
    expect(MERGE_PASSES.map((pass) => `--full-history --all ${pass.join(" ")}`)).toEqual(
      Object.values(GITLEAKS_PASSES),
    );
  });

  it("reads git's ref lines and drops anything else", () => {
    expect(parseRefs(`refs/heads/x ${A} refs/heads/x ${B}\n\n`)).toEqual([
      { localRef: "refs/heads/x", localSha: A, remoteRef: "refs/heads/x", remoteSha: B },
    ]);
  });

  it("scans the pushed range; a new ref or an unknown remote tip against the pushed remote only", () => {
    const refs = parseRefs(
      [
        `refs/heads/x ${A} refs/heads/x ${B}`,
        `refs/heads/y ${A} refs/heads/y ${ZERO}`,
        `(delete) ${ZERO} refs/heads/z ${B}`,
      ].join("\n"),
    );
    expect(scanRanges(refs, "origin", () => true)).toEqual([
      [`${B}..${A}`],
      [A, "--not", "--remotes=origin"],
    ]);
    expect(scanRanges(refs, "origin", () => false)).toEqual([
      [A, "--not", "--remotes=origin"],
      [A, "--not", "--remotes=origin"],
    ]);
  });

  it("skips the checks only for an all-WIP push off main or a push that only deletes", () => {
    const wip = () => true;
    const branch = parseRefs(`refs/heads/x ${A} refs/heads/x ${B}`);
    expect(checkPlan(branch, wip)).toMatchObject({ run: false });
    expect(checkPlan(branch, () => false)).toEqual({ run: true });
    expect(checkPlan(parseRefs(`refs/heads/main ${A} refs/heads/main ${B}`), wip)).toEqual({
      run: true,
      line: expect.stringContaining("refs/heads/main is pushed") as string,
    });
    const mixed = parseRefs(
      `refs/heads/x ${A} refs/heads/x ${ZERO}\nrefs/heads/y ${B} refs/heads/y ${ZERO}`,
    );
    expect(checkPlan(mixed, (sha) => sha === A)).toEqual({
      run: true,
      line: expect.stringContaining("not every pushed tip") as string,
    });
    expect(checkPlan(parseRefs(`(delete) ${ZERO} refs/heads/x ${B}`), () => false)).toEqual({
      run: false,
      line: expect.stringContaining("only deletes refs") as string,
    });
    expect(isWipSubject("wip: park the red state")).toBe(true);
    expect(isWipSubject("feat: add a wip: note #1")).toBe(false);
  });
});

// A real push into a bare remote, the hook being package.json's own command. A fake toolkit CLI in
// the checkout's node_modules (the hook runs it with node, never npx: GL-SEC-011 rev 4) logs its
// arguments and working directory and exits with FAKE_GATE_EXIT (default 0) for the preflight.
describe("pre-push hook on a real push", () => {
  let dir: string;
  let work: string;
  let fakes: string;
  let env: NodeJS.ProcessEnv;
  const log = (name: string) =>
    readFileSync(join(dir, name), "utf8")
      .split("\n")
      .filter((line) => line !== "");
  const cliCalls = () => log("cli.log");
  const gitIn = (cwd: string, ...args: string[]) =>
    execFileSync("git", args, { cwd, encoding: "utf8", stdio: "pipe" }).trim();
  const git = (...args: string[]) => gitIn(work, ...args);
  const commitIn = (cwd: string, subject: string, file: string, text: string) => {
    writeFileSync(join(cwd, file), text);
    gitIn(cwd, "add", file);
    gitIn(cwd, "commit", "-q", "-m", subject);
  };
  const commit = (subject: string, file: string, text: string) =>
    commitIn(work, subject, file, text);
  const push = (args: string[], extra: NodeJS.ProcessEnv = {}) => {
    const run = spawnSync("git", ["push", "-q", "origin", ...args], {
      cwd: work,
      encoding: "utf8",
      env: { ...env, ...extra },
    });
    return { status: run.status, out: run.stdout + run.stderr };
  };
  // A clean first push of feat/x, so the remote has the branch; the call log starts empty after it.
  const pushed = () => {
    commit("feat: base #1", "notes.txt", "base\n");
    expect(push(["feat/x"]).status).toBe(0);
    writeFileSync(join(dir, "cli.log"), "");
  };
  // Built at run time, so this file carries no token for the history scan to find.
  const fakeToken = () =>
    `ghp_${randomBytes(27)
      .toString("base64")
      .replace(/[^A-Za-z0-9]/g, "x")
      .slice(0, 36)}`;
  // Octopus-merges branches `side` (committing `onSide`) and `other` into feat/x; the resolution
  // writes `resolved` on top.
  const octopus = (onSide: Record<string, string>, resolved: Record<string, string>) => {
    git("checkout", "-q", "-b", "side", "feat/x");
    for (const [file, text] of Object.entries(onSide)) commit("feat: side #2", file, text);
    git("checkout", "-q", "-b", "other", "feat/x");
    commit("feat: other #2", "other.txt", "other\n");
    git("checkout", "-q", "feat/x");
    commit("feat: ahead #1", "notes.txt", "ahead\n");
    git("merge", "-q", "--no-ff", "--no-commit", "side", "other");
    for (const [file, text] of Object.entries(resolved)) {
      writeFileSync(join(work, file), text);
      git("add", file);
    }
    git("commit", "-q", "-m", "feat: merge side and other #2");
    expect(git("rev-list", "--parents", "-n", "1", "HEAD").split(" ")).toHaveLength(4);
  };
  // .gitleaksignore excuses the side branch's finding in `file` by its side-commit fingerprint.
  const ignoreOnSide = (file: string, rule: string) =>
    writeFileSync(join(work, ".gitleaksignore"), `${git("rev-parse", "side")}:${file}:${rule}:1\n`);
  // Pushing feat/x is refused for the secret in HEAD's `file`, before any check runs.
  const refusesHeadSecret = (file = "config.txt") => {
    const run = push(["feat/x"]);
    expect(run.status).not.toBe(0);
    expect(run.out).toContain("push refused: the secret guard found a secret");
    expect(run.out).toContain(`commit ${git("rev-parse", "HEAD").slice(0, 12)}, file ${file}`);
    expect(cliCalls()).toEqual([]);
  };
  const fakeGitleaks = (body: string) => {
    writeFileSync(join(fakes, "gitleaks"), `#!/bin/sh\n${body}\n`);
    chmodSync(join(fakes, "gitleaks"), 0o755);
    return { PATH: `${fakes}:${env.PATH}` };
  };

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "suite-ui-pre-push-test-"));
    work = join(dir, "work");
    fakes = join(dir, "fakes");
    const hooks = join(dir, "hooks");
    for (const d of [work, hooks, fakes, join(work, "scripts")]) mkdirSync(d);
    writeFileSync(join(dir, "cli.log"), "");
    const toolkit = join(work, "node_modules", "spec-sync-toolkit");
    mkdirSync(join(toolkit, "dist"), { recursive: true });
    writeFileSync(join(toolkit, "package.json"), JSON.stringify({ name: "spec-sync-toolkit" }));
    writeFileSync(
      join(toolkit, "dist", "cli.js"),
      [
        'const fs = require("node:fs");',
        `fs.appendFileSync(${JSON.stringify(join(dir, "cli.log"))}, process.argv.slice(2).join(" ") + "\\n");`,
        `fs.appendFileSync(${JSON.stringify(join(dir, "cli-cwd.log"))}, process.cwd() + "\\n");`,
        `fs.appendFileSync(${JSON.stringify(join(dir, "cli-stdin.log"))}, fs.readFileSync(0, "utf8"));`,
        "const exit = Number(process.env.FAKE_GATE_EXIT ?? 0);",
        "if (process.env.FAKE_GATE_JSON) console.log(process.env.FAKE_GATE_JSON);",
        "else if (exit !== 0) {",
        '  fs.mkdirSync("logs/x", { recursive: true });',
        '  fs.writeFileSync("logs/x/gate.log", "gate-log\\n");',
        '  console.log(JSON.stringify({ exit, failures: [{ name: "lint" }], logDir: "logs/x" }));',
        "}",
        "process.exit(exit);",
        "",
      ].join("\n"),
    );
    writeFileSync(join(hooks, "pre-push"), `#!/bin/sh\n${pkg["simple-git-hooks"]["pre-push"]}\n`);
    chmodSync(join(hooks, "pre-push"), 0o755);
    env = { ...process.env };
    execFileSync("git", ["init", "-q", "--bare", "-b", "main", join(dir, "origin.git")]);
    git("init", "-q", "--template=", "-b", "main");
    // node_modules (the fake toolkit) is ignored, as in the real checkout.
    mkdirSync(join(work, ".git", "info"), { recursive: true });
    writeFileSync(join(work, ".git", "info", "exclude"), "node_modules/\n");
    git("config", "user.email", "test@example.com");
    git("config", "user.name", "test");
    git("config", "maintenance.auto", "false");
    git("config", "core.hooksPath", hooks);
    git("remote", "add", "origin", join(dir, "origin.git"));
    // The hook imports the repo's resolve-then-check helper (#861); it goes into the start commit.
    writeFileSync(
      join(work, "scripts", "resolve-under.ts"),
      readFileSync(new URL("./resolve-under.ts", import.meta.url), "utf8"),
    );
    // …and the toolkit resolver (GL-SEC-011 rev 4).
    writeFileSync(
      join(work, "scripts", "toolkit-cli.ts"),
      readFileSync(new URL("./toolkit-cli.ts", import.meta.url), "utf8"),
    );
    git("add", "scripts/resolve-under.ts", "scripts/toolkit-cli.ts");
    commit("chore: start", "scripts/pre-push.ts", readFileSync(script, "utf8"));
    git("checkout", "-q", "-b", "feat/x");
  });

  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  it("refuses a WIP push that carries a secret, naming commit and file, before any check", () => {
    commit("wip: park", "config.txt", `token = "${fakeToken()}"\n`);
    refusesHeadSecret();
  });

  it("refuses a forced WIP push with a secret over a remote advance this clone never fetched", () => {
    pushed();
    const other = join(dir, "other");
    execFileSync("git", ["clone", "-q", "-b", "feat/x", join(dir, "origin.git"), other]);
    gitIn(other, "config", "user.email", "test@example.com");
    gitIn(other, "config", "user.name", "test");
    commitIn(other, "feat: elsewhere #2", "other.txt", "other\n");
    gitIn(other, "push", "-q", "origin", "feat/x");
    commit("wip: park", "config.txt", `token = "${fakeToken()}"\n`);
    const run = push(["--force", "feat/x"]);
    expect(run.status).not.toBe(0);
    expect(run.out).toContain("found a secret");
    expect(gitIn(other, "ls-remote", "origin", "feat/x")).toContain(
      gitIn(other, "rev-parse", "HEAD"),
    );
  });

  it("refuses a secret that only a merge resolution adds", () => {
    pushed();
    git("checkout", "-q", "-b", "side");
    commit("feat: side #2", "side.txt", "side\n");
    git("checkout", "-q", "feat/x");
    commit("feat: ahead #1", "notes.txt", "ahead\n");
    git("merge", "-q", "--no-ff", "--no-commit", "side");
    writeFileSync(join(work, "config.txt"), `token = "${fakeToken()}"\n`);
    git("add", "config.txt");
    git("commit", "-q", "-m", "wip: merge side");
    refusesHeadSecret();
  });

  // #811: remerge prints no patch for a merge of 3+ parents; a secret its resolution adds hid.
  it("refuses a secret that only an octopus merge resolution adds", () => {
    pushed();
    for (const side of ["side", "other"]) {
      git("checkout", "-q", "-b", side, "feat/x");
      commit(`feat: ${side} #2`, `${side}.txt`, `${side}\n`);
    }
    git("checkout", "-q", "feat/x");
    commit("feat: ahead #1", "notes.txt", "ahead\n");
    git("merge", "-q", "--no-ff", "--no-commit", "side", "other");
    writeFileSync(join(work, "config.txt"), `token = "${fakeToken()}"\n`);
    git("add", "config.txt");
    git("commit", "-q", "-m", "wip: merge side and other");
    expect(git("rev-list", "--parents", "-n", "1", "HEAD").split(" ")).toHaveLength(4);
    refusesHeadSecret();
  });

  // #814: a side-branch secret .gitleaksignore excuses on its side commit stays excused when an
  // octopus merges it; the octopus pass drops what a merge parent brings in, as hygiene does.
  it("lets an octopus merge a side-branch secret .gitleaksignore excuses on the side commit", () => {
    pushed();
    octopus({ "config.txt": `token = "${fakeToken()}"\n` }, {});
    ignoreOnSide("config.txt", "github-pat");
    const run = push(["feat/x"]);
    expect(run.out).not.toContain("found a secret");
    expect(run.status).toBe(0);
  });

  // #814: every private key starts with the same BEGIN line; a second key an octopus resolution
  // adds to a file whose side parent holds an (excused) key is a new block and refuses the push.
  it("refuses a key an octopus resolution adds next to an excused key a parent already holds", () => {
    pushed();
    const first = fakeKey();
    octopus({ "keys.pem": first }, { "keys.pem": first + fakeKey() });
    ignoreOnSide("keys.pem", "private-key");
    refusesHeadSecret("keys.pem");
  });

  // #814: the hook's rule equals hygiene's on every kind of finding.
  it("drops only inherited octopus findings, as hygiene does", () => {
    const first = fakeKey();
    const second = fakeKey();
    octopus(
      { "keys.pem": first, "config.txt": "plain\n" },
      { "keys.pem": first + second, "config.txt": `plain\ntoken = "${fakeToken()}"\n` },
    );
    const head = git("rev-parse", "HEAD");
    const rows = [
      { name: "merge-added line", File: "config.txt", StartLine: 2, EndLine: 2, own: true },
      { name: "inherited line", File: "config.txt", StartLine: 1, EndLine: 1, own: false },
      { name: "inherited block", File: "keys.pem", StartLine: 1, EndLine: 5, own: false },
      {
        name: "new block, shared first line",
        File: "keys.pem",
        StartLine: 6,
        EndLine: 10,
        own: true,
      },
      { name: "block past the file's end", File: "keys.pem", StartLine: 1, EndLine: 99, own: true },
      { name: "reversed block", File: "keys.pem", StartLine: 5, EndLine: 1, own: true },
      { name: "missing file", File: "missing.txt", StartLine: 1, EndLine: 1, own: true },
    ].map((row) => ({ ...row, Commit: head }));
    expect(octopusOwnLeaks(rows, work)).toEqual(hygieneOwnLeaks(rows, work));
    expect(octopusOwnLeaks(rows, work).map((row) => row.name)).toEqual(
      rows.filter((row) => row.own).map((row) => row.name),
    );
  });

  it("refuses with an install hint when gitleaks is missing in the pinned version", () => {
    commit("feat: done #1", "notes.txt", "done\n");
    const run = push(["feat/x"], fakeGitleaks("echo 8.0.0"));
    expect(run.status).not.toBe(0);
    expect(run.out).toContain(`needs gitleaks ${GITLEAKS_VERSION}, found 8.0.0`);
    expect(run.out).toContain(`install gitleaks ${GITLEAKS_VERSION}`);
    expect(cliCalls()).toEqual([]);
  });

  it("refuses a gitleaks tool error as its own outcome, not as a found secret", () => {
    commit("feat: done #1", "notes.txt", "done\n");
    const run = push(
      ["feat/x"],
      fakeGitleaks(`[ "$1" = version ] && { echo ${GITLEAKS_VERSION}; exit 0; }\nexit 1`),
    );
    expect(run.status).not.toBe(0);
    expect(run.out).toContain("the secret guard could not scan (gitleaks exit 1)");
    expect(run.out).not.toContain("found a secret");
    expect(cliCalls()).toEqual([]);
  });

  it("lets a clean WIP push through on the secret guard alone", () => {
    commit("wip: park", "notes.txt", "half done\n");
    const run = push(["feat/x"]);
    expect(run.status).toBe(0);
    expect(run.out).toContain("preflight skipped");
    expect(cliCalls()).toEqual([]);
  });

  it("runs the preflight and nothing else on the pushed tree", () => {
    commit("feat: done #1", "notes.txt", "done\n");
    const run = push(["feat/x"]);
    expect(run.status).toBe(0);
    expect(run.out).not.toContain("pin");
    expect(cliCalls()).toEqual([PREFLIGHT]);
    expect(log("cli-cwd.log")).toEqual([realpathSync(work)]);
    expect(log("cli-stdin.log")[0]).toMatch(/^refs\/heads\/feat\/x [0-9a-f]{40} /);
  });

  it("refuses a red preflight with its phases and the next step", () => {
    commit("feat: done #1", "notes.txt", "done\n");
    const run = push(["feat/x"], { FAKE_GATE_EXIT: "1" });
    expect(run.status).not.toBe(0);
    expect(run.out).toContain("push refused: merge preflight red");
    expect(run.out).toContain("failing phases: lint");
    expect(run.out).toContain(
      "commit the state as `wip: …` and push it to a branch other than main",
    );
    expect(run.out).not.toContain("--no-verify");
    expect(cliCalls()).toEqual([PREFLIGHT]);
  });

  it("refuses an unprovable preflight: exit 2 is not green", () => {
    commit("feat: done #1", "notes.txt", "done\n");
    const run = push(["feat/x"], { FAKE_GATE_EXIT: "2" });
    expect(run.status).not.toBe(0);
    expect(run.out).toContain("merge preflight unprovable");
    expect(run.out).toContain("next: repeat the push");
    expect(cliCalls()).toEqual([PREFLIGHT]);
  });

  it("refuses an unmet preflight precondition with the toolkit's reason and notes", () => {
    commit("feat: done #1", "notes.txt", "done\n");
    const run = push(["feat/x"], {
      FAKE_GATE_EXIT: "4",
      FAKE_GATE_JSON: JSON.stringify({
        exit: 4,
        error: "on battery power — plug in and repeat",
        notes: ["queued behind gate pid 123"],
      }),
    });
    expect(run.status).not.toBe(0);
    expect(run.out).toContain("push refused: merge preflight precondition not met");
    expect(run.out).toContain("(exit 4)");
    expect(run.out).toContain("reason: on battery power — plug in and repeat");
    expect(run.out).toContain("note: queued behind gate pid 123");
    expect(run.out).toContain("next: fix the reason above, then push again");
    expect(run.out).not.toContain(" red ");
    expect(cliCalls()).toEqual([PREFLIGHT]);
  });

  it("keeps the logs of a red preflight run in a throwaway worktree", () => {
    commit("feat: first #1", "notes.txt", "first\n");
    const first = git("rev-parse", "HEAD");
    commit("feat: second #1", "notes.txt", "second\n");
    const run = push([`${first}:refs/heads/feat/y`], { FAKE_GATE_EXIT: "1" });
    expect(run.status).not.toBe(0);
    const logs = /logs: (.+)/.exec(run.out)?.[1]?.trim() ?? "";
    expect(realpathSync(logs)).toBe(realpathSync(join(work, "logs", "x")));
    expect(readFileSync(join(logs, "gate.log"), "utf8")).toBe("gate-log\n");
  });

  it("runs the full set on main despite the WIP marker and says why", () => {
    git("checkout", "-q", "main");
    commit("wip: park", "notes.txt", "half done\n");
    const run = push(["main"]);
    expect(run.status).toBe(0);
    expect(run.out).toContain("`wip:` not honoured — refs/heads/main is pushed");
    expect(cliCalls()).toEqual([PREFLIGHT]);
  });

  // GL-SEC-011 rev 4: without the local toolkit the hook refuses; it never falls back to npx.
  it("refuses a push it cannot preflight because the toolkit is not installed", () => {
    rmSync(join(work, "node_modules"), { recursive: true, force: true });
    commit("feat: first #1", "notes.txt", "first\n");
    const run = push(["feat/x"]);
    expect(run.status).not.toBe(0);
    expect(run.out).toContain("push refused: no merge preflight for");
    expect(run.out).toContain("node_modules/spec-sync-toolkit/dist/cli.js missing");
    expect(run.out).not.toContain("npx");
    expect(cliCalls()).toEqual([]);
  });

  it("checks a pushed commit that is not the checkout in a worktree of its own, then removes it", () => {
    commit("feat: first #1", "notes.txt", "first\n");
    const first = git("rev-parse", "HEAD");
    commit("feat: second #1", "notes.txt", "second\n");
    const run = push([`${first}:refs/heads/feat/y`]);
    expect(run.status).toBe(0);
    expect(cliCalls()).toEqual([PREFLIGHT]);
    const [cwd] = log("cli-cwd.log");
    expect(cwd).toContain("suite-ui-pre-push-");
    expect(git("worktree", "list").split("\n")).toHaveLength(1);
  });

  it("skips the checks for a push that only deletes refs, and says so", () => {
    pushed();
    const run = push([":feat/x"]);
    expect(run.status).toBe(0);
    expect(run.out).toContain("the push only deletes refs");
    expect(cliCalls()).toEqual([]);
  });

  it("refuses with the rebase step in a checkout cut before the hook script existed", () => {
    git("rm", "-q", "scripts/pre-push.ts");
    git("commit", "-q", "-m", "chore: before #794");
    const run = push(["feat/x"]);
    expect(run.status).not.toBe(0);
    expect(run.out).toContain(
      "push refused: this branch predates the pre-push hook (scripts/pre-push.ts missing) — merge or rebase main into it",
    );
  });
});

// #861: keptLogs copies only a log dir inside the throwaway worktree. Everything lives in one temp dir
// — the worktree, the log dirs and this checkout (process.cwd(), stubbed) — so even a regressed
// keptLogs cannot write outside it.
describe("keptLogs", () => {
  let base: string;
  let tree: string;
  let here: string;
  beforeEach(() => {
    base = realpathSync(mkdtempSync(join(tmpdir(), "suite-ui-kept-logs-")));
    tree = join(base, "tree");
    // Deeper than the worktree, so the same relative path from here is not the log dir itself.
    here = join(base, "x", "y", "here");
    mkdirSync(tree, { recursive: true });
    mkdirSync(here, { recursive: true });
    writeFileSync(join(tree, "notes.txt"), "worktree file\n");
    vi.spyOn(process, "cwd").mockReturnValue(here);
  });
  afterEach(() => {
    vi.restoreAllMocks();
    rmSync(base, { recursive: true, force: true });
  });

  it("names a log dir outside the worktree where it is, without copying it", () => {
    const outside = join(base, "logs");
    mkdirSync(outside);
    writeFileSync(join(outside, "gate.log"), "gate-log\n");
    const copyTarget = resolve(here, relative(tree, outside));
    expect(copyTarget.startsWith(`${base}/`)).toBe(true);
    expect(copyTarget).not.toBe(outside);
    expect(keptLogs(outside, tree)).toBe(outside);
    expect(existsSync(copyTarget)).toBe(false);
  });

  it("never copies the worktree root itself into this checkout", () => {
    expect(keptLogs(".", tree)).toBe(tree);
    expect(readdirSync(here)).toEqual([]);
  });

  it("copies a log dir inside the worktree to the same path here", () => {
    mkdirSync(join(tree, "logs", "x"), { recursive: true });
    writeFileSync(join(tree, "logs", "x", "gate.log"), "gate-log\n");
    expect(keptLogs("logs/x", tree)).toBe(join(here, "logs", "x"));
    expect(readFileSync(join(here, "logs", "x", "gate.log"), "utf8")).toBe("gate-log\n");
  });
});
