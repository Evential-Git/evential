#!/usr/bin/env bash
# Rebuilds images/ncaec/ from the real NCAEC album, per manifest.tsv.
# Idempotent: skips outputs newer than their source. Re-run any time.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SRC="$ROOT/NCAEC Photos - 7-30-26-8-1-26"
OUT="$ROOT/images/ncaec"
MANIFEST="$ROOT/tools/manifest.tsv"
DIMFILE="$OUT/dimensions.txt"

mkdir -p "$OUT"
: > "$DIMFILE.tmp"

BUDGET_BYTES=$((3 * 1024 * 1024))
total_bytes=0

# Color/tone grade only, applied at full source resolution (cheap, no noise here).
grade() {
  magick "$1" -auto-orient \
    -channel B -evaluate multiply 1.045 +channel \
    -channel R -evaluate multiply 0.975 +channel \
    -modulate 100,86,100 \
    -sigmoidal-contrast 2.2x45% \
    -level 1%,97% \
    -strip \
    "$2"
}

crop_to_aspect() {
  local aspect="$3" gravity="$4"
  local w h wh
  wh=$(magick identify -format "%w %h" "$1")
  w="${wh%% *}"; h="${wh##* }"
  local tw th
  case "$aspect" in
    2:1) tw=$w; th=$(( w / 2 ));;
    4:5) tw=$(( h * 4 / 5 )); th=$h;;
    1:1) tw=$(( w < h ? w : h )); th=$tw;;
    *)   tw=$w; th=$h;;
  esac
  if [ "$th" -gt "$h" ]; then th=$h; fi
  if [ "$tw" -gt "$w" ]; then tw=$w; fi
  magick "$1" -gravity "$gravity" -crop "${tw}x${th}+0+0" +repage "$2"
}

while IFS=$'\t' read -r name src aspect gravity quality widths; do
  [ -z "$name" ] && continue
  srcpath="$SRC/$src"
  if [ ! -f "$srcpath" ]; then
    echo "MISSING SOURCE: $src (for $name)" >&2
    exit 1
  fi

  cropped="/tmp/ncaec-${name}-cropped.png"
  graded="/tmp/ncaec-${name}-graded.png"
  crop_to_aspect "$srcpath" "$cropped" "$aspect" "$gravity"
  grade "$cropped" "$graded" "$quality"

  IFS=',' read -ra wlist <<< "$widths"
  for w in "${wlist[@]}"; do
    outfile="$OUT/${name}-${w}.webp"
    if [ -f "$outfile" ] && [ "$outfile" -nt "$srcpath" ]; then
      sz=$(stat -f%z "$outfile" 2>/dev/null || stat -c%s "$outfile")
      total_bytes=$(( total_bytes + sz ))
      continue
    fi
    # Grain applied AFTER resize, at final pixel size, subtle (2-3%), then re-encoded.
    magick "$graded" -resize "${w}x" \
      -attenuate 0.02 +noise Gaussian \
      -strip -quality "$quality" -define webp:method=6 \
      "$outfile"
    gpsdata=$(magick identify -verbose "$outfile" 2>/dev/null | grep -i 'gps' || true)
    if [ -n "$gpsdata" ]; then
      echo "GPS DATA STILL PRESENT IN $outfile, aborting" >&2
      exit 1
    fi
    dims=$(magick identify -format "%w %h" "$outfile")
    echo "${name}-${w} $dims" >> "$DIMFILE.tmp"
    sz=$(stat -f%z "$outfile" 2>/dev/null || stat -c%s "$outfile")
    total_bytes=$(( total_bytes + sz ))
  done
  rm -f "$cropped" "$graded"
  echo "done: $name"
done < "$MANIFEST"

mv "$DIMFILE.tmp" "$DIMFILE"

echo "---"
echo "images/ncaec total: $((total_bytes / 1024)) KB"
if [ "$total_bytes" -gt "$BUDGET_BYTES" ]; then
  echo "OVER BUDGET (3 MB cap). Trim widths or lower quality." >&2
  exit 1
fi
echo "within 3MB budget."
