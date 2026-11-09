#!/usr/bin/env bash
# Upload the dSYMs of the prebuilt React Native frameworks an iOS Release archive ships, so Sentry
# can symbolicate crashes that happen inside them. RCT_SYMBOLICATE_PREBUILT_FRAMEWORKS covers only
# React.framework; hermesvm and ReactNativeDependencies ship without dSYMs and are not in the
# archive, so their frames stay unresolved without this step.
#
# Usage: scripts/upload-ios-release-symbols.sh [path/to/Gumroad.xcarchive]
# Needs SENTRY_AUTH_TOKEN in the environment.
set -euo pipefail

ARCHIVE=${1:-ios/build/Gumroad.xcarchive}
ROOT=$(cd "$(dirname "$0")/.." && pwd)
cd "$ROOT"

FRAMEWORKS="$ARCHIVE/Products/Applications/Gumroad.app/Frameworks"
SYMBOLS_DIR="$ARCHIVE/dSYMs"
WORK_DIR=ios/build/symbols
MAVEN=https://repo1.maven.org/maven2/com/facebook/react/react-native-artifacts
RN_VERSION=$(node -p "require('./package.json').dependencies['react-native']")
case "$RN_VERSION" in
  [0-9]*.[0-9]*.[0-9]*) ;;
  *) echo "react-native is pinned as '$RN_VERSION'; this script needs an exact version" >&2; exit 1 ;;
esac
ORG=$(sed -n 's/^defaults\.org=//p' ios/sentry.properties)
PROJECT=$(sed -n 's/^defaults\.project=//p' ios/sentry.properties)
SENTRY_CLI=node_modules/.bin/sentry-cli

if [ ! -d "$ARCHIVE" ]; then
  echo "no archive at $ARCHIVE — build the app first" >&2
  exit 1
fi
if [ -z "${SENTRY_AUTH_TOKEN:-}" ]; then
  echo "SENTRY_AUTH_TOKEN is not set" >&2
  exit 1
fi

HERMES_TARBALL=$(ls ios/Pods/hermes-engine-artifacts/hermes-ios-*-release.tar.gz 2>/dev/null | head -1 || true)
if [ -z "$HERMES_TARBALL" ]; then
  echo "no hermes-engine-artifacts tarball under ios/Pods — run npm run rebuild && pod install first" >&2
  exit 1
fi
HERMES_VERSION=$(basename "$HERMES_TARBALL" | sed 's/^hermes-ios-//; s/-release\.tar\.gz$//')

mkdir -p "$WORK_DIR"
export SENTRY_ORG="${SENTRY_ORG:-$ORG}" SENTRY_PROJECT="${SENTRY_PROJECT:-$PROJECT}"

uuid_of() {
  xcrun dwarfdump --uuid "$1" | awk 'NR==1 {print $2}'
}

fetch_dsym() {
  label=$1
  url=$2
  member=$3
  tarball="$WORK_DIR/$(basename "$url")"

  binary="$FRAMEWORKS/$label.framework/$label"
  if [ ! -f "$binary" ]; then
    echo "$label: not in the archive, skipping"
    return 0
  fi

  want=$(uuid_of "$binary")
  existing="$SYMBOLS_DIR/$label.framework.dSYM/Contents/Resources/DWARF/$label"
  if [ -f "$existing" ] && [ "$(uuid_of "$existing")" = "$want" ]; then
    echo "$label: dSYM already in the archive ($want)"
    return 0
  fi

  if [ ! -f "$tarball" ]; then
    curl -fsSL -o "$tarball.tmp" "$url" || { rm -f "$tarball.tmp"; return 1; }
    mv "$tarball.tmp" "$tarball"
  fi
  mkdir -p "$WORK_DIR/$label"
  tar xzf "$tarball" -C "$WORK_DIR/$label" "$member"
  dsym="$WORK_DIR/$label/$member"
  got=$(uuid_of "$dsym")

  if [ "$want" != "$got" ]; then
    echo "$label: dSYM uuid $got does not match the archived framework uuid $want" >&2
    exit 1
  fi

  echo "$label: uploading dSYM $got"
  "$SENTRY_CLI" debug-files upload "$dsym"
}

fetch_dsym hermesvm \
  "https://repo1.maven.org/maven2/com/facebook/hermes/hermes-ios/$HERMES_VERSION/hermes-ios-$HERMES_VERSION-hermes-framework-dSYM-release.tar.gz" \
  ./iphoneos/hermesvm.framework.dSYM/Contents/Resources/DWARF/hermesvm

fetch_dsym React \
  "$MAVEN/$RN_VERSION/react-native-artifacts-$RN_VERSION-reactnative-core-dSYM-release.tar.gz" \
  ./ios-arm64/React.framework.dSYM/Contents/Resources/DWARF/React

fetch_dsym ReactNativeDependencies \
  "$MAVEN/$RN_VERSION/react-native-artifacts-$RN_VERSION-reactnative-dependencies-dSYM-release.tar.gz" \
  ./ios-arm64/ReactNativeDependencies.framework.dSYM/Contents/Resources/DWARF/ReactNativeDependencies
