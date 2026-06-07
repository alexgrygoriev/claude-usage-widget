#!/bin/bash
# Reads the Claude Code OAuth token from macOS Keychain and prints the usage
# JSON from the official endpoint. Caches the last good response so the widget
# keeps showing the latest numbers even if a request fails / gets rate-limited.
export PATH="/usr/bin:/bin:/usr/local/bin:$PATH"

CACHE="$HOME/Library/Application Support/Übersicht/widgets/claude-limits.widget/.last.json"

emit_cache_or() {
  # $1 = fallback error json
  if [ -s "$CACHE" ]; then cat "$CACHE"; else echo "$1"; fi
}

RAW="$(security find-generic-password -s "Claude Code-credentials" -w 2>/dev/null)"
TOKEN="$(printf '%s' "$RAW" | python3 -c 'import sys,json
try:
    d=json.load(sys.stdin)
    print(d.get("claudeAiOauth",d).get("accessToken",""))
except Exception:
    print("")' 2>/dev/null)"

if [ -z "$TOKEN" ]; then
  emit_cache_or '{"error":"no-token"}'
  exit 0
fi

OUT="$(curl -s --max-time 10 \
  -H "Authorization: Bearer $TOKEN" \
  -H "anthropic-beta: oauth-2025-04-20" \
  -H "anthropic-version: 2023-06-01" \
  https://api.anthropic.com/api/oauth/usage)"

# Treat empty body or any JSON containing an "error" as a failed fetch:
# keep showing the cached good data instead.
if [ -z "$OUT" ]; then
  emit_cache_or '{"error":"no-network"}'
  exit 0
fi

if printf '%s' "$OUT" | grep -q '"error"'; then
  emit_cache_or "$OUT"
  exit 0
fi

# Success: validate it has the expected shape, cache it, emit it.
if printf '%s' "$OUT" | grep -q '"five_hour"'; then
  printf '%s' "$OUT" > "$CACHE"
fi
echo "$OUT"
