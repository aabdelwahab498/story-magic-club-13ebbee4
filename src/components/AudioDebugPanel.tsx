import { useEffect, useState } from "react";
import {
  browserName,
  clearAudioLog,
  isAudioDebugEnabled,
  setAudioDebugEnabled,
  subscribeAudioLog,
  type AudioDebugEvent,
} from "@/lib/audioDebug";

/**
 * Floating in-app debug panel that visualizes pause/resume currentTime
 * for every audio player. Hidden by default. Enable via:
 *   - URL: append ?audioDebug=1
 *   - or localStorage: starry-tales-audio-debug=1
 */
export function AudioDebugPanel() {
  const [enabled, setEnabled] = useState<boolean>(false);
  const [events, setEvents] = useState<AudioDebugEvent[]>([]);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    setEnabled(isAudioDebugEnabled());
  }, []);

  useEffect(() => {
    if (!enabled) return;
    return subscribeAudioLog(setEvents);
  }, [enabled]);

  if (!enabled) return null;

  const fmt = (n?: number) => (typeof n === "number" ? n.toFixed(3) : "—");

  return (
    <div
      style={{
        position: "fixed",
        right: 8,
        bottom: 8,
        zIndex: 9999,
        maxWidth: 380,
        width: "min(380px, 95vw)",
        fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
        fontSize: 11,
        background: "rgba(10,10,30,0.92)",
        color: "#e2e8f0",
        border: "1px solid rgba(255,255,255,0.15)",
        borderRadius: 8,
        boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
        backdropFilter: "blur(6px)",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "6px 8px",
          borderBottom: "1px solid rgba(255,255,255,0.1)",
        }}
      >
        <strong style={{ flex: 1 }}>Audio Debug · {browserName}</strong>
        <button
          type="button"
          onClick={() => setCollapsed((c) => !c)}
          style={btn}
        >
          {collapsed ? "▣" : "▭"}
        </button>
        <button type="button" onClick={() => clearAudioLog()} style={btn}>
          clear
        </button>
        <button
          type="button"
          onClick={() => {
            setAudioDebugEnabled(false);
            setEnabled(false);
          }}
          style={btn}
        >
          ✕
        </button>
      </div>
      {!collapsed && (
        <div style={{ maxHeight: 260, overflowY: "auto", padding: 6 }}>
          {events.length === 0 && (
            <div style={{ opacity: 0.6 }}>No audio events yet. Press play/pause on a narrator.</div>
          )}
          {events.slice().reverse().map((e, i) => (
            <div
              key={`${e.ts}-${i}`}
              style={{
                padding: "4px 6px",
                borderBottom: "1px dashed rgba(255,255,255,0.08)",
                color: colorFor(e.kind),
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span>
                  <b>{e.source}</b> · {e.kind}
                </span>
                <span style={{ opacity: 0.6 }}>
                  {new Date(e.ts).toLocaleTimeString()}
                </span>
              </div>
              <div style={{ opacity: 0.85 }}>
                saved={fmt(e.saved)} · before={fmt(e.before)} · after={fmt(e.after)}
                {typeof e.readyState === "number" ? ` · rs=${e.readyState}` : ""}
                {typeof e.duration === "number" ? ` · dur=${e.duration.toFixed?.(2) ?? e.duration}` : ""}
              </div>
              {e.message && (
                <div style={{ opacity: 0.8, fontStyle: "italic" }}>{e.message}</div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const btn: React.CSSProperties = {
  background: "transparent",
  color: "#e2e8f0",
  border: "1px solid rgba(255,255,255,0.2)",
  borderRadius: 4,
  padding: "2px 6px",
  cursor: "pointer",
  fontSize: 10,
};

function colorFor(kind: AudioDebugEvent["kind"]): string {
  switch (kind) {
    case "pause":
      return "#fbbf24";
    case "resume-request":
    case "resume-restored":
    case "resume-deferred":
      return "#93c5fd";
    case "resume-playing":
      return "#86efac";
    case "play-rejected":
    case "error":
      return "#fca5a5";
    case "ended":
      return "#c4b5fd";
    default:
      return "#e2e8f0";
  }
}
