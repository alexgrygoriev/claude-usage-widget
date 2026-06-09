# LinkedIn post — Claude Usage Widget (build-in-public)

Asset: `docs/demo-linkedin.mp4` (preferred for the feed) / `docs/demo-linkedin.gif` — 1200×627.

---

**I kept slamming into Claude's usage limit mid-task. So I spent an evening fixing it — for good.**

If you live in Claude Code like I do, you know the feeling: you're deep in a build, momentum is perfect… and suddenly you're rate-limited. No warning. The only way to check was to stop and run `/usage`.

That context-switch was quietly killing my flow.

So I built a tiny desktop widget for my Mac. It just sits on my wallpaper — like the native Weather widget — and shows exactly how much of my Claude limit is left, refreshing in the background:

• 5-hour session window
• 7-day rolling limit
• Per-model (Sonnet / Opus)
• Green → amber → red as I get closer to the wall

Now I never get surprised. One glance and I know whether to push hard or pace myself.

It pulls the *real* numbers — the same endpoint behind Claude's `/usage` — reads the token straight from the macOS Keychain, and stores zero secrets.

I open-sourced it. One line to install, MIT, free:
👉 github.com/alexgrygoriev/claude-usage-widget

If it saves you one surprise rate-limit, that's a win. ⭐ a star helps it reach the next person.

What's the smallest tool you built for yourself that ended up saving you every single day?

#ClaudeAI #AI #BuildInPublic #DeveloperTools #macOS #OpenSource
