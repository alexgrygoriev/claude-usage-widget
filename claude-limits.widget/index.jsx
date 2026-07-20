// Claude Usage Widget — Übersicht desktop widget
// Light, airy Apple-style card (like the native Weather widget).
// Shows the same "used %" numbers as Claude's in-app /usage command.
//
// Interactive:
//   • ↻ button  — re-pulls live usage on demand (manual reset/refresh)
//   • drag the header to move the card anywhere; position is remembered
//   • double-click the header to snap the card back to its default spot

import { run } from "uebersicht";

export const refreshFrequency = 5 * 60 * 1000; // auto-refresh every 5 minutes

const FETCH = "bash './claude-limits.widget/fetch.sh'";
const POS_KEY = "claude-limits-widget-pos";

// ---------------------------------------------------------------------------
// Data loading — dispatch-driven so the ↻ button can re-pull at any moment,
// not only on the 5-minute cycle. `command` is what Übersicht runs on its
// schedule; the button calls the same loader.
// ---------------------------------------------------------------------------
const loadData = (dispatch) => {
  dispatch({ type: "LOADING" });
  run(FETCH)
    .then((output) => dispatch({ type: "FETCHED", output }))
    .catch((error) => dispatch({ type: "ERROR", error: String(error) }));
};

export const command = loadData;

export const initialState = {
  output: null,
  loading: true,
  error: null,
  fetchedAt: null,
};

export const updateState = (event, prev) => {
  switch (event.type) {
    case "LOADING":
      return { ...prev, loading: true };
    case "FETCHED":
      return { output: event.output, loading: false, error: null, fetchedAt: new Date() };
    case "ERROR":
      return { ...prev, loading: false, error: event.error };
    default:
      return prev;
  }
};

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

// ---------------------------------------------------------------------------
// Drag-to-move. The card's positioned element is the Übersicht wrapper (the
// element the `className` above is applied to) — i.e. the parent of whatever
// `render` returns. We move that element and remember where it lands.
// ---------------------------------------------------------------------------
let rootEl = null;

const applySavedPosition = (root) => {
  if (!root) return;
  try {
    const pos = JSON.parse(localStorage.getItem(POS_KEY) || "null");
    if (pos && typeof pos.left === "number" && typeof pos.top === "number") {
      root.style.left = pos.left + "px";
      root.style.top = pos.top + "px";
      root.style.right = "auto";
    }
  } catch (e) {
    /* ignore corrupt storage */
  }
};

const makeDraggable = (handle, root) => {
  if (!handle || !root || handle.__dragWired) return;
  handle.__dragWired = true;

  let startX, startY, startLeft, startTop, dragging = false;

  const onMove = (e) => {
    if (!dragging) return;
    root.style.left = startLeft + (e.clientX - startX) + "px";
    root.style.top = startTop + (e.clientY - startY) + "px";
  };

  const onUp = () => {
    if (!dragging) return;
    dragging = false;
    handle.style.cursor = "grab";
    window.removeEventListener("mousemove", onMove);
    window.removeEventListener("mouseup", onUp);
    const rect = root.getBoundingClientRect();
    try {
      localStorage.setItem(POS_KEY, JSON.stringify({ left: rect.left, top: rect.top }));
    } catch (e) {
      /* ignore */
    }
  };

  handle.addEventListener("mousedown", (e) => {
    if (e.target.closest("[data-no-drag]")) return; // don't drag from the button
    const rect = root.getBoundingClientRect();
    startLeft = rect.left;
    startTop = rect.top;
    startX = e.clientX;
    startY = e.clientY;
    dragging = true;
    // pin to left/top so the move is absolute regardless of the css `right`
    root.style.left = startLeft + "px";
    root.style.top = startTop + "px";
    root.style.right = "auto";
    handle.style.cursor = "grabbing";
    e.preventDefault();
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  });
};

const wireCard = (node) => {
  if (!node) return;
  rootEl = node.parentElement; // the positioned Übersicht wrapper
  applySavedPosition(rootEl);
  makeDraggable(node.querySelector("[data-drag-handle]"), rootEl);
};

const resetPosition = () => {
  if (!rootEl) return;
  try {
    localStorage.removeItem(POS_KEY);
  } catch (e) {
    /* ignore */
  }
  rootEl.style.left = "auto";
  rootEl.style.right = "40px";
  rootEl.style.top = "60px";
};

// ---------------------------------------------------------------------------
// Rendering helpers
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Row extraction.
//
// The endpoint now returns a canonical `limits[]` array; the old flat buckets
// (seven_day_opus / seven_day_sonnet / …) come back as null even when a
// per-model cap exists. Each entry carries its own kind/scope, so model rows
// (Fable, Opus, Sonnet, …) and surface rows appear automatically as Anthropic
// adds them — no hard-coded model list to keep in sync.
//
// `limits[]` is preferred; the flat buckets stay as a fallback for older
// responses (and for anything cached from before the switch).
// ---------------------------------------------------------------------------

const WINDOW_LABEL = { session: "5h", weekly: "7d" };

const labelForLimit = (l) => {
  const win = WINDOW_LABEL[l.group] || (l.kind === "session" ? "5h" : "7d");
  const model = l.scope && l.scope.model && l.scope.model.display_name;
  const surface = l.scope && l.scope.surface;
  const surfaceName = typeof surface === "string" ? surface : surface && surface.display_name;
  if (model) return `${model} · ${win}`;
  if (surfaceName) return `${surfaceName} · ${win}`;
  if (l.kind === "session") return `Session · ${win}`;
  return `Week · ${win}`;
};

const rowsFromLimits = (d) => {
  if (!d || !Array.isArray(d.limits)) return null;
  const rows = d.limits
    .filter((l) => l && l.percent != null)
    .map((l) => ({
      label: labelForLimit(l),
      used: Math.round(Number(l.percent)),
      resetsAt: l.resets_at,
      active: l.is_active === true,
    }));
  return rows.length ? rows : null;
};

const rowsFromLegacy = (d) => {
  if (!d) return [];
  return [
    ["Session · 5h", d.five_hour],
    ["Week · 7d", d.seven_day],
    ["Sonnet · 7d", d.seven_day_sonnet],
    ["Opus · 7d", d.seven_day_opus],
  ]
    .filter(([, w]) => usedOf(w) != null)
    .map(([label, w]) => ({ label, used: usedOf(w), resetsAt: w.resets_at, active: false }));
};

const rowsFor = (d) => rowsFromLimits(d) || rowsFromLegacy(d);

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

const fmtUpdated = (d) => {
  if (!d) return "";
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `updated ${hh}:${mm}`;
};

const buttonStyle = {
  flex: "0 0 auto",
  width: 26,
  height: 26,
  borderRadius: 13,
  border: "0.5px solid rgba(0,0,0,0.08)",
  background: "rgba(255,255,255,0.7)",
  color: "#3c3c43",
  fontSize: 14,
  lineHeight: "24px",
  textAlign: "center",
  cursor: "pointer",
  padding: 0,
  marginLeft: 8,
  boxShadow: "0 1px 2px rgba(0,0,0,0.08)",
  transition: "opacity 0.2s ease",
};

const msgStyle = { fontSize: 13, color: "#a1a1a6" };

const Row = ({ label, used, resetsAt, active, last }) => {
  const c = colorFor(used);
  const reset = used == null ? "" : fmtReset(resetsAt);
  return (
    <div style={{ marginBottom: last ? 0 : 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
        <span style={{ fontSize: 13, color: active ? "#1d1d1f" : "#3c3c43", fontWeight: active ? 600 : 400, letterSpacing: 0.1 }}>{label}</span>
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

const Header = ({ loading, fetchedAt, dispatch }) => (
  <div
    data-drag-handle
    onDoubleClick={resetPosition}
    title="Drag to move · double-click to reset position"
    style={{ display: "flex", alignItems: "center", marginBottom: 16, cursor: "grab", userSelect: "none" }}
  >
    <span style={{ fontSize: 17, marginRight: 8 }}>☕</span>
    <div style={{ display: "flex", flexDirection: "column", flex: 1, minWidth: 0 }}>
      <span style={{ fontSize: 12, fontWeight: 600, color: "#86868b", letterSpacing: 1.4, textTransform: "uppercase" }}>
        Claude · used
      </span>
      {fetchedAt ? (
        <span style={{ fontSize: 10, color: "#b0b0b5", fontWeight: 400, letterSpacing: 0.2 }}>
          {fmtUpdated(fetchedAt)}
        </span>
      ) : null}
    </div>
    <button
      data-no-drag
      onClick={() => loadData(dispatch)}
      title="Refresh now"
      style={{ ...buttonStyle, opacity: loading ? 0.4 : 1 }}
    >↻</button>
  </div>
);

export const render = (state, dispatch) => {
  const { output, loading, error, fetchedAt } = state;

  let d = null;
  try { d = output ? JSON.parse(output) : null; } catch (e) { d = null; }

  let body;
  if (!d && loading) {
    body = <div style={msgStyle}>…loading</div>;
  } else if (!d && error) {
    body = <div style={{ ...msgStyle, color: "#ff9f0a" }}>No connection</div>;
  } else if (!d) {
    body = <div style={msgStyle}>No data</div>;
  } else if (d.error === "no-token") {
    body = <div style={{ ...msgStyle, color: "#ff3b30" }}>No token in Keychain</div>;
  } else if (d.error) {
    body = <div style={{ ...msgStyle, color: "#ff9f0a" }}>No connection</div>;
  } else {
    // Only windows the API actually reports are shown — anything it leaves out
    // is dropped rather than rendering a permanent "—".
    const rows = rowsFor(d);
    body = rows.length
      ? rows.map((r, i) => <Row key={r.label} {...r} last={i === rows.length - 1} />)
      : <div style={msgStyle}>No limits reported</div>;
  }

  return (
    <div ref={wireCard}>
      <Header loading={loading} fetchedAt={fetchedAt} dispatch={dispatch} />
      {body}
    </div>
  );
};
