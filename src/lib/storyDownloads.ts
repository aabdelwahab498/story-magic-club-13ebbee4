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

export async function batchDownloadStories(args: {
  childId?: string;
  formats: ("pdf" | "mp3" | "txt" | "epub")[];
}): Promise<{ bundleUrl: string; total: number }> {
  const { data, error } = await supabase.functions.invoke("batch-download-stories", {
    body: args,
  });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return { bundleUrl: data.bundleUrl as string, total: data.total as number };
}
