#!/usr/bin/env bash
# Runs the gallery screenshots in the pinned Playwright image on this machine (SUI-FEATURE-076):
# the merge gate (run on this machine) compares against Linux baselines taken in that image, never against a rendering of
# the host. Arguments go through to Playwright:
#
#   npm run gallery:image                               # compare
#   npm run gallery:image -- --update-snapshots=all     # regenerate the baselines
#
# Native, never emulated: the container runs in the Docker engine's own architecture (`linux/arm64`
# on the MacBook). Baselines are taken and compared on this machine only, so both sides share it;
# amd64 emulation loaded the Mac until the hooks of every session timed out.
#
# Gentle on the host:
# - The container's dependencies live in a Docker volume per architecture. It is reinstalled only
#   when the lockfile or the image changes; otherwise the run installs nothing.
# - At most one gallery run at a time, across all worktrees: a lock directory in the main checkout's
#   `.spec-sync/`. A second run waits, at most 30 minutes (then exit 4); a lock whose owner is gone,
#   or one left without a pid for 30 seconds, is taken over.
#
# It works on a throwaway copy of the working tree: the checkout's `node_modules` are built for the
# host. Only the baselines and the reports come back.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
IMAGE="$(node "$ROOT/scripts/playwright-image.ts")"

# The Docker engine's own architecture, not the calling shell's: under Rosetta `uname -m` says
# x86_64 on an arm64 Mac and would bring the emulation back.
ENGINE_ARCH="$(docker version --format '{{.Server.Arch}}')"
case "$ENGINE_ARCH" in
  arm64 | aarch64) ARCH=arm64 ;;
  amd64 | x86_64) ARCH=amd64 ;;
  *)
    echo "gallery-image: unknown Docker engine architecture $ENGINE_ARCH" >&2
    exit 4
    ;;
esac

COMMON="$(git -C "$ROOT" rev-parse --path-format=absolute --git-common-dir)"
MAIN="$(dirname "$COMMON")"
LOCK="$MAIN/.spec-sync/gallery.lock"
mkdir -p "$MAIN/.spec-sync"
# A lock without a pid (its run died between creating it and writing the pid) counts as stale after
# `LOCK_GRACE` seconds; a run waits at most `LOCK_WAIT_MAX` seconds for the lock, then exits 4.
LOCK_GRACE=30
LOCK_WAIT_MAX=1800

STAGE=""
cleanup() {
  [ -n "$STAGE" ] && rm -rf "$STAGE"
  # Only this run's own lock: a lock another run took over stays.
  [ "$(cat "$LOCK/pid" 2>/dev/null || true)" = "$$" ] && rm -rf "$LOCK"
  return 0
}
trap cleanup EXIT
trap 'exit 130' INT TERM

# `mkdir` is atomic: whoever creates the directory holds the lock. A stale lock is moved aside in
# one atomic step and only dropped if it is still the one judged stale; otherwise it goes back.
waited=0
until mkdir "$LOCK" 2>/dev/null; do
  owner="$(cat "$LOCK/pid" 2>/dev/null || true)"
  stale=0
  if [ -n "$owner" ]; then
    kill -0 "$owner" 2>/dev/null || stale=1
  else
    since="$(stat -f %m "$LOCK" 2>/dev/null || stat -c %Y "$LOCK" 2>/dev/null || date +%s)"
    [ $(($(date +%s) - since)) -ge "$LOCK_GRACE" ] && stale=1
  fi
  if [ "$stale" = 1 ]; then
    aside="$LOCK.stale.$$"
    if mv "$LOCK" "$aside" 2>/dev/null; then
      if [ "$(cat "$aside/pid" 2>/dev/null || true)" = "$owner" ]; then
        echo "gallery-image: taking over the lock of ended run ${owner:-without pid}" >&2
        rm -rf "$aside"
      elif [ ! -e "$LOCK" ]; then
        mv "$aside" "$LOCK" 2>/dev/null || rm -rf "$aside"
      else
        rm -rf "$aside"
      fi
    fi
    continue
  fi
  holder="${owner:-?} ($(cat "$LOCK/root" 2>/dev/null || echo ?))"
  if [ "$waited" -ge "$LOCK_WAIT_MAX" ]; then
    echo "gallery-image: gave up after ${LOCK_WAIT_MAX}s waiting for the gallery run $holder" >&2
    echo "gallery-image: the lock is $LOCK" >&2
    exit 4
  fi
  echo "gallery-image: waiting for the gallery run $holder" >&2
  sleep 10
  waited=$((waited + 10))
done
echo $$ >"$LOCK/pid"
echo "$ROOT" >"$LOCK/root"

STAGE="$(mktemp -d "${TMPDIR:-/tmp}/suite-ui-gallery-XXXXXX")"
rsync -a \
  --exclude='node_modules' --exclude='.git' --exclude='dist' \
  --exclude='test-results' --exclude='playwright-report' --exclude='.spec-sync' \
  "$ROOT/" "$STAGE/"

# What the installed dependencies were made from: the lockfile and the image. The package's own
# version is left out, so a release bump reinstalls nothing.
DEPS_KEY="$(
  node -e '
    const lock = JSON.parse(require("node:fs").readFileSync(process.argv[1], "utf8"));
    delete lock.version;
    if (lock.packages?.[""]) delete lock.packages[""].version;
    process.stdout.write(JSON.stringify(lock) + process.argv[2]);
  ' "$ROOT/package-lock.json" "$IMAGE" | shasum -a 256 | cut -d' ' -f1
)"
VOLUME="suite-ui-gallery-deps-$ARCH"

# The build runs on the container's own file system, not on the bind mount; the mount only carries
# the copy in and the results out. `node_modules` is a link into the volume. The install skips
# scripts: the gallery runs from the sources, so the package build (`prepare`) has nothing to do.
# `--init` with `TINI_KILL_PROCESS_GROUP` hands Ctrl-C (proxied by `docker run`) to the whole run in
# the container, so the run ends and the container goes with it.
rc=0
docker run --rm --init -e TINI_KILL_PROCESS_GROUP=1 --platform "linux/$ARCH" --ipc=host -e CI=1 \
  -e DEPS_KEY="$DEPS_KEY" \
  -v "$STAGE:/work" -v "$VOLUME:/deps" "$IMAGE" \
  bash -c 'rc=1; cp -a /work /build && cd /build &&
    if [ "$(cat /deps/.key 2>/dev/null)" = "$DEPS_KEY" ]; then
      echo "gallery-image: dependencies up to date, nothing installed";
    else
      echo "gallery-image: lockfile or image changed, installing dependencies";
      rm -f /deps/.key && cp package.json package-lock.json /deps/ &&
        (cd /deps && npm ci --ignore-scripts --no-audit --no-fund >/dev/null) &&
        echo "$DEPS_KEY" >/deps/.key;
    fi &&
    ln -s /deps/node_modules node_modules &&
    { npm run gallery -- "$@"; rc=$?; } ;
    cp -a gallery/__screenshots__/. /work/gallery/__screenshots__/ ;
    rm -rf /work/test-results /work/playwright-report ;
    cp -a test-results playwright-report /work/ 2>/dev/null ; exit $rc' gallery-image "$@" ||
  rc=$?

rsync -a "$STAGE/gallery/__screenshots__/" "$ROOT/gallery/__screenshots__/"
rm -rf "$ROOT/test-results" "$ROOT/playwright-report"
cp -a "$STAGE/test-results" "$STAGE/playwright-report" "$ROOT/" 2>/dev/null || true
exit "$rc"
