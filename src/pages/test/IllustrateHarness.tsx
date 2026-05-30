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
 */
import { useRef, useState } from "react";
import { Toaster, toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

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
    setBusy(true);
    const now = Date.now();
    setQueuedAt((s) => ({ ...s, ...Object.fromEntries(pending.map((p) => [p.index, now])) }));
    setStartedAt((s) => ({ ...s, ...Object.fromEntries(pending.map((p) => [p.index, now])) }));
    setStatus((s) => ({ ...s, ...Object.fromEntries(pending.map((p) => [p.index, "pending"])) }));
    const id = `batch:${pending.map((p) => p.index).join(",")}`;
    toast.message(`Queued ${pending.length} illustration${pending.length === 1 ? "" : "s"}`, { id });
    callCountRef.current += 1;
    try {
      const { data, error } = await supabase.functions.invoke("illustrate-story", {
        body: {
          storyId: "harness-story",
          trigger: "user",
          triggerSource: "IllustrateHarness",
          idempotencyKey: `harness:${id}:${now}`,
          pages: pending.map((p) => ({ index: p.index, illustrationPrompt: `p${p.index}` })),
        },
      });
      if (error) throw error;
      const illos = (data as { illustrations: { index: number; imageUrl: string | null; status: string; error?: string }[] }).illustrations;
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
      const failed = illos.filter((r) => r.status !== "ready").length;
      if (failed === 0) toast.success("Illustrations ready", { id });
      else toast.error(`${illos.length - failed} ready, ${failed} failed`, { id });
    } catch (e) {
      console.error(e);
      toast.error("Illustration job failed", { id });
      setStatus((s) => ({ ...s, ...Object.fromEntries(pending.map((p) => [p.index, "failed"])) }));
    } finally {
      pending.forEach((p) => inFlight.current.delete(p.index));
      setBusy(false);
    }
  };

  const failedCount = Object.values(status).filter((s) => s === "failed").length;
  const ready = pages.filter((p) => p.imageUrl).length;
  const total = pages.length;
  const allReady = ready === total && total > 0;

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
        disabled={failedCount === 0 || busy}
        aria-disabled={failedCount === 0 || busy}
        onClick={() => run(pages.filter((p) => status[p.index] === "failed"))}
        style={{ padding: "8px 16px" }}
      >
        {failedCount > 0 ? `Retry ${failedCount} failed` : "Retry failed"}
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
          return (
            <span
              key={p.index}
              data-testid={`illustration-page-${p.index}`}
              data-status={s === "pending" ? "generating" : s === "failed" ? "error" : s}
              data-queued-at={queuedAt[p.index] ?? ""}
              data-started-at={startedAt[p.index] ?? ""}
              title={errors[p.index] ?? ""}
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
    </div>
  );
}
