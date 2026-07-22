/**
 * E2E test harness for the illustration flow.
 *
 * Renders a self-contained variant of the SelStoryViewer illustration UI with
 * the SAME `data-testid`s used by the production component. Network calls go
 * through `supabase.functions.invoke("illustrate-story", ...)` so Playwright
 * can intercept them via `page.route("**\/illustrate-story", ...)`.
 *
 * Routed at `/test/illustrate-harness` so it requires no auth and no real
 * subscription. Not linked from the navigation — discovery is via URL only.
 *
 * Also mirrors three production behaviours so the e2e suite can validate
 * them in isolation from auth/db state:
 *   1. Client metrics CustomEvents on `window` ("illustration:metric")
 *      with the same lifecycle event names the server emits.
 *   2. ARIA live region that announces queued/generating/ready/failed.
 *   3. Per-page retry locking — retrying a failed page disables the Retry
 *      button until that specific page's new result comes back.
 */
import { useRef, useState } from "react";
import { Toaster, toast } from "sonner";
import { generateIllustrations } from "@/api/illustrations.api";
import { recordIllustrationMetric } from "@/lib/illustrationMetrics";

type Status = "idle" | "queued" | "pending" | "ready" | "failed";
interface Page { index: number; imageUrl?: string }

const PAGES_DEFAULT: Page[] = [
  { index: 1 }, { index: 2 }, { index: 3 },
];

export default function IllustrateHarness() {
  const [pages, setPages] = useState<Page[]>(PAGES_DEFAULT);
  const [status, setStatus] = useState<Record<number, Status>>({});
  const [errors, setErrors] = useState<Record<number, string | undefined>>({});
  const [queuedAt, setQueuedAt] = useState<Record<number, number>>({});
  const [startedAt, setStartedAt] = useState<Record<number, number>>({});
  const [busy, setBusy] = useState(false);
  // Pages whose previous state was `failed` and are currently being retried.
  // The Retry button stays disabled until every one of these returns.
  const [retryingFailed, setRetryingFailed] = useState<Set<number>>(new Set());
  // Polite live announcement mirroring toast phases for screen readers.
  const [liveMsg, setLiveMsg] = useState("");
  const inFlight = useRef<Set<number>>(new Set());
  // Count how many times the network was called — exposed via window so
  // Playwright can assert dedup (repeated Retry presses shouldn't multiply).
  const callCountRef = useRef(0);
  if (typeof window !== "undefined") {
    (window as unknown as { __illustrateCalls?: () => number }).__illustrateCalls =
      () => callCountRef.current;
  }

  const run = async (targets: Page[]) => {
    const pending = targets.filter((p) => !inFlight.current.has(p.index));
    if (pending.length === 0) {
      toast.message("Illustration already in progress");
      return;
    }
    pending.forEach((p) => inFlight.current.add(p.index));

    // Lock the Retry button for any pending pages that were previously failed.
    const retryingNow = pending
      .filter((p) => status[p.index] === "failed")
      .map((p) => p.index);
    if (retryingNow.length > 0) {
      setRetryingFailed((s) => {
        const n = new Set(s);
        retryingNow.forEach((i) => n.add(i));
        return n;
      });
    }

    setBusy(true);
    const now = Date.now();
    const idempotencyKey = `harness:${pending.map((p) => p.index).join("-")}:${now}`;
    setQueuedAt((s) => ({ ...s, ...Object.fromEntries(pending.map((p) => [p.index, now])) }));
    setStartedAt((s) => ({ ...s, ...Object.fromEntries(pending.map((p) => [p.index, now])) }));
    setStatus((s) => ({ ...s, ...Object.fromEntries(pending.map((p) => [p.index, "pending"])) }));
    const id = `batch:${pending.map((p) => p.index).join(",")}`;
    toast.message(`Queued ${pending.length} illustration${pending.length === 1 ? "" : "s"}`, { id });
    setLiveMsg(`Queued ${pending.length} illustration${pending.length === 1 ? "" : "s"}.`);
    pending.forEach((p) =>
      recordIllustrationMetric({
        event: "queued",
        storyId: "harness-story",
        idempotencyKey,
        pageIndex: p.index,
        source: "IllustrateHarness",
      }),
    );
    callCountRef.current += 1;
    // Toast → generating phase after a short delay so e2e can observe it.
    const tGen = setTimeout(() => {
      if (inFlight.current.size > 0) {
        toast.loading(`Generating ${pending.length} illustration${pending.length === 1 ? "" : "s"}…`, { id });
        setLiveMsg(`Generating ${pending.length} illustration${pending.length === 1 ? "" : "s"}.`);
        recordIllustrationMetric({
          event: "generating",
          storyId: "harness-story",
          idempotencyKey,
          source: "IllustrateHarness",
        });
      }
    }, 120);
    try {
      const data = await generateIllustrations("harness-story") as any;
      const illos = data.illustrations as { index: number; imageUrl: string | null; status: string; error?: string }[];
      const map = new Map(illos.map((i) => [i.index, i]));
      setPages((prev) => prev.map((p) => {
        const r = map.get(p.index);
        return r?.imageUrl ? { ...p, imageUrl: r.imageUrl } : p;
      }));
      setStatus((s) => {
        const n = { ...s };
        illos.forEach((r) => (n[r.index] = r.status === "ready" ? "ready" : "failed"));
        return n;
      });
      setErrors((s) => {
        const n = { ...s };
        illos.forEach((r) => (n[r.index] = r.error));
        return n;
      });
      illos.forEach((r) =>
        recordIllustrationMetric({
          event: r.status === "ready" ? "complete" : "failed",
          storyId: "harness-story",
          idempotencyKey,
          pageIndex: r.index,
          status: r.status,
          error: r.error,
          source: "IllustrateHarness",
        }),
      );
      const failed = illos.filter((r) => r.status !== "ready").length;
      if (failed === 0) {
        toast.success("Illustrations ready", { id });
        setLiveMsg(`All ${illos.length} illustrations are ready.`);
      } else {
        toast.error(`${illos.length - failed} ready, ${failed} failed`, { id });
        setLiveMsg(`${illos.length - failed} ready, ${failed} failed. Retry available.`);
      }
    } catch (e) {
      console.error(e);
      toast.error("Illustration job failed", { id });
      setStatus((s) => ({ ...s, ...Object.fromEntries(pending.map((p) => [p.index, "failed"])) }));
      pending.forEach((p) =>
        recordIllustrationMetric({
          event: "failed",
          storyId: "harness-story",
          idempotencyKey,
          pageIndex: p.index,
          error: e instanceof Error ? e.message : "unknown",
          source: "IllustrateHarness",
        }),
      );
      setLiveMsg("Illustration job failed. You can retry.");
    } finally {
      clearTimeout(tGen);
      pending.forEach((p) => inFlight.current.delete(p.index));
      if (retryingNow.length > 0) {
        setRetryingFailed((s) => {
          const n = new Set(s);
          retryingNow.forEach((i) => n.delete(i));
          return n;
        });
      }
      setBusy(false);
    }
  };

  const failedCount = Object.values(status).filter((s) => s === "failed").length;
  const ready = pages.filter((p) => p.imageUrl).length;
  const total = pages.length;
  const allReady = ready === total && total > 0;
  // Retry stays disabled while ANY failed page is mid-retry.
  const failedPagesNow = pages
    .filter((p) => status[p.index] === "failed")
    .map((p) => p.index);
  const someFailedRetrying = failedPagesNow.some((i) => retryingFailed.has(i));
  const retryDisabled = failedCount === 0 || busy || someFailedRetrying;

  return (
    <div style={{ padding: 24, fontFamily: "system-ui", maxWidth: 640, margin: "0 auto" }}>
      <Toaster position="top-center" />
      <h1>Illustrate Harness</h1>
      <button
        data-testid="harness-illustrate"
        disabled={busy}
        onClick={() => run(pages)}
        style={{ padding: "8px 16px", marginRight: 8 }}
      >
        Illustrate all
      </button>
      <button
        data-testid="illustration-retry-failed"
        disabled={retryDisabled}
        aria-disabled={retryDisabled}
        aria-label={
          someFailedRetrying
            ? "Retrying failed pages"
            : failedCount > 0
            ? `Retry ${failedCount} failed`
            : "Retry failed"
        }
        onClick={() => run(pages.filter((p) => status[p.index] === "failed"))}
        style={{ padding: "8px 16px" }}
      >
        {someFailedRetrying
          ? "Retrying…"
          : failedCount > 0
          ? `Retry ${failedCount} failed`
          : "Retry failed"}
      </button>
      <div style={{ marginTop: 16 }}>
        <span
          data-testid="illustration-readiness-badge"
          aria-live="polite"
        >
          {allReady
            ? `All illustrations ready (${total}/${total})`
            : `Illustrations: ${ready}/${total} ready`}
        </span>
      </div>
      <div data-testid="illustration-progress-strip" style={{ display: "flex", gap: 4, marginTop: 8 }}>
        {pages.map((p) => {
          const s: Status | "complete" = p.imageUrl
            ? "complete"
            : status[p.index] === "pending"
            ? "pending"
            : status[p.index] === "failed"
            ? "failed"
            : "queued";
          const visualStatus = s === "pending" ? "generating" : s === "failed" ? "error" : s;
          return (
            <span
              key={p.index}
              data-testid={`illustration-page-${p.index}`}
              data-status={visualStatus}
              data-queued-at={queuedAt[p.index] ?? ""}
              data-started-at={startedAt[p.index] ?? ""}
              title={errors[p.index] ?? ""}
              role="img"
              aria-label={`Page ${p.index} ${visualStatus}`}
              style={{
                display: "inline-block",
                width: 24,
                height: 12,
                background:
                  s === "complete" ? "#10b981"
                  : s === "pending" ? "#3b82f6"
                  : s === "failed" ? "#ef4444"
                  : "#cbd5e1",
              }}
            />
          );
        })}
      </div>
      {/* Screen-reader only live region — mirrors toast lifecycle. */}
      <div
        data-testid="illustration-live-region"
        role="status"
        aria-live="polite"
        aria-atomic="true"
        style={{
          position: "absolute",
          width: 1,
          height: 1,
          overflow: "hidden",
          clip: "rect(0 0 0 0)",
        }}
      >
        {liveMsg}
      </div>
    </div>
  );
}
