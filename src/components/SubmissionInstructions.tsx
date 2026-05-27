import { useTranslation } from "react-i18next";
import { Mail, Camera, FileImage, Send, Copy, Check } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

const SUBMISSION_EMAIL = "submissions@najmah.app";

const SubmissionInstructions = () => {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(SUBMISSION_EMAIL);
      setCopied(true);
      toast.success(t("competition.submit.copied"));
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error(t("common.error"));
    }
  };

  const steps = [
    { icon: Camera, key: "step_1" },
    { icon: FileImage, key: "step_2" },
    { icon: Mail, key: "step_3" },
    { icon: Send, key: "step_4" },
  ];

  return (
    <section className="mb-6 sm:mb-8">
      <div className="bg-gradient-to-br from-kids-softBlue to-kids-softPurple rounded-3xl p-5 sm:p-7 shadow-soft border-2 border-white/60">
        <h3 className="text-lg sm:text-xl font-bold text-kids-midnight mb-2">
          {t("competition.submit.title")}
        </h3>
        <p className="text-sm sm:text-base text-kids-midnight/80 mb-5">
          {t("competition.submit.subtitle")}
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-5">
          {steps.map((s, i) => {
            const Icon = s.icon;
            return (
              <div
                key={s.key}
                className="bg-card/90 backdrop-blur rounded-2xl p-4 border-2 border-white/60"
              >
                <div className="flex items-center gap-2 mb-2">
                  <div className="bg-primary/15 rounded-full h-8 w-8 flex items-center justify-center font-bold text-primary text-sm">
                    {i + 1}
                  </div>
                  <Icon className="h-5 w-5 text-primary" />
                </div>
                <p className="text-sm text-kids-midnight font-medium leading-snug">
                  {t(`competition.submit.${s.key}`)}
                </p>
              </div>
            );
          })}
        </div>

        <div className="bg-card rounded-2xl p-4 border-2 border-white/60 flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4 justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <div className="bg-primary/15 rounded-full p-2.5 shrink-0">
              <Mail className="h-5 w-5 text-primary" />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">
                {t("competition.submit.email_label")}
              </p>
              <a
                href={`mailto:${SUBMISSION_EMAIL}?subject=${encodeURIComponent(
                  t("competition.submit.email_subject")
                )}`}
                className="font-bold text-primary text-base sm:text-lg break-all hover:underline"
              >
                {SUBMISSION_EMAIL}
              </a>
            </div>
          </div>
          <button
            onClick={handleCopy}
            className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-full font-semibold text-sm hover-pop shrink-0"
          >
            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            {copied ? t("competition.submit.copied_btn") : t("competition.submit.copy_btn")}
          </button>
        </div>
      </div>
    </section>
  );
};

export default SubmissionInstructions;
