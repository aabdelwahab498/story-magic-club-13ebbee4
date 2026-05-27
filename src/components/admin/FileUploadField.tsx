import { useState, useRef } from "react";
import { useTranslation } from "react-i18next";
import { Upload, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

interface FileUploadFieldProps {
  label: string;
  value: string | null;
  onChange: (url: string | null) => void;
  uploader: (file: File) => Promise<string>;
  accept: string;
  uploadLabel?: string;
  disabled?: boolean;
  preview?: "image" | "audio" | "none";
}

export default function FileUploadField({
  label,
  value,
  onChange,
  uploader,
  accept,
  uploadLabel,
  disabled,
  preview = "none",
}: FileUploadFieldProps) {
  const { t } = useTranslation();
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const url = await uploader(file);
      onChange(url);
      toast.success(t("admin_dashboard.toast.saved"));
    } catch (err) {
      console.error(err);
      toast.error(t("admin_dashboard.toast.upload_failed"));
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="flex-1">
          <Input
            value={value ?? ""}
            onChange={(e) => onChange(e.target.value || null)}
            placeholder={t("admin_dashboard.field.or_paste_url")}
            disabled={disabled || uploading}
          />
        </div>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={disabled || uploading}
            onClick={() => inputRef.current?.click()}
            className="gap-2 shrink-0"
          >
            {uploading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Upload className="h-4 w-4" />
            )}
            <span className="hidden sm:inline">
              {uploadLabel ?? t("admin_dashboard.field.upload_image")}
            </span>
          </Button>
          {value && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => onChange(null)}
              disabled={disabled || uploading}
              title={t("admin_dashboard.actions.delete")}
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          className="hidden"
          onChange={handleFile}
        />
      </div>
      {preview === "image" && value && (
        <img
          src={value}
          alt="preview"
          className="h-24 w-24 rounded-lg object-cover border-2 border-border"
          onError={(e) => ((e.currentTarget.style.display = "none"))}
        />
      )}
      {preview === "audio" && value && (
        <audio src={value} controls className="w-full h-10" />
      )}
    </div>
  );
}
