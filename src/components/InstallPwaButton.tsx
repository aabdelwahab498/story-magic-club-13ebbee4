import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { usePwaInstall } from "@/hooks/usePwaInstall";
import { toast } from "sonner";

interface Props {
  variant?: "compact" | "full";
  className?: string;
}

const InstallPwaButton = ({ variant = "compact", className = "" }: Props) => {
  const { t } = useTranslation();
  const { canInstall, isInstalled, isIOS, promptInstall } = usePwaInstall();

  if (isInstalled) return null;

  // iOS: point to /install page with manual instructions
  if (isIOS && !canInstall) {
    return (
      <Button
        asChild
        size={variant === "compact" ? "sm" : "default"}
        variant="outline"
        className={`rounded-full border-2 border-primary/40 hover:border-primary ${className}`}
      >
        <Link to="/install">
          <Download className="h-4 w-4 me-1" />
          {t("pwa.install", "Install app")}
        </Link>
      </Button>
    );
  }

  if (!canInstall) return null;

  const onClick = async () => {
    const outcome = await promptInstall();
    if (outcome === "accepted") {
      toast.success(t("pwa.installed_toast", "App installed!"));
    }
  };

  return (
    <Button
      size={variant === "compact" ? "sm" : "default"}
      onClick={onClick}
      className={`rounded-full bg-magic text-primary-foreground shadow-glow hover:opacity-95 font-bold ${className}`}
    >
      <Download className="h-4 w-4 me-1" />
      {t("pwa.install", "Install app")}
    </Button>
  );
};

export default InstallPwaButton;
