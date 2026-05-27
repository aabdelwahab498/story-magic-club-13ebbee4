import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";

import en from "./locales/en.json";
import ar from "./locales/ar.json";
import de from "./locales/de.json";
import fr from "./locales/fr.json";
import it from "./locales/it.json";
import es from "./locales/es.json";

export const SUPPORTED_LANGUAGES = [
  { code: "en", label: "English", flag: "🇺🇸", nativeName: "English", rtl: false },
  { code: "ar", label: "Arabic", flag: "🇸🇦", nativeName: "العربية", rtl: true },
  { code: "de", label: "German", flag: "🇩🇪", nativeName: "Deutsch", rtl: false },
  { code: "fr", label: "French", flag: "🇫🇷", nativeName: "Français", rtl: false },
  { code: "it", label: "Italian", flag: "🇮🇹", nativeName: "Italiano", rtl: false },
  { code: "es", label: "Spanish", flag: "🇪🇸", nativeName: "Español", rtl: false },
] as const;

export type LanguageCode = (typeof SUPPORTED_LANGUAGES)[number]["code"];

export const RTL_LANGUAGES: LanguageCode[] = ["ar"];

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: en },
      ar: { translation: ar },
      de: { translation: de },
      fr: { translation: fr },
      it: { translation: it },
      es: { translation: es },
    },
    fallbackLng: "en",
    supportedLngs: SUPPORTED_LANGUAGES.map((l) => l.code),
    interpolation: { escapeValue: false },
    detection: {
      order: ["localStorage", "navigator", "htmlTag"],
      caches: ["localStorage"],
      lookupLocalStorage: "starry-tales-language",
    },
  });

const applyDirection = (lng: string) => {
  const isRtl = RTL_LANGUAGES.includes(lng as LanguageCode);
  document.documentElement.setAttribute("dir", isRtl ? "rtl" : "ltr");
  document.documentElement.setAttribute("lang", lng);
};

applyDirection(i18n.language || "en");
i18n.on("languageChanged", applyDirection);

export default i18n;
