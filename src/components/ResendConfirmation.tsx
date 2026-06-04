import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Loader2, Mail } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface Props {
  email: string;
  redirectTo?: string;
  /** Cooldown in seconds between resends (default 30). */
  cooldown?: number;
}

const ResendConfirmation = ({ email, redirectTo, cooldown = 30 }: Props) => {
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
    setSending(true);
    const { error } = await supabase.auth.resend({
      type: "signup",
      email,
      options: redirectTo ? { emailRedirectTo: redirectTo } : undefined,
    });
    setSending(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setSecondsLeft(cooldown);
    toast.success(t("resend.sent", "Confirmation email re-sent ✉️"));
  };

  return (
    <Button
      type="button"
      variant="outline"
      className="w-full"
      onClick={resend}
      disabled={sending || secondsLeft > 0}
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
