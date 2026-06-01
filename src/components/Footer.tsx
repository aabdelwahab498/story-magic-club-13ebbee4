import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import najmahLogoFull from "@/assets/najmah-logo-full.webp";
import SocialMediaIcons from "./SocialMediaIcons";
import { useSoundEffects } from "@/hooks/useSoundEffects";

const Footer = () => {
  const { t } = useTranslation();
  const sfx = useSoundEffects();
  const year = new Date().getFullYear();

  return (
    <footer className="relative z-10 mt-12 border-t-2 border-kids-softPurple dark:border-primary/30 bg-white/80 dark:bg-card/70 backdrop-blur rounded-t-3xl">
      <div className="container mx-auto px-4 sm:px-6 py-8 flex flex-col items-center gap-5">
        <Link to="/" className="flex items-center gap-2 group" {...sfx}>
          <img
            src={najmahLogoFull}
            alt={t("app.name")}
            className="h-12 sm:h-16 w-auto object-contain group-hover:animate-wiggle drop-shadow-md"
          />
        </Link>

        {/* Social media icons — visible on ALL devices */}
        <div className="w-full flex flex-col items-center gap-2">
          <p className="text-xs uppercase tracking-wide font-bold text-muted-foreground">
            {t("footer.follow_us", "Follow us")}
          </p>
          <SocialMediaIcons
            orientation="horizontal"
            size="md"
            showPlaceholders
            className="!flex !flex-row !flex-wrap !justify-center !gap-2 bg-transparent"
          />
        </div>

        {/* Quick links */}
        <nav
          aria-label="Footer"
          className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-sm font-semibold"
        >
          <Link to="/" className="hover:text-primary transition-colors">
            {t("nav.home")}
          </Link>
          <span aria-hidden="true" className="opacity-40">•</span>
          <Link to="/stories" className="hover:text-primary transition-colors">
            {t("nav.stories")}
          </Link>
          <span aria-hidden="true" className="opacity-40">•</span>
          <Link to="/ai-storyteller" className="hover:text-primary transition-colors">
            {t("nav.ai_storyteller")}
          </Link>
          <span aria-hidden="true" className="opacity-40">•</span>
          <Link to="/drawing-competition" className="hover:text-primary transition-colors">
            {t("nav.drawing_contest")}
          </Link>
          <span aria-hidden="true" className="opacity-40">•</span>
          <Link to="/store" className="hover:text-primary transition-colors">
            {t("nav.store")}
          </Link>
          <span aria-hidden="true" className="opacity-40">•</span>
          <Link to="/blog" className="hover:text-primary transition-colors">
            {t("nav.blog")}
          </Link>
          <span aria-hidden="true" className="opacity-40">•</span>
          <Link to="/pricing" className="hover:text-primary transition-colors">
            {t("nav.pricing")}
          </Link>
          <span aria-hidden="true" className="opacity-40">•</span>
          <Link to="/contact" className="hover:text-primary transition-colors">
            {t("nav.contact")}
          </Link>
          <span aria-hidden="true" className="opacity-40">•</span>
          <Link to="/privacy" className="hover:text-primary transition-colors">
            {t("nav.privacy", "Privacy Policy")}
          </Link>
          <span aria-hidden="true" className="opacity-40">•</span>
          <Link to="/terms" className="hover:text-primary transition-colors">
            {t("nav.terms", "Terms of Service")}
          </Link>
          <span aria-hidden="true" className="opacity-40">•</span>
          <Link to="/install" className="hover:text-primary transition-colors">
            {t("pwa.install", "Install app")}
          </Link>
        </nav>

        <p className="text-xs text-muted-foreground text-center">
          © {year} {t("app.name")} — {t("footer.rights")}
        </p>
      </div>

      {/* Spacer so the floating BottomNav (mobile) and AI assistant button (all sizes)
          don't visually overlap the footer content. */}
      <div className="h-36 lg:h-20" aria-hidden="true" />
    </footer>
  );
};

export default Footer;
