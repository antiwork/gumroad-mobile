#!/bin/bash
# Renders the five App Store 6.7" frames from frame.html.
# Inputs: simulator-raw/*.png (iOS Simulator captures). Fonts come from assets/fonts/.
# Output: iphone-67/*.png at 1290x2796.
set -euo pipefail
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
DIR="$(cd "$(dirname "$0")" && pwd)"
OUT="$DIR/iphone-67"
HTML="file://$DIR/frame.html"
mkdir -p "$OUT"
declare -a names=(
  [1]="01-create-product.png"
  [2]="02-name-price.png"
  [3]="03-today.png"
  [4]="04-sales.png"
  [5]="05-library.png"
)
for n in 1 2 3 4 5; do
  tmp="$OUT/tmp-$n.png"
  "$CHROME" --headless --disable-gpu --hide-scrollbars \
    --allow-file-access-from-files \
    --window-size=1290,2796 \
    --screenshot="$tmp" \
    "${HTML}?n=${n}"
  sips -z 2796 1290 "$tmp" >/dev/null
  mv "$tmp" "$OUT/${names[$n]}"
  echo "rendered ${names[$n]}"
done
ls -la "$OUT"
