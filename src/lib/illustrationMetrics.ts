// Client-side metrics for the illustration job lifecycle.
//
// Every event is keyed by (storyId, idempotencyKey) so it can be correlated
// 1:1 with the server-side log line emitted by `illustrate-story` and the
// row written to `illustration_job_events`. Events are:
//
//   - "queued"             : user pressed Illustrate / Retry, request leaving
//   - "generating"         : server response is taking >250ms (toast phase)
//   - "complete"           : at least one page returned ready
//   - "failed"             : a page returned with status !== "ready"
//   - "idempotent_replay"  : server returned a cached payload (idempotent: true)
//
// We emit two side effects:
//   1. `console.info("[illustration-metric]", payload)` — single-line JSON
//      so it shows up grep-friendly in browser dev tools.
//   2. `window.dispatchEvent(new CustomEvent("illustration:metric", ...))` —
//      lets any analytics layer hook in without taking a dep on this module.
//
// IMPORTANT: this file must stay framework-agnostic (no React imports) so it
// can be called from non-component code, edge function tests, etc.

export type IllustrationMetricEvent =
  | "queued"
  | "generating"
  | "complete"
  | "failed"
  | "idempotent_replay"
  | "idempotent_join"
  | "trigger_rejected";

export interface IllustrationMetric {
  event: IllustrationMetricEvent;
  storyId: string;
  idempotencyKey?: string | null;
  pageIndex?: number;
  status?: string;
  error?: string;
  latencyMs?: number;
  source?: string;
  ts: number;
}

export function recordIllustrationMetric(
  metric: Omit<IllustrationMetric, "ts"> & { ts?: number },
): IllustrationMetric {
  const payload: IllustrationMetric = { ts: Date.now(), ...metric };
  try {
    // Single-line JSON makes Edge ↔ Browser correlation trivial.
    console.info("[illustration-metric]", JSON.stringify(payload));
  } catch {
    /* ignore */
  }
  if (typeof window !== "undefined") {
    try {
      window.dispatchEvent(
        new CustomEvent<IllustrationMetric>("illustration:metric", { detail: payload }),
      );
    } catch {
      /* ignore */
    }
  }
  return payload;
}
