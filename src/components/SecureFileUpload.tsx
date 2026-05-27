import { useRef } from "react";
import { Upload, Loader2, ShieldCheck, ShieldAlert, X, RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useSecureUpload, type SecureUploadOptions, type SecureUploadResult } from "@/hooks/useSecureUpload";

interface Props extends SecureUploadOptions {
  label?: string;
  accept?: string;
  onUploaded?: (r: SecureUploadResult) => void;
  className?: string;
}

const STATUS_LABEL: Record<string, string> = {
  idle: "Ready",
  validating: "Validating…",
  requesting: "Requesting upload slot…",
  uploading: "Uploading…",
  scanning: "Scanning for malware…",
  done: "Clean ✓",
  error: "Error",
};

export default function SecureFileUpload({
  bucket, label = "Upload file", accept, onUploaded, className,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const { upload, cancel, reset, status, progress, error, result } = useSecureUpload({ bucket });
  const busy = status !== "idle" && status !== "done" && status !== "error";

  const onPick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    e.target.value = "";
    const r = await upload(f).catch(() => null);
    if (r && onUploaded) onUploaded(r);
  };

  return (
    <div className={className}>
      <div className="flex items-center gap-2">
        <Button type="button" variant="outline" disabled={busy} onClick={() => inputRef.current?.click()} className="gap-2">
          {busy
            ? <Loader2 className="h-4 w-4 animate-spin" />
            : status === "done" ? <ShieldCheck className="h-4 w-4 text-green-600" />
            : status === "error" ? <ShieldAlert className="h-4 w-4 text-destructive" />
            : <Upload className="h-4 w-4" />}
          <span>{label}</span>
        </Button>
        {busy && (
          <Button type="button" variant="ghost" size="icon" onClick={cancel} title="Cancel">
            <X className="h-4 w-4" />
          </Button>
        )}
        {(status === "done" || status === "error") && (
          <Button type="button" variant="ghost" size="icon" onClick={reset} title="Reset">
            <RotateCw className="h-4 w-4" />
          </Button>
        )}
      </div>

      <input
        ref={inputRef} type="file" hidden
        accept={accept ?? "image/png,image/jpeg,image/webp,application/pdf"}
        onChange={onPick}
      />

      {(busy || status === "done") && (
        <div className="mt-2 space-y-1">
          <Progress value={progress} className="h-2" />
          <p className="text-xs text-muted-foreground">{STATUS_LABEL[status]}</p>
        </div>
      )}

      {status === "error" && error && (
        <p className="mt-2 text-xs text-destructive break-words">{error}</p>
      )}

      {status === "done" && result && (
        <p className="mt-2 text-xs text-muted-foreground break-all">
          Stored: <code>{result.bucket}/{result.path}</code>
        </p>
      )}
    </div>
  );
}
