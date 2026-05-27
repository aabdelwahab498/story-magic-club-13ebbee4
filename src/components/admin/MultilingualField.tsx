import { useTranslation } from "react-i18next";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ADMIN_LANGUAGES, type AdminLanguageCode } from "@/lib/adminConstants";
import type { Multilingual } from "@/lib/multilingual";

interface Props {
  label: string;
  value: Multilingual;
  onChange: (next: Multilingual) => void;
  multiline?: boolean;
  rows?: number;
  placeholder?: string;
}

export default function MultilingualField({
  label,
  value,
  onChange,
  multiline = false,
  rows = 4,
  placeholder,
}: Props) {
  const { i18n } = useTranslation();
  const defaultLang = (ADMIN_LANGUAGES.some((l) => l.code === i18n.language)
    ? i18n.language
    : "en") as AdminLanguageCode;

  const update = (code: AdminLanguageCode, v: string) => {
    onChange({ ...value, [code]: v });
  };

  return (
    <div className="space-y-2">
      <Label className="text-sm font-medium">{label}</Label>
      <Tabs defaultValue={defaultLang} className="w-full">
        <TabsList className="flex flex-wrap h-auto gap-1 bg-muted/50 p-1">
          {ADMIN_LANGUAGES.map((lang) => {
            const filled = !!value[lang.code]?.trim();
            return (
              <TabsTrigger
                key={lang.code}
                value={lang.code}
                className="gap-1.5 data-[state=active]:bg-background"
              >
                <span>{lang.flag}</span>
                <span className="text-xs uppercase">{lang.code}</span>
                {filled && <span className="h-1.5 w-1.5 rounded-full bg-primary" />}
              </TabsTrigger>
            );
          })}
        </TabsList>
        {ADMIN_LANGUAGES.map((lang) => (
          <TabsContent key={lang.code} value={lang.code} className="mt-2">
            {multiline ? (
              <Textarea
                value={value[lang.code] ?? ""}
                onChange={(e) => update(lang.code, e.target.value)}
                rows={rows}
                placeholder={placeholder}
                dir={lang.rtl ? "rtl" : "ltr"}
              />
            ) : (
              <Input
                value={value[lang.code] ?? ""}
                onChange={(e) => update(lang.code, e.target.value)}
                placeholder={placeholder}
                dir={lang.rtl ? "rtl" : "ltr"}
              />
            )}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
