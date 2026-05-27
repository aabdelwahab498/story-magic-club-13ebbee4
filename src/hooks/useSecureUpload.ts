import { useCallback, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type SecureUploadStatus =
  | "idle" | "validating" | "requesting" | "uploading" | "scanning" | "done" | "error";

export interface SecureUploadResult {
  bucket: string;
  path: string;
  mime: string;
  signedUrl: string | null;
}

export interface SecureUploadOptions {
  bucket: "user-files" | "drawing-entries" | "payment-proofs" | "video-uploads";
}

const CLIENT_MAX = {
  "user-files": 25 * 1024 * 1024,
  "drawing-entries": 10 * 1024 * 1024,
  "payment-proofs": 10 * 1024 * 1024,
  "video-uploads": 100 * 1024 * 1024,
} as const;

const ACCEPT_BY_BUCKET = {
  "user-files": ["image/png", "image/jpeg", "image/webp", "application/pdf"],
  "drawing-entries": ["image/png", "image/jpeg", "image/webp"],
  "payment-proofs": ["image/png", "image/jpeg", "image/webp", "application/pdf"],
  "video-uploads": ["video/mp4", "video/quicktime", "video/webm"],
} as const;

/**
 * Secure upload hook: init -> PUT to temp-uploads -> finalize (validate + scan + move).
 * Returns progress + status + final signed URL.
 */
export function useSecureUpload(opts: SecureUploadOptions) {
  const [status, setStatus] = useState<SecureUploadStatus>("idle");
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<SecureUploadResult | null>(null);
  const abortRef = useRef<XMLHttpRequest | null>(null);

  const reset = useCallback(() => {
    setStatus("idle"); setProgress(0); setError(null); setResult(null);
  }, []);

  const cancel = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setStatus("idle"); setProgress(0);
  }, []);

  const upload = useCallback(async (file: File): Promise<SecureUploadResult | null> => {
    setError(null); setResult(null); setProgress(0); setStatus("validating");

    // Client-side pre-checks (cheap UX guards — server still re-validates)
    const max = CLIENT_MAX[opts.bucket];
    if (file.size > max) {
      setStatus("error"); setError(`File exceeds ${(max / 1024 / 1024).toFixed(0)} MB limit`);
      return null;
    }
    const accept = ACCEPT_BY_BUCKET[opts.bucket] as readonly string[];
    if (file.type && !accept.includes(file.type)) {
      setStatus("error"); setError(`Unsupported file type: ${file.type}`);
      return null;
    }

    setStatus("requesting");
    const init = await supabase.functions.invoke<{ tempPath: string; token: string; uploadUrl: string }>("upload-init", {
      body: { bucket: opts.bucket, filename: file.name, size: file.size, declaredMime: file.type || "application/octet-stream" },
    });
    if (init.error || !init.data) {
      setStatus("error"); setError(init.error?.message ?? "init_failed"); return null;
    }

    setStatus("uploading");
    // Upload via XHR for progress events
    await new Promise<void>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      abortRef.current = xhr;
      xhr.open("PUT", init.data!.uploadUrl, true);
      xhr.setRequestHeader("Content-Type", file.type || "application/octet-stream");
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) setProgress(Math.round((e.loaded / e.total) * 90));
      };
      xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`upload_failed_${xhr.status}`)));
      xhr.onerror = () => reject(new Error("network_error"));
      xhr.onabort = () => reject(new Error("aborted"));
      xhr.send(file);
    }).catch((e) => {
      setStatus("error"); setError(String(e?.message ?? e));
      throw e;
    });

    setStatus("scanning"); setProgress(95);
    const fin = await supabase.functions.invoke<SecureUploadResult>("upload-finalize", {
      body: {
        tempPath: init.data.tempPath,
        targetBucket: opts.bucket,
        filename: file.name,
        declaredMime: file.type || "application/octet-stream",
      },
    });
    abortRef.current = null;
    if (fin.error || !fin.data) {
      setStatus("error"); setError(fin.error?.message ?? "finalize_failed"); return null;
    }

    setProgress(100); setResult(fin.data); setStatus("done");
    return fin.data;
  }, [opts.bucket]);

  return { upload, cancel, reset, status, progress, error, result };
}
