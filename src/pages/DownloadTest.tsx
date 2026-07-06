import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Download, ExternalLink, CheckCircle2, AlertCircle } from "lucide-react";

const PDF_URL = "/test-download.pdf";
const FILE_NAME = "starry-tales-test.pdf";

const DownloadTest = () => {
  const [status, setStatus] = useState<string>("");

  const forceDownload = async () => {
    setStatus("جاري التحضير...");
    try {
      const res = await fetch(PDF_URL, { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);

      const inIframe = window.self !== window.top;
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);

      if (inIframe || isIOS) {
        // fallback: open in new tab so browser's PDF viewer can save it
        const w = window.open(url, "_blank");
        if (!w) {
          setStatus("المتصفح منع النافذة الجديدة — استخدم زر 'فتح في تبويب' بالأسفل.");
        } else {
          setStatus("تم فتح الملف في تبويب جديد — استخدم زر الحفظ داخل عارض PDF.");
        }
      } else {
        const a = document.createElement("a");
        a.href = url;
        a.download = FILE_NAME;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setStatus("✔ تم بدء التنزيل — تحقق من مجلد التنزيلات على جهازك.");
      }
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch (e: any) {
      setStatus(`فشل التنزيل: ${e?.message ?? e}`);
    }
  };

  return (
    <div className="container mx-auto max-w-2xl px-4 py-10">
      <Card className="p-6 space-y-6">
        <div className="space-y-2">
          <h1 className="text-2xl font-bold">اختبار تنزيل PDF</h1>
          <p className="text-sm text-muted-foreground">
            استخدم هذه الصفحة للتأكد إن التنزيل شغال على جهاز العميل. الملف حجمه صغير جدًا وآمن.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <Button onClick={forceDownload} size="lg" className="gap-2">
            <Download className="h-4 w-4" />
            تنزيل ملف الاختبار (PDF)
          </Button>

          <Button asChild variant="outline" size="lg" className="gap-2">
            <a href={PDF_URL} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="h-4 w-4" />
              فتح في تبويب جديد
            </a>
          </Button>

          <Button asChild variant="secondary" size="lg" className="gap-2">
            <a href={PDF_URL} download={FILE_NAME}>
              <Download className="h-4 w-4" />
              رابط تنزيل مباشر
            </a>
          </Button>
        </div>

        {status && (
          <div className="flex items-start gap-2 rounded-lg border p-3 text-sm">
            {status.startsWith("✔") ? (
              <CheckCircle2 className="mt-0.5 h-4 w-4 text-green-600" />
            ) : (
              <AlertCircle className="mt-0.5 h-4 w-4 text-amber-600" />
            )}
            <span>{status}</span>
          </div>
        )}

        <div className="rounded-lg bg-muted/40 p-4 text-xs leading-relaxed text-muted-foreground space-y-1">
          <p><strong>الرابط المباشر:</strong> <code className="ltr">{PDF_URL}</code></p>
          <p>لو الزر الأول لم ينزّل الملف مباشرة (بسبب المعاينة داخل إطار مضمّن أو iOS)، سيفتحه في تبويب جديد لتحفظه من هناك.</p>
        </div>
      </Card>
    </div>
  );
};

export default DownloadTest;
