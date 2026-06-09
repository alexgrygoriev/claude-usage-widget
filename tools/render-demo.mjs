// Render the LinkedIn promo asset for the Claude Usage Widget.
// Produces docs/demo-linkedin.mp4 + docs/demo-linkedin.gif (1200x627, LinkedIn 1.91:1).
//
// The card markup/styles below mirror claude-limits.widget/index.jsx 1:1 (frosted
// glass, traffic-light bars, ☕ header) — but centered and scaled up for the feed.
// Bars animate from 0% to their target, hold, then loop.
//
// Usage:  node tools/render-demo.mjs
// Deps:   playwright-core (cached chromium) + ffmpeg on PATH.

import { chromium } from "playwright-core";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT_DIR = join(ROOT, "docs");
const CHROME =
  "/Users/oleksandrgrygoriev/Library/Caches/ms-playwright/chromium-1223/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing";

const W = 1200;
const H = 627;
const FPS = 30;

// Animation timeline (seconds): empty hold -> fill (ease-out) -> full hold.
const T_HOLD_START = 0.5;
const T_FILL = 1.4;
const T_HOLD_END = 2.4;
const TOTAL = T_HOLD_START + T_FILL + T_HOLD_END;
const FRAMES = Math.round(TOTAL * FPS);

// The four usage windows shown in the widget (label + target "used %").
const ROWS = [
  { label: "Session · 5h", reset: "21:30", used: 37 },
  { label: "Week · 7d", reset: "Mon 15:00", used: 64 },
  { label: "Sonnet · 7d", reset: "Mon 15:00", used: 9 },
  { label: "Opus · 7d", reset: "Mon 15:00", used: 88 },
];

const colorFor = (u) => (u < 50 ? "#34c759" : u <= 80 ? "#ff9f0a" : "#ff3b30");

// progress 0..1 -> eased
const easeOut = (t) => 1 - Math.pow(1 - t, 3);

function html() {
  const rowsHtml = ROWS.map(
    (r) => `
    <div class="row">
      <div class="row-top">
        <span class="label">${r.label}</span>
        <span class="right">
          <span class="reset">${r.reset}</span>
          <span class="pct" data-used="${r.used}">0%</span>
        </span>
      </div>
      <div class="track"><div class="bar" data-used="${r.used}" style="background:${colorFor(
        r.used
      )}"></div></div>
    </div>`
  ).join("");

  return `<!doctype html><html><head><meta charset="utf-8"><style>
  * { margin:0; padding:0; box-sizing:border-box; }
  html,body { width:${W}px; height:${H}px; overflow:hidden; }
  body {
    display:flex; align-items:center; justify-content:center;
    font-family:-apple-system,BlinkMacSystemFont,"SF Pro Text","SF Pro Display",sans-serif;
    -webkit-font-smoothing:antialiased;
    background:
      radial-gradient(120% 120% at 12% 18%, #f6b07a 0%, rgba(246,176,122,0) 42%),
      radial-gradient(120% 120% at 82% 12%, #e98aa8 0%, rgba(233,138,168,0) 45%),
      radial-gradient(130% 130% at 78% 88%, #6fc5c9 0%, rgba(111,197,201,0) 48%),
      radial-gradient(130% 130% at 20% 92%, #9a7bd0 0%, rgba(154,123,208,0) 50%),
      linear-gradient(135deg, #e7a07e 0%, #d98aa6 38%, #a987c9 70%, #7fb9bf 100%);
  }
  .card {
    width:560px;
    color:#1d1d1f;
    background:rgba(255,255,255,0.62);
    -webkit-backdrop-filter:blur(30px) saturate(160%);
    backdrop-filter:blur(30px) saturate(160%);
    border:1px solid rgba(255,255,255,0.7);
    border-radius:40px;
    padding:34px 40px 32px;
    box-shadow:0 26px 70px rgba(0,0,0,0.20), inset 0 1px 2px rgba(255,255,255,0.85);
  }
  .head { display:flex; align-items:center; margin-bottom:30px; }
  .head .cup { font-size:32px; margin-right:14px; }
  .head .title { font-size:22px; font-weight:600; color:#86868b; letter-spacing:2.6px; text-transform:uppercase; }
  .row { margin-bottom:24px; }
  .row:last-child { margin-bottom:0; }
  .row-top { display:flex; justify-content:space-between; align-items:baseline; margin-bottom:11px; }
  .label { font-size:23px; color:#3c3c43; letter-spacing:0.2px; }
  .right { display:flex; align-items:baseline; gap:11px; }
  .reset { font-size:18px; color:#a1a1a6; }
  .pct { font-size:29px; font-weight:600; color:#1d1d1f; letter-spacing:-0.4px; }
  .track { height:13px; border-radius:99px; background:rgba(0,0,0,0.07); overflow:hidden; }
  .bar { height:100%; width:0%; border-radius:99px; }
  </style></head><body>
    <div class="card">
      <div class="head"><span class="cup">☕</span><span class="title">Claude · used</span></div>
      ${rowsHtml}
    </div>
  </body></html>`;
}

async function main() {
  const framesDir = mkdtempSync(join(tmpdir(), "cuw-frames-"));
  mkdirSync(OUT_DIR, { recursive: true });

  const browser = await chromium.launch({ executablePath: CHROME });
  const page = await browser.newPage({
    viewport: { width: W, height: H },
    deviceScaleFactor: 2,
  });
  await page.setContent(html(), { waitUntil: "load" });
  await page.waitForTimeout(150);

  for (let f = 0; f < FRAMES; f++) {
    const t = f / FPS;
    let p = 0;
    if (t <= T_HOLD_START) p = 0;
    else if (t <= T_HOLD_START + T_FILL) p = easeOut((t - T_HOLD_START) / T_FILL);
    else p = 1;

    await page.evaluate((prog) => {
      document.querySelectorAll(".bar").forEach((el) => {
        const used = Number(el.dataset.used);
        el.style.width = used * prog + "%";
      });
      document.querySelectorAll(".pct").forEach((el) => {
        const used = Number(el.dataset.used);
        el.textContent = Math.round(used * prog) + "%";
      });
    }, p);

    const name = join(framesDir, `f${String(f).padStart(4, "0")}.png`);
    await page.screenshot({ path: name });
  }

  await browser.close();

  // MP4 (H.264, yuv420p, even dims, looping-friendly)
  const mp4 = join(OUT_DIR, "demo-linkedin.mp4");
  execFileSync(
    "ffmpeg",
    [
      "-y", "-framerate", String(FPS),
      "-i", join(framesDir, "f%04d.png"),
      "-vf", "scale=trunc(iw/2)*2:trunc(ih/2)*2",
      "-c:v", "libx264", "-pix_fmt", "yuv420p", "-movflags", "+faststart",
      mp4,
    ],
    { stdio: "inherit" }
  );

  // GIF via two-pass palette for clean gradients
  const palette = join(framesDir, "palette.png");
  execFileSync("ffmpeg", [
    "-y", "-i", join(framesDir, "f%04d.png"),
    "-vf", "scale=1200:-1:flags=lanczos,palettegen=stats_mode=diff",
    palette,
  ], { stdio: "inherit" });
  const gif = join(OUT_DIR, "demo-linkedin.gif");
  execFileSync("ffmpeg", [
    "-y", "-framerate", String(FPS), "-i", join(framesDir, "f%04d.png"),
    "-i", palette,
    "-lavfi", "scale=1200:-1:flags=lanczos[x];[x][1:v]paletteuse=dither=sierra2_4a",
    "-loop", "0",
    gif,
  ], { stdio: "inherit" });

  rmSync(framesDir, { recursive: true, force: true });
  console.log("\n✅ Wrote:\n  " + mp4 + "\n  " + gif);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
