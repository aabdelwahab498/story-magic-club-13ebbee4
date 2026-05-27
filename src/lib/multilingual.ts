import type { LanguageCode } from "@/i18n/config";

export type Multilingual = Partial<Record<LanguageCode, string>>;

/**
 * Get a localized value from a multilingual JSON object.
 * Falls back to English, then to first available language.
 */
export function getLocalized(
  field: Multilingual | string | null | undefined,
  lang: string
): string {
  if (!field) return "";
  if (typeof field === "string") return field;
  const code = lang as LanguageCode;
  return field[code] || field.en || Object.values(field).find((v) => !!v) || "";
}
