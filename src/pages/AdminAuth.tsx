import { useEffect, useState } from "react";
import { useNavigate, Link, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Loader2, Shield, KeyRound, Mail, Lock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import ResendConfirmation from "@/components/ResendConfirmation";
import { describeAuthError } from "@/lib/authErrors";
import { setAdminRemember, getAdminRemember } from "@/hooks/useAdminSession";

const AdminAuth = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const { session, isStaff, loading: authLoading, refreshAdmin } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [masterKey, setMasterKey] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [remember, setRemember] = useState<boolean>(() => getAdminRemember());
  const [signupSuccess, setSignupSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading) return;
    if (session && isStaff) {
      navigate("/admin/dashboard", { replace: true });
    }
  }, [authLoading, session, isStaff, navigate]);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setAdminRemember(remember);
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setSubmitting(false);
      toast.error(describeAuthError(error, t, "signin"), { duration: 7000 });
      return;
    }

    // Optional master key claim on sign-in
    if (masterKey.trim()) {
      const { data: claimData, error: claimErr } = await supabase.functions.invoke(
        "claim-admin",
        { body: { masterKey: masterKey.trim() } }
      );
      if (claimErr || (claimData as { error?: string })?.error) {
        toast.error(
          (claimData as { error?: string })?.error ||
            claimErr?.message ||
            t("admin_auth.master_invalid", "Invalid master key")
        );
      } else {
        toast.success(t("admin_auth.master_granted", "Admin access granted ✨"));
      }
      setMasterKey("");
    }

    await refreshAdmin();
    setSubmitting(false);

    // Re-check staff status after refresh
    const userId = data.user?.id;
    if (userId) {
      const { data: roles } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId);
      const isStaffNow = (roles ?? []).some(
        (r) => r.role === "admin" || r.role === "editor"
      );
      if (isStaffNow) {
        toast.success(t("admin_auth.welcome", "Welcome back, Admin ✨"));
        navigate("/admin/dashboard", { replace: true });
      } else {
        toast.error(
          t(
            "admin_auth.not_admin",
            "This account does not have admin access. Enter the owner master key to claim it."
          )
        );
      }
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      toast.error(t("admin_auth.password_mismatch", "Passwords do not match"));
      return;
    }
    if (password.length < 8) {
      toast.error(
        t("admin_auth.password_too_short", "Admin password must be at least 8 characters")
      );
      return;
    }
    if (!masterKey.trim()) {
      toast.error(
        t(
          "admin_auth.master_required",
          "Owner master key is required to register an admin account"
        )
      );
      return;
    }
    setSubmitting(true);
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/admin/auth`,
        data: {
          display_name: displayName || email.split("@")[0],
          preferred_language: localStorage.getItem("starry-tales-language") || "en",
          intended_role: "admin",
        },
      },
    });
    setSubmitting(false);
    if (error) {
      toast.error(describeAuthError(error, t, "signup"), { duration: 7000 });
      return;
    }
    setSignupSuccess(email);
    toast.success(
      t(
        "admin_auth.check_email",
        "Confirmation email sent. Confirm it, then sign in to claim admin ✉️"
      ),
      { duration: 7000 }
    );
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-[hsl(240,60%,6%)] via-[hsl(260,55%,10%)] to-[hsl(220,60%,8%)] font-comic relative overflow-hidden">
      <div className="starry-sky fixed inset-0 -z-0" />
      <div className="relative z-10 w-full max-w-md bg-card/95 backdrop-blur rounded-3xl shadow-2xl p-6 border-2 border-primary/30">
        <div className="flex items-center justify-center gap-2 mb-1">
          <Shield className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold bg-magic bg-clip-text text-transparent">
            {t("admin_auth.title", "Admin Access")}
          </h1>
        </div>
        <p className="text-center text-xs text-muted-foreground mb-4">
          {t(
            "admin_auth.subtitle",
            "Dedicated portal for staff. Regular users sign in at the main page."
          )}
        </p>

        <Tabs defaultValue="signin">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="signin">
              {t("admin_auth.sign_in_tab", "Sign in")}
            </TabsTrigger>
            <TabsTrigger value="signup">
              {t("admin_auth.sign_up_tab", "Register admin")}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="signin">
            <form onSubmit={handleSignIn} className="space-y-4 mt-4">
              <div>
                <Label htmlFor="ai-email" className="flex items-center gap-1">
                  <Mail className="h-3.5 w-3.5" />
                  {t("admin_auth.email", "Admin email")}
                </Label>
                <Input
                  id="ai-email"
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="ai-pw" className="flex items-center gap-1">
                  <Lock className="h-3.5 w-3.5" />
                  {t("admin_auth.password", "Password")}
                </Label>
                <Input
                  id="ai-pw"
                  type="password"
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
              <div className="rounded-2xl border-2 border-primary/30 bg-primary/5 p-3 space-y-2">
                <Label htmlFor="ai-master" className="flex items-center gap-1 text-xs">
                  <KeyRound className="h-3 w-3 text-primary" />
                  {t("admin_auth.master_key_optional", "Owner master key (optional)")}
                </Label>
                <Input
                  id="ai-master"
                  type="password"
                  autoComplete="off"
                  placeholder="••••••••"
                  value={masterKey}
                  onChange={(e) => setMasterKey(e.target.value)}
                />
                <p className="text-[11px] text-muted-foreground">
                  {t(
                    "admin_auth.master_hint_signin",
                    "Provide on first sign-in to claim admin role for this account."
                  )}
                </p>
              </div>
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 text-xs cursor-pointer select-none">
                  <Checkbox
                    checked={remember}
                    onCheckedChange={(v) => setRemember(Boolean(v))}
                  />
                  <span>{t("admin_auth.remember_me", "Remember me for 7 days")}</span>
                </label>
                <Link to="/forgot-password" className="text-xs text-primary hover:underline">
                  {t("admin_auth.forgot_password", "Forgot password?")}
                </Link>
              </div>
              <Button type="submit" className="w-full" disabled={submitting}>
                {submitting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  t("admin_auth.submit_sign_in", "Enter dashboard")
                )}
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
                  {t("admin_auth.confirm_title", "Confirm your email")}
                </h3>
                <p className="text-sm text-muted-foreground">
                  {t(
                    "admin_auth.confirm_desc",
                    "We sent a confirmation link to {{email}}. Open it, then sign in here to access the admin dashboard.",
                    { email: signupSuccess }
                  )}
                </p>
                <ResendConfirmation
                  email={signupSuccess}
                  redirectTo={`${window.location.origin}/admin/auth`}
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
                  {t("admin_auth.back_to_signin", "Back to sign in")}
                </Button>
              </div>
            ) : (
              <form onSubmit={handleSignUp} className="space-y-4 mt-4">
                <div>
                  <Label htmlFor="ar-name">
                    {t("admin_auth.display_name", "Display name")}
                  </Label>
                  <Input
                    id="ar-name"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="ar-email" className="flex items-center gap-1">
                    <Mail className="h-3.5 w-3.5" />
                    {t("admin_auth.email", "Admin email")}
                  </Label>
                  <Input
                    id="ar-email"
                    type="email"
                    required
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="ar-pw" className="flex items-center gap-1">
                    <Lock className="h-3.5 w-3.5" />
                    {t("admin_auth.password", "Password")}
                  </Label>
                  <Input
                    id="ar-pw"
                    type="password"
                    required
                    minLength={8}
                    autoComplete="new-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                  <p className="text-[11px] text-muted-foreground mt-1">
                    {t("admin_auth.password_rule", "Minimum 8 characters.")}
                  </p>
                </div>
                <div>
                  <Label htmlFor="ar-pw2">
                    {t("admin_auth.confirm_password", "Confirm password")}
                  </Label>
                  <Input
                    id="ar-pw2"
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
                      {t("admin_auth.password_mismatch", "Passwords do not match")}
                    </p>
                  )}
                </div>
                <div className="rounded-2xl border-2 border-primary/30 bg-primary/5 p-3 space-y-2">
                  <Label htmlFor="ar-master" className="flex items-center gap-1 text-xs">
                    <KeyRound className="h-3 w-3 text-primary" />
                    {t("admin_auth.master_key_required", "Owner master key (required)")}
                  </Label>
                  <Input
                    id="ar-master"
                    type="password"
                    autoComplete="off"
                    required
                    placeholder="••••••••"
                    value={masterKey}
                    onChange={(e) => setMasterKey(e.target.value)}
                  />
                  <p className="text-[11px] text-muted-foreground">
                    {t(
                      "admin_auth.master_hint_signup",
                      "Required to authorise creation of a new admin account. Use it again on first sign-in to activate the role."
                    )}
                  </p>
                </div>
                <Button type="submit" className="w-full" disabled={submitting}>
                  {submitting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    t("admin_auth.submit_sign_up", "Create admin account")
                  )}
                </Button>
              </form>
            )}
          </TabsContent>
        </Tabs>

        <div className="text-center mt-4 space-y-1">
          <Link to="/auth" className="block text-xs text-muted-foreground hover:text-primary underline">
            {t("admin_auth.user_signin", "Not an admin? Use the regular sign-in")}
          </Link>
          <Link to="/" className="block text-xs text-primary hover:underline">
            {t("auth.back_home", "Back to home")}
          </Link>
        </div>
      </div>
    </div>
  );
};

export default AdminAuth;
