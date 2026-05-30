import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Sparkles, Send, X, Loader2 } from "lucide-react";
import { toast } from "sonner";

type Msg = { role: "user" | "assistant"; content: string };

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-assistant`;

const LANG_OPTIONS = [
  { code: "ar", label: "Arabic" },
  { code: "en", label: "English" },
  { code: "fr", label: "Français" },
  { code: "es", label: "Español" },
  { code: "de", label: "Deutsch" },
  { code: "it", label: "Italiano" },
];

/**
 * Floating star-shaped AI assistant button (bottom-right).
 * Opens a small chat panel powered by Lovable AI.
 */
const AiAssistantButton = () => {
  const { t, i18n } = useTranslation();
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Msg[]>([]);
  const [loading, setLoading] = useState(false);
  const [lang, setLang] = useState<string>(i18n.language?.split("-")[0] || "en");
  const scrollRef = useRef<HTMLDivElement>(null);
  const isRTL = i18n.dir() === "rtl";

  useEffect(() => {
    const currentLang = i18n.language?.split("-")[0] || "en";
    if (currentLang !== lang && LANG_OPTIONS.some((option) => option.code === currentLang)) {
      setLang(currentLang);
    }
  }, [i18n.language, lang]);

  const handleLanguageChange = (nextLang: string) => {
    if (nextLang === lang) return;
    setLang(nextLang);
    i18n.changeLanguage(nextLang);
    setMessages([]);
    setInput("");
  };

  // Suggested quick questions
  const suggestions = [
    t("ai_assistant.suggest_1"),
    t("ai_assistant.suggest_2"),
    t("ai_assistant.suggest_3"),
    t("ai_assistant.suggest_4"),
    t("ai_assistant.suggest_5"),
    t("ai_assistant.suggest_6"),
  ];

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, loading]);

  const send = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || loading) return;

    const userMsg: Msg = { role: "user", content: trimmed };
    const next = [...messages, userMsg];
    setMessages(next);
    setInput("");
    setLoading(true);

    try {
      const resp = await fetch(CHAT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ messages: next, language: lang }),
      });

      if (resp.status === 429) {
        const ra = Number(resp.headers.get("retry-after") || 0);
        toast.error(
          ra > 0
            ? t("ai.errors.rate_limited_retry", { time: ra < 60 ? `${ra}s` : `${Math.ceil(ra / 60)}m` })
            : t("ai_assistant.rate_limit"),
        );
        setLoading(false);
        return;
      }
      if (resp.status === 422) {
        toast.error(t("ai.errors.content_rejected"));
        setLoading(false);
        return;
      }
      if (resp.status === 402) {
        toast.error(t("ai_assistant.credits"));
        setLoading(false);
        return;
      }
      if (!resp.ok || !resp.body) throw new Error("Stream failed");

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let assistantText = "";
      setMessages((prev) => [...prev, { role: "assistant", content: "" }]);

      let done = false;
      while (!done) {
        const { done: d, value } = await reader.read();
        if (d) break;
        buffer += decoder.decode(value, { stream: true });

        let nl: number;
        while ((nl = buffer.indexOf("\n")) !== -1) {
          let line = buffer.slice(0, nl);
          buffer = buffer.slice(nl + 1);
          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (line.startsWith(":") || line.trim() === "") continue;
          if (!line.startsWith("data: ")) continue;
          const json = line.slice(6).trim();
          if (json === "[DONE]") {
            done = true;
            break;
          }
          try {
            const parsed = JSON.parse(json);
            const c = parsed.choices?.[0]?.delta?.content;
            if (c) {
              assistantText += c;
              setMessages((prev) => {
                const copy = [...prev];
                copy[copy.length - 1] = { role: "assistant", content: assistantText };
                return copy;
              });
            }
          } catch {
            buffer = line + "\n" + buffer;
            break;
          }
        }
      }
    } catch (e) {
      console.error("AI assistant error:", e);
      toast.error(t("ai_assistant.error"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* Floating star button */}
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label={t("ai_assistant.open")}
        className="fixed bottom-20 lg:bottom-5 end-3 sm:end-5 z-50 group"
      >
        <span className="relative flex items-center justify-center">
          {/* Pulsing glow */}
          <span className="absolute inset-0 rounded-full bg-primary/40 blur-xl animate-pulse" />
          {/* Star body */}
          <span className="relative flex h-14 w-14 sm:h-16 sm:w-16 items-center justify-center rounded-full bg-gradient-to-br from-kids-yellow via-sunset to-primary shadow-glow border-2 border-white/80 group-hover:scale-110 transition-transform">
            <Sparkles className="h-7 w-7 sm:h-8 sm:w-8 text-white drop-shadow-md" />
          </span>
          {/* Twinkle */}
          <span className="absolute -top-1 -end-1 text-base animate-twinkle" aria-hidden="true">
            ✨
          </span>
        </span>
      </button>

      {/* Chat panel */}
      {open && (
        <div
          dir={isRTL ? "rtl" : "ltr"}
          className="fixed bottom-36 md:bottom-24 end-3 sm:end-5 z-50 w-[calc(100vw-1.5rem)] sm:w-96 max-w-md bg-card border-2 border-primary/30 rounded-3xl shadow-glow flex flex-col overflow-hidden animate-fade-in"
          style={{ height: "min(65vh, 32rem)" }}
        >
          {/* Header */}
          <div className="flex items-center justify-between gap-2 px-4 py-3 bg-gradient-to-r from-primary to-kids-purple text-white">
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5" />
              <div className="leading-tight">
                <p className="font-extrabold text-sm">{t("ai_assistant.title")}</p>
                <p className="text-[11px] text-white/80">{t("ai_assistant.subtitle")}</p>
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              <select
                value={lang}
                onChange={(e) => handleLanguageChange(e.target.value)}
                aria-label={t("ai_assistant.language")}
                title={t("ai_assistant.language")}
                className="bg-white/15 hover:bg-white/25 text-white text-xs rounded-full px-2 py-1 border border-white/30 focus:outline-none focus:ring-2 focus:ring-white/50 cursor-pointer"
              >
                {LANG_OPTIONS.map((o) => (
                  <option key={o.code} value={o.code} className="text-foreground">
                    {o.label}
                  </option>
                ))}
              </select>
              <button
                onClick={() => setOpen(false)}
                aria-label={t("ai_assistant.close")}
                className="rounded-full p-1 hover:bg-white/20 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>

          {/* Messages */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-3 bg-background/40">
            {messages.length === 0 && (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground text-center px-2">
                  {t("ai_assistant.greeting")}
                </p>
                <div className="flex flex-col gap-2">
                  {suggestions.map((s, i) => (
                    <button
                      key={i}
                      onClick={() => send(s)}
                      className="text-start text-sm bg-card border border-border rounded-2xl px-3 py-2 hover:border-primary hover:bg-primary/5 transition-colors"
                    >
                      ✨ {s}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {messages.map((m, i) => (
              <div
                key={i}
                className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm whitespace-pre-wrap leading-relaxed ${
                    m.role === "user"
                      ? "bg-primary text-primary-foreground rounded-br-sm"
                      : "bg-muted text-foreground rounded-bl-sm"
                  }`}
                >
                  {m.content || (loading && i === messages.length - 1 ? "…" : "")}
                </div>
              </div>
            ))}
            {loading && messages[messages.length - 1]?.role === "user" && (
              <div className="flex justify-start">
                <div className="bg-muted rounded-2xl px-3 py-2 inline-flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {t("ai_assistant.thinking")}
                </div>
              </div>
            )}
          </div>

          {/* Input */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              send(input);
            }}
            className="flex items-center gap-2 p-3 border-t border-border bg-card"
          >
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={t("ai_assistant.placeholder")}
              className="flex-1 bg-background border border-border rounded-full px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
              disabled={loading}
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              className="h-10 w-10 flex items-center justify-center rounded-full bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
              aria-label={t("ai_assistant.send")}
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </button>
          </form>
        </div>
      )}
    </>
  );
};

export default AiAssistantButton;
