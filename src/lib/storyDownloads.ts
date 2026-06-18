// Client helpers for story download formats (PDF, MP3, TXT, EPUB) and batch ZIP.
import { supabase } from "@/integrations/supabase/client";

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
  status: "running" | "completed" | "failed";
}

export async function startBatchDownload(args: {
  childId?: string;
  formats: ("pdf" | "mp3" | "txt" | "epub")[];
}): Promise<BatchStartResult> {
  const { data, error } = await supabase.functions.invoke("batch-download-stories", {
    body: args,
  });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return { jobId: data.jobId, total: data.total, status: data.status ?? "running" };
}

// Backwards-compat name (kept so older callers still type-check).
export const batchDownloadStories = startBatchDownload;
