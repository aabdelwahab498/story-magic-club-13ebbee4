import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Loader2, CheckCircle2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { authApi } from "@/api/auth.api";
import { useAuth } from "@/hooks/useAuth";

type State = "verifying" | "success" | "error";

/**
 * Email confirmation landing page: /auth/callback?token_hash=...&type=signup
 * The token hash is used once, never stored and never logged.
 */
const AuthCallback = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { refreshAdmin } = useAuth();
  const [state, setState] = useState<State>("verifying");
  const [message, setMessage] = useState<string>("");
  const started = useRef(false);

  const tokenHash = params.get("token_hash");
  const type = params.get("type");

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    if (!tokenHash || type !== "signup") {
      setState("error");
      setMessage(
        t(
          "auth.callback_invalid",
          "This confirmation link is invalid or incomplete. Please request a new one."
        )
      );
      return;
    }

    let active = true;
    (async () => {
      try {
        await authApi.verifyEmail(tokenHash);
        if (!active) return;
        try {
          await refreshAdmin?.();
        } catch {
          /* non-fatal */
        }
        setState("success");
        setTimeout(() => navigate("/", { replace: true }), 1500);
      } catch {
        if (!active) return;
        setState("error");
        setMessage(
          t(
            "auth.callback_failed",
            "This confirmation link has expired or was already used. Please request a new one."
          )
        );
      }
    })();

    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-b from-kids-softPurple to-kids-softBlue font-comic">
      <div className="w-full max-w-md bg-card rounded-2xl shadow-xl p-6 text-center space-y-4">
        {state === "verifying" && (
          <>
            <Loader2 className="h-10 w-10 mx-auto animate-spin text-primary" />
            <h1 className="text-xl font-bold">
              {t("auth.callback_verifying", "Confirming your email…")}
            </h1>
          </>
        )}

        {state === "success" && (
          <>
            <CheckCircle2 className="h-12 w-12 mx-auto text-emerald-500" />
            <h1 className="text-xl font-bold">
              {t("auth.callback_success", "Email confirmed ✨")}
            </h1>
            <p className="text-sm text-muted-foreground">
              {t("auth.callback_success_desc", "Taking you to your stories…")}
            </p>
          </>
        )}

        {state === "error" && (
          <>
            <AlertTriangle className="h-12 w-12 mx-auto text-destructive" />
            <h1 className="text-xl font-bold">
              {t("auth.callback_error_title", "Confirmation problem")}
            </h1>
            <p className="text-sm text-muted-foreground" data-testid="callback-error">
              {message}
            </p>
            <Button className="w-full" onClick={() => navigate("/auth", { replace: true })}>
              {t("auth.back_to_signin", "Back to sign in")}
            </Button>
            <Link to="/" className="block text-sm text-primary hover:underline">
              {t("auth.back_home", "Back home")}
            </Link>
          </>
        )}
      </div>
    </div>
  );
};

export default AuthCallback;
