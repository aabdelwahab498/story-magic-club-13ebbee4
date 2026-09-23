import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Loader2, Mail } from "lucide-react";
import { authApi } from "@/api/auth.api";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { checkRateLimit, recordHit } from "@/lib/rateLimit";

interface Props {
  email: string;
  redirectTo?: string;
  /** Cooldown in seconds between resends (default 30). */
  cooldown?: number;
}

// Hard cap: 5 resends per email per hour, then 1h lockout.
const RL_WINDOW_MS = 60 * 60 * 1000;
const RL_MAX_HITS = 5;
const RL_BLOCK_MS = 60 * 60 * 1000;

const ResendConfirmation = ({ email, cooldown = 30 }: Props) => {
  const { t } = useTranslation();
  const [sending, setSending] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(0);

  useEffect(() => {
    if (secondsLeft <= 0) return;
    const id = window.setInterval(() => setSecondsLeft((s) => s - 1), 1000);
    return () => window.clearInterval(id);
  }, [secondsLeft]);

  const resend = async () => {
    if (secondsLeft > 0 || sending) return;

    const key = `resend:${email.toLowerCase()}`;
    const rl = checkRateLimit(key, RL_MAX_HITS, RL_WINDOW_MS);
    if (!rl.allowed) {
      const mins = Math.ceil(rl.retryInSeconds / 60);
      toast.error(
        t(
          "resend.rate_limited",
          "You've requested too many emails. Try again in {{mins}} min.",
          { mins }
        )
      );
      setSecondsLeft(rl.retryInSeconds);
      return;
    }

    setSending(true);
    // Canonical auth authority (Lovable Cloud) owns the signup confirmation email.
    const { error } = await supabase.auth.resend({
      type: "signup",
      email: email.trim(),
      options: {
        emailRedirectTo: redirectTo ?? `${window.location.origin}/`,
      },
    });
    setSending(false);
    if (error) {
      const rateLimited =
        error.status === 429 || /rate limit|too many/i.test(error.message ?? "");
      toast.error(
        rateLimited
          ? t(
              "resend.rate_limited_server",
              "Too many email requests. Please wait a few minutes and try again."
            )
          : error.message ||
              t("resend.failed", "We couldn't send the email right now. Please try again."),
        { duration: 7000 }
      );
      if (rateLimited) setSecondsLeft(Math.max(cooldown, 60));
      return;
    }
    const serverMessage = "";
    recordHit(key, RL_MAX_HITS, RL_WINDOW_MS, RL_BLOCK_MS);
    setSecondsLeft(cooldown);
    toast.success(
      serverMessage || t("resend.sent", "Confirmation email re-sent ✉️")
    );
  };

  return (
    <Button
      type="button"
      variant="outline"
      className="w-full"
      onClick={resend}
      disabled={sending || secondsLeft > 0}
      data-testid="resend-confirmation"
      data-cooldown={secondsLeft}
    >
      {sending ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <>
          <Mail className="h-4 w-4 me-1" />
          {secondsLeft > 0
            ? t("resend.wait", "Resend in {{s}}s", { s: secondsLeft })
            : t("resend.button", "Resend confirmation link")}
        </>
      )}
    </Button>
  );
};

export default ResendConfirmation;
