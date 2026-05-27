import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Mail, Send, LifeBuoy, Sparkles } from "lucide-react";
import { z } from "zod";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

const contactSchema = z.object({
  name: z.string().trim().min(1).max(100),
  email: z.string().trim().email().max(255),
  subject: z.string().trim().min(1).max(150),
  message: z.string().trim().min(1).max(1000),
});

const emails = [
  { key: "info", icon: Mail },
  { key: "support", icon: LifeBuoy },
  { key: "submissions", icon: Sparkles },
] as const;

const Contact = () => {
  const { t, i18n } = useTranslation();
  const [form, setForm] = useState({ name: "", email: "", subject: "", message: "" });
  const [sending, setSending] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const result = contactSchema.safeParse(form);
    if (!result.success) {
      toast({
        title: t("contact.invalid_title"),
        description: t("contact.invalid_desc"),
        variant: "destructive",
      });
      return;
    }
    setSending(true);
    try {
      const { data: sess } = await supabase.auth.getUser();
      const { error } = await supabase.from("contact_messages").insert([
        {
          name: result.data.name,
          email: result.data.email,
          subject: result.data.subject,
          message: result.data.message,
          language: i18n.language,
          user_id: sess.user?.id ?? null,
        },
      ]);
      if (error) throw error;
      supabase.functions
        .invoke("send-contact-email", { body: { ...result.data, language: i18n.language } })
        .catch(() => {});
      setForm({ name: "", email: "", subject: "", message: "" });
      toast({ title: t("contact.sent_title"), description: t("contact.sent_desc") });
    } catch (err) {
      console.error(err);
      toast({
        title: t("contact.invalid_title"),
        description: t("contact.invalid_desc"),
        variant: "destructive",
      });
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="py-4 sm:py-6 lg:py-8 max-w-5xl mx-auto">
      <header className="text-center mb-8 sm:mb-10 animate-fade-in">
        <span className="inline-block px-4 py-1.5 rounded-full bg-kids-softBlue text-kids-blue text-sm font-bold mb-3">
          📬 {t("contact.eyebrow")}
        </span>
        <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-foreground mb-3">
          {t("contact.title")}
        </h1>
        <p className="text-base sm:text-lg text-muted-foreground max-w-2xl mx-auto px-2">
          {t("contact.subtitle")}
        </p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-8">
        {emails.map(({ key, icon: Icon }) => (
          <a
            key={key}
            href={`mailto:${key}@najmah.app`}
            className="flex items-start gap-3 bg-white/95 dark:bg-card/90 rounded-2xl p-4 border-2 border-white/60 shadow-soft hover-pop"
          >
            <div className="p-2 rounded-full bg-kids-softPurple">
              <Icon className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h3 className="font-bold text-foreground">{t(`contact.email.${key}_title`)}</h3>
              <p className="text-sm text-muted-foreground">{key}@najmah.app</p>
            </div>
          </a>
        ))}
      </div>

      <form
        onSubmit={handleSubmit}
        className="bg-white/95 dark:bg-card/90 rounded-3xl p-6 sm:p-8 shadow-soft border-2 border-white/60 space-y-4"
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-bold text-foreground mb-1.5">
              {t("contact.form.name")}
            </label>
            <input
              type="text"
              required
              maxLength={100}
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full px-4 py-2.5 rounded-xl border-2 border-input bg-background focus:border-primary focus:outline-none transition-colors"
            />
          </div>
          <div>
            <label className="block text-sm font-bold text-foreground mb-1.5">
              {t("contact.form.email")}
            </label>
            <input
              type="email"
              required
              maxLength={255}
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="w-full px-4 py-2.5 rounded-xl border-2 border-input bg-background focus:border-primary focus:outline-none transition-colors"
            />
          </div>
        </div>
        <div>
          <label className="block text-sm font-bold text-foreground mb-1.5">
            {t("contact.form.subject")}
          </label>
          <input
            type="text"
            required
            maxLength={150}
            value={form.subject}
            onChange={(e) => setForm({ ...form, subject: e.target.value })}
            className="w-full px-4 py-2.5 rounded-xl border-2 border-input bg-background focus:border-primary focus:outline-none transition-colors"
          />
        </div>
        <div>
          <label className="block text-sm font-bold text-foreground mb-1.5">
            {t("contact.form.message")}
          </label>
          <textarea
            required
            maxLength={1000}
            rows={5}
            value={form.message}
            onChange={(e) => setForm({ ...form, message: e.target.value })}
            className="w-full px-4 py-2.5 rounded-xl border-2 border-input bg-background focus:border-primary focus:outline-none transition-colors resize-none"
          />
        </div>
        <button
          type="submit"
          disabled={sending}
          className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-primary text-primary-foreground rounded-full font-bold hover-pop shadow-soft disabled:opacity-60"
        >
          <Send className="h-4 w-4" />
          {sending ? t("contact.form.sending") : t("contact.form.send")}
        </button>
      </form>
    </div>
  );
};

export default Contact;
