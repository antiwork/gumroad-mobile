#!/bin/bash
set -euo pipefail
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
DIR="$(cd "$(dirname "$0")" && pwd)"
OUT="$DIR/iphone-67"
HTML="file://$DIR/frame.html"
mkdir -p "$OUT"
declare -a names=(
  [1]="01-create-product.png"
  [2]="02-edit-product.png"
  [3]="03-publish.png"
  [4]="04-sales.png"
  [5]="05-library.png"
)
for n in 1 2 3 4 5; do
  tmp="$OUT/tmp-$n.png"
  "$CHROME" --headless --disable-gpu --hide-scrollbars \
    --window-size=1290,2796 \
    --screenshot="$tmp" \
    "${HTML}?n=${n}"
  sips -z 2796 1290 "$tmp" >/dev/null
  mv "$tmp" "$OUT/${names[$n]}"
  echo "rendered ${names[$n]} $(sips -g pixelWidth -g pixelHeight "$OUT/${names[$n]}" | tr '\n' ' ')"
done
rm -f "$OUT/02-publish.png" "$OUT/03-sales.png" "$OUT/04-watch.png"
ls -la "$OUT"
