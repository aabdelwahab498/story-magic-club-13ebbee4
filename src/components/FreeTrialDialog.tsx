import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Sparkles, Lock, Clock, ShieldAlert, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import {
  generateTrialStory,
  saveTrialResume,
  TrialRateLimitedError,
  TrialContentRejectedError,
  TrialServerError,
  type TrialStoryResponse,
} from "@/lib/trialStoryApi";


interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

const LOADING_STEPS = [
  "نخطط لحبكة القصة…",
  "نكتب الصفحات بإحساس طفولي…",
  "نضيف لمسات سحرية أخيرة…",
];

export default function FreeTrialDialog({ open, onOpenChange }: Props) {
  const { i18n } = useTranslation();
  const navigate = useNavigate();
  const [step, setStep] = useState<"form" | "loading" | "result">("form");
  const [childName, setChildName] = useState("");
  const [age, setAge] = useState<number>(5);
  const [theme, setTheme] = useState("");
  const [loadingStep, setLoadingStep] = useState(0);
  const [result, setResult] = useState<TrialStoryResponse | null>(null);
  const [pageIdx, setPageIdx] = useState(0);
  const [errorState, setErrorState] = useState<
    | { kind: "rate"; retryAfter: number; reason: "rate_limited" | "blocked" }
    | { kind: "rejected"; message: string }
    | { kind: "server"; message: string; requestId?: string }
    | null
  >(null);

  const reset = () => {
    setStep("form");
    setResult(null);
    setPageIdx(0);
    setLoadingStep(0);
    setErrorState(null);
  };

  const handleClose = (v: boolean) => {
    onOpenChange(v);
    if (!v) setTimeout(reset, 300);
  };

  const submit = async () => {
    if (!childName.trim() || !theme.trim()) {
      toast.error("اكتب اسم الطفل وموضوع القصة");
      return;
    }
    setErrorState(null);
    setStep("loading");
    setLoadingStep(0);
    const cycle = setInterval(() => {
      setLoadingStep((s) => Math.min(s + 1, LOADING_STEPS.length - 1));
    }, 5000);
    try {
      const data = await generateTrialStory({
        childName: childName.trim(),
        age,
        theme: theme.trim(),
        language: i18n.language?.slice(0, 2) || "ar",
      });
      clearInterval(cycle);
      setResult(data);
      setStep("result");
    } catch (e) {
      clearInterval(cycle);
      if (e instanceof TrialRateLimitedError) {
        setErrorState({ kind: "rate", retryAfter: e.retryAfter, reason: e.reason });
      } else if (e instanceof TrialContentRejectedError) {
        setErrorState({ kind: "rejected", message: e.userMessage });
      } else if (e instanceof TrialServerError) {
        setErrorState({ kind: "server", message: e.userMessage, requestId: e.requestId });
      } else {
        setErrorState({
          kind: "server",
          message: "حصل خطأ غير متوقع وإحنا بنجهّز قصتك. حاول تاني بعد لحظة.",
        });
      }
      setStep("form");
    }
  };

  const renderStatusBadge = () => {
    if (errorState?.kind === "rate") {
      const mins = Math.max(1, Math.ceil(errorState.retryAfter / 60));
      return (
        <div className="flex items-start gap-2 rounded-xl bg-amber-500/10 border border-amber-500/30 p-3 text-sm">
          <Clock className="h-5 w-5 text-amber-600 mt-0.5 shrink-0" />
          <div>
            <p className="font-bold text-amber-900 dark:text-amber-100">
              التجربة موقوفة مؤقتاً (حماية ضد الإساءة)
            </p>
            <p className="text-amber-900/80 dark:text-amber-100/80">
              لإن في طلبات كتير من نفس المكان دلوقتي. حاول تاني بعد ~{mins} دقيقة، أو سجّل واشترك علشان توليد بلا حدود.
            </p>
          </div>
        </div>
      );
    }
    if (errorState?.kind === "rejected") {
      return (
        <div className="flex items-start gap-2 rounded-xl bg-destructive/10 border border-destructive/30 p-3 text-sm">
          <ShieldAlert className="h-5 w-5 text-destructive mt-0.5 shrink-0" />
          <div>
            <p className="font-bold text-destructive">المحتوى مش مناسب</p>
            <p className="text-destructive/80">{errorState.message}</p>
          </div>
        </div>
      );
    }
    if (errorState?.kind === "server") {
      return (
        <div className="flex items-start gap-2 rounded-xl bg-destructive/10 border border-destructive/30 p-3 text-sm">
          <ShieldAlert className="h-5 w-5 text-destructive mt-0.5 shrink-0" />
          <div>
            <p className="font-bold text-destructive">حصل خطأ</p>
            <p className="text-destructive/80">{errorState.message}</p>
            {errorState.requestId && (
              <p className="text-[11px] text-muted-foreground mt-1">رقم الطلب: {errorState.requestId}</p>
            )}
          </div>
        </div>
      );
    }
    return (
      <div className="flex items-start gap-2 rounded-xl bg-emerald-500/10 border border-emerald-500/30 p-3 text-sm">
        <CheckCircle2 className="h-5 w-5 text-emerald-600 mt-0.5 shrink-0" />
        <div>
          <p className="font-bold text-emerald-900 dark:text-emerald-100">التجربة مفتوحة وجاهزة</p>
          <p className="text-emerald-900/80 dark:text-emerald-100/80">
            تقدر تجرّب توليد قصة (نص فقط) بدون حدود — حد بسيط لكل IP لمنع الإساءة. للصور والصوت سجّل واشترك.
          </p>
        </div>
      </div>
    );
  };


  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        {step === "form" && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-2xl">
                <Sparkles className="h-6 w-6 text-primary" />
                جرّب توليد قصة مجاناً
              </DialogTitle>
              <DialogDescription>
                هنولّد لك أول 3 صفحات من قصة شخصية — نص فقط. للصور والصوت والقصة الكاملة سجّل واشترك.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              {renderStatusBadge()}

              <div>
                <Label htmlFor="trial-name">اسم الطفل</Label>
                <Input
                  id="trial-name"
                  value={childName}
                  onChange={(e) => setChildName(e.target.value)}
                  placeholder="مثلاً: سلمى"
                  maxLength={40}
                />
              </div>
              <div>
                <Label htmlFor="trial-age">العمر ({age} سنوات)</Label>
                <Input
                  id="trial-age"
                  type="range"
                  min={3}
                  max={12}
                  value={age}
                  onChange={(e) => setAge(Number(e.target.value))}
                />
              </div>
              <div>
                <Label htmlFor="trial-theme">موضوع القصة</Label>
                <Input
                  id="trial-theme"
                  value={theme}
                  onChange={(e) => setTheme(e.target.value)}
                  placeholder="مثلاً: مغامرة في الغابة مع كتكوت ضايع"
                  maxLength={80}
                />
              </div>
              <Button onClick={submit} size="lg" className="w-full text-base">
                <Sparkles className="h-5 w-5 me-2" />
                ابدأ التوليد الآن
              </Button>
              <p className="text-xs text-muted-foreground text-center">
                التوليد يستغرق حوالي 20-40 ثانية. جرّب كذا مرة من غير حد.
              </p>
            </div>
          </>
        )}

        {step === "loading" && (
          <div className="py-12 flex flex-col items-center text-center gap-4">
            <div className="relative">
              <Loader2 className="h-16 w-16 animate-spin text-primary" />
              <Sparkles className="absolute inset-0 m-auto h-6 w-6 text-primary animate-pulse" />
            </div>
            <h3 className="text-xl font-bold">نولّد قصتك الآن…</h3>
            <p className="text-muted-foreground transition-all duration-500" key={loadingStep}>
              {LOADING_STEPS[loadingStep]}
            </p>
            <div className="w-full max-w-xs h-2 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-primary transition-all duration-500"
                style={{ width: `${((loadingStep + 1) / LOADING_STEPS.length) * 100}%` }}
              />
            </div>
          </div>
        )}

        {step === "result" && result && (
          <>
            <DialogHeader>
              <DialogTitle className="text-2xl">{result.title}</DialogTitle>
              <DialogDescription>
                صفحة {pageIdx + 1} من {result.shownPages} — تجربة من أصل {result.totalPages} صفحة
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <p className="text-lg leading-relaxed text-card-foreground bg-muted/50 rounded-xl p-5 min-h-[180px]">
                {result.pages[pageIdx]?.text}
              </p>
              <div className="flex justify-between gap-2">
                <Button
                  variant="outline"
                  disabled={pageIdx === 0}
                  onClick={() => setPageIdx((p) => p - 1)}
                >
                  السابقة
                </Button>
                <Button
                  variant="outline"
                  disabled={pageIdx >= result.pages.length - 1}
                  onClick={() => setPageIdx((p) => p + 1)}
                >
                  التالية
                </Button>
              </div>
              <div className="border-t pt-4 mt-4 text-center bg-gradient-to-br from-primary/10 to-kids-softPurple rounded-2xl p-5">
                <Lock className="h-8 w-8 text-primary mx-auto mb-2" />
                <h4 className="font-bold text-lg mb-1">
                  عايز صور للقصة وصوت راوي؟
                </h4>
                <p className="text-sm text-muted-foreground mb-3">
                  سجّل واشترك وكمّل القصة بالصور والصوت + قصص لا نهائية لطفلك.
                </p>
                <Button
                  size="lg"
                  onClick={() => {
                    saveTrialResume({
                      childName: childName.trim(),
                      age,
                      theme: theme.trim(),
                      language: i18n.language?.slice(0, 2) || "ar",
                    });
                    handleClose(false);
                    navigate("/auth", { state: { from: "/ai-storyteller" } });
                  }}

                  className="w-full"
                >
                  <Sparkles className="h-5 w-5 me-2" />
                  Sign up to illustrate your story
                </Button>
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
