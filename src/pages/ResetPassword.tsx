import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Loader2, Lock, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { checkRateLimit, recordHit } from "@/lib/rateLimit";
import { describeAuthError } from "@/lib/authErrors";

// Allow at most 5 password-update attempts per 10 min, then 15 min cooldown.
const RL_WINDOW_MS = 10 * 60 * 1000;
const RL_MAX_HITS = 5;
const RL_BLOCK_MS = 15 * 60 * 1000;
const RL_KEY = "reset:update";

const ResetPassword = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Supabase puts the recovery token in the URL hash; supabase-js parses it
    // and fires PASSWORD_RECOVERY on auth state change.
    const hash = window.location.hash || "";
    const isRecovery = hash.includes("type=recovery") || hash.includes("access_token");

    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") {
        setReady(true);
      }
    });

    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        setReady(true);
      } else if (!isRecovery) {
        setError(
          t(
            "reset.invalid_link",
            "Reset link is missing or expired. Please request a new one."
          )
        );
      }
    });

    // Fallback timeout: if neither session nor PASSWORD_RECOVERY fires within 6s,
    // surface the invalid-link UI so users aren't stuck on a spinner.
    const timeout = window.setTimeout(() => {
      setReady((curr) => {
        if (!curr) {
          setError(
            t(
              "reset.invalid_link",
              "Reset link is missing or expired. Please request a new one."
            )
          );
        }
        return curr;
      });
    }, 6000);

    return () => {
      sub.subscription.unsubscribe();
      window.clearTimeout(timeout);
    };
  }, [t]);


  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) {
      toast.error(t("reset.too_short", "Password must be at least 8 characters"));
      return;
    }
    if (password !== confirmPassword) {
      toast.error(t("reset.mismatch", "Passwords do not match"));
      return;
    }

    const rl = checkRateLimit(RL_KEY, RL_MAX_HITS, RL_WINDOW_MS);
    if (!rl.allowed) {
      const mins = Math.ceil(rl.retryInSeconds / 60);
      toast.error(
        t(
          "reset.rate_limited",
          "Too many attempts. Please wait {{mins}} min before trying again.",
          { mins }
        )
      );
      return;
    }

    setSubmitting(true);
    const { error: upErr } = await supabase.auth.updateUser({ password });
    setSubmitting(false);
    recordHit(RL_KEY, RL_MAX_HITS, RL_WINDOW_MS, RL_BLOCK_MS);

    if (upErr) {
      toast.error(describeAuthError(upErr, t, "reset"), { duration: 7000 });
      return;
    }
    toast.success(t("reset.success", "Password updated — please sign in ✨"));
    await supabase.auth.signOut();
    navigate("/auth", { replace: true });
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-b from-kids-softPurple to-kids-softBlue font-comic">
      <div className="w-full max-w-md bg-card rounded-2xl shadow-xl p-6">
        <div className="flex items-center justify-center gap-2 mb-2">
          <ShieldCheck className="h-5 w-5 text-primary" />
          <h1 className="text-2xl font-bold text-kids-midnight">
            {t("reset.title", "Set a new password")}
          </h1>
        </div>
        <p className="text-center text-sm text-muted-foreground mb-5">
          {t(
            "reset.subtitle",
            "Choose a strong password. You'll sign in again right after."
          )}
        </p>

        {error ? (
          <div className="rounded-2xl border-2 border-destructive/40 bg-destructive/10 p-4 text-sm text-center text-destructive">
            {error}
            <div className="mt-3">
              <Button variant="outline" onClick={() => navigate("/forgot-password")}>
                {t("reset.request_new", "Request a new link")}
              </Button>
            </div>
          </div>
        ) : !ready ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
          </div>
        ) : (
          <form onSubmit={onSubmit} className="space-y-4">
            <div>
              <Label htmlFor="rp-pw" className="flex items-center gap-1">
                <Lock className="h-3.5 w-3.5" />
                {t("reset.new_password", "New password")}
              </Label>
              <Input
                id="rp-pw"
                type="password"
                required
                minLength={8}
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <p className="text-[11px] text-muted-foreground mt-1">
                {t("reset.rule", "Minimum 8 characters.")}
              </p>
            </div>
            <div>
              <Label htmlFor="rp-pw2">
                {t("reset.confirm_password", "Confirm new password")}
              </Label>
              <Input
                id="rp-pw2"
                type="password"
                required
                minLength={8}
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className={
                  confirmPassword && confirmPassword !== password
                    ? "border-destructive focus-visible:ring-destructive"
                    : ""
                }
              />
              {confirmPassword && confirmPassword !== password && (
                <p className="text-xs text-destructive mt-1">
                  {t("reset.mismatch", "Passwords do not match")}
                </p>
              )}
            </div>
            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                t("reset.submit", "Update password")
              )}
            </Button>
          </form>
        )}
      </div>
    </div>
  );
};

export default ResetPassword;
