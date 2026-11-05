#!/usr/bin/env bash
# The PDF render of the import fixture (SUI-FEATURE-138 AC1): test/fixtures/pptx/basic.pptx through
# LibreOffice into basic.pdf, then poppler into one PNG per slide (basic-1.png, basic-2.png, …), which
# the gallery page `slide-import` shows beside the imported document. Runs in a one-off Docker
# container, never on the host; regenerate after `node scripts/pptx-fixtures.ts` changed the fixture:
#
#   npm run pptx:render
#
# A heavy local step: the npm script runs it in a dev-box slot with a 15 min cap (PROC-REL-060).
#
# Liberation and Carlito stand in for Arial and Calibri with the same metrics; Georgia has no such
# twin, so LibreOffice picks a serif of its own.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DIR="$ROOT/test/fixtures/pptx"
IMAGE="debian:bookworm-slim"

CONTAINER="suite-ui-pptx-$$"
# `--init` makes tini PID 1, so the container's bash gets the signal; the trap kills the container
# when the slot's cap ends this script, so it never outlives the slot.
trap 'docker kill "$CONTAINER" >/dev/null 2>&1 || true' EXIT
trap 'exit 143' TERM
trap 'exit 130' INT

rm -f "$DIR"/basic.pdf "$DIR"/basic-*.png
docker run --rm --init --name "$CONTAINER" -v "$DIR:/work" -w /work "$IMAGE" bash -euo pipefail -c '
  export DEBIAN_FRONTEND=noninteractive
  apt-get update -qq
  apt-get install -y -qq --no-install-recommends libreoffice-impress poppler-utils \
    fonts-liberation2 fonts-crosextra-carlito fonts-dejavu-core >/dev/null
  cp basic.pptx /tmp/basic.pptx
  soffice --headless --convert-to pdf --outdir /tmp /tmp/basic.pptx >/dev/null
  pdftoppm -png -scale-to-x 960 -scale-to-y -1 /tmp/basic.pdf /tmp/basic
  cp /tmp/basic.pdf /work/basic.pdf
  # pdftoppm numbers pages with leading zeros by page count; the gallery expects basic-<n>.png.
  for file in /tmp/basic-*.png; do
    n="${file##*-}"
    cp "$file" "/work/basic-$((10#${n%.png})).png"
  done
'
ls -l "$DIR"
