#!/bin/bash
# Claude Usage Widget — one-line installer.
#   curl -fsSL https://raw.githubusercontent.com/alexgrygoriev/claude-usage-widget/main/install.sh | bash
set -euo pipefail

WIDGETS="$HOME/Library/Application Support/Übersicht/widgets"
NAME="claude-limits.widget"

echo "☕ Installing Claude Usage Widget…"

# 1. Übersicht
if [ ! -d "/Applications/Übersicht.app" ]; then
  echo "→ Übersicht not found. Installing via Homebrew…"
  if ! command -v brew >/dev/null 2>&1; then
    echo "✗ Homebrew is required. Install it from https://brew.sh and re-run." >&2
    exit 1
  fi
  brew install --cask ubersicht
fi

# 2. Fetch the widget (works whether run from a clone or piped from curl)
mkdir -p "$WIDGETS"
if [ -d "$(dirname "$0")/$NAME" ]; then
  cp -R "$(dirname "$0")/$NAME" "$WIDGETS/"
else
  TMP="$(mktemp -d)"
  echo "→ Downloading widget…"
  curl -fsSL "https://codeload.github.com/alexgrygoriev/claude-usage-widget/tar.gz/refs/heads/main" \
    | tar -xz -C "$TMP"
  cp -R "$TMP/claude-usage-widget-main/$NAME" "$WIDGETS/"
  rm -rf "$TMP"
fi
chmod +x "$WIDGETS/$NAME/fetch.sh"

# 3. Launch
open -a "Übersicht" || true

echo "✅ Done. Look at the top-right of your desktop."
echo "   On first run, click 'Always Allow' on the Keychain prompt."
echo "   (Requires Claude Code logged in: run 'claude' if you haven't.)"
