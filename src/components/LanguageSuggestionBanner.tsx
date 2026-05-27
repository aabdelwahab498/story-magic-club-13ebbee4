import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { X } from "lucide-react";
import { SUPPORTED_LANGUAGES } from "@/i18n/config";
import { Button } from "@/components/ui/button";

const STORAGE_KEY = "starry-tales-suggestion-dismissed";

const LanguageSuggestionBanner = () => {
  const { i18n, t } = useTranslation();
  const [show, setShow] = useState(false);
  const [suggestedCode, setSuggestedCode] = useState<string>("en");

  useEffect(() => {
    if (localStorage.getItem(STORAGE_KEY)) return;
    if (localStorage.getItem("starry-tales-language")) return;

    const browser = (navigator.language || "en").slice(0, 2);
    const supported = SUPPORTED_LANGUAGES.find((l) => l.code === browser);
    if (supported && supported.code !== i18n.language) {
      setSuggestedCode(supported.code);
      setShow(true);
    }
  }, [i18n.language]);

  const dismiss = () => {
    localStorage.setItem(STORAGE_KEY, "1");
    setShow(false);
  };

  const accept = async () => {
    await i18n.changeLanguage(suggestedCode);
    dismiss();
  };

  if (!show) return null;
  const lang = SUPPORTED_LANGUAGES.find((l) => l.code === suggestedCode)!;

  return (
    <div className="bg-primary/10 border-b border-primary/20 px-4 py-3">
      <div className="container mx-auto flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-foreground">
          <span className="text-lg me-2">{lang.flag}</span>
          {t("language_suggestion.message", { language: lang.nativeName })}
        </p>
        <div className="flex items-center gap-2">
          <Button size="sm" onClick={accept}>
            {t("language_suggestion.switch", { language: lang.nativeName })}
          </Button>
          <Button size="sm" variant="ghost" onClick={dismiss}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
};

export default LanguageSuggestionBanner;
