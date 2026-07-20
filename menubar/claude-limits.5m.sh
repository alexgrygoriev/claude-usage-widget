#!/bin/bash
# <xbar.title>Claude Usage</xbar.title>
# <xbar.version>v1.0</xbar.version>
# <xbar.author>Alex Grygoriev</xbar.author>
# <xbar.author.github>alexgrygoriev</xbar.author.github>
# <xbar.desc>Shows remaining Claude (Claude Code) usage limits in the menu bar, from the official OAuth usage endpoint.</xbar.desc>
# <xbar.dependencies>python3,curl,security</xbar.dependencies>
#
# Menu-bar variant of the Claude Usage Widget — for SwiftBar or xbar.
# Drop into your SwiftBar/xbar plugins folder (the .5m. suffix = refresh
# every 5 minutes). Reads the Claude Code OAuth token from macOS Keychain.

export PATH="/usr/bin:/bin:/usr/local/bin:$PATH"
ENDPOINT="https://api.anthropic.com/api/oauth/usage"

RAW="$(security find-generic-password -s "Claude Code-credentials" -w 2>/dev/null)"
TOKEN="$(printf '%s' "$RAW" | python3 -c 'import sys,json
try:
    d=json.load(sys.stdin); print(d.get("claudeAiOauth",d).get("accessToken",""))
except Exception:
    print("")' 2>/dev/null)"

if [ -z "$TOKEN" ]; then
  echo "☕ ?"
  echo "---"
  echo "No token in Keychain — log into Claude Code"
  exit 0
fi

JSON="$(curl -s --max-time 10 \
  -H "Authorization: Bearer $TOKEN" \
  -H "anthropic-beta: oauth-2025-04-20" \
  -H "anthropic-version: 2023-06-01" \
  "$ENDPOINT")"

if [ -z "$JSON" ] || printf '%s' "$JSON" | grep -q '"error"'; then
  echo "☕ ⚠️"
  echo "---"
  echo "Rate-limited or offline — try again shortly"
  exit 0
fi

printf '%s' "$JSON" | python3 -c '
import sys, json
from datetime import datetime

GREEN="#3fb950"; YELLOW="#d29922"; RED="#f85149"; GRAY="#8b949e"

def color(used):
    if used is None: return GRAY
    if used < 50: return GREEN
    if used <= 80: return YELLOW
    return RED

def fmt(iso):
    if not iso: return ""
    try:
        t = datetime.fromisoformat(iso.replace("Z","+00:00")).astimezone()
        now = datetime.now(t.tzinfo)
        return t.strftime("%H:%M" if t.date()==now.date() else "%a %H:%M")
    except Exception:
        return ""

def used_of(w):
    if not isinstance(w, dict) or w.get("utilization") is None: return None, None
    return round(float(w["utilization"])), w.get("resets_at")

WINDOW = {"session": "5h", "weekly": "7d"}

def label_for(l):
    win = WINDOW.get(l.get("group")) or ("5h" if l.get("kind") == "session" else "7d")
    scope = l.get("scope") or {}
    model = (scope.get("model") or {}).get("display_name")
    surface = scope.get("surface")
    if isinstance(surface, dict): surface = surface.get("display_name")
    if model: return "%s %s" % (model, win)
    if surface: return "%s %s" % (surface, win)
    return "%s %s" % ("Session" if l.get("kind") == "session" else "Week", win)

d = json.load(sys.stdin)

# The endpoint now returns a canonical `limits[]` array; the old flat buckets
# (seven_day_opus / seven_day_sonnet / ...) come back as null even when a
# per-model cap exists. Each entry carries its own kind/scope, so model rows
# (Fable, Opus, Sonnet, ...) show up automatically as Anthropic adds them.
# The flat buckets stay as a fallback for older responses.
limits = d.get("limits")
if isinstance(limits, list) and any(l.get("percent") is not None for l in limits):
    parsed = [(label_for(l), round(float(l["percent"])), l.get("resets_at"))
              for l in limits if l.get("percent") is not None]
else:
    legacy = [("Session 5h","five_hour"),("Week 7d","seven_day"),
              ("Opus 7d","seven_day_opus"),("Sonnet 7d","seven_day_sonnet")]
    parsed = [(lbl,)+used_of(d.get(k)) for lbl,k in legacy]
    parsed = [r for r in parsed if r[1] is not None]

# menu bar = tightest active window (max used %)
vals = [u for _,u,_ in parsed if u is not None]
if vals:
    peak = max(vals)
    print(f"☕ {peak}% | color={color(peak)}")
else:
    print("☕ —")

print("---")
print("Claude — used | size=11 color=#8b949e")
if not parsed:
    print(f"No limits reported | color={GRAY}")
for lbl,u,reset in parsed:
    rs = fmt(reset); tail = f"  · resets {rs}" if rs else ""
    print(f"{lbl}:  {u}%{tail} | color={color(u)}")
print("---")
print("Refresh | refresh=true")
'
