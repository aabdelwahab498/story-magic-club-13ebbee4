// Server-side upload validation: magic-byte sniff, MIME/extension match,
// double-extension detection, filename sanitisation, size limits.
//
// IMPORTANT: never trust the client-declared MIME type. We always sniff the
// first bytes of the actual content.

export type AllowedKind = "image" | "pdf" | "video";

export interface BucketPolicy {
  bucket: string;
  maxBytes: number;
  allow: AllowedKind[];
}

export const BUCKET_POLICIES: Record<string, BucketPolicy> = {
  "user-files":      { bucket: "user-files",      maxBytes: 25 * 1024 * 1024, allow: ["image", "pdf"] },
  "drawing-entries": { bucket: "drawing-entries", maxBytes: 10 * 1024 * 1024, allow: ["image"] },
  "payment-proofs":  { bucket: "payment-proofs",  maxBytes: 10 * 1024 * 1024, allow: ["image", "pdf"] },
  "video-uploads":   { bucket: "video-uploads",   maxBytes: 100 * 1024 * 1024, allow: ["video"] },
};

const ALLOWED_EXT_BY_KIND: Record<AllowedKind, Set<string>> = {
  image: new Set(["png", "jpg", "jpeg", "webp"]),
  pdf:   new Set(["pdf"]),
  video: new Set(["mp4", "mov", "webm"]),
};

const ALLOWED_MIME_BY_KIND: Record<AllowedKind, Set<string>> = {
  image: new Set(["image/png", "image/jpeg", "image/webp"]),
  pdf:   new Set(["application/pdf"]),
  video: new Set(["video/mp4", "video/quicktime", "video/webm"]),
};

// Hard blocklist — extensions that can execute or are commonly weaponised.
const BLOCKED_EXT = new Set([
  "exe","scr","bat","cmd","com","cpl","msi","ps1","sh","bash","zsh",
  "js","mjs","cjs","jsx","ts","tsx","vbs","vbe","wsf","wsh",
  "php","phtml","jsp","asp","aspx","cgi","pl","py","rb",
  "jar","class","apk","app","dmg","iso","img",
  "svg","htm","html","xhtml","xml","xsl","xslt",
  "lnk","reg","inf","scf","pif",
]);

export interface ValidationOk {
  ok: true;
  kind: AllowedKind;
  detectedMime: string;
  extension: string;
  safeName: string;
}
export interface ValidationFail {
  ok: false;
  reason: string;
  code:
    | "missing_file"
    | "too_large"
    | "blocked_extension"
    | "double_extension"
    | "extension_mismatch"
    | "mime_spoofed"
    | "unsupported_kind"
    | "invalid_filename";
  details?: Record<string, unknown>;
}
export type ValidationResult = ValidationOk | ValidationFail;

/** Sanitise a filename: strip paths, control chars, collapse dots, max 120 chars. */
export function sanitiseFilename(raw: string): string {
  if (!raw) return "file";
  // Strip directory components
  let name = raw.replace(/[\\/]+/g, "_").trim();
  // Drop control chars + zero-width
  // deno-lint-ignore no-control-regex
  name = name.replace(/[\u0000-\u001f\u007f\u200b-\u200f]/g, "");
  // Collapse runs of dots — defeats "image....jpg.exe" tricks
  name = name.replace(/\.{2,}/g, ".");
  // Strip leading dots / dashes
  name = name.replace(/^[.\-\s]+/, "");
  // Restrict character set
  name = name.replace(/[^\w.\- ]+/g, "_");
  if (name.length === 0) name = "file";
  if (name.length > 120) {
    const dot = name.lastIndexOf(".");
    if (dot > 0 && name.length - dot <= 8) {
      name = name.slice(0, 120 - (name.length - dot)) + name.slice(dot);
    } else {
      name = name.slice(0, 120);
    }
  }
  return name;
}

/** Detect if a filename has more than one meaningful extension (e.g. "x.jpg.exe"). */
function hasDoubleExtension(name: string): boolean {
  const parts = name.toLowerCase().split(".");
  if (parts.length < 3) return false;
  const last = parts[parts.length - 1];
  const prev = parts[parts.length - 2];
  // If both are recognised "extension-shaped" tokens, treat as double.
  const looksExt = (p: string) => p.length >= 1 && p.length <= 5 && /^[a-z0-9]+$/.test(p);
  return looksExt(last) && looksExt(prev);
}

/** Sniff the first bytes of the content to derive a real MIME type. */
export function sniffMime(bytes: Uint8Array): string | null {
  const b = bytes;
  if (b.length < 4) return null;
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return "image/png";
  // JPEG: FF D8 FF
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  // WEBP: "RIFF"...."WEBP"
  if (b.length >= 12 && b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 &&
      b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50) return "image/webp";
  // PDF: "%PDF-"
  if (b[0] === 0x25 && b[1] === 0x50 && b[2] === 0x44 && b[3] === 0x46 && b[4] === 0x2d) return "application/pdf";
  // GIF (rejected — not in allowlist but detect for clearer error)
  if (b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x38) return "image/gif";
  // MP4 / MOV: "....ftyp"
  if (b.length >= 12 && b[4] === 0x66 && b[5] === 0x74 && b[6] === 0x79 && b[7] === 0x70) {
    const brand = String.fromCharCode(b[8], b[9], b[10], b[11]);
    if (brand.startsWith("qt")) return "video/quicktime";
    return "video/mp4";
  }
  // WEBM / Matroska: 1A 45 DF A3
  if (b[0] === 0x1a && b[1] === 0x45 && b[2] === 0xdf && b[3] === 0xa3) return "video/webm";
  // ZIP — could be hidden archive (jar/apk/xlsx). Reject.
  if (b[0] === 0x50 && b[1] === 0x4b && (b[2] === 0x03 || b[2] === 0x05)) return "application/zip";
  // PE / Windows executable
  if (b[0] === 0x4d && b[1] === 0x5a) return "application/x-msdownload";
  // ELF
  if (b[0] === 0x7f && b[1] === 0x45 && b[2] === 0x4c && b[3] === 0x46) return "application/x-executable";
  // Shebang / script
  if (b[0] === 0x23 && b[1] === 0x21) return "text/x-script";
  // SVG (text-based) — sniff a window
  const head = new TextDecoder().decode(b.slice(0, Math.min(b.length, 256))).trim().toLowerCase();
  if (head.startsWith("<?xml") || head.startsWith("<svg")) return "image/svg+xml";
  if (head.startsWith("<!doctype html") || head.startsWith("<html")) return "text/html";
  return null;
}

function kindFor(mime: string): AllowedKind | null {
  for (const [kind, set] of Object.entries(ALLOWED_MIME_BY_KIND)) {
    if (set.has(mime)) return kind as AllowedKind;
  }
  return null;
}

export function validateUpload(opts: {
  bucket: string;
  filename: string;
  declaredMime: string;
  size: number;
  bytes: Uint8Array; // first chunk of content (>=512 bytes recommended)
}): ValidationResult {
  const policy = BUCKET_POLICIES[opts.bucket];
  if (!policy) {
    return { ok: false, code: "unsupported_kind", reason: `Unknown bucket: ${opts.bucket}` };
  }

  if (!opts.size || opts.size <= 0) {
    return { ok: false, code: "missing_file", reason: "Empty file" };
  }
  if (opts.size > policy.maxBytes) {
    return {
      ok: false, code: "too_large",
      reason: `File exceeds ${(policy.maxBytes / 1024 / 1024).toFixed(0)} MB limit`,
      details: { size: opts.size, max: policy.maxBytes },
    };
  }

  const safeName = sanitiseFilename(opts.filename);
  if (safeName === "file" && !opts.filename) {
    return { ok: false, code: "invalid_filename", reason: "Missing filename" };
  }

  if (hasDoubleExtension(safeName)) {
    return { ok: false, code: "double_extension", reason: "Double extensions are not allowed", details: { name: safeName } };
  }

  const ext = (safeName.includes(".") ? safeName.split(".").pop()! : "").toLowerCase();
  if (!ext) {
    return { ok: false, code: "invalid_filename", reason: "Missing file extension" };
  }
  if (BLOCKED_EXT.has(ext)) {
    return { ok: false, code: "blocked_extension", reason: `Extension .${ext} is blocked`, details: { ext } };
  }

  const detectedMime = sniffMime(opts.bytes);
  if (!detectedMime) {
    return { ok: false, code: "mime_spoofed", reason: "Could not identify file type from contents" };
  }

  const detectedKind = kindFor(detectedMime);
  if (!detectedKind || !policy.allow.includes(detectedKind)) {
    return {
      ok: false, code: "unsupported_kind",
      reason: `File type ${detectedMime} is not allowed in bucket ${policy.bucket}`,
      details: { detectedMime, allowed: policy.allow },
    };
  }

  if (!ALLOWED_EXT_BY_KIND[detectedKind].has(ext)) {
    return {
      ok: false, code: "extension_mismatch",
      reason: `Extension .${ext} does not match content type ${detectedMime}`,
      details: { ext, detectedMime },
    };
  }

  // Soft check on declared MIME — log mismatch but allow if magic bytes pass.
  const declared = (opts.declaredMime ?? "").toLowerCase().trim();
  if (declared && !ALLOWED_MIME_BY_KIND[detectedKind].has(declared)) {
    return {
      ok: false, code: "mime_spoofed",
      reason: `Declared MIME ${declared} does not match detected ${detectedMime}`,
      details: { declared, detectedMime },
    };
  }

  return { ok: true, kind: detectedKind, detectedMime, extension: ext, safeName };
}
