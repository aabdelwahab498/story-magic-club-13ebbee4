import { useEffect, useState } from "react";
import { useNavigate, Link, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Loader2, Shield, User as UserIcon, KeyRound } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import ResendConfirmation from "@/components/ResendConfirmation";

const Auth = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const { session, isStaff, loading: authLoading, refreshAdmin } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [signupSuccess, setSignupSuccess] = useState<string | null>(null);
  const [showOwnerField, setShowOwnerField] = useState(false);
  const [masterKey, setMasterKey] = useState("");

  const stateFrom = (location.state as { from?: string } | null)?.from;
  const queryRedirect = new URLSearchParams(location.search).get("redirect");
  const from = stateFrom || queryRedirect || undefined;
  const resolveDest = (goStaff: boolean) =>
    from && !from.startsWith("/admin")
      ? from
      : goStaff
      ? "/admin/dashboard"
      : "/";

  useEffect(() => {
    if (authLoading || !session?.user?.id) return;
    let cancelled = false;
    (async () => {
      const { data: roles } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", session.user.id);
      if (cancelled) return;
      const goStaff = (roles ?? []).some(
        (r) => r.role === "admin" || r.role === "editor"
      );
      navigate(resolveDest(goStaff), { replace: true });
    })();
    return () => {
      cancelled = true;
    };
    return () => {
      cancelled = true;
    };
  }, [authLoading, session, navigate, from]);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setSubmitting(false);
      toast.error(error.message);
      return;
    }

    // If a master key was provided, claim admin role via secure edge function
    if (masterKey.trim()) {
      const { data: claimData, error: claimErr } = await supabase.functions.invoke(
        "claim-admin",
        { body: { masterKey: masterKey.trim() } }
      );
      if (claimErr || (claimData as { error?: string })?.error) {
        const msg =
          (claimData as { error?: string })?.error ||
          claimErr?.message ||
          t("auth.master_invalid", "Invalid master key");
        toast.error(msg);
      } else {
        toast.success(t("auth.master_granted", "Owner access granted ✨"));
      }
      setMasterKey("");
    }

    await refreshAdmin();
    setSubmitting(false);
    const userId = data.user?.id;
    let goStaff = false;
    if (userId) {
      const { data: roles } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId);
      goStaff = (roles ?? []).some(
        (r) => r.role === "admin" || r.role === "editor"
      );
    }
    const friendlyName =
      (data.user?.user_metadata as { display_name?: string } | undefined)?.display_name ||
      data.user?.email?.split("@")[0] ||
      "";
    toast.success(
      goStaff
        ? t("auth.welcome_admin", "Welcome back, Admin! ✨")
        : t("auth.welcome_named", "Welcome back, {{name}}! ✨", { name: friendlyName }),
      { duration: 4000 }
    );
    navigate(resolveDest(goStaff), { replace: true });
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      toast.error(t("auth.password_mismatch", "Passwords do not match"));
      return;
    }
    if (password.length < 6) {
      toast.error(t("auth.password_too_short", "Password must be at least 6 characters"));
      return;
    }
    setSubmitting(true);
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/`,
        data: {
          display_name: displayName,
          preferred_language: localStorage.getItem("starry-tales-language") || "en",
        },
      },
    });
    setSubmitting(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setSignupSuccess(email);
    toast.success(
      t("auth.check_email", "Check your inbox to confirm your email ✉️"),
      { duration: 6000 }
    );
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-b from-kids-softPurple to-kids-softBlue font-comic">
      <div className="w-full max-w-md bg-card rounded-2xl shadow-xl p-6">
        <h1 className="text-2xl font-bold text-center mb-2 text-kids-midnight">
          {t("auth.title")}
        </h1>
        <p className="text-center text-sm text-muted-foreground mb-4">
          {t("auth.role_hint", "Admins are taken to the dashboard, kids to the magical home page ✨")}
        </p>
        <div className="mb-4 flex justify-center">
          <div className="flex items-center gap-2 rounded-2xl border-2 border-kids-softBlue/40 bg-kids-softBlue/20 px-3 py-2">
            <UserIcon className="h-4 w-4 text-kids-blue shrink-0" />
            <span className="text-xs font-medium">
              {t("auth.role_user", "Kid → Stories")}
            </span>
          </div>
        </div>

        <Tabs defaultValue="signin">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="signin">{t("auth.sign_in_tab")}</TabsTrigger>
            <TabsTrigger value="signup">{t("auth.sign_up_tab")}</TabsTrigger>
          </TabsList>

          <Button
            type="button"
            variant="outline"
            className="w-full mt-4 gap-2 font-bold"
            onClick={async () => {
              const result = await lovable.auth.signInWithOAuth("google", {
                redirect_uri: window.location.origin,
              });
              if (result.error) {
                toast.error((result.error as Error).message ?? "Google sign-in failed");
              }
            }}
          >
            <svg className="h-4 w-4" viewBox="0 0 48 48" aria-hidden="true">
              <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.4 29.2 35.5 24 35.5c-6.4 0-11.5-5.1-11.5-11.5S17.6 12.5 24 12.5c2.9 0 5.6 1.1 7.6 2.9l5.7-5.7C33.6 6.5 29 4.5 24 4.5 13.2 4.5 4.5 13.2 4.5 24S13.2 43.5 24 43.5 43.5 34.8 43.5 24c0-1.2-.1-2.3-.4-3.5z"/>
              <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 16 19 12.5 24 12.5c2.9 0 5.6 1.1 7.6 2.9l5.7-5.7C33.6 6.5 29 4.5 24 4.5 16.3 4.5 9.7 8.9 6.3 14.7z"/>
              <path fill="#4CAF50" d="M24 43.5c5 0 9.5-1.9 12.9-5l-6-4.9c-1.9 1.4-4.3 2.4-6.9 2.4-5.2 0-9.6-3.1-11.3-7.5l-6.5 5C9.5 39 16.2 43.5 24 43.5z"/>
              <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.4-2.4 4.5-4.4 5.9l6 4.9c-.4.4 6.6-4.8 6.6-14.8 0-1.2-.1-2.3-.4-3.5z"/>
            </svg>
            {t("auth.sign_in_google", "Continue with Google")}
          </Button>

          <div className="flex items-center gap-2 my-4">
            <div className="flex-1 h-px bg-border" />
            <span className="text-xs text-muted-foreground">
              {t("auth.or", "or")}
            </span>
            <div className="flex-1 h-px bg-border" />
          </div>


          <TabsContent value="signin">
            {new URLSearchParams(location.search).get("demo") === "1" && (
              <div className="mt-3 rounded-2xl border-2 border-primary/30 bg-primary/5 p-3 text-xs space-y-2">
                <div className="flex items-center gap-2 font-semibold text-primary">
                  <Shield className="h-3.5 w-3.5" />
                  {t("auth.demo_admin_title", "Demo admin access")}
                </div>
                <p className="text-muted-foreground leading-snug">
                  {t(
                    "auth.demo_admin_desc",
                    "Use these credentials to preview the full admin dashboard."
                  )}
                </p>
                <div className="rounded-lg bg-background/60 px-2 py-1.5 font-mono text-[11px] leading-relaxed">
                  <div>demo-admin@najmah.app</div>
                  <div>NajmahDemo2026!</div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setEmail("demo-admin@najmah.app");
                    setPassword("NajmahDemo2026!");
                    toast.info(t("auth.demo_filled", "Demo admin credentials filled ✨"));
                  }}
                  className="w-full rounded-full bg-primary/10 hover:bg-primary/20 px-3 py-1.5 font-medium text-primary transition-colors"
                >
                  {t("auth.demo_fill", "Fill demo admin credentials")}
                </button>
              </div>
            )}
            
            <form onSubmit={handleSignIn} className="space-y-4 mt-4">
              <div>
                <Label htmlFor="si-email">{t("auth.email")}</Label>
                <Input
                  id="si-email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="si-pw">{t("auth.password")}</Label>
                <Input
                  id="si-pw"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
              <div className="pt-1">
                {showOwnerField ? (
                  <div className="rounded-2xl border-2 border-primary/30 bg-primary/5 p-3 space-y-2">
                    <Label htmlFor="si-master" className="flex items-center gap-1 text-xs">
                      <KeyRound className="h-3 w-3 text-primary" />
                      {t("auth.master_key", "Owner master key")}
                    </Label>
                    <Input
                      id="si-master"
                      type="password"
                      autoComplete="off"
                      placeholder="••••••••"
                      value={masterKey}
                      onChange={(e) => setMasterKey(e.target.value)}
                    />
                    <p className="text-[11px] text-muted-foreground">
                      {t(
                        "auth.master_hint",
                        "Optional. Unlocks admin role for this account."
                      )}
                    </p>
                    <button
                      type="button"
                      className="text-[11px] text-muted-foreground hover:text-foreground underline"
                      onClick={() => {
                        setShowOwnerField(false);
                        setMasterKey("");
                      }}
                    >
                      {t("auth.master_hide", "Hide")}
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setShowOwnerField(true)}
                    className="text-xs text-muted-foreground hover:text-primary underline"
                  >
                    {t("auth.master_show", "Owner login")}
                  </button>
                )}
              </div>
              <div className="text-right">
                <Link to="/forgot-password" className="text-xs text-primary hover:underline">
                  {t("auth.forgot_password", "Forgot password?")}
                </Link>
              </div>
              <Button type="submit" className="w-full" disabled={submitting}>
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : t("auth.submit_sign_in")}
              </Button>
            </form>
          </TabsContent>

          <TabsContent value="signup">
            {signupSuccess ? (
              <div className="mt-4 rounded-2xl border-2 border-emerald-500/40 bg-emerald-500/10 p-5 text-center space-y-3">
                <div className="mx-auto h-12 w-12 rounded-full bg-emerald-500/20 flex items-center justify-center text-2xl">
                  ✉️
                </div>
                <h3 className="font-bold text-base">
                  {t("auth.confirm_title", "Confirm your email")}
                </h3>
                <p className="text-sm text-muted-foreground">
                  {t(
                    "auth.confirm_desc",
                    "We sent a confirmation link to {{email}}. Open it to activate your account, then sign in.",
                    { email: signupSuccess }
                  )}
                </p>
                <ResendConfirmation
                  email={signupSuccess}
                  redirectTo={`${window.location.origin}/`}
                />
                <Button
                  type="button"
                  variant="ghost"
                  className="w-full"
                  onClick={() => {
                    setSignupSuccess(null);
                    setPassword("");
                    setConfirmPassword("");
                  }}
                >
                  {t("auth.back_to_signin", "Back to sign in")}
                </Button>
              </div>
            ) : (
              <form onSubmit={handleSignUp} className="space-y-4 mt-4">
                <div>
                  <Label htmlFor="su-name">{t("auth.display_name")}</Label>
                  <Input
                    id="su-name"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="su-email">{t("auth.email")}</Label>
                  <Input
                    id="su-email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="su-pw">{t("auth.password")}</Label>
                  <Input
                    id="su-pw"
                    type="password"
                    required
                    minLength={6}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="su-pw2">
                    {t("auth.confirm_password", "Confirm password")}
                  </Label>
                  <Input
                    id="su-pw2"
                    type="password"
                    required
                    minLength={6}
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
                      {t("auth.password_mismatch", "Passwords do not match")}
                    </p>
                  )}
                </div>
                <Button type="submit" className="w-full" disabled={submitting}>
                  {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : t("auth.submit_sign_up")}
                </Button>
              </form>
            )}
          </TabsContent>
        </Tabs>


        <div className="text-center mt-4">
          <Link to="/" className="text-sm text-primary hover:underline">
            {t("auth.back_home")}
          </Link>
        </div>
      </div>
    </div>
  );
};

export default Auth;
