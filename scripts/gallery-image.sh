#!/usr/bin/env bash
# Runs the gallery screenshots in the pinned Playwright image on this machine (SUI-FEATURE-076):
# the local gate compares against the same Linux baselines as the CI workflow, never against a
# rendering of the host. Arguments go through to Playwright:
#
#   npm run gallery:image                               # compare
#   npm run gallery:image -- --update-snapshots=all     # regenerate the baselines
#
# It works on a throwaway copy of the working tree: the checkout's `node_modules` are built for the
# host, so the container gets its own `npm ci` like the CI job. Only the baselines and the reports
# come back. `--platform linux/amd64` because the runners are amd64 and a baseline has to be
# rendered on the architecture it is compared on.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
IMAGE="$(node "$ROOT/scripts/playwright-image.ts")"
STAGE="$(mktemp -d "${TMPDIR:-/tmp}/suite-ui-gallery-XXXXXX")"
trap 'rm -rf "$STAGE"' EXIT

rsync -a \
  --exclude='node_modules' --exclude='.git' --exclude='dist' \
  --exclude='test-results' --exclude='playwright-report' --exclude='.spec-sync' \
  "$ROOT/" "$STAGE/"

# The build runs on the container's own file system, not on the bind mount; the mount only carries
# the copy in and the results out.
rc=0
docker run --rm --platform linux/amd64 --ipc=host -e CI=1 \
  -v "$STAGE:/work" "$IMAGE" \
  bash -c 'cp -a /work /build && cd /build && npm ci --no-audit --no-fund >/dev/null &&
    { npm run gallery -- "$@"; rc=$?; } ;
    cp -a gallery/__screenshots__/. /work/gallery/__screenshots__/ ;
    rm -rf /work/test-results /work/playwright-report ;
    cp -a test-results playwright-report /work/ 2>/dev/null ; exit $rc' gallery-image "$@" ||
  rc=$?

rsync -a "$STAGE/gallery/__screenshots__/" "$ROOT/gallery/__screenshots__/"
rm -rf "$ROOT/test-results" "$ROOT/playwright-report"
cp -a "$STAGE/test-results" "$STAGE/playwright-report" "$ROOT/" 2>/dev/null || true
exit "$rc"
