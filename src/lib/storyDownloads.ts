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

