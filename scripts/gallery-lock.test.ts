// @vitest-environment node
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  acquire,
  type Deps,
  GALLERY_CAP_MIN,
  holderLine,
  judge,
  LOCK_EXPIRED,
  parseHolder,
  repositoryOf,
  type Verdict,
  WAIT_ALLOWANCE_MIN,
} from "./gallery-lock";

// The gallery machine lock (#794, PROC-REL-040 rev 7): holder line, waiter deadline from the
// holder's cap, chain bound, exit 75.
const script = fileURLToPath(new URL("./gallery-lock.ts", import.meta.url));
const MIN = 60_000;
const T0 = Date.parse("2026-11-04T12:00:00.000Z");
const line = (startedMs: number, cap = GALLERY_CAP_MIN) =>
  holderLine("patrickblattner/suite-ui", "1@wt-1", new Date(startedMs), cap);
const message = (verdict: Verdict) => ("message" in verdict ? verdict.message : "");

describe("holder line", () => {
  it("is one line of the four keys, read back with unknown keys ignored", () => {
    expect(line(T0)).toBe(
      `repository=patrickblattner/suite-ui run=1@wt-1 started=2026-11-04T12:00:00.000Z cap=${GALLERY_CAP_MIN}`,
    );
    expect(parseHolder(`${line(T0)} extra=1`)).toEqual({ started: T0, cap: GALLERY_CAP_MIN });
    expect(parseHolder("garbage")).toEqual({ started: undefined, cap: undefined });
  });

  it("names the repository from the origin url", () => {
    expect(repositoryOf("https://github.com/patrickblattner/suite-ui.git\n")).toBe(
      "patrickblattner/suite-ui",
    );
    expect(repositoryOf("git@github.com:patrickblattner/suite-ui.git")).toBe(
      "patrickblattner/suite-ui",
    );
    expect(repositoryOf("")).toBe("?");
  });

  it("caps the gallery at the longest green run plus a third, rounded up to five minutes", () => {
    expect(GALLERY_CAP_MIN).toBe(Math.ceil((25.4 * 4) / 3 / 5) * 5);
    expect(WAIT_ALLOWANCE_MIN).toBe(GALLERY_CAP_MIN + 5);
  });
});

describe("judge", () => {
  const alive = { pid: "1", alive: true, root: "/wt-1", noPidForMs: 0 };

  it("takes over a lock whose pid is dead, or one without a pid past the grace", () => {
    expect(judge({ ...alive, alive: false, holder: line(T0) }, T0, T0).action).toBe("takeover");
    expect(judge({ alive: false, noPidForMs: 31_000 }, T0, T0).action).toBe("takeover");
    expect(judge({ alive: false, noPidForMs: 5_000 }, T0, T0).action).toBe("wait");
  });

  it("waits while the live holder is within its cap plus five minutes, naming it", () => {
    const now = T0 + (GALLERY_CAP_MIN + 5) * MIN;
    const verdict = judge({ ...alive, holder: line(T0) }, now, now - MIN);
    expect(verdict).toEqual({
      action: "wait",
      message: "gallery-lock: waiting for the gallery run 1 (/wt-1)",
    });
  });

  it("expires once the holder outlived its cap by more than five minutes", () => {
    const now = T0 + (GALLERY_CAP_MIN + 5) * MIN + 1;
    const verdict = judge({ ...alive, holder: line(T0) }, now, now - MIN);
    expect(verdict.action).toBe("expired");
    expect(message(verdict)).toContain("lock deadline expired");
    expect(message(verdict)).toContain("1 (/wt-1)");
  });

  it("follows the holder's own cap, re-read on every attempt", () => {
    const now = T0 + 16 * MIN;
    expect(judge({ ...alive, holder: line(T0, 10) }, now, now).action).toBe("expired");
    expect(judge({ ...alive, holder: line(T0, 60) }, now, now).action).toBe("wait");
  });

  it("prints an unreadable holder line raw and falls back to 40 minutes", () => {
    const waiting = judge({ ...alive, holder: "started=yesterday" }, T0 + 39 * MIN, T0);
    expect(waiting.action).toBe("wait");
    expect(message(waiting)).toContain('"started=yesterday"');
    expect(judge({ ...alive, holder: "started=yesterday" }, T0 + 41 * MIN, T0).action).toBe(
      "expired",
    );
    expect(judge({ ...alive }, T0 + 41 * MIN, T0).action).toBe("expired");
  });

  it("ends a chain of compliant holders at the wait allowance", () => {
    const now = T0 + WAIT_ALLOWANCE_MIN * MIN + 1;
    const verdict = judge({ ...alive, holder: line(now - MIN) }, now, T0);
    expect(verdict.action).toBe("chain");
    expect(message(verdict)).toContain("lock deadline expired — chain");
  });
});

describe("acquire", () => {
  let dir: string;
  let lock: string;
  let clock: number;
  let lines: string[];
  const deps = (alive: (pid: string) => boolean, onSleep: () => void = () => {}): Deps => ({
    now: () => clock,
    sleep: (ms) => {
      clock += ms;
      onSleep();
      return Promise.resolve();
    },
    alive,
    log: (entry) => lines.push(entry),
  });

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "gallery-lock-"));
    lock = join(dir, "gallery.lock");
    clock = T0;
    lines = [];
  });
  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  const hold = (pid: string, holder: string) => {
    mkdirSync(lock, { recursive: true });
    writeFileSync(join(lock, "pid"), `${pid}\n`);
    writeFileSync(join(lock, "root"), "/wt-other\n");
    writeFileSync(join(lock, "holder"), `${holder}\n`);
  };

  it("takes a free lock and writes pid, root and the holder line", async () => {
    expect(
      await acquire(
        lock,
        "42",
        "/x/wt-794",
        "o/r",
        deps(() => true),
      ),
    ).toBe(0);
    expect(readFileSync(join(lock, "pid"), "utf8")).toBe("42\n");
    expect(readFileSync(join(lock, "holder"), "utf8")).toBe(
      `repository=o/r run=42@wt-794 started=2026-11-04T12:00:00.000Z cap=${GALLERY_CAP_MIN}\n`,
    );
  });

  it("waits for a live holder and takes the lock once it is gone", async () => {
    hold("7", line(T0));
    let ended = false;
    const code = await acquire(
      lock,
      "42",
      "/x/wt-794",
      "o/r",
      deps(
        () => !ended,
        () => (ended = clock >= T0 + 2 * MIN),
      ),
    );
    expect(code).toBe(0);
    expect(lines[0]).toBe("gallery-lock: waiting for the gallery run 7 (/wt-other)");
    expect(lines).toContain("gallery-lock: taking over the lock of ended run 7");
    expect(readFileSync(join(lock, "pid"), "utf8")).toBe("42\n");
  });

  it("exits 75 behind a holder past its deadline and leaves its lock alone", async () => {
    hold("7", line(T0 - (GALLERY_CAP_MIN + 6) * MIN));
    expect(
      await acquire(
        lock,
        "42",
        "/x/wt-794",
        "o/r",
        deps(() => true),
      ),
    ).toBe(LOCK_EXPIRED);
    expect(lines[0]).toMatch(/lock deadline expired — the gallery run 7 \(\/wt-other\)/);
    expect(readFileSync(join(lock, "pid"), "utf8")).toBe("7\n");
  });

  it("exits 75 'chain' when fresh holders keep the lock past the allowance", async () => {
    hold("7", line(T0));
    const code = await acquire(
      lock,
      "42",
      "/x/wt-794",
      "o/r",
      deps(
        () => true,
        () => hold("7", line(clock)),
      ),
    );
    expect(code).toBe(LOCK_EXPIRED);
    expect(lines.at(-2)).toMatch(/chain/);
    expect(clock - T0).toBeGreaterThan(WAIT_ALLOWANCE_MIN * MIN);
  });

  it("exits 75 from the command line, naming the holder", () => {
    hold(String(process.pid), line(Date.now() - (GALLERY_CAP_MIN + 6) * MIN));
    const run = spawnSync("node", [script, lock, "42", dir], { encoding: "utf8" });
    expect(run.status).toBe(75);
    expect(run.stderr).toContain(
      `lock deadline expired — the gallery run ${process.pid} (/wt-other)`,
    );
  });
});
