// Claude Usage Widget — Übersicht desktop widget
// Light, airy Apple-style card (like the native Weather widget).
// Shows the same "used %" numbers as Claude's in-app /usage command.

export const refreshFrequency = 5 * 60 * 1000; // every 5 minutes

export const command = "bash './claude-limits.widget/fetch.sh'";

export const className = `
  top: 60px;
  right: 40px;
  width: 248px;
  font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Pro Display", sans-serif;
  -webkit-font-smoothing: antialiased;
  color: #1d1d1f;
  background: rgba(255, 255, 255, 0.62);
  -webkit-backdrop-filter: blur(30px) saturate(160%);
  backdrop-filter: blur(30px) saturate(160%);
  border: 0.5px solid rgba(255, 255, 255, 0.7);
  border-radius: 26px;
  padding: 18px 20px 16px;
  box-shadow:
    0 12px 34px rgba(0, 0, 0, 0.16),
    inset 0 1px 1px rgba(255, 255, 255, 0.8);
`;

// Apple system colors. Color by USED %: low usage = green, high = red.
const colorFor = (used) => {
  if (used == null) return "#aeaeb2";
  if (used < 50) return "#34c759";
  if (used <= 80) return "#ff9f0a";
  return "#ff3b30";
};

const usedOf = (w) => {
  if (!w || typeof w !== "object" || w.utilization == null) return null;
  return Math.round(Number(w.utilization));
};

const fmtReset = (iso) => {
  if (!iso) return "";
  const t = new Date(iso);
  if (isNaN(t)) return "";
  const now = new Date();
  const sameDay = t.toDateString() === now.toDateString();
  const hh = String(t.getHours()).padStart(2, "0");
  const mm = String(t.getMinutes()).padStart(2, "0");
  if (sameDay) return `${hh}:${mm}`;
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  return `${days[t.getDay()]} ${hh}:${mm}`;
};

const Row = ({ label, w, last }) => {
  const used = usedOf(w);
  const c = colorFor(used);
  const reset = used == null ? "" : fmtReset(w && w.resets_at);
  return (
    <div style={{ marginBottom: last ? 0 : 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
        <span style={{ fontSize: 13, color: "#3c3c43", letterSpacing: 0.1 }}>{label}</span>
        <span style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
          {reset ? <span style={{ fontSize: 10.5, color: "#a1a1a6", fontWeight: 400 }}>{reset}</span> : null}
          <span style={{ fontSize: 16, fontWeight: 600, color: "#1d1d1f", letterSpacing: -0.2 }}>
            {used == null ? "—" : used + "%"}
          </span>
        </span>
      </div>
      <div style={{ height: 7, borderRadius: 99, background: "rgba(0,0,0,0.07)", overflow: "hidden" }}>
        <div style={{
          height: "100%",
          width: (used == null ? 0 : used) + "%",
          background: c,
          borderRadius: 99,
          transition: "width 0.6s ease",
        }} />
      </div>
    </div>
  );
};

export const render = ({ output }) => {
  let d = null;
  try { d = JSON.parse(output); } catch (e) { d = null; }

  const Shell = ({ children }) => (
    <div>
      <div style={{ display: "flex", alignItems: "center", marginBottom: 16 }}>
        <span style={{ fontSize: 17, marginRight: 8 }}>☕</span>
        <span style={{ fontSize: 12, fontWeight: 600, color: "#86868b", letterSpacing: 1.4, textTransform: "uppercase" }}>
          Claude · used
        </span>
      </div>
      {children}
    </div>
  );

  if (!d) return <Shell><div style={{ fontSize: 13, color: "#a1a1a6" }}>…loading</div></Shell>;
  if (d.error === "no-token") return <Shell><div style={{ fontSize: 13, color: "#ff3b30" }}>No token in Keychain</div></Shell>;
  if (d.error) return <Shell><div style={{ fontSize: 13, color: "#ff9f0a" }}>No connection</div></Shell>;

  const rows = [
    ["Session · 5h", d.five_hour],
    ["Week · 7d", d.seven_day],
    ["Sonnet · 7d", d.seven_day_sonnet],
    ["Opus · 7d", d.seven_day_opus],
  ];

  return (
    <Shell>
      {rows.map(([label, w], i) => <Row key={label} label={label} w={w} last={i === rows.length - 1} />)}
    </Shell>
  );
};
