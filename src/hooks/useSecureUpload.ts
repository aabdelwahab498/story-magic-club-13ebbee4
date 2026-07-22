import { useCallback, useRef, useState } from "react";

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

  const upload = useCallback(async (_file: File): Promise<SecureUploadResult | null> => {
    setError("Secure upload is not yet migrated to Backend Core");
    setStatus("error");
    return null;
  }, []);

  return { upload, cancel, reset, status, progress, error, result };
}
