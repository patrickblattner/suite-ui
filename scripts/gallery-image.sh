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
# - A heavy local step in one of the dev box's machine-wide slots (PROC-REL-060): `npm run
#   gallery:image` takes one through `spec-sync slot run --step gallery --cap 35` (exit 75: the wait
#   expired, a non-run; 124: killed at the cap); the merge gate's gallery phase runs this script
#   directly, inside the slot the gate already holds. Either way this script kills its container
#   at its own 34 min cap and the run ends red — one minute before the slot's 35 min cap ends the
#   script, so no container outlives the slot.
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

# One minute under the slot's cap (35 min: the longest of the last five green gallery runs,
# 25.4 min, plus a third, rounded up to five minutes), so the container is killed first.
CAP=34

STAGE=""
WATCHDOG=""
CONTAINER="suite-ui-gallery-$$"
cleanup() {
  # The watchdog may have fired and exited already (set -e must not end the cleanup); its sleep
  # child is killed too, or it outlives the run.
  if [ -n "$WATCHDOG" ]; then
    pkill -P "$WATCHDOG" 2>/dev/null || true
    kill "$WATCHDOG" 2>/dev/null || true
  fi
  [ -n "$STAGE" ] && rm -rf "$STAGE"
  return 0
}
trap cleanup EXIT
trap 'exit 130' INT TERM

# Past the cap the container is killed and the run ends red, so a hung run never holds its slot
# beyond what the waiters allow.
(sleep $((CAP * 60)) && echo "gallery-image: the run passed its cap of $CAP min — the container is killed and the phase is red; look for a hung test, or if the suite legitimately grew, raise CAP in scripts/gallery-image.sh and --cap in package.json (PROC-REL-060)" >&2 &&
  docker kill "$CONTAINER" >/dev/null 2>&1) &
WATCHDOG=$!

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
docker run --rm --name "$CONTAINER" --init -e TINI_KILL_PROCESS_GROUP=1 --platform "linux/$ARCH" --ipc=host -e CI=1 \
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
