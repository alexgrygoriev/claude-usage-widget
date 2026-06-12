#!/bin/bash
# Claude Usage Widget — one-line installer.
#   curl -fsSL https://raw.githubusercontent.com/alexgrygoriev/claude-usage-widget/main/install.sh | bash
#
# Goal: a brand-new Mac runs this once and the widget is just *there* — no
# manual steps. We never hard-depend on Homebrew: if brew is missing or broken
# (e.g. an unwritable /opt/homebrew), we fall back to a direct download of the
# notarized Übersicht app from its official site.
set -euo pipefail

WIDGETS="$HOME/Library/Application Support/Übersicht/widgets"
NAME="claude-limits.widget"
APP="/Applications/Übersicht.app"
BUNDLE_ID="tracesOf.Uebersicht"
LSREGISTER="/System/Library/Frameworks/CoreServices.framework/Frameworks/LaunchServices.framework/Support/lsregister"

echo "☕ Installing Claude Usage Widget…"

# ---------------------------------------------------------------------------
# 1. Übersicht — the widget host.
#    (a) try Homebrew if it's there and working;
#    (b) otherwise download the official build straight from tracesof.net.
#    Either way we end up with /Applications/Übersicht.app, de-quarantined and
#    registered with Launch Services so `open` works immediately.
# ---------------------------------------------------------------------------
install_ubersicht_direct() {
  echo "→ Fetching Übersicht directly from tracesof.net…"
  local page url tmp zip appdir
  page="$(curl -fsSL https://tracesof.net/uebersicht/ 2>/dev/null || true)"
  url="$(printf '%s' "$page" | grep -oE 'https://tracesof\.net/uebersicht/releases/[^"]+\.app\.zip' | head -1)"
  if [ -z "$url" ]; then
    echo "✗ Couldn't find the Übersicht download link. Grab it manually:" >&2
    echo "    https://tracesof.net/uebersicht/" >&2
    return 1
  fi
  tmp="$(mktemp -d)"; zip="$tmp/ubersicht.zip"
  curl -fsSL -o "$zip" "$url"            || { echo "✗ Download failed: $url" >&2; rm -rf "$tmp"; return 1; }
  ditto -x -k "$zip" "$tmp/extract"      || { echo "✗ Could not unzip the download." >&2; rm -rf "$tmp"; return 1; }
  appdir="$(find "$tmp/extract" -maxdepth 1 -name '*.app' | head -1)"
  [ -n "$appdir" ]                       || { echo "✗ No .app inside the archive." >&2; rm -rf "$tmp"; return 1; }
  rm -rf "$APP"
  cp -R "$appdir" /Applications/
  # Strip the download quarantine so it opens without a Gatekeeper prompt,
  # and tell Launch Services about it so `open -b <bundle id>` resolves.
  xattr -dr com.apple.quarantine "$APP" 2>/dev/null || true
  [ -x "$LSREGISTER" ] && "$LSREGISTER" -f "$APP" 2>/dev/null || true
  rm -rf "$tmp"
  echo "→ Übersicht installed to /Applications."
}

if [ ! -d "$APP" ]; then
  echo "→ Übersicht not found."
  if command -v brew >/dev/null 2>&1; then
    echo "→ Trying Homebrew…"
    brew install --cask ubersicht || echo "→ Homebrew couldn't install it — falling back to a direct download."
  fi
  # Whatever happened above, if the app still isn't there, download it ourselves.
  if [ ! -d "$APP" ]; then
    install_ubersicht_direct || exit 1
  fi
fi

# ---------------------------------------------------------------------------
# 2. Drop in the widget (works whether run from a clone or piped from curl).
# ---------------------------------------------------------------------------
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

# ---------------------------------------------------------------------------
# 3. Launch (robust: the app name has an umlaut, so `open -a "Übersicht"` often
#    fails via Launch Services — go by bundle id / full path instead).
# ---------------------------------------------------------------------------
launch_ubersicht() {
  open -b "$BUNDLE_ID" 2>/dev/null && return 0
  [ -d "$APP" ] && open "$APP" 2>/dev/null && return 0
  open -a "Übersicht" 2>/dev/null && return 0
  return 1
}
if launch_ubersicht; then
  echo "→ Übersicht launched."
else
  echo "⚠ Could not auto-launch Übersicht — open it manually from /Applications." >&2
fi

# ---------------------------------------------------------------------------
# 4. Always start on login, so the widget is always there after a reboot.
# ---------------------------------------------------------------------------
osascript -e 'tell application "System Events" to if not (exists login item "Übersicht") then make login item at end with properties {path:"'"$APP"'", hidden:false}' >/dev/null 2>&1 || true

echo "✅ Done. Look at the top-right of your desktop."
echo "   On first run, click 'Always Allow' on the Keychain prompt."
echo "   (Requires Claude Code logged in: run 'claude' if you haven't.)"
