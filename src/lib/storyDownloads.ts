// Client helpers for story download formats (PDF, MP3, TXT, DOCX, EPUB, Images, Pack).
import { supabase } from "@/integrations/supabase/client";
import JSZip from "jszip";
import {
  Document as DocxDocument,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
} from "docx";

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 100);
}

export function safeFilename(s: string, fallback = "story"): string {
  return (s || fallback).replace(/[^a-zA-Z0-9-_\u0600-\u06FF]+/g, "_").slice(0, 60) || fallback;
}

async function fetchAsBlob(url: string): Promise<Blob> {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`fetch_failed_${r.status}`);
  return await r.blob();
}

export async function downloadFromUrl(url: string, filename: string) {
  const blob = await fetchAsBlob(url);
  downloadBlob(blob, filename);
}

export interface StoryPageLike {
  text: string;
  image_url?: string | null;
}

export function buildTxt(title: string, pages: StoryPageLike[]): string {
  const t = (title || "Story").trim();
  const body = pages
    .map((p, i) => `Page ${i + 1}\n\n${p.text}`)
    .join("\n\n---\n\n");
  return `${t}\n${"=".repeat(t.length)}\n\n${body}\n`;
}

export function downloadTxt(title: string, pages: StoryPageLike[]) {
  const content = buildTxt(title, pages);
  const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
  downloadBlob(blob, `${safeFilename(title)}.txt`);
}

/**
 * Resolve a public storage URL into a short-lived signed URL so the browser
 * can stream the file directly to disk (Content-Disposition triggered by the
 * `download` attribute on a synthetic anchor).
 * Falls back to the original URL if path extraction or signing fails.
 */
export async function signStorageUrl(
  publicUrl: string,
  bucket: string,
  ttl = 3600,
): Promise<string> {
  try {
    const marker = `/object/public/${bucket}/`;
    const idx = publicUrl.indexOf(marker);
    if (idx === -1) return publicUrl;
    const path = decodeURIComponent(publicUrl.slice(idx + marker.length).split("?")[0]);
    const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, ttl);
    if (error || !data?.signedUrl) return publicUrl;
    return data.signedUrl;
  } catch {
    return publicUrl;
  }
}

export async function downloadAudioMp3(audioUrl: string, filename: string) {
  const signed = await signStorageUrl(audioUrl, "story-audio");
  await downloadFromUrl(signed, filename);
}

// === Edge function callers ===

export async function exportStoryPdf(storyId: string): Promise<string> {
  const { data, error } = await supabase.functions.invoke("export-story-pdf", {
    body: { storyId },
  });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return data.pdfUrl as string;
}

export async function exportStoryEpub(storyId: string): Promise<string> {
  const { data, error } = await supabase.functions.invoke("export-story-epub", {
    body: { storyId },
  });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return data.epubUrl as string;
}

export interface BatchStartResult {
  jobId: string;
  total: number;
  status: "running" | "completed" | "failed" | "cancelled";
}

export async function startBatchDownload(args: {
  childId?: string;
  formats: ("pdf" | "mp3" | "txt" | "epub")[];
  storyIds?: string[];
}): Promise<BatchStartResult> {
  const { data, error } = await supabase.functions.invoke("batch-download-stories", {
    body: args,
  });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return { jobId: data.jobId, total: data.total, status: data.status ?? "running" };
}

export async function cancelBatchJob(jobId: string): Promise<void> {
  const { error } = await supabase
    .from("batch_export_jobs")
    .update({ cancel_requested: true })
    .eq("id", jobId);
  if (error) throw error;
}

export async function refreshBundleUrl(jobId: string): Promise<string> {
  const { data, error } = await supabase.functions.invoke("refresh-bundle-url", {
    body: { jobId },
  });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return data.bundleUrl as string;
}

// Backwards-compat name (kept so older callers still type-check).
export const batchDownloadStories = startBatchDownload;

// ============================================================
// DOCX export (client-side)
// ============================================================
export async function buildDocxBlob(title: string, pages: StoryPageLike[]): Promise<Blob> {
  const children: Paragraph[] = [
    new Paragraph({
      heading: HeadingLevel.TITLE,
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: title || "Story", bold: true, size: 48 })],
    }),
    new Paragraph({ children: [new TextRun({ text: "" })] }),
  ];
  pages.forEach((p, i) => {
    children.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_2,
        children: [new TextRun({ text: `Page ${i + 1}`, bold: true })],
      }),
    );
    (p.text || "").split(/\n+/).forEach((line) => {
      children.push(new Paragraph({ children: [new TextRun({ text: line, size: 24 })] }));
    });
    children.push(new Paragraph({ children: [new TextRun({ text: "" })] }));
  });
  const doc = new DocxDocument({ sections: [{ children }] });
  const blob = await Packer.toBlob(doc);
  return blob;
}

export async function downloadDocx(title: string, pages: StoryPageLike[]) {
  const blob = await buildDocxBlob(title, pages);
  downloadBlob(blob, `najmah-${safeFilename(title)}.docx`);
}

// ============================================================
// Images ZIP — fetch all illustration urls and bundle as ZIP
// ============================================================
export async function buildImagesZip(
  title: string,
  pages: StoryPageLike[],
  onProgress?: (done: number, total: number) => void,
): Promise<Blob | null> {
  const withImg = pages.filter((p) => !!p.image_url);
  if (withImg.length === 0) return null;
  const zip = new JSZip();
  const folder = zip.folder("Images")!;
  let done = 0;
  for (let i = 0; i < pages.length; i++) {
    const url = pages[i].image_url;
    if (!url) continue;
    try {
      const signed = await signStorageUrl(url, "story-images");
      const blob = await fetchAsBlob(signed);
      const ext = (blob.type.split("/")[1] || "png").split("+")[0];
      folder.file(`page${i + 1}.${ext}`, blob);
    } catch {
      /* skip failed image */
    }
    done += 1;
    onProgress?.(done, withImg.length);
  }
  return await zip.generateAsync({ type: "blob" });
}

export async function downloadImagesZip(
  title: string,
  pages: StoryPageLike[],
  onProgress?: (done: number, total: number) => void,
): Promise<boolean> {
  const blob = await buildImagesZip(title, pages, onProgress);
  if (!blob) return false;
  downloadBlob(blob, `najmah-${safeFilename(title)}-images.zip`);
  return true;
}

// ============================================================
// Complete Story Pack — PDF + MP3 + TXT + DOCX + Images
// ============================================================
export interface PackOptions {
  storyId: string;
  title: string;
  pages: StoryPageLike[];
  pdfUrl?: string | null;
  audioUrl?: string | null;
  onStep?: (label: string) => void;
}

export async function downloadCompletePack(opts: PackOptions): Promise<void> {
  const { storyId, title, pages, pdfUrl, audioUrl, onStep } = opts;
  const zip = new JSZip();
  const base = `najmah-${safeFilename(title)}`;

  // TXT
  onStep?.("text");
  zip.file(`${base}.txt`, buildTxt(title, pages));

  // DOCX
  onStep?.("docx");
  try {
    const docxBlob = await buildDocxBlob(title, pages);
    zip.file(`${base}.docx`, docxBlob);
  } catch {/* ignore */}

  // PDF (generate via edge function if missing)
  onStep?.("pdf");
  try {
    let url = pdfUrl;
    if (!url) url = await exportStoryPdf(storyId);
    if (url) {
      const signed = await signStorageUrl(url, "story-pdfs");
      const blob = await fetchAsBlob(signed);
      zip.file(`${base}.pdf`, blob);
    }
  } catch {/* ignore */}

  // MP3
  if (audioUrl) {
    onStep?.("audio");
    try {
      const signed = await signStorageUrl(audioUrl, "story-audio");
      const blob = await fetchAsBlob(signed);
      zip.file(`${base}.mp3`, blob);
    } catch {/* ignore */}
  }

  // Images
  onStep?.("images");
  const folder = zip.folder("Images")!;
  for (let i = 0; i < pages.length; i++) {
    const url = pages[i].image_url;
    if (!url) continue;
    try {
      const signed = await signStorageUrl(url, "story-images");
      const blob = await fetchAsBlob(signed);
      const ext = (blob.type.split("/")[1] || "png").split("+")[0];
      folder.file(`page${i + 1}.${ext}`, blob);
      if (i === 0) zip.file(`Cover.${ext}`, blob);
    } catch {/* ignore */}
  }

  onStep?.("packaging");
  const out = await zip.generateAsync({ type: "blob" });
  downloadBlob(out, `${base}-pack.zip`);
}


// ============================================================
// Download history logging
// ============================================================
export type DownloadFormat = "pdf" | "mp3" | "txt" | "docx" | "epub" | "images" | "pack";

export async function logDownload(args: {
  storyId?: string | null;
  storyTitle?: string | null;
  format: DownloadFormat;
  fileSizeBytes?: number | null;
}): Promise<void> {
  try {
    const { data: u } = await supabase.auth.getUser();
    const userId = u?.user?.id;
    if (!userId) return;
    await supabase.from("download_history" as never).insert({
      user_id: userId,
      story_id: args.storyId ?? null,
      story_title: args.storyTitle ?? null,
      format: args.format,
      file_size_bytes: args.fileSizeBytes ?? null,
    } as never);
  } catch {
    /* silent: history is best-effort */
  }
}

export interface DownloadHistoryRow {
  id: string;
  user_id: string;
  story_id: string | null;
  story_title: string | null;
  format: DownloadFormat;
  file_size_bytes: number | null;
  created_at: string;
}

export async function fetchDownloadHistory(userId: string): Promise<DownloadHistoryRow[]> {
  const { data, error } = await supabase
    .from("download_history" as never)
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(500);
  if (error) throw error;
  return (data as unknown as DownloadHistoryRow[]) ?? [];
}

export async function deleteDownloadHistoryRow(id: string): Promise<void> {
  const { error } = await supabase.from("download_history" as never).delete().eq("id", id);
  if (error) throw error;
}

// ============================================================
// Admin Download Settings + per-user daily quota
// ============================================================
export interface DownloadSettings {
  enable_pdf: boolean;
  enable_mp3: boolean;
  enable_txt: boolean;
  enable_docx: boolean;
  enable_epub: boolean;
  enable_images: boolean;
  enable_pack: boolean;
  daily_limit_per_user: number;
  max_file_size_mb: number;
  alerts_email_enabled: boolean;
  alerts_slack_enabled: boolean;
  alert_email: string | null;
  slack_channel_id: string | null;
}

export const DEFAULT_DOWNLOAD_SETTINGS: DownloadSettings = {
  enable_pdf: true,
  enable_mp3: true,
  enable_txt: true,
  enable_docx: true,
  enable_epub: true,
  enable_images: true,
  enable_pack: true,
  daily_limit_per_user: 50,
  max_file_size_mb: 100,
  alerts_email_enabled: false,
  alerts_slack_enabled: false,
  alert_email: null,
  slack_channel_id: null,
};

export async function fetchDownloadSettings(): Promise<DownloadSettings> {
  const { data } = await supabase
    .from("download_settings" as never)
    .select("*")
    .limit(1)
    .maybeSingle();
  if (!data) return DEFAULT_DOWNLOAD_SETTINGS;
  return { ...DEFAULT_DOWNLOAD_SETTINGS, ...(data as Partial<DownloadSettings>) };
}

export async function updateDownloadSettings(
  patch: Partial<DownloadSettings>,
): Promise<void> {
  const { error } = await supabase
    .from("download_settings" as never)
    .update(patch as never)
    .eq("id", true);
  if (error) throw error;
}

export async function getTodayDownloadCount(userId: string): Promise<number> {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const { count } = await supabase
    .from("download_history" as never)
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .gte("created_at", start.toISOString());
  return count ?? 0;
}

export function isFormatEnabled(s: DownloadSettings, fmt: DownloadFormat): boolean {
  switch (fmt) {
    case "pdf": return s.enable_pdf;
    case "mp3": return s.enable_mp3;
    case "txt": return s.enable_txt;
    case "docx": return s.enable_docx;
    case "epub": return s.enable_epub;
    case "images": return s.enable_images;
    case "pack": return s.enable_pack;
  }
}

// ============================================================
// Audit logging + admin analytics
// ============================================================
export type DownloadOutcome = "success" | "rejected" | "error";

export async function logDownloadAudit(args: {
  storyId?: string | null;
  storyTitle?: string | null;
  format: DownloadFormat;
  outcome: DownloadOutcome;
  reason?: string | null;
}): Promise<void> {
  try {
    const { data: u } = await supabase.auth.getUser();
    const userId = u?.user?.id;
    if (!userId) return;
    await supabase.from("download_audit_log" as never).insert({
      user_id: userId,
      story_id: args.storyId ?? null,
      story_title: args.storyTitle ?? null,
      format: args.format,
      outcome: args.outcome,
      reason: args.reason ?? null,
    } as never);
  } catch {
    /* silent */
  }
}

export interface DownloadAuditRow {
  id: string;
  user_id: string | null;
  story_id: string | null;
  story_title: string | null;
  format: DownloadFormat;
  outcome: DownloadOutcome;
  reason: string | null;
  created_at: string;
}

export interface AuditFilters {
  userId?: string | null;
  format?: DownloadFormat | null;
  outcome?: DownloadOutcome | null;
  sinceDays?: number;
  limit?: number;
}

export async function fetchDownloadAudit(filters: AuditFilters = {}): Promise<DownloadAuditRow[]> {
  let q = supabase
    .from("download_audit_log" as never)
    .select("*")
    .order("created_at", { ascending: false })
    .limit(filters.limit ?? 300);
  if (filters.userId) q = q.eq("user_id", filters.userId);
  if (filters.format) q = q.eq("format", filters.format);
  if (filters.outcome) q = q.eq("outcome", filters.outcome);
  if (filters.sinceDays && filters.sinceDays > 0) {
    const since = new Date(Date.now() - filters.sinceDays * 86400_000).toISOString();
    q = q.gte("created_at", since);
  }
  const { data, error } = await q;
  if (error) throw error;
  return (data as unknown as DownloadAuditRow[]) ?? [];
}

export interface FormatDailyPoint {
  date: string;       // YYYY-MM-DD
  format: DownloadFormat;
  count: number;
}

/** Aggregate successful downloads by day & format over the last N days. */
export async function fetchDownloadsByFormat(days: number): Promise<{
  totalByFormat: Record<DownloadFormat, number>;
  daily: FormatDailyPoint[];
  total: number;
}> {
  const since = new Date(Date.now() - days * 86400_000).toISOString();
  const { data, error } = await supabase
    .from("download_history" as never)
    .select("format, created_at")
    .gte("created_at", since)
    .limit(10000);
  if (error) throw error;
  const rows = (data as unknown as Array<{ format: DownloadFormat; created_at: string }>) ?? [];
  const totalByFormat = {} as Record<DownloadFormat, number>;
  const map = new Map<string, FormatDailyPoint>();
  for (const r of rows) {
    totalByFormat[r.format] = (totalByFormat[r.format] ?? 0) + 1;
    const day = r.created_at.slice(0, 10);
    const key = `${day}|${r.format}`;
    const prev = map.get(key);
    if (prev) prev.count += 1;
    else map.set(key, { date: day, format: r.format, count: 1 });
  }
  return {
    totalByFormat,
    daily: Array.from(map.values()).sort((a, b) => a.date.localeCompare(b.date)),
    total: rows.length,
  };
}

export interface UserUsageRow {
  user_id: string;
  display_name: string | null;
  count_today: number;
  percent: number;        // 0..100
  near_limit: boolean;    // >= 80%
  over_limit: boolean;    // >= 100%
}

/** Today's usage per user (joins profiles for display_name). */
export async function fetchTodayUserUsage(dailyLimit: number): Promise<UserUsageRow[]> {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const { data, error } = await supabase
    .from("download_history" as never)
    .select("user_id")
    .gte("created_at", start.toISOString())
    .limit(10000);
  if (error) throw error;
  const rows = (data as unknown as Array<{ user_id: string }>) ?? [];
  const counts = new Map<string, number>();
  for (const r of rows) counts.set(r.user_id, (counts.get(r.user_id) ?? 0) + 1);
  const userIds = Array.from(counts.keys());
  let names: Record<string, string | null> = {};
  if (userIds.length) {
    const { data: profs } = await supabase
      .from("profiles")
      .select("user_id, display_name")
      .in("user_id", userIds);
    names = Object.fromEntries(
      ((profs as Array<{ user_id: string; display_name: string | null }>) ?? []).map((p) => [
        p.user_id,
        p.display_name,
      ]),
    );
  }
  return Array.from(counts.entries())
    .map(([user_id, count_today]) => {
      const percent = dailyLimit > 0 ? Math.round((count_today / dailyLimit) * 100) : 0;
      return {
        user_id,
        display_name: names[user_id] ?? null,
        count_today,
        percent,
        near_limit: percent >= 80 && percent < 100,
        over_limit: percent >= 100,
      };
    })
    .sort((a, b) => b.count_today - a.count_today);
}

export interface DownloadAlert {
  kind: "rejections" | "format_spike";
  severity: "warning" | "critical";
  title: string;
  detail: string;
}

/** Compute simple alert signals from the last 24h of audit + history. */
export async function fetchDownloadAlerts(): Promise<DownloadAlert[]> {
  const since = new Date(Date.now() - 86400_000).toISOString();
  const alerts: DownloadAlert[] = [];

  // 1) Repeated rejections per user
  const { data: rejRows } = await supabase
    .from("download_audit_log" as never)
    .select("user_id, reason")
    .eq("outcome", "rejected")
    .gte("created_at", since)
    .limit(5000);
  const rejCounts = new Map<string, number>();
  for (const r of (rejRows as Array<{ user_id: string | null }>) ?? []) {
    if (!r.user_id) continue;
    rejCounts.set(r.user_id, (rejCounts.get(r.user_id) ?? 0) + 1);
  }
  for (const [uid, n] of rejCounts) {
    if (n >= 5) {
      alerts.push({
        kind: "rejections",
        severity: n >= 10 ? "critical" : "warning",
        title: `User ${uid.slice(0, 8)}… exceeded limits ${n}× in 24h`,
        detail: "Repeated rejected download attempts.",
      });
    }
  }

  // 2) Format spike (>= 3× the 7d daily average)
  const { totalByFormat } = await fetchDownloadsByFormat(1);
  const baseline = await fetchDownloadsByFormat(7);
  for (const f of Object.keys(totalByFormat) as DownloadFormat[]) {
    const today = totalByFormat[f] ?? 0;
    const avg = (baseline.totalByFormat[f] ?? 0) / 7;
    if (avg >= 3 && today >= avg * 3) {
      alerts.push({
        kind: "format_spike",
        severity: today >= avg * 5 ? "critical" : "warning",
        title: `Spike in ${f.toUpperCase()} downloads`,
        detail: `${today} today vs 7-day avg ${avg.toFixed(1)}.`,
      });
    }
  }
  return alerts;
}

