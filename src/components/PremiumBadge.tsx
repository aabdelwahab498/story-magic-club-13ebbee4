import { useNavigate, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Crown, Lock } from "lucide-react";

interface Props {
  /** Pre-translated feature label (e.g. result of t("paywall.audio")). */
  feature?: string;
  /** i18n key (under paywall.*) to translate inside the badge. Overrides `feature`. */
  featureKey?: "illustrations" | "pdf" | "audio";
  /** Visual size */
  size?: "sm" | "md" | "lg";
  variant?: "lock" | "crown";
  className?: string;
}

/**
 * Single source of truth for "this feature requires a paid plan" UI.
 * Navigates to /pricing while preserving the current path so the user
 * comes back to the same screen after subscribing.
 */
const PremiumBadge = ({ feature, featureKey, size = "md", variant = "crown", className = "" }: Props) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const Icon = variant === "lock" ? Lock : Crown;

  const sizeCls =
    size === "sm"
      ? "px-3 py-1.5 text-xs"
      : size === "lg"
      ? "px-6 py-3 text-base"
      : "px-5 py-2.5 text-sm";

  const iconCls = size === "sm" ? "h-3.5 w-3.5" : size === "lg" ? "h-5 w-5" : "h-4 w-4";

  const featureLabel = featureKey ? t(`paywall.${featureKey}`) : feature;
  const label = featureLabel
    ? t("paywall.feature_premium", "{{feature}} — Premium", { feature: featureLabel })
    : t("paywall.premium_feature", "Premium feature");

  const handleClick = () => {
    navigate("/pricing", {
      state: { from: `${location.pathname}${location.search}` },
    });
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      className={`inline-flex items-center gap-2 rounded-full font-bold bg-gradient-to-r from-amber-400 to-pink-500 text-white shadow-md hover:shadow-lg hover:scale-[1.03] transition-all ${sizeCls} ${className}`}
      title={t("paywall.upgrade_title", "Upgrade your plan")}
      aria-label={t("paywall.upgrade_title", "Upgrade your plan")}
    >
      <Icon className={iconCls} />
      <span>{label}</span>
    </button>
  );
};

export default PremiumBadge;
