import { useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Loader2, Mail, ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { checkRateLimit, recordHit } from "@/lib/rateLimit";
import { describeAuthError } from "@/lib/authErrors";

// Allow at most 3 reset-email requests per email per 10 min, then block for 15 min.
const RL_WINDOW_MS = 10 * 60 * 1000;
const RL_MAX_HITS = 3;
const RL_BLOCK_MS = 15 * 60 * 1000;

const ForgotPassword = () => {
  const { t } = useTranslation();
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = email.trim().toLowerCase();
    if (!trimmed) return;

    const key = `forgot:${trimmed}`;
    const state = checkRateLimit(key, RL_MAX_HITS, RL_WINDOW_MS);
    if (!state.allowed) {
      const mins = Math.ceil(state.retryInSeconds / 60);
      toast.error(
        t(
          "forgot.rate_limited",
          "Too many reset requests for this email. Try again in {{mins}} min.",
          { mins }
        )
      );
      return;
    }

    setSubmitting(true);
    const { error } = await supabase.auth.resetPasswordForEmail(trimmed, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setSubmitting(false);
    recordHit(key, RL_MAX_HITS, RL_WINDOW_MS, RL_BLOCK_MS);

    if (error) {
      const msg = describeAuthError(error, t, "forgot");
      toast.error(msg, { duration: 7000 });
      return;
    }
    setSent(true);
    toast.success(
      t("forgot.sent_toast", "Reset link sent — check your inbox ✉️"),
      { duration: 6000 }
    );
  };


  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-b from-kids-softPurple to-kids-softBlue font-comic">
      <div className="w-full max-w-md bg-card rounded-2xl shadow-xl p-6">
        <h1 className="text-2xl font-bold text-center mb-2 text-kids-midnight">
          {t("forgot.title", "Forgot password")}
        </h1>
        <p className="text-center text-sm text-muted-foreground mb-5">
          {t(
            "forgot.subtitle",
            "Enter your email and we'll send you a link to reset your password."
          )}
        </p>

        {sent ? (
          <div className="rounded-2xl border-2 border-emerald-500/40 bg-emerald-500/10 p-5 text-center space-y-3">
            <div className="mx-auto h-12 w-12 rounded-full bg-emerald-500/20 flex items-center justify-center text-2xl">
              ✉️
            </div>
            <p className="text-sm">
              {t(
                "forgot.sent_desc",
                "If an account exists for {{email}}, a reset link is on the way.",
                { email }
              )}
            </p>
            <Button asChild variant="outline" className="w-full">
              <Link to="/auth">{t("forgot.back_signin", "Back to sign in")}</Link>
            </Button>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="space-y-4">
            <div>
              <Label htmlFor="fp-email" className="flex items-center gap-1">
                <Mail className="h-3.5 w-3.5" />
                {t("auth.email", "Email")}
              </Label>
              <Input
                id="fp-email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                t("forgot.submit", "Send reset link")
              )}
            </Button>
          </form>
        )}

        <div className="text-center mt-4 flex flex-col gap-1 text-xs">
          <Link to="/auth" className="text-primary hover:underline inline-flex items-center justify-center gap-1">
            <ArrowLeft className="h-3 w-3" />
            {t("forgot.back_signin", "Back to sign in")}
          </Link>
          <Link to="/admin/auth" className="text-muted-foreground hover:text-primary underline">
            {t("forgot.admin_link", "Admin sign in")}
          </Link>
        </div>
      </div>
    </div>
  );
};

export default ForgotPassword;
